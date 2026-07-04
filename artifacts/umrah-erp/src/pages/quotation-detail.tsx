import { useParams, Link } from "wouter";
import { useGetQuotation, useUpdateQuotation, useAddQuotationItem, useDeleteQuotationItem, useSendQuotation, QuotationItemInputServiceType } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2, Send, Edit2, Printer, CheckCircle, XCircle } from "lucide-react";

const SERVICE_TYPES = Object.values(QuotationItemInputServiceType) as QuotationItemInputServiceType[];
const CURRENCIES = ["PKR", "SAR", "USD", "GBP", "EUR", "AED"];

export default function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [itemForm, setItemForm] = useState<{ serviceType: QuotationItemInputServiceType; description: string; quantity: number; unitPrice: number; notes: string }>({ serviceType: QuotationItemInputServiceType.hotel, description: "", quantity: 1, unitPrice: 0, notes: "" });

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ title: "", validUntil: "", currency: "PKR", discount: "", notes: "", termsAndConditions: "" });

  const { data: quotation, isLoading } = useGetQuotation(Number(id));
  const addItem = useAddQuotationItem({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/quotations", Number(id)] }); setItemForm({ serviceType: QuotationItemInputServiceType.hotel, description: "", quantity: 1, unitPrice: 0, notes: "" }); toast({ title: "Item added" }); } } });
  const deleteItem = useDeleteQuotationItem({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/quotations", Number(id)] }); toast({ title: "Item removed" }); } } });
  const sendQuotation = useSendQuotation({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/quotations", Number(id)] }); toast({ title: "Quotation sent to client" }); } } });
  const updateQuotation = useUpdateQuotation({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/quotations", Number(id)] }); toast({ title: "Quotation updated" }); setEditOpen(false); } } });

  const q = quotation as any;

  useEffect(() => {
    if (q) {
      setEditForm({
        title: q.title || "",
        validUntil: q.validUntil ? q.validUntil.split("T")[0] : "",
        currency: q.currency || "PKR",
        discount: q.discount != null ? String(q.discount) : "",
        notes: q.notes || "",
        termsAndConditions: q.termsAndConditions || "",
      });
    }
  }, [quotation]);

  function handleSaveEdit() {
    updateQuotation.mutate({
      id: Number(id),
      data: {
        title: editForm.title,
        validUntil: editForm.validUntil,
        currency: editForm.currency,
        ...(editForm.discount !== "" ? { discount: Number(editForm.discount) } : {}),
        notes: editForm.notes,
        termsAndConditions: editForm.termsAndConditions,
      } as any,
    });
  }

  function handlePrint() {
    window.print();
  }

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;
  if (!quotation) return <div className="p-6">Quotation not found.</div>;

  const items = q.items || [];
  const statusColor = q.status === "accepted" ? "bg-green-100 text-green-700" : q.status === "sent" ? "bg-blue-100 text-blue-700" : q.status === "rejected" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700";

  return (
    <>
      {/* Print-only styles */}
      <style>{`
        @media print {
          nav, aside, header, .print\\:hidden, button { display: none !important; }
          .print-show { display: block !important; }
          body { font-family: Arial, sans-serif; }
        }
        @media screen { .print-show { display: none; } }
      `}</style>

      {/* Print-only header */}
      <div className="print-show mb-6 border-b-2 border-gray-800 pb-4">
        <div className="text-xl font-bold">Al Musafir International</div>
        <div className="text-sm text-gray-600">Umrah Travel Agency</div>
        <div className="mt-3 text-lg font-semibold">QUOTATION — {q.referenceNo}</div>
        <div className="text-sm text-gray-600">Client: {q.clientName} | Date: {new Date(q.createdAt).toLocaleDateString()} | Valid Until: {q.validUntil ? new Date(q.validUntil).toLocaleDateString() : "—"}</div>
      </div>

      <div className="space-y-6">
        {/* Header toolbar */}
        <div className="flex items-center gap-4 print:hidden">
          <Link href="/quotations"><Button variant="ghost" size="sm"><ArrowLeft className="mr-2 h-4 w-4" />Back</Button></Link>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold">{q.referenceNo}</h2>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>{q.status}</span>
            </div>
            <p className="text-muted-foreground">{q.clientName} · {q.title || "Untitled"}</p>
          </div>
          <div className="flex gap-2 items-center">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Edit2 className="mr-2 h-4 w-4" />Edit
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />Print
            </Button>
            {q.status === "draft" && (
              <Button
                size="default"
                className="bg-green-600 hover:bg-green-700 text-white font-semibold px-5"
                onClick={() => sendQuotation.mutate({ id: Number(id) })}
                disabled={sendQuotation.isPending}
              >
                <Send className="mr-2 h-4 w-4" />
                Send Quotation
              </Button>
            )}
            {q.status === "sent" && (
              <>
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => updateQuotation.mutate({ id: Number(id), data: { status: "accepted" } as any })}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-red-300 text-red-600 hover:bg-red-50"
                  onClick={() => updateQuotation.mutate({ id: Number(id), data: { status: "rejected" } as any })}
                >
                  <XCircle className="mr-2 h-4 w-4" />Reject
                </Button>
              </>
            )}
            {q.status === "draft" && (
              <Button
                size="sm"
                variant="outline"
                className="border-green-300 text-green-700 hover:bg-green-50"
                onClick={() => updateQuotation.mutate({ id: Number(id), data: { status: "accepted" } as any })}
              >
                <CheckCircle className="mr-2 h-4 w-4" />Approve Directly
              </Button>
            )}
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-4">
          <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Client</div><div className="font-semibold">{q.clientName}</div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Total Amount</div><div className="text-2xl font-bold text-green-600">{q.currency} {(q.totalAmount || 0).toLocaleString()}</div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Valid Until</div><div className="font-semibold">{q.validUntil ? new Date(q.validUntil).toLocaleDateString() : "—"}</div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Created</div><div className="font-semibold">{new Date(q.createdAt).toLocaleDateString()}</div></CardContent></Card>
        </div>

        {/* Line items */}
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
                  <TableHead className="print:hidden"></TableHead>
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
                    <TableCell>{q.currency} {Number(item.unitPrice).toLocaleString()}</TableCell>
                    <TableCell className="font-semibold">{q.currency} {Number(item.totalPrice).toLocaleString()}</TableCell>
                    <TableCell className="print:hidden">
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
                    <TableCell className="print:hidden" />
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {q.status === "draft" && (
              <div className="mt-6 p-4 border rounded-lg bg-muted/30 print:hidden">
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
          <Card>
            <CardHeader><CardTitle className="text-sm">Terms & Conditions</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-muted-foreground whitespace-pre-line">{q.termsAndConditions}</p></CardContent>
          </Card>
        )}
        {q.notes && (
          <Card className="print:hidden">
            <CardHeader><CardTitle className="text-sm">Notes</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-muted-foreground">{q.notes}</p></CardContent>
          </Card>
        )}
      </div>

      {/* Edit modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Quotation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Title</Label>
              <Input value={editForm.title} onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Umrah Package July 2026" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Currency</Label>
                <Select value={editForm.currency} onValueChange={v => setEditForm(p => ({ ...p, currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Valid Until</Label>
                <Input type="date" value={editForm.validUntil} onChange={e => setEditForm(p => ({ ...p, validUntil: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Discount %</Label>
              <Input type="number" min="0" max="100" step="0.1" value={editForm.discount} onChange={e => setEditForm(p => ({ ...p, discount: e.target.value }))} placeholder="0" />
            </div>
            <div className="space-y-1">
              <Label>Terms & Conditions</Label>
              <textarea
                className="w-full px-3 py-2 text-sm border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                rows={3}
                value={editForm.termsAndConditions}
                onChange={e => setEditForm(p => ({ ...p, termsAndConditions: e.target.value }))}
                placeholder="Payment terms, inclusions, exclusions…"
              />
            </div>
            <div className="space-y-1">
              <Label>Internal Notes</Label>
              <textarea
                className="w-full px-3 py-2 text-sm border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                rows={2}
                value={editForm.notes}
                onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="Internal notes (not shown to client)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={updateQuotation.isPending}>
              {updateQuotation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
