import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Printer, CheckCircle, AlertCircle } from "lucide-react";

interface BalanceSheetRow {
  account: { id: number; code: string; name: string; type: string };
  balance: number;
  opening: number;
}

interface BalanceSheetData {
  assets: BalanceSheetRow[];
  liabilities: BalanceSheetRow[];
  equity: BalanceSheetRow[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  isBalanced: boolean;
  asOf: string | null;
}

interface FinancialYear {
  id: number;
  name: string;
}

function fmt(n: number) {
  return n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Section({ title, rows, total, color }: { title: string; rows: BalanceSheetRow[]; total: number; color: string }) {
  const nonZero = rows.filter((r) => r.balance !== 0);
  return (
    <>
      <TableRow className={`${color} font-bold`}>
        <TableCell colSpan={4} className="pl-4 py-2 uppercase text-xs tracking-wide">{title}</TableCell>
      </TableRow>
      {nonZero.length === 0 ? (
        <TableRow><TableCell colSpan={4} className="pl-8 text-sm text-muted-foreground">No entries</TableCell></TableRow>
      ) : (
        nonZero.map((r) => (
          <TableRow key={r.account.id}>
            <TableCell className="pl-8">{r.account.name}</TableCell>
            <TableCell className="font-mono text-xs text-muted-foreground">{r.account.code}</TableCell>
            <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
              {r.opening !== 0 ? fmt(r.opening) : "—"}
            </TableCell>
            <TableCell className="text-right tabular-nums pr-4">{fmt(r.balance)}</TableCell>
          </TableRow>
        ))
      )}
      <TableRow className="border-t font-semibold">
        <TableCell colSpan={3} className="pl-4">Total {title}</TableCell>
        <TableCell className="text-right tabular-nums pr-4">{fmt(total)}</TableCell>
      </TableRow>
    </>
  );
}

export default function BalanceSheetPage() {
  const { token } = useAuth();
  const [yearId, setYearId] = useState("custom");
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));
  const [applied, setApplied] = useState({ yearId: "", asOf: new Date().toISOString().slice(0, 10) });

  const headers = { Authorization: `Bearer ${token}` };

  const { data: years = [] } = useQuery<FinancialYear[]>({
    queryKey: ["financial-years"],
    queryFn: () => fetch("/api/accounting/financial-years", { headers }).then((r) => r.json()),
    enabled: !!token,
  });

  const { data, isLoading } = useQuery<BalanceSheetData>({
    queryKey: ["balance-sheet", applied],
    queryFn: () => {
      const params = new URLSearchParams();
      if (applied.yearId && applied.yearId !== "custom") params.set("yearId", applied.yearId);
      else if (applied.asOf) params.set("asOf", applied.asOf);
      return fetch(`/api/accounting/balance-sheet?${params}`, { headers }).then((r) => r.json());
    },
    enabled: !!token,
  });

  function apply() {
    setApplied({ yearId: yearId === "custom" ? "" : yearId, asOf });
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto print:p-2">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" /> Balance Sheet
          </h1>
          <p className="text-sm text-muted-foreground">Statement of financial position (Assets = Liabilities + Equity)</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-2" /> Print
        </Button>
      </div>

      {/* Filters */}
      <Card className="print:hidden">
        <CardContent className="pt-4">
          <div className="flex gap-3 items-end flex-wrap">
            <div>
              <label className="text-sm font-medium">Period</label>
              <Select value={yearId} onValueChange={setYearId}>
                <SelectTrigger className="mt-1 w-52"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">As of Date</SelectItem>
                  {years.map((y) => (
                    <SelectItem key={y.id} value={String(y.id)}>{y.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {yearId === "custom" && (
              <div>
                <label className="text-sm font-medium">As Of Date</label>
                <Input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="mt-1 w-40" />
              </div>
            )}
            <Button onClick={apply}>Generate</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="print:shadow-none print:border-none">
        <CardHeader className="border-b pb-4">
          <div className="text-center">
            <div className="text-sm text-muted-foreground">Al Musafir International</div>
            <h2 className="text-xl font-bold">Balance Sheet</h2>
            <div className="text-sm text-muted-foreground">
              {data?.asOf ? `As of ${new Date(data.asOf).toLocaleDateString()}` : "All Time"}
            </div>
          </div>
          {data && (
            <div className="flex justify-center mt-2">
              {data.isBalanced ? (
                <Badge className="bg-green-100 text-green-700">
                  <CheckCircle className="h-3 w-3 mr-1" /> Balanced
                </Badge>
              ) : (
                <Badge className="bg-red-100 text-red-700">
                  <AlertCircle className="h-3 w-3 mr-1" /> Out of Balance by {fmt(Math.abs(data.totalAssets - (data.totalLiabilities + data.totalEquity)))}
                </Badge>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading…</div>
          ) : !data ? (
            <div className="text-center py-8 text-muted-foreground">Click Generate to view balance sheet</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Account</TableHead>
                  <TableHead className="w-24">Code</TableHead>
                  <TableHead className="w-36 text-right">Opening Balance</TableHead>
                  <TableHead className="w-36 text-right pr-4">Closing Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <Section title="Assets" rows={data.assets} total={data.totalAssets} color="bg-blue-50/50 text-blue-800" />
                <TableRow className="h-2 bg-transparent"><TableCell colSpan={4} /></TableRow>
                <Section title="Liabilities" rows={data.liabilities} total={data.totalLiabilities} color="bg-orange-50/50 text-orange-800" />
                <TableRow className="h-2 bg-transparent"><TableCell colSpan={4} /></TableRow>
                <Section title="Equity" rows={data.equity} total={data.totalEquity} color="bg-purple-50/50 text-purple-800" />
              </TableBody>
              <TableFooter>
                <TableRow className="font-bold text-base bg-gray-100">
                  <TableCell colSpan={3} className="pl-4">TOTAL LIABILITIES + EQUITY</TableCell>
                  <TableCell className="text-right tabular-nums pr-4">
                    {fmt(data.totalLiabilities + data.totalEquity)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
