import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { XCircle, RefreshCcw, Clock, ChevronDown, CheckCircle2, XOctagon, DollarSign } from "lucide-react";

interface FlightQuotation {
  id: number;
  clientName: string;
  airline: string;
  ticketNumber: string;
  pnr: string;
  origin: string;
  destination: string;
  amount: number;
  currency: string;
  status: string;
  issuedAt: string | null;
  issuedByName: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  refundAmount: number | null;
  refundedAt: string | null;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  confirmed: "bg-sky-100 text-sky-700",
  ticketed: "bg-green-100 text-green-700",
  issued: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  refund_pending: "bg-yellow-100 text-yellow-700",
  refund_requested: "bg-orange-100 text-orange-700",
  refund_approved: "bg-teal-100 text-teal-700",
  refund_rejected: "bg-rose-100 text-rose-700",
  refunded: "bg-blue-100 text-blue-700",
};

const STATUS_LABELS: Record<string, string> = {
  refund_pending: "Refund Pending",
  refund_requested: "Refund Requested",
  refund_approved: "Refund Approved",
  refund_rejected: "Refund Rejected",
};

type DialogMode = "cancel" | "refund-request" | "refund-approve" | "refund-reject" | "refund-pay" | "log";

export default function FlightCancellationsPage() {
  const { token, user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const headers = { Authorization: `Bearer ${token}` };

  const [selected, setSelected] = useState<FlightQuotation | null>(null);
  const [mode, setMode] = useState<DialogMode | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [dialogNotes, setDialogNotes] = useState("");

  const isManagement = ["management", "admin"].includes((user as any)?.role ?? "");
  const isAccounts = ["accounts", "management", "admin"].includes((user as any)?.role ?? "");

  const { data: flights = [], isLoading } = useQuery<FlightQuotation[]>({
    queryKey: ["flight-quotations-ops"],
    queryFn: () => fetch("/api/flight-quotations", { headers }).then((r) => r.json()),
    enabled: !!token,
  });

  const { data: events = [] } = useQuery({
    queryKey: ["flight-events", selected?.id, mode],
    queryFn: () => fetch(`/api/flight-quotations/${selected!.id}/events`, { headers }).then((r) => r.json()),
    enabled: !!selected && mode === "log",
  });

  function openDialog(f: FlightQuotation, m: DialogMode) {
    setSelected(f);
    setMode(m);
    setCancelReason("");
    setDialogNotes("");
    if (m === "refund-request" || m === "refund-pay") setRefundAmount(String(f.refundAmount ?? f.amount));
  }
  function closeDialog() { setSelected(null); setMode(null); }

  function apiMutation(url: string, body?: object) {
    return fetch(url, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    }).then(async (r) => {
      if (!r.ok) { const e = await r.json(); throw new Error(e.error ?? "Request failed"); }
      return r.json();
    });
  }

  function makeMutation(successMsg: string) {
    return useMutation({
      mutationFn: (payload: { id: number; body?: object }) =>
        apiMutation(`/api/flight-quotations/${payload.id}/${successMsg.toLowerCase().replace(/ /g, "-")}`, payload.body),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["flight-quotations-ops"] });
        toast({ title: successMsg });
        closeDialog();
      },
      onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    });
  }

  const cancelMut = useMutation({
    mutationFn: ({ id }: { id: number }) =>
      apiMutation(`/api/flight-quotations/${id}/cancel`, { cancelReason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["flight-quotations-ops"] }); toast({ title: "Ticket cancelled" }); closeDialog(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const refundRequestMut = useMutation({
    mutationFn: ({ id }: { id: number }) =>
      apiMutation(`/api/flight-quotations/${id}/refund-request`, { refundAmount: parseFloat(refundAmount), notes: dialogNotes }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["flight-quotations-ops"] }); toast({ title: "Refund requested" }); closeDialog(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const refundApproveMut = useMutation({
    mutationFn: ({ id }: { id: number }) =>
      apiMutation(`/api/flight-quotations/${id}/refund-approve`, { notes: dialogNotes }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["flight-quotations-ops"] }); toast({ title: "Refund approved" }); closeDialog(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const refundRejectMut = useMutation({
    mutationFn: ({ id }: { id: number }) =>
      apiMutation(`/api/flight-quotations/${id}/refund-reject`, { notes: dialogNotes }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["flight-quotations-ops"] }); toast({ title: "Refund rejected" }); closeDialog(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const refundPayMut = useMutation({
    mutationFn: ({ id }: { id: number }) =>
      apiMutation(`/api/flight-quotations/${id}/refund-pay`, { refundAmount: parseFloat(refundAmount), notes: dialogNotes }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["flight-quotations-ops"] }); toast({ title: "Refund paid and journal posted" }); closeDialog(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const opsFlights = flights.filter((f) =>
    ["ticketed", "issued", "cancelled", "refund_pending", "refund_requested", "refund_approved", "refund_rejected", "refunded"].includes(f.status)
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Flight Cancellations & Refunds</h1>
        <p className="text-muted-foreground text-sm mt-1">4-step refund workflow: Request → Approve → Pay. Full audit trail on every ticket.</p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 text-xs">
        {Object.entries(STATUS_LABELS).map(([k, v]) => (
          <span key={k} className={`px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[k]}`}>{v}</span>
        ))}
        <span className="px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700">Refunded</span>
        <span className="px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700">Cancelled</span>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading…</div>
          ) : opsFlights.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No issued tickets found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket / PNR</TableHead>
                  <TableHead>Passenger</TableHead>
                  <TableHead>Airline</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead className="text-right">Fare</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Issued By</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {opsFlights.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell>
                      <div className="font-mono text-sm font-semibold">{f.ticketNumber || "—"}</div>
                      <div className="text-xs text-muted-foreground">{f.pnr || "—"}</div>
                    </TableCell>
                    <TableCell className="font-medium">{f.clientName}</TableCell>
                    <TableCell>{f.airline || "—"}</TableCell>
                    <TableCell className="text-sm">{f.origin} → {f.destination}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {f.amount.toLocaleString()} {f.currency}
                      {f.refundAmount && (
                        <div className="text-xs text-blue-600">Refund: {f.refundAmount.toLocaleString()}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[f.status] ?? "bg-gray-100 text-gray-700"}`}>
                        {STATUS_LABELS[f.status] ?? f.status.replace(/_/g, " ")}
                      </span>
                      {f.cancelReason && (
                        <div className="text-xs text-muted-foreground mt-1 max-w-[120px] truncate" title={f.cancelReason}>
                          {f.cancelReason}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{f.issuedByName || "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end flex-wrap">
                        <Button size="sm" variant="outline" onClick={() => openDialog(f, "log")}>
                          <ChevronDown className="h-3 w-3 mr-1" /> Log
                        </Button>
                        {["ticketed", "issued"].includes(f.status) && (
                          <Button size="sm" variant="outline" className="text-red-600"
                            onClick={() => openDialog(f, "cancel")}>
                            <XCircle className="h-3 w-3 mr-1" /> Cancel
                          </Button>
                        )}
                        {f.status === "cancelled" && (
                          <Button size="sm" variant="outline" className="text-orange-700"
                            onClick={() => openDialog(f, "refund-request")}>
                            <RefreshCcw className="h-3 w-3 mr-1" /> Request Refund
                          </Button>
                        )}
                        {f.status === "refund_requested" && isManagement && (
                          <>
                            <Button size="sm" variant="outline" className="text-teal-700"
                              onClick={() => openDialog(f, "refund-approve")}>
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Approve
                            </Button>
                            <Button size="sm" variant="outline" className="text-rose-700"
                              onClick={() => openDialog(f, "refund-reject")}>
                              <XOctagon className="h-3 w-3 mr-1" /> Reject
                            </Button>
                          </>
                        )}
                        {(f.status === "refund_approved" || f.status === "refund_pending") && isAccounts && (
                          <Button size="sm" onClick={() => openDialog(f, "refund-pay")}>
                            <DollarSign className="h-3 w-3 mr-1" /> Pay Refund
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Cancel Dialog */}
      <Dialog open={mode === "cancel"} onOpenChange={closeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Ticket — {selected?.ticketNumber || `#${selected?.id}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Passenger: <strong>{selected?.clientName}</strong> | Fare: <strong>{selected?.amount?.toLocaleString()} {selected?.currency}</strong>
            </p>
            <div>
              <Label>Cancellation Reason</Label>
              <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Client requested, visa denied…" className="mt-1" />
            </div>
            <p className="text-xs text-muted-foreground">A journal reversal entry will be posted automatically for issued tickets.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Close</Button>
            <Button variant="destructive" onClick={() => cancelMut.mutate({ id: selected!.id })}
              disabled={cancelMut.isPending}>Confirm Cancellation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refund Request Dialog */}
      <Dialog open={mode === "refund-request"} onOpenChange={closeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Refund — {selected?.ticketNumber || `#${selected?.id}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Passenger: <strong>{selected?.clientName}</strong></p>
            <div>
              <Label>Refund Amount ({selected?.currency})</Label>
              <Input type="number" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea value={dialogNotes} onChange={(e) => setDialogNotes(e.target.value)}
                placeholder="Reason for refund request…" className="mt-1" />
            </div>
            <p className="text-xs text-muted-foreground">Refund will require management approval before payment is processed.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Close</Button>
            <Button onClick={() => refundRequestMut.mutate({ id: selected!.id })}
              disabled={refundRequestMut.isPending || !refundAmount}>Submit Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refund Approve Dialog */}
      <Dialog open={mode === "refund-approve"} onOpenChange={closeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Refund — {selected?.ticketNumber || `#${selected?.id}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Passenger: <strong>{selected?.clientName}</strong> | Requested amount: <strong>{selected?.refundAmount?.toLocaleString() ?? "—"} {selected?.currency}</strong>
            </p>
            <div>
              <Label>Approval Notes (optional)</Label>
              <Textarea value={dialogNotes} onChange={(e) => setDialogNotes(e.target.value)} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Close</Button>
            <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => refundApproveMut.mutate({ id: selected!.id })}
              disabled={refundApproveMut.isPending}>Approve Refund</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refund Reject Dialog */}
      <Dialog open={mode === "refund-reject"} onOpenChange={closeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Refund — {selected?.ticketNumber || `#${selected?.id}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Passenger: <strong>{selected?.clientName}</strong></p>
            <div>
              <Label>Rejection Reason</Label>
              <Textarea value={dialogNotes} onChange={(e) => setDialogNotes(e.target.value)}
                placeholder="Reason for rejecting this refund…" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Close</Button>
            <Button variant="destructive" onClick={() => refundRejectMut.mutate({ id: selected!.id })}
              disabled={refundRejectMut.isPending}>Reject Refund</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pay Refund Dialog */}
      <Dialog open={mode === "refund-pay"} onOpenChange={closeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pay Refund — {selected?.ticketNumber || `#${selected?.id}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Passenger: <strong>{selected?.clientName}</strong></p>
            <div>
              <Label>Final Refund Amount ({selected?.currency})</Label>
              <Input type="number" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Payment Notes (optional)</Label>
              <Textarea value={dialogNotes} onChange={(e) => setDialogNotes(e.target.value)} className="mt-1" />
            </div>
            <p className="text-xs text-muted-foreground">A journal entry will post: DR Party / CR MSFR for the refund amount.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Close</Button>
            <Button onClick={() => refundPayMut.mutate({ id: selected!.id })}
              disabled={refundPayMut.isPending || !refundAmount}>Confirm Payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Audit Log / Timeline Dialog */}
      <Dialog open={mode === "log"} onOpenChange={closeDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ticket Timeline — {selected?.ticketNumber || `#${selected?.id}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-0 max-h-96 overflow-y-auto">
            {(events as any[]).length === 0 ? (
              <p className="text-sm text-muted-foreground p-4">No events recorded</p>
            ) : (
              <div className="relative border-l-2 border-border ml-4 pl-4 space-y-4 py-2">
                {(events as any[]).map((ev: any, i: number) => {
                  const evColors: Record<string, string> = {
                    cancelled: "bg-red-500", refunded: "bg-blue-500", refund_requested: "bg-orange-500",
                    refund_approved: "bg-teal-500", refund_rejected: "bg-rose-500", issued: "bg-green-500",
                    created: "bg-gray-400", updated: "bg-gray-400",
                  };
                  return (
                    <div key={ev.id ?? i} className="relative">
                      <div className={`absolute -left-6 top-1 w-3 h-3 rounded-full ${evColors[ev.eventType] ?? "bg-gray-400"}`} />
                      <div className="text-xs text-muted-foreground">{new Date(ev.createdAt).toLocaleString()}</div>
                      <div className="text-sm font-medium capitalize">{(STATUS_LABELS[ev.eventType] ?? ev.eventType?.replace(/_/g, " ")) || "Event"}</div>
                      {ev.statusBefore && ev.statusAfter && (
                        <div className="text-xs text-muted-foreground">
                          {STATUS_LABELS[ev.statusBefore] ?? ev.statusBefore} → {STATUS_LABELS[ev.statusAfter] ?? ev.statusAfter}
                        </div>
                      )}
                      {ev.notes && <div className="text-xs text-muted-foreground italic">{ev.notes}</div>}
                      {ev.userName && <div className="text-xs text-muted-foreground">by {ev.userName}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
