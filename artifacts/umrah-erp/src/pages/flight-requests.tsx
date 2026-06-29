import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Search, RefreshCw, Plane, ChevronRight, Users, CheckCircle2, XCircle, MessageSquare,
  Clock, User, Phone, Mail, Ticket, AlertTriangle, CreditCard, ShieldCheck, ExternalLink,
} from "lucide-react";
import { format } from "date-fns";

interface FlightRequest {
  id: number;
  requestNumber: string;
  requestType: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string | null;
  tripType: string;
  origin: string;
  destination: string;
  departureDate: string;
  passengerCount: number;
  cabinClass: string;
  airline: string | null;
  fare: string | null;
  actualFare: number | null;
  bookingFare: number | null;
  status: string;
  holdExpiresAt: string | null;
  paymentDeadlineAt: string | null;
  assignedTo: number | null;
  assignedToName: string | null;
  createdAt: string;
}

interface FlightRequestEvent {
  id: number;
  action: string;
  userName: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
}

interface FlightRequestDetail extends FlightRequest {
  clientWhatsapp: string | null;
  returnDate: string | null;
  adminNotes: string | null;
  flightDataJson: any;
  hasPaymentProof: boolean;
  paymentProofKey: string | null;
  events: FlightRequestEvent[];
}

interface AssignableUser {
  id: number;
  name: string;
  role: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  reviewing: "bg-purple-100 text-purple-800 border-purple-200",
  on_hold: "bg-orange-100 text-orange-800 border-orange-200",
  payment_pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  payment_received: "bg-emerald-100 text-emerald-800 border-emerald-200",
  ready_to_issue: "bg-blue-100 text-blue-800 border-blue-200",
  approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
  issued: "bg-sky-100 text-sky-800 border-sky-200",
  expired: "bg-gray-100 text-gray-500 border-gray-200",
  cancelled: "bg-gray-100 text-gray-600 border-gray-200",
  rejected: "bg-red-100 text-red-800 border-red-200",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  reviewing: "Reviewing",
  on_hold: "On Hold",
  payment_pending: "Payment Pending",
  payment_received: "Payment Received",
  ready_to_issue: "Ready to Issue",
  approved: "Approved",
  issued: "Issued",
  expired: "Expired",
  cancelled: "Cancelled",
  rejected: "Rejected",
};

const ACTION_ICONS: Record<string, React.ReactNode> = {
  created: <CheckCircle2 className="h-3 w-3 text-emerald-500" />,
  on_hold: <Clock className="h-3 w-3 text-orange-500" />,
  approved: <CheckCircle2 className="h-3 w-3 text-emerald-500" />,
  payment_pending: <CreditCard className="h-3 w-3 text-yellow-600" />,
  payment_received: <CheckCircle2 className="h-3 w-3 text-emerald-500" />,
  payment_proof_submitted: <CreditCard className="h-3 w-3 text-blue-500" />,
  ready_to_issue: <ShieldCheck className="h-3 w-3 text-blue-500" />,
  rejected: <XCircle className="h-3 w-3 text-red-500" />,
  noted: <MessageSquare className="h-3 w-3 text-blue-500" />,
  assigned: <User className="h-3 w-3 text-purple-500" />,
  cancelled: <XCircle className="h-3 w-3 text-gray-500" />,
  expired: <AlertTriangle className="h-3 w-3 text-gray-400" />,
  issued: <Ticket className="h-3 w-3 text-sky-500" />,
};

const ALL_STATUSES = [
  "pending", "on_hold", "payment_pending", "payment_received",
  "ready_to_issue", "issued", "expired", "cancelled", "reviewing", "approved", "rejected",
];

const STAT_STATUSES = ["on_hold", "payment_pending", "payment_received", "pending", "issued"];

function formatDate(d: string) {
  try { return format(new Date(d), "dd MMM yyyy, HH:mm"); } catch { return d; }
}

function fmtPKR(n: number | null | undefined) {
  if (n == null) return "—";
  return `PKR ${Number(n).toLocaleString()}`;
}

function holdCountdown(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  const rem = new Date(expiresAt).getTime() - Date.now();
  if (rem <= 0) return "Expired";
  const h = Math.floor(rem / 3_600_000);
  const m = Math.floor((rem % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m remaining`;
  return `${m}m remaining`;
}

export default function FlightRequestsPage() {
  const { token, user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [originFilter, setOriginFilter] = useState("");
  const [destFilter, setDestFilter] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [rejectReason, setRejectReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [assigneeId, setAssigneeId] = useState<string>("");

  const [actualFareInput, setActualFareInput] = useState<string>("");
  const [bookingFareInput, setBookingFareInput] = useState<string>("");

  const [showPinDialog, setShowPinDialog] = useState(false);
  const [pinValue, setPinValue] = useState("");

  async function openReceipt(proofKey: string) {
    try {
      const res = await fetch(`/api/storage/uploads/${encodeURIComponent(proofKey)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Could not load receipt");
      const data = await res.json();
      const url: string = data.url ?? data.signedUrl ?? data.readUrl ?? "";
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toast({ title: "Could not open receipt", description: "Please try again.", variant: "destructive" });
    }
  }

  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (statusFilter !== "all") params.set("status", statusFilter);
  if (originFilter) params.set("origin", originFilter);
  if (destFilter) params.set("destination", destFilter);

  const { data: requests = [], isLoading, refetch } = useQuery<FlightRequest[]>({
    queryKey: ["flight-requests", params.toString(), token],
    queryFn: () =>
      fetch(`/api/flight-requests?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()),
    enabled: !!token,
    refetchInterval: 60_000,
  });

  const { data: detail } = useQuery<FlightRequestDetail>({
    queryKey: ["flight-request", selectedId, token],
    queryFn: () =>
      fetch(`/api/flight-requests/${selectedId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()),
    enabled: !!selectedId && !!token,
  });

  const { data: assignableUsers = [] } = useQuery<AssignableUser[]>({
    queryKey: ["assignable-users", token],
    queryFn: () =>
      fetch("/api/users/assignable", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    enabled: !!token,
  });

  useEffect(() => {
    if (detail) {
      setActualFareInput(detail.actualFare != null ? String(detail.actualFare) : "");
      setBookingFareInput(detail.bookingFare != null ? String(detail.bookingFare) : "");
    }
  }, [detail?.id]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["flight-requests"] });
    qc.invalidateQueries({ queryKey: ["flight-request", selectedId, token] });
    qc.invalidateQueries({ queryKey: ["flight-requests-count"] });
  };

  const patchMutation = useMutation({
    mutationFn: (body: Record<string, any>) =>
      fetch(`/api/flight-requests/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      invalidate();
      toast({ title: "Updated" });
      setShowRejectInput(false);
      setRejectReason("");
    },
    onError: () => toast({ title: "Error", description: "Failed to update", variant: "destructive" }),
  });

  const issueTicketMutation = useMutation({
    mutationFn: (body: { pin: string }) =>
      fetch(`/api/flight-requests/${selectedId}/issue-ticket`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      }).then(async (r) => {
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          throw new Error((d as any).error ?? "Failed to issue ticket");
        }
        return r.json();
      }),
    onSuccess: () => {
      invalidate();
      toast({ title: "Ticket Issued!" });
      setShowPinDialog(false);
      setPinValue("");
    },
    onError: (err: any) =>
      toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const eventMutation = useMutation({
    mutationFn: (body: Record<string, any>) =>
      fetch(`/api/flight-requests/${selectedId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["flight-request", selectedId, token] });
      toast({ title: "Note added" });
      setNoteText("");
      setShowNoteInput(false);
    },
  });

  const selected = detail;

  function handleCancel() { patchMutation.mutate({ status: "cancelled" }); }
  function handleMarkExpired() { patchMutation.mutate({ status: "expired" }); }
  function handleApprove() { patchMutation.mutate({ status: "approved" }); }
  function handleMarkIssued() { patchMutation.mutate({ status: "issued" }); }

  function handleReject() {
    if (!rejectReason.trim()) return;
    patchMutation.mutate({ status: "rejected", adminNotes: rejectReason });
  }

  function handleConfirmHold() {
    patchMutation.mutate({ status: "payment_pending" });
  }

  function handleMarkPaymentReceived() {
    patchMutation.mutate({ status: "payment_received" });
  }

  function handleMarkReadyToIssue() {
    patchMutation.mutate({ status: "ready_to_issue" });
  }

  function handleAssign() {
    if (!assigneeId) return;
    patchMutation.mutate({ assignedTo: Number(assigneeId) });
  }

  function handleAddNote() {
    if (!noteText.trim()) return;
    eventMutation.mutate({ action: "noted", metadata: { note: noteText } });
  }

  function handleSaveFares() {
    patchMutation.mutate({
      actualFare: actualFareInput ? Number(actualFareInput) : null,
      bookingFare: bookingFareInput ? Number(bookingFareInput) : null,
    });
  }

  function handleIssueWithPin() {
    if (!pinValue.trim()) return;
    issueTicketMutation.mutate({ pin: pinValue });
  }

  const markup = (actualFareInput && bookingFareInput)
    ? Number(bookingFareInput) - Number(actualFareInput)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Flight Requests</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Public flight booking requests — manual review and issuance
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-1.5" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="relative col-span-2 md:col-span-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Name / phone / ref…"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="on_hold">On Hold</SelectItem>
            <SelectItem value="payment_pending">Payment Pending</SelectItem>
            <SelectItem value="payment_received">Payment Received</SelectItem>
            <SelectItem value="ready_to_issue">Ready to Issue</SelectItem>
            <SelectItem value="issued">Issued</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="Origin (e.g. KHI)"
          value={originFilter}
          onChange={(e) => setOriginFilter(e.target.value.toUpperCase())}
        />
        <Input
          placeholder="Destination (e.g. JED)"
          value={destFilter}
          onChange={(e) => setDestFilter(e.target.value.toUpperCase())}
        />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
        {STAT_STATUSES.map((s) => {
          const count = requests.filter((r) => r.status === s).length;
          return (
            <div
              key={s}
              className="rounded-xl border bg-card p-3 text-center cursor-pointer hover:bg-accent/30 transition-colors"
              onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}
            >
              <div className="text-2xl font-bold">{count}</div>
              <div className="text-xs text-muted-foreground">{STATUS_LABELS[s] ?? s}</div>
            </div>
          );
        })}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground">Loading…</div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
          <Plane className="h-8 w-8 opacity-30" />
          <p>No flight requests found</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Request #</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Client</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Route</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Travel Date</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Pax</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Fares</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Hold</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {requests.map((r) => (
                <tr
                  key={r.id}
                  className="hover:bg-accent/20 transition-colors cursor-pointer"
                  onClick={() => setSelectedId(r.id)}
                >
                  <td className="px-4 py-3 font-mono text-xs text-primary">{r.requestNumber}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.clientName}</div>
                    <div className="text-xs text-muted-foreground">{r.clientPhone}</div>
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {r.origin} → {r.destination}
                    <div className="text-xs text-muted-foreground capitalize">{r.tripType.replace("_", " ")}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">{r.departureDate}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3 w-3 text-muted-foreground" />
                      {r.passengerCount}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.bookingFare != null ? (
                      <div>
                        <span className="font-medium text-primary">{fmtPKR(r.bookingFare)}</span>
                        {r.actualFare != null && (
                          <span className="text-muted-foreground ml-1 text-[10px]">(cost {fmtPKR(r.actualFare)})</span>
                        )}
                      </div>
                    ) : r.fare ? (
                      <div className="text-muted-foreground">{r.fare}</div>
                    ) : (
                      <div className="text-muted-foreground">—</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[r.status] ?? "bg-gray-100 text-gray-700"}`}>
                      {STATUS_LABELS[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {r.status === "on_hold" && r.holdExpiresAt
                      ? holdCountdown(r.holdExpiresAt)
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      <Dialog open={!!selectedId} onOpenChange={(open) => {
        if (!open) {
          setSelectedId(null);
          setShowRejectInput(false);
          setShowNoteInput(false);
          setShowPinDialog(false);
          setPinValue("");
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plane className="h-5 w-5 text-primary" />
              Flight Request — {selected?.requestNumber ?? ""}
            </DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-5 mt-2">
              {/* Status + hold info */}
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium ${STATUS_COLORS[selected.status] ?? "bg-gray-100 text-gray-700"}`}>
                  {STATUS_LABELS[selected.status] ?? selected.status}
                </span>
                <span className="text-xs text-muted-foreground">
                  Received {formatDate(selected.createdAt)}
                </span>
                {selected.status === "on_hold" && selected.holdExpiresAt && (
                  <span className="text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {holdCountdown(selected.holdExpiresAt)}
                  </span>
                )}
                {selected.hasPaymentProof && (
                  <button
                    onClick={() => selected.paymentProofKey && openReceipt(selected.paymentProofKey)}
                    className="text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5 flex items-center gap-1 hover:bg-blue-100 transition-colors cursor-pointer"
                    title="Click to view receipt"
                  >
                    <CreditCard className="h-3 w-3" />
                    Receipt uploaded
                    <ExternalLink className="h-2.5 w-2.5 opacity-70" />
                  </button>
                )}
              </div>

              {/* Client info */}
              <div className="rounded-lg border p-4 space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Client</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" />{selected.clientName}</div>
                  <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{selected.clientPhone}</div>
                  {selected.clientEmail && <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" />{selected.clientEmail}</div>}
                  {selected.clientWhatsapp && <div className="flex items-center gap-2"><MessageSquare className="h-4 w-4 text-muted-foreground" />WA: {selected.clientWhatsapp}</div>}
                </div>
              </div>

              {/* Flight info */}
              <div className="rounded-lg border p-4 space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Flight Details</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <Label className="text-xs text-muted-foreground">Route</Label>
                    <p className="font-semibold">{selected.origin} → {selected.destination}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Trip Type</Label>
                    <p className="capitalize">{selected.tripType.replace("_", " ")}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Departure</Label>
                    <p>{selected.departureDate}</p>
                  </div>
                  {selected.returnDate && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Return</Label>
                      <p>{selected.returnDate}</p>
                    </div>
                  )}
                  <div>
                    <Label className="text-xs text-muted-foreground">Passengers</Label>
                    <p>{selected.passengerCount}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Cabin</Label>
                    <p className="capitalize">{selected.cabinClass}</p>
                  </div>
                  {selected.airline && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Airline / Flight#</Label>
                      <p>{selected.airline}</p>
                    </div>
                  )}
                  <div>
                    <Label className="text-xs text-muted-foreground">Type</Label>
                    <p className="capitalize">{selected.requestType}</p>
                  </div>
                </div>
                {selected.holdExpiresAt && (
                  <div className="flex items-center gap-2 text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 mt-1">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    Hold expires: {formatDate(selected.holdExpiresAt)}
                  </div>
                )}
                {selected.paymentDeadlineAt && (
                  <div className="flex items-center gap-2 text-xs text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                    <CreditCard className="h-3.5 w-3.5 shrink-0" />
                    Payment deadline: {formatDate(selected.paymentDeadlineAt)}
                  </div>
                )}
                {selected.flightDataJson && (
                  <details className="mt-2">
                    <summary className="text-xs text-muted-foreground cursor-pointer">GDS flight data snapshot</summary>
                    <pre className="text-xs bg-muted rounded p-2 mt-1 overflow-auto max-h-32">
                      {JSON.stringify(selected.flightDataJson, null, 2)}
                    </pre>
                  </details>
                )}
              </div>

              {/* Pricing */}
              <div className="rounded-lg border p-4 space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Pricing (PKR)</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1">Actual Fare (Cost)</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={actualFareInput}
                      onChange={(e) => setActualFareInput(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1">Booking Fare (Client Price)</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={bookingFareInput}
                      onChange={(e) => setBookingFareInput(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                {markup != null && (
                  <p className={`text-xs font-medium ${markup >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                    Markup: PKR {markup.toLocaleString()}
                  </p>
                )}
                <Button size="sm" variant="outline" onClick={handleSaveFares} disabled={patchMutation.isPending}>
                  Save Fares
                </Button>
              </div>

              {/* Admin notes */}
              {selected.adminNotes && (
                <div className="rounded-lg border p-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Admin Notes</h3>
                  <p className="text-sm">{selected.adminNotes}</p>
                </div>
              )}

              {/* Assign agent */}
              <div className="rounded-lg border p-4 space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Assign Agent</h3>
                <div className="flex gap-2">
                  <Select value={assigneeId} onValueChange={setAssigneeId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder={selected.assignedToName ?? "Select agent…"} />
                    </SelectTrigger>
                    <SelectContent>
                      {assignableUsers.map((u) => (
                        <SelectItem key={u.id} value={String(u.id)}>
                          {u.name} ({u.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" onClick={handleAssign} disabled={!assigneeId || patchMutation.isPending}>
                    Assign
                  </Button>
                </div>
                {selected.assignedToName && (
                  <p className="text-xs text-muted-foreground">Currently: {selected.assignedToName}</p>
                )}
              </div>

              {/* ── STATUS-SPECIFIC ACTIONS ── */}

              {/* Pending (manual enquiry) */}
              {selected.status === "pending" && (
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={handleApprove}
                      disabled={patchMutation.isPending}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1.5" />
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={() => setShowRejectInput(true)}
                      disabled={patchMutation.isPending}
                    >
                      <XCircle className="h-4 w-4 mr-1.5" />
                      Reject
                    </Button>
                  </div>
                  {showRejectInput && (
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Rejection reason…"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" variant="destructive" onClick={handleReject} disabled={!rejectReason.trim()}>
                          Confirm Reject
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setShowRejectInput(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* On Hold — confirm hold, move to payment pending */}
              {selected.status === "on_hold" && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Customer is waiting for payment instructions. Confirming hold sets a payment deadline automatically.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white"
                      onClick={handleConfirmHold}
                      disabled={patchMutation.isPending}
                    >
                      <CreditCard className="h-4 w-4 mr-1.5" />
                      Confirm Hold → Send Payment Instructions
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleMarkExpired}
                      disabled={patchMutation.isPending}
                      size="sm"
                    >
                      Expire Hold
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full text-destructive hover:text-destructive"
                    onClick={handleCancel}
                    disabled={patchMutation.isPending}
                  >
                    <XCircle className="h-4 w-4 mr-1.5" />
                    Cancel Booking
                  </Button>
                </div>
              )}

              {/* Payment Pending — waiting for customer to pay */}
              {selected.status === "payment_pending" && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    {selected.hasPaymentProof
                      ? "Customer has uploaded a payment receipt. Verify and mark as received."
                      : "Waiting for customer to complete payment."}
                  </p>
                  {selected.hasPaymentProof && (
                    <button
                      onClick={() => selected.paymentProofKey && openReceipt(selected.paymentProofKey)}
                      className="w-full bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-800 flex items-center gap-2 hover:bg-blue-100 transition-colors text-left"
                      title="Click to view receipt"
                    >
                      <CreditCard className="h-3.5 w-3.5 shrink-0" />
                      <span className="flex-1">Payment receipt uploaded by customer — click to view</span>
                      <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
                    </button>
                  )}
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={handleMarkPaymentReceived}
                      disabled={patchMutation.isPending}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1.5" />
                      Mark Payment Received
                    </Button>
                    <Button
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      onClick={handleCancel}
                      disabled={patchMutation.isPending}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {/* Payment Received — ready to confirm for issuance */}
              {selected.status === "payment_received" && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Payment has been confirmed. Mark as ready to issue when all details are verified.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={handleMarkReadyToIssue}
                      disabled={patchMutation.isPending}
                    >
                      <ShieldCheck className="h-4 w-4 mr-1.5" />
                      Mark Ready to Issue
                    </Button>
                    <Button
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      onClick={handleCancel}
                      disabled={patchMutation.isPending}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {/* Ready to Issue — PIN-protected issuance */}
              {selected.status === "ready_to_issue" && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    This booking is ready for ticket issuance. Issuance requires your ticketing PIN.
                  </p>
                  {!showPinDialog ? (
                    <div className="flex gap-2">
                      <Button
                        className="flex-1 bg-sky-600 hover:bg-sky-700 text-white"
                        onClick={() => setShowPinDialog(true)}
                      >
                        <Ticket className="h-4 w-4 mr-1.5" />
                        Issue Ticket (PIN Required)
                      </Button>
                      <Button
                        variant="outline"
                        className="text-destructive hover:text-destructive"
                        onClick={handleCancel}
                        disabled={patchMutation.isPending}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3 rounded-lg border border-sky-200 bg-sky-50 p-4">
                      <p className="text-sm font-medium text-sky-800">Enter your ticketing PIN to issue this ticket</p>
                      <Input
                        type="password"
                        placeholder="Enter PIN…"
                        value={pinValue}
                        onChange={(e) => setPinValue(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleIssueWithPin()}
                        className="w-full"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Button
                          className="bg-sky-600 hover:bg-sky-700 text-white"
                          onClick={handleIssueWithPin}
                          disabled={!pinValue.trim() || issueTicketMutation.isPending}
                        >
                          {issueTicketMutation.isPending ? "Issuing…" : "Confirm Issue"}
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => { setShowPinDialog(false); setPinValue(""); }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Approved (legacy manual flow) */}
              {selected.status === "approved" && (
                <div className="flex gap-2">
                  <Button
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={handleMarkIssued}
                    disabled={patchMutation.isPending}
                  >
                    <Ticket className="h-4 w-4 mr-1.5" />
                    Mark as Issued
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={handleCancel}
                    disabled={patchMutation.isPending}
                  >
                    <XCircle className="h-4 w-4 mr-1.5" />
                    Cancel
                  </Button>
                </div>
              )}

              {/* Add note */}
              <div className="space-y-2">
                {!showNoteInput ? (
                  <Button size="sm" variant="outline" onClick={() => setShowNoteInput(true)}>
                    <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                    Add Note
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Internal note…"
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleAddNote} disabled={!noteText.trim() || eventMutation.isPending}>
                        Save Note
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowNoteInput(false)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Activity Timeline */}
              {selected.events && selected.events.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Activity</h3>
                  <div className="space-y-2">
                    {[...selected.events].reverse().map((e) => (
                      <div key={e.id} className="flex items-start gap-2 text-xs">
                        <span className="mt-0.5">
                          {ACTION_ICONS[e.action] ?? <Clock className="h-3 w-3 text-muted-foreground" />}
                        </span>
                        <div>
                          <span className="font-medium capitalize">{(e.action ?? "").replace(/_/g, " ")}</span>
                          {e.userName && <span className="text-muted-foreground"> by {e.userName}</span>}
                          {e.metadata?.note && (
                            <p className="text-muted-foreground italic mt-0.5">"{e.metadata.note}"</p>
                          )}
                          {e.metadata?.reason && (
                            <p className="text-muted-foreground italic mt-0.5">Reason: {e.metadata.reason}</p>
                          )}
                          <p className="text-muted-foreground/60">{formatDate(e.createdAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
