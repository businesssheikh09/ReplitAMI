import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Plane, ArrowLeft, Clock, CheckCircle2, AlertCircle,
  Loader2, Upload, Search, Users,
} from "lucide-react";

const CABIN_CLASSES = [
  { value: "economy", label: "Economy" },
  { value: "business", label: "Business" },
  { value: "first", label: "First" },
];

const STATUS_STEPS = [
  { key: "on_hold", label: "Seat Reserved" },
  { key: "payment_pending", label: "Awaiting Payment Confirmation" },
  { key: "payment_received", label: "Payment Confirmed" },
  { key: "ready_to_issue", label: "Ready to Issue" },
  { key: "issued", label: "Ticket Issued" },
];

const MARKUP_PKR = 2000;

interface FlightResult {
  id: string;
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

interface BookingStatus {
  requestNumber: string;
  status: string;
  holdExpiresAt: string | null;
  paymentDeadlineAt: string | null;
  hasPaymentProof: boolean;
  origin: string;
  destination: string;
  departureDate: string;
  airline: string | null;
  createdAt: string;
  clientFirstName: string;
}

function fmtTime(iso: string): string {
  try { return iso.slice(11, 16); } catch { return "—"; }
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch { return iso; }
}

function toPkrDisplay(price: number, currency: string, rates: Record<string, number>): number {
  const pkrPerUsd = rates["PKR"] ?? 285;
  if (currency === "PKR") return Math.round(price) + MARKUP_PKR;
  const unitPerUsd = rates[currency] ?? (currency === "USD" ? 1 : 1);
  const priceUsd = price / unitPerUsd;
  return Math.round(priceUsd * pkrPerUsd) + MARKUP_PKR;
}

function toPkrNet(price: number, currency: string, rates: Record<string, number>): number {
  const pkrPerUsd = rates["PKR"] ?? 285;
  if (currency === "PKR") return Math.round(price);
  const unitPerUsd = rates[currency] ?? (currency === "USD" ? 1 : 1);
  const priceUsd = price / unitPerUsd;
  return Math.round(priceUsd * pkrPerUsd);
}

export default function BookGdsPage() {
  const [, navigate] = useLocation();

  const [tripType, setTripType] = useState("one_way");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [pax, setPax] = useState(1);
  const [cabinClass, setCabinClass] = useState("economy");

  const [results, setResults] = useState<FlightResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedFlight, setSelectedFlight] = useState<FlightResult | null>(null);

  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientWhatsapp, setClientWhatsapp] = useState("");

  const [view, setView] = useState<"search" | "hold">("search");
  const [bookingRef, setBookingRef] = useState("");
  const [holdExpiresAt, setHoldExpiresAt] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState("");

  const [proofUploading, setProofUploading] = useState(false);
  const [proofSubmitted, setProofSubmitted] = useState(false);
  const [proofError, setProofError] = useState("");

  const { data: ratesData } = useQuery({
    queryKey: ["currency-rates"],
    queryFn: () => fetch("/api/currency/rates").then((r) => r.json()),
    staleTime: 3_600_000,
  });
  const rates: Record<string, number> = ratesData?.rates ?? (typeof ratesData === "object" && ratesData !== null ? ratesData : {});

  const searchMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        origin: origin.trim().toUpperCase(),
        destination: destination.trim().toUpperCase(),
        departureDate,
        adults: pax,
        cabinClass,
        tripType,
        providers: ["amadeus", "sabre", "galileo"],
      };
      if (tripType === "round_trip" && returnDate) body.returnDate = returnDate;
      const res = await fetch("/api/flights/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Search failed");
      return res.json() as Promise<{ results: FlightResult[] }>;
    },
    onSuccess: (data) => {
      setResults(data.results ?? []);
      setHasSearched(true);
      setSelectedFlight(null);
    },
  });

  const bookMutation = useMutation({
    mutationFn: async () => {
      const f = selectedFlight!;
      const pkrNet = toPkrNet(f.price, f.currency, rates);
      const res = await fetch("/api/public/flight-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: clientName.trim(),
          clientPhone: clientPhone.trim(),
          clientEmail: clientEmail.trim() || null,
          clientWhatsapp: clientWhatsapp.trim() || null,
          origin: f.origin,
          destination: f.destination,
          departureDate: f.departureTime.slice(0, 10),
          returnDate: tripType === "round_trip" ? returnDate : null,
          tripType,
          passengerCount: pax,
          cabinClass: f.cabinClass,
          airline: `${f.airlineName} ${f.flightNumber}`,
          fare: String(pkrNet),
          requestType: "direct",
          source: "website_gds",
          holdMinutes: 120,
          flightDataJson: f,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as any).error ?? "Reservation failed");
      }
      return res.json() as Promise<{ requestNumber: string; holdExpiresAt: string | null }>;
    },
    onSuccess: (data) => {
      setBookingRef(data.requestNumber);
      if (data.holdExpiresAt) setHoldExpiresAt(new Date(data.holdExpiresAt));
      setView("hold");
    },
  });

  const { data: statusData } = useQuery<BookingStatus>({
    queryKey: ["gds-booking-status", bookingRef],
    queryFn: () => fetch(`/api/public/flight-requests/${bookingRef}`).then((r) => r.json()),
    enabled: !!bookingRef && view === "hold",
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (statusData?.holdExpiresAt && !holdExpiresAt) {
      setHoldExpiresAt(new Date(statusData.holdExpiresAt));
    }
  }, [statusData?.holdExpiresAt]);

  useEffect(() => {
    if (!holdExpiresAt) return;
    const tick = () => {
      const rem = holdExpiresAt.getTime() - Date.now();
      if (rem <= 0) { setCountdown("Expired"); return; }
      const h = Math.floor(rem / 3_600_000);
      const m = Math.floor((rem % 3_600_000) / 60_000);
      const s = Math.floor((rem % 60_000) / 1_000);
      setCountdown(
        h > 0
          ? `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`
          : `${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`,
      );
    };
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [holdExpiresAt]);

  async function handleProofUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !bookingRef) return;
    setProofUploading(true);
    setProofError("");
    try {
      const uploadRes = await fetch("/api/storage/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      const { uploadURL, objectPath } = await uploadRes.json();
      await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });

      const proofRes = await fetch(`/api/public/flight-requests/${bookingRef}/payment-proof`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objectKey: objectPath }),
      });
      if (!proofRes.ok) throw new Error("Submission failed");
      setProofSubmitted(true);
    } catch {
      setProofError("Upload failed. Please try again.");
    } finally {
      setProofUploading(false);
    }
  }

  const canSearch = origin.trim() && destination.trim() && departureDate;
  const canBook = clientName.trim() && clientPhone.trim();
  const holdExpired = countdown === "Expired";
  const currentStatus = statusData?.status ?? (view === "hold" ? "on_hold" : "");
  const statusIdx = STATUS_STEPS.findIndex((s) => s.key === currentStatus);

  // ── HOLD / TRACKING VIEW ─────────────────────────────────────────────────

  if (view === "hold") {
    return (
      <div className="min-h-screen bg-stone-50">
        <div className="bg-white border-b border-border sticky top-0 z-10">
          <div className="container mx-auto px-4 h-16 flex items-center gap-4 max-w-3xl">
            <button onClick={() => navigate("/flights")} className="text-muted-foreground hover:text-foreground transition">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="font-semibold text-sm text-foreground">
                {currentStatus === "issued" ? "Ticket Issued" : holdExpired ? "Hold Expired" : "Seat On Hold"}
              </h1>
              <p className="text-xs text-muted-foreground font-mono">{bookingRef}</p>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8 max-w-3xl space-y-5">

          {/* Status banner */}
          <div className={`rounded-2xl border p-5 ${
            holdExpired || currentStatus === "expired" || currentStatus === "cancelled"
              ? "bg-red-50 border-red-200"
              : currentStatus === "issued"
              ? "bg-emerald-50 border-emerald-200"
              : "bg-teal-50 border-teal-200"
          }`}>
            <div className="flex items-center gap-3 mb-2">
              {holdExpired || currentStatus === "expired" ? (
                <AlertCircle className="h-6 w-6 text-red-500 shrink-0" />
              ) : currentStatus === "issued" ? (
                <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
              ) : (
                <CheckCircle2 className="h-6 w-6 text-teal-600 shrink-0" />
              )}
              <div>
                <p className="font-semibold text-foreground">
                  {currentStatus === "issued"
                    ? "Your ticket has been issued!"
                    : holdExpired || currentStatus === "expired"
                    ? "Hold expired"
                    : currentStatus === "cancelled"
                    ? "Booking cancelled"
                    : "Seat is on hold"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Ref: <span className="font-mono font-bold">{bookingRef}</span>
                  {statusData?.clientFirstName && ` · ${statusData.clientFirstName}`}
                </p>
              </div>
            </div>

            {!holdExpired && currentStatus === "on_hold" && holdExpiresAt && (
              <div className="flex items-center gap-2 mt-3 bg-white/70 rounded-xl px-4 py-2.5 w-fit">
                <Clock className="h-4 w-4 text-teal-600 shrink-0" />
                <span className="text-sm text-teal-800">
                  Hold expires in: <span className="font-mono font-bold text-base">{countdown}</span>
                </span>
              </div>
            )}
          </div>

          {/* Status timeline */}
          <div className="bg-white rounded-2xl border border-border p-6">
            <h2 className="font-semibold text-foreground mb-5">Booking Progress</h2>
            <div className="space-y-4">
              {STATUS_STEPS.map((step, i) => {
                const isPast = statusIdx > i;
                const isActive = step.key === currentStatus;
                const isFuture = statusIdx < i;
                return (
                  <div key={step.key} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold transition-colors ${
                      isPast
                        ? "bg-teal-500 text-white"
                        : isActive
                        ? "bg-teal-100 border-2 border-teal-500 text-teal-700"
                        : "bg-gray-100 text-gray-400"
                    }`}>
                      {isPast ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                    </div>
                    <span className={`text-sm ${
                      isPast ? "text-muted-foreground" : isActive ? "font-semibold text-foreground" : isFuture ? "text-muted-foreground" : "text-muted-foreground"
                    }`}>
                      {step.label}
                    </span>
                    {isActive && !holdExpired && currentStatus !== "issued" && (
                      <span className="ml-auto text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium">
                        Current
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Next steps / payment */}
          {(currentStatus === "on_hold" || currentStatus === "payment_pending") && !holdExpired && (
            <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
              <h2 className="font-semibold text-foreground">What Happens Next</h2>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900 space-y-2">
                <p className="font-medium">Payment Instructions</p>
                <p>
                  Our team will contact you via <strong>WhatsApp or phone</strong> shortly with
                  bank account details and the confirmed amount to pay.
                </p>
                <p className="text-xs">
                  Once you have made the payment, upload your receipt below — this helps our team
                  verify faster.
                </p>
              </div>

              {statusData?.paymentDeadlineAt && (
                <div className="flex items-center gap-2 text-sm border border-border rounded-xl px-4 py-3">
                  <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                  <span className="text-muted-foreground">Payment deadline: </span>
                  <span className="font-medium">{fmtDate(statusData.paymentDeadlineAt)}</span>
                </div>
              )}

              {!proofSubmitted ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Upload Payment Receipt</p>
                  <label className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed text-sm transition cursor-pointer w-fit ${
                    proofUploading
                      ? "border-border text-muted-foreground"
                      : "border-border text-muted-foreground hover:border-teal-400 hover:text-teal-700"
                  }`}>
                    {proofUploading
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Upload className="h-4 w-4" />}
                    {proofUploading ? "Uploading…" : "Upload Receipt (image or PDF)"}
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={handleProofUpload}
                      disabled={proofUploading}
                    />
                  </label>
                  {proofError && <p className="text-xs text-destructive">{proofError}</p>}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-teal-700 text-sm font-medium bg-teal-50 border border-teal-200 rounded-xl px-4 py-3">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Receipt submitted — our team will verify and update your booking status.
                </div>
              )}
            </div>
          )}

          {/* Expired state */}
          {(holdExpired || currentStatus === "expired") && (
            <div className="bg-white rounded-2xl border border-border p-6 text-center space-y-4">
              <p className="text-muted-foreground text-sm">
                The hold on this seat has expired. Please search again to find available options.
              </p>
              <button
                onClick={() => {
                  setView("search");
                  setHoldExpiresAt(null);
                  setSelectedFlight(null);
                  setBookingRef("");
                  setProofSubmitted(false);
                }}
                className="px-6 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition"
              >
                Search Again
              </button>
            </div>
          )}

          <p className="text-xs text-center text-muted-foreground pb-8">
            Save your reference number <span className="font-mono font-bold">{bookingRef}</span> for follow-up enquiries.
          </p>
        </div>
      </div>
    );
  }

  // ── SEARCH VIEW ──────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="bg-white border-b border-border sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center gap-4 max-w-4xl">
          <button onClick={() => navigate("/flights")} className="text-muted-foreground hover:text-foreground transition">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="font-semibold text-sm text-foreground">Live Flight Search</h1>
            <p className="text-xs text-muted-foreground">Search → Select → Reserve seat for 2 hours</p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-4xl space-y-6">

        {/* Search form */}
        <div className="bg-white rounded-2xl border border-border p-6 space-y-5">
          <div className="flex gap-2">
            {["one_way", "round_trip"].map((tt) => (
              <button
                key={tt}
                onClick={() => setTripType(tt)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  tripType === tt
                    ? "bg-teal-600 text-white border-teal-600"
                    : "border-border text-muted-foreground hover:border-teal-400"
                }`}
              >
                {tt === "one_way" ? "One Way" : "Round Trip"}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">From</label>
              <input
                value={origin}
                onChange={(e) => setOrigin(e.target.value.toUpperCase())}
                placeholder="IATA code — e.g. KHI"
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-white text-sm focus:ring-2 focus:ring-teal-500/40 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">To</label>
              <input
                value={destination}
                onChange={(e) => setDestination(e.target.value.toUpperCase())}
                placeholder="IATA code — e.g. JED"
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-white text-sm focus:ring-2 focus:ring-teal-500/40 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Departure Date</label>
              <input
                type="date"
                value={departureDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setDepartureDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-white text-sm focus:ring-2 focus:ring-teal-500/40 focus:outline-none"
              />
            </div>
            {tripType === "round_trip" && (
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Return Date</label>
                <input
                  type="date"
                  value={returnDate}
                  min={departureDate || new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-white text-sm focus:ring-2 focus:ring-teal-500/40 focus:outline-none"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Passengers</label>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2">
                <button
                  onClick={() => setPax(Math.max(1, pax - 1))}
                  className="w-7 h-7 rounded-full bg-muted flex items-center justify-center font-bold text-sm hover:bg-muted/80 transition"
                >−</button>
                <span className="flex-1 text-center text-sm font-medium flex items-center justify-center gap-1">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  {pax} pax
                </span>
                <button
                  onClick={() => setPax(Math.min(9, pax + 1))}
                  className="w-7 h-7 rounded-full bg-muted flex items-center justify-center font-bold text-sm hover:bg-muted/80 transition"
                >+</button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Cabin Class</label>
              <select
                value={cabinClass}
                onChange={(e) => setCabinClass(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-white text-sm focus:ring-2 focus:ring-teal-500/40 focus:outline-none"
              >
                {CABIN_CLASSES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={() => { if (canSearch) searchMutation.mutate(); }}
            disabled={!canSearch || searchMutation.isPending}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-teal-600 text-white font-semibold hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
          >
            {searchMutation.isPending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Search className="h-4 w-4" />}
            {searchMutation.isPending ? "Searching…" : "Search Flights"}
          </button>

          {searchMutation.isError && (
            <p className="text-sm text-destructive text-center">Search failed. Please check your inputs and try again.</p>
          )}
        </div>

        {/* Results */}
        {hasSearched && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="font-semibold text-foreground">
                {results.length === 0
                  ? "No flights found"
                  : `${results.length} flight${results.length !== 1 ? "s" : ""} found`}
              </h2>
              <span className="text-xs text-muted-foreground">
                All prices include taxes and our service fee
              </span>
            </div>

            {results.length === 0 ? (
              <div className="bg-white rounded-2xl border border-border py-16 text-center text-muted-foreground">
                <Plane className="h-10 w-10 mx-auto opacity-20 mb-3" />
                <p className="text-sm">No results for this route and date.</p>
                <p className="text-xs mt-1">Try adjusting your search.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {results.slice(0, 15).map((flight) => {
                  const pkrDisplay = toPkrDisplay(flight.price, flight.currency, rates);
                  return (
                    <div
                      key={flight.id}
                      className={`bg-white rounded-2xl border transition-all ${
                        selectedFlight?.id === flight.id
                          ? "border-teal-500 ring-2 ring-teal-200"
                          : "border-border hover:border-teal-300"
                      }`}
                    >
                      <div className="p-5">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-3 flex-wrap">
                              <span className="font-semibold text-foreground">{flight.airlineName}</span>
                              <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{flight.flightNumber}</span>
                              {flight.stops === 0 && (
                                <span className="text-xs text-teal-600 font-medium bg-teal-50 px-1.5 py-0.5 rounded">Non-stop</span>
                              )}
                              {flight.stops > 0 && (
                                <span className="text-xs text-muted-foreground">{flight.stops} stop{flight.stops > 1 ? "s" : ""}</span>
                              )}
                              {flight.refundable && (
                                <span className="text-xs text-emerald-600 font-medium">Refundable</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                              <div className="text-center">
                                <div className="text-2xl font-bold leading-none">{fmtTime(flight.departureTime)}</div>
                                <div className="text-xs text-muted-foreground mt-0.5">{flight.origin}</div>
                              </div>
                              <div className="flex-1 flex flex-col items-center gap-0.5">
                                <div className="text-xs text-muted-foreground">{flight.duration}</div>
                                <div className="w-full flex items-center gap-1">
                                  <div className="flex-1 h-px bg-border" />
                                  <Plane className="h-3 w-3 text-teal-400" />
                                  <div className="flex-1 h-px bg-border" />
                                </div>
                              </div>
                              <div className="text-center">
                                <div className="text-2xl font-bold leading-none">{fmtTime(flight.arrivalTime)}</div>
                                <div className="text-xs text-muted-foreground mt-0.5">{flight.destination}</div>
                              </div>
                            </div>
                            {flight.seatsAvailable != null && flight.seatsAvailable <= 5 && (
                              <p className="text-xs text-amber-600 font-medium mt-2">
                                Only {flight.seatsAvailable} seat{flight.seatsAvailable !== 1 ? "s" : ""} left
                              </p>
                            )}
                          </div>

                          <div className="flex sm:flex-col items-center sm:items-end gap-3 shrink-0">
                            <div className="text-right">
                              <p className="text-xl font-bold text-teal-700">
                                PKR {pkrDisplay.toLocaleString()}
                              </p>
                              <p className="text-xs text-muted-foreground">Total for {pax} pax</p>
                              <p className="text-xs text-teal-600 font-medium">✓ All inclusive</p>
                            </div>
                            <button
                              onClick={() => setSelectedFlight(
                                selectedFlight?.id === flight.id ? null : flight
                              )}
                              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-colors ${
                                selectedFlight?.id === flight.id
                                  ? "bg-teal-600 text-white"
                                  : "border-2 border-teal-600 text-teal-600 hover:bg-teal-50"
                              }`}
                            >
                              {selectedFlight?.id === flight.id ? "Selected ✓" : "Select"}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Inline contact + booking form */}
                      {selectedFlight?.id === flight.id && (
                        <div className="border-t border-border bg-stone-50 rounded-b-2xl p-5 space-y-4">
                          <h3 className="font-semibold text-sm text-foreground">Your Contact Details</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-muted-foreground mb-1">Full Name *</label>
                              <input
                                value={clientName}
                                onChange={(e) => setClientName(e.target.value)}
                                placeholder="Your full name"
                                className="w-full px-3 py-2.5 rounded-xl border border-border bg-white text-sm focus:ring-2 focus:ring-teal-500/40 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-muted-foreground mb-1">Phone Number *</label>
                              <input
                                type="tel"
                                value={clientPhone}
                                onChange={(e) => setClientPhone(e.target.value)}
                                placeholder="+92 300 0000000"
                                className="w-full px-3 py-2.5 rounded-xl border border-border bg-white text-sm focus:ring-2 focus:ring-teal-500/40 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-muted-foreground mb-1">WhatsApp (optional)</label>
                              <input
                                type="tel"
                                value={clientWhatsapp}
                                onChange={(e) => setClientWhatsapp(e.target.value)}
                                placeholder="+92 300 0000000"
                                className="w-full px-3 py-2.5 rounded-xl border border-border bg-white text-sm focus:ring-2 focus:ring-teal-500/40 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-muted-foreground mb-1">Email (optional)</label>
                              <input
                                type="email"
                                value={clientEmail}
                                onChange={(e) => setClientEmail(e.target.value)}
                                placeholder="you@example.com"
                                className="w-full px-3 py-2.5 rounded-xl border border-border bg-white text-sm focus:ring-2 focus:ring-teal-500/40 focus:outline-none"
                              />
                            </div>
                          </div>

                          <div className="flex items-start gap-2 bg-teal-50 border border-teal-200 rounded-xl p-3 text-xs text-teal-900">
                            <Clock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                            <span>
                              Clicking <strong>Reserve</strong> will hold this seat for{" "}
                              <strong>2 hours</strong>.
                              No payment is taken now — our team will send payment details via WhatsApp.
                            </span>
                          </div>

                          <button
                            onClick={() => { if (canBook) bookMutation.mutate(); }}
                            disabled={!canBook || bookMutation.isPending}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-teal-600 text-white font-semibold hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
                          >
                            {bookMutation.isPending
                              ? <Loader2 className="h-4 w-4 animate-spin" />
                              : <Plane className="h-4 w-4" />}
                            {bookMutation.isPending ? "Reserving…" : "Reserve Seat (2h Hold)"}
                          </button>

                          {bookMutation.isError && (
                            <p className="text-xs text-destructive text-center">
                              {(bookMutation.error as Error)?.message ?? "Reservation failed. Please try again."}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Empty search state */}
        {!hasSearched && (
          <div className="bg-white rounded-2xl border border-border py-16 text-center text-muted-foreground">
            <Plane className="h-12 w-12 mx-auto opacity-15 mb-4" />
            <p className="text-sm font-medium">Enter your route and date above to search</p>
            <p className="text-xs mt-1">We'll show live availability and pricing</p>
          </div>
        )}
      </div>
    </div>
  );
}
