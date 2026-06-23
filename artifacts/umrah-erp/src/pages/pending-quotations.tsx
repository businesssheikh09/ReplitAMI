import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Eye, ChevronDown, X, ArrowRight, Loader2 } from "lucide-react";

interface PackageInquiry {
  id: number;
  referenceNumber: string;
  departureDate: string;
  returnDate: string | null;
  adults: number;
  children: number;
  infants: number;
  totalPax: number;
  contactName: string;
  contactPhone: string;
  transportType: string | null;
  notes: string | null;
  status: string;
  quotationId: number | null;
  createdAt: string;
}

interface Client {
  id: number;
  name: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  quoted: "Quoted",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
};
const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  quoted: "bg-blue-50 text-blue-700",
  confirmed: "bg-teal-50 text-teal-700",
  cancelled: "bg-red-50 text-red-700",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status] ?? "bg-gray-100 text-gray-600"}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function ConvertModal({ inquiry, onClose, token }: { inquiry: PackageInquiry; onClose: () => void; token: string }) {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [clientId, setClientId] = useState("");

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["clients-for-convert"],
    queryFn: () =>
      fetch("/api/clients", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
  });

  const convert = useMutation({
    mutationFn: async () => {
      const title = `Custom Package – ${inquiry.contactName}`;
      const validUntil = new Date(Date.now() + 30 * 86400_000).toISOString().split("T")[0];
      const notes = `Converted from package inquiry ${inquiry.referenceNumber}. Contact: ${inquiry.contactPhone}. Departure: ${inquiry.departureDate}. Pax: ${inquiry.adults}A ${inquiry.children}C ${inquiry.infants}I.`;

      const qRes = await fetch("/api/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ clientId: Number(clientId), title, validUntil, currency: "USD", notes }),
      });
      if (!qRes.ok) throw new Error("Failed to create quotation");
      const q = await qRes.json();

      await fetch(`/api/package-inquiries/${inquiry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: "quoted", quotationId: q.id }),
      });
      return q.id as number;
    },
    onSuccess: (quotationId) => {
      qc.invalidateQueries({ queryKey: ["package-inquiries"] });
      qc.invalidateQueries({ queryKey: ["package-inquiries-count"] });
      navigate(`/quotations/${quotationId}`);
    },
  });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Convert to Quotation</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        <div className="bg-stone-50 rounded-xl px-4 py-3 text-sm space-y-1">
          <p><span className="text-muted-foreground">Reference:</span> <span className="font-mono font-bold">{inquiry.referenceNumber}</span></p>
          <p><span className="text-muted-foreground">Contact:</span> {inquiry.contactName} · {inquiry.contactPhone}</p>
          <p><span className="text-muted-foreground">Departure:</span> {inquiry.departureDate}</p>
          <p><span className="text-muted-foreground">Pax:</span> {inquiry.adults}A {inquiry.children}C {inquiry.infants}I</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Assign to Client <span className="text-destructive">*</span></label>
          <div className="relative">
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full appearance-none pl-4 pr-8 py-3 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40 bg-white"
            >
              <option value="">Select a client…</option>
              {(clients as Client[]).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            A draft quotation titled "Custom Package – {inquiry.contactName}" will be created. You can edit all details on the next screen.
          </p>
        </div>

        {convert.isError && (
          <p className="text-sm text-destructive">{convert.error instanceof Error ? convert.error.message : "Conversion failed"}</p>
        )}

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:border-gray-400 transition">Cancel</button>
          <button
            onClick={() => convert.mutate()}
            disabled={!clientId || convert.isPending}
            className="px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2 transition"
          >
            {convert.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            Create Quotation
          </button>
        </div>
      </div>
    </div>
  );
}

function InquiryModal({ inquiry, onClose, token, onConvert }: { inquiry: PackageInquiry; onClose: () => void; token: string; onConvert: () => void }) {
  const qc = useQueryClient();
  const [notes, setNotes] = useState(inquiry.notes ?? "");

  const { data: detail } = useQuery({
    queryKey: ["package-inquiry", inquiry.id],
    queryFn: () =>
      fetch(`/api/package-inquiries/${inquiry.id}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) =>
      fetch(`/api/package-inquiries/${inquiry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status, notes }),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["package-inquiries"] });
      qc.invalidateQueries({ queryKey: ["package-inquiries-count"] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-xl w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-lg">Package Inquiry</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-6 space-y-5 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div><p className="text-muted-foreground">Reference</p><p className="font-mono font-bold">{inquiry.referenceNumber}</p></div>
            <div><p className="text-muted-foreground">Status</p><StatusBadge status={inquiry.status} /></div>
            <div><p className="text-muted-foreground">Contact</p><p className="font-medium">{inquiry.contactName}</p></div>
            <div><p className="text-muted-foreground">Phone</p><p className="font-medium">{inquiry.contactPhone}</p></div>
            <div><p className="text-muted-foreground">Departure</p><p className="font-medium">{inquiry.departureDate}</p></div>
            {inquiry.returnDate && <div><p className="text-muted-foreground">Return</p><p className="font-medium">{inquiry.returnDate}</p></div>}
            <div><p className="text-muted-foreground">Pax</p><p className="font-medium">{inquiry.adults}A {inquiry.children}C {inquiry.infants}I = {inquiry.totalPax} total</p></div>
            {inquiry.transportType && <div><p className="text-muted-foreground">Transport</p><p className="font-medium capitalize">{inquiry.transportType.replace(/_/g, " ")}</p></div>}
          </div>

          {detail?.hotels && (
            <div>
              <p className="text-muted-foreground mb-2">Hotels</p>
              <div className="space-y-1">
                {detail.hotels.makkah && (
                  <div className="bg-stone-50 rounded-lg px-3 py-2">
                    Makkah: <strong>{detail.hotels.makkah.name}</strong>
                    {detail.hotels.makkah.stars ? ` (${detail.hotels.makkah.stars}★)` : ""}
                    {detail.hotels.makkah.distanceFromHaram ? ` · ${detail.hotels.makkah.distanceFromHaram}` : ""}
                  </div>
                )}
                {detail.hotels.madinah && (
                  <div className="bg-stone-50 rounded-lg px-3 py-2">
                    Madinah: <strong>{detail.hotels.madinah.name}</strong>
                    {detail.hotels.madinah.stars ? ` (${detail.hotels.madinah.stars}★)` : ""}
                    {detail.hotels.madinah.distanceFromHaram ? ` · ${detail.hotels.madinah.distanceFromHaram}` : ""}
                  </div>
                )}
              </div>
            </div>
          )}

          {inquiry.quotationId && (
            <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 text-teal-800 text-sm">
              Linked to Quotation #{inquiry.quotationId}
            </div>
          )}

          <div>
            <p className="text-muted-foreground mb-2">Internal Notes</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-xl border border-border text-sm focus:ring-2 focus:ring-teal-500/40 focus:outline-none resize-none"
              placeholder="Add notes or quotation details…"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            {["pending", "quoted", "confirmed", "cancelled"].map((s) => (
              <button
                key={s}
                onClick={() => updateStatus.mutate(s)}
                disabled={updateStatus.isPending}
                className={`px-4 py-2 rounded-xl text-xs font-medium border transition ${inquiry.status === s ? "bg-teal-600 text-white border-teal-600" : "border-border text-muted-foreground hover:border-teal-400"}`}
              >
                Mark as {STATUS_LABELS[s]}
              </button>
            ))}
          </div>

          {!inquiry.quotationId && (
            <button
              onClick={() => { onClose(); onConvert(); }}
              className="w-full py-3 rounded-2xl bg-teal-600 text-white font-semibold text-sm hover:bg-teal-700 flex items-center justify-center gap-2 transition"
            >
              <ArrowRight className="h-4 w-4" />
              Convert to Quotation
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PendingQuotationsPage() {
  const { token } = useAuth();
  const [selected, setSelected] = useState<PackageInquiry | null>(null);
  const [converting, setConverting] = useState<PackageInquiry | null>(null);
  const [statusFilter, setStatusFilter] = useState("pending");

  const { data: inquiries = [], isLoading } = useQuery<PackageInquiry[]>({
    queryKey: ["package-inquiries", token, statusFilter],
    queryFn: () =>
      fetch(`/api/package-inquiries?status=${statusFilter}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    enabled: !!token,
    refetchInterval: 60_000,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Package Inquiries</h1>
          <p className="text-muted-foreground text-sm mt-1">Customise-package requests from the public website</p>
        </div>
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="appearance-none pl-4 pr-8 py-2 rounded-xl border border-border text-sm bg-white focus:outline-none"
          >
            <option value="all">All</option>
            {Object.entries(STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading…</div>
        ) : inquiries.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">No inquiries for this status.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-stone-50">
              <tr>
                {["Reference", "Contact", "Departure", "Pax", "Status", "Received", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {inquiries.map((inq) => (
                <tr key={inq.id} className="hover:bg-stone-50 transition">
                  <td className="px-4 py-3">
                    <span className="font-mono font-medium">{inq.referenceNumber}</span>
                    {inq.quotationId && (
                      <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium bg-teal-50 text-teal-700 border border-teal-200">Converted</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{inq.contactName}</p>
                    <p className="text-xs text-muted-foreground">{inq.contactPhone}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{inq.departureDate}</td>
                  <td className="px-4 py-3 text-muted-foreground">{inq.totalPax}</td>
                  <td className="px-4 py-3"><StatusBadge status={inq.status} /></td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(inq.createdAt).toLocaleDateString("en-PK")}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setSelected(inq)}
                        className="flex items-center gap-1 text-teal-600 hover:text-teal-700 font-medium text-xs"
                      >
                        <Eye className="h-4 w-4" /> View
                      </button>
                      {!inq.quotationId && (
                        <button
                          onClick={() => setConverting(inq)}
                          className="flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-medium text-xs"
                        >
                          <ArrowRight className="h-3.5 w-3.5" /> Convert
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <InquiryModal
          inquiry={selected}
          onClose={() => setSelected(null)}
          token={token!}
          onConvert={() => setConverting(selected)}
        />
      )}
      {converting && (
        <ConvertModal inquiry={converting} onClose={() => setConverting(null)} token={token!} />
      )}
    </div>
  );
}
