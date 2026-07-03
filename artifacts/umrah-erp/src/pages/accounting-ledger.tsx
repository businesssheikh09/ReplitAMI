import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Search } from "lucide-react";

interface Account {
  id: number;
  code: string;
  name: string;
  type: string;
}

interface LedgerRow {
  id: number;
  entryNumber: string;
  date: string;
  description: string;
  debitAmount: number;
  creditAmount: number;
  runningBalance: number;
  oppositeAccount: Account | null;
  sourceType: string | null;
  currency: string;
}

interface LedgerData {
  account: Account;
  ledger: LedgerRow[];
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
}

const TYPE_COLORS: Record<string, string> = {
  asset: "bg-blue-50 text-blue-700",
  liability: "bg-orange-50 text-orange-700",
  revenue: "bg-green-50 text-green-700",
  expense: "bg-red-50 text-red-700",
  equity: "bg-purple-50 text-purple-700",
};

function fmt(n: number) {
  const abs = Math.abs(n);
  const s = abs.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `(${s})` : s;
}

export default function AccountingLedgerPage() {
  const { token } = useAuth();
  const [selectedAccount, setSelectedAccount] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [applied, setApplied] = useState({ accountId: "", from: "", to: "" });

  const headers = { Authorization: `Bearer ${token}` };

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ["chart-of-accounts"],
    queryFn: () => fetch("/api/accounting/accounts", { headers }).then((r) => r.json()),
    enabled: !!token,
  });

  const { data: ledger, isLoading } = useQuery<LedgerData>({
    queryKey: ["ledger", applied.accountId, applied.from, applied.to],
    queryFn: () => {
      const params = new URLSearchParams({ accountId: applied.accountId });
      if (applied.from) params.set("from", applied.from);
      if (applied.to) params.set("to", applied.to);
      return fetch(`/api/accounting/ledger?${params}`, { headers }).then((r) => r.json());
    },
    enabled: !!token && !!applied.accountId,
  });

  function apply() {
    if (!selectedAccount) return;
    setApplied({ accountId: selectedAccount, from, to });
  }

  const drNormal = ledger ? ["asset", "expense"].includes(ledger.account.type) : true;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BookOpen className="h-6 w-6" /> Account Ledger
        </h1>
        <p className="text-sm text-muted-foreground">Full transaction history for any account</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-3 items-end flex-wrap">
            <div className="flex-1 min-w-[220px]">
              <label className="text-sm font-medium">Account</label>
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select account…" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.code} — {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">From</label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-40" />
            </div>
            <div>
              <label className="text-sm font-medium">To</label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-40" />
            </div>
            <Button onClick={apply} disabled={!selectedAccount}>
              <Search className="h-4 w-4 mr-2" /> Show Ledger
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Account info */}
      {ledger && (
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">{ledger.account.name}</h2>
          <span className="font-mono text-sm text-muted-foreground">{ledger.account.code}</span>
          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[ledger.account.type] ?? ""}`}>
            {ledger.account.type}
          </span>
          <span className="text-sm text-muted-foreground ml-auto">
            {ledger.ledger.length} transactions
          </span>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Date</TableHead>
                <TableHead className="w-36">Entry #</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Opposite Account</TableHead>
                <TableHead className="w-24">CCY</TableHead>
                <TableHead className="text-right w-32">Debit</TableHead>
                <TableHead className="text-right w-32">Credit</TableHead>
                <TableHead className="text-right w-36">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!applied.accountId ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Select an account to view its ledger</TableCell></TableRow>
              ) : isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : !ledger?.ledger.length ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No transactions found</TableCell></TableRow>
              ) : (
                ledger.ledger.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-sm">{row.date.slice(0, 10)}</TableCell>
                    <TableCell className="font-mono text-xs">{row.entryNumber}</TableCell>
                    <TableCell className="text-sm max-w-xs truncate">{row.description}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.oppositeAccount?.name ?? "—"}</TableCell>
                    <TableCell className="text-sm">{row.currency}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {row.debitAmount > 0 ? fmt(row.debitAmount) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {row.creditAmount > 0 ? fmt(row.creditAmount) : "—"}
                    </TableCell>
                    <TableCell className={`text-right tabular-nums text-sm font-medium ${row.runningBalance < 0 ? "text-red-600" : ""}`}>
                      {fmt(row.runningBalance)}
                      <span className="text-xs text-muted-foreground ml-1">
                        {row.runningBalance >= 0 ? (drNormal ? "Dr" : "Cr") : (drNormal ? "Cr" : "Dr")}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            {ledger && ledger.ledger.length > 0 && (
              <TableFooter>
                <TableRow className="font-bold">
                  <TableCell colSpan={5} className="text-right">TOTALS</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(ledger.totalDebit)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(ledger.totalCredit)}</TableCell>
                  <TableCell className={`text-right tabular-nums ${ledger.closingBalance < 0 ? "text-red-600" : "text-green-700"}`}>
                    {fmt(ledger.closingBalance)} {drNormal ? (ledger.closingBalance >= 0 ? "Dr" : "Cr") : (ledger.closingBalance >= 0 ? "Cr" : "Dr")}
                  </TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
