import { useState } from "react";
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
import { Plus, Receipt, DollarSign, TrendingUp, TrendingDown, Hotel, ExternalLink } from "lucide-react";
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

export default function AccountingPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
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
    queryFn: () => fetch("/api/invoices/hotel").then(r => r.json()),
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
            <Button onClick={() => setLocation("/accounting/hotel-invoice/new")} className="bg-blue-700 hover:bg-blue-800 text-white">
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
          { label: "Total Revenue", value: `$${totalRevenue.toLocaleString()}`, icon: TrendingUp, color: "text-green-600" },
          { label: "Total Expenses", value: `$${totalExpenses.toLocaleString()}`, icon: TrendingDown, color: "text-red-600" },
          { label: "Net Profit", value: `$${profit.toLocaleString()}`, icon: DollarSign, color: profit >= 0 ? "text-green-600" : "text-red-600" },
          { label: "Outstanding", value: `$${outstanding.toLocaleString()}`, icon: Receipt, color: "text-amber-600" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-6 flex items-start gap-3">
              <s.icon className={`h-5 w-5 mt-0.5 ${s.color}`} />
              <div><div className="text-xs text-muted-foreground">{s.label}</div><div className={`text-xl font-bold ${s.color}`}>{s.value}</div></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="hotel-invoices">
        <TabsList>
          <TabsTrigger value="hotel-invoices">Hotel Invoices DN ({dnInvs.length})</TabsTrigger>
          <TabsTrigger value="invoices">General Invoices ({invs.length})</TabsTrigger>
          <TabsTrigger value="expenses">Expenses ({exps.length})</TabsTrigger>
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
                  <Button size="sm" onClick={() => setLocation("/accounting/hotel-invoice/new")} className="bg-blue-700 hover:bg-blue-800 text-white">
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
      </Tabs>
    </div>
  );
}
