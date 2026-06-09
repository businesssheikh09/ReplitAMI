import { useState } from "react";
import { useListFlightQuotations, useCreateFlightQuotation, useUpdateFlightQuotation, useDeleteFlightQuotation, useListClients } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Plane, Trash2 } from "lucide-react";

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-700",
  booked: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function FlightsPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ clientId: "", origin: "", destination: "Jeddah (JED)", departureDate: "", returnDate: "", passengers: 1, cabinClass: "economy", airline: "", amount: "", currency: "USD" });
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: flights = [], isLoading } = useListFlightQuotations({ status: statusFilter !== "all" ? statusFilter : undefined });
  const { data: clients = [] } = useListClients({});
  const createFlight = useCreateFlightQuotation({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/flight-quotations"] }); setOpen(false); toast({ title: "Flight quotation created" }); } } });
  const updateFlight = useUpdateFlightQuotation({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/flight-quotations"] }); toast({ title: "Status updated" }); } } });
  const deleteFlight = useDeleteFlightQuotation({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/flight-quotations"] }); toast({ title: "Deleted" }); } } });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Flights</h2>
          <p className="text-muted-foreground">Manage flight quotations and bookings.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />New Flight Quote</Button></DialogTrigger>
          <DialogContent className="sm:max-w-[560px]">
            <DialogHeader><DialogTitle>Create Flight Quotation</DialogTitle></DialogHeader>
            <div className="grid gap-3 py-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Client</Label>
                <Select value={form.clientId} onValueChange={v => setForm(p => ({ ...p, clientId: v }))}>
                  <SelectTrigger className="col-span-3"><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>{(clients as any[]).map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {[["origin","Origin (e.g. London LHR)"],["destination","Destination"]].map(([k, placeholder]) => (
                <div key={k} className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">{k === "origin" ? "From" : "To"}</Label>
                  <Input className="col-span-3" value={(form as any)[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} placeholder={placeholder} />
                </div>
              ))}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Departure</Label>
                <Input type="date" className="col-span-3" value={form.departureDate} onChange={e => setForm(p => ({ ...p, departureDate: e.target.value }))} />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Return</Label>
                <Input type="date" className="col-span-3" value={form.returnDate} onChange={e => setForm(p => ({ ...p, returnDate: e.target.value }))} />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Passengers</Label>
                <Input type="number" className="col-span-3" value={form.passengers} onChange={e => setForm(p => ({ ...p, passengers: Number(e.target.value) }))} />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Class</Label>
                <Select value={form.cabinClass} onValueChange={v => setForm(p => ({ ...p, cabinClass: v }))}>
                  <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                  <SelectContent>{["economy","business","first"].map(c => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Airline</Label>
                <Input className="col-span-3" value={form.airline} onChange={e => setForm(p => ({ ...p, airline: e.target.value }))} placeholder="e.g. Saudi Airlines" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Amount</Label>
                <div className="col-span-3 flex gap-2">
                  <Select value={form.currency} onValueChange={v => setForm(p => ({ ...p, currency: v }))}>
                    <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>{["USD","GBP","EUR","AED","SAR"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="Price" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => createFlight.mutate({ data: { ...form, clientId: Number(form.clientId), amount: Number(form.amount), passengers: Number(form.passengers) } })} disabled={!form.clientId || !form.origin || !form.departureDate || !form.amount || createFlight.isPending}>Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {["draft","sent","booked","cancelled"].map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {isLoading ? <div className="h-40 flex items-center justify-center text-muted-foreground">Loading...</div> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Departure</TableHead>
                  <TableHead>Return</TableHead>
                  <TableHead>Pax</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Airline</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(flights as any[]).length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="text-center h-32 text-muted-foreground"><Plane className="mx-auto h-8 w-8 mb-2" />No flight quotations</TableCell></TableRow>
                ) : (flights as any[]).map((f: any) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.clientName}</TableCell>
                    <TableCell className="text-sm">{f.origin} → {f.destination}</TableCell>
                    <TableCell className="text-sm">{new Date(f.departureDate).toLocaleDateString()}</TableCell>
                    <TableCell className="text-sm">{f.returnDate ? new Date(f.returnDate).toLocaleDateString() : "—"}</TableCell>
                    <TableCell>{f.passengers}</TableCell>
                    <TableCell className="capitalize text-sm">{f.cabinClass}</TableCell>
                    <TableCell className="text-sm">{f.airline || "—"}</TableCell>
                    <TableCell className="font-semibold">{f.currency} {(f.amount || 0).toLocaleString()}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[f.status] || "bg-gray-100"}`}>{f.status}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {f.status === "draft" && <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => updateFlight.mutate({ id: f.id, data: { status: "sent" } })}>Send</Button>}
                        {f.status === "sent" && <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => updateFlight.mutate({ id: f.id, data: { status: "booked" } })}>Book</Button>}
                        <Button size="sm" variant="ghost" onClick={() => deleteFlight.mutate({ id: f.id })}><Trash2 className="h-3 w-3 text-red-400" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
