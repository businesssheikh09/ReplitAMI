import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useListClients, useListUsers, useListHotels, useListVendors } from "@workspace/api-client-react";
import { ArrowLeft, Printer, FileText, CheckCircle2, Plus, Pencil } from "lucide-react";
import { useBranding } from "@/components/print-layout";

const today = () => new Date().toISOString().slice(0, 10);

const VOUCHER_TYPES = ["Hotel", "Resort", "Apartment", "Serviced", "Hostel"];
const HOTEL_VIEWS   = ["City View", "Haram View", "Pool View", "Garden View", "Sea View"];
const BED_TYPES     = ["DBL", "SGL", "TPL", "QUAD", "KNG", "TWN"];
const INCOME_HEADS  = ["Hotel Income", "Commission", "Service Fee", "Other"];
const NATIONALITIES = ["Pakistani", "British", "Saudi", "UAE", "American", "Indian", "Other"];
const STATUSES      = ["tentative", "confirmed"];

function calcNights(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return Math.max(0, Math.round(diff / 86400000));
}

function round2(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2).replace(/\.?0+$/, "");
}

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
              "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
              "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function toWords(n: number): string {
  if (n === 0) return "";
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "");
  if (n < 1000) return ONES[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " and " + toWords(n % 100) : "");
  if (n < 100000) return toWords(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + toWords(n % 1000) : "");
  return toWords(Math.floor(n / 100000)) + " Lakh" + (n % 100000 ? " " + toWords(n % 100000) : "");
}

function sarToWords(n: number): string {
  if (!n || n <= 0) return "";
  const intPart = Math.floor(n);
  const decPart = Math.round((n - intPart) * 100);
  let words = toWords(intPart) + " SAR";
  if (decPart > 0) words += " and " + toWords(decPart) + " Halalas";
  return words + " Only";
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
  status: "tentative",
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
  const [savedInvoice, setSavedInvoice] = useState<any>(null);

  /* Multi-currency: each side has its own currency + exchange rate (→ PKR) */
  const [receivableCurrency, setReceivableCurrency] = useState("SAR");
  const [payableCurrency, setPayableCurrency] = useState("SAR");
  const [receivableRate, setReceivableRate] = useState("");
  const [payableRate, setPayableRate] = useState("");

  /* Per-night-per-room rate helpers (UI only — not stored; total is stored in receivableSar/payableSar) */
  const [receivableRatePerNight, setReceivableRatePerNight] = useState("");
  const [payableRatePerNight, setPayableRatePerNight] = useState("");

  /* Live rates from API — response shape: { base: "USD", rates: { PKR, SAR, USD, GBP, EUR, ... } } */
  const { data: liveRates = {} } = useQuery<Record<string, number>>({
    queryKey: ["/api/currency/rates"],
    queryFn: () => fetch("/api/currency/rates").then(r => r.json()).then(d => d.rates || {}),
    staleTime: 5 * 60 * 1000,
  });

  /* Return PKR per 1 unit of `currency` using USD-base cross-rate math */
  function toPkrRate(currency: string, rates: Record<string, number>): number {
    if (currency === "PKR") return 1;
    const pkrUsd = rates["PKR"];   // e.g. 278
    const srcUsd = rates[currency]; // e.g. 3.75 for SAR
    if (!pkrUsd || !srcUsd) return 0;
    return pkrUsd / srcUsd;  // PKR per 1 SAR = 278/3.75 ≈ 74.1
  }

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
      const pSar = existing.payableSar != null ? String(existing.payableSar) : "";
      const pPkr = existing.payablePkr != null ? String(existing.payablePkr) : "";
      /* back-calc stored rate from each pair */
      if (rSar && rPkr && Number(rSar) > 0) setReceivableRate(round2(Number(rPkr) / Number(rSar)));
      if (pSar && pPkr && Number(pSar) > 0) setPayableRate(round2(Number(pPkr) / Number(pSar)));
      if (existing.receivableCurrency) setReceivableCurrency(existing.receivableCurrency);
      if (existing.payableCurrency) setPayableCurrency(existing.payableCurrency);
      const nights = Number(existing.noOfNights ?? 0);
      const rooms  = Number(existing.noOfRooms  ?? 1);
      /* Back-calc per-night rate from stored total */
      if (rSar && nights > 0 && rooms > 0) setReceivableRatePerNight(round2(Number(rSar) / (nights * rooms)));
      const pSarStr = existing.payableSar != null ? String(existing.payableSar) : "";
      if (pSarStr && nights > 0 && rooms > 0) setPayableRatePerNight(round2(Number(pSarStr) / (nights * rooms)));
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
        payableSar: pSarStr,
        receivablePkr: rPkr,
        payablePkr: existing.payablePkr != null ? String(existing.payablePkr) : "",
        incomeHead: existing.incomeHead || "Hotel Income",
        salesmanId: existing.salesmanId ? String(existing.salesmanId) : "",
        status: existing.status || "tentative",
      });
    }
  }, [existing, isEdit]);

  // Auto-calc nights
  useEffect(() => {
    if (form.checkIn && form.checkOut) {
      setForm(p => ({ ...p, noOfNights: String(calcNights(p.checkIn, p.checkOut)) }));
    }
  }, [form.checkIn, form.checkOut]);

  // Auto-calc receivable total: rate × nights × rooms → receivableSar (and PKR equiv)
  useEffect(() => {
    const rate   = Number(receivableRatePerNight);
    const nights = Number(form.noOfNights);
    const rooms  = Number(form.noOfRooms);
    if (rate > 0 && nights > 0 && rooms > 0) {
      const total = round2(rate * nights * rooms);
      setForm(p => {
        const pkrRate = Number(receivableRate);
        const next = { ...p, receivableSar: total };
        if (pkrRate > 0) next.receivablePkr = round2(Number(total) * pkrRate);
        return next;
      });
    }
  }, [receivableRatePerNight, form.noOfNights, form.noOfRooms, receivableRate]);

  // Auto-calc payable total: rate × nights × rooms → payableSar (and PKR equiv)
  useEffect(() => {
    const rate   = Number(payableRatePerNight);
    const nights = Number(form.noOfNights);
    const rooms  = Number(form.noOfRooms);
    if (rate > 0 && nights > 0 && rooms > 0) {
      const total = round2(rate * nights * rooms);
      setForm(p => {
        const pkrRate = Number(payableRate);
        const next = { ...p, payableSar: total };
        if (pkrRate > 0) next.payablePkr = round2(Number(total) * pkrRate);
        return next;
      });
    }
  }, [payableRatePerNight, form.noOfNights, form.noOfRooms, payableRate]);

  // When hotel selected from dropdown, fill hotel name
  const onHotelSelect = (id: string) => {
    const h = (hotels as any[]).find((h: any) => String(h.id) === id);
    setForm(p => ({ ...p, hotelId: id, hotelName: h ? h.name : p.hotelName }));
  };

  const f = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  /* ── Per-side currency + rate handlers ───────────────────────────────────
     Each side (receivable / payable) has its own currency and PKR rate.
     Editing the foreign-currency amount auto-derives PKR; editing PKR back-calcs rate.
  ─────────────────────────────────────────────────────────────────────────── */

  const CURRENCIES = ["SAR", "USD", "GBP", "EUR", "PKR"];

  function onCurrencyChange(side: "receivable" | "payable", currency: string) {
    const r = toPkrRate(currency, liveRates);  // PKR per 1 unit of currency
    const nr = r > 0 ? round2(r) : "";
    if (side === "receivable") {
      setReceivableCurrency(currency);
      if (nr) {
        setReceivableRate(nr);
        setForm(p => p.receivableSar !== "" ? { ...p, receivablePkr: round2(Number(p.receivableSar) * r) } : p);
      }
    } else {
      setPayableCurrency(currency);
      if (nr) {
        setPayableRate(nr);
        setForm(p => p.payableSar !== "" ? { ...p, payablePkr: round2(Number(p.payableSar) * r) } : p);
      }
    }
  }

  function onAmountChange(side: "receivable" | "payable", val: string) {
    /* When user edits the total directly, clear the rate-per-night so it doesn't auto-override */
    if (side === "receivable") setReceivableRatePerNight("");
    else setPayableRatePerNight("");
    const rate = side === "receivable" ? Number(receivableRate) : Number(payableRate);
    setForm(p => {
      const next = { ...p };
      if (side === "receivable") {
        next.receivableSar = val;
        if (rate > 0 && val !== "") next.receivablePkr = round2(Number(val) * rate);
      } else {
        next.payableSar = val;
        if (rate > 0 && val !== "") next.payablePkr = round2(Number(val) * rate);
      }
      return next;
    });
  }

  function onPkrChange(side: "receivable" | "payable", val: string) {
    setForm(p => {
      const next = { ...p };
      if (side === "receivable") {
        next.receivablePkr = val;
        const fNum = Number(p.receivableSar);
        if (fNum > 0 && Number(val) > 0) setReceivableRate(round2(Number(val) / fNum));
      } else {
        next.payablePkr = val;
        const fNum = Number(p.payableSar);
        if (fNum > 0 && Number(val) > 0) setPayableRate(round2(Number(val) / fNum));
      }
      return next;
    });
  }

  function onRateChange(side: "receivable" | "payable", val: string) {
    if (side === "receivable") {
      setReceivableRate(val);
      const rate = Number(val);
      if (rate > 0) setForm(p => p.receivableSar !== "" ? { ...p, receivablePkr: round2(Number(p.receivableSar) * rate) } : p);
    } else {
      setPayableRate(val);
      const rate = Number(val);
      if (rate > 0) setForm(p => p.payableSar !== "" ? { ...p, payablePkr: round2(Number(p.payableSar) * rate) } : p);
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
      receivableCurrency,
      payableCurrency,
    };
    save.mutate(payload);
  };

  const handleClear = () => {
    setSavedInvoice(null);
    setReceivableRate("");
    setPayableRate("");
    setReceivableCurrency("SAR");
    setPayableCurrency("SAR");
    setReceivableRatePerNight("");
    setPayableRatePerNight("");
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
    setTimeout(() => document.body.classList.remove("print-voucher"), 500);
  }

  function handlePrintFormalInvoice() {
    document.body.classList.remove("print-voucher");
    document.body.classList.add("print-formal");
    window.print();
    setTimeout(() => document.body.classList.remove("print-formal"), 500);
  }

  /* ── Derived ── */
  const income    = (Number(form.receivableSar) || 0) - (Number(form.payableSar) || 0);
  const incomePkr = (Number(form.receivablePkr) || 0) - (Number(form.payablePkr) || 0);

  const partyName    = (clients as any[]).find((c: any) => String(c.id) === form.partyId)?.name ?? "";
  const vendorName   = (vendors as any[]).find((v: any) => String(v.id) === form.vendorId)?.name ?? "";
  const salesmanName = (savedInvoice?.salesmanName) || ((users as any[]).find((u: any) => String(u.id) === form.salesmanId)?.name ?? "");

  /* ════════════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-0 max-w-4xl mx-auto">

      {/* ── Toolbar (form mode only) ── */}
      {!savedInvoice && (
        <div className="flex items-center justify-between mb-4 print:hidden">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/accounting/invoices")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrintFormalInvoice}>
            <Printer className="mr-2 h-4 w-4" /> Print Invoice
          </Button>
        </div>
      )}

      {/* ── SAVED VIEW ── */}
      {savedInvoice && (
        <div className="print:hidden space-y-3 mb-2">
          {/* Header row: back + status badge + DN number */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => setLocation("/accounting/invoices")}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold border ${
                form.status === "confirmed"
                  ? "bg-green-50 text-green-800 border-green-300"
                  : "bg-amber-50 text-amber-800 border-amber-300"
              }`}>
                <CheckCircle2 className="h-4 w-4" />
                {form.status === "confirmed" ? "CONFIRMED" : "TENTATIVE"}
              </span>
              <span className="text-base font-mono font-bold text-blue-900">{savedInvoice.dnNumber}</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" onClick={() => setLocation("/accounting/hotel-invoice/new")}>
                <Plus className="h-4 w-4 mr-1" /> Add Record
              </Button>
              <Button size="sm" variant="outline" onClick={() => setSavedInvoice(null)}>
                <Pencil className="h-4 w-4 mr-1" /> Edit
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setLocation("/accounting/invoices")}>
                Back to List
              </Button>
            </div>
          </div>
          {/* Print buttons */}
          <div className="flex gap-2 border-t pt-2">
            <Button size="sm" variant="outline" onClick={handlePrintFormalInvoice}>
              <Printer className="h-4 w-4 mr-1" /> Print Invoice
            </Button>
            <Button size="sm" variant="outline" onClick={handlePrintVoucher}>
              <FileText className="h-4 w-4 mr-1" /> Print Voucher
            </Button>
          </div>
          {/* Read-only record card */}
          <div className="border border-blue-200 bg-white rounded-sm overflow-hidden shadow-sm" style={{fontFamily: "Arial, sans-serif", fontSize: "13px"}}>
            <div className="text-center py-3 border-b border-blue-700 bg-blue-900">
              <span className="text-xl font-bold tracking-widest text-white">
                DN &nbsp; I N V O I C E &nbsp;— Hotel Entry
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-2 border-b border-blue-100 bg-blue-50">
              <div className="text-sm"><span className="font-semibold">Invoice Date: </span>{form.invoiceDate}</div>
              <div className="font-bold text-lg tracking-wide text-blue-900">{savedInvoice.dnNumber}</div>
            </div>
            <ROSection title="Passenger Information">
              <RORow label="Party"       value={savedInvoice.partyName} />
              <RORow label="Vendor"      value={savedInvoice.vendorName} />
              <RORow label="Name"        value={form.passengerName} />
              <RORow label="Nationality" value={form.nationality} />
              <RORow label="No. of Pax"  value={form.noOfPax} />
              <RORow label="Detail"      value={form.detail} />
            </ROSection>
            <ROSection title="Hotel Voucher">
              <RORow label="Type"          value={form.voucherType} />
              <RORow label="Option Date"   value={form.optionDate} />
              <RORow label="Hotel"         value={form.hotelName} />
              <RORow label="View"          value={form.hotelView} />
              <RORow label="Room Type"     value={form.roomType} />
              <RORow label="Bed Type"      value={form.bedType} />
              <RORow label="Check In"      value={form.checkIn} />
              <RORow label="Check Out"     value={form.checkOut} />
              <RORow label="No. of Nights" value={form.noOfNights} />
              <RORow label="No. of Rooms"  value={form.noOfRooms} />
              <RORow label="Reference"     value={form.reference} />
              <RORow label="CNF#"          value={form.cnfNumber} />
              <RORow label="Room No."      value={form.roomNumber} />
              <RORow label="Remarks"       value={form.remarks} />
              <RORow label="Contact No."   value={form.contactNumber} />
            </ROSection>
            <ROSection title="Calculation">
              <RORow label="Receivable"  value={form.receivableSar ? `${form.receivableSar} ${receivableCurrency}` : ""} />
              <RORow label="Payable"     value={form.payableSar ? `${form.payableSar} ${payableCurrency}` : ""} />
              <RORow label="PKR Recv."   value={form.receivablePkr ? `Rs ${form.receivablePkr}` : ""} />
              <RORow label="PKR Pay."    value={form.payablePkr ? `Rs ${form.payablePkr}` : ""} />
              <RORow label="Income Head" value={form.incomeHead} />
              <RORow label="Salesman"    value={salesmanName} />
              <RORow label="Status"      value={form.status.toUpperCase()} />
            </ROSection>
          </div>
        </div>
      )}

      {/* ── DN Invoice Form ── */}
      {!savedInvoice && (
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

          {/* Receivable side */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-2">
            {/* Receivable rate per night */}
            <div className="flex items-center gap-2">
              <label className="w-40 font-semibold text-sm shrink-0">Rate/Night/Room ({receivableCurrency})</label>
              <input
                type="number"
                step="0.01"
                placeholder="Enter rate per night"
                className="border border-gray-400 px-2 py-0.5 text-sm bg-white flex-1"
                value={receivableRatePerNight}
                onChange={e => setReceivableRatePerNight(e.target.value)}
              />
            </div>
            {/* Payable rate per night */}
            <div className="flex items-center gap-2">
              <label className="w-40 font-semibold text-sm shrink-0">Rate/Night/Room ({payableCurrency})</label>
              <input
                type="number"
                step="0.01"
                placeholder="Enter rate per night"
                className="border border-gray-400 px-2 py-0.5 text-sm bg-white flex-1"
                value={payableRatePerNight}
                onChange={e => setPayableRatePerNight(e.target.value)}
              />
            </div>

            {/* Receivable breakdown display */}
            <div className="flex items-center gap-2">
              <label className="w-40 font-semibold text-xs text-muted-foreground shrink-0">↳ Breakdown</label>
              <span className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-0.5">
                {Number(receivableRatePerNight) > 0
                  ? `${receivableRatePerNight} × ${form.noOfNights || 0} nights × ${form.noOfRooms || 1} rooms = ${round2(Number(receivableRatePerNight) * Number(form.noOfNights || 0) * Number(form.noOfRooms || 1))} ${receivableCurrency}`
                  : "—"}
              </span>
            </div>
            {/* Payable breakdown display */}
            <div className="flex items-center gap-2">
              <label className="w-40 font-semibold text-xs text-muted-foreground shrink-0">↳ Breakdown</label>
              <span className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-0.5">
                {Number(payableRatePerNight) > 0
                  ? `${payableRatePerNight} × ${form.noOfNights || 0} nights × ${form.noOfRooms || 1} rooms = ${round2(Number(payableRatePerNight) * Number(form.noOfNights || 0) * Number(form.noOfRooms || 1))} ${payableCurrency}`
                  : "—"}
              </span>
            </div>

            {/* Receivable total (auto-computed, override allowed) + currency */}
            <div className="flex items-center gap-2">
              <label className="w-40 font-semibold text-sm shrink-0">Receivable Total</label>
              <div className="flex-1 flex gap-1">
                <select
                  className="border border-gray-400 px-1 py-0.5 text-sm bg-white w-20"
                  value={receivableCurrency}
                  onChange={e => onCurrencyChange("receivable", e.target.value)}
                >
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input
                  type="number"
                  step="0.01"
                  className="border border-gray-400 px-2 py-0.5 text-sm bg-yellow-50 flex-1"
                  value={form.receivableSar}
                  onChange={e => onAmountChange("receivable", e.target.value)}
                />
              </div>
            </div>
            {/* Payable total (auto-computed, override allowed) + currency */}
            <div className="flex items-center gap-2">
              <label className="w-40 font-semibold text-sm shrink-0">Payable Total</label>
              <div className="flex-1 flex gap-1">
                <select
                  className="border border-gray-400 px-1 py-0.5 text-sm bg-white w-20"
                  value={payableCurrency}
                  onChange={e => onCurrencyChange("payable", e.target.value)}
                >
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input
                  type="number"
                  step="0.01"
                  className="border border-gray-400 px-2 py-0.5 text-sm bg-yellow-50 flex-1"
                  value={form.payableSar}
                  onChange={e => onAmountChange("payable", e.target.value)}
                />
              </div>
            </div>

            {/* Receivable PKR equivalent */}
            <div className="flex items-center gap-2">
              <label className="w-40 font-semibold text-sm shrink-0 text-muted-foreground">↳ Equiv. in PKR (Rs)</label>
              <div className="flex-1 flex gap-1 items-center">
                <input
                  type="number"
                  step="0.01"
                  className="border border-gray-300 px-2 py-0.5 text-sm bg-yellow-50 flex-1"
                  value={form.receivablePkr}
                  onChange={e => onPkrChange("receivable", e.target.value)}
                  placeholder="auto"
                />
                {receivableRate && Number(receivableRate) > 0 && receivableCurrency !== "PKR" && (
                  <span className="text-xs text-amber-700 whitespace-nowrap">
                    @ {Number(receivableRate).toFixed(2)} Rs/{receivableCurrency}
                    <button
                      type="button"
                      className="ml-1 text-xs border border-amber-300 rounded px-1 bg-amber-50 hover:bg-amber-100"
                      onClick={() => {
                        const r = toPkrRate(receivableCurrency, liveRates);
                        if (r > 0) { onRateChange("receivable", round2(r)); }
                      }}
                    >live</button>
                  </span>
                )}
              </div>
            </div>
            {/* Payable PKR equivalent */}
            <div className="flex items-center gap-2">
              <label className="w-40 font-semibold text-sm shrink-0 text-muted-foreground">↳ Equiv. in PKR (Rs)</label>
              <div className="flex-1 flex gap-1 items-center">
                <input
                  type="number"
                  step="0.01"
                  className="border border-gray-300 px-2 py-0.5 text-sm bg-yellow-50 flex-1"
                  value={form.payablePkr}
                  onChange={e => onPkrChange("payable", e.target.value)}
                  placeholder="auto"
                />
                {payableRate && Number(payableRate) > 0 && payableCurrency !== "PKR" && (
                  <span className="text-xs text-amber-700 whitespace-nowrap">
                    @ {Number(payableRate).toFixed(2)} Rs/{payableCurrency}
                    <button
                      type="button"
                      className="ml-1 text-xs border border-amber-300 rounded px-1 bg-amber-50 hover:bg-amber-100"
                      onClick={() => {
                        const r = toPkrRate(payableCurrency, liveRates);
                        if (r > 0) { onRateChange("payable", round2(r)); }
                      }}
                    >live</button>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Profit preview */}
          {(form.receivablePkr || form.payablePkr) && (
            <div className="mt-2 flex gap-6 text-sm flex-wrap">
              <span className={`font-medium ${incomePkr >= 0 ? "text-green-700" : "text-red-600"}`}>
                PKR Profit/Loss: {incomePkr >= 0 ? "+" : ""}{incomePkr.toLocaleString(undefined, { maximumFractionDigits: 2 })} Rs
              </span>
              {receivableCurrency !== "PKR" && (
                <span className={`font-medium ${income >= 0 ? "text-green-700" : "text-red-600"}`}>
                  {receivableCurrency} Income: {income >= 0 ? "+" : ""}{income.toLocaleString(undefined, { maximumFractionDigits: 2 })} {receivableCurrency}
                </span>
              )}
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
                {STATUSES.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
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
      )}

      {/* ── Formal Invoice Print Area (hidden on screen, shown when body.print-formal) ── */}
      <div id="invoice-formal-print-area" style={{ display: "none", fontFamily: "Arial, sans-serif", fontSize: "12px", maxWidth: "720px", margin: "0 auto", position: "relative", border: "1px solid #ccc" }}>
        {/* Diagonal status stamp */}
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10, pointerEvents: "none", overflow: "hidden" }}>
          <span style={{
            fontSize: "56px", fontWeight: 900,
            color: form.status === "confirmed" ? "rgba(22,163,74,0.07)" : "rgba(245,158,11,0.09)",
            transform: "rotate(-35deg)", whiteSpace: "nowrap", letterSpacing: "4px", textTransform: "uppercase",
          }}>
            {form.status === "confirmed" ? "Definite Confirmation" : "Tentative Booking"}
          </span>
        </div>

        {/* Header */}
        <div style={{ borderBottom: "3px solid #1e3a5f", padding: "14px 24px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: "15px", fontWeight: "bold", color: "#1e3a5f", textTransform: "uppercase", letterSpacing: "1px" }}>{branding.companyName}</div>
            {branding.companyAddress && <div style={{ fontSize: "10px", color: "#555", marginTop: "2px" }}>{branding.companyAddress}</div>}
            {branding.companyPhone && <div style={{ fontSize: "10px", color: "#555" }}>{branding.companyPhone}</div>}
            {branding.companyEmail && <div style={{ fontSize: "10px", color: "#555" }}>{branding.companyEmail}</div>}
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "17px", fontWeight: "bold", color: "#1e3a5f", letterSpacing: "2px" }}>HOTEL INVOICE</div>
            <div style={{ fontSize: "11px", color: form.status === "confirmed" ? "#16a34a" : "#d97706", fontWeight: "bold", marginTop: "4px" }}>
              {form.status === "confirmed" ? "✔ Definite Confirmation" : "⚠ Tentative Booking"}
            </div>
          </div>
          <div style={{ width: "90px", display: "flex", justifyContent: "flex-end" }}>
            {(branding.printLogoUrl || branding.logoUrl) ? (
              <img src={branding.printLogoUrl || branding.logoUrl} alt="Logo" style={{ maxHeight: "48px", maxWidth: "80px", objectFit: "contain" }} />
            ) : (
              <div style={{ height: "44px", width: "80px", background: "#1e3a5f", borderRadius: "3px", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "8px", fontWeight: "bold", textAlign: "center", padding: "4px" }}>
                {branding.companyName}
              </div>
            )}
          </div>
        </div>

        {/* Address block */}
        <div style={{ padding: "10px 24px 6px", borderBottom: "1px solid #e5e7eb" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 16px", fontSize: "12px" }}>
            <div><strong>Date:</strong> {form.invoiceDate || "—"}</div>
            <div><strong>Ref:</strong> {savedInvoice?.dnNumber || dnNumber || "—"}</div>
            <div><strong>To:</strong> {savedInvoice?.partyName || partyName || "—"}</div>
            <div><strong>From:</strong> {branding.companyName}{branding.companyPhone ? ` | ${branding.companyPhone}` : ""}</div>
          </div>
        </div>

        {/* Opening */}
        <div style={{ padding: "8px 24px 4px", fontSize: "12px" }}>
          Dear Sir / Madam,<br />
          We are pleased to {form.status === "confirmed" ? "confirm" : "tentatively hold"} the following hotel reservation for your valued passengers:
        </div>

        {/* Hotel + Guest */}
        <div style={{ padding: "4px 24px 8px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 16px", fontSize: "12px" }}>
          <div><strong>Hotel:</strong> {form.hotelName || "—"}</div>
          <div><strong>Guest Name:</strong> {form.passengerName || "—"}</div>
        </div>

        {/* Booking table */}
        <div style={{ padding: "0 24px 10px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
            <thead>
              <tr style={{ background: "#1e3a5f", color: "white" }}>
                {["Pax","Qty","Room Type","Bed Type","View","Cnf.#","Check-In","Check-Out","Nights","Room Rate (SAR)"].map(h => (
                  <th key={h} style={{ padding: "4px 5px", textAlign: h === "Room Rate (SAR)" ? "right" : "center", border: "1px solid #1e3a5f", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: "5px", textAlign: "center", border: "1px solid #ddd" }}>{form.noOfPax || "—"}</td>
                <td style={{ padding: "5px", textAlign: "center", border: "1px solid #ddd" }}>{form.noOfRooms || "—"}</td>
                <td style={{ padding: "5px", textAlign: "center", border: "1px solid #ddd" }}>{form.roomType || "—"}</td>
                <td style={{ padding: "5px", textAlign: "center", border: "1px solid #ddd" }}>{form.bedType || "—"}</td>
                <td style={{ padding: "5px", textAlign: "center", border: "1px solid #ddd" }}>{form.hotelView || "—"}</td>
                <td style={{ padding: "5px", textAlign: "center", border: "1px solid #ddd" }}>{form.cnfNumber || "—"}</td>
                <td style={{ padding: "5px", textAlign: "center", border: "1px solid #ddd" }}>{form.checkIn || "—"}</td>
                <td style={{ padding: "5px", textAlign: "center", border: "1px solid #ddd" }}>{form.checkOut || "—"}</td>
                <td style={{ padding: "5px", textAlign: "center", border: "1px solid #ddd" }}>{form.noOfNights || "—"}</td>
                <td style={{ padding: "5px", textAlign: "right", border: "1px solid #ddd" }}>
                  {(() => {
                    const nights = Number(form.noOfNights) || 0;
                    const rooms  = Number(form.noOfRooms)  || 1;
                    const total  = Number(form.receivableSar) || 0;
                    const rate   = Number(receivableRatePerNight) || (nights > 0 && rooms > 0 && total > 0 ? total / (nights * rooms) : 0);
                    return rate > 0 ? rate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";
                  })()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div style={{ padding: "0 24px 8px", display: "flex", justifyContent: "flex-end" }}>
          <div style={{ fontSize: "12px", minWidth: "320px" }}>
            {(() => {
              const nights = Number(form.noOfNights) || 0;
              const rooms  = Number(form.noOfRooms)  || 1;
              const total  = Number(form.receivableSar) || 0;
              const rate   = Number(receivableRatePerNight) || (nights > 0 && rooms > 0 && total > 0 ? total / (nights * rooms) : 0);
              return (
                <>
                  {rate > 0 && nights > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderTop: "1px solid #e5e7eb", color: "#555", fontSize: "11px" }}>
                      <span>{rate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} × {nights} nights × {rooms} rooms</span>
                      <span>= {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderTop: "1px solid #e5e7eb" }}>
                    <span><strong>Net Accommodation Charges SAR:</strong></span>
                    <span>{total > 0 ? total.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "0.00"}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderTop: "2px solid #1e3a5f", marginTop: "2px" }}>
                    <span><strong>Balance SAR:</strong></span>
                    <span><strong>{total > 0 ? total.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "0.00"}</strong></span>
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        {/* Amount in words */}
        {Number(form.receivableSar) > 0 && (
          <div style={{ padding: "4px 24px 8px", fontSize: "11px", borderTop: "1px dashed #e5e7eb" }}>
            <strong>Amount in Words: </strong>
            <em>{sarToWords(Number(form.receivableSar))}</em>
          </div>
        )}

        {/* Remarks */}
        <div style={{ padding: "8px 24px", borderTop: "1px solid #e5e7eb" }}>
          <div style={{ fontWeight: "bold", fontSize: "11px", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "1px" }}>Remarks:</div>
          <ol style={{ fontSize: "10px", paddingLeft: "18px", margin: 0, lineHeight: 1.7 }}>
            <li><strong>Option Date: </strong>{form.optionDate ? `This booking is subject to option date ${form.optionDate}. Reservation will be released automatically if payment is not received before this date.` : "Reservation is subject to the option date; please arrange payment on time to avoid automatic release."}</li>
            <li><strong>Payment: </strong>Full payment is required prior to check-in unless a credit arrangement has been agreed in writing.</li>
            <li><strong>Amendment: </strong>Any changes to dates, room type, or guest details must be requested in writing and are subject to availability and applicable supplier fees.</li>
            <li><strong>Reservation: </strong>This document confirms the reservation only. The hotel has been notified of the guest's expected arrival.</li>
            <li><strong>Cancellation: </strong>Cancellation or no-show charges apply as per the hotel's policy. All cancellation requests must be submitted in writing.</li>
          </ol>
        </div>

        {/* Bank Details */}
        {(branding.bankName || branding.bankAccount || branding.bankIban) && (
          <div style={{ padding: "8px 24px", borderTop: "1px solid #e5e7eb", background: "#f9fafb" }}>
            <div style={{ fontWeight: "bold", fontSize: "11px", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "1px" }}>Bank Details:</div>
            <div style={{ fontSize: "11px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 16px" }}>
              {branding.bankName        && <div><strong>Bank Name:</strong> {branding.bankName}</div>}
              {(branding.bankAccountName || branding.companyName) && <div><strong>Account Name:</strong> {branding.bankAccountName || branding.companyName}</div>}
              {(branding.bankAccountNo || branding.bankAccount)   && <div><strong>Account No:</strong> {branding.bankAccountNo || branding.bankAccount}</div>}
              {branding.bankIban        && <div><strong>IBAN:</strong> {branding.bankIban}</div>}
              {branding.swiftCode       && <div><strong>Swift:</strong> {branding.swiftCode}</div>}
            </div>
          </div>
        )}

        {/* Signature / Footer */}
        <div style={{ padding: "14px 24px 12px", borderTop: "1px solid #e5e7eb" }}>
          <div style={{ fontSize: "11px", marginBottom: "28px" }}>Thanks &amp; Best Regards,</div>
          <div style={{ display: "inline-block", borderTop: "1px dashed #999", paddingTop: "4px", minWidth: "160px" }}>
            <div style={{ fontSize: "12px", fontWeight: "bold" }}>{salesmanName || branding.signatureName || "Reservation Officer"}</div>
            <div style={{ fontSize: "10px", color: "#666" }}>{branding.signatureTitle || "Reservation Officer"} — {branding.companyName}</div>
          </div>
        </div>
      </div>

      {/* ── Hotel Accommodation Voucher (hidden on screen, printed when .print-voucher) ── */}
      <div id="voucher-print-area" style={{ display: "none" }}>
        <div style={{ fontFamily: "Arial, sans-serif", fontSize: "13px", maxWidth: "700px", margin: "0 auto", border: "2px solid #1e3a5f", padding: "0" }}>
          {/* Header */}
          <div style={{ background: "#1e3a5f", color: "white", textAlign: "center", padding: "14px 10px 10px" }}>
            <div style={{ fontSize: "18px", fontWeight: "bold", letterSpacing: "2px" }}>{branding.companyName || COMPANY_NAME}</div>
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
            This voucher does not constitute a receipt of payment. &nbsp;|&nbsp; {branding.companyName || COMPANY_NAME} &nbsp;|&nbsp; {new Date().toLocaleDateString()}
          </div>
        </div>
      </div>

      {/* ── Print styles ── */}
      <style>{`
        /* Default: print the invoice form */
        @media print {
          body > * { visibility: hidden; }
          .print\\:hidden { display: none !important; }
          #invoice-print-area,
          #invoice-print-area * { visibility: visible; }
          #invoice-print-area { position: fixed; left: 0; top: 0; width: 100%; }
          #voucher-print-area { display: none !important; }
          #invoice-formal-print-area { display: none !important; }
        }

        /* body.print-voucher: print only the accommodation voucher */
        body.print-voucher #invoice-print-area { display: none !important; }
        @media print {
          body.print-voucher #invoice-print-area { display: none !important; }
          body.print-voucher #invoice-formal-print-area { display: none !important; }
          body.print-voucher #voucher-print-area {
            display: block !important;
            visibility: visible !important;
            position: fixed;
            left: 0; top: 0;
            width: 100%;
          }
          body.print-voucher #voucher-print-area * { visibility: visible !important; }
        }

        /* body.print-formal: print only the formal hotel invoice */
        body.print-formal #invoice-print-area { display: none !important; }
        @media print {
          body.print-formal #invoice-print-area { display: none !important; }
          body.print-formal #voucher-print-area { display: none !important; }
          body.print-formal #invoice-formal-print-area {
            display: block !important;
            visibility: visible !important;
            position: fixed;
            left: 0; top: 0;
            width: 100%;
          }
          body.print-formal #invoice-formal-print-area * { visibility: visible !important; }
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

function ROSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-center py-1.5 border-y border-blue-700 bg-blue-800 font-semibold tracking-widest text-sm text-white">
        {title.split("").join(" ")}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 px-4 py-2 bg-slate-50">
        {children}
      </div>
    </div>
  );
}

function RORow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex items-start gap-2 py-0.5">
      <span className="w-36 text-sm font-semibold text-gray-500 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 font-medium">{value || "—"}</span>
    </div>
  );
}
