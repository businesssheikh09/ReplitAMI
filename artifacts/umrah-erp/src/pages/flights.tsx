import { useState } from "react";
import { useListFlightQuotations, useCreateFlightQuotation, useUpdateFlightQuotation, useDeleteFlightQuotation, useListClients } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Plus, Plane, Trash2, Search, Loader2, ArrowRight, Clock, AlertCircle, CheckCircle2, Star } from "lucide-react";

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-700",
  booked: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const SOURCE_BADGE: Record<string, string> = {
  amadeus: "bg-blue-100 text-blue-700",
  sabre: "bg-red-100 text-red-700",
  galileo: "bg-emerald-100 text-emerald-700",
};

const CABIN_CLASSES = ["economy", "premium_economy", "business", "first"];

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

function formatTime(iso: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso.slice(11, 16) || iso;
  }
}

function formatDate(iso: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

export default function FlightsPage() {
  const [activeTab, setActiveTab] = useState<"search" | "quotations">("search");

  // Search state
  const [searchForm, setSearchForm] = useState({
    origin: "LHR",
    destination: "JED",
    departureDate: "",
    returnDate: "",
    adults: 1,
    cabinClass: "economy",
    providers: { amadeus: true, sabre: true, galileo: true },
  });
  const [searchResults, setSearchResults] = useState<FlightResult[]>([]);
  const [searchSources, setSearchSources] = useState<Record<string, string>>({});
  const [searching, setSearching] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const [sortBy, setSortBy] = useState<"price" | "duration" | "stops">("price");
  const [filterSource, setFilterSource] = useState("all");

  // Quotations state
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ clientId: "", origin: "", destination: "Jeddah (JED)", departureDate: "", returnDate: "", passengers: 1, cabinClass: "economy", airline: "", amount: "", currency: "USD" });
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: flights = [], isLoading } = useListFlightQuotations({ status: statusFilter !== "all" ? statusFilter : undefined });
  const { data: clients = [] } = useListClients({});
  const createFlight = useCreateFlightQuotation({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/flight-quotations"] }); setOpen(false); toast({ title: "Flight quotation created" }); } } });
  const updateFlight = useUpdateFlightQuotation({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/flight-quotations"] }); toast({ title: "Status updated" }); } } });
  const deleteFlight = useDeleteFlightQuotation({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/flight-quotations"] }); toast({ title: "Deleted" }); } } });

  const handleSearch = async () => {
    if (!searchForm.origin || !searchForm.destination || !searchForm.departureDate) {
      toast({ title: "Please fill origin, destination, and departure date", variant: "destructive" });
      return;
    }
    const providers = Object.entries(searchForm.providers).filter(([, v]) => v).map(([k]) => k);
    if (!providers.length) {
      toast({ title: "Select at least one GDS provider", variant: "destructive" });
      return;
    }

    setSearching(true);
    setSearchResults([]);
    setSearchDone(false);
    try {
      const res = await fetch("/api/flights/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: searchForm.origin.toUpperCase().slice(0, 3),
          destination: searchForm.destination.toUpperCase().slice(0, 3),
          departureDate: searchForm.departureDate,
          returnDate: searchForm.returnDate || undefined,
          adults: searchForm.adults,
          cabinClass: searchForm.cabinClass,
          providers,
        }),
      });
      const data = await res.json();
      setSearchResults(data.results || []);
      setSearchSources(data.sources || {});
      setSearchDone(true);
    } catch {
      toast({ title: "Search failed", variant: "destructive" });
    } finally {
      setSearching(false);
    }
  };

  const handleBookFromSearch = (result: FlightResult) => {
    setForm(prev => ({
      ...prev,
      origin: result.origin,
      destination: result.destination,
      departureDate: result.departureTime.slice(0, 10),
      airline: result.airlineName,
      amount: String(result.price),
      currency: result.currency,
      cabinClass: result.cabinClass,
    }));
    setActiveTab("quotations");
    setOpen(true);
    toast({ title: "Flight loaded into quotation form" });
  };

  const sortedResults = [...searchResults]
    .filter(r => filterSource === "all" || r.source === filterSource)
    .sort((a, b) => {
      if (sortBy === "price") return a.price - b.price;
      if (sortBy === "stops") return a.stops - b.stops;
      return a.duration.localeCompare(b.duration);
    });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2"><Plane className="h-6 w-6" />Flights</h2>
          <p className="text-muted-foreground">Search live fares via GDS and manage flight quotations.</p>
        </div>
        <div className="flex gap-2">
          <Button variant={activeTab === "search" ? "default" : "outline"} onClick={() => setActiveTab("search")}>
            <Search className="h-4 w-4 mr-2" />Live Search
          </Button>
          <Button variant={activeTab === "quotations" ? "default" : "outline"} onClick={() => setActiveTab("quotations")}>
            <Plane className="h-4 w-4 mr-2" />Quotations
          </Button>
        </div>
      </div>

      {/* ── LIVE SEARCH TAB ── */}
      {activeTab === "search" && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Search Parameters</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label>From (IATA)</Label>
                  <Input
                    value={searchForm.origin}
                    onChange={e => setSearchForm(p => ({ ...p, origin: e.target.value.toUpperCase() }))}
                    placeholder="e.g. LHR"
                    maxLength={3}
                    className="font-mono uppercase"
                  />
                </div>
                <div className="space-y-1">
                  <Label>To (IATA)</Label>
                  <Input
                    value={searchForm.destination}
                    onChange={e => setSearchForm(p => ({ ...p, destination: e.target.value.toUpperCase() }))}
                    placeholder="e.g. JED"
                    maxLength={3}
                    className="font-mono uppercase"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Departure</Label>
                  <Input type="date" value={searchForm.departureDate} onChange={e => setSearchForm(p => ({ ...p, departureDate: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Return (optional)</Label>
                  <Input type="date" value={searchForm.returnDate} onChange={e => setSearchForm(p => ({ ...p, returnDate: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Passengers</Label>
                  <Input type="number" min={1} max={9} value={searchForm.adults} onChange={e => setSearchForm(p => ({ ...p, adults: Number(e.target.value) }))} />
                </div>
                <div className="space-y-1">
                  <Label>Cabin Class</Label>
                  <Select value={searchForm.cabinClass} onValueChange={v => setSearchForm(p => ({ ...p, cabinClass: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CABIN_CLASSES.map(c => <SelectItem key={c} value={c}>{c.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border-t pt-3">
                <Label className="text-sm font-medium mb-2 block">GDS Providers</Label>
                <div className="flex flex-wrap gap-4">
                  {(["amadeus", "sabre", "galileo"] as const).map(p => (
                    <div key={p} className="flex items-center gap-2">
                      <Checkbox
                        id={p}
                        checked={searchForm.providers[p]}
                        onCheckedChange={v => setSearchForm(prev => ({ ...prev, providers: { ...prev.providers, [p]: !!v } }))}
                      />
                      <label htmlFor={p} className="text-sm font-medium capitalize cursor-pointer">{p === "galileo" ? "Galileo / Travelport" : p.charAt(0).toUpperCase() + p.slice(1)}</label>
                      {searchSources[p] && (
                        <Badge variant="outline" className={`text-xs ${searchSources[p] === "live" ? "border-green-500 text-green-700" : "border-amber-500 text-amber-700"}`}>
                          {searchSources[p] === "live" ? "Live" : "Demo"}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <Button onClick={handleSearch} disabled={searching} className="w-full" size="lg">
                {searching ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Searching all GDS providers…</>
                ) : (
                  <><Search className="h-4 w-4 mr-2" />Search Live Fares</>
                )}
              </Button>
            </CardContent>
          </Card>

          {searchDone && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <p className="text-sm text-muted-foreground">
                    <strong>{sortedResults.length}</strong> results for{" "}
                    <strong>{searchForm.origin} → {searchForm.destination}</strong>{" "}
                    on <strong>{formatDate(searchForm.departureDate)}</strong>
                  </p>
                  {Object.entries(searchSources).some(([, v]) => v === "mock") && (
                    <Badge variant="outline" className="text-amber-600 border-amber-400 text-xs">
                      <AlertCircle className="h-3 w-3 mr-1" />Demo data — configure GDS credentials for live fares
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Select value={filterSource} onValueChange={setFilterSource}>
                    <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="All Sources" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sources</SelectItem>
                      <SelectItem value="amadeus">Amadeus</SelectItem>
                      <SelectItem value="sabre">Sabre</SelectItem>
                      <SelectItem value="galileo">Galileo</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={sortBy} onValueChange={v => setSortBy(v as any)}>
                    <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Sort by" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="price">Sort: Price</SelectItem>
                      <SelectItem value="duration">Sort: Duration</SelectItem>
                      <SelectItem value="stops">Sort: Stops</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                {sortedResults.length === 0 ? (
                  <Card><CardContent className="py-12 text-center text-muted-foreground">No results found for this filter.</CardContent></Card>
                ) : sortedResults.map((result, idx) => (
                  <Card key={result.id} className={`hover:shadow-md transition-shadow ${idx === 0 ? "border-green-300 bg-green-50/30" : ""}`}>
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="text-center min-w-[56px]">
                            <div className="text-xl font-bold">{result.airline}</div>
                            <div className="text-xs text-muted-foreground">{result.airlineName}</div>
                            <div className="text-xs text-muted-foreground">{result.flightNumber}</div>
                          </div>

                          <div className="flex-1 flex items-center gap-3">
                            <div className="text-center">
                              <div className="text-xl font-bold">{formatTime(result.departureTime)}</div>
                              <div className="text-xs font-mono font-semibold">{result.origin}</div>
                            </div>
                            <div className="flex-1 text-center">
                              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                                <Clock className="h-3 w-3" />{result.duration}
                              </div>
                              <div className="flex items-center gap-1 my-0.5">
                                <div className="flex-1 h-px bg-border" />
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                <div className="flex-1 h-px bg-border" />
                              </div>
                              <div className="text-xs text-center">
                                {result.stops === 0 ? (
                                  <span className="text-green-600 font-medium">Non-stop</span>
                                ) : (
                                  <span className="text-amber-600">{result.stops} stop{result.stops > 1 ? "s" : ""}</span>
                                )}
                              </div>
                            </div>
                            <div className="text-center">
                              <div className="text-xl font-bold">{formatTime(result.arrivalTime)}</div>
                              <div className="text-xs font-mono font-semibold">{result.destination}</div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <Badge className={`text-xs mb-1 ${SOURCE_BADGE[result.source] || "bg-gray-100"}`}>
                              {result.source}
                            </Badge>
                            <div className="text-2xl font-bold">{result.currency} {result.price.toLocaleString()}</div>
                            <div className="text-xs text-muted-foreground capitalize">{result.cabinClass.replace("_", " ")}</div>
                            {result.seatsAvailable !== null && (
                              <div className="text-xs text-orange-600">{result.seatsAvailable} seats left</div>
                            )}
                            {result.refundable && (
                              <div className="text-xs text-green-600 flex items-center gap-1 justify-end">
                                <CheckCircle2 className="h-3 w-3" />Refundable
                              </div>
                            )}
                            {idx === 0 && (
                              <div className="text-xs text-green-700 flex items-center gap-1 justify-end mt-0.5">
                                <Star className="h-3 w-3 fill-green-500 stroke-green-500" />Best price
                              </div>
                            )}
                          </div>
                          <Button size="sm" onClick={() => handleBookFromSearch(result)}>
                            Select
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── QUOTATIONS TAB ── */}
      {activeTab === "quotations" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {["draft","sent","booked","cancelled"].map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />New Flight Quote</Button></DialogTrigger>
              <DialogContent className="sm:max-w-[560px]">
                <DialogHeader><DialogTitle>Create Flight Quotation</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-4 max-h-[70vh] overflow-y-auto">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Client</Label>
                    <Select value={form.clientId} onValueChange={v => setForm(p => ({ ...p, clientId: v }))}>
                      <SelectTrigger className="col-span-3"><SelectValue placeholder="Select client" /></SelectTrigger>
                      <SelectContent>{(clients as any[]).map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  {[["origin","Origin (e.g. LHR)"],["destination","Destination (e.g. JED)"]].map(([k, placeholder]) => (
                    <div key={k} className="grid grid-cols-4 items-center gap-4">
                      <Label className="text-right">{k === "origin" ? "From" : "To"}</Label>
                      <Input className="col-span-3" value={(form as any)[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} placeholder={placeholder} />
                    </div>
                  ))}
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Departure</Label>
                    <Input type="date" className="col-span-3" value={form.departureDate} onChange={e => setForm(p => ({ ...p, departureDate: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Return</Label>
                    <Input type="date" className="col-span-3" value={form.returnDate} onChange={e => setForm(p => ({ ...p, returnDate: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Passengers</Label>
                    <Input type="number" className="col-span-3" value={form.passengers} onChange={e => setForm(p => ({ ...p, passengers: Number(e.target.value) }))} />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Class</Label>
                    <Select value={form.cabinClass} onValueChange={v => setForm(p => ({ ...p, cabinClass: v }))}>
                      <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                      <SelectContent>{CABIN_CLASSES.map(c => <SelectItem key={c} value={c}>{c.replace("_"," ").replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Airline</Label>
                    <Input className="col-span-3" value={form.airline} onChange={e => setForm(p => ({ ...p, airline: e.target.value }))} placeholder="e.g. Saudi Airlines" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Amount</Label>
                    <div className="col-span-3 flex gap-2">
                      <Select value={form.currency} onValueChange={v => setForm(p => ({ ...p, currency: v }))}>
                        <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                        <SelectContent>{["USD","GBP","EUR","AED","SAR"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                      <Input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="Price" />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={() => createFlight.mutate({ data: { ...form, clientId: Number(form.clientId), amount: Number(form.amount), passengers: Number(form.passengers) } })} disabled={!form.clientId || !form.origin || !form.departureDate || !form.amount || createFlight.isPending}>Create</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="pt-4">
              {isLoading ? <div className="h-40 flex items-center justify-center text-muted-foreground">Loading...</div> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Route</TableHead>
                      <TableHead>Departure</TableHead>
                      <TableHead>Return</TableHead>
                      <TableHead>Pax</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Airline</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(flights as any[]).length === 0 ? (
                      <TableRow><TableCell colSpan={10} className="text-center h-32 text-muted-foreground">
                        <Plane className="mx-auto h-8 w-8 mb-2" />
                        No flight quotations. Search live fares above and click Select to create one.
                      </TableCell></TableRow>
                    ) : (flights as any[]).map((f: any) => (
                      <TableRow key={f.id}>
                        <TableCell className="font-medium">{f.clientName}</TableCell>
                        <TableCell className="text-sm font-mono">{f.origin} → {f.destination}</TableCell>
                        <TableCell className="text-sm">{new Date(f.departureDate).toLocaleDateString()}</TableCell>
                        <TableCell className="text-sm">{f.returnDate ? new Date(f.returnDate).toLocaleDateString() : "—"}</TableCell>
                        <TableCell>{f.passengers}</TableCell>
                        <TableCell className="capitalize text-sm">{f.cabinClass}</TableCell>
                        <TableCell className="text-sm">{f.airline || "—"}</TableCell>
                        <TableCell className="font-semibold">{f.currency} {(f.amount || 0).toLocaleString()}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[f.status] || "bg-gray-100"}`}>{f.status}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {f.status === "draft" && <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => updateFlight.mutate({ id: f.id, data: { status: "sent" } })}>Send</Button>}
                            {f.status === "sent" && <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => updateFlight.mutate({ id: f.id, data: { status: "booked" } })}>Book</Button>}
                            <Button size="sm" variant="ghost" onClick={() => deleteFlight.mutate({ id: f.id })}><Trash2 className="h-3 w-3 text-red-400" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
