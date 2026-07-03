import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Send, Plus, CheckCircle, Clock, Users, Hotel,
  Calendar, BedDouble, Utensils, GitBranch, MessageSquare, FileText, Bell,
} from "lucide-react";

const STATUS_STEPS = [
  { key: "pending",           label: "Pending",             icon: Clock },
  { key: "sent_to_vendors",   label: "Sent to Vendors",     icon: Send },
  { key: "quotes_received",   label: "Quotes Received",     icon: FileText },
  { key: "vendor_selected",   label: "Vendor Selected",     icon: CheckCircle },
  { key: "invoice_generated", label: "Invoice Generated",   icon: FileText },
  { key: "customer_notified", label: "Customer Notified",   icon: Bell },
];

const STATUS_COLORS: Record<string, string> = {
  pending:           "bg-amber-100 text-amber-700",
  sent_to_vendors:   "bg-blue-100 text-blue-700",
  sent_to_vendor:    "bg-blue-100 text-blue-700",
  quotes_received:   "bg-purple-100 text-purple-700",
  vendor_selected:   "bg-indigo-100 text-indigo-700",
  invoice_generated: "bg-green-100 text-green-700",
  customer_notified: "bg-emerald-100 text-emerald-700",
  confirmed:         "bg-green-100 text-green-700",
  cancelled:         "bg-red-100 text-red-700",
};

const ROOM_TYPES = ["Single", "Double", "Triple", "Quad", "Quint", "Family", "Junior Suite", "Executive Suite", "Presidential Suite"];
const MEAL_PLANS = ["RO", "BB", "HB", "FB", "AI"];

type Request = {
  id: number;
  referenceNumber: string | null;
  clientName: string | null;
  clientWhatsapp: string | null;
  hotelName: string;
  city: string;
  checkIn: string;
  checkOut: string;
  rooms: number;
  noOfPax: number;
  roomType: string;
  mealPlan: string;
  specialNotes: string | null;
  status: string;
  selectedQuoteId: number | null;
  invoiceId: number | null;
  notifiedAt: string | null;
  quotes: Quote[];
  events: Event[];
};

type Quote = {
  id: number;
  vendorId: number;
  vendorName: string;
  pricePerRoom: number;
  totalPrice: number | null;
  currency: string;
  mealPlan: string | null;
  roomType: string | null;
  distance: string | null;
  availability: string | null;
  cancellationPolicy: string | null;
  notes: string | null;
  isSelected: boolean;
  status: string;
  respondedAt: string;
};

type Event = {
  id: number;
  eventType: string;
  statusBefore: string | null;
  statusAfter: string | null;
  notes: string | null;
  userName: string | null;
  createdAt: string;
};

type Vendor = { id: number; name: string; phone: string };
type Hotel = { id: number; name: string; vendorWhatsapp: string | null; vendorWhatsappGroupId: string | null };
type HotelVendor = { id: number; vendorId: number; priority: number; whatsapp: string | null; whatsappGroupId: string | null; vendor: { id: number; name: string } | null };

function stepIndex(status: string) {
  const idx = STATUS_STEPS.findIndex((s) => s.key === status);
  if (idx !== -1) return idx;
  if (status === "sent_to_vendor") return 1;
  if (status === "confirmed") return 3;
  return 0;
}

export default function HotelRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const reqId = parseInt(id!);
  const { token } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const [quoteOpen, setQuoteOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [previewMsg, setPreviewMsg] = useState("");
  const [notifyMsg, setNotifyMsg] = useState("");
  const [selectedTargets, setSelectedTargets] = useState<Array<{ jid: string; vendorName?: string }>>([]);

  const [quoteForm, setQuoteForm] = useState({
    vendorId: "", pricePerRoom: "", currency: "SAR",
    mealPlan: "", roomType: "", distance: "", availability: "",
    cancellationPolicy: "", notes: "",
  });

  const { data: request, isLoading, error } = useQuery<Request>({
    queryKey: ["/api/hotel-requests", reqId],
    queryFn: () => fetch(`/api/hotel-requests/${reqId}`, { headers }).then((r) => r.json()),
    enabled: !!token,
    refetchInterval: 15_000,
  });

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
    queryFn: () => fetch("/api/vendors", { headers }).then((r) => r.json()),
    enabled: !!token,
    staleTime: 60_000,
  });

  const { data: hotels = [] } = useQuery<Hotel[]>({
    queryKey: ["/api/hotels"],
    queryFn: () => fetch("/api/hotels", { headers }).then((r) => r.json()),
    enabled: !!token,
    staleTime: 60_000,
  });

  const { data: hotelVendors = [] } = useQuery<HotelVendor[]>({
    queryKey: ["/api/hotels/vendors", request?.hotelName],
    queryFn: async () => {
      const h = hotels.find((x) => x.name.toLowerCase() === request!.hotelName.toLowerCase());
      if (!h) return [];
      return fetch(`/api/hotels/${h.id}/vendors`, { headers }).then((r) => r.json());
    },
    enabled: !!token && !!request && hotels.length > 0,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/hotel-requests", reqId] });

  const addQuote = useMutation({
    mutationFn: (data: typeof quoteForm) =>
      fetch(`/api/hotel-requests/${reqId}/quotes`, {
        method: "POST", headers,
        body: JSON.stringify({ ...data, vendorId: parseInt(data.vendorId), pricePerRoom: parseFloat(data.pricePerRoom) }),
      }).then((r) => r.json()),
    onSuccess: () => { invalidate(); setQuoteOpen(false); setQuoteForm({ vendorId: "", pricePerRoom: "", currency: "SAR", mealPlan: "", roomType: "", distance: "", availability: "", cancellationPolicy: "", notes: "" }); toast({ title: "Quote added" }); },
    onError: () => toast({ title: "Failed to add quote", variant: "destructive" }),
  });

  const selectVendor = useMutation({
    mutationFn: (quoteId: number) =>
      fetch(`/api/hotel-requests/${reqId}/quotes/${quoteId}/select`, { method: "PATCH", headers, body: "{}" }).then((r) => r.json()),
    onSuccess: (data) => {
      invalidate();
      toast({ title: `✅ Vendor selected — Invoice ${data.invoice?.dnNumber} created` });
    },
    onError: () => toast({ title: "Failed to select vendor", variant: "destructive" }),
  });

  const previewSend = useMutation({
    mutationFn: () =>
      fetch(`/api/hotel-requests/${reqId}/send-to-vendor`, {
        method: "POST", headers,
        body: JSON.stringify({ preview: true }),
      }).then((r) => r.json()),
    onSuccess: (data) => {
      setPreviewMsg(data.message ?? "");
      const hotel = hotels.find((h) => h.name.toLowerCase() === request?.hotelName.toLowerCase());
      const defaultTargets: Array<{ jid: string; vendorName?: string }> = [];
      if (hotel?.vendorWhatsappGroupId) defaultTargets.push({ jid: hotel.vendorWhatsappGroupId, vendorName: "Hotel Group" });
      else if (hotel?.vendorWhatsapp) defaultTargets.push({ jid: hotel.vendorWhatsapp, vendorName: hotel.name });
      hotelVendors.forEach((hv) => {
        const jid = hv.whatsappGroupId || hv.whatsapp;
        if (jid) defaultTargets.push({ jid, vendorName: hv.vendor?.name });
      });
      setSelectedTargets(defaultTargets);
    },
  });

  const sendToVendor = useMutation({
    mutationFn: () =>
      fetch(`/api/hotel-requests/${reqId}/send-to-vendor`, {
        method: "POST", headers,
        body: JSON.stringify({ targets: selectedTargets, message: previewMsg }),
      }).then((r) => r.json()),
    onSuccess: (data) => {
      invalidate();
      const sent = data.results?.filter((r: any) => r.sent).length ?? 0;
      toast({ title: `✅ Sent to ${sent} target(s)` });
      setSendOpen(false);
    },
    onError: () => toast({ title: "Failed to send", variant: "destructive" }),
  });

  const previewNotify = useMutation({
    mutationFn: () =>
      fetch(`/api/hotel-requests/${reqId}/notify-client`, {
        method: "POST", headers,
        body: JSON.stringify({ preview: true }),
      }).then((r) => r.json()),
    onSuccess: (data) => setNotifyMsg(data.message ?? ""),
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const notifyClient = useMutation({
    mutationFn: () =>
      fetch(`/api/hotel-requests/${reqId}/notify-client`, {
        method: "POST", headers,
        body: JSON.stringify({ message: notifyMsg }),
      }).then((r) => r.json()),
    onSuccess: () => { invalidate(); toast({ title: "✅ Customer notified via WhatsApp" }); setNotifyOpen(false); },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  if (error || !request) return <div className="p-8 text-center text-red-600">Request not found</div>;

  const ci = new Date(request.checkIn).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
  const co = new Date(request.checkOut).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
  const nights = Math.round((new Date(request.checkOut).getTime() - new Date(request.checkIn).getTime()) / 86_400_000);
  const currentStep = stepIndex(request.status);
  const canSend = !["invoice_generated", "customer_notified"].includes(request.status);
  const canNotify = !!request.invoiceId && request.status !== "customer_notified";

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/hotel-requests">
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
          </Link>
          <div>
            <h2 className="text-xl font-bold">{request.referenceNumber ?? `REQ-${request.id}`} — {request.hotelName}</h2>
            <p className="text-sm text-muted-foreground">{request.clientName} · {request.city}</p>
          </div>
          <Badge className={STATUS_COLORS[request.status] ?? "bg-gray-100 text-gray-700"}>
            {request.status.replace(/_/g, " ")}
          </Badge>
        </div>
        <div className="flex gap-2">
          {canSend && (
            <Button size="sm" variant="outline" onClick={() => { setSendOpen(true); previewSend.mutate(); }}>
              <Send className="h-4 w-4 mr-1.5" /> Send to Vendor
            </Button>
          )}
          {request.quotes.length > 1 && (
            <Link href={`/hotel-requests/${reqId}/compare`}>
              <Button size="sm" variant="outline"><GitBranch className="h-4 w-4 mr-1.5" /> Compare Quotes</Button>
            </Link>
          )}
          {canNotify && (
            <Button size="sm" variant="outline" onClick={() => { setNotifyOpen(true); previewNotify.mutate(); }}>
              <MessageSquare className="h-4 w-4 mr-1.5" /> Notify Client
            </Button>
          )}
        </div>
      </div>

      {/* Status stepper */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-0">
            {STATUS_STEPS.map((step, idx) => {
              const done = idx < currentStep;
              const active = idx === currentStep;
              const Icon = step.icon;
              return (
                <div key={step.key} className="flex items-center flex-1 min-w-0">
                  <div className="flex flex-col items-center gap-1 min-w-0">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${done ? "bg-green-500 text-white" : active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                      {done ? "✓" : <Icon className="h-3.5 w-3.5" />}
                    </div>
                    <span className={`text-xs text-center leading-tight truncate max-w-[70px] ${active ? "font-semibold" : "text-muted-foreground"}`}>{step.label}</span>
                  </div>
                  {idx < STATUS_STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mb-4 mx-1 ${idx < currentStep ? "bg-green-500" : "bg-muted"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Request info + Quotes */}
        <div className="col-span-2 space-y-4">
          {/* Info cards */}
          <div className="grid grid-cols-2 gap-3">
            <Card><CardContent className="pt-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Calendar className="h-3.5 w-3.5" /> Dates</div>
              <div className="font-medium text-sm">{ci} → {co}</div>
              <div className="text-xs text-muted-foreground">{nights} night{nights !== 1 ? "s" : ""}</div>
            </CardContent></Card>
            <Card><CardContent className="pt-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><BedDouble className="h-3.5 w-3.5" /> Rooms</div>
              <div className="font-medium text-sm">{request.rooms} × {request.roomType}</div>
              <div className="text-xs text-muted-foreground"><Utensils className="inline h-3 w-3 mr-1" />{request.mealPlan}</div>
            </CardContent></Card>
            <Card><CardContent className="pt-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Users className="h-3.5 w-3.5" /> Guests</div>
              <div className="font-medium text-sm">{request.noOfPax} PAX</div>
            </CardContent></Card>
            <Card><CardContent className="pt-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Hotel className="h-3.5 w-3.5" /> Client</div>
              <div className="font-medium text-sm">{request.clientName ?? "—"}</div>
              {request.clientWhatsapp && <div className="text-xs text-muted-foreground">📱 {request.clientWhatsapp}</div>}
            </CardContent></Card>
          </div>

          {request.specialNotes && (
            <Card><CardContent className="pt-3 pb-3">
              <p className="text-xs text-muted-foreground mb-1">Special Requests</p>
              <p className="text-sm">{request.specialNotes}</p>
            </CardContent></Card>
          )}

          {/* Invoice link */}
          {request.invoiceId && (
            <Card className="border-green-200 bg-green-50/50">
              <CardContent className="pt-3 pb-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-green-700 font-medium">Hotel Invoice Created</p>
                  <p className="text-sm">Invoice #{request.invoiceId}</p>
                </div>
                <Link href={`/accounting/hotel-invoice/${request.invoiceId}`}>
                  <Button size="sm" variant="outline" className="border-green-300 text-green-700"><FileText className="h-3.5 w-3.5 mr-1" /> View Invoice</Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Vendor Quotes */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Vendor Quotes ({request.quotes.length})</h3>
              <div className="flex gap-2">
                {request.quotes.length > 1 && (
                  <Link href={`/hotel-requests/${reqId}/compare`}>
                    <Button size="sm" variant="outline"><GitBranch className="h-3.5 w-3.5 mr-1" /> Compare</Button>
                  </Link>
                )}
                <Button size="sm" onClick={() => setQuoteOpen(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Quote
                </Button>
              </div>
            </div>

            {request.quotes.length === 0 && (
              <Card><CardContent className="py-6 text-center text-muted-foreground text-sm">No quotes yet. Send enquiry to vendors first.</CardContent></Card>
            )}

            <div className="space-y-3">
              {request.quotes.map((q) => (
                <Card key={q.id} className={`border ${q.isSelected ? "border-green-400 bg-green-50/50" : ""}`}>
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold">{q.vendorName}</span>
                          {q.isSelected && <Badge className="bg-green-100 text-green-700 text-xs">Selected</Badge>}
                          <Badge variant="outline" className="text-xs">{q.currency}</Badge>
                        </div>
                        <div className="text-lg font-bold text-primary">
                          {q.currency} {q.pricePerRoom.toLocaleString("en-PK", { minimumFractionDigits: 2 })}/room
                          {q.totalPrice && <span className="text-sm font-normal text-muted-foreground ml-2">Total: {q.totalPrice.toLocaleString("en-PK", { minimumFractionDigits: 2 })}</span>}
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 mt-2 text-xs text-muted-foreground">
                          {q.mealPlan && <span>🍽 {q.mealPlan}</span>}
                          {q.roomType && <span>🛏 {q.roomType}</span>}
                          {q.distance && <span>📍 {q.distance}</span>}
                          {q.availability && <span>✅ {q.availability}</span>}
                          {q.cancellationPolicy && <span className="col-span-2">⚠️ {q.cancellationPolicy}</span>}
                          {q.notes && <span className="col-span-2 italic">{q.notes}</span>}
                        </div>
                      </div>
                      {!q.isSelected && !["invoice_generated", "customer_notified"].includes(request.status) && (
                        <Button size="sm" onClick={() => selectVendor.mutate(q.id)} disabled={selectVendor.isPending}>
                          Select Vendor
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>

        {/* Right: History */}
        <div>
          <h3 className="font-semibold mb-3">Audit History</h3>
          <div className="space-y-2">
            {request.events.length === 0 && <p className="text-sm text-muted-foreground">No events yet</p>}
            {request.events.map((ev) => (
              <div key={ev.id} className="flex gap-2 text-xs">
                <div className="w-1.5 flex-shrink-0 flex flex-col items-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  <div className="w-px flex-1 bg-border" />
                </div>
                <div className="pb-3 flex-1">
                  <div className="font-medium capitalize">{ev.eventType.replace(/_/g, " ")}</div>
                  {ev.notes && <div className="text-muted-foreground">{ev.notes}</div>}
                  <div className="text-muted-foreground/70 mt-0.5">
                    {ev.userName ?? "System"} · {new Date(ev.createdAt).toLocaleString("en-PK")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Add Quote Dialog ─────────────────────────────────────── */}
      <Dialog open={quoteOpen} onOpenChange={setQuoteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Vendor Quote</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Vendor *</Label>
              <Select value={quoteForm.vendorId} onValueChange={(v) => setQuoteForm((p) => ({ ...p, vendorId: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select vendor…" /></SelectTrigger>
                <SelectContent>
                  {vendors.map((v) => <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Price / Room *</Label>
                <Input value={quoteForm.pricePerRoom} onChange={(e) => setQuoteForm((p) => ({ ...p, pricePerRoom: e.target.value }))} className="mt-1" placeholder="500" type="number" />
              </div>
              <div>
                <Label>Currency</Label>
                <Select value={quoteForm.currency} onValueChange={(v) => setQuoteForm((p) => ({ ...p, currency: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["SAR", "USD", "PKR", "EUR"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Meal Plan</Label>
                <Select value={quoteForm.mealPlan || "_none"} onValueChange={(v) => setQuoteForm((p) => ({ ...p, mealPlan: v === "_none" ? "" : v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">None</SelectItem>
                    {MEAL_PLANS.map((mp) => <SelectItem key={mp} value={mp}>{mp}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Room Type</Label>
                <Select value={quoteForm.roomType || "_none"} onValueChange={(v) => setQuoteForm((p) => ({ ...p, roomType: v === "_none" ? "" : v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">None</SelectItem>
                    {ROOM_TYPES.map((rt) => <SelectItem key={rt} value={rt}>{rt}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Distance from Haram</Label>
                <Input value={quoteForm.distance} onChange={(e) => setQuoteForm((p) => ({ ...p, distance: e.target.value }))} className="mt-1" placeholder="500m" />
              </div>
              <div>
                <Label>Availability</Label>
                <Input value={quoteForm.availability} onChange={(e) => setQuoteForm((p) => ({ ...p, availability: e.target.value }))} className="mt-1" placeholder="Available" />
              </div>
            </div>
            <div>
              <Label>Cancellation Policy</Label>
              <Input value={quoteForm.cancellationPolicy} onChange={(e) => setQuoteForm((p) => ({ ...p, cancellationPolicy: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={quoteForm.notes} onChange={(e) => setQuoteForm((p) => ({ ...p, notes: e.target.value }))} className="mt-1 h-16" />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setQuoteOpen(false)}>Cancel</Button>
            <Button onClick={() => addQuote.mutate(quoteForm)} disabled={!quoteForm.vendorId || !quoteForm.pricePerRoom || addQuote.isPending}>
              {addQuote.isPending ? "Adding…" : "Add Quote"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Send to Vendor Dialog ────────────────────────────────── */}
      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Send Enquiry to Vendors</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">Message Preview</Label>
              <Textarea
                value={previewMsg}
                onChange={(e) => setPreviewMsg(e.target.value)}
                className="h-48 font-mono text-xs"
              />
            </div>
            <div>
              <Label className="mb-2 block">Send Targets</Label>
              <div className="space-y-2">
                {selectedTargets.map((t, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm bg-muted/50 rounded px-3 py-1.5">
                    <span>{t.vendorName ?? t.jid}</span>
                    <span className="text-xs text-muted-foreground font-mono truncate max-w-32">{t.jid}</span>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-red-500" onClick={() => setSelectedTargets((p) => p.filter((_, i) => i !== idx))}>✕</Button>
                  </div>
                ))}
                {selectedTargets.length === 0 && <p className="text-xs text-muted-foreground">No targets configured. Add hotel vendors with WhatsApp numbers first.</p>}
              </div>
              {/* Manual JID add */}
              <div className="flex gap-2 mt-2">
                <Input
                  placeholder="Add JID manually (923001234567@s.whatsapp.net or group@g.us)"
                  className="text-xs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const jid = (e.target as HTMLInputElement).value.trim();
                      if (jid) { setSelectedTargets((p) => [...p, { jid }]); (e.target as HTMLInputElement).value = ""; }
                    }
                  }}
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setSendOpen(false)}>Cancel</Button>
            <Button onClick={() => sendToVendor.mutate()} disabled={!selectedTargets.length || sendToVendor.isPending}>
              <Send className="h-4 w-4 mr-1.5" /> {sendToVendor.isPending ? "Sending…" : `Send to ${selectedTargets.length} Target(s)`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Notify Client Dialog ─────────────────────────────────── */}
      <Dialog open={notifyOpen} onOpenChange={setNotifyOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Send Confirmation to Client</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">WhatsApp: {request.clientWhatsapp ?? "No number on client record"}</p>
            <div>
              <Label className="mb-2 block">Message Preview</Label>
              <Textarea value={notifyMsg} onChange={(e) => setNotifyMsg(e.target.value)} className="h-48 font-mono text-xs" />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setNotifyOpen(false)}>Cancel</Button>
            <Button onClick={() => notifyClient.mutate()} disabled={!request.clientWhatsapp || notifyClient.isPending}>
              <MessageSquare className="h-4 w-4 mr-1.5" /> {notifyClient.isPending ? "Sending…" : "Send WhatsApp"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
