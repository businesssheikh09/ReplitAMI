import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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

const today = () => new Date().toISOString().slice(0, 10);

export default function CurrencySettingsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();

  // ── Home currency ─────────────────────────────────────────────────────────
  const { data: settings } = useQuery({
    queryKey: ["/api/currency/settings"],
    queryFn: () => fetch("/api/currency/settings").then(r => r.json()),
  });
  const [homeCurrency, setHomeCurrency] = useState("PKR");
  useEffect(() => { if (settings?.homeCurrency) setHomeCurrency(settings.homeCurrency); }, [settings]);

  const saveSettings = useMutation({
    mutationFn: (hc: string) => fetch("/api/currency/settings", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ homeCurrency: hc }),
    }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/currency/settings"] }); toast({ title: "Home currency saved" }); },
  });

  // ── Daily rates ───────────────────────────────────────────────────────────
  const [rateDate, setRateDate] = useState(today());
  const { data: dailyRates = [] } = useQuery<any[]>({
    queryKey: ["/api/currency/daily-rates", rateDate],
    queryFn: () => fetch(`/api/currency/daily-rates?date=${rateDate}`).then(r => r.json()),
  });

  const [rateForm, setRateForm] = useState({ currency: "SAR", clientRate: "", vendorRate: "", notes: "" });
  const [rateOpen, setRateOpen] = useState(false);

  const saveRate = useMutation({
    mutationFn: (data: object) => fetch("/api/currency/daily-rates", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/currency/daily-rates"] });
      setRateOpen(false);
      setRateForm({ currency: "SAR", clientRate: "", vendorRate: "", notes: "" });
      toast({ title: "Rate saved" });
    },
  });

  const deleteRate = useMutation({
    mutationFn: (id: number) => fetch(`/api/currency/daily-rates/${id}`, { method: "DELETE" }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/currency/daily-rates"] }); toast({ title: "Rate deleted" }); },
  });

  // ── Transactions ──────────────────────────────────────────────────────────
  const { data: transactions = [] } = useQuery<any[]>({
    queryKey: ["/api/currency/transactions"],
    queryFn: () => fetch("/api/currency/transactions").then(r => r.json()),
  });
  const { data: profitReport } = useQuery<any>({
    queryKey: ["/api/currency/profit-report"],
    queryFn: () => fetch("/api/currency/profit-report").then(r => r.json()),
  });

  const [txOpen, setTxOpen] = useState(false);
  const [txForm, setTxForm] = useState({ currency: "SAR", amount: "", vendorRate: "", clientRate: "", date: today(), notes: "" });
  const txAmt = parseFloat(txForm.amount) || 0;
  const txVR = parseFloat(txForm.vendorRate) || 0;
  const txCR = parseFloat(txForm.clientRate) || 0;
  const txVendorCost = txAmt * txVR;
  const txClientRev = txAmt * txCR;
  const txProfit = txClientRev - txVendorCost;

  const createTx = useMutation({
    mutationFn: (data: object) => fetch("/api/currency/transactions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/currency/transactions"] });
      qc.invalidateQueries({ queryKey: ["/api/currency/profit-report"] });
      setTxOpen(false);
      setTxForm({ currency: "SAR", amount: "", vendorRate: "", clientRate: "", date: today(), notes: "" });
      toast({ title: "Transaction recorded" });
    },
  });

  const deleteTx = useMutation({
    mutationFn: (id: number) => fetch(`/api/currency/transactions/${id}`, { method: "DELETE" }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/currency/transactions"] });
      qc.invalidateQueries({ queryKey: ["/api/currency/profit-report"] });
      toast({ title: "Transaction deleted" });
    },
  });

  const hc = settings?.homeCurrency || homeCurrency;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Currency Settings</h2>
        <p className="text-muted-foreground">Home currency, daily buy/sell rates, and forex profit tracking.</p>
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
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
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
                <Button><Plus className="mr-2 h-4 w-4" />Add Rate</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Daily Rate for {rateDate}</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Currency</Label>
                    <Select value={rateForm.currency} onValueChange={v => setRateForm(p => ({ ...p, currency: v }))}>
                      <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                      <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Client Rate</Label>
                    <div className="col-span-3 space-y-1">
                      <Input
                        type="number" step="0.0001"
                        placeholder={`${hc} per 1 ${rateForm.currency} (selling to client)`}
                        value={rateForm.clientRate}
                        onChange={e => setRateForm(p => ({ ...p, clientRate: e.target.value }))}
                      />
                      <p className="text-xs text-muted-foreground">Rate charged to client (higher)</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Vendor Rate</Label>
                    <div className="col-span-3 space-y-1">
                      <Input
                        type="number" step="0.0001"
                        placeholder={`${hc} per 1 ${rateForm.currency} (buying from vendor)`}
                        value={rateForm.vendorRate}
                        onChange={e => setRateForm(p => ({ ...p, vendorRate: e.target.value }))}
                      />
                      <p className="text-xs text-muted-foreground">Rate paid to vendor (lower)</p>
                    </div>
                  </div>
                  {rateForm.clientRate && rateForm.vendorRate && (
                    <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm">
                      <span className="font-medium text-green-700">Spread: </span>
                      <span className="text-green-600">
                        {(parseFloat(rateForm.clientRate) - parseFloat(rateForm.vendorRate)).toFixed(4)} {hc} per {rateForm.currency}
                      </span>
                    </div>
                  )}
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Notes</Label>
                    <Input className="col-span-3" placeholder="Optional notes" value={rateForm.notes} onChange={e => setRateForm(p => ({ ...p, notes: e.target.value }))} />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setRateOpen(false)}>Cancel</Button>
                  <Button
                    onClick={() => saveRate.mutate({ ...rateForm, date: rateDate, clientRate: parseFloat(rateForm.clientRate), vendorRate: parseFloat(rateForm.vendorRate) })}
                    disabled={!rateForm.currency || !rateForm.clientRate || !rateForm.vendorRate || saveRate.isPending}
                  >
                    Save Rate
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
                    <TableHead>Currency</TableHead>
                    <TableHead>Client Rate <span className="font-normal text-muted-foreground">(selling)</span></TableHead>
                    <TableHead>Vendor Rate <span className="font-normal text-muted-foreground">(buying)</span></TableHead>
                    <TableHead>Spread</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(dailyRates as any[]).length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center h-32 text-muted-foreground">No rates for {rateDate}. Add one above.</TableCell></TableRow>
                  ) : (dailyRates as any[]).map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-bold text-base">{r.currency}</TableCell>
                      <TableCell className="text-blue-700 font-semibold">
                        {Number(r.clientRate).toFixed(4)} <span className="text-xs text-muted-foreground">{hc}</span>
                      </TableCell>
                      <TableCell className="text-orange-700 font-semibold">
                        {Number(r.vendorRate).toFixed(4)} <span className="text-xs text-muted-foreground">{hc}</span>
                      </TableCell>
                      <TableCell className="text-green-600 font-medium">
                        +{(Number(r.clientRate) - Number(r.vendorRate)).toFixed(4)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.notes || "—"}</TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => deleteRate.mutate(r.id)}>
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
                { label: `Total Vendor Cost (${hc})`, value: Number(profitReport.totalVendorCost || 0).toLocaleString(undefined, { maximumFractionDigits: 2 }), icon: TrendingDown, color: "text-red-600" },
                { label: `Total Client Revenue (${hc})`, value: Number(profitReport.totalClientRevenue || 0).toLocaleString(undefined, { maximumFractionDigits: 2 }), icon: TrendingUp, color: "text-blue-600" },
                { label: `Forex Profit (${hc})`, value: Number(profitReport.totalProfit || 0).toLocaleString(undefined, { maximumFractionDigits: 2 }), icon: DollarSign, color: Number(profitReport.totalProfit || 0) >= 0 ? "text-green-600" : "text-red-600" },
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
                    <Input type="number" className="col-span-3" placeholder={`Amount in ${txForm.currency}`} value={txForm.amount} onChange={e => setTxForm(p => ({ ...p, amount: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Vendor Rate</Label>
                    <div className="col-span-3 space-y-1">
                      <Input type="number" step="0.0001" placeholder={`${hc} per 1 ${txForm.currency} paid to vendor`} value={txForm.vendorRate} onChange={e => setTxForm(p => ({ ...p, vendorRate: e.target.value }))} />
                      <p className="text-xs text-muted-foreground">How much {hc} you paid per 1 {txForm.currency}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Client Rate</Label>
                    <div className="col-span-3 space-y-1">
                      <Input type="number" step="0.0001" placeholder={`${hc} per 1 ${txForm.currency} charged to client`} value={txForm.clientRate} onChange={e => setTxForm(p => ({ ...p, clientRate: e.target.value }))} />
                      <p className="text-xs text-muted-foreground">How much {hc} you charged per 1 {txForm.currency}</p>
                    </div>
                  </div>
                  {txAmt > 0 && txVR > 0 && txCR > 0 && (
                    <div className="rounded-md bg-slate-50 border p-3 space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Paid for {txAmt.toLocaleString()} {txForm.currency}:</span>
                        <span className="font-semibold text-red-600">{txVendorCost.toLocaleString(undefined, { maximumFractionDigits: 2 })} {hc}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Received from client:</span>
                        <span className="font-semibold text-blue-600">{txClientRev.toLocaleString(undefined, { maximumFractionDigits: 2 })} {hc}</span>
                      </div>
                      <div className="flex justify-between border-t pt-1 mt-1">
                        <span className="font-medium">Profit:</span>
                        <span className={`font-bold ${txProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {txProfit >= 0 ? "+" : ""}{txProfit.toLocaleString(undefined, { maximumFractionDigits: 2 })} {hc}
                        </span>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Date</Label>
                    <Input type="date" className="col-span-3" value={txForm.date} onChange={e => setTxForm(p => ({ ...p, date: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Notes</Label>
                    <Input className="col-span-3" placeholder="Client name, reference, etc." value={txForm.notes} onChange={e => setTxForm(p => ({ ...p, notes: e.target.value }))} />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setTxOpen(false)}>Cancel</Button>
                  <Button
                    onClick={() => createTx.mutate({ ...txForm, amount: txAmt, vendorRate: txVR, clientRate: txCR })}
                    disabled={!txForm.currency || !txAmt || !txVR || !txCR || !txForm.date || createTx.isPending}
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
                    <TableHead>Client Rate</TableHead>
                    <TableHead>Vendor Cost ({hc})</TableHead>
                    <TableHead>Client Revenue ({hc})</TableHead>
                    <TableHead>Profit ({hc})</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(transactions as any[]).length === 0 ? (
                    <TableRow><TableCell colSpan={10} className="text-center h-32 text-muted-foreground">No transactions yet. Record your first forex transaction above.</TableCell></TableRow>
                  ) : (transactions as any[]).map((t: any) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-sm">{new Date(t.date).toLocaleDateString()}</TableCell>
                      <TableCell><span className="font-bold bg-slate-100 px-1.5 py-0.5 rounded text-sm">{t.currency}</span></TableCell>
                      <TableCell className="font-medium">{Number(t.amount).toLocaleString()}</TableCell>
                      <TableCell className="text-orange-700">{Number(t.vendorRate).toFixed(4)}</TableCell>
                      <TableCell className="text-blue-700">{Number(t.clientRate).toFixed(4)}</TableCell>
                      <TableCell className="text-red-600">{Number(t.vendorCost).toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                      <TableCell className="text-blue-600">{Number(t.clientRevenue).toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                      <TableCell className={`font-bold ${Number(t.profit) >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {Number(t.profit) >= 0 ? "+" : ""}{Number(t.profit).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[120px] truncate">{t.notes || "—"}</TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => deleteTx.mutate(t.id)}>
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
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><ArrowRightLeft className="h-4 w-4" />Profit by Currency</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Currency</TableHead>
                      <TableHead>Transactions</TableHead>
                      <TableHead>Total Volume</TableHead>
                      <TableHead>Total Vendor Cost ({hc})</TableHead>
                      <TableHead>Total Client Revenue ({hc})</TableHead>
                      <TableHead>Total Profit ({hc})</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {profitReport.summary.map((s: any) => (
                      <TableRow key={s.currency}>
                        <TableCell className="font-bold">{s.currency}</TableCell>
                        <TableCell>{s.count}</TableCell>
                        <TableCell>{Number(s.totalAmount).toLocaleString()}</TableCell>
                        <TableCell className="text-red-600">{Number(s.totalVendorCost).toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                        <TableCell className="text-blue-600">{Number(s.totalClientRevenue).toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                        <TableCell className={`font-bold ${Number(s.totalProfit) >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {Number(s.totalProfit) >= 0 ? "+" : ""}{Number(s.totalProfit).toLocaleString(undefined, { maximumFractionDigits: 0 })}
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
