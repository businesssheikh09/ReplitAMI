import { useState } from "react";
import { Link } from "wouter";
import { useListHotelRequests, useCreateHotelRequest, useUpdateHotelRequest, useListClients } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Eye } from "lucide-react";

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  sent_to_vendor: "bg-blue-100 text-blue-700",
  quoted: "bg-purple-100 text-purple-700",
  confirmed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function HotelRequestsPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ clientId: "", hotelName: "", city: "makkah", checkIn: "", checkOut: "", rooms: 1, roomType: "Double", mealPlan: "BB", specialNotes: "" });
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: requests = [], isLoading } = useListHotelRequests({ status: statusFilter !== "all" ? statusFilter : undefined });
  const { data: clients = [] } = useListClients({});
  const createRequest = useCreateHotelRequest({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/hotel-requests"] }); setOpen(false); toast({ title: "Request created" }); } } });
  const updateRequest = useUpdateHotelRequest({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/hotel-requests"] }); toast({ title: "Status updated" }); } } });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Hotel Requests</h2>
          <p className="text-muted-foreground">Track hotel requests and vendor quotes.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />New Request</Button></DialogTrigger>
          <DialogContent className="sm:max-w-[560px]">
            <DialogHeader><DialogTitle>Create Hotel Request</DialogTitle></DialogHeader>
            <div className="grid gap-3 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Client</Label>
                <Select value={form.clientId} onValueChange={v => setForm(p => ({ ...p, clientId: v }))}>
                  <SelectTrigger className="col-span-3"><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>{(clients as any[]).map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Hotel</Label>
                <Input className="col-span-3" value={form.hotelName} onChange={e => setForm(p => ({ ...p, hotelName: e.target.value }))} placeholder="Hotel name" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">City</Label>
                <Select value={form.city} onValueChange={v => setForm(p => ({ ...p, city: v }))}>
                  <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="makkah">Makkah</SelectItem><SelectItem value="madinah">Madinah</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Check In</Label>
                <Input type="date" className="col-span-3" value={form.checkIn} onChange={e => setForm(p => ({ ...p, checkIn: e.target.value }))} />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Check Out</Label>
                <Input type="date" className="col-span-3" value={form.checkOut} onChange={e => setForm(p => ({ ...p, checkOut: e.target.value }))} />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Rooms</Label>
                <Input type="number" className="col-span-3" value={form.rooms} onChange={e => setForm(p => ({ ...p, rooms: Number(e.target.value) }))} />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Room Type</Label>
                <Select value={form.roomType} onValueChange={v => setForm(p => ({ ...p, roomType: v }))}>
                  <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                  <SelectContent>{["Single","Double","Twin","Triple","Suite"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Meal Plan</Label>
                <Select value={form.mealPlan} onValueChange={v => setForm(p => ({ ...p, mealPlan: v }))}>
                  <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                  <SelectContent>{["RO","BB","HB","FB"].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Notes</Label>
                <Input className="col-span-3" value={form.specialNotes} onChange={e => setForm(p => ({ ...p, specialNotes: e.target.value }))} placeholder="Special requirements" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => createRequest.mutate({ data: { ...form, clientId: Number(form.clientId) } })} disabled={!form.clientId || !form.hotelName || !form.checkIn || !form.checkOut || createRequest.isPending}>Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {["pending","sent_to_vendor","quoted","confirmed","cancelled"].map(s => <SelectItem key={s} value={s}>{s.replace(/_/g," ")}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {isLoading ? <div className="h-40 flex items-center justify-center text-muted-foreground">Loading...</div> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Hotel</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Rooms</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(requests as any[]).length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center h-32 text-muted-foreground">No hotel requests</TableCell></TableRow>
                ) : (requests as any[]).map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.clientName || `Client #${r.clientId}`}</TableCell>
                    <TableCell>{r.hotelName}</TableCell>
                    <TableCell className="capitalize">{r.city}</TableCell>
                    <TableCell className="text-sm">{new Date(r.checkIn).toLocaleDateString()} – {new Date(r.checkOut).toLocaleDateString()}</TableCell>
                    <TableCell>{r.rooms} × {r.roomType} ({r.mealPlan})</TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[r.status] || "bg-gray-100"}`}>{r.status.replace(/_/g," ")}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {r.status === "pending" && (
                          <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => updateRequest.mutate({ id: r.id, data: { status: "sent_to_vendor" } })}>
                            Send to Vendor
                          </Button>
                        )}
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
