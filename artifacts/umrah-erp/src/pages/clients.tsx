import { useState } from "react";
import { Link } from "wouter";
import { useListClients, useCreateClient, useDeleteClient } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Eye, Trash2, Users } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  new: "bg-slate-100 text-slate-700",
  contacted: "bg-blue-100 text-blue-700",
  qualified: "bg-cyan-100 text-cyan-700",
  proposal: "bg-purple-100 text-purple-700",
  negotiation: "bg-amber-100 text-amber-700",
  won: "bg-green-100 text-green-700",
  lost: "bg-red-100 text-red-700",
};

export default function ClientsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", country: "", city: "", whatsapp: "", leadStatus: "new" });
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: clients = [], isLoading } = useListClients({ search: search || undefined, status: statusFilter !== "all" ? statusFilter : undefined });
  const createClient = useCreateClient({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/clients"] }); setOpen(false); setForm({ name: "", email: "", phone: "", country: "", city: "", whatsapp: "", leadStatus: "new" }); toast({ title: "Client created" }); } } });
  const deleteClient = useDeleteClient({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/clients"] }); toast({ title: "Client deleted" }); } } });

  const handleCreate = () => {
    if (!form.name || !form.email || !form.phone || !form.country) {
      toast({ title: "Required fields missing", variant: "destructive" });
      return;
    }
    createClient.mutate({ data: form });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Clients</h2>
          <p className="text-muted-foreground">Manage your CRM and client relationships.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> New Client</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader><DialogTitle>Add New Client</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              {[["name","Full Name"],["email","Email"],["phone","Phone"],["whatsapp","WhatsApp"],["country","Country"],["city","City"]].map(([k, label]) => (
                <div key={k} className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">{label}</Label>
                  <Input className="col-span-3" value={(form as any)[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} />
                </div>
              ))}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Status</Label>
                <Select value={form.leadStatus} onValueChange={v => setForm(p => ({ ...p, leadStatus: v }))}>
                  <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["new","contacted","qualified","proposal","negotiation","won","lost"].map(s => (
                      <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={createClient.isPending}>Create Client</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Clients", value: clients.length, color: "text-blue-600" },
          { label: "Won Deals", value: clients.filter((c: any) => c.leadStatus === "won").length, color: "text-green-600" },
          { label: "In Negotiation", value: clients.filter((c: any) => c.leadStatus === "negotiation").length, color: "text-amber-600" },
          { label: "Lost", value: clients.filter((c: any) => c.leadStatus === "lost").length, color: "text-red-600" },
        ].map(s => (
          <Card key={s.label}>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle></CardHeader>
            <CardContent><div className={`text-2xl font-bold ${s.color}`}>{s.value}</div></CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search clients..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Filter by status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {["new","contacted","qualified","proposal","negotiation","won","lost"].map(s => (
                  <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground">Loading clients...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Bookings</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center h-32 text-muted-foreground"><Users className="mx-auto h-8 w-8 mb-2" />No clients found</TableCell></TableRow>
                ) : (clients as any[]).map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="font-medium">{c.name}</div>
                      {c.city && <div className="text-xs text-muted-foreground">{c.city}</div>}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{c.email}</div>
                      <div className="text-xs text-muted-foreground">{c.phone}</div>
                    </TableCell>
                    <TableCell>{c.country}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.leadStatus] || "bg-gray-100"}`}>
                        {c.leadStatus}
                      </span>
                    </TableCell>
                    <TableCell>{c.totalBookings || 0}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Link href={`/crm/${c.id}`}>
                          <Button size="sm" variant="ghost"><Eye className="h-4 w-4" /></Button>
                        </Link>
                        <Button size="sm" variant="ghost" onClick={() => deleteClient.mutate({ id: c.id })}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
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
