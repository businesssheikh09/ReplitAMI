import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, Plus, TrendingUp, TrendingDown, Landmark, RefreshCw } from "lucide-react";

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

// ── Constants ─────────────────────────────────────────────────────────────────

const CURRENCIES = ["SAR", "PKR", "USD", "GBP", "EUR", "AED"];

const SOURCE_LABELS: Record<string, string> = {
  invoice_payment: "Invoice Payment",
  hotel_invoice:   "Hotel Invoice (DN)",
  currency_tx:     "Currency Transaction",
  manual:          "Manual Entry",
};

const SOURCE_API: Record<string, string> = {
  invoice_payment: "POST /api/invoices/:id/payments",
  hotel_invoice:   "POST /api/invoices/hotel",
  currency_tx:     "POST /api/currency/transactions",
  manual:          "POST /api/accounting/journal",
};

const SOURCE_COLORS: Record<string, string> = {
  invoice_payment: "bg-blue-100 text-blue-800 border-blue-200",
  hotel_invoice:   "bg-amber-100 text-amber-800 border-amber-200",
  currency_tx:     "bg-emerald-100 text-emerald-800 border-emerald-200",
  manual:          "bg-purple-100 text-purple-800 border-purple-200",
};

const TYPE_BADGE: Record<string, string> = {
  asset:     "bg-sky-100 text-sky-800",
  liability: "bg-orange-100 text-orange-800",
  equity:    "bg-purple-100 text-purple-800",
  revenue:   "bg-green-100 text-green-800",
  expense:   "bg-red-100 text-red-800",
};

// Normal balance: asset/expense → debit increases; liability/equity/revenue → credit increases
const NORMAL_DEBIT = new Set(["asset", "expense"]);

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });

const today = () => new Date().toISOString().slice(0, 10);

// ── Manual Entry Dialog ───────────────────────────────────────────────────────

function ManualEntryDialog({
  accounts,
  token,
  onSuccess,
}: {
  accounts: Account[];
  token: string;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    debitAccountId: "",
    creditAccountId: "",
    amount: "",
    description: "",
    date: today(),
    currency: "SAR",
  });

  const save = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/accounting/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          debitAccountId: parseInt(form.debitAccountId),
          creditAccountId: parseInt(form.creditAccountId),
          amount: parseFloat(form.amount),
          description: form.description,
          date: form.date,
          currency: form.currency,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to post entry");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Journal entry posted" });
      setOpen(false);
      setForm({ debitAccountId: "", creditAccountId: "", amount: "", description: "", date: today(), currency: "SAR" });
      onSuccess();
    },
    onError: (err: any) =>
      toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const canSubmit =
    form.debitAccountId &&
    form.creditAccountId &&
    form.debitAccountId !== form.creditAccountId &&
    form.amount &&
    parseFloat(form.amount) > 0 &&
    form.description.trim();

  const sel = (k: keyof typeof form) => (v: string) => setForm(p => ({ ...p, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-blue-900 hover:bg-blue-800 text-white">
          <Plus className="mr-2 h-4 w-4" /> New Journal Entry
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-blue-900">Post Manual Journal Entry</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Debit account */}
          <div className="space-y-1">
            <Label className="text-sm font-semibold">
              Debit Account <span className="text-xs font-normal text-muted-foreground">(DR — value flows in)</span>
            </Label>
            <Select value={form.debitAccountId} onValueChange={sel("debitAccountId")}>
              <SelectTrigger>
                <SelectValue placeholder="Select debit account…" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map(a => (
                  <SelectItem key={a.id} value={String(a.id)}>
                    <span className="font-mono font-bold mr-2 text-blue-700">{a.code}</span>
                    {a.name}
                    <span className="ml-2 text-xs text-muted-foreground">({a.type})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Credit account */}
          <div className="space-y-1">
            <Label className="text-sm font-semibold">
              Credit Account <span className="text-xs font-normal text-muted-foreground">(CR — value flows out)</span>
            </Label>
            <Select value={form.creditAccountId} onValueChange={sel("creditAccountId")}>
              <SelectTrigger>
                <SelectValue placeholder="Select credit account…" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map(a => (
                  <SelectItem key={a.id} value={String(a.id)}>
                    <span className="font-mono font-bold mr-2 text-blue-700">{a.code}</span>
                    {a.name}
                    <span className="ml-2 text-xs text-muted-foreground">({a.type})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.debitAccountId && form.creditAccountId && form.debitAccountId === form.creditAccountId && (
              <p className="text-xs text-red-600">Debit and credit accounts must be different</p>
            )}
          </div>

          {/* Amount + Currency */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1">
              <Label className="text-sm font-semibold">Amount</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-semibold">Currency</Label>
              <Select value={form.currency} onValueChange={sel("currency")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <Label className="text-sm font-semibold">Description / Narration</Label>
            <Input
              placeholder="e.g. Adjustment for commission received"
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            />
          </div>

          {/* Date */}
          <div className="space-y-1">
            <Label className="text-sm font-semibold">Date</Label>
            <Input
              type="date"
              value={form.date}
              onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
            />
          </div>

          {/* Preview */}
          {canSubmit && (
            <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm space-y-1">
              <div className="font-semibold text-blue-900 text-xs tracking-wide mb-2">ENTRY PREVIEW</div>
              <div className="flex justify-between">
                <span className="text-blue-800">
                  DR &nbsp;{accounts.find(a => String(a.id) === form.debitAccountId)?.name}
                </span>
                <span className="font-mono font-bold">{fmt(parseFloat(form.amount))} {form.currency}</span>
              </div>
              <div className="flex justify-between pl-6">
                <span className="text-gray-600">
                  CR &nbsp;{accounts.find(a => String(a.id) === form.creditAccountId)?.name}
                </span>
                <span className="font-mono font-bold">{fmt(parseFloat(form.amount))} {form.currency}</span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              className="bg-blue-900 hover:bg-blue-800 text-white"
              disabled={!canSubmit || save.isPending}
              onClick={() => save.mutate()}
            >
              {save.isPending ? "Posting…" : "Post Entry"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Chart of Accounts with Balances ──────────────────────────────────────────

function AccountsPanel({ accounts, entries }: { accounts: Account[]; entries: JournalEntry[] }) {
  const balances = useMemo(() => {
    const map: Record<number, { dr: number; cr: number }> = {};
    for (const e of entries) {
      if (!map[e.debitAccountId])  map[e.debitAccountId]  = { dr: 0, cr: 0 };
      if (!map[e.creditAccountId]) map[e.creditAccountId] = { dr: 0, cr: 0 };
      map[e.debitAccountId].dr  += e.amount;
      map[e.creditAccountId].cr += e.amount;
    }
    return map;
  }, [entries]);

  return (
    <div className="border border-blue-200 rounded overflow-hidden shadow-sm">
      <div className="bg-blue-900 text-white text-center text-sm font-bold py-2 tracking-widest">
        CHART OF ACCOUNTS — BALANCES
      </div>
      <Table>
        <TableHeader>
          <TableRow className="bg-blue-50">
            <TableHead className="font-bold text-blue-900 text-xs w-20">Code</TableHead>
            <TableHead className="font-bold text-blue-900 text-xs">Account Name</TableHead>
            <TableHead className="font-bold text-blue-900 text-xs">Type</TableHead>
            <TableHead className="font-bold text-blue-900 text-xs text-right">Total DR</TableHead>
            <TableHead className="font-bold text-blue-900 text-xs text-right">Total CR</TableHead>
            <TableHead className="font-bold text-blue-900 text-xs text-right">Balance</TableHead>
            <TableHead className="font-bold text-blue-900 text-xs hidden lg:table-cell">Description</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {accounts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center h-20 text-muted-foreground text-sm">
                Accounts are seeded automatically on first transaction
              </TableCell>
            </TableRow>
          ) : accounts.map((a, i) => {
            const b = balances[a.id] ?? { dr: 0, cr: 0 };
            const balance = NORMAL_DEBIT.has(a.type) ? b.dr - b.cr : b.cr - b.dr;
            return (
              <TableRow key={a.id} className={i % 2 === 0 ? "bg-white" : "bg-blue-50/30"}>
                <TableCell className="font-mono font-bold text-blue-700 text-sm">{a.code}</TableCell>
                <TableCell className="font-medium text-sm">{a.name}</TableCell>
                <TableCell>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGE[a.type] ?? "bg-gray-100 text-gray-700"}`}>
                    {a.type.toUpperCase()}
                  </span>
                </TableCell>
                <TableCell className="text-right font-mono text-sm">{b.dr > 0 ? fmt(b.dr) : "—"}</TableCell>
                <TableCell className="text-right font-mono text-sm">{b.cr > 0 ? fmt(b.cr) : "—"}</TableCell>
                <TableCell className={`text-right font-mono font-bold text-sm ${balance >= 0 ? "text-green-700" : "text-red-600"}`}>
                  {b.dr === 0 && b.cr === 0 ? "—" : fmt(Math.abs(balance))}
                  {b.dr !== 0 || b.cr !== 0 ? (
                    <span className="text-xs font-normal ml-1">{balance >= 0 ? "Dr" : "Cr"}</span>
                  ) : null}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs hidden lg:table-cell">{a.description ?? "—"}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function GeneralJournalPage() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [tab, setTab] = useState<"journal" | "accounts">("journal");

  const headers = { Authorization: `Bearer ${token}` };

  const { data: entries = [], isLoading: entriesLoading, refetch } = useQuery<JournalEntry[]>({
    queryKey: ["/api/accounting/journal"],
    queryFn: () =>
      fetch("/api/accounting/journal?limit=500", { headers }).then(r => r.json()),
    enabled: !!token,
  });

  const { data: accounts = [], isLoading: accountsLoading } = useQuery<Account[]>({
    queryKey: ["/api/accounting/accounts"],
    queryFn: () =>
      fetch("/api/accounting/accounts", { headers }).then(r => r.json()),
    enabled: !!token,
  });

  // ── Running totals ────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const totalAmount = entries.reduce((s, e) => s + e.amount, 0);
    return { count: entries.length, totalAmount };
  }, [entries]);

  // ── Filtered entries ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = entries;
    if (sourceFilter !== "all") list = list.filter(e => e.sourceType === sourceFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        e =>
          e.entryNumber.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q) ||
          (e.debitAccount?.name.toLowerCase().includes(q) ?? false) ||
          (e.creditAccount?.name.toLowerCase().includes(q) ?? false) ||
          (e.debitAccount?.code.toLowerCase().includes(q) ?? false) ||
          (e.creditAccount?.code.toLowerCase().includes(q) ?? false)
      );
    }
    return list;
  }, [entries, search, sourceFilter]);

  const onSuccess = () => {
    qc.invalidateQueries({ queryKey: ["/api/accounting/journal"] });
    qc.invalidateQueries({ queryKey: ["/api/accounting/accounts"] });
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-blue-900" />
            General Journal
          </h2>
          <p className="text-muted-foreground text-sm">
            Double-entry ledger · auto-posted + manual entries
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
          </Button>
          {token && accounts.length > 0 && (
            <ManualEntryDialog accounts={accounts} token={token} onSuccess={onSuccess} />
          )}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Entries",    value: String(totals.count),                     icon: BookOpen,     color: "text-blue-700" },
          { label: "Total Debits",     value: fmt(totals.totalAmount),                  icon: TrendingDown, color: "text-red-600"  },
          { label: "Total Credits",    value: fmt(totals.totalAmount),                  icon: TrendingUp,   color: "text-green-600" },
          { label: "Named Accounts",   value: String(accounts.length),                  icon: Landmark,     color: "text-purple-700" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-4 flex items-start gap-3">
              <s.icon className={`h-5 w-5 mt-0.5 ${s.color}`} />
              <div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
                <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 border-b border-gray-200">
        {(["journal", "accounts"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 text-sm font-semibold rounded-t transition-colors ${
              tab === t
                ? "bg-blue-900 text-white"
                : "text-muted-foreground hover:text-foreground hover:bg-gray-100"
            }`}
          >
            {t === "journal"
              ? `Journal Entries (${entries.length})`
              : `Chart of Accounts (${accounts.length})`}
          </button>
        ))}
      </div>

      {/* ── Journal tab ──────────────────────────────────────────────────────── */}
      {tab === "journal" && (
        <div className="space-y-3">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <Input
              placeholder="Search entry#, account, description…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-8 text-sm max-w-xs"
            />
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="h-8 text-sm w-52">
                <SelectValue placeholder="All sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="invoice_payment">Invoice Payment</SelectItem>
                <SelectItem value="hotel_invoice">Hotel Invoice (DN)</SelectItem>
                <SelectItem value="currency_tx">Currency Transaction</SelectItem>
                <SelectItem value="manual">Manual Entry</SelectItem>
              </SelectContent>
            </Select>
            {filtered.length !== entries.length && (
              <span className="text-xs text-muted-foreground">
                Showing {filtered.length} of {entries.length}
              </span>
            )}
          </div>

          {/* Ledger table */}
          <div className="border border-blue-200 rounded overflow-hidden shadow-sm">
            <div className="bg-blue-900 text-white text-center text-sm font-bold py-2 tracking-widest">
              GENERAL JOURNAL LEDGER
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-blue-50">
                    <TableHead className="font-bold text-blue-900 text-xs w-28">Entry #</TableHead>
                    <TableHead className="font-bold text-blue-900 text-xs w-24">Date</TableHead>
                    <TableHead className="font-bold text-blue-900 text-xs min-w-[180px]">Description</TableHead>
                    {/* DEBIT column */}
                    <TableHead className="font-bold text-blue-900 text-xs bg-red-50 border-l-2 border-red-200">
                      <div>Debit Account (DR)</div>
                    </TableHead>
                    <TableHead className="font-bold text-blue-900 text-xs text-right bg-red-50">DR Amount</TableHead>
                    {/* CREDIT column */}
                    <TableHead className="font-bold text-blue-900 text-xs bg-green-50 border-l-2 border-green-200">
                      Credit Account (CR)
                    </TableHead>
                    <TableHead className="font-bold text-blue-900 text-xs text-right bg-green-50">CR Amount</TableHead>
                    {/* Currency */}
                    <TableHead className="font-bold text-blue-900 text-xs w-14">Curr.</TableHead>
                    {/* Source & API */}
                    <TableHead className="font-bold text-blue-900 text-xs min-w-[200px]">
                      Source / API Endpoint
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entriesLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center h-24 text-muted-foreground">
                        Loading entries…
                      </TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center h-24 text-muted-foreground text-sm">
                        {entries.length === 0
                          ? "No journal entries yet. Entries are posted automatically when invoices are paid, hotel DN invoices are created, or currency transactions are recorded. You can also post manual entries using the button above."
                          : "No entries match the current filter."}
                      </TableCell>
                    </TableRow>
                  ) : filtered.map((e, i) => (
                    <TableRow key={e.id} className={i % 2 === 0 ? "bg-white" : "bg-blue-50/20"}>
                      {/* Entry # */}
                      <TableCell className="font-mono text-xs font-bold text-blue-700">
                        {e.entryNumber}
                      </TableCell>
                      {/* Date */}
                      <TableCell className="text-xs text-muted-foreground">
                        {fmtDate(e.date)}
                      </TableCell>
                      {/* Description */}
                      <TableCell className="text-sm max-w-xs">
                        <div className="truncate">{e.description}</div>
                      </TableCell>
                      {/* DR account */}
                      <TableCell className="bg-red-50/40 border-l-2 border-red-100">
                        <div className="font-medium text-sm">{e.debitAccount?.name ?? `#${e.debitAccountId}`}</div>
                        <div className="font-mono text-xs text-red-700 font-bold">{e.debitAccount?.code}</div>
                      </TableCell>
                      {/* DR amount */}
                      <TableCell className="bg-red-50/40 text-right font-mono font-semibold text-red-700 text-sm">
                        {fmt(e.amount)}
                      </TableCell>
                      {/* CR account */}
                      <TableCell className="bg-green-50/40 border-l-2 border-green-100">
                        <div className="font-medium text-sm">{e.creditAccount?.name ?? `#${e.creditAccountId}`}</div>
                        <div className="font-mono text-xs text-green-700 font-bold">{e.creditAccount?.code}</div>
                      </TableCell>
                      {/* CR amount */}
                      <TableCell className="bg-green-50/40 text-right font-mono font-semibold text-green-700 text-sm">
                        {fmt(e.amount)}
                      </TableCell>
                      {/* Currency */}
                      <TableCell className="text-xs text-muted-foreground font-mono">{e.currency}</TableCell>
                      {/* Source + API endpoint — separate column */}
                      <TableCell>
                        <div className="space-y-1">
                          <Badge
                            variant="outline"
                            className={`text-xs font-medium ${SOURCE_COLORS[e.sourceType ?? ""] ?? "bg-gray-100 text-gray-700"}`}
                          >
                            {SOURCE_LABELS[e.sourceType ?? ""] ?? e.sourceType ?? "—"}
                            {e.sourceId ? ` #${e.sourceId}` : ""}
                          </Badge>
                          <div className="font-mono text-xs text-muted-foreground bg-gray-50 rounded px-1.5 py-0.5 border border-gray-200">
                            {SOURCE_API[e.sourceType ?? ""] ?? "—"}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Footer totals */}
            {filtered.length > 0 && (
              <div className="bg-blue-900 text-white flex items-center justify-between px-4 py-2 text-sm font-bold">
                <span>Total — {filtered.length} entries</span>
                <div className="flex gap-10">
                  <span className="text-red-300">
                    DR: {fmt(filtered.reduce((s, e) => s + e.amount, 0))}
                  </span>
                  <span className="text-green-300">
                    CR: {fmt(filtered.reduce((s, e) => s + e.amount, 0))}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Accounts tab ──────────────────────────────────────────────────────── */}
      {tab === "accounts" && (
        accountsLoading ? (
          <div className="text-center text-muted-foreground py-12">Loading accounts…</div>
        ) : (
          <AccountsPanel accounts={accounts} entries={entries} />
        )
      )}
    </div>
  );
}
