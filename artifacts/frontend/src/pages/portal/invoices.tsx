import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePortalAuth } from "@/lib/portal-auth";
import { PortalLayout, PrintHeader } from "@/components/portal-layout";
import { Printer, FileText } from "lucide-react";

interface Invoice {
  id: number; invoiceNumber: string; amount: string; paidAmount: string;
  currency: string; status: string; dueDate: string; notes: string | null; createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft:     "bg-gray-100 text-gray-600",
  sent:      "bg-blue-50 text-blue-700",
  paid:      "bg-teal-50 text-teal-700",
  partial:   "bg-amber-50 text-amber-700",
  overdue:   "bg-red-50 text-red-700",
  cancelled: "bg-gray-100 text-gray-500",
};

interface WebsiteConfig { company_name?: string; company_logo_url?: string; company_tagline?: string; }

function InvoicePrint({ invoice, config, onClose }: { invoice: Invoice; config?: WebsiteConfig; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-white z-50 overflow-y-auto p-8">
      <div className="max-w-2xl mx-auto">
        <div className="print:hidden flex justify-between items-center mb-6">
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700">← Back</button>
          <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium">
            <Printer className="h-4 w-4" /> Print
          </button>
        </div>

        <PrintHeader config={config} />

        <div className="flex justify-between mb-8">
          <div>
            <p className="text-2xl font-bold text-gray-900">INVOICE</p>
            <p className="text-gray-500 text-sm mt-1">#{invoice.invoiceNumber}</p>
          </div>
          <div className="text-right text-sm">
            <p className="text-gray-500">Date</p>
            <p className="font-medium">{new Date(invoice.createdAt).toLocaleDateString("en-PK")}</p>
            <p className="text-gray-500 mt-2">Due Date</p>
            <p className="font-medium">{new Date(invoice.dueDate).toLocaleDateString("en-PK")}</p>
          </div>
        </div>

        <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Description</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-4 py-4">{invoice.notes ?? "Travel Services"}</td>
                <td className="px-4 py-4 text-right font-medium">{invoice.currency} {Number(invoice.amount).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex justify-end">
          <div className="w-64 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{invoice.currency} {Number(invoice.amount).toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Paid</span><span className="text-teal-600">({invoice.currency} {Number(invoice.paidAmount).toLocaleString()})</span></div>
            <div className="flex justify-between border-t border-gray-200 pt-2 font-bold text-base">
              <span>Balance Due</span>
              <span>{invoice.currency} {(Number(invoice.amount) - Number(invoice.paidAmount)).toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="mt-8 text-xs text-gray-400 text-center border-t border-gray-200 pt-4">
          {config?.company_name} · Customer Invoice
        </div>
      </div>
    </div>
  );
}

export default function PortalInvoicesPage() {
  const { token } = usePortalAuth();
  const [printing, setPrinting] = useState<Invoice | null>(null);

  const { data: configData } = useQuery<WebsiteConfig>({
    queryKey: ["website-config-public"],
    queryFn: () => fetch("/api/website-config").then((r) => r.json()),
    staleTime: 5 * 60_000,
  });

  const { data, isLoading } = useQuery<{ invoices: Invoice[] }>({
    queryKey: ["portal-invoices"],
    queryFn: () => fetch("/api/portal/invoices", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    enabled: !!token,
  });

  if (printing) return <InvoicePrint invoice={printing} config={configData} onClose={() => setPrinting(null)} />;

  return (
    <PortalLayout>
      <div className="space-y-4 max-w-4xl">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Invoices</h1>
          <p className="text-sm text-gray-500">Your billing history</p>
        </div>

        {isLoading && <div className="text-center py-10 text-gray-400 text-sm">Loading…</div>}

        {!isLoading && !data?.invoices.length && (
          <div className="text-center py-12 text-gray-400">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="font-medium">No invoices yet</p>
          </div>
        )}

        {data?.invoices && data.invoices.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["Invoice #", "Date", "Due Date", "Amount", "Paid", "Balance", "Status", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">#{inv.invoiceNumber}</td>
                    <td className="px-4 py-3 text-gray-500">{new Date(inv.createdAt).toLocaleDateString("en-PK")}</td>
                    <td className="px-4 py-3 text-gray-500">{new Date(inv.dueDate).toLocaleDateString("en-PK")}</td>
                    <td className="px-4 py-3">{inv.currency} {Number(inv.amount).toLocaleString()}</td>
                    <td className="px-4 py-3 text-teal-600">{inv.currency} {Number(inv.paidAmount).toLocaleString()}</td>
                    <td className="px-4 py-3 font-semibold">{inv.currency} {(Number(inv.amount) - Number(inv.paidAmount)).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[inv.status] ?? "bg-gray-100"}`}>{inv.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => setPrinting(inv)} className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium">
                        <Printer className="h-3.5 w-3.5" /> Print
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
