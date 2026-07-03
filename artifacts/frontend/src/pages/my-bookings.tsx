import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, Clock, Check, XCircle, Upload, Loader2, LogOut, AlertCircle } from "lucide-react";
import { useState } from "react";
import { usePortalAuth } from "@/lib/portal-auth";

interface PaymentReceipt {
  id: number;
  deadlineAt: string;
  deadlineTier: string;
  paymentStatus: string;
  objectKey: string | null;
  uploadedAt: string | null;
}

interface BookingInquiry {
  id: number;
  referenceNumber: string;
  status: string;
  ticketId: number;
  createdAt: string;
  paymentReceipt: PaymentReceipt | null;
}

function DeadlineCountdown({ deadlineAt }: { deadlineAt: string }) {
  const deadline = new Date(deadlineAt);
  const now = new Date();
  const diffMs = deadline.getTime() - now.getTime();

  if (diffMs <= 0) return <span className="text-xs text-destructive font-medium">Deadline passed</span>;

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  const urgent = diffMs < 60 * 60 * 1000; // < 1 hour
  return (
    <span className={`text-xs font-medium flex items-center gap-1 ${urgent ? "text-destructive" : "text-amber-600"}`}>
      <Clock className="h-3 w-3" />
      {hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`} remaining
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    new: { label: "New", cls: "bg-blue-50 text-blue-700" },
    pending_review: { label: "Under Review", cls: "bg-amber-50 text-amber-700" },
    confirmed: { label: "Confirmed", cls: "bg-teal-50 text-teal-700" },
    cancelled: { label: "Cancelled", cls: "bg-red-50 text-red-700" },
    pending_receipt: { label: "Awaiting Payment", cls: "bg-amber-50 text-amber-700" },
    receipt_uploaded: { label: "Receipt Uploaded", cls: "bg-blue-50 text-blue-700" },
    payment_verified: { label: "Payment Verified", cls: "bg-teal-50 text-teal-700" },
    payment_rejected: { label: "Payment Rejected", cls: "bg-red-50 text-red-700" },
    expired: { label: "Expired", cls: "bg-gray-50 text-gray-500" },
  };
  const s = map[status] ?? { label: status, cls: "bg-gray-50 text-gray-700" };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>{s.label}</span>;
}

export default function MyBookingsPage() {
  const [, navigate] = useLocation();
  const { user, token, isAuthenticated, logout } = usePortalAuth();
  const qc = useQueryClient();
  const [uploading, setUploading] = useState<number | null>(null);

  const { data: bookings = [], isLoading } = useQuery<BookingInquiry[]>({
    queryKey: ["my-bookings", token],
    queryFn: async () => {
      const r = await fetch("/api/public/booking-inquiries/mine", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.status === 401) {
        logout();
        navigate("/portal-login");
        return [];
      }
      return r.json();
    },
    enabled: isAuthenticated,
  });

  const uploadReceipt = async (inquiry: BookingInquiry, file: File) => {
    if (!inquiry.paymentReceipt) return;
    setUploading(inquiry.id);
    try {
      const uploadRes = await fetch("/api/storage/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      const { uploadURL, objectPath } = await uploadRes.json();
      await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });

      await fetch("/api/public/payment-receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ inquiryId: inquiry.id, objectKey: objectPath }),
      });

      await qc.invalidateQueries({ queryKey: ["my-bookings"] });
    } catch {
      // ignore
    } finally {
      setUploading(null);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-stone-50 px-4 text-center">
        <AlertCircle className="h-10 w-10 text-muted-foreground" />
        <h2 className="text-xl font-serif">Sign in to view your bookings</h2>
        <button onClick={() => navigate("/portal-login")} className="px-6 py-3 rounded-xl bg-teal-600 text-white font-medium text-sm hover:bg-teal-700 transition">
          Sign In
        </button>
        <button onClick={() => navigate("/")} className="text-sm text-muted-foreground hover:underline">← Back to home</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <div className="bg-white border-b border-border sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center gap-4">
          <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-sm text-foreground">My Bookings</h1>
            <p className="text-xs text-muted-foreground">{user?.fullName} · {user?.type?.toUpperCase()}</p>
          </div>
          <button
            onClick={() => { logout(); navigate("/"); }}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition"
          >
            <LogOut className="h-4 w-4" /> Sign Out
          </button>
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-6 py-8 max-w-3xl">
        {isLoading && (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
          </div>
        )}

        {!isLoading && bookings.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg mb-4">No bookings yet.</p>
            <button onClick={() => navigate("/#group-tickets")} className="text-teal-600 hover:underline text-sm">
              Browse group tickets →
            </button>
          </div>
        )}

        <div className="space-y-4">
          {bookings.map((booking) => {
            const receipt = booking.paymentReceipt;
            const deadlinePassed = receipt ? new Date(receipt.deadlineAt) < new Date() : false;

            return (
              <div key={booking.id} className="bg-white rounded-2xl border border-border p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="font-mono text-sm font-bold text-foreground">{booking.referenceNumber}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(booking.createdAt).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <StatusBadge status={booking.status} />
                </div>

                {receipt && user?.type === "party" && (
                  <div className={`mt-4 rounded-xl p-4 border ${deadlinePassed ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"}`}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-semibold">Payment Deadline</p>
                      <StatusBadge status={receipt.paymentStatus} />
                    </div>

                    <p className="text-xs text-muted-foreground mb-2">
                      {new Date(receipt.deadlineAt).toLocaleString("en-PK")}
                    </p>

                    {!deadlinePassed && <DeadlineCountdown deadlineAt={receipt.deadlineAt} />}

                    {receipt.paymentStatus === "pending_receipt" && !deadlinePassed && (
                      <div className="mt-3">
                        <label className="flex items-center gap-2 px-4 py-2.5 w-fit rounded-xl border border-amber-300 bg-white text-sm text-amber-800 font-medium hover:bg-amber-50 transition cursor-pointer">
                          {uploading === booking.id ? (
                            <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</>
                          ) : (
                            <><Upload className="h-4 w-4" /> Upload Payment Receipt</>
                          )}
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            className="hidden"
                            disabled={uploading === booking.id}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) uploadReceipt(booking, f);
                            }}
                          />
                        </label>
                      </div>
                    )}

                    {receipt.paymentStatus === "receipt_uploaded" && (
                      <div className="mt-3 flex items-center gap-2 text-sm text-blue-700">
                        <Check className="h-4 w-4" /> Receipt received — pending verification
                      </div>
                    )}

                    {receipt.paymentStatus === "payment_verified" && (
                      <div className="mt-3 flex items-center gap-2 text-sm text-teal-700">
                        <Check className="h-4 w-4" /> Payment verified!
                      </div>
                    )}

                    {receipt.paymentStatus === "payment_rejected" && (
                      <div className="mt-3 flex items-center gap-2 text-sm text-destructive">
                        <XCircle className="h-4 w-4" /> Payment rejected — please contact us
                      </div>
                    )}

                    {deadlinePassed && receipt.paymentStatus === "pending_receipt" && (
                      <div className="mt-3 flex items-center gap-2 text-sm text-destructive">
                        <XCircle className="h-4 w-4" /> Deadline passed — please contact us to re-book
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
