import { Router } from "express";
import { db } from "@workspace/db";
import { gdsSettingsTable, usersTable, flightQuotationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import Amadeus from "amadeus";
import axios from "axios";

const router = Router();

// ── Types ────────────────────────────────────────────────────────────────────

interface RouteLeg {
  origin: string;
  destination: string;
  departureDate: string;
}

interface SearchParams {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  adults: number;
  cabinClass: string;
  legs?: RouteLeg[];
}

interface FlightResult {
  id: string;
  source: string;
  airline: string;
  airlineName: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  stops: number;
  cabinClass: string;
  price: number;
  currency: string;
  seatsAvailable: number | null;
  refundable: boolean;
  legIndex?: number;
}

// ── Currency rates cache ─────────────────────────────────────────────────────

let ratesCache: { rates: Record<string, number>; timestamp: number; source?: string } | null = null;

// Fallback rates (USD-base) used when forex.pk is unreachable
const FALLBACK_RATES: Record<string, number> = {
  USD: 1, GBP: 0.7900, EUR: 0.9200, AED: 3.6700, SAR: 3.7500,
  PKR: 278.50, TRY: 32.50, OMR: 0.3850, KWD: 0.3070, BHD: 0.3770,
  QAR: 3.6400, JOD: 0.7090, EGP: 30.90, CAD: 1.3600, AUD: 1.5300,
  CNY: 7.25, INR: 83.50, MYR: 4.72, NZD: 1.64, NOK: 10.54,
};

// ── Forex.pk scraper ─────────────────────────────────────────────────────────
// forex.pk open market page pattern:
//   <a href="...currency-XXX-to-pkr...">XXX</a></td>
//   <td align="center">BUYING</td>
//   <td align="center">SELLING</td>
// We use the mid-rate: (buying + selling) / 2

function parseForexPk(html: string): Record<string, number> {
  const pkrRates: Record<string, number> = {};

  // Match: CODE</a></td> then buying rate then selling rate
  const rowRe = />([A-Z]{2,4}(?:-[A-Z]{2})?)<\/a><\/td>[\s\S]*?<td[^>]*align="center"[^>]*>([\d.]+)<\/td>[\s\S]*?<td[^>]*align="center"[^>]*>([\d.]+)<\/td>/g;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(html)) !== null) {
    const code = m[1].replace(/-DD$|-TT$/, ""); // normalize USD-DD/TT → USD
    const buying = parseFloat(m[2]);
    const selling = parseFloat(m[3]);
    if (!isNaN(buying) && !isNaN(selling) && buying > 0) {
      const mid = (buying + selling) / 2;
      // Keep first occurrence (USD-DD comes before USD, skip duplicates)
      if (!pkrRates[code]) pkrRates[code] = mid;
    }
  }

  if (!pkrRates["USD"] || Object.keys(pkrRates).length < 5) return {};

  // Convert PKR-base → USD-base
  // pkrRates[code] = PKR per 1 unit of code
  // usdRates[code] = how many units of code per 1 USD = pkrRates[USD] / pkrRates[code]
  const pkrPerUsd = pkrRates["USD"];
  const usdRates: Record<string, number> = { USD: 1, PKR: pkrPerUsd };
  for (const [code, pkrRate] of Object.entries(pkrRates)) {
    if (code !== "USD" && pkrRate > 0) {
      usdRates[code] = pkrPerUsd / pkrRate;
    }
  }
  return usdRates;
}

async function getExchangeRates(): Promise<Record<string, number>> {
  const now = Date.now();
  if (ratesCache && now - ratesCache.timestamp < 3600_000) return ratesCache.rates;
  try {
    const res = await axios.get("https://www.forex.pk/open_market_rates.asp", {
      timeout: 8000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    const parsed = parseForexPk(res.data as string);
    if (Object.keys(parsed).length >= 5) {
      // Merge with fallback so any missing currencies still have a value
      const rates = { ...FALLBACK_RATES, ...parsed, USD: 1 };
      ratesCache = { rates, timestamp: now, source: "forex.pk" };
      return rates;
    }
    throw new Error("forex.pk parse returned too few rates");
  } catch (e: any) {
    // Silently fall back — use cached if available, otherwise hardcoded
    const rates = ratesCache?.rates || FALLBACK_RATES;
    ratesCache = { rates, timestamp: now, source: "fallback" };
    return rates;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function cabinToAmadeus(cabin: string): string {
  return { economy: "ECONOMY", premium_economy: "PREMIUM_ECONOMY", business: "BUSINESS", first: "FIRST" }[cabin] || "ECONOMY";
}

function parseDuration(iso: string): string {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!m) return iso;
  return `${m[1] ? m[1] + "h " : ""}${m[2] ? m[2] + "m" : ""}`.trim();
}

// ── Mock data ────────────────────────────────────────────────────────────────

function mockFlights(params: SearchParams, source: string, legIndex = 0): FlightResult[] {
  const airlines = [
    { code: "SV", name: "Saudia" }, { code: "EK", name: "Emirates" },
    { code: "QR", name: "Qatar Airways" }, { code: "EY", name: "Etihad Airways" },
    { code: "FZ", name: "Flydubai" }, { code: "BA", name: "British Airways" },
    { code: "TK", name: "Turkish Airlines" },
  ];
  const basePrice = { economy: 420, premium_economy: 780, business: 1850, first: 3200 }[params.cabinClass] || 420;
  return airlines.slice(0, 5).map((airline, i) => {
    const deptHour = 6 + i * 3;
    const durationH = 7 + (i % 3);
    const durationM = (i * 17) % 60;
    const arrHour = (deptHour + durationH) % 24;
    return {
      id: `${source}-mock-leg${legIndex}-${i}`,
      source,
      airline: airline.code,
      airlineName: airline.name,
      flightNumber: `${airline.code}${100 + legIndex * 100 + i * 37}`,
      origin: params.origin,
      destination: params.destination,
      departureTime: `${params.departureDate}T${String(deptHour).padStart(2, "0")}:${String((i * 15) % 60).padStart(2, "0")}:00`,
      arrivalTime: `${params.departureDate}T${String(arrHour).padStart(2, "0")}:${String((i * 20) % 60).padStart(2, "0")}:00`,
      duration: `${durationH}h ${durationM}m`,
      stops: i === 0 ? 0 : i === 1 ? 0 : 1,
      cabinClass: params.cabinClass,
      price: (basePrice + i * 85 + legIndex * 60),
      currency: "USD",
      seatsAvailable: 2 + i * 3,
      refundable: i % 2 === 0,
      legIndex,
    };
  });
}

// ── Amadeus Search ───────────────────────────────────────────────────────────

async function searchAmadeus(setting: any, params: SearchParams, legIndex = 0): Promise<FlightResult[]> {
  const amadeus = new Amadeus({
    clientId: setting.clientId || "test",
    clientSecret: setting.clientSecret || "test",
    hostname: setting.environment !== "production" ? "test" : "production",
  });
  const p: Record<string, string | number> = {
    originLocationCode: params.origin,
    destinationLocationCode: params.destination,
    departureDate: params.departureDate,
    adults: params.adults,
    travelClass: cabinToAmadeus(params.cabinClass),
    max: 12,
    currencyCode: "USD",
  };
  if (params.returnDate) p.returnDate = params.returnDate;
  const response = await amadeus.shopping.flightOffersSearch.get(p);
  return (response.data as any[]).slice(0, 10).map((offer: any) => {
    const itin = offer.itineraries[0];
    const seg = itin.segments[0];
    const last = itin.segments[itin.segments.length - 1];
    return {
      id: offer.id, source: "amadeus",
      airline: seg.carrierCode, airlineName: seg.operating?.carrierCode || seg.carrierCode,
      flightNumber: `${seg.carrierCode}${seg.number}`,
      origin: seg.departure.iataCode, destination: last.arrival.iataCode,
      departureTime: seg.departure.at, arrivalTime: last.arrival.at,
      duration: parseDuration(itin.duration), stops: itin.segments.length - 1,
      cabinClass: params.cabinClass,
      price: parseFloat(offer.price.total), currency: offer.price.currency || "USD",
      seatsAvailable: offer.numberOfBookableSeats || null,
      refundable: offer.pricingOptions?.refundableFare || false,
      legIndex,
    };
  });
}

// ── Sabre Search ─────────────────────────────────────────────────────────────

async function searchSabre(setting: any, params: SearchParams, legIndex = 0): Promise<FlightResult[]> {
  const baseUrl = setting.environment !== "production" ? "https://api.cert.sabre.com" : "https://api.sabre.com";
  const creds = Buffer.from(`${encodeURIComponent(setting.clientId || "")}:${encodeURIComponent(setting.clientSecret || "")}`).toString("base64");
  const tokenRes = await axios.post(`${baseUrl}/v2/auth/token`, "grant_type=client_credentials", {
    headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded" }, timeout: 10000,
  });
  const token = tokenRes.data.access_token;
  const legs: any[] = [{ RPH: "1", DepartureDateTime: `${params.departureDate}T00:00:00`, OriginLocation: { LocationCode: params.origin }, DestinationLocation: { LocationCode: params.destination }, TPA_Extensions: { SegmentType: { Code: "O" } } }];
  if (params.returnDate) legs.push({ RPH: "2", DepartureDateTime: `${params.returnDate}T00:00:00`, OriginLocation: { LocationCode: params.destination }, DestinationLocation: { LocationCode: params.origin }, TPA_Extensions: { SegmentType: { Code: "O" } } });
  const res = await axios.post(`${baseUrl}/v4/offers/shop`, {
    OTA_AirLowFareSearchRQ: {
      Version: "4",
      POS: { Source: [{ PseudoCityCode: setting.pcc || "V948", RequestorID: { Type: "1", ID: "1", CompanyName: { Code: "TN" } } }] },
      OriginDestinationInformation: legs,
      TravelerInfoSummary: { SeatsRequested: [params.adults], AirTravelerAvail: [{ PassengerTypeQuantity: [{ Code: "ADT", Quantity: params.adults }] }] },
      TPA_Extensions: { IntelliSellTransaction: { RequestType: { Name: "200ITINS" } } },
    },
  }, { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, timeout: 15000 });

  const itins = res.data?.groupedItineraryResponse?.itineraryGroups?.[0]?.itineraries || [];
  const legDescs = res.data?.groupedItineraryResponse?.legDescs || [];
  const schedDescs = res.data?.groupedItineraryResponse?.scheduleDescs || [];
  return itins.slice(0, 10).map((itin: any, i: number) => {
    const leg = legDescs.find((l: any) => l.id === itin.legs?.[0]?.ref);
    const sched = schedDescs.find((s: any) => s.id === leg?.schedules?.[0]?.ref);
    const pricing = itin.pricingInformation?.[0]?.fare;
    return {
      id: `sabre-${legIndex}-${i}`, source: "sabre",
      airline: sched?.carrier?.marketing || "XX", airlineName: sched?.carrier?.marketing || "Unknown",
      flightNumber: `${sched?.carrier?.marketing || "XX"}${sched?.carrier?.marketingFlightNumber || i}`,
      origin: params.origin, destination: params.destination,
      departureTime: sched?.departure?.time || "", arrivalTime: sched?.arrival?.time || "",
      duration: leg?.elapsedTime ? `${Math.floor(leg.elapsedTime / 60)}h ${leg.elapsedTime % 60}m` : "",
      stops: (leg?.schedules?.length || 1) - 1, cabinClass: params.cabinClass,
      price: parseFloat(pricing?.totalFare?.totalPerPassenger?.amount || "0"),
      currency: pricing?.totalFare?.totalPerPassenger?.currency || "USD",
      seatsAvailable: null, refundable: false, legIndex,
    };
  });
}

// ── Galileo Search ────────────────────────────────────────────────────────────

async function searchGalileo(setting: any, params: SearchParams, legIndex = 0): Promise<FlightResult[]> {
  const baseUrl = setting.environment !== "production"
    ? "https://americas.universal-api.pp.travelport.com/B2BGateway/connect/uAPI/AirService"
    : "https://americas.universal-api.travelport.com/B2BGateway/connect/uAPI/AirService";
  const cabinMap: Record<string, string> = { economy: "Economy", premium_economy: "PremiumEconomy", business: "Business", first: "First" };
  const res = await axios.post(baseUrl, {
    SearchAirLeg: [{ SearchOrigin: { CityOrAirport: { Code: params.origin } }, SearchDestination: { CityOrAirport: { Code: params.destination } }, SearchDepTime: { PreferredTime: `${params.departureDate}T00:00:00` }, AirLegModifiers: { CabinClass: cabinMap[params.cabinClass] || "Economy" } }],
    AirSearchParameters: { MaxSolutions: 12 },
    SearchPassenger: Array(params.adults).fill({ "@type": "ADT" }),
  }, { auth: { username: setting.username || "", password: setting.password || "" }, headers: { "Content-Type": "application/json", "XAUTH_TRAVELPORT_ACCESSGROUP": setting.pcc || "3PX1" }, timeout: 15000 });

  const solutions = res.data?.airPricingSolution || [];
  return (Array.isArray(solutions) ? solutions : [solutions]).slice(0, 10).map((sol: any, i: number) => {
    const seg = sol?.airSegment?.[0] || {};
    return {
      id: `galileo-${legIndex}-${i}`, source: "galileo",
      airline: seg.Carrier || "XX", airlineName: seg.Carrier || "Unknown",
      flightNumber: `${seg.Carrier || "XX"}${seg.FlightNumber || i}`,
      origin: seg.Origin || params.origin, destination: seg.Destination || params.destination,
      departureTime: seg.DepartureTime || "", arrivalTime: seg.ArrivalTime || "",
      duration: seg.FlightTime ? `${Math.floor(seg.FlightTime / 60)}h ${seg.FlightTime % 60}m` : "",
      stops: 0, cabinClass: params.cabinClass,
      price: parseFloat(sol.TotalPrice?.replace(/[^0-9.]/g, "") || "0"),
      currency: sol.TotalPrice?.replace(/[0-9.]/g, "").trim() || "USD",
      seatsAvailable: null, refundable: false, legIndex,
    };
  });
}

// ── Currency Rates Route ─────────────────────────────────────────────────────

router.get("/currency/rates", async (req, res) => {
  try {
    const rates = await getExchangeRates();
    return res.json({ base: "USD", rates, timestamp: ratesCache?.timestamp || Date.now(), source: ratesCache?.source || "unknown" });
  } catch (err) {
    req.log.error({ err }, "Currency rates error");
    return res.status(500).json({ error: "Could not fetch rates" });
  }
});

// ── Flight Search Route ──────────────────────────────────────────────────────

router.post("/flights/search", async (req, res) => {
  const {
    origin, destination, departureDate, returnDate,
    adults = 1, cabinClass = "economy",
    providers = ["amadeus", "sabre", "galileo"],
    tripType = "one_way",
    legs = [],
  } = req.body;

  if (!origin || !destination || !departureDate) {
    return res.status(400).json({ error: "origin, destination, and departureDate are required" });
  }

  const allSettings = await db.select().from(gdsSettingsTable);
  const settingMap = new Map(allSettings.map(s => [s.provider, s]));

  const results: FlightResult[] = [];
  const errors: Record<string, string> = {};
  const sources: Record<string, string> = {};

  // Build legs to search
  const searchLegs: Array<{ params: SearchParams; legIndex: number }> = [];

  if (tripType === "multi_city" && legs.length > 0) {
    legs.forEach((leg: RouteLeg, i: number) => {
      searchLegs.push({ params: { ...leg, adults: Number(adults), cabinClass }, legIndex: i });
    });
  } else if (tripType === "round_trip") {
    searchLegs.push({ params: { origin, destination, departureDate, returnDate, adults: Number(adults), cabinClass }, legIndex: 0 });
  } else {
    searchLegs.push({ params: { origin, destination, departureDate, adults: Number(adults), cabinClass }, legIndex: 0 });
  }

  await Promise.allSettled(
    searchLegs.flatMap(({ params, legIndex }) =>
      (providers as string[]).map(async (provider) => {
        const setting = settingMap.get(provider);
        const isConfigured = setting?.isActive && setting?.clientId;
        const key = `${provider}-leg${legIndex}`;
        try {
          let res: FlightResult[] = [];
          if (!isConfigured) {
            res = mockFlights(params, provider, legIndex);
            sources[provider] = sources[provider] || "mock";
          } else if (provider === "amadeus") {
            res = await searchAmadeus(setting, params, legIndex);
            sources[provider] = "live";
          } else if (provider === "sabre") {
            res = await searchSabre(setting, params, legIndex);
            sources[provider] = "live";
          } else if (provider === "galileo") {
            res = await searchGalileo(setting, params, legIndex);
            sources[provider] = "live";
          }
          results.push(...res);
        } catch (err: any) {
          req.log.warn({ key, err: err.message }, "GDS search failed, using mock");
          results.push(...mockFlights(params, provider, legIndex));
          sources[provider] = sources[provider] || "mock";
          errors[key] = err.message;
        }
      })
    )
  );

  results.sort((a, b) => (a.legIndex || 0) - (b.legIndex || 0) || a.price - b.price);

  return res.json({ results, sources, errors, total: results.length, tripType });
});

// ── Issue Ticket Route ───────────────────────────────────────────────────────

router.post("/flights/issue-ticket", async (req, res) => {
  try {
    const { bookingId, userEmail, pin } = req.body;
    if (!bookingId || !userEmail || !pin) {
      return res.status(400).json({ error: "bookingId, userEmail, and pin are required" });
    }

    // Verify user PIN
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, userEmail));
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.role === "accounts") return res.status(403).json({ error: "Accounts department is not permitted to issue tickets" });
    if (!user.canIssueTickets) return res.status(403).json({ error: "User is not authorized to issue tickets" });
    if (!user.ticketingPin || user.ticketingPin !== pin) {
      return res.status(401).json({ error: "Invalid ticketing PIN" });
    }

    // Check booking exists and is in booked status
    const [booking] = await db.select().from(flightQuotationsTable)
      .where(eq(flightQuotationsTable.id, parseInt(bookingId)));
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    if (booking.status !== "booked") {
      return res.status(400).json({ error: `Booking must be in 'booked' status to issue ticket (current: ${booking.status})` });
    }

    // Generate ticket number
    const ticketNumber = `TKT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    const [updated] = await db.update(flightQuotationsTable).set({
      status: "ticketed",
      ticketNumber,
      issuedBy: user.id,
      issuedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(flightQuotationsTable.id, parseInt(bookingId))).returning();

    return res.json({
      success: true,
      ticketNumber,
      issuedBy: user.name,
      issuedAt: updated.issuedAt?.toISOString(),
      message: `Ticket ${ticketNumber} issued successfully`,
    });
  } catch (err) {
    req.log.error({ err }, "Issue ticket error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
