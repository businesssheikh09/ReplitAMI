import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Scale, RefreshCw, AlertCircle, CheckCircle } from "lucide-react";

interface TrialBalanceRow {
  account: { id: number; code: string; name: string; type: string };
  totalDebit: number;
  totalCredit: number;
  drBalance: number;
  crBalance: number;
}

interface TrialBalance {
  rows: TrialBalanceRow[];
  grandDr: number;
  grandCr: number;
  isBalanced: boolean;
  period: { from: string | null; to: string | null };
}

const TYPE_COLORS: Record<string, string> = {
  asset: "bg-blue-50 text-blue-700",
  liability: "bg-orange-50 text-orange-700",
  revenue: "bg-green-50 text-green-700",
  expense: "bg-red-50 text-red-700",
  equity: "bg-purple-50 text-purple-700",
};

function fmt(n: number) {
  return n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function TrialBalancePage() {
  const { token } = useAuth();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [applied, setApplied] = useState({ from: "", to: "" });

  const headers = { Authorization: `Bearer ${token}` };

  const { data, isLoading, refetch } = useQuery<TrialBalance>({
    queryKey: ["trial-balance", applied.from, applied.to],
    queryFn: () => {
      const params = new URLSearchParams();
      if (applied.from) params.set("from", applied.from);
      if (applied.to) params.set("to", applied.to);
      return fetch(`/api/accounting/trial-balance?${params}`, { headers }).then((r) => r.json());
    },
    enabled: !!token,
  });

  const rows = data?.rows ?? [];
  const grouped = Object.entries(
    rows.reduce<Record<string, TrialBalanceRow[]>>((acc, r) => {
      const t = r.account.type;
      if (!acc[t]) acc[t] = [];
      acc[t].push(r);
      return acc;
    }, {}),
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Scale className="h-6 w-6" /> Trial Balance
          </h1>
          <p className="text-sm text-muted-foreground">Debit/credit totals per account — must balance</p>
        </div>
        {data && (
          <div className="flex items-center gap-2">
            {data.isBalanced ? (
              <Badge className="bg-green-100 text-green-700 flex items-center gap-1">
                <CheckCircle className="h-3 w-3" /> Balanced
              </Badge>
            ) : (
              <Badge className="bg-red-100 text-red-700 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Out of Balance
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Date range filter */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-3 items-end">
            <div>
              <label className="text-sm font-medium">From</label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-40" />
            </div>
            <div>
              <label className="text-sm font-medium">To</label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-40" />
            </div>
            <Button onClick={() => setApplied({ from, to })}>Apply</Button>
            <Button variant="ghost" onClick={() => { setFrom(""); setTo(""); setApplied({ from: "", to: "" }); }}>
              All Time
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trial Balance Statement</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Code</TableHead>
                <TableHead>Account Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Total Debit</TableHead>
                <TableHead className="text-right">Total Credit</TableHead>
                <TableHead className="text-right">DR Balance</TableHead>
                <TableHead className="text-right">CR Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No journal entries found for this period</TableCell></TableRow>
              ) : (
                grouped.map(([type, typeRows]) => (
                  <>
                    <TableRow key={`group-${type}`} className="bg-muted/40">
                      <TableCell colSpan={7} className="font-semibold text-xs uppercase tracking-wide py-2 pl-4">
                        {type}
                      </TableCell>
                    </TableRow>
                    {typeRows.map((r) => (
                      <TableRow key={r.account.id}>
                        <TableCell className="font-mono text-xs">{r.account.code}</TableCell>
                        <TableCell>{r.account.name}</TableCell>
                        <TableCell>
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[r.account.type] ?? ""}`}>
                            {r.account.type}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(r.totalDebit)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(r.totalCredit)}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {r.drBalance > 0 ? fmt(r.drBalance) : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {r.crBalance > 0 ? fmt(r.crBalance) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </>
                ))
              )}
            </TableBody>
            {data && rows.length > 0 && (
              <TableFooter>
                <TableRow className="font-bold bg-gray-50">
                  <TableCell colSpan={5} className="text-right">GRAND TOTAL</TableCell>
                  <TableCell className="text-right tabular-nums text-green-700">{fmt(data.grandDr)}</TableCell>
                  <TableCell className="text-right tabular-nums text-red-700">{fmt(data.grandCr)}</TableCell>
                </TableRow>
                {!data.isBalanced && (
                  <TableRow className="bg-red-50">
                    <TableCell colSpan={5} className="text-right text-red-600 font-semibold">DIFFERENCE</TableCell>
                    <TableCell colSpan={2} className="text-right text-red-600 font-bold tabular-nums">
                      {fmt(Math.abs(data.grandDr - data.grandCr))}
                    </TableCell>
                  </TableRow>
                )}
              </TableFooter>
            )}
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
