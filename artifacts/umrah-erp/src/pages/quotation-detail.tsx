import { useParams, Link } from "wouter";
import { useGetQuotation, useUpdateQuotation, useAddQuotationItem, useDeleteQuotationItem, useSendQuotation, QuotationItemInputServiceType } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2, Send } from "lucide-react";

const SERVICE_TYPES = Object.values(QuotationItemInputServiceType) as QuotationItemInputServiceType[];

export default function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [itemForm, setItemForm] = useState<{ serviceType: QuotationItemInputServiceType; description: string; quantity: number; unitPrice: number; notes: string }>({ serviceType: QuotationItemInputServiceType.hotel, description: "", quantity: 1, unitPrice: 0, notes: "" });

  const { data: quotation, isLoading } = useGetQuotation(Number(id));
  const addItem = useAddQuotationItem({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/quotations", Number(id)] }); setItemForm({ serviceType: QuotationItemInputServiceType.hotel, description: "", quantity: 1, unitPrice: 0, notes: "" }); toast({ title: "Item added" }); } } });
  const deleteItem = useDeleteQuotationItem({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/quotations", Number(id)] }); toast({ title: "Item removed" }); } } });
  const sendQuotation = useSendQuotation({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/quotations", Number(id)] }); toast({ title: "Quotation sent" }); } } });
  const updateQuotation = useUpdateQuotation({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/quotations", Number(id)] }); toast({ title: "Status updated" }); } } });

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;
  if (!quotation) return <div className="p-6">Quotation not found.</div>;

  const q = quotation as any;
  const items = q.items || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/quotations"><Button variant="ghost" size="sm"><ArrowLeft className="mr-2 h-4 w-4" />Back</Button></Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold">{q.referenceNo}</h2>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${q.status === "accepted" ? "bg-green-100 text-green-700" : q.status === "sent" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"}`}>{q.status}</span>
          </div>
          <p className="text-muted-foreground">{q.clientName} · {q.title || "Untitled"}</p>
        </div>
        <div className="flex gap-2">
          {q.status === "draft" && (
            <Button onClick={() => sendQuotation.mutate({ id: Number(id) })} disabled={sendQuotation.isPending}>
              <Send className="mr-2 h-4 w-4" />Send to Client
            </Button>
          )}
          {q.status === "sent" && (
            <>
              <Button variant="outline" onClick={() => updateQuotation.mutate({ id: Number(id), data: { status: "accepted" } })}>Mark Accepted</Button>
              <Button variant="outline" onClick={() => updateQuotation.mutate({ id: Number(id), data: { status: "rejected" } })}>Mark Rejected</Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Client</div><div className="font-semibold">{q.clientName}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Total Amount</div><div className="text-2xl font-bold text-green-600">{q.currency} {(q.totalAmount || 0).toLocaleString()}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Valid Until</div><div className="font-semibold">{new Date(q.validUntil).toLocaleDateString()}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Created</div><div className="font-semibold">{new Date(q.createdAt).toLocaleDateString()}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Line Items</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Unit Price</TableHead>
                <TableHead>Total</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center h-24 text-muted-foreground">No items added yet</TableCell></TableRow>
              )}
              {items.map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell><Badge variant="outline">{item.serviceType}</Badge></TableCell>
                  <TableCell>{item.description}</TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>{q.currency} {item.unitPrice.toLocaleString()}</TableCell>
                  <TableCell className="font-semibold">{q.currency} {item.totalPrice.toLocaleString()}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => deleteItem.mutate({ id: Number(id), itemId: item.id })}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {items.length > 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-right font-bold">Grand Total</TableCell>
                  <TableCell className="font-bold text-green-600">{q.currency} {(q.totalAmount || 0).toLocaleString()}</TableCell>
                  <TableCell />
                </TableRow>
              )}
            </TableBody>
          </Table>

          {q.status === "draft" && (
            <div className="mt-6 p-4 border rounded-lg bg-muted/30">
              <h4 className="font-medium mb-3">Add Line Item</h4>
              <div className="grid grid-cols-5 gap-3">
                <Select value={itemForm.serviceType} onValueChange={v => setItemForm(p => ({ ...p, serviceType: v as QuotationItemInputServiceType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SERVICE_TYPES.map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</SelectItem>)}</SelectContent>
                </Select>
                <Input placeholder="Description" value={itemForm.description} onChange={e => setItemForm(p => ({ ...p, description: e.target.value }))} className="col-span-2" />
                <Input type="number" placeholder="Qty" value={itemForm.quantity} onChange={e => setItemForm(p => ({ ...p, quantity: Number(e.target.value) }))} />
                <Input type="number" placeholder="Unit Price" value={itemForm.unitPrice} onChange={e => setItemForm(p => ({ ...p, unitPrice: Number(e.target.value) }))} />
              </div>
              <Button className="mt-3" onClick={() => addItem.mutate({ id: Number(id), data: itemForm })} disabled={!itemForm.description || !itemForm.unitPrice || addItem.isPending}>
                <Plus className="mr-2 h-4 w-4" />Add Item
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {q.termsAndConditions && (
        <Card><CardHeader><CardTitle className="text-sm">Terms & Conditions</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">{q.termsAndConditions}</p></CardContent></Card>
      )}
    </div>
  );
}
