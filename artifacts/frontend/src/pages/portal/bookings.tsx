import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePortalAuth } from "@/lib/portal-auth";
import { PortalLayout } from "@/components/portal-layout";
import { Upload, Clock, Check, XCircle, ChevronDown, ChevronUp } from "lucide-react";

interface Passenger {
  id: number; firstName: string; lastName: string; title: string;
  passengerType: string; nationality: string | null; docNumber: string | null;
}

interface PaymentReceipt {
  id: number; paymentStatus: string; deadlineAt: string; objectKey: string | null; uploadedAt: string | null;
}

interface Booking {
  id: number; referenceNumber: string; status: string; createdAt: string;
  passengers: Passenger[]; paymentReceipt: PaymentReceipt | null;
}

const STATUS_COLORS: Record<string, string> = {
  new:            "bg-blue-50 text-blue-700",
  pending_review: "bg-amber-50 text-amber-700",
  confirmed:      "bg-teal-50 text-teal-700",
  cancelled:      "bg-red-50 text-red-700",
};

const PAYMENT_COLORS: Record<string, string> = {
  pending_receipt:   "bg-amber-50 text-amber-700",
  receipt_uploaded:  "bg-blue-50 text-blue-700",
  payment_verified:  "bg-teal-50 text-teal-700",
  payment_rejected:  "bg-red-50 text-red-700",
  expired:           "bg-gray-100 text-gray-500",
};

function StatusBadge({ status, map }: { status: string; map: Record<string, string> }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${map[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function DeadlineCountdown({ deadlineAt }: { deadlineAt: string }) {
  const diff = new Date(deadlineAt).getTime() - Date.now();
  if (diff <= 0) return <span className="text-xs text-red-500">Deadline passed</span>;
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return <span className={`text-xs font-medium flex items-center gap-1 ${diff < 3_600_000 ? "text-red-500" : "text-amber-600"}`}><Clock className="h-3 w-3" />{h > 0 ? `${h}h ${m}m` : `${m}m`} left</span>;
}

function BookingCard({ booking, token }: { booking: Booking; token: string }) {
  const [expanded, setExpanded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const qc = useQueryClient();

  const upload = useMutation({
    mutationFn: async (file: File) => {
      setUploading(true);
      const fd = new FormData(); fd.append("file", file);
      const stored = await fetch("/api/storage/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd }).then((r) => r.json());
      await fetch(`/api/booking-inquiries/${booking.id}/receipt`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ objectKey: stored.key }),
      });
      setUploading(false);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portal-bookings"] }),
    onError: () => setUploading(false),
  });

  const r = booking.paymentReceipt;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between gap-3" onClick={() => setExpanded((e) => !e)}>
        <div className="flex items-center gap-3 min-w-0">
          <div>
            <p className="text-sm font-semibold">#{booking.referenceNumber}</p>
            <p className="text-xs text-gray-400">{new Date(booking.createdAt).toLocaleDateString("en-PK")}</p>
          </div>
          <StatusBadge status={booking.status} map={STATUS_COLORS} />
          {r && <StatusBadge status={r.paymentStatus} map={PAYMENT_COLORS} />}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {r?.paymentStatus === "pending_receipt" && <DeadlineCountdown deadlineAt={r.deadlineAt} />}
          <button className="text-gray-400">{expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-3">
          {booking.passengers.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Passengers</p>
              <div className="space-y-1">
                {booking.passengers.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 text-sm">
                    <span className="text-gray-400 text-xs">{p.title}</span>
                    <span className="font-medium">{p.firstName} {p.lastName}</span>
                    {p.nationality && <span className="text-gray-400 text-xs">· {p.nationality}</span>}
                    {p.docNumber && <span className="text-gray-400 text-xs">· {p.docNumber}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {r && (
            <div className="bg-amber-50 rounded-lg p-3">
              <p className="text-xs font-semibold text-amber-700 mb-1">Payment Receipt</p>
              {r.paymentStatus === "pending_receipt" && (
                <div className="space-y-2">
                  <p className="text-xs text-amber-600">Deadline: {new Date(r.deadlineAt).toLocaleString("en-PK")}</p>
                  <label className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-amber-300 text-sm font-medium text-amber-700 cursor-pointer hover:bg-amber-50 transition w-fit ${uploading ? "opacity-60 pointer-events-none" : ""}`}>
                    <Upload className="h-4 w-4" />
                    {uploading ? "Uploading…" : "Upload Receipt"}
                    <input type="file" className="hidden" accept="image/*,.pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); }} />
                  </label>
                </div>
              )}
              {r.paymentStatus === "receipt_uploaded" && (
                <p className="text-xs text-blue-600 flex items-center gap-1"><Clock className="h-3 w-3" /> Receipt uploaded — awaiting verification</p>
              )}
              {r.paymentStatus === "payment_verified" && (
                <p className="text-xs text-teal-600 flex items-center gap-1"><Check className="h-3 w-3" /> Payment verified</p>
              )}
              {r.paymentStatus === "payment_rejected" && (
                <p className="text-xs text-red-600 flex items-center gap-1"><XCircle className="h-3 w-3" /> Payment rejected — please contact support</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PortalBookingsPage() {
  const { token } = usePortalAuth();

  const { data, isLoading } = useQuery<{ bookings: Booking[] }>({
    queryKey: ["portal-bookings"],
    queryFn: () => fetch("/api/portal/bookings", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    enabled: !!token,
  });

  return (
    <PortalLayout>
      <div className="space-y-4 max-w-2xl">
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Bookings</h1>
          <p className="text-sm text-gray-500">All your flight booking inquiries</p>
        </div>

        {isLoading && <div className="text-center py-10 text-gray-400 text-sm">Loading…</div>}

        {!isLoading && !data?.bookings.length && (
          <div className="text-center py-12 text-gray-400">
            <p className="font-medium">No bookings yet</p>
            <p className="text-sm mt-1">Book a flight to get started</p>
          </div>
        )}

        {data?.bookings.map((b) => (
          <BookingCard key={b.id} booking={b} token={token!} />
        ))}
      </div>
    </PortalLayout>
  );
}
