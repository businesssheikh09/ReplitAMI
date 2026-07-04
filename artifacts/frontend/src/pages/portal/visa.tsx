import { useQuery } from "@tanstack/react-query";
import { usePortalAuth } from "@/lib/portal-auth";
import { PortalLayout } from "@/components/portal-layout";
import { Globe } from "lucide-react";

interface VisaApplication {
  id: number; passportNumber: string; nationality: string; passportExpiry: string | null;
  status: string; submittedAt: string | null; approvedAt: string | null;
  rejectionReason: string | null; notes: string | null; createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  documents_required: "bg-amber-50 text-amber-700",
  submitted:          "bg-blue-50 text-blue-700",
  processing:         "bg-purple-50 text-purple-700",
  approved:           "bg-teal-50 text-teal-700",
  rejected:           "bg-red-50 text-red-700",
};

const STATUS_LABELS: Record<string, string> = {
  documents_required: "Documents Required",
  submitted:          "Submitted",
  processing:         "Under Processing",
  approved:           "Approved ✓",
  rejected:           "Rejected",
};

export default function PortalVisaPage() {
  const { token } = usePortalAuth();

  const { data, isLoading } = useQuery<{ applications: VisaApplication[] }>({
    queryKey: ["portal-visa"],
    queryFn: () => fetch("/api/portal/visa-status", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    enabled: !!token,
  });

  return (
    <PortalLayout>
      <div className="space-y-4 max-w-3xl">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Visa Status</h1>
          <p className="text-sm text-gray-500">Track your visa application progress</p>
        </div>

        {isLoading && <div className="text-center py-10 text-gray-400 text-sm">Loading…</div>}

        {!isLoading && !data?.applications.length && (
          <div className="text-center py-12 text-gray-400">
            <Globe className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="font-medium">No visa applications</p>
            <p className="text-sm mt-1">Applications appear once your ERP account is linked</p>
          </div>
        )}

        <div className="space-y-3">
          {data?.applications.map((a) => (
            <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{a.nationality}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[a.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {STATUS_LABELS[a.status] ?? a.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">Passport: {a.passportNumber}</p>
                  {a.passportExpiry && (
                    <p className="text-xs text-gray-400">Expiry: {new Date(a.passportExpiry).toLocaleDateString("en-PK")}</p>
                  )}
                </div>
                <div className="text-right text-xs text-gray-400">
                  <p>Applied: {new Date(a.createdAt).toLocaleDateString("en-PK")}</p>
                  {a.submittedAt && <p>Submitted: {new Date(a.submittedAt).toLocaleDateString("en-PK")}</p>}
                  {a.approvedAt && <p>Approved: {new Date(a.approvedAt).toLocaleDateString("en-PK")}</p>}
                </div>
              </div>

              {a.notes && (
                <div className="mt-3 bg-blue-50 rounded-lg p-3 text-sm text-blue-800">
                  <p className="font-semibold text-xs mb-1">Processing Notes</p>
                  <p>{a.notes}</p>
                </div>
              )}

              {a.rejectionReason && (
                <div className="mt-3 bg-red-50 rounded-lg p-3 text-sm text-red-700">
                  <p className="font-semibold text-xs mb-1">Rejection Reason</p>
                  <p>{a.rejectionReason}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </PortalLayout>
  );
}
