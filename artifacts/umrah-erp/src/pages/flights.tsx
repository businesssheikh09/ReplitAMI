import { useState, useEffect, useCallback, useRef } from "react";
import { useListFlightQuotations, useCreateFlightQuotation, useUpdateFlightQuotation, useDeleteFlightQuotation, useListClients, FlightQuotationInputCabinClass } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Plane, Trash2, Search, Loader2, ArrowRight, Clock,
  AlertCircle, CheckCircle2, Star, TicketCheck, PlusCircle,
  MinusCircle, RefreshCw, Lock, Users2, Wifi, WifiOff, Zap, ScanLine, ChevronDown, LogOut,
} from "lucide-react";
import QRCode from "qrcode";

// ── Constants ─────────────────────────────────────────────────────────────────

const CABIN_CLASSES = ["economy", "premium_economy", "business", "first"];
const FORM_CABIN_CLASSES = Object.values(FlightQuotationInputCabinClass) as FlightQuotationInputCabinClass[];
const CURRENCIES = ["USD", "GBP", "EUR", "AED", "SAR", "PKR", "TRY", "OMR", "KWD", "BHD", "QAR", "JOD", "EGP"];

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-700",
  booked: "bg-green-100 text-green-700",
  ticketed: "bg-emerald-100 text-emerald-700 font-semibold",
  cancelled: "bg-red-100 text-red-700",
};

const SOURCE_BADGE: Record<string, string> = {
  amadeus: "bg-blue-100 text-blue-700",
  sabre: "bg-red-100 text-red-700",
  galileo: "bg-emerald-100 text-emerald-700",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
  catch { return iso.slice(11, 16) || iso; }
}

function fmtDate(d: string) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return d; }
}

function convertPrice(price: number, from: string, to: string, rates: Record<string, number>) {
  if (from === to || !rates[to]) return price;
  const inUsd = from === "USD" ? price : price / (rates[from] || 1);
  return inUsd * (rates[to] || 1);
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface FlightResult {
  id: string; source: string; airline: string; airlineName: string;
  flightNumber: string; origin: string; destination: string;
  departureTime: string; arrivalTime: string; duration: string;
  stops: number; cabinClass: string; price: number; currency: string;
  seatsAvailable: number | null; refundable: boolean; legIndex?: number;
}

interface RouteLeg { origin: string; destination: string; departureDate: string; }

// ── Group Ticket Types ────────────────────────────────────────────────────────

interface LiveGroup {
  jid: string;
  name: string;
  participantCount: number;
  lastActivityTimestamp: number | null;
}

interface MonitoredGroup {
  id: number;
  jid: string;
  name: string;
  enabled: boolean;
  updatedAt: string;
}

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
  scrapedAt: string;
  updatedAt: string;
}

// ── Group Tickets Tab Component ───────────────────────────────────────────────

function GroupTicketsTab() {
  const { token, user } = useAuth();
  const { toast } = useToast();

  const [tickets, setTickets] = useState<GroupTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [qrReady, setQrReady] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [filterOrigin, setFilterOrigin] = useState("");
  const [filterDest, setFilterDest] = useState("");
  const [hidePastTickets, setHidePastTickets] = useState(true);

  // WhatsApp groups panel state
  const [liveGroups, setLiveGroups] = useState<LiveGroup[]>([]);
  const [monitoredJids, setMonitoredJids] = useState<Set<string>>(new Set());
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState(false);

  // QR modal state
  const [qrOpen, setQrOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const sessionExpiredShown = useRef(false);

  const canSync = ["admin", "management", "accounts"].includes(user?.role ?? "");

  const authHeaders = { Authorization: `Bearer ${token}` };

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterOrigin) params.set("origin", filterOrigin.toUpperCase());
      if (filterDest) params.set("destination", filterDest.toUpperCase());
      if (hidePastTickets) params.set("fromDate", new Date().toISOString().slice(0, 10));
      const res = await fetch(`/api/group-tickets?${params}`, { headers: authHeaders });
      if (res.ok) {
        setTickets(await res.json());
      } else if (res.status === 401) {
        toast({ title: "Session expired", description: "Please log out and log back in.", variant: "destructive" });
      } else {
        toast({ title: "Failed to load group tickets", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to load group tickets", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [token, filterOrigin, filterDest, hidePastTickets]);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/group-tickets/status", { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setWhatsappStatus(data.whatsappStatus);
        setQrReady(!!data.qrReady);
      } else if (res.status === 401 && !sessionExpiredShown.current) {
        sessionExpiredShown.current = true;
        setSessionExpired(true);
        toast({ title: "Session expired", description: "Please log out and log back in.", variant: "destructive" });
      }
    } catch { /* silent */ }
  }, [token]);

  const fetchQR = useCallback(async () => {
    setQrLoading(true);
    try {
      const res = await fetch("/api/group-tickets/qr", { headers: authHeaders });
      if (!res.ok) {
        if (res.status === 401) {
          setQrError("Session expired — please log out and log back in.");
        } else {
          setQrError(`Server error (${res.status}) — please try again.`);
        }
        return;
      }
      setQrError(null);
      const data = await res.json();
      // Auto-close if WhatsApp just connected
      if (data.status === "connected") {
        setWhatsappStatus("connected");
        setQrOpen(false);
        setQrDataUrl(null);
        toast({ title: "WhatsApp linked!", description: "Your phone is now connected. Click Sync Now to fetch tickets." });
        return;
      }
      setWhatsappStatus(data.status);
      if (data.qr) {
        const dataUrl = await QRCode.toDataURL(data.qr, { width: 280, margin: 2 });
        setQrDataUrl(dataUrl);
      } else {
        setQrDataUrl(null);
      }
    } catch { setQrError("Network error — check your connection and try again."); } finally {
      setQrLoading(false);
    }
  }, [token]);

  // ── WhatsApp group management ──────────────────────────────────────────────

  const fetchLiveGroups = useCallback(async () => {
    setGroupsLoading(true);
    try {
      const [liveRes, dbRes] = await Promise.all([
        fetch("/api/whatsapp-groups/live", { headers: authHeaders }),
        fetch("/api/whatsapp-groups", { headers: authHeaders }),
      ]);
      if (liveRes.status === 409) return; // WhatsApp not connected — skip silently
      if (!liveRes.ok) throw new Error(`HTTP ${liveRes.status}`);
      const live: LiveGroup[] = await liveRes.json();
      const dbRows: MonitoredGroup[] = dbRes.ok ? await dbRes.json() : [];
      setLiveGroups(live);
      setMonitoredJids(new Set(dbRows.filter((r) => r.enabled).map((r) => r.jid)));
    } catch {
      toast({ title: "Failed to load WhatsApp groups", variant: "destructive" });
    } finally {
      setGroupsLoading(false);
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleGroup(jid: string, name: string, enabled: boolean) {
    try {
      const res = await fetch(`/api/whatsapp-groups/${encodeURIComponent(jid)}`, {
        method: "PUT",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ name, enabled }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setMonitoredJids((prev) => {
        const next = new Set(prev);
        if (enabled) next.add(jid);
        else next.delete(jid);
        return next;
      });
    } catch {
      toast({ title: "Failed to update group", variant: "destructive" });
    }
  }

  // Auto-load group list whenever WhatsApp becomes connected
  useEffect(() => {
    if (whatsappStatus === "connected" && canSync) {
      fetchLiveGroups();
    }
  }, [whatsappStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset session-expired gate when the user logs back in with a fresh token
  useEffect(() => {
    sessionExpiredShown.current = false;
    setSessionExpired(false);
  }, [token]);

  useEffect(() => {
    fetchTickets();
    fetchStatus();
    if (sessionExpired) return;
    const iv = setInterval(fetchStatus, 8_000);
    return () => clearInterval(iv);
  }, [fetchTickets, fetchStatus, sessionExpired]);

  // Auto-open QR dialog when server has a QR code ready to scan
  useEffect(() => {
    if (qrReady && !qrOpen && whatsappStatus !== "connected") {
      setQrOpen(true);
    }
  }, [qrReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll for new QR while the modal is open (Baileys refreshes QR every ~60 s)
  useEffect(() => {
    if (!qrOpen) { setQrDataUrl(null); setQrError(null); return; }
    fetchQR();
    const iv = setInterval(fetchQR, 15_000);
    return () => clearInterval(iv);
  }, [qrOpen, fetchQR]);

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/group-tickets/sync", { method: "POST", headers: authHeaders });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "Sync complete", description: `WhatsApp: ${data.whatsappStatus}` });
        setWhatsappStatus(data.whatsappStatus);
        await fetchTickets();
      } else {
        toast({ title: "Sync failed", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Sync failed", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  }

  const handleDisconnect = async () => {
    if (!window.confirm("This will disconnect the current WhatsApp account and prompt a new QR code so you can link a different number. Continue?")) return;
    setDisconnecting(true);
    try {
      const res = await fetch("/api/whatsapp/logout", { method: "POST", headers: authHeaders });
      if (res.ok) {
        setWhatsappStatus("disconnected");
        toast({ title: "WhatsApp disconnected", description: "Scan a new QR code to link a different account." });
      } else {
        const body = await res.json().catch(() => ({}));
        toast({ title: "Disconnect failed", description: body.error ?? "Server error", variant: "destructive" });
      }
    } catch {
      toast({ title: "Disconnect failed", description: "Network error", variant: "destructive" });
    } finally {
      setDisconnecting(false);
    }
  };

  const seatColor = (seats: number) =>
    seats >= 10 ? "text-green-700 font-semibold" :
    seats >= 5  ? "text-amber-600 font-semibold" :
                  "text-red-600 font-bold";

  const StatusDot = () =>
    whatsappStatus === "connected"
      ? <><Wifi className="h-3.5 w-3.5 text-green-500" /> <span className="text-green-600 text-xs">Connected</span></>
      : whatsappStatus === "connecting" && qrReady
      ? <><ScanLine className="h-3.5 w-3.5 text-orange-500 animate-pulse" /> <span className="text-orange-600 text-xs font-medium">Scan QR to connect</span></>
      : whatsappStatus === "connecting"
      ? <><Wifi className="h-3.5 w-3.5 text-amber-500 animate-pulse" /> <span className="text-amber-600 text-xs">Reconnecting…</span></>
      : <><WifiOff className="h-3.5 w-3.5 text-gray-400" /> <span className="text-gray-500 text-xs">Not linked</span></>;

  return (
    <div className="space-y-4">
      {/* QR Code Dialog */}
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanLine className="h-5 w-5 text-blue-900" />
              Link WhatsApp
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            {qrError ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <AlertCircle className="h-8 w-8 text-red-500" />
                <p className="text-sm text-center text-red-600 font-medium">{qrError}</p>
              </div>
            ) : qrLoading && !qrDataUrl ? (
              <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-sm">Generating QR code…</p>
              </div>
            ) : qrDataUrl ? (
              <>
                <img src={qrDataUrl} alt="WhatsApp QR Code" className="rounded-lg border border-gray-200" width={280} height={280} />
                <p className="text-xs text-muted-foreground text-center">
                  Open WhatsApp on your phone → <strong>Settings → Linked Devices → Link a Device</strong>, then point your camera at this code.
                </p>
                <p className="text-xs text-blue-700 bg-blue-50 rounded px-3 py-1.5 text-center">
                  QR refreshes automatically every 15 s · Dialog closes once linked
                </p>
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-sm">Waiting for QR code from server…</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Group Ticket Inventory</CardTitle>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50">
                <StatusDot />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={fetchTickets} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              {whatsappStatus !== "connected" && (
                <Button variant="outline" size="sm" onClick={() => setQrOpen(true)}
                  className="border-green-600 text-green-700 hover:bg-green-50">
                  <ScanLine className="h-4 w-4 mr-1.5" />
                  Scan QR
                </Button>
              )}
              {whatsappStatus === "connected" && canSync && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="border-red-300 text-red-600 hover:bg-red-50"
                >
                  <LogOut className={`h-4 w-4 mr-1.5 ${disconnecting ? "animate-spin" : ""}`} />
                  {disconnecting ? "Disconnecting…" : "Disconnect WA"}
                </Button>
              )}
              {canSync && (
                <Button size="sm" onClick={handleSync} disabled={syncing}
                  className="bg-blue-900 hover:bg-blue-800 text-white">
                  <Zap className={`h-4 w-4 mr-1.5 ${syncing ? "animate-pulse" : ""}`} />
                  {syncing ? "Syncing…" : "Sync Now"}
                </Button>
              )}
            </div>
          </div>
          {/* Filters */}
          <div className="flex gap-2 mt-3 flex-wrap items-center">
            <Input
              placeholder="Origin (e.g. PEW)"
              value={filterOrigin}
              onChange={e => setFilterOrigin(e.target.value)}
              className="w-36 uppercase h-8 text-sm"
              maxLength={3}
            />
            <Input
              placeholder="Destination (e.g. RUH)"
              value={filterDest}
              onChange={e => setFilterDest(e.target.value)}
              className="w-36 uppercase h-8 text-sm"
              maxLength={3}
            />
            <Button variant="outline" size="sm" onClick={fetchTickets}>
              <Search className="h-4 w-4" />
            </Button>
            {(filterOrigin || filterDest) && (
              <Button variant="ghost" size="sm" onClick={() => { setFilterOrigin(""); setFilterDest(""); }}>
                Clear
              </Button>
            )}
            <div className="flex items-center gap-2 ml-1">
              <Checkbox
                id="hide-past-tickets"
                checked={hidePastTickets}
                onCheckedChange={v => setHidePastTickets(Boolean(v))}
              />
              <Label htmlFor="hide-past-tickets" className="text-sm cursor-pointer select-none">
                Hide past flights
              </Label>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading…
            </div>
          ) : tickets.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <Users2 className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-base font-semibold mb-1">No group tickets yet</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  {whatsappStatus === "connected"
                    ? 'Click "Sync Now" to pull the latest group allocations from WhatsApp.'
                    : 'Click "Scan QR" to link your WhatsApp, then click "Sync Now".'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {whatsappStatus !== "connected" && (
                  <Button size="sm" variant="outline" onClick={() => setQrOpen(true)}
                    className="border-green-600 text-green-700 hover:bg-green-50">
                    <ScanLine className="h-4 w-4 mr-1.5" />
                    Scan QR
                  </Button>
                )}
                {canSync && (
                  <Button size="sm" onClick={handleSync} disabled={syncing} className="bg-blue-900 hover:bg-blue-800 text-white">
                    <Zap className="h-4 w-4 mr-1.5" />
                    {syncing ? "Syncing…" : "Sync Now"}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-blue-900 hover:bg-blue-900">
                    <TableHead className="text-white font-semibold">Sector</TableHead>
                    <TableHead className="text-white font-semibold">Flight</TableHead>
                    <TableHead className="text-white font-semibold">Date</TableHead>
                    <TableHead className="text-white font-semibold text-center">Time</TableHead>
                    <TableHead className="text-white font-semibold text-center">Seats</TableHead>
                    <TableHead className="text-white font-semibold text-right">Fare</TableHead>
                    <TableHead className="text-white font-semibold">Source Group</TableHead>
                    <TableHead className="text-white font-semibold">Last Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.map((t, i) => (
                    <TableRow key={t.id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 text-xs font-bold">
                            {t.origin}
                          </Badge>
                          <ArrowRight className="h-3 w-3 text-gray-400" />
                          <Badge className="bg-indigo-100 text-indigo-800 hover:bg-indigo-100 text-xs font-bold">
                            {t.destination}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono font-semibold text-sm">{t.flightNumber}</TableCell>
                      <TableCell className="text-sm">
                        {new Date(t.flightDate + "T00:00:00").toLocaleDateString("en-GB", {
                          day: "2-digit", month: "short", year: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="text-center text-sm text-muted-foreground">
                        {t.departureTime ?? "—"} {t.arrivalTime ? `→ ${t.arrivalTime}` : ""}
                      </TableCell>
                      <TableCell className={`text-center text-sm ${seatColor(t.seats)}`}>
                        {t.seats}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {t.fareAmount != null
                          ? `${Number(t.fareAmount).toLocaleString()} ${t.fareCurrency}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">
                        {t.groupName ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(t.updatedAt).toLocaleDateString("en-GB", {
                          day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* WhatsApp Groups Panel — collapsible, group browse & selection for scraping */}
      {canSync && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                className="flex items-center gap-2 text-left flex-1 min-w-0"
                onClick={() => setGroupsOpen((v) => !v)}
              >
                <Users2 className="h-4 w-4 text-green-600 shrink-0" />
                <CardTitle className="text-base">WhatsApp Groups</CardTitle>
                {liveGroups.length > 0 && (
                  <span className="text-xs font-normal text-muted-foreground">
                    {monitoredJids.size}/{liveGroups.length} monitored
                  </span>
                )}
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground ml-auto shrink-0 transition-transform ${groupsOpen ? "rotate-180" : ""}`}
                />
              </button>
              {groupsOpen && (
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-2 shrink-0"
                  onClick={fetchLiveGroups}
                  disabled={groupsLoading || whatsappStatus !== "connected"}
                >
                  <RefreshCw className={`h-4 w-4 mr-1.5 ${groupsLoading ? "animate-spin" : ""}`} />
                  {liveGroups.length === 0 ? "Load Groups" : "Refresh"}
                </Button>
              )}
            </div>
          </CardHeader>

          {groupsOpen && (
            <CardContent className="pt-0">
              {whatsappStatus !== "connected" ? (
                <div className="text-sm text-muted-foreground py-2 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                  Connect WhatsApp first to browse and select groups.
                </div>
              ) : groupsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Loading groups from your phone…
                </div>
              ) : liveGroups.length === 0 ? (
                <div className="text-sm text-muted-foreground py-2">
                  Click <strong>Load Groups</strong> to fetch all WhatsApp groups your linked phone is in.
                </div>
              ) : (
                <div className="divide-y max-h-80 overflow-y-auto -mx-2 px-2">
                  {liveGroups.map((g) => {
                    const lastTs = g.lastActivityTimestamp;
                    const lastLabel = lastTs
                      ? (() => {
                          const diffSec = Math.floor(Date.now() / 1000) - lastTs;
                          if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
                          if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
                          return `${Math.floor(diffSec / 86400)}d ago`;
                        })()
                      : null;
                    return (
                      <div key={g.jid} className="flex items-center justify-between py-2.5 gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{g.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {g.participantCount} members
                            {lastLabel && (
                              <span className="ml-2 text-green-600">· last ticket {lastLabel}</span>
                            )}
                          </p>
                        </div>
                        <Switch
                          checked={monitoredJids.has(g.jid)}
                          onCheckedChange={(checked) => toggleGroup(g.jid, g.name, checked)}
                          aria-label={`Monitor ${g.name}`}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {/* Setup instructions (visible when not connected) */}
      {whatsappStatus !== "connected" && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm text-amber-800 flex-1">
              <p className="font-semibold mb-1">WhatsApp session not linked</p>
              <p>Click <strong>Scan QR</strong> above, then scan the code with WhatsApp → <strong>Settings → Linked Devices → Link a Device</strong>. You only need to scan once — credentials are saved automatically.</p>
              <p className="mt-1 text-xs text-amber-700">Once connected, use the <strong>WhatsApp Groups</strong> panel above to pick which group chats to scrape for flight tickets.</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setQrOpen(true)}
              className="shrink-0 border-amber-600 text-amber-700 hover:bg-amber-100">
              <ScanLine className="h-4 w-4 mr-1.5" />
              Scan QR
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FlightsPage() {
  const [activeTab, setActiveTab] = useState<"search" | "group_tickets" | "quotations">("search");

  // Search
  const [tripType, setTripType] = useState<"one_way" | "round_trip" | "multi_city">("one_way");
  const [origin, setOrigin] = useState("LHR");
  const [destination, setDestination] = useState("JED");
  const [departureDate, setDepartureDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [adults, setAdults] = useState(1);
  const [cabinClass, setCabinClass] = useState("economy");
  const [legs, setLegs] = useState<RouteLeg[]>([
    { origin: "LHR", destination: "AMM", departureDate: "" },
    { origin: "AMM", destination: "JED", departureDate: "" },
  ]);
  const [providers, setProviders] = useState({ amadeus: true, sabre: true, galileo: true });

  // Results
  const [results, setResults] = useState<FlightResult[]>([]);
  const [sources, setSources] = useState<Record<string, string>>({});
  const [searching, setSearching] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const [sortBy, setSortBy] = useState<"price" | "duration" | "stops">("price");
  const [filterSource, setFilterSource] = useState("all");
  const [filterLeg, setFilterLeg] = useState("all");

  // Currency
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [rates, setRates] = useState<Record<string, number>>({ USD: 1 });
  const [ratesLoading, setRatesLoading] = useState(false);

  // Quotation form
  const [statusFilter, setStatusFilter] = useState("all");
  const [hidePast, setHidePast] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ clientId: string; origin: string; destination: string; departureDate: string; returnDate: string; passengers: number; cabinClass: FlightQuotationInputCabinClass; airline: string; amount: string; currency: string; tripType: string }>({ clientId: "", origin: "", destination: "", departureDate: "", returnDate: "", passengers: 1, cabinClass: FlightQuotationInputCabinClass.economy, airline: "", amount: "", currency: "USD", tripType: "one_way" });

  // Ticket issuance
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueBookingId, setIssueBookingId] = useState<number | null>(null);
  const [issuePin, setIssuePin] = useState("");
  const [issuing, setIssuing] = useState(false);

  const { toast } = useToast();
  const qc = useQueryClient();

  const fromDateParam = hidePast ? new Date().toISOString().slice(0, 10) : undefined;
  const { data: flights = [], isLoading } = useListFlightQuotations({
    status: statusFilter !== "all" ? statusFilter : undefined,
    fromDate: fromDateParam,
  });
  const { data: clients = [] } = useListClients({});
  const createFlight = useCreateFlightQuotation({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/flight-quotations"] }); setOpen(false); toast({ title: "Flight quotation created" }); } } });
  const updateFlight = useUpdateFlightQuotation({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/flight-quotations"] }); toast({ title: "Status updated" }); } } });
  const deleteFlight = useDeleteFlightQuotation({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/flight-quotations"] }); toast({ title: "Deleted" }); } } });

  // Fetch exchange rates on mount
  useEffect(() => {
    setRatesLoading(true);
    fetch("/api/currency/rates")
      .then(r => r.json())
      .then(d => { if (d.rates) setRates(d.rates); })
      .catch(() => {})
      .finally(() => setRatesLoading(false));
  }, []);

  const handleSearch = async () => {
    const selectedProviders = Object.entries(providers).filter(([, v]) => v).map(([k]) => k);
    if (!selectedProviders.length) { toast({ title: "Select at least one GDS provider", variant: "destructive" }); return; }
    if (tripType !== "multi_city" && (!origin || !destination || !departureDate)) {
      toast({ title: "Please fill origin, destination and departure date", variant: "destructive" }); return;
    }
    if (tripType === "multi_city" && legs.some(l => !l.origin || !l.destination || !l.departureDate)) {
      toast({ title: "Please fill all route legs", variant: "destructive" }); return;
    }

    setSearching(true); setResults([]); setSearchDone(false);
    try {
      const body: any = { adults, cabinClass, providers: selectedProviders, tripType };
      if (tripType === "multi_city") {
        body.origin = legs[0].origin;
        body.destination = legs[legs.length - 1].destination;
        body.departureDate = legs[0].departureDate;
        body.legs = legs;
      } else {
        body.origin = origin.toUpperCase().slice(0, 3);
        body.destination = destination.toUpperCase().slice(0, 3);
        body.departureDate = departureDate;
        if (tripType === "round_trip" && returnDate) body.returnDate = returnDate;
      }
      const res = await fetch("/api/flights/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      setResults(data.results || []); setSources(data.sources || {}); setSearchDone(true);
    } catch { toast({ title: "Search failed", variant: "destructive" }); }
    finally { setSearching(false); }
  };

  const handleSelect = (r: FlightResult) => {
    setForm(p => ({ ...p, origin: r.origin, destination: r.destination, departureDate: r.departureTime.slice(0, 10), airline: r.airlineName, amount: String(Math.round(r.price)), currency: r.currency, cabinClass: (Object.values(FlightQuotationInputCabinClass) as string[]).includes(r.cabinClass) ? r.cabinClass as FlightQuotationInputCabinClass : FlightQuotationInputCabinClass.economy, tripType }));
    setActiveTab("quotations"); setOpen(true);
    toast({ title: "Flight loaded — select a client to save quotation" });
  };

  const handleIssueTicket = async () => {
    if (!issueBookingId || !issuePin) { toast({ title: "Fill all fields", variant: "destructive" }); return; }
    setIssuing(true);
    const token = localStorage.getItem("umrah_token");
    try {
      const res = await fetch("/api/flights/issue-ticket", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ bookingId: issueBookingId, pin: issuePin }),
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: data.error || "Issue failed", variant: "destructive" }); return; }
      qc.invalidateQueries({ queryKey: ["/api/flight-quotations"] });
      toast({ title: `Ticket issued: ${data.ticketNumber}`, description: `Issued by ${data.issuedBy}` });
      setIssueOpen(false); setIssuePin(""); setIssueBookingId(null);
    } catch { toast({ title: "Issue failed", variant: "destructive" }); }
    finally { setIssuing(false); }
  };

  const filtered = results
    .filter(r => filterSource === "all" || r.source === filterSource)
    .filter(r => filterLeg === "all" || String(r.legIndex ?? 0) === filterLeg)
    .sort((a, b) => {
      if (sortBy === "price") return convertPrice(a.price, a.currency, displayCurrency, rates) - convertPrice(b.price, b.currency, displayCurrency, rates);
      if (sortBy === "stops") return a.stops - b.stops;
      return a.duration.localeCompare(b.duration);
    });

  const uniqueLegs = tripType === "multi_city" ? [...new Set(results.map(r => String(r.legIndex ?? 0)))] : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2"><Plane className="h-6 w-6" />Flights</h2>
          <p className="text-muted-foreground">Live GDS search · Multi-city routes · Currency conversion · Ticket issuance</p>
        </div>
        <div className="flex gap-2">
          <Button variant={activeTab === "search" ? "default" : "outline"} onClick={() => setActiveTab("search")}><Search className="h-4 w-4 mr-2" />Live Search</Button>
          <Button variant={activeTab === "group_tickets" ? "default" : "outline"} onClick={() => setActiveTab("group_tickets")}><Users2 className="h-4 w-4 mr-2" />Group Tickets</Button>
          <Button variant={activeTab === "quotations" ? "default" : "outline"} onClick={() => setActiveTab("quotations")}><Plane className="h-4 w-4 mr-2" />Quotations</Button>
        </div>
      </div>

      {/* ── LIVE SEARCH ── */}
      {activeTab === "search" && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <Tabs value={tripType} onValueChange={v => setTripType(v as any)}>
                  <TabsList>
                    <TabsTrigger value="one_way">One Way</TabsTrigger>
                    <TabsTrigger value="round_trip">Round Trip</TabsTrigger>
                    <TabsTrigger value="multi_city">Multi-City</TabsTrigger>
                  </TabsList>
                </Tabs>
                <div className="flex items-center gap-2">
                  {ratesLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <RefreshCw className="h-4 w-4 text-muted-foreground" />}
                  <span className="text-xs text-muted-foreground">Display currency:</span>
                  <Select value={displayCurrency} onValueChange={setDisplayCurrency}>
                    <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* One-way / Round-trip form */}
              {tripType !== "multi_city" && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label>From (IATA)</Label>
                    <Input value={origin} onChange={e => setOrigin(e.target.value.toUpperCase())} placeholder="LHR" maxLength={3} className="font-mono uppercase" />
                  </div>
                  <div className="space-y-1">
                    <Label>To (IATA)</Label>
                    <Input value={destination} onChange={e => setDestination(e.target.value.toUpperCase())} placeholder="JED" maxLength={3} className="font-mono uppercase" />
                  </div>
                  <div className="space-y-1">
                    <Label>Departure</Label>
                    <Input type="date" value={departureDate} onChange={e => setDepartureDate(e.target.value)} />
                  </div>
                  {tripType === "round_trip" && (
                    <div className="space-y-1">
                      <Label>Return</Label>
                      <Input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} />
                    </div>
                  )}
                  <div className="space-y-1">
                    <Label>Passengers</Label>
                    <Input type="number" min={1} max={9} value={adults} onChange={e => setAdults(Number(e.target.value))} />
                  </div>
                  <div className="space-y-1">
                    <Label>Cabin Class</Label>
                    <Select value={cabinClass} onValueChange={setCabinClass}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CABIN_CLASSES.map(c => <SelectItem key={c} value={c}>{c.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Multi-city legs */}
              {tripType === "multi_city" && (
                <div className="space-y-3">
                  {legs.map((leg, i) => (
                    <div key={i} className="grid grid-cols-4 gap-2 items-end p-3 bg-muted/30 rounded-lg">
                      <div className="space-y-1">
                        <Label className="text-xs">Leg {i + 1} · From</Label>
                        <Input value={leg.origin} onChange={e => setLegs(p => p.map((l, j) => j === i ? { ...l, origin: e.target.value.toUpperCase() } : l))} placeholder="LHR" maxLength={3} className="font-mono uppercase h-8 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">To</Label>
                        <Input value={leg.destination} onChange={e => setLegs(p => p.map((l, j) => j === i ? { ...l, destination: e.target.value.toUpperCase() } : l))} placeholder="AMM" maxLength={3} className="font-mono uppercase h-8 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Date</Label>
                        <Input type="date" value={leg.departureDate} onChange={e => setLegs(p => p.map((l, j) => j === i ? { ...l, departureDate: e.target.value } : l))} className="h-8 text-sm" />
                      </div>
                      <div className="flex gap-1 pb-0.5">
                        {legs.length > 2 && (
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setLegs(p => p.filter((_, j) => j !== i))}>
                            <MinusCircle className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                        {i === legs.length - 1 && legs.length < 5 && (
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setLegs(p => [...p, { origin: p[p.length - 1].destination, destination: "", departureDate: "" }])}>
                            <PlusCircle className="h-4 w-4 text-blue-500" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Passengers</Label>
                      <Input type="number" min={1} max={9} value={adults} onChange={e => setAdults(Number(e.target.value))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Cabin Class</Label>
                      <Select value={cabinClass} onValueChange={setCabinClass}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{CABIN_CLASSES.map(c => <SelectItem key={c} value={c}>{c.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {/* GDS Providers */}
              <div className="border-t pt-3 flex flex-wrap items-center gap-4">
                <span className="text-sm font-medium text-muted-foreground">GDS:</span>
                {(["amadeus", "sabre", "galileo"] as const).map(p => (
                  <div key={p} className="flex items-center gap-2">
                    <Checkbox id={p} checked={providers[p]} onCheckedChange={v => setProviders(prev => ({ ...prev, [p]: !!v }))} />
                    <label htmlFor={p} className="text-sm font-medium capitalize cursor-pointer">
                      {p === "galileo" ? "Galileo" : p.charAt(0).toUpperCase() + p.slice(1)}
                    </label>
                    {sources[p] && (
                      <Badge variant="outline" className={`text-xs ${sources[p] === "live" ? "border-green-500 text-green-700" : "border-amber-500 text-amber-700"}`}>
                        {sources[p] === "live" ? "Live" : "Demo"}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>

              <Button onClick={handleSearch} disabled={searching} className="w-full" size="lg">
                {searching ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Searching {Object.entries(providers).filter(([, v]) => v).length} GDS providers…</> : <><Search className="h-4 w-4 mr-2" />Search Live Fares</>}
              </Button>
            </CardContent>
          </Card>

          {/* Results */}
          {searchDone && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <p className="text-sm text-muted-foreground">
                    <strong>{filtered.length}</strong> results · All prices in <strong>{displayCurrency}</strong>
                    {displayCurrency !== "USD" && rates[displayCurrency] && (
                      <span className="text-xs ml-1 text-muted-foreground/70">(1 USD = {rates[displayCurrency].toFixed(4)} {displayCurrency})</span>
                    )}
                  </p>
                  {Object.values(sources).some(v => v === "mock") && (
                    <Badge variant="outline" className="text-amber-600 border-amber-400 text-xs">
                      <AlertCircle className="h-3 w-3 mr-1" />Demo fares · Add GDS credentials for live pricing
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {tripType === "multi_city" && uniqueLegs.length > 1 && (
                    <Select value={filterLeg} onValueChange={setFilterLeg}>
                      <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="All Legs" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Legs</SelectItem>
                        {uniqueLegs.map(l => <SelectItem key={l} value={l}>Leg {Number(l) + 1}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                  <Select value={filterSource} onValueChange={setFilterSource}>
                    <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sources</SelectItem>
                      <SelectItem value="amadeus">Amadeus</SelectItem>
                      <SelectItem value="sabre">Sabre</SelectItem>
                      <SelectItem value="galileo">Galileo</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={sortBy} onValueChange={v => setSortBy(v as any)}>
                    <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="price">Sort: Price</SelectItem>
                      <SelectItem value="duration">Sort: Duration</SelectItem>
                      <SelectItem value="stops">Sort: Stops</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {tripType === "multi_city" && uniqueLegs.length > 1 && filterLeg === "all" ? (
                uniqueLegs.map(legIdx => {
                  const legResults = filtered.filter(r => String(r.legIndex ?? 0) === legIdx);
                  const leg = legs[Number(legIdx)];
                  return (
                    <div key={legIdx} className="space-y-2">
                      <div className="flex items-center gap-2 py-1">
                        <Badge variant="secondary" className="font-mono">Leg {Number(legIdx) + 1}</Badge>
                        <span className="text-sm font-semibold">{leg?.origin} <ArrowRight className="inline h-3 w-3" /> {leg?.destination}</span>
                        <span className="text-xs text-muted-foreground">{fmtDate(leg?.departureDate)}</span>
                      </div>
                      {legResults.slice(0, 5).map((r, i) => <FlightCard key={r.id} result={r} idx={i} displayCurrency={displayCurrency} rates={rates} onSelect={handleSelect} />)}
                    </div>
                  );
                })
              ) : (
                filtered.length === 0
                  ? <Card><CardContent className="py-12 text-center text-muted-foreground">No results for this filter.</CardContent></Card>
                  : filtered.map((r, i) => <FlightCard key={r.id} result={r} idx={i} displayCurrency={displayCurrency} rates={rates} onSelect={handleSelect} />)
              )}
            </div>
          )}
        </div>
      )}

      {/* ── GROUP TICKETS ── */}
      {activeTab === "group_tickets" && <GroupTicketsTab />}

      {/* ── QUOTATIONS ── */}
      {activeTab === "quotations" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {["draft", "sent", "booked", "ticketed", "cancelled"].map(s => (
                    <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Checkbox id="hide-past" checked={hidePast} onCheckedChange={v => setHidePast(Boolean(v))} />
                <Label htmlFor="hide-past" className="text-sm cursor-pointer select-none">Hide past flights</Label>
              </div>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />New Quote</Button></DialogTrigger>
              <DialogContent className="sm:max-w-[580px]">
                <DialogHeader><DialogTitle>Create Flight Quotation</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-4 max-h-[70vh] overflow-y-auto">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Client</Label>
                    <Select value={form.clientId} onValueChange={v => setForm(p => ({ ...p, clientId: v }))}>
                      <SelectTrigger className="col-span-3"><SelectValue placeholder="Select client" /></SelectTrigger>
                      <SelectContent>{(clients as any[]).map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  {[["origin", "From (IATA, e.g. LHR)"], ["destination", "To (IATA, e.g. JED)"]].map(([k, ph]) => (
                    <div key={k} className="grid grid-cols-4 items-center gap-4">
                      <Label className="text-right">{k === "origin" ? "From" : "To"}</Label>
                      <Input className="col-span-3" value={(form as any)[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} placeholder={ph} />
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
                    <Label className="text-right">Cabin</Label>
                    <Select value={form.cabinClass} onValueChange={v => setForm(p => ({ ...p, cabinClass: v as FlightQuotationInputCabinClass }))}>
                      <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                      <SelectContent>{FORM_CABIN_CLASSES.map(c => <SelectItem key={c} value={c}>{c.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Airline</Label>
                    <Input className="col-span-3" value={form.airline} onChange={e => setForm(p => ({ ...p, airline: e.target.value }))} placeholder="e.g. Saudia" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Amount</Label>
                    <div className="col-span-3 flex gap-2">
                      <Select value={form.currency} onValueChange={v => setForm(p => ({ ...p, currency: v }))}>
                        <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                        <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                      <Input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="Price" />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button
                    onClick={() => createFlight.mutate({ data: { clientId: Number(form.clientId), origin: form.origin, destination: form.destination, departureDate: form.departureDate, returnDate: form.returnDate || undefined, passengers: Number(form.passengers), cabinClass: form.cabinClass, airline: form.airline || undefined, amount: Number(form.amount), currency: form.currency } })}
                    disabled={!form.clientId || !form.origin || !form.departureDate || !form.amount || createFlight.isPending}
                  >Create</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="pt-4">
              {isLoading ? (
                <div className="h-40 flex items-center justify-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Route</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Pax</TableHead>
                      <TableHead>Cabin</TableHead>
                      <TableHead>Airline</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ticket No.</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(flights as any[]).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center h-32 text-muted-foreground">
                          <Plane className="mx-auto h-8 w-8 mb-2" />
                          {hidePast ? "No upcoming flights · Uncheck 'Hide past flights' to see historical records" : "No quotations · Search fares above and click Select"}
                        </TableCell>
                      </TableRow>
                    ) : (flights as any[]).map((f: any) => (
                      <TableRow key={f.id}>
                        <TableCell className="font-medium">{f.clientName}</TableCell>
                        <TableCell className="text-sm font-mono">{f.origin} → {f.destination}</TableCell>
                        <TableCell className="text-sm">{new Date(f.departureDate).toLocaleDateString()}</TableCell>
                        <TableCell>{f.passengers}</TableCell>
                        <TableCell className="capitalize text-sm">{f.cabinClass}</TableCell>
                        <TableCell className="text-sm">{f.airline || "—"}</TableCell>
                        <TableCell className="font-semibold text-sm">{f.currency} {(f.amount || 0).toLocaleString()}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[f.status] || "bg-gray-100"}`}>{f.status}</span>
                        </TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">{f.ticketNumber || "—"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {f.status === "draft" && (
                              <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => updateFlight.mutate({ id: f.id, data: { status: "sent" } })}>Send</Button>
                            )}
                            {f.status === "sent" && (
                              <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => updateFlight.mutate({ id: f.id, data: { status: "booked" } })}>Book</Button>
                            )}
                            {f.status === "booked" && (
                              <Button size="sm" className="text-xs h-7 bg-emerald-600 hover:bg-emerald-700" onClick={() => { setIssueBookingId(f.id); setIssueOpen(true); }}>
                                <TicketCheck className="h-3 w-3 mr-1" />Issue Ticket
                              </Button>
                            )}
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

      {/* ── ISSUE TICKET DIALOG ── */}
      <Dialog open={issueOpen} onOpenChange={v => { setIssueOpen(v); if (!v) { setIssuePin(""); } }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-emerald-600" />Issue Ticket — Authorisation Required
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              Ticket issuance requires a <strong>ticketing PIN</strong> from an authorised staff member. This action is irreversible.
            </div>
            <div className="space-y-1">
              <Label>Ticketing PIN</Label>
              <Input type="password" value={issuePin} onChange={e => setIssuePin(e.target.value)} placeholder="Enter PIN" maxLength={10} />
            </div>
            <div className="text-xs text-muted-foreground">
              Set ticketing PINs in <strong>Admin → Users</strong>. Only users with "Can Issue Tickets" enabled will work.
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIssueOpen(false)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleIssueTicket} disabled={issuing || !issuePin}>
              {issuing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Issuing…</> : <><TicketCheck className="h-4 w-4 mr-2" />Issue Ticket</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Flight Result Card ────────────────────────────────────────────────────────

function FlightCard({ result, idx, displayCurrency, rates, onSelect }: {
  result: FlightResult; idx: number;
  displayCurrency: string; rates: Record<string, number>;
  onSelect: (r: FlightResult) => void;
}) {
  const converted = convertPrice(result.price, result.currency, displayCurrency, rates);
  const showConverted = displayCurrency !== result.currency;

  return (
    <Card className={`hover:shadow-md transition-shadow ${idx === 0 ? "border-green-300 bg-green-50/30" : ""}`}>
      <CardContent className="py-3 px-4">
        <div className="flex items-center gap-4 justify-between">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="text-center min-w-[52px]">
              <div className="text-lg font-bold leading-tight">{result.airline}</div>
              <div className="text-xs text-muted-foreground truncate max-w-[64px]">{result.airlineName}</div>
              <div className="text-xs text-muted-foreground">{result.flightNumber}</div>
            </div>

            <div className="flex-1 flex items-center gap-2 min-w-0">
              <div className="text-center">
                <div className="text-xl font-bold">{fmtTime(result.departureTime)}</div>
                <div className="text-xs font-mono font-semibold">{result.origin}</div>
              </div>
              <div className="flex-1 text-center min-w-[60px]">
                <div className="text-xs text-muted-foreground flex items-center justify-center gap-0.5">
                  <Clock className="h-3 w-3" />{result.duration}
                </div>
                <div className="flex items-center gap-1 my-0.5">
                  <div className="flex-1 h-px bg-border" />
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <div className="flex-1 h-px bg-border" />
                </div>
                <div className="text-xs">
                  {result.stops === 0 ? <span className="text-green-600 font-medium">Non-stop</span> : <span className="text-amber-600">{result.stops} stop{result.stops > 1 ? "s" : ""}</span>}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold">{fmtTime(result.arrivalTime)}</div>
                <div className="text-xs font-mono font-semibold">{result.destination}</div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <Badge className={`text-xs mb-1 ${SOURCE_BADGE[result.source] || "bg-gray-100"}`}>{result.source}</Badge>
              <div className="text-xl font-bold">
                {displayCurrency} {Math.round(converted).toLocaleString()}
              </div>
              {showConverted && (
                <div className="text-xs text-muted-foreground">{result.currency} {result.price.toLocaleString()}</div>
              )}
              <div className="text-xs text-muted-foreground capitalize">{result.cabinClass.replace("_", " ")}</div>
              {result.seatsAvailable !== null && result.seatsAvailable <= 5 && (
                <div className="text-xs text-orange-600">{result.seatsAvailable} seats left</div>
              )}
              {result.refundable && (
                <div className="text-xs text-green-600 flex items-center gap-1 justify-end">
                  <CheckCircle2 className="h-3 w-3" />Refundable
                </div>
              )}
              {idx === 0 && <div className="text-xs text-green-700 flex items-center gap-1 justify-end"><Star className="h-3 w-3 fill-green-500 stroke-green-500" />Best price</div>}
            </div>
            <Button size="sm" onClick={() => onSelect(result)} className="shrink-0">Select</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
