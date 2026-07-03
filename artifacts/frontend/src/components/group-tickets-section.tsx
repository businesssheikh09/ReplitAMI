import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Plane, Calendar, Users, ChevronRight, Search, AlertCircle } from "lucide-react";

interface GroupTicket {
  id: number;
  flightNumber: string;
  airlineCode: string;
  origin: string;
  destination: string;
  flightDate: string;
  departureTime: string | null;
  arrivalTime: string | null;
  seats: number | null;
  fareAmount: number | null;
  fareCurrency: string;
  groupName: string | null;
}

const AIRLINE_NAMES: Record<string, string> = {
  SV: "Saudia", PK: "PIA", XY: "Flynas", G9: "Air Arabia",
  "9P": "FlyJinnah", PF: "Air Sial",
};

const AIRLINE_COLORS: Record<string, string> = {
  SV: "bg-green-50 text-green-700 border-green-200",
  PK: "bg-emerald-50 text-emerald-700 border-emerald-200",
  XY: "bg-purple-50 text-purple-700 border-purple-200",
  G9: "bg-orange-50 text-orange-700 border-orange-200",
  "9P": "bg-blue-50 text-blue-700 border-blue-200",
  PF: "bg-rose-50 text-rose-700 border-rose-200",
};

const ROUTE_CATEGORIES: Record<string, string> = {
  JED: "Umrah", MED: "Umrah", RUH: "Saudi", DMM: "Saudi",
  DXB: "UAE", SHJ: "UAE", AUH: "UAE",
  BAH: "Bahrain", MCT: "Oman", DOH: "Qatar",
};

const CITY_NAMES: Record<string, string> = {
  JED: "Jeddah", MED: "Madinah", RUH: "Riyadh", DMM: "Dammam",
  DXB: "Dubai", SHJ: "Sharjah", AUH: "Abu Dhabi",
  BAH: "Bahrain", MCT: "Muscat", DOH: "Doha",
  ISB: "Islamabad", LHE: "Lahore", KHI: "Karachi", PEW: "Peshawar",
  UET: "Quetta", SKT: "Sialkot",
};

function getCategory(ticket: GroupTicket): string {
  return ROUTE_CATEGORIES[ticket.destination] ?? "Other";
}

export function GroupTicketsSection() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("All");

  const { data: tickets = [], isLoading, isError } = useQuery<GroupTicket[]>({
    queryKey: ["public-group-tickets"],
    queryFn: async () => {
      const r = await fetch("/api/public/group-tickets");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    staleTime: 2 * 60 * 1000,
  });

  const categories = useMemo(() => {
    const cats = new Set(tickets.map(getCategory));
    return ["All", ...Array.from(cats).sort()];
  }, [tickets]);

  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      const matchesTab = activeTab === "All" || getCategory(t) === activeTab;
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        t.origin.toLowerCase().includes(q) ||
        t.destination.toLowerCase().includes(q) ||
        (CITY_NAMES[t.origin] ?? "").toLowerCase().includes(q) ||
        (CITY_NAMES[t.destination] ?? "").toLowerCase().includes(q) ||
        t.flightNumber.toLowerCase().includes(q) ||
        (AIRLINE_NAMES[t.airlineCode] ?? t.airlineCode ?? "").toLowerCase().includes(q);
      return matchesTab && matchesSearch;
    });
  }, [tickets, activeTab, search]);

  const grouped = useMemo(() => {
    const map: Record<string, GroupTicket[]> = {};
    for (const t of filtered) {
      const key = t.flightDate;
      if (!map[key]) map[key] = [];
      map[key].push(t);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const formatDate = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString("en-PK", { weekday: "short", day: "numeric", month: "short" });

  return (
    <section id="group-tickets" className="py-20 bg-stone-50">
      <div className="container mx-auto px-4 md:px-6">
        {/* Header */}
        <div className="text-center mb-12">
          <p className="text-sm font-medium tracking-widest text-teal-600 uppercase mb-3">Direct Flights</p>
          <h2 className="text-3xl md:text-5xl font-serif text-foreground mb-4">Available Seats</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Guaranteed seats on scheduled departures — book early for the best fares.
          </p>
        </div>

        {/* Search + Tabs */}
        <div className="max-w-4xl mx-auto mb-8 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by city, airline or flight number…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 transition"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveTab(cat)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium border transition ${
                  activeTab === cat
                    ? "bg-teal-600 text-white border-teal-600"
                    : "bg-white text-muted-foreground border-border hover:border-teal-400 hover:text-teal-700"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* States */}
        {isLoading && (
          <div className="flex justify-center py-20">
            <div className="h-10 w-10 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
          </div>
        )}
        {isError && (
          <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p>Unable to load tickets. Please try again shortly.</p>
          </div>
        )}
        {!isLoading && !isError && grouped.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-lg">No flights match your search.</p>
          </div>
        )}

        {/* Ticket groups by date */}
        <div className="max-w-4xl mx-auto space-y-8">
          {grouped.map(([date, dayTickets]) => (
            <div key={date}>
              <div className="flex items-center gap-3 mb-4">
                <Calendar className="h-4 w-4 text-teal-600" />
                <h3 className="font-medium text-sm text-teal-700">{formatDate(date)}</h3>
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">{dayTickets.length} flight{dayTickets.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="grid gap-3">
                {dayTickets.map((ticket) => {
                  const airlineCode = ticket.airlineCode ?? "";
                  const colorClass = AIRLINE_COLORS[airlineCode] ?? "bg-gray-50 text-gray-700 border-gray-200";
                  const airlineName = AIRLINE_NAMES[airlineCode] ?? airlineCode;
                  const from = CITY_NAMES[ticket.origin] ?? ticket.origin;
                  const to = CITY_NAMES[ticket.destination] ?? ticket.destination;

                  return (
                    <div
                      key={ticket.id}
                      className="group bg-white rounded-2xl border border-border p-5 flex items-center gap-5 hover:shadow-md hover:border-teal-300 transition-all cursor-pointer"
                      onClick={() => navigate(`/book-flight/${ticket.id}`)}
                    >
                      {/* Airline badge */}
                      <div className={`shrink-0 px-3 py-1.5 rounded-lg border text-xs font-bold ${colorClass}`}>
                        {airlineName}
                      </div>

                      {/* Route */}
                      <div className="flex-1 flex items-center gap-4">
                        <div className="text-center">
                          <p className="text-lg font-bold text-foreground">{ticket.origin}</p>
                          {ticket.departureTime && (
                            <p className="text-xs text-muted-foreground">{ticket.departureTime}</p>
                          )}
                        </div>
                        <div className="flex-1 flex flex-col items-center gap-1">
                          <div className="flex items-center gap-2 w-full">
                            <div className="flex-1 h-px bg-border" />
                            <Plane className="h-4 w-4 text-teal-500" />
                            <div className="flex-1 h-px bg-border" />
                          </div>
                          <p className="text-xs text-muted-foreground">{ticket.flightNumber}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-foreground">{ticket.destination}</p>
                          {ticket.arrivalTime && (
                            <p className="text-xs text-muted-foreground">{ticket.arrivalTime}</p>
                          )}
                        </div>
                      </div>

                      {/* Fare + seats */}
                      <div className="text-right shrink-0">
                        {ticket.fareAmount ? (
                          <p className="text-xl font-bold text-teal-700">
                            {ticket.fareCurrency} {ticket.fareAmount.toLocaleString()}
                          </p>
                        ) : (
                          <p className="text-sm font-semibold text-muted-foreground italic">Price on Call</p>
                        )}
                        {ticket.seats != null && (
                          <p className={`text-xs mt-0.5 font-medium ${ticket.seats <= 5 ? "text-red-500" : "text-muted-foreground"}`}>
                            <Users className="inline h-3 w-3 mr-0.5" />
                            {ticket.seats} seats
                          </p>
                        )}
                      </div>

                      {/* Arrow */}
                      <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 group-hover:text-teal-600 transition" />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        {!isLoading && tickets.length > 0 && (
          <div className="text-center mt-12">
            <p className="text-muted-foreground text-sm mb-3">Need a custom departure date or group deal?</p>
            <a href="#customize" className="text-teal-600 font-medium text-sm hover:underline">
              Build your own package →
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
