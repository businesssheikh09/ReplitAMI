import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BookOpen, TrendingUp, TrendingDown, ArrowRightLeft, Landmark } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Account {
  id: number;
  code: string;
  name: string;
  type: string;
  description: string | null;
}

interface JournalEntry {
  id: number;
  entryNumber: string;
  date: string;
  description: string;
  debitAccountId: number;
  creditAccountId: number;
  amount: number;
  currency: string;
  sourceType: string | null;
  sourceId: number | null;
  debitAccount: Account | null;
  creditAccount: Account | null;
  createdAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

const SOURCE_LABELS: Record<string, string> = {
  invoice_payment: "Invoice Payment",
  hotel_invoice: "Hotel Invoice",
  currency_tx: "Currency Tx",
};

const TYPE_COLORS: Record<string, string> = {
  asset:     "bg-blue-100 text-blue-800",
  liability: "bg-orange-100 text-orange-800",
  equity:    "bg-purple-100 text-purple-800",
  revenue:   "bg-green-100 text-green-800",
  expense:   "bg-red-100 text-red-800",
};

const SOURCE_COLORS: Record<string, string> = {
  invoice_payment: "bg-blue-100 text-blue-800",
  hotel_invoice:   "bg-amber-100 text-amber-800",
  currency_tx:     "bg-emerald-100 text-emerald-800",
};

// ── Chart of Accounts Panel ───────────────────────────────────────────────────

function AccountsPanel({ accounts }: { accounts: Account[] }) {
  const byType = useMemo(() => {
    const map: Record<string, Account[]> = {};
    for (const a of accounts) {
      if (!map[a.type]) map[a.type] = [];
      map[a.type].push(a);
    }
    return map;
  }, [accounts]);

  return (
    <div className="border border-blue-200 rounded overflow-hidden shadow-sm">
      <div className="bg-blue-900 text-white text-center text-sm font-bold py-2 tracking-widest">
        CHART OF ACCOUNTS
      </div>
      <Table>
        <TableHeader>
          <TableRow className="bg-blue-50">
            <TableHead className="font-bold text-blue-900 w-20">Code</TableHead>
            <TableHead className="font-bold text-blue-900">Account Name</TableHead>
            <TableHead className="font-bold text-blue-900">Type</TableHead>
            <TableHead className="font-bold text-blue-900 hidden md:table-cell">Description</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {accounts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center h-20 text-muted-foreground">
                No accounts yet — they are seeded automatically on first transaction
              </TableCell>
            </TableRow>
          ) : accounts.map((a, i) => (
            <TableRow key={a.id} className={i % 2 === 0 ? "bg-white" : "bg-blue-50/30"}>
              <TableCell className="font-mono font-bold text-blue-700 text-sm">{a.code}</TableCell>
              <TableCell className="font-medium">{a.name}</TableCell>
              <TableCell>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[a.type] ?? "bg-gray-100 text-gray-700"}`}>
                  {a.type.toUpperCase()}
                </span>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm hidden md:table-cell">{a.description ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function GeneralJournalPage() {
  const { token } = useAuth();
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [tab, setTab] = useState<"journal" | "accounts">("journal");

  const headers = { Authorization: `Bearer ${token}` };

  const { data: entries = [], isLoading: entriesLoading } = useQuery<JournalEntry[]>({
    queryKey: ["/api/accounting/journal"],
    queryFn: () =>
      fetch("/api/accounting/journal?limit=200", { headers }).then((r) => r.json()),
    enabled: !!token,
  });

  const { data: accounts = [], isLoading: accountsLoading } = useQuery<Account[]>({
    queryKey: ["/api/accounting/accounts"],
    queryFn: () =>
      fetch("/api/accounting/accounts", { headers }).then((r) => r.json()),
    enabled: !!token,
  });

  // ── Totals ────────────────────────────────────────────────────────────────

  const totals = useMemo(() => {
    let totalDr = 0, totalCr = 0;
    for (const e of entries) {
      totalDr += e.amount;
      totalCr += e.amount;
    }
    return { totalDr, totalCr, count: entries.length };
  }, [entries]);

  // ── Filtered entries ──────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = entries;
    if (sourceFilter !== "all") list = list.filter((e) => e.sourceType === sourceFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          e.entryNumber.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q) ||
          (e.debitAccount?.name.toLowerCase().includes(q) ?? false) ||
          (e.creditAccount?.name.toLowerCase().includes(q) ?? false) ||
          (e.sourceType?.includes(q) ?? false)
      );
    }
    return list;
  }, [entries, search, sourceFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-blue-900" />
            General Journal
          </h2>
          <p className="text-muted-foreground text-sm">
            Double-entry ledger — every transaction auto-posted
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Entries",  value: String(totals.count),       icon: BookOpen,       color: "text-blue-700" },
          { label: "Total Debits",   value: `${fmt(totals.totalDr)}`,   icon: TrendingDown,   color: "text-red-600" },
          { label: "Total Credits",  value: `${fmt(totals.totalCr)}`,   icon: TrendingUp,     color: "text-green-600" },
          { label: "Accounts",       value: String(accounts.length),    icon: Landmark,       color: "text-purple-700" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4 flex items-start gap-3">
              <s.icon className={`h-5 w-5 mt-0.5 ${s.color}`} />
              <div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
                <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 border-b border-gray-200 pb-1">
        {(["journal", "accounts"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-sm font-semibold rounded-t transition-colors ${
              tab === t
                ? "bg-blue-900 text-white"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "journal" ? `Journal Entries (${entries.length})` : `Chart of Accounts (${accounts.length})`}
          </button>
        ))}
      </div>

      {/* Journal tab */}
      {tab === "journal" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <Input
              placeholder="Search entry, account, description…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-sm max-w-xs"
            />
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="h-8 text-sm w-44">
                <SelectValue placeholder="All sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="invoice_payment">Invoice Payment</SelectItem>
                <SelectItem value="hotel_invoice">Hotel Invoice</SelectItem>
                <SelectItem value="currency_tx">Currency Transaction</SelectItem>
              </SelectContent>
            </Select>
            {filtered.length !== entries.length && (
              <span className="text-xs text-muted-foreground">
                {filtered.length} of {entries.length} entries
              </span>
            )}
          </div>

          {/* Journal table */}
          <div className="border border-blue-200 rounded overflow-hidden shadow-sm">
            <div className="bg-blue-900 text-white text-center text-sm font-bold py-2 tracking-widest">
              GENERAL JOURNAL LEDGER
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-blue-50">
                    <TableHead className="font-bold text-blue-900 text-xs w-32">Entry #</TableHead>
                    <TableHead className="font-bold text-blue-900 text-xs w-28">Date</TableHead>
                    <TableHead className="font-bold text-blue-900 text-xs">Description</TableHead>
                    <TableHead className="font-bold text-blue-900 text-xs">Debit Account</TableHead>
                    <TableHead className="font-bold text-blue-900 text-xs">Credit Account</TableHead>
                    <TableHead className="font-bold text-blue-900 text-xs text-right">Amount</TableHead>
                    <TableHead className="font-bold text-blue-900 text-xs w-16">Curr.</TableHead>
                    <TableHead className="font-bold text-blue-900 text-xs">Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entriesLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center h-24 text-muted-foreground">
                        Loading journal entries…
                      </TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center h-24 text-muted-foreground">
                        {entries.length === 0
                          ? "No journal entries yet — entries are auto-posted when invoices are paid, hotel invoices are created, or currency transactions are recorded."
                          : "No entries match the current filter."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((e, i) => (
                      <TableRow key={e.id} className={i % 2 === 0 ? "bg-white" : "bg-blue-50/30"}>
                        <TableCell className="font-mono text-xs font-semibold text-blue-700">
                          {e.entryNumber}
                        </TableCell>
                        <TableCell className="text-xs">{fmtDate(e.date)}</TableCell>
                        <TableCell className="text-sm max-w-xs truncate">{e.description}</TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">{e.debitAccount?.name ?? `#${e.debitAccountId}`}</div>
                          <div className="text-xs text-muted-foreground font-mono">{e.debitAccount?.code}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">{e.creditAccount?.name ?? `#${e.creditAccountId}`}</div>
                          <div className="text-xs text-muted-foreground font-mono">{e.creditAccount?.code}</div>
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold text-sm">
                          {fmt(e.amount)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">{e.currency}</TableCell>
                        <TableCell>
                          {e.sourceType ? (
                            <Badge
                              variant="outline"
                              className={`text-xs ${SOURCE_COLORS[e.sourceType] ?? "bg-gray-100 text-gray-700"}`}
                            >
                              {SOURCE_LABELS[e.sourceType] ?? e.sourceType}
                              {e.sourceId ? ` #${e.sourceId}` : ""}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Totals footer */}
            {filtered.length > 0 && (
              <div className="bg-blue-900 text-white flex items-center justify-between px-4 py-2 text-sm font-bold">
                <span>Total ({filtered.length} entries)</span>
                <div className="flex gap-8">
                  <span>DR: {fmt(filtered.reduce((s, e) => s + e.amount, 0))}</span>
                  <span>CR: {fmt(filtered.reduce((s, e) => s + e.amount, 0))}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Accounts tab */}
      {tab === "accounts" && (
        accountsLoading ? (
          <div className="text-center text-muted-foreground py-12">Loading accounts…</div>
        ) : (
          <AccountsPanel accounts={accounts} />
        )
      )}
    </div>
  );
}
