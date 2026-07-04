import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePortalAuth } from "@/lib/portal-auth";
import { PortalLayout } from "@/components/portal-layout";
import { Check, Clock, XCircle, Upload, CreditCard, AlertCircle } from "lucide-react";
import { useState } from "react";

interface PaymentReceipt {
  id: number; inquiryId: number; paymentStatus: string; deadlineAt: string;
  deadlineTier: string; objectKey: string | null; uploadedAt: string | null;
  verifiedAt: string | null; rejectionReason: string | null; createdAt: string;
}

const STATUS_ICON: Record<string, React.ElementType> = {
  pending_receipt:  Clock,
  receipt_uploaded: Clock,
  payment_verified: Check,
  payment_rejected: XCircle,
  expired:          XCircle,
};

const STATUS_COLOR: Record<string, string> = {
  pending_receipt:  "text-amber-500",
  receipt_uploaded: "text-blue-500",
  payment_verified: "text-teal-500",
  payment_rejected: "text-red-500",
  expired:          "text-gray-400",
};

const STATUS_LABEL: Record<string, string> = {
  pending_receipt:  "Awaiting Receipt",
  receipt_uploaded: "Receipt Uploaded — Pending Verification",
  payment_verified: "Payment Verified ✓",
  payment_rejected: "Payment Rejected",
  expired:          "Expired",
};

async function uploadReceiptFile(file: File, token: string): Promise<string> {
  const urlRes = await fetch("/api/storage/uploads/request-url", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
  });
  if (!urlRes.ok) throw new Error("Failed to get upload URL");
  const { uploadURL, objectPath } = await urlRes.json();

  const putRes = await fetch(uploadURL, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!putRes.ok) throw new Error("Failed to upload file");

  return objectPath;
}

export default function PortalPaymentsPage() {
  const { token } = usePortalAuth();
  const qc = useQueryClient();
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [uploadErrors, setUploadErrors] = useState<Record<number, string>>({});

  const { data, isLoading } = useQuery<{ payments: PaymentReceipt[] }>({
    queryKey: ["portal-payments"],
    queryFn: () => fetch("/api/portal/payments", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    enabled: !!token,
  });

  const upload = useMutation({
    mutationFn: async ({ inquiryId, file }: { inquiryId: number; file: File }) => {
      setUploadingId(inquiryId);
      setUploadErrors((prev) => ({ ...prev, [inquiryId]: "" }));
      try {
        const objectKey = await uploadReceiptFile(file, token!);
        const res = await fetch("/api/public/payment-receipts", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ inquiryId, objectKey }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to submit receipt");
      } finally {
        setUploadingId(null);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portal-payments"] }),
    onError: (err: Error, vars) => {
      setUploadErrors((prev) => ({ ...prev, [vars.inquiryId]: err.message }));
    },
  });

  return (
    <PortalLayout>
      <div className="space-y-4 max-w-2xl">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Payments</h1>
          <p className="text-sm text-gray-500">Payment receipt history and uploads</p>
        </div>

        {isLoading && <div className="text-center py-10 text-gray-400 text-sm">Loading…</div>}

        {!isLoading && !data?.payments.length && (
          <div className="text-center py-12 text-gray-400">
            <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="font-medium">No payment records</p>
          </div>
        )}

        <div className="space-y-3">
          {data?.payments.map((p) => {
            const Icon = STATUS_ICON[p.paymentStatus] ?? Clock;
            const color = STATUS_COLOR[p.paymentStatus] ?? "text-gray-400";
            const errMsg = uploadErrors[p.inquiryId];

            return (
              <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start gap-3">
                  <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{STATUS_LABEL[p.paymentStatus] ?? p.paymentStatus.replace(/_/g, " ")}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Booking #{p.inquiryId} · {p.deadlineTier} tier</p>
                    <div className="flex gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                      <span>Deadline: {new Date(p.deadlineAt).toLocaleString("en-PK", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                      {p.uploadedAt && <span>Uploaded: {new Date(p.uploadedAt).toLocaleDateString("en-PK")}</span>}
                      {p.verifiedAt && <span>Verified: {new Date(p.verifiedAt).toLocaleDateString("en-PK")}</span>}
                    </div>

                    {p.rejectionReason && (
                      <div className="mt-2 bg-red-50 rounded-lg px-3 py-2 text-xs text-red-700">{p.rejectionReason}</div>
                    )}

                    {p.objectKey && (
                      <a
                        href={`/api/storage/objects/${p.objectKey}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs text-teal-600 hover:underline"
                      >
                        View receipt
                      </a>
                    )}

                    {p.paymentStatus === "pending_receipt" && (
                      <div className="mt-2 space-y-1">
                        {errMsg && (
                          <p className="flex items-center gap-1 text-xs text-red-600"><AlertCircle className="h-3 w-3" />{errMsg}</p>
                        )}
                        <label className={`flex items-center gap-2 w-fit px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-xs font-medium text-amber-700 cursor-pointer hover:bg-amber-100 transition ${uploadingId === p.inquiryId ? "opacity-60 pointer-events-none" : ""}`}>
                          <Upload className="h-3.5 w-3.5" />
                          {uploadingId === p.inquiryId ? "Uploading…" : "Upload Receipt"}
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*,.pdf"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) upload.mutate({ inquiryId: p.inquiryId, file: f });
                            }}
                          />
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </PortalLayout>
  );
}
