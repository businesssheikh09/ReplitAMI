import { useState } from "react";
import { useListHotels, useCreateHotel, useDeleteHotel, HotelInputCity } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Star, Trash2 } from "lucide-react";

export default function HotelsPage() {
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ name: string; city: HotelInputCity; stars: string; distanceFromHaram: string; vendorWhatsapp: string; vendorWhatsappGroupId: string; googleImageUrl: string }>({ name: "", city: HotelInputCity.makkah, stars: "5", distanceFromHaram: "", vendorWhatsapp: "", vendorWhatsappGroupId: "", googleImageUrl: "" });
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: hotels = [], isLoading } = useListHotels({ city: cityFilter !== "all" ? cityFilter : undefined, search: search || undefined });
  const createHotel = useCreateHotel({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/hotels"] }); setOpen(false); toast({ title: "Hotel added" }); } } });
  const deleteHotel = useDeleteHotel({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/hotels"] }); toast({ title: "Hotel deleted" }); } } });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Hotel Database</h2>
          <p className="text-muted-foreground">Manage Makkah and Madinah hotel inventory.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add Hotel</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Hotel</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              {[["name","Hotel Name"],["distanceFromHaram","Distance from Haram"],["vendorWhatsapp","Vendor WhatsApp"],["vendorWhatsappGroupId","WhatsApp Group ID"],["googleImageUrl","Google Image URL"]].map(([k, label]) => (
                <div key={k} className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">{label}</Label>
                  <Input className="col-span-3" value={(form as any)[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} />
                </div>
              ))}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">City</Label>
                <Select value={form.city} onValueChange={v => setForm(p => ({ ...p, city: v as HotelInputCity }))}>
                  <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value={HotelInputCity.makkah}>Makkah</SelectItem><SelectItem value={HotelInputCity.madinah}>Madinah</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Stars</Label>
                <Select value={form.stars} onValueChange={v => setForm(p => ({ ...p, stars: v }))}>
                  <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                  <SelectContent>{[3,4,5].map(s => <SelectItem key={s} value={String(s)}>{s} Stars</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => createHotel.mutate({ data: { ...form, stars: Number(form.stars) } })} disabled={!form.name || !form.distanceFromHaram || createHotel.isPending}>Add Hotel</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search hotels..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={cityFilter} onValueChange={setCityFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cities</SelectItem>
                <SelectItem value="makkah">Makkah</SelectItem>
                <SelectItem value="madinah">Madinah</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? <div className="h-40 flex items-center justify-center text-muted-foreground">Loading...</div> : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(hotels as any[]).map((h: any) => (
                <Card key={h.id} className="border hover:shadow-md transition-shadow">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-semibold">{h.name}</div>
                        <div className="text-sm text-muted-foreground capitalize">{h.city}</div>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => deleteHotel.mutate({ id: h.id })}>
                        <Trash2 className="h-3 w-3 text-red-400" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-1 mb-2">
                      {Array.from({ length: h.stars }).map((_, i) => (
                        <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                    <div className="text-xs text-muted-foreground">📍 {h.distanceFromHaram} from Haram</div>
                    {h.roomTypes && h.roomTypes.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {h.roomTypes.map((rt: string) => (
                          <Badge key={rt} variant="secondary" className="text-xs">{rt}</Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
              {(hotels as any[]).length === 0 && (
                <div className="col-span-3 text-center h-32 flex items-center justify-center text-muted-foreground">No hotels found</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
