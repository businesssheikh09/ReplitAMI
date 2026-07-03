import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Eye, ChevronDown, X, Check, UserCheck, UserX } from "lucide-react";

interface PortalUser {
  id: number;
  type: string;
  status: string;
  fullName: string;
  email: string | null;
  phone: string;
  whatsapp: string | null;
  companyName: string | null;
  ownerName: string | null;
  createdAt: string;
  password: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  pending_approval: "Pending", active: "Active", suspended: "Suspended", rejected: "Rejected",
};
const STATUS_COLORS: Record<string, string> = {
  pending_approval: "bg-amber-50 text-amber-700",
  active: "bg-teal-50 text-teal-700",
  suspended: "bg-orange-50 text-orange-700",
  rejected: "bg-red-50 text-red-700",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status] ?? "bg-gray-100 text-gray-600"}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function UserDetailModal({ userId, onClose, token }: { userId: number; onClose: () => void; token: string }) {
  const qc = useQueryClient();
  const [rejectionReason, setRejectionReason] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["portal-user", userId],
    queryFn: () => fetch(`/api/portal/users/${userId}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) =>
      fetch(`/api/portal/users/${userId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status, rejectionReason: rejectionReason || undefined }),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portal-users"] });
      qc.invalidateQueries({ queryKey: ["portal-user", userId] });
    },
  });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-xl w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-lg">Portal User</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading…</div>
        ) : data ? (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-muted-foreground">Name</p><p className="font-semibold">{data.fullName}</p></div>
              <div><p className="text-muted-foreground">Type</p><p className="font-medium capitalize">{data.type}</p></div>
              <div><p className="text-muted-foreground">Phone</p><p className="font-medium">{data.phone}</p></div>
              <div><p className="text-muted-foreground">Email</p><p className="font-medium">{data.email ?? "—"}</p></div>
              {data.companyName && <div><p className="text-muted-foreground">Company</p><p className="font-medium">{data.companyName}</p></div>}
              {data.dtsNumber && <div><p className="text-muted-foreground">DTS #</p><p className="font-medium">{data.dtsNumber}</p></div>}
              {data.ownerName && <div><p className="text-muted-foreground">Owner</p><p className="font-medium">{data.ownerName}</p></div>}
              <div><p className="text-muted-foreground">Status</p><StatusBadge status={data.status} /></div>
              <div><p className="text-muted-foreground">Registered</p><p className="font-medium">{new Date(data.createdAt).toLocaleDateString("en-PK")}</p></div>
            </div>

            {data.documents?.length > 0 && (
              <div>
                <h3 className="font-semibold text-sm mb-2">Documents</h3>
                <div className="space-y-2">
                  {data.documents.map((doc: any) => (
                    <div key={doc.id} className="flex items-center justify-between bg-stone-50 rounded-xl p-3 text-sm">
                      <span className="capitalize text-muted-foreground">{doc.documentType.replace(/_/g, " ")}</span>
                      <a href={`/api/storage/objects/${doc.objectKey}`} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline text-xs">View</a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="font-semibold text-sm mb-3">Actions</h3>
              {data.status === "pending_approval" && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateStatus.mutate("active")}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition"
                    >
                      <UserCheck className="h-4 w-4" /> Approve
                    </button>
                    <button
                      onClick={() => updateStatus.mutate("rejected")}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-destructive text-destructive text-sm font-medium hover:bg-red-50 transition"
                    >
                      <UserX className="h-4 w-4" /> Reject
                    </button>
                  </div>
                  <input
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Rejection reason (required for reject)"
                    className="w-full px-3 py-2 rounded-xl border border-border text-sm focus:ring-2 focus:ring-teal-500/40 focus:outline-none"
                  />
                </div>
              )}
              {data.status === "active" && (
                <button
                  onClick={() => updateStatus.mutate("suspended")}
                  className="px-4 py-2 rounded-xl border border-orange-400 text-orange-700 text-sm font-medium hover:bg-orange-50 transition"
                >
                  Suspend Account
                </button>
              )}
              {data.status === "suspended" && (
                <button
                  onClick={() => updateStatus.mutate("active")}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition"
                >
                  <Check className="h-4 w-4" /> Reactivate
                </button>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function PortalUsersPage() {
  const { token, user: currentUser } = useAuth();
  const isManagement = currentUser?.role === "management" || currentUser?.role === "admin";
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: users = [], isLoading } = useQuery<PortalUser[]>({
    queryKey: ["portal-users", token],
    queryFn: () =>
      fetch("/api/portal/users", { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.ok ? r.json() : []),
    enabled: !!token,
    refetchInterval: 30_000,
  });

  const pendingCount = users.filter((u) => u.status === "pending_approval").length;

  const filtered = users.filter((u) => {
    const matchType = typeFilter === "all" || u.type === typeFilter;
    const matchStatus = statusFilter === "all" || u.status === statusFilter;
    return matchType && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Portal Users</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Party agencies and Direct Customers
            {pendingCount > 0 && <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">{pendingCount} pending</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {[
            { value: typeFilter, setter: setTypeFilter, options: [["all", "All Types"], ["party", "Party"], ["dc", "DC"]] },
            { value: statusFilter, setter: setStatusFilter, options: [["all", "All Status"], ...Object.entries(STATUS_LABELS)] },
          ].map(({ value, setter, options }, i) => (
            <div key={i} className="relative">
              <select
                value={value as string}
                onChange={(e) => (setter as any)(e.target.value)}
                className="appearance-none pl-4 pr-8 py-2 rounded-xl border border-border text-sm bg-white focus:outline-none"
              >
                {(options as [string, string][]).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">No portal users yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-stone-50">
              <tr>
                {["Name", "Type", "Phone", "Email", "Company", "Status", ...(isManagement ? ["Password"] : []), "Joined", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((user) => (
                <tr key={user.id} className={`hover:bg-stone-50 transition ${user.status === "pending_approval" ? "bg-amber-50/30" : ""}`}>
                  <td className="px-4 py-3 font-medium">{user.fullName}</td>
                  <td className="px-4 py-3"><span className="capitalize text-muted-foreground">{user.type}</span></td>
                  <td className="px-4 py-3 text-muted-foreground">{user.phone}</td>
                  <td className="px-4 py-3 text-muted-foreground">{user.email ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{user.companyName ?? "—"}</td>
                  <td className="px-4 py-3"><StatusBadge status={user.status} /></td>
                  {isManagement && (
                    <td className="px-4 py-3">
                      <span className="text-xs text-muted-foreground">••••••</span>
                    </td>
                  )}
                  <td className="px-4 py-3 text-muted-foreground">{new Date(user.createdAt).toLocaleDateString("en-PK")}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => setSelectedId(user.id)} className="flex items-center gap-1 text-teal-600 hover:text-teal-700 font-medium text-xs">
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
        <UserDetailModal userId={selectedId} onClose={() => setSelectedId(null)} token={token!} />
      )}
    </div>
  );
}
