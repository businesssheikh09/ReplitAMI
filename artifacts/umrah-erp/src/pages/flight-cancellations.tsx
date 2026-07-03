import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { XCircle, RefreshCcw, Clock, ChevronDown } from "lucide-react";

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
  ticketed: "bg-green-100 text-green-700",
  issued: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  refund_pending: "bg-yellow-100 text-yellow-700",
  refunded: "bg-blue-100 text-blue-700",
};

export default function FlightCancellationsPage() {
  const { token } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const headers = { Authorization: `Bearer ${token}` };

  const [cancelDialog, setCancelDialog] = useState<FlightQuotation | null>(null);
  const [refundDialog, setRefundDialog] = useState<FlightQuotation | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [eventsDialog, setEventsDialog] = useState<FlightQuotation | null>(null);

  const { data: flights = [], isLoading } = useQuery<FlightQuotation[]>({
    queryKey: ["flight-quotations-ops"],
    queryFn: () => fetch("/api/flight-quotations", { headers }).then((r) => r.json()),
    enabled: !!token,
  });

  const { data: events = [] } = useQuery({
    queryKey: ["flight-events", eventsDialog?.id],
    queryFn: () =>
      fetch(`/api/flight-quotations/${eventsDialog!.id}/events`, { headers }).then((r) => r.json()),
    enabled: !!eventsDialog,
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/flight-quotations/${id}/cancel`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ cancelReason }),
      }).then(async (r) => { if (!r.ok) { const e = await r.json(); throw new Error(e.error); } return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["flight-quotations-ops"] });
      toast({ title: "Ticket cancelled" });
      setCancelDialog(null);
      setCancelReason("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const refundPendingMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/flight-quotations/${id}/refund-pending`, {
        method: "POST",
        headers,
      }).then(async (r) => { if (!r.ok) { const e = await r.json(); throw new Error(e.error); } return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["flight-quotations-ops"] });
      toast({ title: "Marked as refund pending" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const refundMutation = useMutation({
    mutationFn: ({ id, amount }: { id: number; amount: number }) =>
      fetch(`/api/flight-quotations/${id}/refund`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ refundAmount: amount }),
      }).then(async (r) => { if (!r.ok) { const e = await r.json(); throw new Error(e.error); } return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["flight-quotations-ops"] });
      toast({ title: "Refund processed and journal posted" });
      setRefundDialog(null);
      setRefundAmount("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const opsFlights = flights.filter((f) =>
    ["ticketed", "issued", "cancelled", "refund_pending", "refunded"].includes(f.status)
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Flight Cancellations & Refunds</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage ticket cancellations, refund processing, and journal entries</p>
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
                        {f.status.replace(/_/g, " ")}
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
                        <Button size="sm" variant="outline" onClick={() => setEventsDialog(f)}>
                          <ChevronDown className="h-3 w-3 mr-1" /> Log
                        </Button>
                        {["ticketed", "issued"].includes(f.status) && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600"
                            onClick={() => { setCancelDialog(f); setCancelReason(""); }}
                          >
                            <XCircle className="h-3 w-3 mr-1" /> Cancel
                          </Button>
                        )}
                        {f.status === "cancelled" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-yellow-700"
                            onClick={() => refundPendingMutation.mutate(f.id)}
                            disabled={refundPendingMutation.isPending}
                          >
                            <Clock className="h-3 w-3 mr-1" /> Pending
                          </Button>
                        )}
                        {["cancelled", "refund_pending"].includes(f.status) && (
                          <Button
                            size="sm"
                            onClick={() => { setRefundDialog(f); setRefundAmount(String(f.amount)); }}
                          >
                            <RefreshCcw className="h-3 w-3 mr-1" /> Refund
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
      <Dialog open={!!cancelDialog} onOpenChange={() => setCancelDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Ticket — {cancelDialog?.ticketNumber || `#${cancelDialog?.id}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Passenger: <strong>{cancelDialog?.clientName}</strong> |{" "}
              Fare: <strong>{cancelDialog?.amount?.toLocaleString()} {cancelDialog?.currency}</strong>
            </p>
            <div>
              <Label>Cancellation Reason</Label>
              <Textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Client requested, visa denied, schedule change…"
                className="mt-1"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              A journal reversal entry will be posted automatically for issued tickets.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialog(null)}>Close</Button>
            <Button
              variant="destructive"
              onClick={() => cancelMutation.mutate(cancelDialog!.id)}
              disabled={cancelMutation.isPending}
            >
              Confirm Cancellation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refund Dialog */}
      <Dialog open={!!refundDialog} onOpenChange={() => setRefundDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Refund — {refundDialog?.ticketNumber || `#${refundDialog?.id}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Passenger: <strong>{refundDialog?.clientName}</strong>
            </p>
            <div>
              <Label>Refund Amount ({refundDialog?.currency})</Label>
              <Input
                type="number"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                className="mt-1"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              A journal entry will post: DR Party / CR MSFR for the refund amount.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundDialog(null)}>Close</Button>
            <Button
              onClick={() => refundMutation.mutate({ id: refundDialog!.id, amount: parseFloat(refundAmount) })}
              disabled={refundMutation.isPending || !refundAmount}
            >
              Confirm Refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Events / Audit Log Dialog */}
      <Dialog open={!!eventsDialog} onOpenChange={() => setEventsDialog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ticket Audit Log — {eventsDialog?.ticketNumber || `#${eventsDialog?.id}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {(events as any[]).length === 0 ? (
              <p className="text-sm text-muted-foreground">No events recorded</p>
            ) : (
              (events as any[]).map((ev: any) => (
                <div key={ev.id} className="flex gap-3 text-sm border-b pb-2">
                  <div className="w-32 text-xs text-muted-foreground shrink-0">
                    {new Date(ev.createdAt).toLocaleString()}
                  </div>
                  <div>
                    <span className="font-medium capitalize">{ev.eventType.replace(/_/g, " ")}</span>
                    {ev.statusBefore && ev.statusAfter && (
                      <span className="text-muted-foreground ml-2 text-xs">
                        {ev.statusBefore} → {ev.statusAfter}
                      </span>
                    )}
                    {ev.notes && <div className="text-muted-foreground">{ev.notes}</div>}
                    {ev.userName && <div className="text-xs text-muted-foreground">by {ev.userName}</div>}
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
