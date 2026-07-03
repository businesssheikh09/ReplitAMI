import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  FileBarChart, BookOpenText, Receipt, Banknote, BookOpen, Search,
  Hotel, ClipboardCheck, CreditCard, Plane, Printer, Download, ArrowRightLeft, Moon,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ReportType =
  | "party-statement" | "vendor-statement" | "party-summary" | "vendor-summary"
  | "cash-book" | "receipt-book" | "payment-book" | "journal-book"
  | "voucher-search" | "dn-report" | "hotel-checkin" | "booking-validation"
  | "search-hotel-invoice" | "search-transport-invoice" | "search-ref-invoice"
  | "room-occupancy" | "fortnight-ledger" | "fx-ledger";

interface ReportDef {
  id: ReportType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  category: string;
}

const REPORTS: ReportDef[] = [
  { id: "party-statement",          label: "Party Statement",           description: "Running balance for each client receivable",           icon: FileBarChart,   category: "Party / Vendor" },
  { id: "vendor-statement",         label: "Vendor Statement",          description: "Running balance for vendor payables",                   icon: FileBarChart,   category: "Party / Vendor" },
  { id: "party-summary",            label: "Party Summary",             description: "PARTY account grouped by source type",                  icon: BookOpenText,   category: "Party / Vendor" },
  { id: "vendor-summary",           label: "Vendor Summary",            description: "VENDOR account grouped by source type",                 icon: BookOpenText,   category: "Party / Vendor" },
  { id: "cash-book",                label: "Cash Book",                 description: "All cash receipts and payments (MSFR account)",         icon: Banknote,       category: "Books" },
  { id: "receipt-book",             label: "Receipt Book",              description: "All RV vouchers and auto-posted invoice receipts",       icon: Receipt,        category: "Books" },
  { id: "payment-book",             label: "Payment Book",              description: "All PV (Payment) vouchers",                             icon: CreditCard,     category: "Books" },
  { id: "journal-book",             label: "Journal Book",              description: "Complete general journal with DR/CR accounts",          icon: BookOpen,       category: "Books" },
  { id: "voucher-search",           label: "Voucher Search",            description: "Search across all vouchers (RV / PV / JV / CV)",        icon: Search,         category: "Search" },
  { id: "search-hotel-invoice",     label: "Search Hotel Invoice",      description: "Find hotel invoices by DN, CNF, party, status",         icon: Hotel,          category: "Search" },
  { id: "search-transport-invoice", label: "Search Transport",          description: "Find transport bookings by pickup, driver, status",     icon: Plane,          category: "Search" },
  { id: "search-ref-invoice",       label: "Search by Reference",       description: "Find any invoice by reference number across all types", icon: Search,         category: "Search" },
  { id: "dn-report",                label: "Hotel DN Report",           description: "Hotel invoice receivables vs payables (SAR)",           icon: Hotel,          category: "Hotel" },
  { id: "hotel-checkin",            label: "Check-In / Check-Out",      description: "Hotel bookings by arrival or departure date",           icon: Hotel,          category: "Hotel" },
  { id: "booking-validation",       label: "Booking Validation",        description: "Flags hotel bookings with missing data",                icon: ClipboardCheck, category: "Hotel" },
  { id: "room-occupancy",           label: "Room Occupancy",            description: "Occupied room-nights per hotel and room type",          icon: Hotel,          category: "Hotel" },
  { id: "fortnight-ledger",         label: "Fortnight Ledger",          description: "15-day rolling ledger for any account",                icon: Moon,           category: "Ledgers" },
  { id: "fx-ledger",                label: "Foreign Currency Ledger",   description: "All currency exchange transactions with PKR totals",    icon: ArrowRightLeft, category: "Ledgers" },
];

const CATEGORIES = [...new Set(REPORTS.map((r) => r.category))];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function exportToCsv(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]).filter((k) => !["id"].includes(k));
  const escape = (v: unknown) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [keys.join(","), ...rows.map((r) => keys.map((k) => escape(r[k])).join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  a.download = filename + ".csv";
  a.click();
}

// ─── Data hooks ───────────────────────────────────────────────────────────────

function useReport(type: ReportType, params: Record<string, string>, token: string | null) {
  return useQuery({
    queryKey: ["report", type, params],
    queryFn: async () => {
      const qs = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([k, v]) => !!v && k !== "_run")),
      );
      const r = await fetch(`/api/accounting/reports/${type}?${qs}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error ?? "API error"); }
      return r.json();
    },
    enabled: !!token && !!params._run,
  });
}

function useClients(token: string | null) {
  return useQuery<{ id: number; name: string }[]>({
    queryKey: ["clients-list", token],
    queryFn: () => fetch("/api/clients", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    enabled: !!token,
    staleTime: 120_000,
  });
}

function useVendors(token: string | null) {
  return useQuery<{ id: number; name: string }[]>({
    queryKey: ["vendors-list", token],
    queryFn: () => fetch("/api/vendors", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    enabled: !!token,
    staleTime: 120_000,
  });
}

function useAccounts(token: string | null) {
  return useQuery<{ id: number; code: string; name: string }[]>({
    queryKey: ["accounts-list", token],
    queryFn: () => fetch("/api/accounting/accounts", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    enabled: !!token,
    staleTime: 300_000,
  });
}

function useHotels(token: string | null) {
  return useQuery<{ id: number; name: string; city: string }[]>({
    queryKey: ["hotels-list", token],
    queryFn: () => fetch("/api/hotels", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    enabled: !!token,
    staleTime: 120_000,
  });
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────

interface FilterBarProps {
  active: ReportType;
  filters: Record<string, string>;
  setFilter: (key: string, val: string) => void;
  clients: { id: number; name: string }[];
  vendors: { id: number; name: string }[];
  accounts: { id: number; code: string; name: string }[];
  hotels: { id: number; name: string; city: string }[];
}

function FilterBar({ active, filters, setFilter, clients, vendors, accounts, hotels }: FilterBarProps) {
  const f = (key: string) => filters[key] ?? "";
  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => setFilter(key, e.target.value);

  const dateRange = (
    <>
      <div>
        <label className="text-xs font-medium text-muted-foreground">From</label>
        <Input type="date" value={f("from")} onChange={set("from")} className="mt-1 w-36 h-8 text-sm" />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">To</label>
        <Input type="date" value={f("to")} onChange={set("to")} className="mt-1 w-36 h-8 text-sm" />
      </div>
    </>
  );

  const clientPicker = (
    <div className="w-52">
      <label className="text-xs font-medium text-muted-foreground">Client</label>
      <Select value={f("partyId") || "_all"} onValueChange={(v) => setFilter("partyId", v === "_all" ? "" : v)}>
        <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue placeholder="All clients" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">All clients</SelectItem>
          {clients.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );

  const vendorPicker = (
    <div className="w-52">
      <label className="text-xs font-medium text-muted-foreground">Vendor</label>
      <Select value={f("vendorId") || "_all"} onValueChange={(v) => setFilter("vendorId", v === "_all" ? "" : v)}>
        <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue placeholder="All vendors" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">All vendors</SelectItem>
          {vendors.map((v) => <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );

  if (active === "party-statement") return <>{dateRange}{clientPicker}</>;
  if (active === "vendor-statement") return <>{dateRange}{vendorPicker}</>;
  if (active === "party-summary" || active === "vendor-summary") return <>{dateRange}</>;
  if (active === "cash-book" || active === "receipt-book" || active === "payment-book" || active === "journal-book") return <>{dateRange}</>;

  if (active === "voucher-search") return (
    <>
      {dateRange}
      <div>
        <label className="text-xs font-medium text-muted-foreground">Type</label>
        <Select value={f("type") || "_all"} onValueChange={(v) => setFilter("type", v === "_all" ? "" : v)}>
          <SelectTrigger className="mt-1 h-8 text-sm w-24"><SelectValue placeholder="All" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All</SelectItem>
            {["RV", "PV", "JV", "CV"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">Status</label>
        <Select value={f("status") || "_all"} onValueChange={(v) => setFilter("status", v === "_all" ? "" : v)}>
          <SelectTrigger className="mt-1 h-8 text-sm w-28"><SelectValue placeholder="All" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All</SelectItem>
            {["draft", "approved", "posted", "reversed"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex-1">
        <label className="text-xs font-medium text-muted-foreground">Search</label>
        <Input placeholder="Voucher # or narration…" value={f("search")} onChange={set("search")} className="mt-1 h-8 text-sm" />
      </div>
      {clientPicker}
      {vendorPicker}
    </>
  );

  if (active === "dn-report") return (
    <>
      {dateRange}
      {clientPicker}
      <div>
        <label className="text-xs font-medium text-muted-foreground">Status</label>
        <Select value={f("status") || "_all"} onValueChange={(v) => setFilter("status", v === "_all" ? "" : v)}>
          <SelectTrigger className="mt-1 h-8 text-sm w-28"><SelectValue placeholder="All" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All</SelectItem>
            {["draft", "confirmed", "paid", "cancelled"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </>
  );

  if (active === "hotel-checkin") return (
    <>
      {dateRange}
      <div>
        <label className="text-xs font-medium text-muted-foreground">Report Type</label>
        <Select value={f("type") || "checkin"} onValueChange={(v) => setFilter("type", v)}>
          <SelectTrigger className="mt-1 h-8 text-sm w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="checkin">Check-In List</SelectItem>
            <SelectItem value="checkout">Check-Out List</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </>
  );

  if (active === "booking-validation") return <>{dateRange}</>;

  if (active === "search-hotel-invoice") return (
    <>
      <div className="flex-1">
        <label className="text-xs font-medium text-muted-foreground">Search</label>
        <Input placeholder="DN #, CNF #, passenger, hotel…" value={f("search")} onChange={set("search")} className="mt-1 h-8 text-sm" />
      </div>
      {dateRange}
      {clientPicker}
      {vendorPicker}
      <div>
        <label className="text-xs font-medium text-muted-foreground">Status</label>
        <Select value={f("status") || "_all"} onValueChange={(v) => setFilter("status", v === "_all" ? "" : v)}>
          <SelectTrigger className="mt-1 h-8 text-sm w-28"><SelectValue placeholder="All" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All</SelectItem>
            {["draft", "confirmed", "paid", "cancelled"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </>
  );

  if (active === "search-transport-invoice") return (
    <>
      <div className="flex-1">
        <label className="text-xs font-medium text-muted-foreground">Search</label>
        <Input placeholder="Pickup, dropoff, driver…" value={f("search")} onChange={set("search")} className="mt-1 h-8 text-sm" />
      </div>
      <div className="w-52">
        <label className="text-xs font-medium text-muted-foreground">Client</label>
        <Select value={f("clientId") || "_all"} onValueChange={(v) => setFilter("clientId", v === "_all" ? "" : v)}>
          <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue placeholder="All clients" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All clients</SelectItem>
            {clients.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {vendorPicker}
      <div>
        <label className="text-xs font-medium text-muted-foreground">Status</label>
        <Select value={f("status") || "_all"} onValueChange={(v) => setFilter("status", v === "_all" ? "" : v)}>
          <SelectTrigger className="mt-1 h-8 text-sm w-28"><SelectValue placeholder="All" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All</SelectItem>
            {["pending", "confirmed", "completed", "cancelled"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </>
  );

  if (active === "search-ref-invoice") return (
    <div className="flex-1">
      <label className="text-xs font-medium text-muted-foreground">Reference Number</label>
      <Input placeholder="Enter DN #, CNF #, or any reference…" value={f("ref")} onChange={set("ref")} className="mt-1 h-8 text-sm" />
    </div>
  );

  if (active === "room-occupancy") return (
    <>
      {dateRange}
      <div className="w-60">
        <label className="text-xs font-medium text-muted-foreground">Hotel</label>
        <Select value={f("hotelId") || "_all"} onValueChange={(v) => setFilter("hotelId", v === "_all" ? "" : v)}>
          <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue placeholder="All hotels" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All hotels</SelectItem>
            {hotels.map((h) => <SelectItem key={h.id} value={String(h.id)}>{h.name} — {h.city}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </>
  );

  if (active === "fortnight-ledger") return (
    <>
      <div className="w-60">
        <label className="text-xs font-medium text-muted-foreground">Account <span className="text-red-500">*</span></label>
        <Select value={f("accountId") || ""} onValueChange={(v) => setFilter("accountId", v)}>
          <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue placeholder="Select account…" /></SelectTrigger>
          <SelectContent>
            {accounts.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.code} — {a.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {dateRange}
    </>
  );

  if (active === "fx-ledger") return (
    <>
      <div>
        <label className="text-xs font-medium text-muted-foreground">Currency</label>
        <Input placeholder="SAR, USD…" value={f("currency")} onChange={set("currency")} className="mt-1 w-24 h-8 text-sm uppercase" />
      </div>
      {dateRange}
    </>
  );

  return <>{dateRange}</>;
}

// ─── Report Renderers ─────────────────────────────────────────────────────────

function renderReport(active: ReportType, data: Record<string, unknown>) {
  const rows: Record<string, unknown>[] = (data.entries ?? data.rows ?? []) as Record<string, unknown>[];

  if (rows.length === 0 && active !== "booking-validation") {
    return <div className="text-center py-12 text-muted-foreground">No data for this period</div>;
  }

  // ── Party / Vendor Statement ─────────────────────────────────
  if (active === "party-statement" || active === "vendor-statement") {
    return (
      <>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total DR</p><p className="text-lg font-bold text-green-700">{fmt(data.totalDebit as number)}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total CR</p><p className="text-lg font-bold text-red-600">{fmt(data.totalCredit as number)}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Balance</p><p className={`text-lg font-bold ${(data.balance as number) >= 0 ? "text-green-700" : "text-red-600"}`}>{fmt(data.balance as number)}</p></CardContent></Card>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Entry #</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="text-right">DR</TableHead>
              <TableHead className="text-right">CR</TableHead>
              <TableHead className="text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((e, i) => (
              <TableRow key={i}>
                <TableCell className="text-sm">{String(e.date ?? "").slice(0, 10)}</TableCell>
                <TableCell className="font-mono text-xs">{String(e.entryNumber ?? "—")}</TableCell>
                <TableCell className="text-sm max-w-xs truncate">{String(e.description ?? "—")}</TableCell>
                <TableCell><Badge variant="outline" className="text-xs">{String(e.sourceType ?? "manual")}</Badge></TableCell>
                <TableCell className="text-right tabular-nums text-sm text-green-700">{e.side === "DR" ? fmt(e.amount as number) : "—"}</TableCell>
                <TableCell className="text-right tabular-nums text-sm text-red-600">{e.side === "CR" ? fmt(e.amount as number) : "—"}</TableCell>
                <TableCell className={`text-right tabular-nums text-sm font-medium ${(e.runningBalance as number) < 0 ? "text-red-600" : ""}`}>{fmt(e.runningBalance as number)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </>
    );
  }

  // ── Party / Vendor Summary ─────────────────────────────────
  if (active === "party-summary" || active === "vendor-summary") {
    return (
      <>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total DR</p><p className="text-lg font-bold">{fmt(data.totalDr as number)}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total CR</p><p className="text-lg font-bold">{fmt(data.totalCr as number)}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Net</p><p className={`text-lg font-bold ${(data.net as number) >= 0 ? "text-green-700" : "text-red-600"}`}>{fmt(data.net as number)}</p></CardContent></Card>
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
            {rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium capitalize">{String(r.sourceType).replace(/_/g, " ")}</TableCell>
                <TableCell className="text-right">{String(r.count)}</TableCell>
                <TableCell className="text-right tabular-nums text-green-700">{fmt(r.dr as number)}</TableCell>
                <TableCell className="text-right tabular-nums text-red-600">{fmt(r.cr as number)}</TableCell>
                <TableCell className={`text-right tabular-nums font-medium ${(r.net as number) >= 0 ? "text-green-700" : "text-red-600"}`}>{fmt(r.net as number)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </>
    );
  }

  // ── Cash Book ─────────────────────────────────────────────
  if (active === "cash-book") {
    return (
      <>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Receipts</p><p className="text-lg font-bold text-green-700">{fmt(data.totalReceipts as number)}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Payments</p><p className="text-lg font-bold text-red-600">{fmt(data.totalPayments as number)}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Closing Balance</p><p className={`text-lg font-bold ${(data.closingBalance as number) >= 0 ? "text-green-700" : "text-red-600"}`}>{fmt(data.closingBalance as number)}</p></CardContent></Card>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Entry #</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((e, i) => (
              <TableRow key={i}>
                <TableCell className="text-sm">{String(e.date ?? "").slice(0, 10)}</TableCell>
                <TableCell className="font-mono text-xs">{String(e.entryNumber ?? "—")}</TableCell>
                <TableCell className="text-sm max-w-xs truncate">{String(e.description ?? "—")}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={e.type === "receipt" ? "text-green-700 border-green-300" : "text-red-700 border-red-300"}>
                    {String(e.type)}
                  </Badge>
                </TableCell>
                <TableCell className={`text-right tabular-nums text-sm ${e.type === "receipt" ? "text-green-700" : "text-red-600"}`}>{fmt(e.amount as number)}</TableCell>
                <TableCell className={`text-right tabular-nums text-sm font-medium ${(e.runningBalance as number) < 0 ? "text-red-600" : ""}`}>{fmt(e.runningBalance as number)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </>
    );
  }

  // ── Receipt Book ─────────────────────────────────────────
  if (active === "receipt-book") {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Ref #</TableHead>
            <TableHead>Narration / Description</TableHead>
            <TableHead>Party</TableHead>
            <TableHead>Vendor</TableHead>
            <TableHead>Source</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>
              <TableCell className="text-sm">{String(r.date ?? "").slice(0, 10)}</TableCell>
              <TableCell className="font-mono text-xs">{String(r.ref ?? "—")}</TableCell>
              <TableCell className="text-sm max-w-xs truncate">{String(r.narration ?? "—")}</TableCell>
              <TableCell className="text-sm">{String(r.partyName ?? "—")}</TableCell>
              <TableCell className="text-sm">{String(r.vendorName ?? "—")}</TableCell>
              <TableCell><Badge variant="outline" className="text-xs capitalize">{String(r.source)}</Badge></TableCell>
              <TableCell className="text-right tabular-nums text-sm">{fmt(r.amount as number)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  // ── Payment Book ─────────────────────────────────────────
  if (active === "payment-book") {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Voucher #</TableHead>
            <TableHead>Narration</TableHead>
            <TableHead>Party</TableHead>
            <TableHead>Vendor</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>
              <TableCell className="text-sm">{String(r.date ?? "").slice(0, 10)}</TableCell>
              <TableCell className="font-mono text-xs">{String(r.ref ?? "—")}</TableCell>
              <TableCell className="text-sm max-w-xs truncate">{String(r.narration ?? "—")}</TableCell>
              <TableCell className="text-sm">{String(r.partyName ?? "—")}</TableCell>
              <TableCell className="text-sm">{String(r.vendorName ?? "—")}</TableCell>
              <TableCell><Badge variant="outline" className="text-xs capitalize">{String(r.status)}</Badge></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  // ── Journal Book ─────────────────────────────────────────
  if (active === "journal-book") {
    return (
      <>
        <div className="flex justify-end mb-3">
          <p className="text-sm text-muted-foreground">Total posted: <span className="font-bold tabular-nums">{fmt(data.totalAmount as number)}</span></p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Entry #</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>DR Account</TableHead>
              <TableHead>CR Account</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((e, i) => (
              <TableRow key={i}>
                <TableCell className="text-sm">{String(e.date ?? "").slice(0, 10)}</TableCell>
                <TableCell className="font-mono text-xs">{String(e.entryNumber ?? "—")}</TableCell>
                <TableCell className="text-sm max-w-xs truncate">{String(e.description ?? "—")}</TableCell>
                <TableCell className="text-xs">{(e.debitAccount as { name?: string })?.name ?? "—"}</TableCell>
                <TableCell className="text-xs">{(e.creditAccount as { name?: string })?.name ?? "—"}</TableCell>
                <TableCell><Badge variant="outline" className="text-xs capitalize">{String(e.sourceType ?? "manual").replace(/_/g, " ")}</Badge></TableCell>
                <TableCell className="text-right tabular-nums text-sm">{fmt(e.amount as number)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </>
    );
  }

  // ── Voucher Search ────────────────────────────────────────
  if (active === "voucher-search") {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Voucher #</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Narration</TableHead>
            <TableHead>Party</TableHead>
            <TableHead>Vendor</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((v, i) => (
            <TableRow key={i}>
              <TableCell className="font-mono text-xs">{String(v.voucherNumber ?? "—")}</TableCell>
              <TableCell className="text-sm">{String(v.date ?? "").slice(0, 10)}</TableCell>
              <TableCell><Badge className="text-xs font-mono">{String(v.type)}</Badge></TableCell>
              <TableCell className="text-sm max-w-xs truncate">{String(v.narration ?? "—")}</TableCell>
              <TableCell className="text-sm">{String(v.partyName ?? "—")}</TableCell>
              <TableCell className="text-sm">{String(v.vendorName ?? "—")}</TableCell>
              <TableCell>
                <Badge variant="outline" className={`text-xs capitalize ${v.status === "posted" ? "text-green-700" : v.status === "reversed" ? "text-red-600" : ""}`}>
                  {String(v.status)}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  // ── DN Report ─────────────────────────────────────────────
  if (active === "dn-report") {
    return (
      <>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Receivable (SAR)</p><p className="text-lg font-bold text-blue-700">{fmt(data.totalRecvSar as number)}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Payable (SAR)</p><p className="text-lg font-bold text-orange-700">{fmt(data.totalPaySar as number)}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Gross Profit (SAR)</p><p className={`text-lg font-bold ${(data.profitSar as number) >= 0 ? "text-green-700" : "text-red-600"}`}>{fmt(data.profitSar as number)}</p></CardContent></Card>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>DN #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Party</TableHead>
              <TableHead>Hotel</TableHead>
              <TableHead>Check-In</TableHead>
              <TableHead>Rooms</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Recv SAR</TableHead>
              <TableHead className="text-right">Pay SAR</TableHead>
              <TableHead className="text-right">Profit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => {
              const profit = (r.receivableSar as number ?? 0) - (r.payableSar as number ?? 0);
              return (
                <TableRow key={i}>
                  <TableCell className="font-mono text-xs">{String(r.dnNumber)}</TableCell>
                  <TableCell className="text-sm">{String(r.invoiceDate ?? "—")}</TableCell>
                  <TableCell className="text-sm">{String(r.partyName ?? "—")}</TableCell>
                  <TableCell className="text-sm">{String(r.hotelName ?? "—")}</TableCell>
                  <TableCell className="text-sm">{String(r.checkIn ?? "—")}</TableCell>
                  <TableCell className="text-sm">{String(r.noOfRooms ?? 1)}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs capitalize">{String(r.status)}</Badge></TableCell>
                  <TableCell className="text-right tabular-nums text-sm text-blue-700">{fmt(r.receivableSar as number)}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm text-orange-700">{fmt(r.payableSar as number)}</TableCell>
                  <TableCell className={`text-right tabular-nums text-sm font-medium ${profit >= 0 ? "text-green-700" : "text-red-600"}`}>{fmt(profit)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </>
    );
  }

  // ── Hotel Check-In / Check-Out ────────────────────────────
  if (active === "hotel-checkin") {
    return (
      <>
        <p className="text-sm text-muted-foreground mb-3">{rows.length} booking(s) found</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>DN #</TableHead>
              <TableHead>Party</TableHead>
              <TableHead>Hotel</TableHead>
              <TableHead>Room Type</TableHead>
              <TableHead>Check-In</TableHead>
              <TableHead>Check-Out</TableHead>
              <TableHead className="text-right">Nights</TableHead>
              <TableHead className="text-right">Rooms</TableHead>
              <TableHead className="text-right">PAX</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell className="font-mono text-xs">{String(r.dnNumber)}</TableCell>
                <TableCell className="text-sm">{String(r.partyName ?? "—")}</TableCell>
                <TableCell className="text-sm">{String(r.hotelName ?? "—")}</TableCell>
                <TableCell className="text-sm">{String(r.roomType ?? "—")}</TableCell>
                <TableCell className="text-sm">{String(r.checkIn ?? "—")}</TableCell>
                <TableCell className="text-sm">{String(r.checkOut ?? "—")}</TableCell>
                <TableCell className="text-right text-sm">{String(r.noOfNights ?? "—")}</TableCell>
                <TableCell className="text-right text-sm">{String(r.noOfRooms ?? 1)}</TableCell>
                <TableCell className="text-right text-sm">{String(r.noOfPax ?? 1)}</TableCell>
                <TableCell><Badge variant="outline" className="text-xs capitalize">{String(r.status)}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </>
    );
  }

  // ── Booking Validation ────────────────────────────────────
  if (active === "booking-validation") {
    const allRows = rows as Array<{ dnNumber: string; partyName?: string; hotelName?: string; issues: string[]; hasIssues: boolean }>;
    const withIssues = allRows.filter((r) => r.hasIssues);
    return (
      <>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">With Issues</p><p className="text-lg font-bold text-red-600">{data.totalWithIssues as number ?? 0}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Clean</p><p className="text-lg font-bold text-green-700">{data.totalClean as number ?? 0}</p></CardContent></Card>
        </div>
        {withIssues.length === 0
          ? <div className="text-center py-8 text-green-700 font-medium">✓ All bookings are valid</div>
          : (
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
                {withIssues.map((r, i) => (
                  <TableRow key={i} className="bg-red-50/40">
                    <TableCell className="font-mono text-xs">{r.dnNumber}</TableCell>
                    <TableCell className="text-sm">{r.partyName ?? "—"}</TableCell>
                    <TableCell className="text-sm">{r.hotelName ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {r.issues.map((issue, j) => (
                          <Badge key={j} className="bg-red-100 text-red-700 text-xs border-0">{issue}</Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
      </>
    );
  }

  // ── Search Hotel Invoice ──────────────────────────────────
  if (active === "search-hotel-invoice") {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>DN #</TableHead>
            <TableHead>CNF #</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Passenger</TableHead>
            <TableHead>Hotel</TableHead>
            <TableHead>Check-In</TableHead>
            <TableHead>Party</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Recv SAR</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>
              <TableCell className="font-mono text-xs">{String(r.dnNumber)}</TableCell>
              <TableCell className="font-mono text-xs">{String(r.cnfNumber ?? "—")}</TableCell>
              <TableCell className="text-sm">{String(r.invoiceDate ?? "—")}</TableCell>
              <TableCell className="text-sm">{String(r.passengerName ?? "—")}</TableCell>
              <TableCell className="text-sm">{String(r.hotelName ?? "—")}</TableCell>
              <TableCell className="text-sm">{String(r.checkIn ?? "—")}</TableCell>
              <TableCell className="text-sm">{String(r.partyName ?? "—")}</TableCell>
              <TableCell><Badge variant="outline" className="text-xs capitalize">{String(r.status)}</Badge></TableCell>
              <TableCell className="text-right tabular-nums text-sm">{fmt(r.receivableSar as number)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  // ── Search Transport Invoice ──────────────────────────────
  if (active === "search-transport-invoice") {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Vendor</TableHead>
            <TableHead>Pickup → Dropoff</TableHead>
            <TableHead>Driver</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>
              <TableCell className="text-sm">{String(r.createdAt ?? "—").slice(0, 10)}</TableCell>
              <TableCell><Badge variant="outline" className="text-xs capitalize">{String(r.type)}</Badge></TableCell>
              <TableCell className="text-sm">{String(r.clientName ?? "—")}</TableCell>
              <TableCell className="text-sm">{String(r.vendorName ?? "—")}</TableCell>
              <TableCell className="text-xs max-w-xs truncate">{String(r.pickupLocation ?? "—")} → {String(r.dropoffLocation ?? "—")}</TableCell>
              <TableCell className="text-sm">{String(r.driverName ?? "—")}</TableCell>
              <TableCell><Badge variant="outline" className="text-xs capitalize">{String(r.status)}</Badge></TableCell>
              <TableCell className="text-right tabular-nums text-sm">{fmt(r.fare as number)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  // ── Search Ref Invoice ────────────────────────────────────
  if (active === "search-ref-invoice") {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>Ref #</TableHead>
            <TableHead>Secondary Ref</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>
              <TableCell><Badge className="text-xs capitalize">{String(r.type).replace(/_/g, " ")}</Badge></TableCell>
              <TableCell className="font-mono text-xs">{String(r.ref)}</TableCell>
              <TableCell className="font-mono text-xs">{String(r.secondary ?? "—")}</TableCell>
              <TableCell className="text-sm">{String(r.date ?? "—").slice(0, 10)}</TableCell>
              <TableCell className="text-sm max-w-xs truncate">{String(r.description ?? "—")}</TableCell>
              <TableCell><Badge variant="outline" className="text-xs capitalize">{String(r.status)}</Badge></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  // ── Room Occupancy ────────────────────────────────────────
  if (active === "room-occupancy") {
    return (
      <>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Bookings</p><p className="text-lg font-bold">{String(data.totalBookings ?? 0)}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Room-Nights</p><p className="text-lg font-bold text-blue-700">{String(data.totalRoomNights ?? 0)}</p></CardContent></Card>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Hotel</TableHead>
              <TableHead>Room Type</TableHead>
              <TableHead className="text-right">Bookings</TableHead>
              <TableHead className="text-right">Total Rooms</TableHead>
              <TableHead className="text-right">Room-Nights</TableHead>
              <TableHead className="text-right">Total PAX</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium text-sm">{String(r.hotelName)}</TableCell>
                <TableCell className="text-sm">{String(r.roomType)}</TableCell>
                <TableCell className="text-right tabular-nums">{String(r.bookings)}</TableCell>
                <TableCell className="text-right tabular-nums">{String(r.totalRooms)}</TableCell>
                <TableCell className="text-right tabular-nums font-medium text-blue-700">{String(r.totalRoomNights)}</TableCell>
                <TableCell className="text-right tabular-nums">{String(r.totalPax)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </>
    );
  }

  // ── Fortnight Ledger ─────────────────────────────────────
  if (active === "fortnight-ledger") {
    const account = data.account as { code: string; name: string } | null;
    return (
      <>
        {account && (
          <div className="flex gap-4 mb-4">
            <Card className="flex-1"><CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Account</p>
              <p className="font-bold">{account.code} — {account.name}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total DR</p><p className="text-lg font-bold text-green-700">{fmt(data.totalDr as number)}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total CR</p><p className="text-lg font-bold text-red-600">{fmt(data.totalCr as number)}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Closing Balance</p><p className={`text-lg font-bold ${(data.closing as number) >= 0 ? "text-green-700" : "text-red-600"}`}>{fmt(data.closing as number)}</p></CardContent></Card>
          </div>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead className="text-right">Entries</TableHead>
              <TableHead className="text-right">Opening</TableHead>
              <TableHead className="text-right">Total DR</TableHead>
              <TableHead className="text-right">Total CR</TableHead>
              <TableHead className="text-right">Closing</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell className="text-sm font-medium">{String(r.label)}</TableCell>
                <TableCell className="text-right tabular-nums text-sm">{String(r.count)}</TableCell>
                <TableCell className="text-right tabular-nums text-sm">{fmt(r.opening as number)}</TableCell>
                <TableCell className="text-right tabular-nums text-sm text-green-700">{fmt(r.dr as number)}</TableCell>
                <TableCell className="text-right tabular-nums text-sm text-red-600">{fmt(r.cr as number)}</TableCell>
                <TableCell className={`text-right tabular-nums text-sm font-bold ${(r.closing as number) < 0 ? "text-red-600" : "text-green-700"}`}>{fmt(r.closing as number)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </>
    );
  }

  // ── Foreign Currency Ledger ───────────────────────────────
  if (active === "fx-ledger") {
    return (
      <>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total FC Amount</p><p className="text-lg font-bold text-blue-700">{fmt(data.totalFc as number)}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total PKR Revenue</p><p className="text-lg font-bold">{fmt(data.totalPkr as number)}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Profit</p><p className={`text-lg font-bold ${(data.totalProfit as number) >= 0 ? "text-green-700" : "text-red-600"}`}>{fmt(data.totalProfit as number)}</p></CardContent></Card>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="text-right">FC Amount</TableHead>
              <TableHead className="text-right">Client Rate</TableHead>
              <TableHead className="text-right">PKR Revenue</TableHead>
              <TableHead className="text-right">PKR Cost</TableHead>
              <TableHead className="text-right">Profit</TableHead>
              <TableHead className="text-right">Running FC</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell className="text-sm">{String(r.date ?? "—").slice(0, 10)}</TableCell>
                <TableCell><Badge className="text-xs font-mono">{String(r.currency)}</Badge></TableCell>
                <TableCell className="text-sm max-w-xs truncate">{String(r.notes ?? "—")}</TableCell>
                <TableCell className="text-right tabular-nums text-sm">{fmt(r.amount as number)}</TableCell>
                <TableCell className="text-right tabular-nums text-sm">{fmt(r.clientRate as number)}</TableCell>
                <TableCell className="text-right tabular-nums text-sm text-green-700">{fmt(r.clientRevenue as number)}</TableCell>
                <TableCell className="text-right tabular-nums text-sm text-orange-700">{fmt(r.vendorCost as number)}</TableCell>
                <TableCell className={`text-right tabular-nums text-sm font-medium ${(r.profit as number) >= 0 ? "text-green-700" : "text-red-600"}`}>{fmt(r.profit as number)}</TableCell>
                <TableCell className="text-right tabular-nums text-sm font-medium">{fmt(r.runningFc as number)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </>
    );
  }

  return null;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AccountingReportsPage() {
  const { token } = useAuth();
  const [active, setActive] = useState<ReportType>("cash-book");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [applied, setApplied] = useState<Record<string, string>>({});

  const { data, isLoading, error } = useReport(active, applied, token);
  const { data: clients = [] } = useClients(token);
  const { data: vendors = [] } = useVendors(token);
  const { data: accounts = [] } = useAccounts(token);
  const { data: hotels = [] } = useHotels(token);

  const setFilter = (key: string, val: string) => setFilters((prev) => ({ ...prev, [key]: val }));

  function generate() {
    const params: Record<string, string> = {};
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    if (active === "hotel-checkin" && !params.type) params.type = "checkin";
    params._run = String(Date.now());
    setApplied(params);
  }

  function clearAll() {
    setFilters({});
    setApplied({});
  }

  function handleExportCsv() {
    if (!data) return;
    const rows = (data.entries ?? data.rows ?? []) as Record<string, unknown>[];
    const def = REPORTS.find((r) => r.id === active)!;
    exportToCsv(rows, `${def.label.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}`);
  }

  function handlePrint() {
    window.print();
  }

  const currentDef = REPORTS.find((r) => r.id === active)!;
  const rows = data ? ((data.entries ?? data.rows ?? []) as unknown[]) : [];
  const hasData = !!data && rows.length > 0;

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          .print-area { box-shadow: none !important; border: none !important; }
          table { font-size: 11px; }
          th, td { padding: 4px 6px !important; }
        }
      `}</style>

      <div className="p-6 space-y-6">
        <div className="no-print">
          <h1 className="text-2xl font-bold">Accounting Reports</h1>
          <p className="text-sm text-muted-foreground">Business operations and management reports</p>
        </div>

        <div className="grid grid-cols-4 gap-6">
          {/* Sidebar report picker */}
          <div className="col-span-1 space-y-4 no-print">
            {CATEGORIES.map((cat) => (
              <div key={cat}>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{cat}</p>
                <div className="space-y-0.5">
                  {REPORTS.filter((r) => r.category === cat).map((r) => {
                    const Icon = r.icon;
                    return (
                      <button
                        key={r.id}
                        onClick={() => { setActive(r.id); setFilters({}); setApplied({}); }}
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
            {/* Header */}
            <div className="flex items-center justify-between no-print">
              <div>
                <h2 className="text-lg font-semibold">{currentDef.label}</h2>
                <p className="text-sm text-muted-foreground">{currentDef.description}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handlePrint} disabled={!hasData}>
                  <Printer className="h-4 w-4 mr-1.5" /> Print
                </Button>
                <Button size="sm" variant="outline" onClick={handleExportCsv} disabled={!hasData}>
                  <Download className="h-4 w-4 mr-1.5" /> CSV
                </Button>
              </div>
            </div>

            {/* Print header (hidden on screen) */}
            <div className="hidden print:block mb-4">
              <h1 className="text-xl font-bold">Al Musafir International</h1>
              <h2 className="text-lg">{currentDef.label}</h2>
              {applied.from && <p className="text-sm">Period: {applied.from} to {applied.to || "present"}</p>}
              <p className="text-sm text-gray-500">Generated: {new Date().toLocaleDateString("en-PK")}</p>
            </div>

            {/* Filters */}
            <div className="flex gap-3 items-end flex-wrap no-print">
              <FilterBar
                active={active}
                filters={filters}
                setFilter={setFilter}
                clients={clients}
                vendors={vendors}
                accounts={accounts}
                hotels={hotels}
              />
              <Button size="sm" onClick={generate}>Generate</Button>
              {Object.keys(applied).length > 0 && (
                <Button size="sm" variant="ghost" onClick={clearAll}>Clear</Button>
              )}
            </div>

            {/* Results */}
            <Card className="print-area">
              <CardContent className="p-0 overflow-x-auto">
                {Object.keys(applied).length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileBarChart className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p>Set filters and click <strong>Generate</strong> to run this report</p>
                  </div>
                ) : isLoading ? (
                  <div className="text-center py-12 text-muted-foreground">Loading…</div>
                ) : error ? (
                  <div className="text-center py-8 text-red-600 text-sm">{(error as Error).message}</div>
                ) : (
                  renderReport(active, data as Record<string, unknown>)
                )}
              </CardContent>
            </Card>

            {hasData && (
              <p className="text-xs text-muted-foreground no-print">
                {rows.length} record(s) returned
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
