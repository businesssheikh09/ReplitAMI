import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  FileBarChart, BookOpenText, Receipt, Banknote, BookOpen, Search,
  Hotel, ClipboardCheck, CreditCard, Plane
} from "lucide-react";

type ReportType =
  | "party-statement"
  | "vendor-statement"
  | "party-summary"
  | "vendor-summary"
  | "cash-book"
  | "receipt-book"
  | "payment-book"
  | "journal-book"
  | "dn-report"
  | "hotel-checkin"
  | "booking-validation"
  | "search-hotel-invoice"
  | "search-transport-invoice"
  | "voucher-search";

interface ReportDef {
  id: ReportType;
  label: string;
  description: string;
  icon: React.ComponentType<any>;
  category: string;
}

const REPORTS: ReportDef[] = [
  { id: "party-statement",       label: "Party Statement",          description: "All entries touching the PARTY receivable account",     icon: FileBarChart,    category: "Party / Vendor" },
  { id: "vendor-statement",      label: "Vendor Statement",         description: "All entries touching the VENDOR payable account",       icon: FileBarChart,    category: "Party / Vendor" },
  { id: "party-summary",         label: "Party Summary",            description: "PARTY account grouped by source type",                  icon: BookOpenText,    category: "Party / Vendor" },
  { id: "vendor-summary",        label: "Vendor Summary",           description: "VENDOR account grouped by source type",                 icon: BookOpenText,    category: "Party / Vendor" },
  { id: "cash-book",             label: "Cash Book",                description: "All receipts and payments through MSFR (cash/bank)",    icon: Banknote,        category: "Books" },
  { id: "receipt-book",          label: "Receipt Book",             description: "All RV vouchers and invoice receipts",                  icon: Receipt,         category: "Books" },
  { id: "payment-book",          label: "Payment Book",             description: "All PV (Payment) vouchers",                             icon: CreditCard,      category: "Books" },
  { id: "journal-book",          label: "Journal Book",             description: "All general journal entries",                           icon: BookOpen,        category: "Books" },
  { id: "dn-report",             label: "Hotel DN Report",          description: "Hotel invoice receivables vs payables",                 icon: Hotel,           category: "Hotel" },
  { id: "hotel-checkin",         label: "Hotel Check-In Report",    description: "Bookings by check-in / check-out date",                 icon: Hotel,           category: "Hotel" },
  { id: "booking-validation",    label: "Booking Validation",       description: "Flags hotel bookings with missing data",                icon: ClipboardCheck,  category: "Hotel" },
  { id: "search-hotel-invoice",  label: "Search Hotel Invoice",     description: "Find hotel invoices by DN, CNF, name, status",         icon: Search,          category: "Search" },
  { id: "search-transport-invoice", label: "Search Transport",      description: "Find transport bookings by pickup, driver, etc.",      icon: Plane,           category: "Search" },
  { id: "voucher-search",        label: "Voucher Search",           description: "Search across all vouchers (RV/PV/JV/CV)",             icon: Search,          category: "Search" },
];

const CATEGORIES = [...new Set(REPORTS.map((r) => r.category))];

function fmt(n: number) {
  return n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function useReport(type: ReportType | null, params: Record<string, string>, token: string | null) {
  const headers = { Authorization: `Bearer ${token ?? ""}` };
  return useQuery({
    queryKey: ["report", type, params],
    queryFn: () => {
      const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => !!v)));
      return fetch(`/api/accounting/reports/${type}?${qs}`, { headers }).then((r) => r.json());
    },
    enabled: !!token && !!type,
  });
}

export default function AccountingReportsPage() {
  const { token } = useAuth();
  const [active, setActive] = useState<ReportType>("cash-book");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState<Record<string, string>>({});

  const { data, isLoading } = useReport(active, applied, token);

  function generate() {
    const p: Record<string, string> = {};
    if (from) p.from = from;
    if (to) p.to = to;
    if (search) p.search = search;
    setApplied(p);
  }

  const currentDef = REPORTS.find((r) => r.id === active)!;

  function renderData() {
    if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading…</div>;
    if (!data) return <div className="text-center py-8 text-muted-foreground">Click Generate to run this report</div>;

    // Generic entry table renderer
    const entries: any[] = data.entries ?? data.rows ?? [];
    if (entries.length === 0) return <div className="text-center py-8 text-muted-foreground">No data for this period</div>;

    // Cash book / journal book style
    if (active === "cash-book" || active === "journal-book") {
      return (
        <>
          {active === "cash-book" && (
            <div className="grid grid-cols-3 gap-4 mb-4">
              <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Receipts</p><p className="text-lg font-bold text-green-600">{fmt(data.totalReceipts ?? 0)}</p></CardContent></Card>
              <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Payments</p><p className="text-lg font-bold text-red-600">{fmt(data.totalPayments ?? 0)}</p></CardContent></Card>
              <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Closing Balance</p><p className={`text-lg font-bold ${(data.closingBalance ?? 0) >= 0 ? "text-green-700" : "text-red-600"}`}>{fmt(data.closingBalance ?? 0)}</p></CardContent></Card>
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Entry #</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
                {active === "cash-book" && <TableHead className="text-right">Balance</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e: any, i: number) => (
                <TableRow key={i}>
                  <TableCell className="text-sm">{String(e.date ?? "").slice(0, 10)}</TableCell>
                  <TableCell className="font-mono text-xs">{e.entryNumber ?? "—"}</TableCell>
                  <TableCell className="text-sm max-w-xs truncate">{e.description}</TableCell>
                  <TableCell>
                    {e.type && <Badge variant="outline" className={e.type === "receipt" ? "text-green-700" : "text-red-700"}>{e.type}</Badge>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">{e.debitAmount > 0 ? fmt(e.debitAmount) : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm">{e.creditAmount > 0 ? fmt(e.creditAmount) : "—"}</TableCell>
                  {active === "cash-book" && (
                    <TableCell className={`text-right tabular-nums text-sm ${e.runningBalance < 0 ? "text-red-600" : ""}`}>{fmt(e.runningBalance)}</TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      );
    }

    // Party/vendor summary
    if (active === "party-summary" || active === "vendor-summary") {
      return (
        <>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total DR</p><p className="text-lg font-bold">{fmt(data.totalDr ?? 0)}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total CR</p><p className="text-lg font-bold">{fmt(data.totalCr ?? 0)}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Net Balance</p><p className={`text-lg font-bold ${(data.net ?? 0) >= 0 ? "text-green-700" : "text-red-600"}`}>{fmt(data.net ?? 0)}</p></CardContent></Card>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source Type</TableHead>
                <TableHead className="text-right">Count</TableHead>
                <TableHead className="text-right">Total DR</TableHead>
                <TableHead className="text-right">Total CR</TableHead>
                <TableHead className="text-right">Net</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((r: any, i: number) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{r.sourceType}</TableCell>
                  <TableCell className="text-right">{r.count}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(r.dr)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(r.cr)}</TableCell>
                  <TableCell className={`text-right tabular-nums font-medium ${r.net >= 0 ? "text-green-700" : "text-red-600"}`}>{fmt(r.net)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      );
    }

    // DN report
    if (active === "dn-report") {
      return (
        <>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Receivable (SAR)</p><p className="text-lg font-bold text-blue-700">{fmt(data.totalRecvSar ?? 0)}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Payable (SAR)</p><p className="text-lg font-bold text-orange-700">{fmt(data.totalPaySar ?? 0)}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Gross Profit (SAR)</p><p className={`text-lg font-bold ${(data.profitSar ?? 0) >= 0 ? "text-green-700" : "text-red-600"}`}>{fmt(data.profitSar ?? 0)}</p></CardContent></Card>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>DN #</TableHead>
                <TableHead>Party</TableHead>
                <TableHead>Hotel</TableHead>
                <TableHead>Check-in</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Recv SAR</TableHead>
                <TableHead className="text-right">Pay SAR</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((r: any, i: number) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-xs">{r.dnNumber}</TableCell>
                  <TableCell className="text-sm">{r.partyName ?? "—"}</TableCell>
                  <TableCell className="text-sm">{r.hotelName ?? "—"}</TableCell>
                  <TableCell className="text-sm">{r.checkIn ?? "—"}</TableCell>
                  <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                  <TableCell className="text-right tabular-nums text-sm">{fmt(r.receivableSar ?? 0)}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm">{fmt(r.payableSar ?? 0)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      );
    }

    // Booking validation
    if (active === "booking-validation") {
      return (
        <>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">With Issues</p><p className="text-lg font-bold text-red-600">{data.totalWithIssues ?? 0}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Clean</p><p className="text-lg font-bold text-green-700">{data.totalClean ?? 0}</p></CardContent></Card>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>DN #</TableHead>
                <TableHead>Party</TableHead>
                <TableHead>Hotel</TableHead>
                <TableHead>Issues</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.filter((r: any) => r.hasIssues).map((r: any, i: number) => (
                <TableRow key={i} className="bg-red-50/40">
                  <TableCell className="font-mono text-xs">{r.dnNumber}</TableCell>
                  <TableCell className="text-sm">{r.partyName ?? "—"}</TableCell>
                  <TableCell className="text-sm">{r.hotelName ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {r.issues.map((issue: string, j: number) => (
                        <Badge key={j} className="bg-red-100 text-red-700 text-xs">{issue}</Badge>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      );
    }

    // Generic fallback table — uses all keys of first row
    const keys = Object.keys(entries[0] ?? {}).filter((k) => !["id"].includes(k)).slice(0, 8);
    return (
      <Table>
        <TableHeader>
          <TableRow>{keys.map((k) => <TableHead key={k}>{k}</TableHead>)}</TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((r: any, i: number) => (
            <TableRow key={i}>
              {keys.map((k) => (
                <TableCell key={k} className="text-sm">
                  {typeof r[k] === "number" ? fmt(r[k]) : String(r[k] ?? "—")}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Accounting Reports</h1>
        <p className="text-sm text-muted-foreground">Operational and management reports for finance</p>
      </div>

      <div className="grid grid-cols-4 gap-6">
        {/* Sidebar report picker */}
        <div className="col-span-1 space-y-4">
          {CATEGORIES.map((cat) => (
            <div key={cat}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{cat}</p>
              <div className="space-y-1">
                {REPORTS.filter((r) => r.category === cat).map((r) => {
                  const Icon = r.icon;
                  return (
                    <button
                      key={r.id}
                      onClick={() => { setActive(r.id); setApplied({}); }}
                      className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${active === r.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                    >
                      <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate">{r.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Report content */}
        <div className="col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">{currentDef.label}</h2>
              <p className="text-sm text-muted-foreground">{currentDef.description}</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-3 items-end flex-wrap">
            <div>
              <label className="text-xs font-medium text-muted-foreground">From</label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-36 h-8 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">To</label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-36 h-8 text-sm" />
            </div>
            {["search-hotel-invoice", "search-transport-invoice", "voucher-search"].includes(active) && (
              <div className="flex-1">
                <label className="text-xs font-medium text-muted-foreground">Search</label>
                <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="mt-1 h-8 text-sm" />
              </div>
            )}
            <Button size="sm" onClick={generate}>Generate</Button>
            <Button size="sm" variant="ghost" onClick={() => { setFrom(""); setTo(""); setSearch(""); setApplied({}); }}>Clear</Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {renderData()}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
