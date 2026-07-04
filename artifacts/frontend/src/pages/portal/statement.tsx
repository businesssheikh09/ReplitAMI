import { useQuery } from "@tanstack/react-query";
import { usePortalAuth } from "@/lib/portal-auth";
import { PortalLayout } from "@/components/portal-layout";
import { Download, BookOpen } from "lucide-react";

interface Entry {
  id: number; date: string; voucherNumber: string; type: string;
  narration: string; debit: string; credit: string; balance: string;
}

function downloadCSV(entries: Entry[], closingBalance: string) {
  const header = "Date,Voucher #,Type,Narration,Debit,Credit,Balance\n";
  const rows = entries.map((e) =>
    `${e.date},${e.voucherNumber},${e.type},"${e.narration.replace(/"/g, '""')}",${e.debit},${e.credit},${e.balance}`
  ).join("\n");
  const blob = new Blob([header + rows], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "statement.csv"; a.click();
  URL.revokeObjectURL(url);
}

export default function PortalStatementPage() {
  const { token } = usePortalAuth();

  const { data, isLoading } = useQuery<{ entries: Entry[]; closingBalance: string }>({
    queryKey: ["portal-statement"],
    queryFn: () => fetch("/api/portal/statement", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    enabled: !!token,
  });

  const entries = data?.entries ?? [];

  return (
    <PortalLayout>
      <div className="space-y-4 max-w-5xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Account Statement</h1>
            <p className="text-sm text-gray-500">Running balance on your account</p>
          </div>
          {entries.length > 0 && (
            <button
              onClick={() => downloadCSV(entries, data?.closingBalance ?? "0")}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition"
            >
              <Download className="h-4 w-4" /> Export CSV
            </button>
          )}
        </div>

        {data?.closingBalance && (
          <div className={`rounded-xl p-4 ${Number(data.closingBalance) > 0 ? "bg-red-50 border border-red-200" : "bg-teal-50 border border-teal-200"}`}>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Closing Balance</p>
            <p className={`text-2xl font-bold ${Number(data.closingBalance) > 0 ? "text-red-700" : "text-teal-700"}`}>
              PKR {Number(data.closingBalance).toLocaleString()}
            </p>
          </div>
        )}

        {isLoading && <div className="text-center py-10 text-gray-400 text-sm">Loading…</div>}

        {!isLoading && entries.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="font-medium">No statement entries</p>
            <p className="text-sm mt-1">Entries appear once your account is linked</p>
          </div>
        )}

        {entries.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {["Date", "Voucher #", "Type", "Narration", "Debit", "Credit", "Balance"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {entries.map((e) => (
                    <tr key={e.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">{e.date}</td>
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-xs">{e.voucherNumber}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">{e.type}</span>
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate">{e.narration}</td>
                      <td className="px-4 py-3 text-right text-red-600 font-medium whitespace-nowrap">
                        {Number(e.debit) > 0 ? Number(e.debit).toLocaleString() : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-teal-600 font-medium whitespace-nowrap">
                        {Number(e.credit) > 0 ? Number(e.credit).toLocaleString() : "—"}
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${Number(e.balance) > 0 ? "text-red-700" : "text-teal-700"}`}>
                        {Number(e.balance).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
