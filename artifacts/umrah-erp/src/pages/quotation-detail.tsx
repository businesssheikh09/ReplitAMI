import { useParams, Link } from "wouter";
import { useGetQuotation, useUpdateQuotation, useAddQuotationItem, useDeleteQuotationItem, useSendQuotation, useUpdateQuotationItem, QuotationItemInputServiceType } from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2, Send, Edit2, Printer, CheckCircle, XCircle, ArrowRightLeft } from "lucide-react";

const SERVICE_TYPES = Object.values(QuotationItemInputServiceType) as QuotationItemInputServiceType[];
const CURRENCIES = ["USD", "PKR", "SAR", "GBP", "EUR", "AED", "OMR", "KWD", "QAR"];
const EMPTY_RATES: Record<string, number> = {};

const SERVICE_COLORS: Record<string, string> = {
  hotel: "bg-blue-50 text-blue-700 border-blue-200",
  flight: "bg-purple-50 text-purple-700 border-purple-200",
  transport: "bg-orange-50 text-orange-700 border-orange-200",
  visa: "bg-green-50 text-green-700 border-green-200",
  other: "bg-gray-50 text-gray-700 border-gray-200",
};

function fmt(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function useCurrencyRates() {
  return useQuery<Record<string, number>>({
    queryKey: ["currency-rates"],
    queryFn: () =>
      fetch("/api/currency/rates").then((r) => r.json()).then((d) => d.rates || {}),
    staleTime: 5 * 60 * 1000,
  });
}

function convertToBase(amount: number, fromCurrency: string, baseCurrency: string, rates: Record<string, number>): number | null {
  if (fromCurrency === baseCurrency) return amount;
  const fromRate = rates[fromCurrency];
  const toRate = rates[baseCurrency];
  if (!fromRate || !toRate) return null;
  return (amount / fromRate) * toRate;
}

function CurrencyConverter({ itemCurrency, baseCurrency, unitPrice, quantity, rates }: {
  itemCurrency: string; baseCurrency: string; unitPrice: number; quantity: number; rates: Record<string, number>;
}) {
  if (itemCurrency === baseCurrency) return null;
  const converted = convertToBase(unitPrice * quantity, itemCurrency, baseCurrency, rates);
  if (converted == null) return (
    <p className="text-xs text-amber-600 mt-1">No rate found for {itemCurrency} → {baseCurrency}</p>
  );
  return (
    <div className="flex items-center gap-1.5 mt-1.5 text-xs text-teal-700 bg-teal-50 rounded-md px-2 py-1">
      <ArrowRightLeft className="h-3 w-3" />
      <span>{fmt(unitPrice * quantity, itemCurrency)} = <strong>{fmt(converted, baseCurrency)}</strong></span>
    </div>
  );
}

export default function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [itemForm, setItemForm] = useState<{
    serviceType: QuotationItemInputServiceType;
    description: string;
    quantity: number;
    unitPrice: number;
    currency: string;
    customRate: string;
    notes: string;
  }>({
    serviceType: QuotationItemInputServiceType.hotel,
    description: "",
    quantity: 1,
    unitPrice: 0,
    currency: "USD",
    customRate: "",
    notes: "",
  });

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ title: "", validUntil: "", currency: "USD", discount: "", notes: "", termsAndConditions: "" });

  const [editItemOpen, setEditItemOpen] = useState(false);
  const [editItemForm, setEditItemForm] = useState<{
    id: number;
    serviceType: QuotationItemInputServiceType;
    description: string;
    quantity: number;
    unitPrice: number;
    currency: string;
    customRate: string;
    notes: string;
  }>({ id: 0, serviceType: QuotationItemInputServiceType.hotel, description: "", quantity: 1, unitPrice: 0, currency: "USD", customRate: "", notes: "" });

  const { data: quotation, isLoading } = useGetQuotation(Number(id));
  const { data: rates = EMPTY_RATES } = useCurrencyRates();

  const addItem = useAddQuotationItem({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["/api/quotations", Number(id)] });
        setItemForm(p => ({ ...p, description: "", quantity: 1, unitPrice: 0 }));
        toast({ title: "Item added" });
      },
    },
  });
  const deleteItem = useDeleteQuotationItem({
    mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/quotations", Number(id)] }); toast({ title: "Item removed" }); } },
  });
  const sendQuotation = useSendQuotation({
    mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/quotations", Number(id)] }); toast({ title: "Quotation sent to client" }); } },
  });
  const updateQuotation = useUpdateQuotation({
    mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/quotations", Number(id)] }); toast({ title: "Quotation updated" }); setEditOpen(false); } },
  });
  const updateItem = useUpdateQuotationItem({
    mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/quotations", Number(id)] }); toast({ title: "Item updated" }); setEditItemOpen(false); } },
  });

  const q = quotation as any;

  useEffect(() => {
    if (q) {
      setEditForm({
        title: q.title || "",
        validUntil: q.validUntil ? q.validUntil.split("T")[0] : "",
        currency: q.currency || "USD",
        discount: q.discount != null ? String(q.discount) : "",
        notes: q.notes || "",
        termsAndConditions: q.termsAndConditions || "",
      });
      setItemForm(p => ({ ...p, currency: q.currency || "USD" }));
    }
  }, [quotation]);

  // When item currency or base currency changes, auto-populate customRate
  // Rate is expressed as: how many [itemCurrency] per 1 [baseCurrency]
  useEffect(() => {
    if (!q) return;
    const base = q.currency || "USD";
    if (itemForm.currency === base) {
      setItemForm(p => p.customRate === "" ? p : { ...p, customRate: "" });
      return;
    }
    const autoRate = convertToBase(1, base, itemForm.currency, rates);
    if (autoRate != null) {
      const next = autoRate.toFixed(4);
      setItemForm(p => p.customRate === next ? p : { ...p, customRate: next });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemForm.currency, q?.currency]);

  const customRateNum = parseFloat(itemForm.customRate);
  const rateValid = !isNaN(customRateNum) && customRateNum > 0;

  const itemConvertedPrice = useMemo(() => {
    if (!q || itemForm.currency === q.currency) return null;
    if (!rateValid) return null;
    // unitPriceBase = unitPrice / customRate  (itemCurrency / (itemCurrency per baseCurrency))
    return (itemForm.unitPrice * itemForm.quantity) / customRateNum;
  }, [itemForm.currency, itemForm.unitPrice, itemForm.quantity, customRateNum, rateValid, q]);

  function handleAddItem() {
    const isDifferent = itemForm.currency !== q?.currency;
    const unitPriceBase = isDifferent && rateValid
      ? itemForm.unitPrice / customRateNum
      : undefined;
    addItem.mutate({
      id: Number(id),
      data: {
        serviceType: itemForm.serviceType,
        description: itemForm.description,
        quantity: itemForm.quantity,
        unitPrice: itemForm.unitPrice,
        currency: itemForm.currency,
        notes: itemForm.notes,
        unitPriceBase,
      } as any,
    });
  }

  // Auto-populate customRate when editItemForm currency changes
  useEffect(() => {
    if (!q || !editItemOpen) return;
    const base = q.currency || "USD";
    if (editItemForm.currency === base) {
      setEditItemForm(p => p.customRate === "" ? p : { ...p, customRate: "" });
      return;
    }
    const autoRate = convertToBase(1, base, editItemForm.currency, rates);
    if (autoRate != null) {
      const next = autoRate.toFixed(4);
      setEditItemForm(p => p.customRate === next ? p : { ...p, customRate: next });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editItemForm.currency, editItemOpen, q?.currency]);

  function openEditItem(item: any) {
    const base = q?.currency || "USD";
    const itemCurr = item.currency || base;
    let customRate = "";
    if (itemCurr !== base) {
      const autoRate = convertToBase(1, base, itemCurr, rates);
      if (autoRate != null) customRate = autoRate.toFixed(4);
    }
    setEditItemForm({
      id: item.id,
      serviceType: item.serviceType as QuotationItemInputServiceType,
      description: item.description || "",
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      currency: itemCurr,
      customRate,
      notes: item.notes || "",
    });
    setEditItemOpen(true);
  }

  function handleSaveEditItem() {
    const base = q?.currency || "USD";
    const isDifferent = editItemForm.currency !== base;
    const editRateNum = parseFloat(editItemForm.customRate);
    const editRateValid = !isNaN(editRateNum) && editRateNum > 0;
    const unitPriceBase = isDifferent && editRateValid ? editItemForm.unitPrice / editRateNum : undefined;
    updateItem.mutate({
      id: Number(id),
      itemId: editItemForm.id,
      data: {
        serviceType: editItemForm.serviceType,
        description: editItemForm.description,
        quantity: editItemForm.quantity,
        unitPrice: editItemForm.unitPrice,
        currency: editItemForm.currency,
        notes: editItemForm.notes,
        unitPriceBase,
      } as any,
    });
  }

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

  function handlePrint() { window.print(); }

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;
  if (!quotation) return <div className="p-6">Quotation not found.</div>;

  const items = q.items || [];
  const baseCurrency = q.currency || "USD";
  const statusColor = q.status === "accepted"
    ? "bg-green-100 text-green-700" : q.status === "sent"
    ? "bg-blue-100 text-blue-700" : q.status === "rejected"
    ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700";

  const hasMixedCurrencies = items.some((i: any) => i.currency && i.currency !== baseCurrency);

  // Per-currency subtotals (sum of totalPrice grouped by currency)
  const currencySubtotals: Record<string, number> = {};
  for (const item of items) {
    const c = item.currency || baseCurrency;
    currencySubtotals[c] = (currencySubtotals[c] || 0) + Number(item.totalPrice || 0);
  }
  const foreignSubtotals = Object.entries(currencySubtotals).filter(([c]) => c !== baseCurrency);

  return (
    <>
      {/* ── Print Styles ─────────────────────────────────────────────────────── */}
      <style>{`
        @media print {
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          body { font-family: 'Arial', sans-serif; margin: 0; padding: 0; background: white; }
          .print-hide { display: none !important; }
          .print-only { display: block !important; }
          .print-page {
            display: block !important;
            position: fixed;
            inset: 0;
            background: white;
            z-index: 9999;
            padding: 32px 40px;
            box-sizing: border-box;
          }
        }
        @media screen {
          .print-only { display: none; }
          .print-page { display: none; }
        }
      `}</style>

      {/* ── Print Layout (shown only when printing) ───────────────────────── */}
      <div className="print-page">
        {/* Company Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "3px solid #0f766e", paddingBottom: "16px", marginBottom: "20px" }}>
          <div>
            <div style={{ fontSize: "22px", fontWeight: "800", color: "#0f766e", letterSpacing: "-0.5px" }}>Al Musafir International</div>
            <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>Umrah Travel Agency · Licensed & Certified</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "18px", fontWeight: "700", color: "#111827" }}>QUOTATION</div>
            <div style={{ fontSize: "13px", fontWeight: "600", color: "#0f766e" }}>{q.referenceNo}</div>
            <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px" }}>
              Date: {new Date(q.createdAt).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })}
            </div>
          </div>
        </div>

        {/* Client & Summary Info */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "12px", marginBottom: "20px" }}>
          {[
            { label: "Client", value: q.clientName },
            { label: "Package", value: q.title || "—" },
            { label: "Valid Until", value: q.validUntil ? new Date(q.validUntil).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" }) : "—" },
            { label: "Total Amount", value: fmt(q.totalAmount || 0, baseCurrency), highlight: true },
          ].map(({ label, value, highlight }) => (
            <div key={label} style={{ background: highlight ? "#f0fdf4" : "#f9fafb", border: `1px solid ${highlight ? "#bbf7d0" : "#e5e7eb"}`, borderRadius: "8px", padding: "10px 12px" }}>
              <div style={{ fontSize: "10px", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "3px" }}>{label}</div>
              <div style={{ fontSize: highlight ? "15px" : "13px", fontWeight: highlight ? "800" : "600", color: highlight ? "#15803d" : "#111827" }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Line Items Table */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "20px", fontSize: "12px" }}>
          <thead>
            <tr style={{ background: "#0f766e" }}>
              {["Service", "Description", "Qty", "Unit Price", hasMixedCurrencies ? "Currency" : "", "Total", hasMixedCurrencies ? `In ${baseCurrency}` : ""].filter(Boolean).map((h) => (
                <th key={h} style={{ padding: "8px 10px", color: "white", fontWeight: "600", textAlign: h === "Description" ? "left" : "center", fontSize: "11px" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item: any, idx: number) => (
              <tr key={item.id} style={{ background: idx % 2 === 0 ? "white" : "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                <td style={{ padding: "8px 10px", textAlign: "center" }}>
                  <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: "999px", fontSize: "10px", fontWeight: "600", background: "#e0f2fe", color: "#0369a1", border: "1px solid #bae6fd" }}>
                    {item.serviceType}
                  </span>
                </td>
                <td style={{ padding: "8px 10px", color: "#111827" }}>{item.description}</td>
                <td style={{ padding: "8px 10px", textAlign: "center", color: "#374151" }}>{item.quantity}</td>
                <td style={{ padding: "8px 10px", textAlign: "center", color: "#374151" }}>{fmt(Number(item.unitPrice), item.currency || baseCurrency)}</td>
                {hasMixedCurrencies && (
                  <td style={{ padding: "8px 10px", textAlign: "center", fontSize: "10px", color: "#6b7280" }}>{item.currency || baseCurrency}</td>
                )}
                <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: "600", color: "#111827" }}>{fmt(Number(item.totalPrice), item.currency || baseCurrency)}</td>
                {hasMixedCurrencies && (
                  <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: "600", color: "#0f766e" }}>
                    {item.totalPriceBase != null ? fmt(Number(item.totalPriceBase), baseCurrency) : fmt(Number(item.totalPrice), baseCurrency)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: "#f0fdf4", borderTop: "2px solid #0f766e" }}>
              <td colSpan={hasMixedCurrencies ? 5 : 3} style={{ padding: "10px", textAlign: "right", fontWeight: "700", fontSize: "13px", color: "#111827" }}>Grand Total</td>
              <td colSpan={hasMixedCurrencies ? 2 : 2} style={{ padding: "10px", textAlign: "center", fontWeight: "800", fontSize: "14px", color: "#15803d" }}>
                {fmt(q.totalAmount || 0, baseCurrency)}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Terms & Conditions */}
        {q.termsAndConditions && (
          <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "12px", marginBottom: "16px" }}>
            <div style={{ fontSize: "11px", fontWeight: "700", color: "#374151", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Terms & Conditions</div>
            <div style={{ fontSize: "11px", color: "#6b7280", lineHeight: "1.6", whiteSpace: "pre-line" }}>{q.termsAndConditions}</div>
          </div>
        )}

        {/* Footer */}
        <div style={{ borderTop: "2px solid #0f766e", paddingTop: "10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: "10px", color: "#9ca3af" }}>Al Musafir International · Umrah Travel Agency</div>
          <div style={{ fontSize: "10px", color: "#9ca3af" }}>This quotation is valid until {q.validUntil ? new Date(q.validUntil).toLocaleDateString("en-PK") : "—"}</div>
        </div>
      </div>

      {/* ── Screen Layout ─────────────────────────────────────────────────────── */}
      <div className="space-y-6 print-hide">
        {/* Header toolbar */}
        <div className="flex items-center gap-4">
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
                <Send className="mr-2 h-4 w-4" />Send Quotation
              </Button>
            )}
            {q.status === "sent" && (
              <>
                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => updateQuotation.mutate({ id: Number(id), data: { status: "accepted" } as any })}>
                  <CheckCircle className="mr-2 h-4 w-4" />Accept
                </Button>
                <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50"
                  onClick={() => updateQuotation.mutate({ id: Number(id), data: { status: "rejected" } as any })}>
                  <XCircle className="mr-2 h-4 w-4" />Reject
                </Button>
              </>
            )}
            {q.status === "draft" && (
              <Button size="sm" variant="outline" className="border-green-300 text-green-700 hover:bg-green-50"
                onClick={() => updateQuotation.mutate({ id: Number(id), data: { status: "accepted" } as any })}>
                <CheckCircle className="mr-2 h-4 w-4" />Approve Directly
              </Button>
            )}
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-4">
          <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Client</div><div className="font-semibold">{q.clientName}</div></CardContent></Card>
          <Card><CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Total Amount</div>
            <div className="text-2xl font-bold text-green-600">{fmt(q.totalAmount || 0, baseCurrency)}</div>
            {hasMixedCurrencies && foreignSubtotals.length > 0 && (
              <div className="mt-1.5 space-y-0.5">
                <div className="text-xs text-muted-foreground">Includes:</div>
                {foreignSubtotals.map(([c, total]) => (
                  <div key={c} className="text-xs text-amber-700 font-medium">
                    {fmt(total, c)}
                  </div>
                ))}
                {currencySubtotals[baseCurrency] > 0 && (
                  <div className="text-xs text-muted-foreground">{fmt(currencySubtotals[baseCurrency], baseCurrency)}</div>
                )}
              </div>
            )}
          </CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Valid Until</div><div className="font-semibold">{q.validUntil ? new Date(q.validUntil).toLocaleDateString() : "—"}</div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Created</div><div className="font-semibold">{new Date(q.createdAt).toLocaleDateString()}</div></CardContent></Card>
        </div>

        {/* Line items */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Line Items</CardTitle>
              {hasMixedCurrencies && (
                <span className="text-xs text-teal-700 bg-teal-50 border border-teal-200 rounded-full px-2.5 py-1 flex items-center gap-1">
                  <ArrowRightLeft className="h-3 w-3" /> Multi-currency — totals converted to {baseCurrency}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-center">Qty</TableHead>
                  <TableHead className="text-center">Unit Price</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  {hasMixedCurrencies && <TableHead className="text-center text-teal-700">In {baseCurrency}</TableHead>}
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center h-24 text-muted-foreground">No items added yet</TableCell></TableRow>
                )}
                {items.map((item: any) => {
                  const itemCurr = item.currency || baseCurrency;
                  const isDifferent = itemCurr !== baseCurrency;
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${SERVICE_COLORS[item.serviceType] || SERVICE_COLORS.other}`}>
                          {item.serviceType}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-xs">{item.description}</TableCell>
                      <TableCell className="text-center">{item.quantity}</TableCell>
                      <TableCell className="text-center text-muted-foreground">
                        {fmt(Number(item.unitPrice), itemCurr)}
                        {isDifferent && <div className="text-xs text-muted-foreground/60">{itemCurr}</div>}
                      </TableCell>
                      <TableCell className="text-center font-semibold">
                        {fmt(Number(item.totalPrice), itemCurr)}
                      </TableCell>
                      {hasMixedCurrencies && (
                        <TableCell className="text-center font-semibold text-teal-700">
                          {isDifferent
                            ? (item.totalPriceBase != null ? fmt(Number(item.totalPriceBase), baseCurrency) : <span className="text-amber-500 text-xs">No rate</span>)
                            : fmt(Number(item.totalPrice), baseCurrency)}
                        </TableCell>
                      )}
                      <TableCell>
                        {q.status === "draft" && (
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => openEditItem(item)}>
                              <Edit2 className="h-4 w-4 text-blue-500" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => deleteItem.mutate({ id: Number(id), itemId: item.id })}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {items.length > 0 && (
                  <>
                    {/* Per-currency subtotals row — shown when there are foreign currencies */}
                    {hasMixedCurrencies && foreignSubtotals.length > 0 && (
                      <TableRow className="bg-amber-50/60">
                        <TableCell colSpan={hasMixedCurrencies ? 5 : 4} className="text-right text-xs text-amber-700 font-medium py-1.5">
                          Subtotals by currency
                        </TableCell>
                        <TableCell className="text-center py-1.5">
                          <div className="flex flex-col items-center gap-0.5">
                            {foreignSubtotals.map(([c, total]) => (
                              <span key={c} className="text-xs font-semibold text-amber-700">{fmt(total, c)}</span>
                            ))}
                            {currencySubtotals[baseCurrency] > 0 && (
                              <span className="text-xs text-muted-foreground">{fmt(currencySubtotals[baseCurrency], baseCurrency)}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    )}
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={hasMixedCurrencies ? 5 : 4} className="text-right font-bold">
                        Grand Total
                        {hasMixedCurrencies && <div className="text-xs font-normal text-muted-foreground">converted to {baseCurrency}</div>}
                      </TableCell>
                      <TableCell className="text-center font-bold text-green-600 text-base">{fmt(q.totalAmount || 0, baseCurrency)}</TableCell>
                      <TableCell />
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>

            {/* Add Item Form */}
            {q.status === "draft" && (
              <div className="mt-6 p-4 border rounded-xl bg-muted/20">
                <h4 className="font-semibold mb-3 text-sm">Add Line Item</h4>
                <div className="grid grid-cols-6 gap-3">
                  {/* Service Type */}
                  <Select
                    value={itemForm.serviceType}
                    onValueChange={v => setItemForm(p => ({ ...p, serviceType: v as QuotationItemInputServiceType }))}
                  >
                    <SelectTrigger className="col-span-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SERVICE_TYPES.map(t => (
                        <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Description */}
                  <Input
                    placeholder="Description"
                    value={itemForm.description}
                    onChange={e => setItemForm(p => ({ ...p, description: e.target.value }))}
                    className="col-span-2"
                  />

                  {/* Qty */}
                  <Input
                    type="number"
                    placeholder="Qty"
                    min={1}
                    value={itemForm.quantity}
                    onChange={e => setItemForm(p => ({ ...p, quantity: Number(e.target.value) }))}
                  />

                  {/* Currency + Unit Price */}
                  <div className="flex gap-1.5 col-span-2">
                    <Select
                      value={itemForm.currency}
                      onValueChange={v => setItemForm(p => ({ ...p, currency: v }))}
                    >
                      <SelectTrigger className="w-24 shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      placeholder="Unit Price"
                      value={itemForm.unitPrice || ""}
                      onChange={e => setItemForm(p => ({ ...p, unitPrice: Number(e.target.value) }))}
                      className="flex-1"
                    />
                  </div>
                </div>

                {/* Rate + Conversion row — shown when item currency differs from base */}
                {itemForm.currency !== baseCurrency && (
                  <div className="mt-3 flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                    <ArrowRightLeft className="h-4 w-4 text-amber-600 shrink-0" />
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-xs text-amber-800 font-medium whitespace-nowrap">
                        1 {baseCurrency} =
                      </span>
                      <Input
                        type="number"
                        step="0.0001"
                        min="0.0001"
                        value={itemForm.customRate}
                        onChange={e => setItemForm(p => ({ ...p, customRate: e.target.value }))}
                        className="w-32 h-8 text-sm font-mono bg-white border-amber-300 focus:ring-amber-400"
                        placeholder="rate"
                      />
                      <span className="text-xs text-amber-800 font-medium">{itemForm.currency}</span>
                      <span className="text-xs text-amber-600 ml-1">(edit to override)</span>
                    </div>
                    {itemForm.unitPrice > 0 && (
                      <div className="text-xs font-semibold ml-auto whitespace-nowrap">
                        {rateValid ? (
                          <span className="text-teal-700">
                            {fmt(itemForm.unitPrice * itemForm.quantity, itemForm.currency)}
                            {" = "}
                            <strong>{fmt((itemForm.unitPrice * itemForm.quantity) / customRateNum, baseCurrency)}</strong>
                          </span>
                        ) : (
                          <span className="text-amber-600">Enter rate to convert</span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <Button
                  className="mt-3 bg-teal-600 hover:bg-teal-700 text-white"
                  onClick={handleAddItem}
                  disabled={!itemForm.description || !itemForm.unitPrice || addItem.isPending}
                >
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
          <Card>
            <CardHeader><CardTitle className="text-sm">Internal Notes</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-muted-foreground">{q.notes}</p></CardContent>
          </Card>
        )}
      </div>

      {/* Edit modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Quotation</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Title</Label>
              <Input value={editForm.title} onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Umrah Package July 2026" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Base Currency</Label>
                <Select value={editForm.currency} onValueChange={v => setEditForm(p => ({ ...p, currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Grand total shown in this currency</p>
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

      {/* Edit Item modal */}
      <Dialog open={editItemOpen} onOpenChange={setEditItemOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Line Item</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Service Type</Label>
              <Select value={editItemForm.serviceType} onValueChange={v => setEditItemForm(p => ({ ...p, serviceType: v as QuotationItemInputServiceType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SERVICE_TYPES.map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Input value={editItemForm.description} onChange={e => setEditItemForm(p => ({ ...p, description: e.target.value }))} placeholder="Description" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Quantity</Label>
                <Input type="number" min={1} value={editItemForm.quantity} onChange={e => setEditItemForm(p => ({ ...p, quantity: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1">
                <Label>Currency</Label>
                <Select value={editItemForm.currency} onValueChange={v => setEditItemForm(p => ({ ...p, currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Unit Price ({editItemForm.currency})</Label>
              <Input type="number" min={0} step="0.01" value={editItemForm.unitPrice || ""} onChange={e => setEditItemForm(p => ({ ...p, unitPrice: Number(e.target.value) }))} placeholder="0.00" />
            </div>

            {/* Conversion rate — shown when currency differs from base */}
            {editItemForm.currency !== baseCurrency && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 space-y-2">
                <div className="flex items-center gap-2">
                  <ArrowRightLeft className="h-4 w-4 text-amber-600 shrink-0" />
                  <span className="text-xs text-amber-800 font-medium">Conversion rate</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-amber-700 whitespace-nowrap">1 {baseCurrency} =</span>
                  <Input
                    type="number"
                    step="0.0001"
                    min="0.0001"
                    value={editItemForm.customRate}
                    onChange={e => setEditItemForm(p => ({ ...p, customRate: e.target.value }))}
                    className="flex-1 h-8 text-sm font-mono bg-white border-amber-300"
                    placeholder="rate"
                  />
                  <span className="text-xs text-amber-700 whitespace-nowrap">{editItemForm.currency}</span>
                </div>
                {(() => {
                  const r = parseFloat(editItemForm.customRate);
                  const valid = !isNaN(r) && r > 0 && editItemForm.unitPrice > 0;
                  return valid ? (
                    <p className="text-xs text-teal-700 font-medium">
                      {fmt(editItemForm.unitPrice * editItemForm.quantity, editItemForm.currency)}
                      {" = "}
                      <strong>{fmt((editItemForm.unitPrice * editItemForm.quantity) / r, baseCurrency)}</strong>
                      {" (grand total impact)"}
                    </p>
                  ) : null;
                })()}
              </div>
            )}

            <div className="space-y-1">
              <Label>Notes <span className="text-muted-foreground">(optional)</span></Label>
              <Input value={editItemForm.notes} onChange={e => setEditItemForm(p => ({ ...p, notes: e.target.value }))} placeholder="Internal notes for this item" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItemOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEditItem} disabled={!editItemForm.description || !editItemForm.unitPrice || updateItem.isPending}>
              {updateItem.isPending ? "Saving…" : "Save Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
