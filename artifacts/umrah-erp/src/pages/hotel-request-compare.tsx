import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CheckCircle, Trophy } from "lucide-react";

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

type Request = {
  id: number;
  referenceNumber: string | null;
  hotelName: string;
  city: string;
  checkIn: string;
  checkOut: string;
  rooms: number;
  noOfPax: number;
  roomType: string;
  mealPlan: string;
  status: string;
  quotes: Quote[];
};

type SortKey = "price" | "vendor" | "distance";

function scoreQuote(q: Quote): number {
  return (q.totalPrice ?? q.pricePerRoom);
}

export default function HotelRequestComparePage() {
  const { id } = useParams<{ id: string }>();
  const reqId = parseInt(id!);
  const { token } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const [sortKey, setSortKey] = useState<SortKey>("price");

  const { data: request, isLoading } = useQuery<Request>({
    queryKey: ["/api/hotel-requests", reqId],
    queryFn: () => fetch(`/api/hotel-requests/${reqId}`, { headers }).then((r) => r.json()),
    enabled: !!token,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/hotel-requests", reqId] });

  const selectVendor = useMutation({
    mutationFn: (quoteId: number) =>
      fetch(`/api/hotel-requests/${reqId}/quotes/${quoteId}/select`, { method: "PATCH", headers, body: "{}" }).then((r) => r.json()),
    onSuccess: (data) => {
      invalidate();
      toast({ title: `✅ Vendor selected — Invoice ${data.invoice?.dnNumber} created` });
    },
    onError: () => toast({ title: "Failed to select vendor", variant: "destructive" }),
  });

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  if (!request) return <div className="p-8 text-center text-red-600">Request not found</div>;

  const quotes = [...(request.quotes ?? [])];
  if (sortKey === "price") quotes.sort((a, b) => scoreQuote(a) - scoreQuote(b));
  else if (sortKey === "vendor") quotes.sort((a, b) => a.vendorName.localeCompare(b.vendorName));
  else if (sortKey === "distance") {
    quotes.sort((a, b) => {
      const da = parseFloat(a.distance ?? "99999");
      const db = parseFloat(b.distance ?? "99999");
      return da - db;
    });
  }

  const minPrice = quotes.length ? Math.min(...quotes.map((q) => q.totalPrice ?? q.pricePerRoom)) : 0;
  const alreadySelected = quotes.some((q) => q.isSelected);
  const canSelect = !["invoice_generated", "customer_notified"].includes(request.status);

  const ci = new Date(request.checkIn).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
  const co = new Date(request.checkOut).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
  const nights = Math.round((new Date(request.checkOut).getTime() - new Date(request.checkIn).getTime()) / 86_400_000);

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/hotel-requests/${reqId}`}>
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
          </Link>
          <div>
            <h2 className="text-xl font-bold">Quote Comparison</h2>
            <p className="text-sm text-muted-foreground">
              {request.referenceNumber ?? `REQ-${reqId}`} · {request.hotelName} · {ci} → {co} ({nights}N) · {request.rooms} rooms
            </p>
          </div>
        </div>
        <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="price">Sort: Price ↑</SelectItem>
            <SelectItem value="vendor">Sort: Vendor A→Z</SelectItem>
            <SelectItem value="distance">Sort: Distance ↑</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {quotes.length === 0 && (
        <Card><CardContent className="py-10 text-center text-muted-foreground">No quotes yet for this request.</CardContent></Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {quotes.map((q) => {
          const quoteTotal = q.totalPrice ?? q.pricePerRoom * request.rooms;
          const isBest = quoteTotal === minPrice && quotes.length > 1;
          const isSelected = q.isSelected;

          return (
            <Card
              key={q.id}
              className={`relative flex flex-col border-2 transition-all ${
                isSelected ? "border-green-400 shadow-md bg-green-50/40" :
                isBest ? "border-amber-400 shadow-md" : "border-border"
              }`}
            >
              {isBest && !isSelected && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-amber-500 text-white px-3 py-0.5 text-xs flex items-center gap-1">
                    <Trophy className="h-3 w-3" /> Best Price
                  </Badge>
                </div>
              )}
              {isSelected && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-green-500 text-white px-3 py-0.5 text-xs flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" /> Selected
                  </Badge>
                </div>
              )}

              <CardHeader className="pb-2 pt-6">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{q.vendorName}</CardTitle>
                  <Badge variant="outline" className="text-xs">{q.currency}</Badge>
                </div>
              </CardHeader>

              <CardContent className="flex-1 space-y-3">
                {/* Price block */}
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <div className={`text-2xl font-bold ${isBest && !isSelected ? "text-amber-600" : isSelected ? "text-green-600" : ""}`}>
                    {q.currency} {q.pricePerRoom.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                    <span className="text-sm font-normal text-muted-foreground">/room</span>
                  </div>
                  {q.totalPrice != null && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Total: <strong>{q.currency} {q.totalPrice.toLocaleString("en-PK", { minimumFractionDigits: 2 })}</strong>
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    ×{request.rooms} rooms = {q.currency} {(quoteTotal).toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                  </div>
                </div>

                {/* Details */}
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-border">
                    <CompRow label="Meal Plan" value={q.mealPlan ?? request.mealPlan} />
                    <CompRow label="Room Type" value={q.roomType ?? request.roomType} />
                    <CompRow label="Distance" value={q.distance} />
                    <CompRow label="Availability" value={q.availability} />
                    <CompRow label="Cancellation" value={q.cancellationPolicy} />
                  </tbody>
                </table>

                {q.notes && (
                  <p className="text-xs text-muted-foreground italic border-t pt-2">{q.notes}</p>
                )}

                <div className="text-xs text-muted-foreground">
                  Received: {new Date(q.respondedAt).toLocaleDateString("en-PK")}
                </div>

                {/* Action */}
                {canSelect && !isSelected && (
                  <Button
                    className={`w-full ${isBest ? "bg-amber-500 hover:bg-amber-600 text-white" : ""}`}
                    variant={isBest ? "default" : "outline"}
                    size="sm"
                    onClick={() => selectVendor.mutate(q.id)}
                    disabled={selectVendor.isPending}
                  >
                    {selectVendor.isPending ? "Selecting…" : "Select This Vendor"}
                  </Button>
                )}
                {isSelected && (
                  <div className="flex items-center justify-center gap-1.5 text-green-600 text-sm font-medium py-1">
                    <CheckCircle className="h-4 w-4" /> Vendor Confirmed
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Summary table */}
      {quotes.length > 1 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Summary Comparison</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Vendor</th>
                  <th className="text-right px-4 py-2 font-medium">Price/Room</th>
                  <th className="text-right px-4 py-2 font-medium">Total ({request.rooms} rooms)</th>
                  <th className="text-left px-4 py-2 font-medium">Meal Plan</th>
                  <th className="text-left px-4 py-2 font-medium">Distance</th>
                  <th className="text-left px-4 py-2 font-medium">Availability</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {quotes.map((q) => {
                  const quoteTotal = q.totalPrice ?? q.pricePerRoom * request.rooms;
                  const isBest = quoteTotal === minPrice && quotes.length > 1;
                  return (
                    <tr key={q.id} className={`${q.isSelected ? "bg-green-50" : isBest ? "bg-amber-50/50" : ""}`}>
                      <td className="px-4 py-2 font-medium">
                        {q.vendorName}
                        {q.isSelected && <Badge className="ml-2 bg-green-100 text-green-700 text-xs">Selected</Badge>}
                        {isBest && !q.isSelected && <Badge className="ml-2 bg-amber-100 text-amber-700 text-xs">Best</Badge>}
                      </td>
                      <td className="px-4 py-2 text-right">{q.currency} {q.pricePerRoom.toFixed(2)}</td>
                      <td className={`px-4 py-2 text-right font-semibold ${isBest ? "text-amber-600" : ""}`}>{q.currency} {quoteTotal.toFixed(2)}</td>
                      <td className="px-4 py-2">{q.mealPlan ?? "—"}</td>
                      <td className="px-4 py-2">{q.distance ?? "—"}</td>
                      <td className="px-4 py-2">{q.availability ?? "—"}</td>
                      <td className="px-4 py-2">
                        {!q.isSelected && canSelect && (
                          <Button size="sm" variant="ghost" onClick={() => selectVendor.mutate(q.id)} disabled={selectVendor.isPending} className="h-6 text-xs px-2">Select</Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CompRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <tr>
      <td className="py-1 pr-2 text-muted-foreground w-24">{label}</td>
      <td className="py-1 font-medium">{value ?? "—"}</td>
    </tr>
  );
}
