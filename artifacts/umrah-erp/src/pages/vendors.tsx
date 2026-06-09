import { useState } from "react";
import { useListVendors, useCreateVendor, useDeleteVendor } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Trash2, Star } from "lucide-react";

const VENDOR_TYPES = ["hotel","transport","airline","visa","other"];

export default function VendorsPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", type: "hotel", contactName: "", email: "", phone: "", country: "" });
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: vendors = [], isLoading } = useListVendors({ type: typeFilter !== "all" ? typeFilter : undefined, search: search || undefined });
  const createVendor = useCreateVendor({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/vendors"] }); setOpen(false); toast({ title: "Vendor added" }); } } });
  const deleteVendor = useDeleteVendor({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/vendors"] }); toast({ title: "Vendor deleted" }); } } });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Vendors</h2>
          <p className="text-muted-foreground">Manage hotels, transport, airline, and visa vendors.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add Vendor</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Vendor</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Type</Label>
                <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}>
                  <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                  <SelectContent>{VENDOR_TYPES.map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {[["name","Company Name"],["contactName","Contact Name"],["email","Email"],["phone","Phone"],["country","Country"]].map(([k, label]) => (
                <div key={k} className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">{label}</Label>
                  <Input className="col-span-3" value={(form as any)[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => createVendor.mutate({ data: form })} disabled={!form.name || !form.contactName || !form.email || !form.phone || !form.country || createVendor.isPending}>Add</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search vendors..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {VENDOR_TYPES.map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? <div className="h-40 flex items-center justify-center text-muted-foreground">Loading...</div> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Deals</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(vendors as any[]).length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center h-32 text-muted-foreground">No vendors found</TableCell></TableRow>
                ) : (vendors as any[]).map((v: any) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">{v.name}</TableCell>
                    <TableCell><span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs">{v.type}</span></TableCell>
                    <TableCell>
                      <div className="text-sm">{v.contactName}</div>
                      <div className="text-xs text-muted-foreground">{v.email}</div>
                    </TableCell>
                    <TableCell>{v.country}</TableCell>
                    <TableCell>
                      {v.rating ? (
                        <div className="flex items-center gap-1">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          <span className="text-sm">{v.rating.toFixed(1)}</span>
                        </div>
                      ) : "—"}
                    </TableCell>
                    <TableCell>{v.totalDeals || 0}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => deleteVendor.mutate({ id: v.id })}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
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
