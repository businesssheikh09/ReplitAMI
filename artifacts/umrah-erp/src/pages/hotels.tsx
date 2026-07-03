import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Star, Trash2, Edit, ImageIcon, X, Hotel as HotelIcon } from "lucide-react";

const ROOM_TYPES = ["Single", "Double", "Triple", "Quad", "Quint", "Family", "Junior Suite", "Executive Suite", "Presidential Suite"];
const MEAL_PLANS = ["RO", "BB", "HB", "FB", "AI"];
const CATEGORIES = ["Budget", "Economy", "Standard", "Superior", "Deluxe", "Ultra-Deluxe"];

type Hotel = {
  id: number;
  name: string;
  city: string;
  stars: number;
  distanceFromHaram: string;
  roomTypes: string[] | null;
  mealPlans: string[] | null;
  notes: string | null;
  description: string | null;
  category: string | null;
  defaultVendorId: number | null;
  imageUrl: string | null;
  googleImageUrl: string | null;
  vendorWhatsapp: string | null;
  vendorWhatsappGroupId: string | null;
  isActive: boolean;
};

type Vendor = { id: number; name: string; type: string };
type HotelVendor = { id: number; hotelId: number; vendorId: number; priority: number; whatsapp: string | null; whatsappGroupId: string | null; vendor: Vendor | null };

const EMPTY_FORM = {
  name: "", city: "makkah", stars: "5", distanceFromHaram: "",
  description: "", category: "", defaultVendorId: "",
  googleImageUrl: "", imageUrl: "",
  vendorWhatsapp: "", vendorWhatsappGroupId: "",
  notes: "", isActive: true,
  roomTypes: [] as string[], mealPlans: [] as string[],
};

export default function HotelsPage() {
  const { token } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editHotel, setEditHotel] = useState<Hotel | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [newVendorId, setNewVendorId] = useState("");

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const { data: hotels = [], isLoading } = useQuery<Hotel[]>({
    queryKey: ["/api/hotels", cityFilter, search],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (cityFilter !== "all") qs.set("city", cityFilter);
      if (search) qs.set("search", search);
      return fetch(`/api/hotels?${qs}`, { headers }).then((r) => r.json());
    },
    enabled: !!token,
  });

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
    queryFn: () => fetch("/api/vendors", { headers }).then((r) => r.json()),
    enabled: !!token,
    staleTime: 60_000,
  });

  const { data: editVendors = [], refetch: refetchEditVendors } = useQuery<HotelVendor[]>({
    queryKey: ["/api/hotels/vendors", editHotel?.id],
    queryFn: () => fetch(`/api/hotels/${editHotel!.id}/vendors`, { headers }).then((r) => r.json()),
    enabled: !!token && !!editHotel,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/hotels"] });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) =>
      fetch("/api/hotels", { method: "POST", headers, body: JSON.stringify({ ...data, stars: Number(data.stars), defaultVendorId: data.defaultVendorId || null }) }).then((r) => r.json()),
    onSuccess: () => { invalidate(); setCreateOpen(false); setForm({ ...EMPTY_FORM }); toast({ title: "Hotel added" }); },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: typeof form) =>
      fetch(`/api/hotels/${editHotel!.id}`, { method: "PATCH", headers, body: JSON.stringify({ ...data, stars: Number(data.stars), defaultVendorId: data.defaultVendorId || null }) }).then((r) => r.json()),
    onSuccess: () => { invalidate(); toast({ title: "Hotel updated" }); },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`/api/hotels/${id}`, { method: "DELETE", headers }).then((r) => r.json()),
    onSuccess: () => { invalidate(); toast({ title: "Hotel deleted" }); },
  });

  const addVendorMutation = useMutation({
    mutationFn: (vendorId: string) =>
      fetch(`/api/hotels/${editHotel!.id}/vendors`, { method: "POST", headers, body: JSON.stringify({ vendorId: parseInt(vendorId), priority: editVendors.length }) }).then((r) => r.json()),
    onSuccess: () => { refetchEditVendors(); setNewVendorId(""); },
    onError: () => toast({ title: "Failed to add vendor", variant: "destructive" }),
  });

  const removeVendorMutation = useMutation({
    mutationFn: (hvId: number) => fetch(`/api/hotels/${editHotel!.id}/vendors/${hvId}`, { method: "DELETE", headers }).then((r) => r.json()),
    onSuccess: () => refetchEditVendors(),
  });

  function openEdit(hotel: Hotel) {
    setEditHotel(hotel);
    setForm({
      name: hotel.name, city: hotel.city, stars: String(hotel.stars),
      distanceFromHaram: hotel.distanceFromHaram,
      description: hotel.description ?? "", category: hotel.category ?? "",
      defaultVendorId: hotel.defaultVendorId ? String(hotel.defaultVendorId) : "",
      googleImageUrl: hotel.googleImageUrl ?? "", imageUrl: hotel.imageUrl ?? "",
      vendorWhatsapp: hotel.vendorWhatsapp ?? "", vendorWhatsappGroupId: hotel.vendorWhatsappGroupId ?? "",
      notes: hotel.notes ?? "", isActive: hotel.isActive,
      roomTypes: hotel.roomTypes ?? [], mealPlans: hotel.mealPlans ?? [],
    });
  }

  function toggleArr(arr: string[], val: string): string[] {
    return arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];
  }

  const f = form;
  const set = (k: keyof typeof EMPTY_FORM) => (v: string | boolean | string[]) => setForm((p) => ({ ...p, [k]: v }));

  function HotelForm({ onSubmit, isPending }: { onSubmit: () => void; isPending: boolean }) {
    const imageUrl = f.googleImageUrl || f.imageUrl;
    return (
      <div className="space-y-4 overflow-y-auto max-h-[70vh] pr-1">
        {imageUrl && (
          <div className="w-full h-40 overflow-hidden rounded-lg border">
            <img src={imageUrl} alt="Hotel" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Hotel Name *</Label>
            <Input value={f.name} onChange={(e) => set("name")(e.target.value)} className="mt-1" placeholder="e.g. Hilton Suites Makkah" />
          </div>
          <div>
            <Label>City</Label>
            <Select value={f.city} onValueChange={set("city")}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="makkah">Makkah</SelectItem><SelectItem value="madinah">Madinah</SelectItem></SelectContent>
            </Select>
          </div>
          <div>
            <Label>Stars</Label>
            <Select value={f.stars} onValueChange={set("stars")}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{[3, 4, 5].map((s) => <SelectItem key={s} value={String(s)}>{s} Stars</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Distance from Haram *</Label>
            <Input value={f.distanceFromHaram} onChange={(e) => set("distanceFromHaram")(e.target.value)} className="mt-1" placeholder="500m" />
          </div>
          <div>
            <Label>Category</Label>
            <Select value={f.category || "_none"} onValueChange={(v) => set("category")(v === "_none" ? "" : v)}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">None</SelectItem>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Description</Label>
            <Textarea value={f.description} onChange={(e) => set("description")(e.target.value)} className="mt-1 h-20" placeholder="Hotel description…" />
          </div>
          <div className="col-span-2">
            <Label>Google Image URL</Label>
            <Input value={f.googleImageUrl} onChange={(e) => set("googleImageUrl")(e.target.value)} className="mt-1" placeholder="https://…" />
          </div>
          <div>
            <Label>WhatsApp Direct</Label>
            <Input value={f.vendorWhatsapp} onChange={(e) => set("vendorWhatsapp")(e.target.value)} className="mt-1" placeholder="923001234567" />
          </div>
          <div>
            <Label>WhatsApp Group ID</Label>
            <Input value={f.vendorWhatsappGroupId} onChange={(e) => set("vendorWhatsappGroupId")(e.target.value)} className="mt-1" placeholder="120363…@g.us" />
          </div>
        </div>

        <div>
          <Label className="mb-2 block">Room Types</Label>
          <div className="grid grid-cols-3 gap-1.5">
            {ROOM_TYPES.map((rt) => (
              <label key={rt} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <Checkbox checked={f.roomTypes.includes(rt)} onCheckedChange={() => set("roomTypes")(toggleArr(f.roomTypes, rt))} />
                {rt}
              </label>
            ))}
          </div>
        </div>

        <div>
          <Label className="mb-2 block">Meal Plans</Label>
          <div className="flex gap-3 flex-wrap">
            {MEAL_PLANS.map((mp) => (
              <label key={mp} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <Checkbox checked={f.mealPlans.includes(mp)} onCheckedChange={() => set("mealPlans")(toggleArr(f.mealPlans, mp))} />
                {mp}
              </label>
            ))}
          </div>
        </div>

        <div>
          <Label>Notes</Label>
          <Textarea value={f.notes} onChange={(e) => set("notes")(e.target.value)} className="mt-1 h-16" />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={onSubmit} disabled={!f.name || !f.distanceFromHaram || isPending}>
            {isPending ? "Saving…" : "Save Hotel"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Hotel Database</h2>
          <p className="text-muted-foreground">Makkah and Madinah hotel master records.</p>
        </div>
        <Button onClick={() => { setForm({ ...EMPTY_FORM }); setCreateOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Add Hotel
        </Button>
      </div>

      {/* Add Hotel dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Add Hotel</DialogTitle></DialogHeader>
          <HotelForm onSubmit={() => createMutation.mutate(form)} isPending={createMutation.isPending} />
        </DialogContent>
      </Dialog>

      {/* Edit Hotel sheet */}
      <Sheet open={!!editHotel} onOpenChange={(o) => !o && setEditHotel(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Hotel — {editHotel?.name}</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <HotelForm onSubmit={() => updateMutation.mutate(form)} isPending={updateMutation.isPending} />

            {/* Vendor Management */}
            <div className="mt-6 border-t pt-4">
              <h4 className="font-semibold mb-3">Hotel Vendors</h4>
              <div className="space-y-2 mb-3">
                {editVendors.length === 0 && <p className="text-sm text-muted-foreground">No vendors linked yet</p>}
                {editVendors.map((hv) => (
                  <div key={hv.id} className="flex items-center justify-between bg-muted/50 rounded-md px-3 py-2">
                    <div>
                      <span className="font-medium text-sm">{hv.vendor?.name ?? `Vendor ${hv.vendorId}`}</span>
                      <span className="text-xs text-muted-foreground ml-2">Priority {hv.priority}</span>
                      {hv.whatsapp && <span className="text-xs text-muted-foreground ml-2">📱 {hv.whatsapp}</span>}
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => removeVendorMutation.mutate(hv.id)}>
                      <X className="h-3 w-3 text-red-400" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Select value={newVendorId} onValueChange={setNewVendorId}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Add vendor…" /></SelectTrigger>
                  <SelectContent>
                    {vendors
                      .filter((v) => !editVendors.find((hv) => hv.vendorId === v.id))
                      .map((v) => <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="sm" disabled={!newVendorId || addVendorMutation.isPending} onClick={() => addVendorMutation.mutate(newVendorId)}>
                  Add
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search hotels…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
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

      {/* Hotel Grid */}
      {isLoading ? (
        <div className="h-40 flex items-center justify-center text-muted-foreground">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {hotels.map((h) => {
            const imgUrl = h.googleImageUrl || h.imageUrl;
            return (
              <Card key={h.id} className={`border hover:shadow-md transition-shadow ${!h.isActive ? "opacity-60" : ""}`}>
                {imgUrl && (
                  <div className="w-full h-36 overflow-hidden rounded-t-lg bg-muted">
                    <img
                      src={imgUrl}
                      alt={h.name}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = "none"; }}
                    />
                  </div>
                )}
                {!imgUrl && (
                  <div className="w-full h-24 rounded-t-lg bg-muted flex items-center justify-center">
                    <HotelIcon className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                )}
                <CardContent className="pt-3 pb-4">
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{h.name}</div>
                      <div className="text-xs text-muted-foreground capitalize">{h.city}{h.category ? ` · ${h.category}` : ""}</div>
                    </div>
                    <div className="flex gap-1 ml-2 flex-shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(h)} className="h-7 w-7 p-0">
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate(h.id)} className="h-7 w-7 p-0">
                        <Trash2 className="h-3 w-3 text-red-400" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 mb-2">
                    {Array.from({ length: h.stars }).map((_, i) => <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />)}
                  </div>
                  <div className="text-xs text-muted-foreground mb-2">📍 {h.distanceFromHaram} from Haram</div>
                  {h.description && <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{h.description}</p>}
                  {h.roomTypes && h.roomTypes.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1">
                      {h.roomTypes.slice(0, 4).map((rt) => <Badge key={rt} variant="secondary" className="text-xs">{rt}</Badge>)}
                      {h.roomTypes.length > 4 && <Badge variant="outline" className="text-xs">+{h.roomTypes.length - 4}</Badge>}
                    </div>
                  )}
                  {h.mealPlans && h.mealPlans.length > 0 && (
                    <div className="text-xs text-muted-foreground">Meals: {h.mealPlans.join(", ")}</div>
                  )}
                  {!h.isActive && <Badge variant="destructive" className="mt-1 text-xs">Inactive</Badge>}
                </CardContent>
              </Card>
            );
          })}
          {hotels.length === 0 && (
            <div className="col-span-3 text-center h-32 flex items-center justify-center text-muted-foreground">No hotels found</div>
          )}
        </div>
      )}
    </div>
  );
}
