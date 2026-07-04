import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Save, DollarSign, TrendingUp, TrendingDown, ArrowRightLeft } from "lucide-react";

const CURRENCIES = ["SAR", "AED", "USD", "EUR", "GBP", "PKR", "OMR", "KWD", "QAR", "BHD", "TRY", "EGP", "CAD", "AUD"];

const HOME_CURRENCIES = [
  { code: "PKR", name: "Pakistani Rupee" },
  { code: "USD", name: "US Dollar" },
  { code: "SAR", name: "Saudi Riyal" },
  { code: "AED", name: "UAE Dirham" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
];

const RATE_TIERS = [
  { value: "vendor", label: "Vendor Buy Rate", description: "Rate paid to buy from vendor (lowest)" },
  { value: "guest",  label: "Guest Sell Rate",  description: "Walk-in customer rate" },
  { value: "client", label: "Client/Subagent Rate", description: "Agent partner rate (highest)" },
] as const;

type RateTier = "vendor" | "guest" | "client";

const today = () => new Date().toISOString().slice(0, 10);

const EMPTY_RATE_FORM = { currency: "SAR", vendorRate: "", guestRate: "", clientRate: "", notes: "" };
const EMPTY_TX_FORM   = { currency: "SAR", amount: "", rateTier: "client" as RateTier, sellRate: "", date: today(), notes: "" };

export default function CurrencySettingsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { token } = useAuth();
  const authHdr = { Authorization: `Bearer ${token}` };

  // ── Home currency ─────────────────────────────────────────────────────────
  const { data: settings } = useQuery({
    queryKey: ["/api/currency/settings"],
    queryFn: () => fetch("/api/currency/settings", { headers: authHdr }).then(r => r.json()),
  });
  const [homeCurrency, setHomeCurrency] = useState("PKR");
  useEffect(() => { if (settings?.homeCurrency) setHomeCurrency(settings.homeCurrency); }, [settings]);

  const saveSettings = useMutation({
    mutationFn: (hc: string) => fetch("/api/currency/settings", {
      method: "PUT", headers: { "Content-Type": "application/json", ...authHdr },
      body: JSON.stringify({ homeCurrency: hc }),
    }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/currency/settings"] }); toast({ title: "Home currency saved" }); },
  });

  // ── Daily rates ───────────────────────────────────────────────────────────
  const [rateDate, setRateDate] = useState(today());
  const { data: dailyRates = [] } = useQuery<any[]>({
    queryKey: ["/api/currency/daily-rates", rateDate],
    queryFn: () => fetch(`/api/currency/daily-rates?date=${rateDate}`, { headers: authHdr }).then(r => r.json()),
  });

  const [rateForm, setRateForm] = useState(EMPTY_RATE_FORM);
  const [rateOpen, setRateOpen] = useState(false);

  const saveRate = useMutation({
    mutationFn: (data: object) => fetch("/api/currency/daily-rates", {
      method: "POST", headers: { "Content-Type": "application/json", ...authHdr },
      body: JSON.stringify(data),
    }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/currency/daily-rates"] });
      setRateOpen(false);
      setRateForm(EMPTY_RATE_FORM);
      toast({ title: "Rate saved" });
    },
  });

  const deleteRate = useMutation({
    mutationFn: (id: number) => fetch(`/api/currency/daily-rates/${id}`, { method: "DELETE", headers: authHdr }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/currency/daily-rates"] }); toast({ title: "Rate deleted" }); },
  });

  const rateFormValid =
    !!rateForm.currency &&
    !!rateForm.vendorRate && !isNaN(parseFloat(rateForm.vendorRate)) &&
    !!rateForm.guestRate  && !isNaN(parseFloat(rateForm.guestRate)) &&
    !!rateForm.clientRate && !isNaN(parseFloat(rateForm.clientRate));

  // ── Transactions ──────────────────────────────────────────────────────────
  const { data: transactions = [] } = useQuery<any[]>({
    queryKey: ["/api/currency/transactions"],
    queryFn: () => fetch("/api/currency/transactions", { headers: authHdr }).then(r => r.json()),
  });
  const { data: profitReport } = useQuery<any>({
    queryKey: ["/api/currency/profit-report"],
    queryFn: () => fetch("/api/currency/profit-report", { headers: authHdr }).then(r => r.json()),
  });

  const [txOpen, setTxOpen] = useState(false);
  const [txForm, setTxForm] = useState(EMPTY_TX_FORM);

  // Auto-fill sell rate from today's daily rates when tier or currency changes
  useEffect(() => {
    const match = (dailyRates as any[]).find(r => r.currency === txForm.currency);
    if (!match) return;
    const rateValue =
      txForm.rateTier === "vendor" ? String(match.vendorRate) :
      txForm.rateTier === "guest"  ? String(match.guestRate)  :
                                     String(match.clientRate);
    setTxForm(p => ({ ...p, sellRate: rateValue }));
  }, [txForm.rateTier, txForm.currency, dailyRates]);

  // When date changes in TX form, re-fetch daily rates for that date
  const { data: txDateRates = [] } = useQuery<any[]>({
    queryKey: ["/api/currency/daily-rates", txForm.date],
    queryFn: () => fetch(`/api/currency/daily-rates?date=${txForm.date}`, { headers: authHdr }).then(r => r.json()),
    enabled: !!txForm.date,
  });

  // Also auto-fill when txDateRates change
  useEffect(() => {
    const match = (txDateRates as any[]).find(r => r.currency === txForm.currency);
    if (!match) return;
    const rateValue =
      txForm.rateTier === "vendor" ? String(match.vendorRate) :
      txForm.rateTier === "guest"  ? String(match.guestRate)  :
                                     String(match.clientRate);
    setTxForm(p => ({ ...p, sellRate: rateValue }));
  }, [txDateRates, txForm.rateTier, txForm.currency]);

  const txAmt = parseFloat(txForm.amount) || 0;
  const txSR  = parseFloat(txForm.sellRate) || 0;
  // For vendor-buy transactions, vendorRate = sellRate, clientRate = 0 (we're buying, not selling to a client)
  // For guest/client sell transactions, we need the vendor buy rate for cost
  const txDateRateMatch = (txDateRates as any[]).find(r => r.currency === txForm.currency);
  const txVendorBuyRate = txDateRateMatch ? parseFloat(txDateRateMatch.vendorRate) : txSR;
  const isVendorBuy = txForm.rateTier === "vendor";
  const txVendorCost   = txAmt * txVendorBuyRate;
  const txClientRev    = isVendorBuy ? 0 : txAmt * txSR;
  const txProfit       = isVendorBuy ? 0 : txClientRev - txVendorCost;

  const createTx = useMutation({
    mutationFn: (data: object) => fetch("/api/currency/transactions", {
      method: "POST", headers: { "Content-Type": "application/json", ...authHdr },
      body: JSON.stringify(data),
    }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/currency/transactions"] });
      qc.invalidateQueries({ queryKey: ["/api/currency/profit-report"] });
      setTxOpen(false);
      setTxForm(EMPTY_TX_FORM);
      toast({ title: "Transaction recorded" });
    },
  });

  const deleteTx = useMutation({
    mutationFn: (id: number) => fetch(`/api/currency/transactions/${id}`, { method: "DELETE", headers: authHdr }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/currency/transactions"] });
      qc.invalidateQueries({ queryKey: ["/api/currency/profit-report"] });
      toast({ title: "Transaction deleted" });
    },
  });

  const hc = settings?.homeCurrency || homeCurrency;

  const fmt4 = (n: number) => n.toFixed(4);
  const fmtAmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  const fmtInt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Currency Settings</h2>
        <p className="text-muted-foreground">Home currency, 3-tier daily rates (vendor / guest / client), and forex tracking.</p>
      </div>

      <Tabs defaultValue="home">
        <TabsList>
          <TabsTrigger value="home">Home Currency</TabsTrigger>
          <TabsTrigger value="daily">Daily Rates</TabsTrigger>
          <TabsTrigger value="transactions">Forex Transactions</TabsTrigger>
        </TabsList>

        {/* ── Home Currency ── */}
        <TabsContent value="home" className="mt-4">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>Home / Base Currency</CardTitle>
              <CardDescription>
                All accounting P&amp;L and profit calculations will be shown in this currency.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Home Currency</Label>
                <Select value={homeCurrency} onValueChange={setHomeCurrency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {HOME_CURRENCIES.map(c => (
                      <SelectItem key={c.code} value={c.code}>{c.code} — {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => saveSettings.mutate(homeCurrency)} disabled={saveSettings.isPending}>
                <Save className="mr-2 h-4 w-4" /> Save Home Currency
              </Button>
              {settings && (
                <p className="text-sm text-muted-foreground">
                  Current: <span className="font-semibold text-foreground">{settings.homeCurrency}</span>
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Daily Rates ── */}
        <TabsContent value="daily" className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Label>Date</Label>
              <Input type="date" value={rateDate} onChange={e => setRateDate(e.target.value)} className="w-40" />
              <span className="text-sm text-muted-foreground">
                {(dailyRates as any[]).length} rate{(dailyRates as any[]).length !== 1 ? "s" : ""} for this date
              </span>
            </div>
            <Dialog open={rateOpen} onOpenChange={setRateOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" />Add / Update Rate</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Daily Rates for {rateDate}</DialogTitle></DialogHeader>
                <div className="grid gap-5 py-4">

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Currency</Label>
                    <Select value={rateForm.currency} onValueChange={v => setRateForm(p => ({ ...p, currency: v }))}>
                      <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                      <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>

                  {/* Tier 1: Vendor Buy Rate */}
                  <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-orange-600" />
                      <span className="font-semibold text-sm text-orange-700">Vendor Buy Rate</span>
                      <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">What we pay the vendor</Badge>
                    </div>
                    <Input
                      type="number" step="0.0001" min="0"
                      placeholder={`${hc} per 1 ${rateForm.currency}`}
                      value={rateForm.vendorRate}
                      onChange={e => setRateForm(p => ({ ...p, vendorRate: e.target.value }))}
                    />
                  </div>

                  {/* Tier 2: Guest Sell Rate */}
                  <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <ArrowRightLeft className="h-4 w-4 text-purple-600" />
                      <span className="font-semibold text-sm text-purple-700">Guest Sell Rate</span>
                      <Badge variant="outline" className="text-xs text-purple-600 border-purple-300">Walk-in customers</Badge>
                    </div>
                    <Input
                      type="number" step="0.0001" min="0"
                      placeholder={`${hc} per 1 ${rateForm.currency}`}
                      value={rateForm.guestRate}
                      onChange={e => setRateForm(p => ({ ...p, guestRate: e.target.value }))}
                    />
                  </div>

                  {/* Tier 3: Client/Subagent Rate */}
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-blue-600" />
                      <span className="font-semibold text-sm text-blue-700">Client / Subagent Rate</span>
                      <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">Agent partners</Badge>
                    </div>
                    <Input
                      type="number" step="0.0001" min="0"
                      placeholder={`${hc} per 1 ${rateForm.currency}`}
                      value={rateForm.clientRate}
                      onChange={e => setRateForm(p => ({ ...p, clientRate: e.target.value }))}
                    />
                  </div>

                  {/* Spread preview */}
                  {rateForm.vendorRate && rateForm.clientRate && (
                    <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-muted-foreground">Vendor→Guest spread: </span>
                        <span className="font-medium text-green-700">
                          {(parseFloat(rateForm.guestRate || "0") - parseFloat(rateForm.vendorRate)).toFixed(4)} {hc}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Vendor→Client spread: </span>
                        <span className="font-medium text-green-700">
                          {(parseFloat(rateForm.clientRate) - parseFloat(rateForm.vendorRate)).toFixed(4)} {hc}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Notes</Label>
                    <Input
                      className="col-span-3"
                      placeholder="Optional notes"
                      value={rateForm.notes}
                      onChange={e => setRateForm(p => ({ ...p, notes: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setRateOpen(false)}>Cancel</Button>
                  <Button
                    onClick={() => saveRate.mutate({
                      ...rateForm,
                      date: rateDate,
                      vendorRate: parseFloat(rateForm.vendorRate),
                      guestRate:  parseFloat(rateForm.guestRate),
                      clientRate: parseFloat(rateForm.clientRate),
                    })}
                    disabled={!rateFormValid || saveRate.isPending}
                  >
                    Save Rates
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Rate legend */}
          <div className="flex gap-4 mb-3 text-xs">
            {[
              { color: "bg-orange-100 text-orange-700 border-orange-300", label: "Vendor Buy Rate — what we pay" },
              { color: "bg-purple-100 text-purple-700 border-purple-300", label: "Guest Sell Rate — walk-ins" },
              { color: "bg-blue-100 text-blue-700 border-blue-300", label: "Client/Subagent Rate — agents" },
            ].map(t => (
              <span key={t.label} className={`px-2 py-1 rounded border font-medium ${t.color}`}>{t.label}</span>
            ))}
          </div>

          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Currency</TableHead>
                    <TableHead className="text-orange-700">Vendor Buy Rate</TableHead>
                    <TableHead className="text-purple-700">Guest Sell Rate</TableHead>
                    <TableHead className="text-blue-700">Client/Subagent Rate</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(dailyRates as any[]).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center h-32 text-muted-foreground">
                        No rates for {rateDate}. Click "Add / Update Rate" to enter today's rates.
                      </TableCell>
                    </TableRow>
                  ) : (dailyRates as any[]).map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-bold text-base">{r.currency}</TableCell>
                      <TableCell>
                        <span className="font-semibold text-orange-700">{fmt4(Number(r.vendorRate))}</span>
                        <span className="text-xs text-muted-foreground ml-1">{hc}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold text-purple-700">{fmt4(Number(r.guestRate))}</span>
                        <span className="text-xs text-muted-foreground ml-1">{hc}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold text-blue-700">{fmt4(Number(r.clientRate))}</span>
                        <span className="text-xs text-muted-foreground ml-1">{hc}</span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.notes || "—"}</TableCell>
                      <TableCell>
                        <Button
                          size="icon" variant="ghost"
                          className="h-7 w-7 text-red-500 hover:text-red-700"
                          onClick={() => deleteRate.mutate(r.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Forex Transactions ── */}
        <TabsContent value="transactions" className="mt-4 space-y-4">
          {/* Summary cards */}
          {profitReport && (
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: `Total Vendor Cost (${hc})`, value: fmtAmt(Number(profitReport.totalVendorCost || 0)), icon: TrendingDown, color: "text-red-600" },
                { label: `Total Client Revenue (${hc})`, value: fmtAmt(Number(profitReport.totalClientRevenue || 0)), icon: TrendingUp, color: "text-blue-600" },
                { label: `Forex Profit (${hc})`, value: fmtAmt(Number(profitReport.totalProfit || 0)), icon: DollarSign, color: Number(profitReport.totalProfit || 0) >= 0 ? "text-green-600" : "text-red-600" },
              ].map(s => (
                <Card key={s.label}>
                  <CardContent className="pt-5 flex items-start gap-3">
                    <s.icon className={`h-5 w-5 mt-0.5 ${s.color}`} />
                    <div>
                      <div className="text-xs text-muted-foreground">{s.label}</div>
                      <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <div className="flex justify-end">
            <Dialog open={txOpen} onOpenChange={setTxOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" />Record Transaction</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Record Currency Transaction</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-4">

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Currency</Label>
                    <Select value={txForm.currency} onValueChange={v => setTxForm(p => ({ ...p, currency: v }))}>
                      <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                      <SelectContent>{CURRENCIES.filter(c => c !== hc).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Amount</Label>
                    <Input
                      type="number" className="col-span-3"
                      placeholder={`Amount in ${txForm.currency}`}
                      value={txForm.amount}
                      onChange={e => setTxForm(p => ({ ...p, amount: e.target.value }))}
                    />
                  </div>

                  {/* Rate Tier selector */}
                  <div className="grid grid-cols-4 items-start gap-4">
                    <Label className="text-right pt-2">Rate Tier</Label>
                    <div className="col-span-3 space-y-2">
                      {RATE_TIERS.map(tier => (
                        <button
                          key={tier.value}
                          type="button"
                          onClick={() => setTxForm(p => ({ ...p, rateTier: tier.value }))}
                          className={`w-full text-left rounded-lg border px-3 py-2 text-sm transition-colors ${
                            txForm.rateTier === tier.value
                              ? "border-primary bg-primary/5 text-primary font-medium"
                              : "border-border hover:bg-muted/40"
                          }`}
                        >
                          <div className="font-medium">{tier.label}</div>
                          <div className="text-xs text-muted-foreground">{tier.description}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sell rate — auto-filled from daily rates */}
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">
                      {txForm.rateTier === "vendor" ? "Buy Rate" :
                       txForm.rateTier === "guest"  ? "Guest Rate" : "Client Rate"}
                    </Label>
                    <div className="col-span-3 space-y-1">
                      <Input
                        type="number" step="0.0001"
                        placeholder={`${hc} per 1 ${txForm.currency}`}
                        value={txForm.sellRate}
                        onChange={e => setTxForm(p => ({ ...p, sellRate: e.target.value }))}
                      />
                      <p className="text-xs text-muted-foreground">Auto-filled from daily rates if available</p>
                    </div>
                  </div>

                  {/* P&L preview (only for sell transactions) */}
                  {txAmt > 0 && txSR > 0 && !isVendorBuy && (
                    <div className="rounded-md bg-slate-50 border p-3 space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Vendor cost for {txAmt.toLocaleString()} {txForm.currency}:</span>
                        <span className="font-semibold text-red-600">{fmtAmt(txVendorCost)} {hc}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Revenue from {txForm.rateTier === "guest" ? "guest" : "client"}:</span>
                        <span className="font-semibold text-blue-600">{fmtAmt(txClientRev)} {hc}</span>
                      </div>
                      <div className="flex justify-between border-t pt-1 mt-1">
                        <span className="font-medium">Profit:</span>
                        <span className={`font-bold ${txProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {txProfit >= 0 ? "+" : ""}{fmtAmt(txProfit)} {hc}
                        </span>
                      </div>
                    </div>
                  )}
                  {txAmt > 0 && txSR > 0 && isVendorBuy && (
                    <div className="rounded-md bg-orange-50 border border-orange-200 p-3 text-sm text-orange-700">
                      Purchasing {txAmt.toLocaleString()} {txForm.currency} at {fmt4(txSR)} {hc} each — total outflow: {fmtAmt(txAmt * txSR)} {hc}
                    </div>
                  )}

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Date</Label>
                    <Input
                      type="date" className="col-span-3"
                      value={txForm.date}
                      onChange={e => setTxForm(p => ({ ...p, date: e.target.value }))}
                    />
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Notes</Label>
                    <Input
                      className="col-span-3"
                      placeholder="Client name, reference, etc."
                      value={txForm.notes}
                      onChange={e => setTxForm(p => ({ ...p, notes: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setTxOpen(false)}>Cancel</Button>
                  <Button
                    onClick={() => createTx.mutate({
                      currency: txForm.currency,
                      amount: txAmt,
                      rateTier: txForm.rateTier,
                      vendorRate: isVendorBuy ? txSR : txVendorBuyRate,
                      clientRate: isVendorBuy ? 0 : txSR,
                      date: txForm.date,
                      notes: txForm.notes,
                    })}
                    disabled={!txForm.currency || !txAmt || !txSR || !txForm.date || createTx.isPending}
                  >
                    Record
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Currency</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Vendor Rate</TableHead>
                    <TableHead>Sell Rate</TableHead>
                    <TableHead>Vendor Cost ({hc})</TableHead>
                    <TableHead>Revenue ({hc})</TableHead>
                    <TableHead>Profit ({hc})</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(transactions as any[]).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center h-32 text-muted-foreground">
                        No transactions yet. Record your first forex transaction above.
                      </TableCell>
                    </TableRow>
                  ) : (transactions as any[]).map((t: any) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-sm">{new Date(t.date).toLocaleDateString()}</TableCell>
                      <TableCell><span className="font-bold bg-slate-100 px-1.5 py-0.5 rounded text-sm">{t.currency}</span></TableCell>
                      <TableCell className="font-medium">{Number(t.amount).toLocaleString()}</TableCell>
                      <TableCell className="text-orange-700">{fmt4(Number(t.vendorRate))}</TableCell>
                      <TableCell className="text-blue-700">{fmt4(Number(t.clientRate))}</TableCell>
                      <TableCell className="text-red-600">{fmtInt(Number(t.vendorCost))}</TableCell>
                      <TableCell className="text-blue-600">{fmtInt(Number(t.clientRevenue))}</TableCell>
                      <TableCell className={`font-bold ${Number(t.profit) >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {Number(t.profit) >= 0 ? "+" : ""}{fmtInt(Number(t.profit))}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[120px] truncate">{t.notes || "—"}</TableCell>
                      <TableCell>
                        <Button
                          size="icon" variant="ghost"
                          className="h-7 w-7 text-red-500 hover:text-red-700"
                          onClick={() => deleteTx.mutate(t.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Per-currency summary */}
          {profitReport?.summary?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ArrowRightLeft className="h-4 w-4" />Profit by Currency
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Currency</TableHead>
                      <TableHead>Transactions</TableHead>
                      <TableHead>Total Volume</TableHead>
                      <TableHead>Vendor Cost ({hc})</TableHead>
                      <TableHead>Revenue ({hc})</TableHead>
                      <TableHead>Profit ({hc})</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {profitReport.summary.map((s: any) => (
                      <TableRow key={s.currency}>
                        <TableCell className="font-bold">{s.currency}</TableCell>
                        <TableCell>{s.count}</TableCell>
                        <TableCell>{fmtAmt(s.totalAmount)}</TableCell>
                        <TableCell className="text-red-600">{fmtInt(s.totalVendorCost)}</TableCell>
                        <TableCell className="text-blue-600">{fmtInt(s.totalClientRevenue)}</TableCell>
                        <TableCell className={`font-bold ${s.totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {s.totalProfit >= 0 ? "+" : ""}{fmtInt(s.totalProfit)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
