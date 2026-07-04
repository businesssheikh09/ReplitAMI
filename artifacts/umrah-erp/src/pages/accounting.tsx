import { useState, useMemo } from "react";
import { useListInvoices, useCreateInvoice, useListExpenses, useCreateExpense, useListClients } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Receipt, DollarSign, TrendingUp, TrendingDown, Hotel, ExternalLink, BarChart2, Plane } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";

const INV_STATUS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-700",
  partial: "bg-amber-100 text-amber-700",
  paid: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
  confirmed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  invoiced: "bg-blue-100 text-blue-700",
};

const WRITE_ROLES = ["accounts", "management", "admin"];

// ── Helpers ───────────────────────────────────────────────────────────────────
function getWeekBounds() {
  const now = new Date();
  const day = now.getDay();
  const mon = new Date(now); mon.setDate(now.getDate() - ((day + 6) % 7));
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(mon), to: fmt(sun) };
}

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

// ── Report section header (navy band) ────────────────────────────────────────
function ReportHeader({ title }: { title: string }) {
  return (
    <div className="bg-blue-900 text-white text-center text-sm font-bold py-2 tracking-widest rounded-t">
      {title}
    </div>
  );
}

// ── Analysis tab content ──────────────────────────────────────────────────────
function AnalysisTab({ dnInvs }: { dnInvs: any[] }) {
  const wb = getWeekBounds();
  const [from, setFrom] = useState(wb.from);
  const [to, setTo]     = useState(wb.to);

  // ── Date-filtered invoice set (drives both Booking Summary and Schedule) ───
  const filteredByRange = useMemo(() => {
    return dnInvs.filter(inv => {
      if (!inv.checkIn) return false;
      return inv.checkIn >= from && inv.checkIn <= to;
    });
  }, [dnInvs, from, to]);

  // ── Booking Summary by status (uses date-filtered set) ────────────────────
  const statusGroups = useMemo(() => {
    const statuses = ["draft", "confirmed", "cancelled", "invoiced"];
    return statuses.map(s => {
      const rows = filteredByRange.filter(inv => inv.status === s);
      return {
        status: s,
        count: rows.length,
        nights: rows.reduce((acc, r) => acc + (r.noOfNights ?? 0), 0),
        recvSar: rows.reduce((acc, r) => acc + (Number(r.receivableSar) || 0), 0),
        paySar: rows.reduce((acc, r) => acc + (Number(r.payableSar) || 0), 0),
      };
    });
  }, [filteredByRange]);

  // ── Check-In Schedule (same date-filtered set, sorted) ────────────────────
  const schedule = useMemo(() => {
    return [...filteredByRange].sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  }, [filteredByRange]);

  // ── Financial P&L by party ────────────────────────────────────────────────
  const pnl = useMemo(() => {
    const map = new Map<string, { recv: number; pay: number; nights: number; count: number }>();
    for (const inv of dnInvs) {
      const party = inv.partyName || "Unknown";
      const cur = map.get(party) ?? { recv: 0, pay: 0, nights: 0, count: 0 };
      map.set(party, {
        recv:   cur.recv   + (Number(inv.receivableSar) || 0),
        pay:    cur.pay    + (Number(inv.payableSar)    || 0),
        nights: cur.nights + (inv.noOfNights ?? 0),
        count:  cur.count  + 1,
      });
    }
    return Array.from(map.entries())
      .map(([party, v]) => ({ party, ...v, profit: v.recv - v.pay }))
      .sort((a, b) => b.recv - a.recv);
  }, [dnInvs]);

  const totalPnl = pnl.reduce((acc, r) => ({
    recv: acc.recv + r.recv, pay: acc.pay + r.pay, profit: acc.profit + r.profit, nights: acc.nights + r.nights,
  }), { recv: 0, pay: 0, profit: 0, nights: 0 });

  const totalBooking = statusGroups.reduce((acc, r) => ({
    count: acc.count + r.count, nights: acc.nights + r.nights,
    recvSar: acc.recvSar + r.recvSar, paySar: acc.paySar + r.paySar,
  }), { count: 0, nights: 0, recvSar: 0, paySar: 0 });

  return (
    <div className="space-y-6">
      {/* Date range filter */}
      <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
        <span className="text-sm font-semibold text-blue-900">Date Range (Check-In)</span>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">From</Label>
          <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-8 text-sm w-36" />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">To</Label>
          <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-8 text-sm w-36" />
        </div>
        <Button variant="outline" size="sm" onClick={() => { const w = getWeekBounds(); setFrom(w.from); setTo(w.to); }} className="text-xs">
          This Week
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Booking Summary ── */}
        <div className="border border-blue-200 rounded overflow-hidden shadow-sm">
          <ReportHeader title="BOOKING SUMMARY" />
          <Table>
            <TableHeader>
              <TableRow className="bg-blue-50">
                <TableHead className="font-bold text-blue-900">Status</TableHead>
                <TableHead className="text-center font-bold text-blue-900">Count</TableHead>
                <TableHead className="text-center font-bold text-blue-900">Nights</TableHead>
                <TableHead className="text-right font-bold text-blue-900">Recv SAR</TableHead>
                <TableHead className="text-right font-bold text-blue-900">Pay SAR</TableHead>
                <TableHead className="text-right font-bold text-blue-900">Profit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statusGroups.map((r, i) => (
                <TableRow key={r.status} className={i % 2 === 0 ? "bg-white" : "bg-blue-50/40"}>
                  <TableCell>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${INV_STATUS[r.status] || "bg-gray-100"}`}>
                      {r.status.toUpperCase()}
                    </span>
                  </TableCell>
                  <TableCell className="text-center font-semibold">{r.count}</TableCell>
                  <TableCell className="text-center">{r.nights}</TableCell>
                  <TableCell className="text-right">{fmt(r.recvSar)}</TableCell>
                  <TableCell className="text-right">{fmt(r.paySar)}</TableCell>
                  <TableCell className={`text-right font-semibold ${r.recvSar - r.paySar >= 0 ? "text-green-700" : "text-red-600"}`}>
                    {fmt(r.recvSar - r.paySar)}
                  </TableCell>
                </TableRow>
              ))}
              {/* Totals */}
              <TableRow className="bg-blue-900 text-white font-bold">
                <TableCell className="text-white">Total ({totalBooking.count})</TableCell>
                <TableCell className="text-center text-white">{totalBooking.count}</TableCell>
                <TableCell className="text-center text-white">{totalBooking.nights}</TableCell>
                <TableCell className="text-right text-white">{fmt(totalBooking.recvSar)}</TableCell>
                <TableCell className="text-right text-white">{fmt(totalBooking.paySar)}</TableCell>
                <TableCell className="text-right text-white">{fmt(totalBooking.recvSar - totalBooking.paySar)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {/* ── Financial P&L by Party ── */}
        <div className="border border-blue-200 rounded overflow-hidden shadow-sm">
          <ReportHeader title="FINANCIAL P&L BY PARTY (SAR)" />
          <Table>
            <TableHeader>
              <TableRow className="bg-blue-50">
                <TableHead className="font-bold text-blue-900">S#</TableHead>
                <TableHead className="font-bold text-blue-900">Party</TableHead>
                <TableHead className="text-center font-bold text-blue-900">Inv</TableHead>
                <TableHead className="text-right font-bold text-blue-900">Recv</TableHead>
                <TableHead className="text-right font-bold text-blue-900">Pay</TableHead>
                <TableHead className="text-right font-bold text-blue-900">Profit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pnl.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center h-20 text-muted-foreground">No invoice data yet</TableCell></TableRow>
              ) : pnl.map((r, i) => (
                <TableRow key={r.party} className={i % 2 === 0 ? "bg-white" : "bg-blue-50/40"}>
                  <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                  <TableCell className="font-medium">{r.party}</TableCell>
                  <TableCell className="text-center text-sm">{r.count}</TableCell>
                  <TableCell className="text-right">{fmt(r.recv)}</TableCell>
                  <TableCell className="text-right">{fmt(r.pay)}</TableCell>
                  <TableCell className={`text-right font-semibold ${r.profit >= 0 ? "text-green-700" : "text-red-600"}`}>
                    {fmt(r.profit)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-blue-900 text-white font-bold">
                <TableCell className="text-white" colSpan={2}>Grand Total</TableCell>
                <TableCell className="text-center text-white">{pnl.reduce((a, r) => a + r.count, 0)}</TableCell>
                <TableCell className="text-right text-white">{fmt(totalPnl.recv)}</TableCell>
                <TableCell className="text-right text-white">{fmt(totalPnl.pay)}</TableCell>
                <TableCell className={`text-right font-bold ${totalPnl.profit >= 0 ? "text-green-300" : "text-red-300"}`}>{fmt(totalPnl.profit)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ── Hotel Check-In Schedule ── */}
      <div className="border border-blue-200 rounded overflow-hidden shadow-sm">
        <ReportHeader title={`HOTEL CHECK-IN SCHEDULE  ·  ${from} to ${to}`} />
        <Table>
          <TableHeader>
            <TableRow className="bg-blue-50">
              {["S#","DN#","Party","Passenger","Hotel","Check In","Check Out","N#","Room Type","Status"].map(h => (
                <TableHead key={h} className="font-bold text-blue-900 text-xs py-2">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {schedule.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center h-24 text-muted-foreground">
                  No check-ins found for the selected date range
                </TableCell>
              </TableRow>
            ) : schedule.map((inv, i) => (
              <TableRow key={inv.id} className={i % 2 === 0 ? "bg-white" : "bg-blue-50/40"}>
                <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                <TableCell className="font-mono text-xs font-semibold text-blue-700">{inv.dnNumber}</TableCell>
                <TableCell className="text-sm font-medium">{inv.partyName || "—"}</TableCell>
                <TableCell className="text-sm">{inv.passengerName || "—"}</TableCell>
                <TableCell className="text-sm">{inv.hotelName || "—"}</TableCell>
                <TableCell className="text-sm font-medium text-blue-900">{inv.checkIn}</TableCell>
                <TableCell className="text-sm">{inv.checkOut}</TableCell>
                <TableCell className="text-center text-sm font-semibold">{inv.noOfNights ?? "—"}</TableCell>
                <TableCell className="text-sm">{inv.roomType || "—"}</TableCell>
                <TableCell>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${INV_STATUS[inv.status] || "bg-gray-100"}`}>
                    {inv.status}
                  </span>
                </TableCell>
              </TableRow>
            ))}
            {schedule.length > 0 && (
              <TableRow className="bg-blue-900 text-white">
                <TableCell colSpan={7} className="text-white font-bold">Total HV {schedule.length}</TableCell>
                <TableCell className="text-center text-white font-bold">
                  {schedule.reduce((a, r) => a + (r.noOfNights ?? 0), 0)}
                </TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ── Flight Revenue Tab ────────────────────────────────────────────────────────
function FlightRevenueTab() {
  const { token } = useAuth();

  const { data: issued = [], isLoading } = useQuery<any[]>({
    queryKey: ["flight-requests-issued", token],
    queryFn: () =>
      fetch("/api/flight-requests?status=issued", {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()),
    enabled: !!token,
    staleTime: 60_000,
  });

  const totalBooking = issued.reduce((s, r) => s + (r.bookingFare ?? 0), 0);
  const totalActual  = issued.reduce((s, r) => s + (r.actualFare  ?? 0), 0);
  const totalMarkup  = totalBooking - totalActual;

  const kpis = [
    { label: "Issued Flights", value: String(issued.length), color: "text-blue-600" },
    { label: "Total Booking Fare (PKR)", value: totalBooking.toLocaleString(), color: "text-primary" },
    { label: "Total Actual Cost (PKR)", value: totalActual.toLocaleString(), color: "text-orange-600" },
    { label: "Total Markup (PKR)", value: totalMarkup.toLocaleString(), color: totalMarkup >= 0 ? "text-emerald-600" : "text-red-500" },
  ];

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground mb-1">{k.label}</p>
              <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="h-40 flex items-center justify-center text-muted-foreground">Loading…</div>
          ) : issued.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center text-muted-foreground gap-2">
              <Plane className="h-8 w-8 opacity-30" />
              <p>No issued flights yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ref #</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Airline</TableHead>
                  <TableHead className="text-right">Actual Fare</TableHead>
                  <TableHead className="text-right">Booking Fare</TableHead>
                  <TableHead className="text-right">Markup</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {issued.map((r: any) => {
                  const markup = (r.bookingFare ?? 0) - (r.actualFare ?? 0);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs text-primary">{r.requestNumber}</TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{r.clientName}</div>
                        <div className="text-xs text-muted-foreground">{r.clientPhone}</div>
                      </TableCell>
                      <TableCell className="font-medium text-sm">{r.origin} → {r.destination}</TableCell>
                      <TableCell className="text-sm">{r.departureDate}</TableCell>
                      <TableCell className="text-sm">{r.airline ?? "—"}</TableCell>
                      <TableCell className="text-right text-sm">
                        {r.actualFare != null ? `PKR ${Number(r.actualFare).toLocaleString()}` : "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold text-primary">
                        {r.bookingFare != null ? `PKR ${Number(r.bookingFare).toLocaleString()}` : "—"}
                      </TableCell>
                      <TableCell className={`text-right text-sm font-semibold ${markup >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {r.bookingFare != null || r.actualFare != null ? `PKR ${markup.toLocaleString()}` : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AccountingPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { user, token } = useAuth();
  const canWrite = WRITE_ROLES.includes(user?.role ?? "");
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [invForm, setInvForm] = useState({ clientId: "", amount: "", currency: "USD", dueDate: "", notes: "" });
  const [expForm, setExpForm] = useState({ title: "", category: "office", amount: "", currency: "USD", date: "", notes: "" });

  const { data: invoices = [], isLoading: invLoading } = useListInvoices({});
  const { data: expenses = [], isLoading: expLoading } = useListExpenses({});
  const { data: clients = [] } = useListClients({});
  const { data: hotelInvoices = [], isLoading: hotelInvLoading } = useQuery<any[]>({
    queryKey: ["/api/invoices/hotel"],
    queryFn: async () => {
      const res = await fetch("/api/invoices/hotel", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });
  const [hotelSearch, setHotelSearch] = useState("");
  const createInvoice = useCreateInvoice({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/invoices"] }); setInvoiceOpen(false); toast({ title: "Invoice created" }); } } });
  const createExpense = useCreateExpense({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/expenses"] }); setExpenseOpen(false); toast({ title: "Expense recorded" }); } } });

  const invs = invoices as any[];
  const exps = expenses as any[];
  const dnInvs = hotelInvoices as any[];
  const totalRevenue = invs.filter(i => i.status === "paid" || i.status === "partial").reduce((s, i) => s + (i.paidAmount || 0), 0);
  const totalExpenses = exps.reduce((s, e) => s + (e.amount || 0), 0);
  const profit = totalRevenue - totalExpenses;
  const outstanding = invs.filter(i => i.status !== "paid").reduce((s, i) => s + ((i.amount || 0) - (i.paidAmount || 0)), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Accounting</h2>
          <p className="text-muted-foreground">Invoices, payments, and expenses overview.</p>
        </div>
        <div className="flex gap-2">
          {canWrite && (
            <Button onClick={() => setLocation("/accounting/hotel-invoice/new")} className="bg-blue-900 hover:bg-blue-800 text-white">
              <Hotel className="mr-2 h-4 w-4" /> New Hotel Invoice (DN)
            </Button>
          )}
          <Dialog open={invoiceOpen} onOpenChange={setInvoiceOpen}>
            <DialogTrigger asChild><Button variant="outline"><Plus className="mr-2 h-4 w-4" />New Invoice</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Invoice</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Client</Label>
                  <Select value={invForm.clientId} onValueChange={v => setInvForm(p => ({ ...p, clientId: v }))}>
                    <SelectTrigger className="col-span-3"><SelectValue placeholder="Select client" /></SelectTrigger>
                    <SelectContent>{(clients as any[]).map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Amount</Label>
                  <Input type="number" className="col-span-3" value={invForm.amount} onChange={e => setInvForm(p => ({ ...p, amount: e.target.value }))} />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Currency</Label>
                  <Select value={invForm.currency} onValueChange={v => setInvForm(p => ({ ...p, currency: v }))}>
                    <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                    <SelectContent>{["USD","GBP","EUR","SAR"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Due Date</Label>
                  <Input type="date" className="col-span-3" value={invForm.dueDate} onChange={e => setInvForm(p => ({ ...p, dueDate: e.target.value }))} />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setInvoiceOpen(false)}>Cancel</Button>
                <Button onClick={() => createInvoice.mutate({ data: { ...invForm, clientId: invForm.clientId ? Number(invForm.clientId) : undefined, amount: Number(invForm.amount), type: "customer" } })} disabled={!invForm.clientId || !invForm.amount || !invForm.dueDate || createInvoice.isPending}>Create</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={expenseOpen} onOpenChange={setExpenseOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />New Expense</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Record Expense</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Title</Label>
                  <Input className="col-span-3" value={expForm.title} onChange={e => setExpForm(p => ({ ...p, title: e.target.value }))} />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Category</Label>
                  <Select value={expForm.category} onValueChange={v => setExpForm(p => ({ ...p, category: v }))}>
                    <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                    <SelectContent>{["office","marketing","operations","vendor_payment","staff","other"].map(c => <SelectItem key={c} value={c}>{c.replace(/_/g," ")}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Amount</Label>
                  <Input type="number" className="col-span-3" value={expForm.amount} onChange={e => setExpForm(p => ({ ...p, amount: e.target.value }))} />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Date</Label>
                  <Input type="date" className="col-span-3" value={expForm.date} onChange={e => setExpForm(p => ({ ...p, date: e.target.value }))} />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setExpenseOpen(false)}>Cancel</Button>
                <Button onClick={() => createExpense.mutate({ data: { ...expForm, amount: Number(expForm.amount) } })} disabled={!expForm.title || !expForm.amount || !expForm.date || createExpense.isPending}>Record</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Revenue",  value: `$${totalRevenue.toLocaleString()}`,  icon: TrendingUp,  color: "text-green-600" },
          { label: "Total Expenses", value: `$${totalExpenses.toLocaleString()}`, icon: TrendingDown, color: "text-red-600" },
          { label: "Net Profit",     value: `$${profit.toLocaleString()}`,         icon: DollarSign,  color: profit >= 0 ? "text-green-600" : "text-red-600" },
          { label: "Outstanding",    value: `$${outstanding.toLocaleString()}`,    icon: Receipt,     color: "text-amber-600" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-6 flex items-start gap-3">
              <s.icon className={`h-5 w-5 mt-0.5 ${s.color}`} />
              <div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
                <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="hotel-invoices">
        <TabsList>
          <TabsTrigger value="hotel-invoices">Hotel Invoices DN ({dnInvs.length})</TabsTrigger>
          <TabsTrigger value="invoices">General Invoices ({invs.length})</TabsTrigger>
          <TabsTrigger value="expenses">Expenses ({exps.length})</TabsTrigger>
          <TabsTrigger value="analysis" className="flex items-center gap-1">
            <BarChart2 className="h-3.5 w-3.5" /> Analysis
          </TabsTrigger>
          <TabsTrigger value="flights" className="flex items-center gap-1">
            <Plane className="h-3.5 w-3.5" /> Flight Revenue
          </TabsTrigger>
        </TabsList>

        {/* ── Hotel DN Invoices tab ── */}
        <TabsContent value="hotel-invoices" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">Hotel DN Invoices</CardTitle>
                <div className="flex items-center gap-2 flex-1 max-w-sm">
                  <Input
                    placeholder="Search DN#, party, hotel, passenger…"
                    value={hotelSearch}
                    onChange={e => setHotelSearch(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                {canWrite && (
                  <Button size="sm" onClick={() => setLocation("/accounting/hotel-invoice/new")} className="bg-blue-900 hover:bg-blue-800 text-white">
                    <Plus className="mr-1 h-4 w-4" /> New DN Invoice
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {hotelInvLoading ? (
                <div className="h-40 flex items-center justify-center text-muted-foreground">Loading...</div>
              ) : (() => {
                const q = hotelSearch.toLowerCase();
                const filtered = q
                  ? dnInvs.filter((inv: any) =>
                      (inv.dnNumber || "").toLowerCase().includes(q) ||
                      (inv.partyName || "").toLowerCase().includes(q) ||
                      (inv.passengerName || "").toLowerCase().includes(q) ||
                      (inv.hotelName || "").toLowerCase().includes(q) ||
                      (inv.status || "").toLowerCase().includes(q)
                    )
                  : dnInvs;
                return (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>DN #</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Party/Client</TableHead>
                        <TableHead>Passenger</TableHead>
                        <TableHead>Hotel</TableHead>
                        <TableHead>Check In</TableHead>
                        <TableHead>Check Out</TableHead>
                        <TableHead>Nights</TableHead>
                        <TableHead className="text-right">Recv SAR</TableHead>
                        <TableHead className="text-right">Pay SAR</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={12} className="text-center h-32 text-muted-foreground">
                            {q ? "No matching invoices." : "No hotel invoices yet. Click \"New DN Invoice\" to create one."}
                          </TableCell>
                        </TableRow>
                      ) : filtered.map((inv: any) => (
                        <TableRow key={inv.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => setLocation(`/accounting/hotel-invoice/${inv.id}`)}>
                          <TableCell className="font-mono font-semibold text-blue-700">{inv.dnNumber}</TableCell>
                          <TableCell className="text-sm">{inv.invoiceDate}</TableCell>
                          <TableCell className="font-medium">{inv.partyName || "—"}</TableCell>
                          <TableCell className="text-sm">{inv.passengerName || "—"}</TableCell>
                          <TableCell className="text-sm">{inv.hotelName || "—"}</TableCell>
                          <TableCell className="text-sm">{inv.checkIn || "—"}</TableCell>
                          <TableCell className="text-sm">{inv.checkOut || "—"}</TableCell>
                          <TableCell className="text-center">{inv.noOfNights ?? "—"}</TableCell>
                          <TableCell className="text-right font-medium">{inv.receivableSar != null ? Number(inv.receivableSar).toLocaleString() : "—"}</TableCell>
                          <TableCell className="text-right font-medium">{inv.payableSar != null ? Number(inv.payableSar).toLocaleString() : "—"}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${INV_STATUS[inv.status] || "bg-gray-100"}`}>{inv.status}</span>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); setLocation(`/accounting/hotel-invoice/${inv.id}`); }}>
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              {invLoading ? <div className="h-40 flex items-center justify-center text-muted-foreground">Loading...</div> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Paid</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invs.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center h-32 text-muted-foreground">No invoices</TableCell></TableRow>
                    ) : invs.map((i: any) => (
                      <TableRow key={i.id}>
                        <TableCell className="font-mono text-sm">{i.invoiceNumber}</TableCell>
                        <TableCell>{i.clientName || "—"}</TableCell>
                        <TableCell>{i.currency} {(i.amount || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-green-600">{i.currency} {(i.paidAmount || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-sm">{new Date(i.dueDate).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${INV_STATUS[i.status] || "bg-gray-100"}`}>{i.status}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expenses" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              {expLoading ? <div className="h-40 flex items-center justify-center text-muted-foreground">Loading...</div> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exps.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center h-32 text-muted-foreground">No expenses</TableCell></TableRow>
                    ) : exps.map((e: any) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-medium">{e.title}</TableCell>
                        <TableCell><span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs">{e.category.replace(/_/g," ")}</span></TableCell>
                        <TableCell className="font-semibold text-red-600">{e.currency} {(e.amount || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-sm">{new Date(e.date).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Analysis / Progress Report ── */}
        <TabsContent value="analysis" className="mt-4">
          <AnalysisTab dnInvs={dnInvs} />
        </TabsContent>

        {/* ── Flight Revenue ── */}
        <TabsContent value="flights" className="mt-4">
          <FlightRevenueTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
