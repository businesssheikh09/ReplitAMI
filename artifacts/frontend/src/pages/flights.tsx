import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navbar } from "@/components/navbar";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import {
  Plane,
  Search,
  ArrowRight,
  Users,
  ChevronDown,
  CheckCircle2,
  X,
  Calendar,
  Loader2,
  Info,
} from "lucide-react";

const CABIN_CLASSES = ["economy", "business", "first"];
const TRIP_TYPES = ["one_way", "round_trip"];

const PUBLIC_MARKUP_PKR = 2000;

const ROUTE_FILTERS: { label: string; match: string[] | null }[] = [
  { label: "All Types",       match: null },
  { label: "KSA One Way",     match: ["JED","RUH","MED","DMM","TIF","TUU","GIZ","AHB"] },
  { label: "UAE One Way",     match: ["DXB","AUH","SHJ","AAN","RKT","FJR"] },
  { label: "Oman One Way",    match: ["MCT","SLL","DQM","OHS","MSH"] },
  { label: "Bahrain One Way", match: ["BAH"] },
  { label: "Qatar One Way",   match: ["DOH"] },
  { label: "UK One Way",      match: ["LHR","LGW","MAN","EDI","BHX","GLA","BRS"] },
  { label: "Umrah",           match: ["JED","MED"] },
];

interface GroupTicket {
  id: number;
  airlineCode: string;
  flightNumber: string;
  flightDate: string;
  origin: string;
  destination: string;
  seats: number;
  departureTime: string | null;
  arrivalTime: string | null;
  fareAmount: number | null;
  fareCurrency: string;
  groupName: string | null;
}

interface BookingForm {
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  clientWhatsapp: string;
}

const emptyForm: BookingForm = {
  clientName: "",
  clientPhone: "",
  clientEmail: "",
  clientWhatsapp: "",
};

interface SelectedFlight {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  tripType: string;
  cabinClass: string;
  passengerCount: number;
  airline?: string;
  fare?: string;
  requestType: "direct" | "group";
  flightDataJson?: any;
}

function getTicketMMDD(dateStr: string): number {
  const parts = dateStr.split("-");
  const m = parseInt(parts[1] ?? "1", 10);
  const d = parseInt(parts[2] ?? "1", 10);
  return m * 100 + d;
}

function isTicketFuture(dateStr: string): boolean {
  const parts = dateStr.split("-");
  const ticketM = parseInt(parts[1] ?? "1", 10);
  const ticketD = parseInt(parts[2] ?? "1", 10);
  const ticketMMDD = ticketM * 100 + ticketD;

  const today = new Date();
  const todayM = today.getMonth() + 1;
  const todayMMDD = todayM * 100 + today.getDate();

  if (todayM >= 10) {
    // Late year (Oct–Dec): Jan–Mar are upcoming (year wrap); same-period check normally
    if (ticketM <= 3) return true;
    return ticketMMDD >= todayMMDD;
  } else if (todayM <= 3) {
    // Early year (Jan–Mar): Oct–Dec tickets are from the previous year — exclude them
    if (ticketM >= 10) return false;
    return ticketMMDD >= todayMMDD;
  } else {
    // Mid year (Apr–Sep): straightforward comparison, no wrap
    return ticketMMDD >= todayMMDD;
  }
}

function formatFlightDate(dateStr: string): string {
  const parts = dateStr.split("-");
  const m = parseInt(parts[1] ?? "1", 10);
  const d = parseInt(parts[2] ?? "1", 10);
  return new Date(2000, m - 1, d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function publicFare(amount: number, currency: string): number {
  return currency === "PKR" ? amount + PUBLIC_MARKUP_PKR : amount;
}

export default function FlightsPage() {
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"search" | "group">("group");
  const [routeFilter, setRouteFilter] = useState<string | null>(null);

  const [tripType, setTripType] = useState("one_way");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [pax, setPax] = useState(1);
  const [cabinClass, setCabinClass] = useState("economy");

  const [selectedFlight, setSelectedFlight] = useState<SelectedFlight | null>(null);
  const [form, setForm] = useState<BookingForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [successRef, setSuccessRef] = useState<string | null>(null);

  const { data: groupTickets = [], isLoading: loadingTickets } = useQuery<GroupTicket[]>({
    queryKey: ["public-group-tickets"],
    queryFn: () => fetch("/api/public/group-tickets").then((r) => r.json()),
    staleTime: 60_000,
  });

  const availableTickets = groupTickets
    .filter((t) => {
      if (t.seats <= 0 || t.fareAmount === null) return false;
      return isTicketFuture(t.flightDate);
    })
    .sort((a, b) => {
      // Sort ascending by MMDD; Jan-Mar tickets sort after Oct-Dec when in late year
      const today = new Date();
      const todayM = today.getMonth() + 1;
      const aMMDD = getTicketMMDD(a.flightDate);
      const bMMDD = getTicketMMDD(b.flightDate);
      if (todayM >= 10) {
        const aAdj = aMMDD <= 399 ? aMMDD + 1300 : aMMDD;
        const bAdj = bMMDD <= 399 ? bMMDD + 1300 : bMMDD;
        return aAdj - bAdj;
      }
      return aMMDD - bMMDD;
    });

  const filteredTickets = availableTickets.filter((t) => {
    if (!routeFilter) return true;
    const filter = ROUTE_FILTERS.find((f) => f.label === routeFilter);
    if (!filter || !filter.match) return true;
    return filter.match.includes(t.destination.toUpperCase());
  });

  async function submitRequest() {
    if (!selectedFlight) return;
    if (!form.clientName.trim() || !form.clientPhone.trim()) {
      toast({ title: "Name and phone are required", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/public/flight-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          ...selectedFlight,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setSuccessRef(data.requestNumber);
      setForm(emptyForm);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  function openBookingForGroupTicket(t: GroupTicket) {
    const displayFare = t.fareAmount ? publicFare(t.fareAmount, t.fareCurrency) : null;
    setSelectedFlight({
      origin: t.origin,
      destination: t.destination,
      departureDate: t.flightDate,
      tripType: "one_way",
      cabinClass: "economy",
      passengerCount: 1,
      airline: t.flightNumber,
      fare: displayFare ? String(displayFare) : undefined,
      requestType: "group",
      flightDataJson: {
        groupTicketId: t.id,
        flightNumber: t.flightNumber,
        departureTime: t.departureTime,
        arrivalTime: t.arrivalTime,
        groupName: t.groupName,
      },
    });
    setSuccessRef(null);
  }

  function openBookingForSearch() {
    if (!origin.trim() || !destination.trim() || !departureDate) {
      toast({ title: "Please fill origin, destination and date", variant: "destructive" });
      return;
    }
    setSelectedFlight({
      origin: origin.toUpperCase(),
      destination: destination.toUpperCase(),
      departureDate,
      returnDate: returnDate || undefined,
      tripType,
      cabinClass,
      passengerCount: pax,
      requestType: "direct",
    });
    setSuccessRef(null);
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <Toaster />

      {/* Hero */}
      <div className="pt-28 pb-12 bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-medium mb-4">
            <Plane className="h-4 w-4" />
            Flight Booking
          </div>
          <h1 className="text-3xl md:text-4xl font-serif font-semibold mb-3">
            Find Your Flight
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto text-sm md:text-base">
            Browse our curated group departures or submit a custom flight request — our team reviews every booking personally.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="flex border-b border-border mb-6">
          {[
            { key: "group", label: "Group Tickets" },
            { key: "search", label: "Custom Request" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as any)}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === t.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Group Tickets tab */}
        {activeTab === "group" && (
          <div className="pb-16">
            {/* Route filter chips */}
            <div className="flex flex-wrap gap-2 mb-6">
              {ROUTE_FILTERS.map((f) => {
                const isActive = routeFilter === f.label || (f.label === "All Types" && routeFilter === null);
                return (
                  <button
                    key={f.label}
                    onClick={() => setRouteFilter(f.label === "All Types" ? null : f.label)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-foreground border-border hover:border-primary/60 hover:text-primary"
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>

            {loadingTickets ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <Plane className="h-10 w-10 mx-auto opacity-20 mb-3" />
                <p>No group flights available{routeFilter ? ` for "${routeFilter}"` : ""} right now.</p>
                <p className="text-sm mt-1">Try another filter or the Custom Request tab to enquire about any route.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredTickets.slice(0, 80).map((t) => {
                  const shownFare = t.fareAmount ? publicFare(t.fareAmount, t.fareCurrency) : null;
                  return (
                    <div
                      key={t.id}
                      className="rounded-2xl border bg-card shadow-sm hover:shadow-md transition-shadow p-5"
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="font-semibold text-lg">
                              {t.origin} → {t.destination}
                            </span>
                            <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground font-mono">
                              {t.flightNumber}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              <strong className="text-foreground">{formatFlightDate(t.flightDate)}</strong>
                            </span>
                            {t.departureTime && (
                              <span>
                                {t.departureTime}
                                {t.arrivalTime && ` → ${t.arrivalTime}`}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Users className="h-3.5 w-3.5" />
                              {t.seats} seats
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-3">
                          <div className="text-right">
                            {shownFare ? (
                              <>
                                <div className="text-2xl font-bold text-primary">
                                  {t.fareCurrency} {shownFare.toLocaleString()}
                                </div>
                                <div className="text-xs text-muted-foreground">per person</div>
                              </>
                            ) : (
                              <div className="text-sm text-muted-foreground">Ask for price</div>
                            )}
                          </div>
                          <button
                            onClick={() => openBookingForGroupTicket(t)}
                            className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors"
                          >
                            Request Booking
                            <ArrowRight className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Custom Search tab */}
        {activeTab === "search" && (
          <div className="pb-16 space-y-6">
            <div className="rounded-2xl border bg-card shadow-sm p-6 space-y-5">
              {/* Trip type */}
              <div className="flex gap-2">
                {TRIP_TYPES.map((tt) => (
                  <button
                    key={tt}
                    onClick={() => setTripType(tt)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      tripType === tt
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {tt === "one_way" ? "One Way" : "Round Trip"}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">From</label>
                  <input
                    type="text"
                    placeholder="Origin city or IATA (e.g. KHI)"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value.toUpperCase())}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">To</label>
                  <input
                    type="text"
                    placeholder="Destination city or IATA (e.g. JED)"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value.toUpperCase())}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Departure Date</label>
                  <input
                    type="date"
                    value={departureDate}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setDepartureDate(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
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
                      className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Passengers</label>
                  <div className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2">
                    <button
                      onClick={() => setPax(Math.max(1, pax - 1))}
                      className="w-7 h-7 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center font-bold"
                    >−</button>
                    <span className="flex-1 text-center font-medium text-sm">{pax} Pax</span>
                    <button
                      onClick={() => setPax(Math.min(20, pax + 1))}
                      className="w-7 h-7 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center font-bold"
                    >+</button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Cabin Class</label>
                  <select
                    value={cabinClass}
                    onChange={(e) => setCabinClass(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {CABIN_CLASSES.map((c) => (
                      <option key={c} value={c} className="capitalize">
                        {c.charAt(0).toUpperCase() + c.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={openBookingForSearch}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-lg py-3 text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                <Search className="h-4 w-4" />
                Submit Flight Request
              </button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Our team will review your request and contact you within a few hours with available options and pricing.
            </p>
          </div>
        )}
      </div>

      {/* Booking Modal */}
      {selectedFlight && !successRef && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg">Complete Your Request</h2>
              <button onClick={() => setSelectedFlight(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Flight summary */}
            <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
              <div className="font-medium">
                {selectedFlight.origin} → {selectedFlight.destination}
              </div>
              <div className="text-muted-foreground">
                {formatFlightDate(selectedFlight.departureDate)}
                {selectedFlight.airline && ` · ${selectedFlight.airline}`}
                {selectedFlight.fare && ` · PKR ${Number(selectedFlight.fare).toLocaleString()}`}
              </div>
              <div className="text-muted-foreground capitalize">
                {selectedFlight.tripType.replace("_", " ")} · {selectedFlight.cabinClass} · {selectedFlight.passengerCount} pax
              </div>
            </div>

            {/* Service fee note for custom requests */}
            {selectedFlight.requestType === "direct" && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 flex items-start gap-2 text-xs text-amber-800">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  A <strong>service fee of PKR 2,000</strong> applies on the confirmed fare.
                  Final price will be shared when our team contacts you.
                </span>
              </div>
            )}

            {/* Contact form */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Full Name *</label>
                <input
                  type="text"
                  placeholder="Your full name"
                  value={form.clientName}
                  onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Phone Number *</label>
                <input
                  type="tel"
                  placeholder="+92 300 0000000"
                  value={form.clientPhone}
                  onChange={(e) => setForm({ ...form, clientPhone: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">WhatsApp (optional)</label>
                <input
                  type="tel"
                  placeholder="+92 300 0000000"
                  value={form.clientWhatsapp}
                  onChange={(e) => setForm({ ...form, clientWhatsapp: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Email (optional)</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={form.clientEmail}
                  onChange={(e) => setForm({ ...form, clientEmail: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>

            <button
              onClick={submitRequest}
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-lg py-3 text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plane className="h-4 w-4" />}
              {submitting ? "Submitting…" : "Submit Booking Request"}
            </button>

            <p className="text-xs text-muted-foreground text-center">
              No payment now — our team will confirm and provide payment instructions.
            </p>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {successRef && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center space-y-4">
            <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <h2 className="text-xl font-semibold">Request Received!</h2>
            <p className="text-muted-foreground text-sm">
              Your booking request has been submitted. Our team will contact you shortly.
            </p>
            <div className="bg-muted rounded-lg px-4 py-3">
              <p className="text-xs text-muted-foreground mb-1">Reference Number</p>
              <p className="font-mono font-bold text-primary text-lg">{successRef}</p>
            </div>
            <p className="text-xs text-muted-foreground">Please save this reference number for follow-up.</p>
            <button
              onClick={() => { setSelectedFlight(null); setSuccessRef(null); }}
              className="w-full bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
