import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useListClients, useListUsers, useListHotels, useListVendors } from "@workspace/api-client-react";
import { ArrowLeft, Printer, FileText, CheckCircle2 } from "lucide-react";
import { useBranding } from "@/components/print-layout";

const today = () => new Date().toISOString().slice(0, 10);

const VOUCHER_TYPES = ["Hotel", "Resort", "Apartment", "Serviced", "Hostel"];
const HOTEL_VIEWS   = ["City View", "Haram View", "Pool View", "Garden View", "Sea View"];
const BED_TYPES     = ["DBL", "SGL", "TPL", "QUAD", "KNG", "TWN"];
const INCOME_HEADS  = ["Hotel Income", "Commission", "Service Fee", "Other"];
const NATIONALITIES = ["Pakistani", "British", "Saudi", "UAE", "American", "Indian", "Other"];
const STATUSES      = ["draft", "confirmed", "cancelled", "invoiced"];

function calcNights(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return Math.max(0, Math.round(diff / 86400000));
}

function round2(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2).replace(/\.?0+$/, "");
}

const EMPTY_FORM = {
  invoiceDate: today(),
  partyId: "",
  vendorId: "",
  passengerName: "",
  nationality: "",
  noOfPax: "1",
  detail: "",
  voucherType: "",
  optionDate: "",
  hotelId: "",
  hotelName: "",
  hotelView: "",
  roomType: "",
  bedType: "",
  checkIn: "",
  checkOut: "",
  noOfNights: "0",
  noOfRooms: "1",
  reference: "",
  cnfNumber: "",
  roomNumber: "",
  remarks: "",
  contactNumber: "",
  receivableSar: "",
  payableSar: "",
  receivablePkr: "",
  payablePkr: "",
  incomeHead: "Hotel Income",
  salesmanId: "",
  status: "draft",
};

type FormState = typeof EMPTY_FORM;

const WRITE_ROLES = ["accounts", "management", "admin"];

const COMPANY_NAME = "Al Musafir International";

export default function HotelInvoiceFormPage() {
  const params = useParams<{ id?: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user, token } = useAuth();
  const isEdit = !!params.id;
  const canWrite = WRITE_ROLES.includes(user?.role ?? "");

  const branding = useBranding();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [dnNumber, setDnNumber] = useState<string>("");
  const [convRate, setConvRate] = useState<string>("");
  const [savedInvoice, setSavedInvoice] = useState<any>(null);

  /* track which field last changed so bidirectional calc doesn't loop */
  const lastChanged = useRef<"sar" | "pkr" | "rate" | null>(null);

  // ── Lookup data ────────────────────────────────────────────────────────────
  const { data: clients = [] }  = useListClients({});
  const { data: vendors = [] }  = useListVendors({});
  const { data: hotels  = [] }  = useListHotels({});
  const { data: users   = [] }  = useListUsers({});

  // ── Next DN number (new only) ─────────────────────────────────────────────
  const { data: nextDn } = useQuery({
    queryKey: ["/api/invoices/hotel/next-dn"],
    queryFn: () => fetch("/api/invoices/hotel/next-dn", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    enabled: !isEdit,
  });
  useEffect(() => {
    if (nextDn?.dnNumber && !isEdit) {
      setDnNumber(nextDn.dnNumber);
      const seq = nextDn.dnNumber.replace("DN-", "");
      setForm(p => ({ ...p, reference: seq }));
    }
  }, [nextDn, isEdit]);

  // ── Load existing invoice (edit mode) ────────────────────────────────────
  const { data: existing } = useQuery({
    queryKey: ["/api/invoices/hotel", params.id],
    queryFn: () => fetch(`/api/invoices/hotel/${params.id}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    enabled: isEdit,
  });
  useEffect(() => {
    if (existing && isEdit) {
      setDnNumber(existing.dnNumber);
      const rSar = existing.receivableSar != null ? String(existing.receivableSar) : "";
      const rPkr = existing.receivablePkr != null ? String(existing.receivablePkr) : "";
      /* back-calc stored rate from receivable pair */
      if (rSar && rPkr && Number(rSar) > 0) {
        setConvRate(round2(Number(rPkr) / Number(rSar)));
      }
      setForm({
        invoiceDate: existing.invoiceDate || today(),
        partyId: existing.partyId ? String(existing.partyId) : "",
        vendorId: existing.vendorId ? String(existing.vendorId) : "",
        passengerName: existing.passengerName || "",
        nationality: existing.nationality || "",
        noOfPax: String(existing.noOfPax ?? 1),
        detail: existing.detail || "",
        voucherType: existing.voucherType || "",
        optionDate: existing.optionDate || "",
        hotelId: existing.hotelId ? String(existing.hotelId) : "",
        hotelName: existing.hotelName || "",
        hotelView: existing.hotelView || "",
        roomType: existing.roomType || "",
        bedType: existing.bedType || "",
        checkIn: existing.checkIn || "",
        checkOut: existing.checkOut || "",
        noOfNights: String(existing.noOfNights ?? 0),
        noOfRooms: String(existing.noOfRooms ?? 1),
        reference: existing.reference || "",
        cnfNumber: existing.cnfNumber || "",
        roomNumber: existing.roomNumber || "",
        remarks: existing.remarks || "",
        contactNumber: existing.contactNumber || "",
        receivableSar: rSar,
        payableSar: existing.payableSar != null ? String(existing.payableSar) : "",
        receivablePkr: rPkr,
        payablePkr: existing.payablePkr != null ? String(existing.payablePkr) : "",
        incomeHead: existing.incomeHead || "Hotel Income",
        salesmanId: existing.salesmanId ? String(existing.salesmanId) : "",
        status: existing.status || "draft",
      });
    }
  }, [existing, isEdit]);

  // Auto-calc nights
  useEffect(() => {
    if (form.checkIn && form.checkOut) {
      setForm(p => ({ ...p, noOfNights: String(calcNights(p.checkIn, p.checkOut)) }));
    }
  }, [form.checkIn, form.checkOut]);

  // When hotel selected from dropdown, fill hotel name
  const onHotelSelect = (id: string) => {
    const h = (hotels as any[]).find((h: any) => String(h.id) === id);
    setForm(p => ({ ...p, hotelId: id, hotelName: h ? h.name : p.hotelName }));
  };

  const f = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  /* ── Bidirectional SAR ↔ PKR conversion ──────────────────────────────────
     Three handlers — one per "source" field type.
     Rule: the field being edited is authoritative; the paired field is derived.
  ─────────────────────────────────────────────────────────────────────────── */

  function onSarChange(key: "receivableSar" | "payableSar", val: string) {
    lastChanged.current = "sar";
    const rate = Number(convRate);
    setForm(p => {
      const next = { ...p, [key]: val };
      if (rate > 0 && val !== "") {
        const pkrKey = key === "receivableSar" ? "receivablePkr" : "payablePkr";
        next[pkrKey] = round2(Number(val) * rate);
      }
      return next;
    });
  }

  function onPkrChange(key: "receivablePkr" | "payablePkr", val: string) {
    lastChanged.current = "pkr";
    setForm(p => {
      const next = { ...p, [key]: val };
      /* back-calc rate from receivable pair if that's what changed */
      if (key === "receivablePkr") {
        const sarNum = Number(p.receivableSar);
        const pkrNum = Number(val);
        if (sarNum > 0 && pkrNum > 0) {
          const newRate = pkrNum / sarNum;
          setConvRate(round2(newRate));
          /* propagate new rate to payable */
          if (p.payableSar !== "") {
            next.payablePkr = round2(Number(p.payableSar) * newRate);
          }
        }
      } else {
        /* payablePkr changed — back-calc rate from payable pair */
        const sarNum = Number(p.payableSar);
        const pkrNum = Number(val);
        if (sarNum > 0 && pkrNum > 0) {
          const newRate = pkrNum / sarNum;
          setConvRate(round2(newRate));
          if (p.receivableSar !== "") {
            next.receivablePkr = round2(Number(p.receivableSar) * newRate);
          }
        }
      }
      return next;
    });
  }

  function onRateChange(val: string) {
    lastChanged.current = "rate";
    setConvRate(val);
    const rate = Number(val);
    if (rate > 0) {
      setForm(p => {
        const next = { ...p };
        if (p.receivableSar !== "") next.receivablePkr = round2(Number(p.receivableSar) * rate);
        if (p.payableSar !== "")   next.payablePkr    = round2(Number(p.payableSar) * rate);
        return next;
      });
    }
  }

  // ── Mutations ──────────────────────────────────────────────────────────────
  const save = useMutation({
    mutationFn: async (data: object) => {
      const url    = isEdit ? `/api/invoices/hotel/${params.id}` : "/api/invoices/hotel";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["/api/invoices/hotel"] });
      setSavedInvoice(result);
      toast({
        title: isEdit ? "Invoice updated" : "Invoice created",
        description: `${result.dnNumber} saved successfully`,
      });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleAccept = () => {
    if (!form.invoiceDate) { toast({ title: "Invoice date required", variant: "destructive" }); return; }
    setSavedInvoice(null);
    const payload = {
      ...form,
      dnNumber: isEdit ? undefined : dnNumber,
      partyId: form.partyId || null,
      vendorId: form.vendorId || null,
      noOfPax: Number(form.noOfPax) || 1,
      noOfRooms: Number(form.noOfRooms) || 1,
      noOfNights: Number(form.noOfNights) || null,
      hotelId: form.hotelId || null,
      salesmanId: form.salesmanId || null,
      receivableSar: form.receivableSar !== "" ? Number(form.receivableSar) : null,
      payableSar:    form.payableSar    !== "" ? Number(form.payableSar)    : null,
      receivablePkr: form.receivablePkr !== "" ? Number(form.receivablePkr) : null,
      payablePkr:    form.payablePkr    !== "" ? Number(form.payablePkr)    : null,
    };
    save.mutate(payload);
  };

  const handleClear = () => {
    setSavedInvoice(null);
    setConvRate("");
    setForm({ ...EMPTY_FORM, reference: dnNumber.replace("DN-", "") });
  };

  /* ── Print helpers ────────────────────────────────────────────────────────── */
  function handlePrintInvoice() {
    document.body.classList.remove("print-voucher");
    window.print();
  }

  function handlePrintVoucher() {
    document.body.classList.add("print-voucher");
    window.print();
    /* reset after print dialog closes */
    setTimeout(() => document.body.classList.remove("print-voucher"), 500);
  }

  /* ── Derived ── */
  const income    = (Number(form.receivableSar) || 0) - (Number(form.payableSar) || 0);
  const incomePkr = (Number(form.receivablePkr) || 0) - (Number(form.payablePkr) || 0);

  const partyName  = (clients as any[]).find((c: any) => String(c.id) === form.partyId)?.name ?? "";
  const vendorName = (vendors as any[]).find((v: any) => String(v.id) === form.vendorId)?.name ?? "";

  /* ════════════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-0 max-w-4xl mx-auto">

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 print:hidden">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/accounting/invoices")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Button variant="outline" size="sm" onClick={handlePrintInvoice}>
          <Printer className="mr-2 h-4 w-4" /> Print Invoice
        </Button>
      </div>

      {/* ── Saved banner ── */}
      {savedInvoice && (
        <div className="flex items-center justify-between gap-4 mb-3 px-4 py-3 rounded-md border border-green-300 bg-green-50 text-green-800 print:hidden">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Saved — {savedInvoice.dnNumber}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="border-green-400 text-green-800 hover:bg-green-100" onClick={handlePrintInvoice}>
              <Printer className="h-4 w-4 mr-1" /> Print Invoice
            </Button>
            <Button size="sm" variant="outline" className="border-blue-400 text-blue-800 hover:bg-blue-100" onClick={handlePrintVoucher}>
              <FileText className="h-4 w-4 mr-1" /> Print Voucher
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setLocation("/accounting/invoices")}>
              Back to List
            </Button>
          </div>
        </div>
      )}

      {/* ── DN Invoice Form ── */}
      <div
        id="invoice-print-area"
        className="border border-blue-200 bg-white print:border-gray-400 rounded-sm overflow-hidden shadow-sm"
        style={{ fontFamily: "Arial, sans-serif", fontSize: "13px" }}
      >
        {/* ── Print-only AMI branding header ─────────────────────────────────── */}
        <div className="hidden print:block border-b-2 border-blue-900 pb-3 pt-3 px-5">
          <div className="flex items-center justify-between">
            <div className="w-20 h-12 flex items-center">
              {(branding.printLogoUrl || branding.logoUrl) ? (
                <img src={branding.printLogoUrl || branding.logoUrl} alt="Logo" className="max-h-10 max-w-full object-contain" />
              ) : (
                <div className="h-10 w-16 bg-blue-900 rounded flex items-center justify-center text-white text-[9px] font-bold text-center leading-tight px-1">
                  {branding.companyName}
                </div>
              )}
            </div>
            <div className="text-center flex-1 px-4">
              <div className="text-sm font-bold text-blue-900 uppercase tracking-wide">{branding.companyName}</div>
              {branding.companyAddress && <div className="text-[10px] text-gray-600">{branding.companyAddress}</div>}
              {branding.companyPhone && <div className="text-[10px] text-gray-500">{branding.companyPhone}</div>}
              {branding.companyNtn && <div className="text-[10px] text-gray-400">NTN: {branding.companyNtn}</div>}
            </div>
            <div className="text-right text-[10px] text-gray-500 w-24">
              {branding.companyEmail && <div>{branding.companyEmail}</div>}
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="text-center py-3 border-b border-blue-700 bg-blue-900">
          <span className="text-xl font-bold tracking-widest text-white">
            DN &nbsp; I N V O I C E &nbsp;— Hotel Entry &nbsp;{isEdit ? "[ EDIT ]" : "[ NEW ]"}
          </span>
        </div>

        {/* Header row: date + DN number */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-blue-100 bg-blue-50">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Invoice Date</span>
            <input
              type="date"
              className="border border-gray-400 px-2 py-0.5 text-sm bg-white"
              value={form.invoiceDate}
              onChange={f("invoiceDate")}
            />
          </div>
          <div className="font-bold text-lg tracking-wide text-blue-900">{dnNumber || "—"}</div>
        </div>

        {/* ── Passenger Information ── */}
        <SectionHeader title="Passenger Information" />
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 px-4 py-2 bg-slate-50">
          <FormRow label="Party">
            <select
              className="border border-gray-400 px-1 py-0.5 text-sm bg-white w-full"
              value={form.partyId}
              onChange={e => setForm(p => ({ ...p, partyId: e.target.value }))}
            >
              <option value="">--------------Select--------------</option>
              {(clients as any[]).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </FormRow>
          <FormRow label="Vendor">
            <select
              className="border border-gray-400 px-1 py-0.5 text-sm bg-white w-full"
              value={form.vendorId}
              onChange={e => setForm(p => ({ ...p, vendorId: e.target.value }))}
            >
              <option value="">--------------Select--------------</option>
              {(vendors as any[]).map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </FormRow>
          <FormRow label="Name">
            <input type="text" className="border border-gray-400 px-2 py-0.5 text-sm bg-white w-full" value={form.passengerName} onChange={f("passengerName")} />
          </FormRow>
          <FormRow label="Nationality">
            <div className="flex gap-1">
              <input type="text" className="border border-gray-400 px-2 py-0.5 text-sm bg-white flex-1" value={form.nationality} onChange={f("nationality")} />
              <select className="border border-gray-400 px-1 py-0.5 text-sm bg-white" value="" onChange={e => setForm(p => ({ ...p, nationality: e.target.value }))}>
                <option value="">ON</option>
                {NATIONALITIES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </FormRow>
          <FormRow label="Detail">
            <input type="text" className="border border-gray-400 px-2 py-0.5 text-sm bg-white w-full" value={form.detail} onChange={f("detail")} />
          </FormRow>
          <FormRow label="No. of Pax">
            <input type="number" min="1" className="border border-gray-400 px-2 py-0.5 text-sm bg-white w-full" value={form.noOfPax} onChange={f("noOfPax")} />
          </FormRow>
        </div>

        {/* ── Hotel Voucher ── */}
        <SectionHeader title="Hotel Voucher" />
        <div className="px-4 py-2 bg-slate-50 space-y-1.5">
          <div className="flex items-center gap-2">
            <label className="w-28 font-semibold text-sm">Type</label>
            <select className="border border-gray-400 px-1 py-0.5 text-sm bg-white w-36" value={form.voucherType} onChange={e => setForm(p => ({ ...p, voucherType: e.target.value }))}>
              <option value=""></option>
              {VOUCHER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="w-28 font-semibold text-sm">Option Date</label>
            <input type="date" className="border border-gray-400 px-2 py-0.5 text-sm bg-white" value={form.optionDate} onChange={f("optionDate")} />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="w-28 font-semibold text-sm">Hotel</label>
            <select
              className="border border-gray-400 px-1 py-0.5 text-sm bg-white flex-1 min-w-40"
              value={form.hotelId}
              onChange={e => onHotelSelect(e.target.value)}
            >
              <option value="">— Select or type below —</option>
              {(hotels as any[]).map((h: any) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
            <select className="border border-gray-400 px-1 py-0.5 text-sm bg-white w-32" value={form.hotelView} onChange={e => setForm(p => ({ ...p, hotelView: e.target.value }))}>
              <option value=""></option>
              {HOTEL_VIEWS.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <label className="font-semibold text-sm ml-4">Type Of Room</label>
            <input type="text" className="border border-gray-400 px-2 py-0.5 text-sm bg-white w-24" value={form.roomType} onChange={f("roomType")} />
            <select className="border border-gray-400 px-1 py-0.5 text-sm bg-white w-16" value={form.bedType} onChange={e => setForm(p => ({ ...p, bedType: e.target.value }))}>
              <option value=""></option>
              {BED_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="w-28 font-semibold text-xs text-muted-foreground">Hotel (free text)</label>
            <input type="text" className="border border-gray-400 px-2 py-0.5 text-sm bg-white flex-1" placeholder="Override or enter custom hotel name" value={form.hotelName} onChange={f("hotelName")} />
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <label className="w-28 font-semibold text-sm">Check In</label>
            <input type="date" className="border border-gray-400 px-2 py-0.5 text-sm bg-white" value={form.checkIn} onChange={f("checkIn")} />
            <label className="font-semibold text-sm">Check Out</label>
            <input type="date" className="border border-gray-400 px-2 py-0.5 text-sm bg-white" value={form.checkOut} onChange={f("checkOut")} />
            <label className="font-semibold text-sm ml-4">No. Of Nights</label>
            <input type="number" className="border border-gray-400 px-2 py-0.5 text-sm bg-white w-16 bg-yellow-50" readOnly value={form.noOfNights} />
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <label className="w-28 font-semibold text-sm">Reference</label>
            <input type="text" className="border border-gray-400 px-2 py-0.5 text-sm bg-white w-64" value={form.reference} onChange={f("reference")} />
            <label className="font-semibold text-sm ml-8">No. of Rooms</label>
            <input type="number" min="1" className="border border-gray-400 px-2 py-0.5 text-sm bg-white w-16" value={form.noOfRooms} onChange={f("noOfRooms")} />
          </div>
          <div className="flex items-center gap-2">
            <label className="w-28 font-semibold text-sm">CNF#</label>
            <input type="text" className="border border-gray-400 px-2 py-0.5 text-sm bg-white w-64" value={form.cnfNumber} onChange={f("cnfNumber")} />
          </div>
          <div className="flex items-center gap-2">
            <label className="w-28 font-semibold text-sm">Room No.</label>
            <input type="text" className="border border-gray-400 px-2 py-0.5 text-sm bg-white flex-1" value={form.roomNumber} onChange={f("roomNumber")} />
          </div>
          <div className="flex items-center gap-2">
            <label className="w-28 font-semibold text-sm">Remarks</label>
            <input type="text" className="border border-gray-400 px-2 py-0.5 text-sm bg-white flex-1" value={form.remarks} onChange={f("remarks")} />
          </div>
          <div className="flex items-center gap-2">
            <label className="w-28 font-semibold text-sm">Person/Contact No.</label>
            <input type="text" className="border border-gray-400 px-2 py-0.5 text-sm bg-white flex-1" value={form.contactNumber} onChange={f("contactNumber")} />
          </div>
        </div>

        {/* ── Calculation ── */}
        <SectionHeader title="Calculation (Per Night Per Room Rate)" />
        <div className="px-4 py-2 bg-slate-50 space-y-1.5">

          {/* Conversion rate row — spans full width */}
          <div className="flex items-center gap-3 py-1 px-2 bg-amber-50 border border-amber-200 rounded">
            <label className="font-semibold text-sm text-amber-900 shrink-0">Conversion Rate</label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g. 77.5"
              className="border border-amber-400 px-2 py-0.5 text-sm bg-white w-28 text-center font-mono"
              value={convRate}
              onChange={e => onRateChange(e.target.value)}
            />
            <span className="text-xs text-amber-700 font-medium">PKR per SAR</span>
            {convRate && Number(convRate) > 0 && (
              <span className="text-xs text-amber-600 ml-1">
                — 1 SAR = {Number(convRate).toFixed(2)} Rs &nbsp;|&nbsp; 1 Rs = {(1 / Number(convRate)).toFixed(4)} SAR
              </span>
            )}
          </div>

          {/* SAR row */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
            <FormRow label="Receivable Amount (SAR)">
              <input
                type="number"
                step="0.01"
                className="border border-gray-400 px-2 py-0.5 text-sm bg-white w-full"
                value={form.receivableSar}
                onChange={e => onSarChange("receivableSar", e.target.value)}
              />
            </FormRow>
            <FormRow label="Payable Amount (SAR)">
              <input
                type="number"
                step="0.01"
                className="border border-gray-400 px-2 py-0.5 text-sm bg-white w-full"
                value={form.payableSar}
                onChange={e => onSarChange("payableSar", e.target.value)}
              />
            </FormRow>
            {/* PKR row — auto-filled but editable */}
            <FormRow label="Receivable Amount (Rs)">
              <input
                type="number"
                step="0.01"
                className="border border-gray-400 px-2 py-0.5 text-sm bg-white w-full"
                value={form.receivablePkr}
                onChange={e => onPkrChange("receivablePkr", e.target.value)}
              />
            </FormRow>
            <FormRow label="Payable Amount (Rs)">
              <input
                type="number"
                step="0.01"
                className="border border-gray-400 px-2 py-0.5 text-sm bg-white w-full"
                value={form.payablePkr}
                onChange={e => onPkrChange("payablePkr", e.target.value)}
              />
            </FormRow>
          </div>

          {/* Profit preview */}
          {(form.receivableSar || form.payableSar) && (
            <div className="mt-2 flex gap-8 text-sm">
              <span className="text-green-700 font-medium">
                SAR Income: {income >= 0 ? "+" : ""}{income.toLocaleString(undefined, { maximumFractionDigits: 2 })} SAR
              </span>
              <span className="text-green-700 font-medium">
                PKR Income: {incomePkr >= 0 ? "+" : ""}{incomePkr.toLocaleString(undefined, { maximumFractionDigits: 2 })} Rs
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 mt-1">
            <FormRow label="Income Head">
              <select className="border border-gray-400 px-1 py-0.5 text-sm bg-white w-full" value={form.incomeHead} onChange={e => setForm(p => ({ ...p, incomeHead: e.target.value }))}>
                {INCOME_HEADS.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </FormRow>
            <FormRow label="Salesman">
              <select className="border border-gray-400 px-1 py-0.5 text-sm bg-white w-full" value={form.salesmanId} onChange={e => setForm(p => ({ ...p, salesmanId: e.target.value }))}>
                <option value=""></option>
                {(users as any[]).map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </FormRow>
            <FormRow label="Status">
              <select className="border border-gray-400 px-1 py-0.5 text-sm bg-white w-full" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </FormRow>
          </div>
        </div>

        {/* Accept / Clear buttons */}
        {canWrite ? (
          <div className="flex justify-center gap-4 py-4 border-t border-blue-100 bg-blue-50 print:hidden">
            <Button
              className="bg-blue-900 hover:bg-blue-800 text-white px-10 py-2 text-base font-semibold"
              onClick={handleAccept}
              disabled={save.isPending}
            >
              {save.isPending ? "Saving…" : "Accept"}
            </Button>
            <Button
              variant="destructive"
              className="px-10 py-2 text-base font-semibold"
              onClick={handleClear}
            >
              Clear
            </Button>
          </div>
        ) : (
          <div className="flex justify-center py-4 border-t border-blue-100 bg-blue-50 print:hidden">
            <span className="text-sm text-muted-foreground italic">View-only — your role cannot create or edit invoices</span>
          </div>
        )}
      </div>

      {/* ── Hotel Accommodation Voucher (hidden on screen, printed when .print-voucher) ── */}
      <div id="voucher-print-area" style={{ display: "none" }}>
        <div style={{ fontFamily: "Arial, sans-serif", fontSize: "13px", maxWidth: "700px", margin: "0 auto", border: "2px solid #1e3a5f", padding: "0" }}>
          {/* Header */}
          <div style={{ background: "#1e3a5f", color: "white", textAlign: "center", padding: "14px 10px 10px" }}>
            <div style={{ fontSize: "18px", fontWeight: "bold", letterSpacing: "2px" }}>{COMPANY_NAME}</div>
            <div style={{ fontSize: "11px", marginTop: "4px", letterSpacing: "1px", opacity: 0.85 }}>HOTEL ACCOMMODATION VOUCHER</div>
          </div>
          {/* DN + Date */}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 16px", borderBottom: "1px solid #ccc", background: "#f0f4f8" }}>
            <span><strong>Voucher Ref:</strong> {dnNumber || "—"}</span>
            <span><strong>Date:</strong> {form.invoiceDate || "—"}</span>
          </div>
          {/* Guest / Party details */}
          <VoucherSection title="Guest Information">
            <VRow label="Passenger Name"  value={form.passengerName} />
            <VRow label="Nationality"     value={form.nationality} />
            <VRow label="No. of Pax"      value={form.noOfPax} />
            <VRow label="Detail / Tour"   value={form.detail} />
          </VoucherSection>
          <VoucherSection title="Booking Party">
            <VRow label="Party / Client"  value={partyName} />
            <VRow label="Vendor"          value={vendorName} />
            <VRow label="Contact No."     value={form.contactNumber} />
          </VoucherSection>
          <VoucherSection title="Hotel Details">
            <VRow label="Hotel"           value={form.hotelName} />
            <VRow label="Type"            value={form.voucherType} />
            <VRow label="View"            value={form.hotelView} />
            <VRow label="Room Type"       value={form.roomType} />
            <VRow label="Bed Type"        value={form.bedType} />
            <VRow label="Room No."        value={form.roomNumber} />
            <VRow label="No. of Rooms"    value={form.noOfRooms} />
            <VRow label="No. of Nights"   value={form.noOfNights} />
            <VRow label="Check In"        value={form.checkIn} />
            <VRow label="Check Out"       value={form.checkOut} />
            <VRow label="CNF#"            value={form.cnfNumber} />
            <VRow label="Remarks"         value={form.remarks} />
          </VoucherSection>
          {/* Footer */}
          <div style={{ padding: "10px 16px", borderTop: "1px solid #ccc", background: "#f9f9f9", fontSize: "11px", color: "#555", textAlign: "center" }}>
            This voucher does not constitute a receipt of payment. &nbsp;|&nbsp; {COMPANY_NAME} &nbsp;|&nbsp; {new Date().toLocaleDateString()}
          </div>
        </div>
      </div>

      {/* ── Print styles ── */}
      <style>{`
        /* Default: print the invoice area */
        @media print {
          body > * { visibility: hidden; }
          .print\\:hidden { display: none !important; }
          #invoice-print-area,
          #invoice-print-area * { visibility: visible; }
          #invoice-print-area { position: fixed; left: 0; top: 0; width: 100%; }
          #voucher-print-area { display: none !important; }
        }

        /* When body.print-voucher: print only the voucher */
        body.print-voucher #invoice-print-area { display: none !important; }
        @media print {
          body.print-voucher #invoice-print-area { display: none !important; }
          body.print-voucher #voucher-print-area {
            display: block !important;
            visibility: visible !important;
            position: fixed;
            left: 0; top: 0;
            width: 100%;
          }
          body.print-voucher #voucher-print-area * { visibility: visible !important; }
        }
      `}</style>
    </div>
  );
}

/* ── Sub-components ───────────────────────────────────────────────────────── */

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="text-center py-1.5 border-y border-blue-700 bg-blue-800 font-semibold tracking-widest text-sm text-white">
      {title.split("").join(" ")}
    </div>
  );
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <label className="w-40 font-semibold text-sm shrink-0">{label}</label>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function VoucherSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ background: "#2d5a8e", color: "white", padding: "4px 16px", fontSize: "12px", fontWeight: "bold", letterSpacing: "1px" }}>
        {title}
      </div>
      <div style={{ padding: "6px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 12px" }}>
        {children}
      </div>
    </div>
  );
}

function VRow({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null;
  return (
    <div style={{ display: "flex", gap: "6px", padding: "1px 0", fontSize: "12px" }}>
      <span style={{ fontWeight: "bold", minWidth: "110px", color: "#333" }}>{label}:</span>
      <span>{String(value)}</span>
    </div>
  );
}
