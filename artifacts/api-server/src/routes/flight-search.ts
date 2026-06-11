import { Router } from "express";
import { db } from "@workspace/db";
import { gdsSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import Amadeus from "amadeus";
import axios from "axios";

const router = Router();

// ── Helpers ─────────────────────────────────────────────────────────────────

function cabinToAmadeus(cabin: string): string {
  const map: Record<string, string> = {
    economy: "ECONOMY",
    premium_economy: "PREMIUM_ECONOMY",
    business: "BUSINESS",
    first: "FIRST",
  };
  return map[cabin] || "ECONOMY";
}

function parseDuration(iso: string): string {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!m) return iso;
  const h = m[1] ? `${m[1]}h ` : "";
  const min = m[2] ? `${m[2]}m` : "";
  return `${h}${min}`.trim();
}

// ── Amadeus Search ───────────────────────────────────────────────────────────

async function searchAmadeus(setting: any, params: SearchParams): Promise<FlightResult[]> {
  const isTest = setting.environment !== "production";
  const amadeus = new Amadeus({
    clientId: setting.clientId || "test",
    clientSecret: setting.clientSecret || "test",
    hostname: isTest ? "test" : "production",
  });

  const searchParams: Record<string, string | number> = {
    originLocationCode: params.origin,
    destinationLocationCode: params.destination,
    departureDate: params.departureDate,
    adults: params.adults,
    travelClass: cabinToAmadeus(params.cabinClass),
    max: 15,
    currencyCode: "USD",
  };
  if (params.returnDate) {
    searchParams.returnDate = params.returnDate;
  }

  const response = await amadeus.shopping.flightOffersSearch.get(searchParams);
  const offers = response.data as any[];

  return offers.slice(0, 12).map((offer: any) => {
    const itinerary = offer.itineraries[0];
    const seg = itinerary.segments[0];
    const lastSeg = itinerary.segments[itinerary.segments.length - 1];
    const price = offer.price;
    return {
      id: offer.id,
      source: "amadeus",
      airline: seg.carrierCode,
      airlineName: seg.operating?.carrierCode || seg.carrierCode,
      flightNumber: `${seg.carrierCode}${seg.number}`,
      origin: seg.departure.iataCode,
      destination: lastSeg.arrival.iataCode,
      departureTime: seg.departure.at,
      arrivalTime: lastSeg.arrival.at,
      duration: parseDuration(itinerary.duration),
      stops: itinerary.segments.length - 1,
      cabinClass: params.cabinClass,
      price: parseFloat(price.total),
      currency: price.currency || "USD",
      seatsAvailable: offer.numberOfBookableSeats || null,
      refundable: offer.pricingOptions?.refundableFare || false,
    };
  });
}

// ── Sabre Search ─────────────────────────────────────────────────────────────

async function getSabreToken(setting: any): Promise<string> {
  const isTest = setting.environment !== "production";
  const baseUrl = isTest ? "https://api.cert.sabre.com" : "https://api.sabre.com";
  const credentials = Buffer.from(
    `${encodeURIComponent(setting.clientId || "")}:${encodeURIComponent(setting.clientSecret || "")}`
  ).toString("base64");

  const res = await axios.post(
    `${baseUrl}/v2/auth/token`,
    "grant_type=client_credentials",
    {
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      timeout: 10000,
    }
  );
  return res.data.access_token;
}

async function searchSabre(setting: any, params: SearchParams): Promise<FlightResult[]> {
  const isTest = setting.environment !== "production";
  const baseUrl = isTest ? "https://api.cert.sabre.com" : "https://api.sabre.com";
  const token = await getSabreToken(setting);

  const body = {
    OTA_AirLowFareSearchRQ: {
      Version: "4",
      POS: {
        Source: [{ PseudoCityCode: setting.pcc || "V948", RequestorID: { Type: "1", ID: "1", CompanyName: { Code: "TN" } } }],
      },
      OriginDestinationInformation: [
        {
          RPH: "1",
          DepartureDateTime: `${params.departureDate}T00:00:00`,
          OriginLocation: { LocationCode: params.origin },
          DestinationLocation: { LocationCode: params.destination },
          TPA_Extensions: { SegmentType: { Code: "O" } },
        },
        ...(params.returnDate ? [{
          RPH: "2",
          DepartureDateTime: `${params.returnDate}T00:00:00`,
          OriginLocation: { LocationCode: params.destination },
          DestinationLocation: { LocationCode: params.origin },
          TPA_Extensions: { SegmentType: { Code: "O" } },
        }] : []),
      ],
      TravelerInfoSummary: {
        SeatsRequested: [params.adults],
        AirTravelerAvail: [{
          PassengerTypeQuantity: [{ Code: "ADT", Quantity: params.adults }],
        }],
        PriceRequestInformation: {
          TPA_Extensions: { BrandedFareIndicators: { ReturnBrandAncillaries: "true", SingleBrandedFare: "true" } },
        },
      },
      TPA_Extensions: {
        IntelliSellTransaction: { RequestType: { Name: "200ITINS" } },
      },
    },
  };

  const res = await axios.post(
    `${baseUrl}/v4/offers/shop`,
    body,
    {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      timeout: 15000,
    }
  );

  const itins = res.data?.groupedItineraryResponse?.itineraryGroups?.[0]?.itineraries || [];
  const legs = res.data?.groupedItineraryResponse?.legDescs || [];
  const schedules = res.data?.groupedItineraryResponse?.scheduleDescs || [];

  return itins.slice(0, 12).map((itin: any, i: number) => {
    const legRef = itin.legs?.[0]?.ref;
    const leg = legs.find((l: any) => l.id === legRef);
    const schedRef = leg?.schedules?.[0]?.ref;
    const sched = schedules.find((s: any) => s.id === schedRef);
    const pricing = itin.pricingInformation?.[0]?.fare;
    return {
      id: `sabre-${i}`,
      source: "sabre",
      airline: sched?.carrier?.marketing || "XX",
      airlineName: sched?.carrier?.marketing || "Unknown",
      flightNumber: `${sched?.carrier?.marketing || "XX"}${sched?.carrier?.marketingFlightNumber || i}`,
      origin: params.origin,
      destination: params.destination,
      departureTime: sched?.departure?.time || "",
      arrivalTime: sched?.arrival?.time || "",
      duration: leg?.elapsedTime ? `${Math.floor(leg.elapsedTime / 60)}h ${leg.elapsedTime % 60}m` : "",
      stops: (leg?.schedules?.length || 1) - 1,
      cabinClass: params.cabinClass,
      price: parseFloat(pricing?.totalFare?.totalPerPassenger?.amount || "0"),
      currency: pricing?.totalFare?.totalPerPassenger?.currency || "USD",
      seatsAvailable: null,
      refundable: false,
    };
  });
}

// ── Galileo / Travelport Search ───────────────────────────────────────────────

async function searchGalileo(setting: any, params: SearchParams): Promise<FlightResult[]> {
  const isTest = setting.environment !== "production";
  const baseUrl = isTest
    ? "https://americas.universal-api.pp.travelport.com/B2BGateway/connect/uAPI/AirService"
    : "https://americas.universal-api.travelport.com/B2BGateway/connect/uAPI/AirService";

  const cabinMap: Record<string, string> = {
    economy: "Economy",
    premium_economy: "PremiumEconomy",
    business: "Business",
    first: "First",
  };

  const body = {
    "AirSearchModifiers": { "PreferredProviders": { "Provider": { "@type": "travelport", "Code": "1G" } } },
    "SearchAirLeg": [{
      "SearchOrigin": { "CityOrAirport": { "Code": params.origin } },
      "SearchDestination": { "CityOrAirport": { "Code": params.destination } },
      "SearchDepTime": { "PreferredTime": `${params.departureDate}T00:00:00` },
      "AirLegModifiers": { "CabinClass": cabinMap[params.cabinClass] || "Economy" },
    }],
    "AirSearchParameters": { "MaxSolutions": 12 },
    "SearchPassenger": Array(params.adults).fill({ "@type": "ADT" }),
  };

  const res = await axios.post(baseUrl, body, {
    auth: { username: setting.username || "", password: setting.password || "" },
    headers: { "Content-Type": "application/json", "XAUTH_TRAVELPORT_ACCESSGROUP": setting.pcc || "3PX1" },
    timeout: 15000,
  });

  const solutions = res.data?.airPricingSolution || [];
  return (Array.isArray(solutions) ? solutions : [solutions]).slice(0, 12).map((sol: any, i: number) => {
    const seg = sol?.airSegment?.[0] || {};
    return {
      id: `galileo-${i}`,
      source: "galileo",
      airline: seg.Carrier || "XX",
      airlineName: seg.Carrier || "Unknown",
      flightNumber: `${seg.Carrier || "XX"}${seg.FlightNumber || i}`,
      origin: seg.Origin || params.origin,
      destination: seg.Destination || params.destination,
      departureTime: seg.DepartureTime || "",
      arrivalTime: seg.ArrivalTime || "",
      duration: seg.FlightTime ? `${Math.floor(seg.FlightTime / 60)}h ${seg.FlightTime % 60}m` : "",
      stops: 0,
      cabinClass: params.cabinClass,
      price: parseFloat(sol.TotalPrice?.replace(/[^0-9.]/g, "") || "0"),
      currency: sol.TotalPrice?.replace(/[0-9.]/g, "").trim() || "USD",
      seatsAvailable: null,
      refundable: false,
    };
  });
}

// ── Mock data fallback ───────────────────────────────────────────────────────

function mockFlights(params: SearchParams, source: string): FlightResult[] {
  const airlines = [
    { code: "SV", name: "Saudia" },
    { code: "EK", name: "Emirates" },
    { code: "QR", name: "Qatar Airways" },
    { code: "EY", name: "Etihad Airways" },
    { code: "FZ", name: "Flydubai" },
    { code: "BA", name: "British Airways" },
    { code: "TK", name: "Turkish Airlines" },
  ];
  const basePrice = { economy: 420, premium_economy: 780, business: 1850, first: 3200 }[params.cabinClass] || 420;

  return airlines.slice(0, 5).map((airline, i) => {
    const deptHour = 6 + i * 3;
    const durationH = 7 + (i % 3);
    const durationM = (i * 17) % 60;
    const arrHour = (deptHour + durationH) % 24;
    const price = basePrice + (i * 85) + Math.floor(Math.random() * 50);
    return {
      id: `${source}-mock-${i}`,
      source,
      airline: airline.code,
      airlineName: airline.name,
      flightNumber: `${airline.code}${100 + i * 37}`,
      origin: params.origin,
      destination: params.destination,
      departureTime: `${params.departureDate}T${String(deptHour).padStart(2, "0")}:${String((i * 15) % 60).padStart(2, "0")}:00`,
      arrivalTime: `${params.departureDate}T${String(arrHour).padStart(2, "0")}:${String((i * 20) % 60).padStart(2, "0")}:00`,
      duration: `${durationH}h ${durationM}m`,
      stops: i === 0 ? 0 : i === 1 ? 0 : 1,
      cabinClass: params.cabinClass,
      price,
      currency: "USD",
      seatsAvailable: 2 + i * 3,
      refundable: i % 2 === 0,
    };
  });
}

// ── Types ────────────────────────────────────────────────────────────────────

interface SearchParams {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  adults: number;
  cabinClass: string;
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
}

// ── Search Route ─────────────────────────────────────────────────────────────

router.post("/flights/search", async (req, res) => {
  const { origin, destination, departureDate, returnDate, adults = 1, cabinClass = "economy", providers = ["amadeus", "sabre", "galileo"] } = req.body;

  if (!origin || !destination || !departureDate) {
    return res.status(400).json({ error: "origin, destination, and departureDate are required" });
  }

  const params: SearchParams = { origin, destination, departureDate, returnDate, adults: Number(adults), cabinClass };
  const results: FlightResult[] = [];
  const errors: Record<string, string> = {};
  const sources: Record<string, string> = {};

  const allSettings = await db.select().from(gdsSettingsTable);
  const settingMap = new Map(allSettings.map(s => [s.provider, s]));

  await Promise.allSettled(
    (providers as string[]).map(async (provider) => {
      const setting = settingMap.get(provider);
      const isConfigured = setting?.isActive && setting?.clientId;

      try {
        let providerResults: FlightResult[] = [];

        if (!isConfigured) {
          providerResults = mockFlights(params, provider);
          sources[provider] = "mock";
        } else if (provider === "amadeus") {
          providerResults = await searchAmadeus(setting, params);
          sources[provider] = "live";
        } else if (provider === "sabre") {
          providerResults = await searchSabre(setting, params);
          sources[provider] = "live";
        } else if (provider === "galileo") {
          providerResults = await searchGalileo(setting, params);
          sources[provider] = "live";
        }

        results.push(...providerResults);
      } catch (err: any) {
        req.log.warn({ provider, err: err.message }, "GDS search failed, using mock");
        results.push(...mockFlights(params, provider));
        sources[provider] = "mock";
        errors[provider] = err.message;
      }
    })
  );

  results.sort((a, b) => a.price - b.price);

  return res.json({ results, sources, errors, total: results.length });
});

export default router;
