import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Eye, ChevronDown, Check, X } from "lucide-react";

interface BookingInquiry {
  id: number;
  referenceNumber: string;
  ticketId: number;
  userType: string;
  status: string;
  notes: string | null;
  createdAt: string;
}

interface InquiryDetail {
  id: number;
  referenceNumber: string;
  status: string;
  userType: string;
  notes: string | null;
  passengers: any[];
  ticket: any;
  paymentReceipt: any;
}

const STATUS_OPTIONS = ["new", "pending_review", "confirmed", "cancelled"];
const STATUS_LABELS: Record<string, string> = {
  new: "New", pending_review: "Under Review", confirmed: "Confirmed", cancelled: "Cancelled",
};
const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-50 text-blue-700", pending_review: "bg-amber-50 text-amber-700",
  confirmed: "bg-teal-50 text-teal-700", cancelled: "bg-red-50 text-red-700",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status] ?? "bg-gray-100 text-gray-600"}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function DetailModal({ inquiryId, onClose, token }: { inquiryId: number; onClose: () => void; token: string }) {
  const qc = useQueryClient();
  const [notes, setNotes] = useState("");

  const { data, isLoading } = useQuery<InquiryDetail>({
    queryKey: ["booking-inquiry", inquiryId],
    queryFn: () =>
      fetch(`/api/booking-inquiries/${inquiryId}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) =>
      fetch(`/api/booking-inquiries/${inquiryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status, notes: notes || undefined }),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["booking-inquiries"] });
      qc.invalidateQueries({ queryKey: ["booking-inquiry", inquiryId] });
    },
  });

  const verifyReceipt = useMutation({
    mutationFn: ({ receiptId, status }: { receiptId: number; status: string }) =>
      fetch(`/api/payment-receipts/${receiptId}/verify`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["booking-inquiry", inquiryId] }),
  });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-lg">Booking Details</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading…</div>
        ) : data ? (
          <div className="p-6 space-y-6">
            {/* Header info */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-muted-foreground">Reference</p><p className="font-mono font-bold">{data.referenceNumber}</p></div>
              <div><p className="text-muted-foreground">Account Type</p><p className="font-medium capitalize">{data.userType}</p></div>
              {data.ticket && (
                <>
                  <div><p className="text-muted-foreground">Flight</p><p className="font-medium">{data.ticket.flightNumber} · {data.ticket.origin}→{data.ticket.destination}</p></div>
                  <div><p className="text-muted-foreground">Date</p><p className="font-medium">{data.ticket.flightDate}</p></div>
                </>
              )}
            </div>

            {/* Passengers */}
            {data.passengers?.length > 0 && (
              <div>
                <h3 className="font-semibold text-sm mb-3">Passengers ({data.passengers.length})</h3>
                <div className="space-y-2">
                  {data.passengers.map((p: any) => (
                    <div key={p.id} className="bg-stone-50 rounded-xl p-3 text-sm">
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{p.title} {p.firstName} {p.lastName}</span>
                        <span className="text-xs text-muted-foreground capitalize">{p.passengerType}</span>
                        {p.scanStatus === "done" && <span className="text-xs text-teal-600">✓ OCR done</span>}
                      </div>
                      {p.docNumber && <p className="text-xs text-muted-foreground mt-1">Passport: {p.docNumber} · Exp: {p.docExpiry}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Payment receipt */}
            {data.paymentReceipt && (
              <div className="border border-border rounded-xl p-4">
                <h3 className="font-semibold text-sm mb-3">Payment Receipt</h3>
                <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                  <div><p className="text-muted-foreground">Deadline</p><p className="font-medium">{new Date(data.paymentReceipt.deadlineAt).toLocaleString()}</p></div>
                  <div><p className="text-muted-foreground">Tier</p><p className="font-medium">{data.paymentReceipt.deadlineTier}</p></div>
                  <div><p className="text-muted-foreground">Status</p><StatusBadge status={data.paymentReceipt.paymentStatus} /></div>
                </div>
                {data.paymentReceipt.paymentStatus === "receipt_uploaded" && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => verifyReceipt.mutate({ receiptId: data.paymentReceipt.id, status: "payment_verified" })}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition"
                    >
                      <Check className="h-4 w-4" /> Verify
                    </button>
                    <button
                      onClick={() => verifyReceipt.mutate({ receiptId: data.paymentReceipt.id, status: "payment_rejected" })}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-destructive text-destructive text-sm font-medium hover:bg-red-50 transition"
                    >
                      <X className="h-4 w-4" /> Reject
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Status update */}
            <div>
              <h3 className="font-semibold text-sm mb-3">Update Status</h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {STATUS_OPTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => updateStatus.mutate(s)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition ${data.status === s ? "bg-teal-600 text-white border-teal-600" : "border-border text-muted-foreground hover:border-teal-400"}`}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes…"
                rows={2}
                className="w-full px-3 py-2 rounded-xl border border-border text-sm focus:ring-2 focus:ring-teal-500/40 focus:outline-none resize-none"
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function BookingInquiriesPage() {
  const { token } = useAuth();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: inquiries = [], isLoading } = useQuery<BookingInquiry[]>({
    queryKey: ["booking-inquiries", token],
    queryFn: () =>
      fetch("/api/booking-inquiries", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    enabled: !!token,
    refetchInterval: 30_000,
  });

  const filtered = statusFilter === "all" ? inquiries : inquiries.filter((i) => i.status === statusFilter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Booking Inquiries</h1>
          <p className="text-muted-foreground text-sm mt-1">Flight booking requests from the public website</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none pl-4 pr-8 py-2 rounded-xl border border-border text-sm bg-white focus:outline-none"
            >
              <option value="all">All Status</option>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">No booking inquiries yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-stone-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reference</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((inquiry) => (
                <tr key={inquiry.id} className="hover:bg-stone-50 transition">
                  <td className="px-4 py-3 font-mono font-medium">{inquiry.referenceNumber}</td>
                  <td className="px-4 py-3 capitalize text-muted-foreground">{inquiry.userType}</td>
                  <td className="px-4 py-3"><StatusBadge status={inquiry.status} /></td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(inquiry.createdAt).toLocaleDateString("en-PK")}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => setSelectedId(inquiry.id)} className="flex items-center gap-1 text-teal-600 hover:text-teal-700 font-medium text-xs">
                      <Eye className="h-4 w-4" /> View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedId !== null && (
        <DetailModal inquiryId={selectedId} onClose={() => setSelectedId(null)} token={token!} />
      )}
    </div>
  );
}
