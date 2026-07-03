import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { TrendingUp, Printer } from "lucide-react";

interface PnlAccount {
  account: { id: number; code: string; name: string; type: string };
  amount: number;
}

interface PnlData {
  revenue: PnlAccount[];
  expenses: PnlAccount[];
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  period: { from: string | null; to: string | null };
}

interface FinancialYear {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
}

function fmt(n: number) {
  return n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PnlPage() {
  const { token } = useAuth();
  const [yearId, setYearId] = useState("custom");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [applied, setApplied] = useState({ yearId: "", from: "", to: "" });

  const headers = { Authorization: `Bearer ${token}` };

  const { data: years = [] } = useQuery<FinancialYear[]>({
    queryKey: ["financial-years"],
    queryFn: () => fetch("/api/accounting/financial-years", { headers }).then((r) => r.json()),
    enabled: !!token,
  });

  const { data, isLoading } = useQuery<PnlData>({
    queryKey: ["pnl", applied],
    queryFn: () => {
      const params = new URLSearchParams();
      if (applied.yearId && applied.yearId !== "custom") params.set("yearId", applied.yearId);
      else {
        if (applied.from) params.set("from", applied.from);
        if (applied.to) params.set("to", applied.to);
      }
      return fetch(`/api/accounting/pnl?${params}`, { headers }).then((r) => r.json());
    },
    enabled: !!token,
  });

  function apply() {
    setApplied({
      yearId: yearId === "custom" ? "" : yearId,
      from: yearId === "custom" ? from : "",
      to: yearId === "custom" ? to : "",
    });
  }

  const isProfit = (data?.netProfit ?? 0) >= 0;

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto print:p-2">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="h-6 w-6" /> Profit &amp; Loss Statement
          </h1>
          <p className="text-sm text-muted-foreground">Revenue and expense summary for a period</p>
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
                  <SelectItem value="custom">Custom Date Range</SelectItem>
                  {years.map((y) => (
                    <SelectItem key={y.id} value={String(y.id)}>{y.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {yearId === "custom" && (
              <>
                <div>
                  <label className="text-sm font-medium">From</label>
                  <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-40" />
                </div>
                <div>
                  <label className="text-sm font-medium">To</label>
                  <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-40" />
                </div>
              </>
            )}
            <Button onClick={apply}>Generate</Button>
          </div>
        </CardContent>
      </Card>

      {/* P&L document */}
      <Card className="print:shadow-none print:border-none">
        <CardHeader className="border-b pb-4 print:pb-2">
          <div className="text-center">
            <div className="text-sm text-muted-foreground">Al Musafir International</div>
            <h2 className="text-xl font-bold">Profit &amp; Loss Statement</h2>
            <div className="text-sm text-muted-foreground">
              {data?.period.from ? `From ${data.period.from.slice(0,10)} to ${data.period.to?.slice(0,10)}` : "All Time"}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading…</div>
          ) : !data ? (
            <div className="text-center py-8 text-muted-foreground">Select a period and click Generate</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Particulars</TableHead>
                  <TableHead className="w-20 text-center">Code</TableHead>
                  <TableHead className="text-right w-44 pr-4">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Revenue section */}
                <TableRow className="bg-green-50/50">
                  <TableCell colSpan={3} className="pl-4 py-2 font-bold text-green-800 uppercase text-xs tracking-wide">
                    Revenue / Income
                  </TableCell>
                </TableRow>
                {data.revenue.map((r) => (
                  <TableRow key={r.account.id}>
                    <TableCell className="pl-8">{r.account.name}</TableCell>
                    <TableCell className="text-center font-mono text-xs text-muted-foreground">{r.account.code}</TableCell>
                    <TableCell className="text-right tabular-nums pr-4">{fmt(r.amount)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t font-semibold text-green-700">
                  <TableCell colSpan={2} className="pl-4">Total Revenue</TableCell>
                  <TableCell className="text-right tabular-nums pr-4">{fmt(data.totalRevenue)}</TableCell>
                </TableRow>

                {/* Expense section */}
                <TableRow className="bg-red-50/50">
                  <TableCell colSpan={3} className="pl-4 py-2 font-bold text-red-800 uppercase text-xs tracking-wide">
                    Expenses
                  </TableCell>
                </TableRow>
                {data.expenses.map((r) => (
                  <TableRow key={r.account.id}>
                    <TableCell className="pl-8">{r.account.name}</TableCell>
                    <TableCell className="text-center font-mono text-xs text-muted-foreground">{r.account.code}</TableCell>
                    <TableCell className="text-right tabular-nums pr-4">{fmt(r.amount)}</TableCell>
                  </TableRow>
                ))}
                {data.expenses.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="pl-8 text-sm text-muted-foreground">No expenses</TableCell>
                  </TableRow>
                )}
                <TableRow className="border-t font-semibold text-red-700">
                  <TableCell colSpan={2} className="pl-4">Total Expenses</TableCell>
                  <TableCell className="text-right tabular-nums pr-4">{fmt(data.totalExpenses)}</TableCell>
                </TableRow>
              </TableBody>
              <TableFooter>
                <TableRow className={`font-bold text-base ${isProfit ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
                  <TableCell colSpan={2} className="pl-4">
                    {isProfit ? "NET PROFIT" : "NET LOSS"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums pr-4 text-lg">
                    {fmt(Math.abs(data.netProfit))}
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
