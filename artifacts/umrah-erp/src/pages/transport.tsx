import { useState } from "react";
import { useListTransportBookings, useCreateTransportBooking, useUpdateTransportBooking, useListClients } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Car } from "lucide-react";

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-green-100 text-green-700",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-gray-100 text-gray-700",
  cancelled: "bg-red-100 text-red-700",
};

const TRIP_TYPES = [
  { value: "airport_transfer", label: "Airport Transfer" },
  { value: "makkah_madinah", label: "Makkah ↔ Madinah" },
  { value: "ziyarat", label: "Ziyarat Tour" },
  { value: "other", label: "Other" },
];

export default function TransportPage() {
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ clientId: "", type: "airport_transfer", vehicleType: "sedan", pickupLocation: "", dropoffLocation: "", date: "", passengers: 1, driverName: "", driverPhone: "", amount: "", currency: "USD", notes: "" });
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: bookings = [], isLoading } = useListTransportBookings({ type: typeFilter !== "all" ? typeFilter : undefined, status: statusFilter !== "all" ? statusFilter : undefined });
  const { data: clients = [] } = useListClients({});
  const createBooking = useCreateTransportBooking({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/transport"] }); setOpen(false); toast({ title: "Booking created" }); } } });
  const updateBooking = useUpdateTransportBooking({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/transport"] }); toast({ title: "Status updated" }); } } });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Transport</h2>
          <p className="text-muted-foreground">Manage airport transfers, city transfers, and ziyarat tours.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />New Booking</Button></DialogTrigger>
          <DialogContent className="sm:max-w-[560px]">
            <DialogHeader><DialogTitle>New Transport Booking</DialogTitle></DialogHeader>
            <div className="grid gap-3 py-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Client</Label>
                <Select value={form.clientId} onValueChange={v => setForm(p => ({ ...p, clientId: v }))}>
                  <SelectTrigger className="col-span-3"><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>{(clients as any[]).map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Type</Label>
                <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}>
                  <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                  <SelectContent>{TRIP_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Vehicle</Label>
                <Select value={form.vehicleType} onValueChange={v => setForm(p => ({ ...p, vehicleType: v }))}>
                  <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                  <SelectContent>{["sedan","suv","minivan","bus","vip_van"].map(v => <SelectItem key={v} value={v}>{v.replace(/_/g," ").toUpperCase()}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {[["pickupLocation","Pickup"],["dropoffLocation","Dropoff"]].map(([k, label]) => (
                <div key={k} className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">{label}</Label>
                  <Input className="col-span-3" value={(form as any)[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} />
                </div>
              ))}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Date & Time</Label>
                <Input type="datetime-local" className="col-span-3" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Passengers</Label>
                <Input type="number" className="col-span-3" value={form.passengers} onChange={e => setForm(p => ({ ...p, passengers: Number(e.target.value) }))} />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Amount</Label>
                <Input type="number" className="col-span-3" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="e.g. 150" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => createBooking.mutate({ data: { ...form, clientId: Number(form.clientId), amount: Number(form.amount), passengers: Number(form.passengers) } })} disabled={!form.clientId || !form.pickupLocation || !form.dropoffLocation || !form.date || !form.amount || createBooking.isPending}>Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex gap-3">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {TRIP_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {["pending","confirmed","in_progress","completed","cancelled"].map(s => <SelectItem key={s} value={s}>{s.replace(/_/g," ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? <div className="h-40 flex items-center justify-center text-muted-foreground">Loading...</div> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(bookings as any[]).length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center h-32 text-muted-foreground"><Car className="mx-auto h-8 w-8 mb-2" />No transport bookings</TableCell></TableRow>
                ) : (bookings as any[]).map((b: any) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.clientName || `Client #${b.clientId}`}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{b.type.replace(/_/g," ")}</TableCell>
                    <TableCell className="text-sm">{b.pickupLocation} → {b.dropoffLocation}</TableCell>
                    <TableCell className="text-sm">{new Date(b.date).toLocaleDateString()}</TableCell>
                    <TableCell className="text-sm capitalize">{b.vehicleType.replace(/_/g," ")}</TableCell>
                    <TableCell className="font-semibold">{b.currency} {(b.amount || 0).toLocaleString()}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[b.status] || "bg-gray-100"}`}>{b.status.replace(/_/g," ")}</span>
                    </TableCell>
                    <TableCell>
                      {b.status === "pending" && (
                        <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => updateBooking.mutate({ id: b.id, data: { status: "confirmed" } })}>Confirm</Button>
                      )}
                      {b.status === "confirmed" && (
                        <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => updateBooking.mutate({ id: b.id, data: { status: "completed" } })}>Complete</Button>
                      )}
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
