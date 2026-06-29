import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Navbar } from "@/components/navbar";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import {
  Plane,
  Search,
  ArrowRight,
  Users,
  ChevronRight,
  CheckCircle2,
  X,
  Calendar,
  Loader2,
  Zap,
  Lock,
  BadgeCheck,
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
    if (ticketM <= 3) return true;
    return ticketMMDD >= todayMMDD;
  } else if (todayM <= 3) {
    if (ticketM >= 10) return false;
    return ticketMMDD >= todayMMDD;
  } else {
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

type ActiveSection = "group" | "custom";

export default function FlightsPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [activeSection, setActiveSection] = useState<ActiveSection>("group");
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
      <div className="pt-28 pb-10 bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-medium mb-4">
            <Plane className="h-4 w-4" />
            Book Your Flight
          </div>
          <h1 className="text-3xl md:text-4xl font-serif font-semibold mb-3">
            How would you like to book?
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto text-sm md:text-base">
            Choose from group departures, search live fares, or send us a custom flight request.
          </p>
        </div>
      </div>

      {/* 3 Entry Cards */}
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          {/* Card 1 — Group Tickets */}
          <button
            onClick={() => setActiveSection("group")}
            className={`rounded-2xl border p-5 text-left flex flex-col gap-2 transition-all hover:shadow-md group ${
              activeSection === "group"
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border bg-card hover:border-primary/40"
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-1 transition-colors ${
              activeSection === "group" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
            }`}>
              <Users className="h-5 w-5" />
            </div>
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm text-foreground">Group Tickets</p>
              <ChevronRight className={`h-4 w-4 transition-colors ${activeSection === "group" ? "text-primary" : "text-muted-foreground group-hover:text-primary"}`} />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Book for groups with special fares
            </p>
          </button>

          {/* Card 2 — Live Flight Search (highlighted) */}
          <button
            onClick={() => navigate("/book-gds")}
            className="rounded-2xl border-2 border-teal-500 bg-teal-50 p-5 text-left flex flex-col gap-2 transition-all hover:shadow-md hover:bg-teal-100 group relative"
          >
            <div className="absolute top-3 right-3">
              <span className="text-xs font-semibold bg-teal-600 text-white px-2 py-0.5 rounded-full">Popular</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center mb-1">
              <Zap className="h-5 w-5" />
            </div>
            <div className="flex items-center justify-between pr-16">
              <p className="font-semibold text-sm text-teal-900">Live Ticket Search</p>
              <ChevronRight className="h-4 w-4 text-teal-600 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <p className="text-xs text-teal-700 leading-relaxed">
              Individual bookings with live fares
            </p>
          </button>

          {/* Card 3 — Custom Request */}
          <button
            onClick={() => setActiveSection("custom")}
            className={`rounded-2xl border p-5 text-left flex flex-col gap-2 transition-all hover:shadow-md group ${
              activeSection === "custom"
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border bg-card hover:border-primary/40"
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-1 transition-colors ${
              activeSection === "custom" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
            }`}>
              <Search className="h-5 w-5" />
            </div>
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm text-foreground">Custom Request</p>
              <ChevronRight className={`h-4 w-4 transition-colors ${activeSection === "custom" ? "text-primary" : "text-muted-foreground group-hover:text-primary"}`} />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Can't find your flight? Request now
            </p>
          </button>
        </div>

        {/* Feature strip */}
        <div className="grid grid-cols-3 border border-border rounded-2xl divide-x divide-border mb-8 overflow-hidden">
          {[
            { icon: <Zap className="h-4 w-4 text-teal-600" />, label: "Live Fares", sub: "Real-time pricing from multiple airlines" },
            { icon: <Lock className="h-4 w-4 text-teal-600" />, label: "Seat Hold", sub: "Reserve your seats for 2 hours" },
            { icon: <BadgeCheck className="h-4 w-4 text-teal-600" />, label: "Secure Booking", sub: "Safe and secure transaction" },
          ].map((f) => (
            <div key={f.label} className="flex items-center gap-3 px-4 py-3 bg-muted/30">
              <div className="shrink-0 hidden sm:block">{f.icon}</div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{f.label}</p>
                <p className="text-xs text-muted-foreground hidden md:block truncate">{f.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Group Tickets section */}
        {activeSection === "group" && (
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
                <p className="text-sm mt-1">Try the Live Ticket Search for individual bookings.</p>
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
                                <div className="text-xs text-muted-foreground">per person · all inclusive</div>
                              </>
                            ) : (
                              <div className="text-sm text-muted-foreground">Ask for price</div>
                            )}
                          </div>
                          <button
                            onClick={() => openBookingForGroupTicket(t)}
                            className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-primary/90 transition-colors"
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

        {/* Custom Request section */}
        {activeSection === "custom" && (
          <div className="pb-16 space-y-6">
            <div className="rounded-2xl border bg-card shadow-sm p-6 space-y-5">
              <div>
                <h2 className="font-semibold text-foreground mb-1">Custom Flight Request</h2>
                <p className="text-sm text-muted-foreground">
                  Tell us your route and we'll find the best options and contact you with pricing.
                </p>
              </div>

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
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">To</label>
                  <input
                    type="text"
                    placeholder="Destination city or IATA (e.g. JED)"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value.toUpperCase())}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Departure Date</label>
                  <input
                    type="date"
                    value={departureDate}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setDepartureDate(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
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
                      className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Passengers</label>
                  <div className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2">
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
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
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
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl py-3 text-sm font-semibold hover:bg-primary/90 transition-colors"
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
            <div className="rounded-xl bg-muted/50 p-3 text-sm space-y-1">
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

            {/* Contact form */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Full Name *</label>
                <input
                  type="text"
                  placeholder="Your full name"
                  value={form.clientName}
                  onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Phone Number *</label>
                <input
                  type="tel"
                  placeholder="+92 300 0000000"
                  value={form.clientPhone}
                  onChange={(e) => setForm({ ...form, clientPhone: e.target.value })}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">WhatsApp (optional)</label>
                <input
                  type="tel"
                  placeholder="+92 300 0000000"
                  value={form.clientWhatsapp}
                  onChange={(e) => setForm({ ...form, clientWhatsapp: e.target.value })}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Email (optional)</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={form.clientEmail}
                  onChange={(e) => setForm({ ...form, clientEmail: e.target.value })}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>

            <button
              onClick={submitRequest}
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl py-3 text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
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
            <div className="bg-muted rounded-xl px-4 py-3">
              <p className="text-xs text-muted-foreground mb-1">Reference Number</p>
              <p className="font-mono font-bold text-primary text-lg">{successRef}</p>
            </div>
            <p className="text-xs text-muted-foreground">Please save this reference number for follow-up.</p>
            <button
              onClick={() => { setSelectedFlight(null); setSuccessRef(null); }}
              className="w-full bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
