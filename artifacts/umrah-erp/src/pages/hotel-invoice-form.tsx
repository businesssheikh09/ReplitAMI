import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useListClients, useListUsers, useListHotels, useListVendors } from "@workspace/api-client-react";
import { ArrowLeft, Printer } from "lucide-react";

const today = () => new Date().toISOString().slice(0, 10);
const NONE = "__none__";

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

export default function HotelInvoiceFormPage() {
  const params = useParams<{ id?: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isEdit = !!params.id;

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [dnNumber, setDnNumber] = useState<string>("");

  // ── Lookup data ────────────────────────────────────────────────────────────
  const { data: clients = [] }  = useListClients({});
  const { data: vendors = [] }  = useListVendors({});
  const { data: hotels  = [] }  = useListHotels({});
  const { data: users   = [] }  = useListUsers({});

  // ── Next DN number (new only) ─────────────────────────────────────────────
  const { data: nextDn } = useQuery({
    queryKey: ["/api/invoices/hotel/next-dn"],
    queryFn: () => fetch("/api/invoices/hotel/next-dn").then(r => r.json()),
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
    queryFn: () => fetch(`/api/invoices/hotel/${params.id}`).then(r => r.json()),
    enabled: isEdit,
  });
  useEffect(() => {
    if (existing && isEdit) {
      setDnNumber(existing.dnNumber);
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
        receivableSar: existing.receivableSar != null ? String(existing.receivableSar) : "",
        payableSar: existing.payableSar != null ? String(existing.payableSar) : "",
        receivablePkr: existing.receivablePkr != null ? String(existing.receivablePkr) : "",
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
  const sel = (k: keyof FormState) => (v: string) =>
    setForm(p => ({ ...p, [k]: v === NONE ? "" : v }));

  // ── Mutations ──────────────────────────────────────────────────────────────
  const save = useMutation({
    mutationFn: async (data: object) => {
      const url  = isEdit ? `/api/invoices/hotel/${params.id}` : "/api/invoices/hotel";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["/api/invoices/hotel"] });
      toast({ title: isEdit ? "Invoice updated" : "Invoice saved", description: `${result.dnNumber} saved successfully` });
      setLocation("/accounting/invoices");
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleAccept = () => {
    if (!form.invoiceDate) { toast({ title: "Invoice date required", variant: "destructive" }); return; }
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
      payableSar: form.payableSar !== "" ? Number(form.payableSar) : null,
      receivablePkr: form.receivablePkr !== "" ? Number(form.receivablePkr) : null,
      payablePkr: form.payablePkr !== "" ? Number(form.payablePkr) : null,
    };
    save.mutate(payload);
  };

  const handleClear = () => {
    setForm({ ...EMPTY_FORM, reference: dnNumber.replace("DN-", "") });
  };

  const income = (Number(form.receivableSar) || 0) - (Number(form.payableSar) || 0);
  const incomePkr = (Number(form.receivablePkr) || 0) - (Number(form.payablePkr) || 0);

  return (
    <div className="space-y-0 max-w-4xl mx-auto">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 print:hidden">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/accounting/invoices")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" /> Print
        </Button>
      </div>

      {/* DN Invoice Form */}
      <div className="border border-gray-400 bg-white print:border-black" style={{ fontFamily: "Arial, sans-serif", fontSize: "13px" }}>

        {/* Title */}
        <div className="text-center py-2 border-b border-gray-400 bg-[#d4e4a4]">
          <span className="text-xl font-bold tracking-widest">DN &nbsp; I N V O I C E - ( Hotel Entry ) {isEdit ? "EDIT" : "NEW"}</span>
        </div>

        {/* Header row: date + DN number */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-300 bg-[#f5f0d8]">
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
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 px-4 py-2 bg-[#f5f0d8]">
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
        <div className="px-4 py-2 bg-[#f5f0d8] space-y-1.5">
          {/* Type */}
          <div className="flex items-center gap-2">
            <label className="w-28 font-semibold text-sm">Type</label>
            <select className="border border-gray-400 px-1 py-0.5 text-sm bg-white w-36" value={form.voucherType} onChange={e => setForm(p => ({ ...p, voucherType: e.target.value }))}>
              <option value=""></option>
              {VOUCHER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {/* Option Date */}
          <div className="flex items-center gap-2">
            <label className="w-28 font-semibold text-sm">Option Date</label>
            <input type="date" className="border border-gray-400 px-2 py-0.5 text-sm bg-white" value={form.optionDate} onChange={f("optionDate")} />
          </div>
          {/* Hotel + View + Room Type */}
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
          {/* Hotel name override */}
          <div className="flex items-center gap-2">
            <label className="w-28 font-semibold text-sm text-xs text-muted-foreground">Hotel (free text)</label>
            <input type="text" className="border border-gray-400 px-2 py-0.5 text-sm bg-white flex-1" placeholder="Override or enter custom hotel name" value={form.hotelName} onChange={f("hotelName")} />
          </div>
          {/* Check In / Out / Nights */}
          <div className="flex items-center gap-4 flex-wrap">
            <label className="w-28 font-semibold text-sm">Check In</label>
            <input type="date" className="border border-gray-400 px-2 py-0.5 text-sm bg-white" value={form.checkIn} onChange={f("checkIn")} />
            <label className="font-semibold text-sm">Check Out</label>
            <input type="date" className="border border-gray-400 px-2 py-0.5 text-sm bg-white" value={form.checkOut} onChange={f("checkOut")} />
            <label className="font-semibold text-sm ml-4">No. Of Nights</label>
            <input type="number" className="border border-gray-400 px-2 py-0.5 text-sm bg-white w-16 bg-yellow-50" readOnly value={form.noOfNights} />
          </div>
          {/* Reference + Rooms */}
          <div className="flex items-center gap-4 flex-wrap">
            <label className="w-28 font-semibold text-sm">Reference</label>
            <input type="text" className="border border-gray-400 px-2 py-0.5 text-sm bg-white w-64" value={form.reference} onChange={f("reference")} />
            <label className="font-semibold text-sm ml-8">No. of Rooms</label>
            <input type="number" min="1" className="border border-gray-400 px-2 py-0.5 text-sm bg-white w-16" value={form.noOfRooms} onChange={f("noOfRooms")} />
          </div>
          {/* CNF# */}
          <div className="flex items-center gap-2">
            <label className="w-28 font-semibold text-sm">CNF#</label>
            <input type="text" className="border border-gray-400 px-2 py-0.5 text-sm bg-white w-64" value={form.cnfNumber} onChange={f("cnfNumber")} />
          </div>
          {/* Room No */}
          <div className="flex items-center gap-2">
            <label className="w-28 font-semibold text-sm">Room No.</label>
            <input type="text" className="border border-gray-400 px-2 py-0.5 text-sm bg-white flex-1" value={form.roomNumber} onChange={f("roomNumber")} />
          </div>
          {/* Remarks */}
          <div className="flex items-center gap-2">
            <label className="w-28 font-semibold text-sm">Remarks</label>
            <input type="text" className="border border-gray-400 px-2 py-0.5 text-sm bg-white flex-1" value={form.remarks} onChange={f("remarks")} />
          </div>
          {/* Person/Contact */}
          <div className="flex items-center gap-2">
            <label className="w-28 font-semibold text-sm">Person/Contact No.</label>
            <input type="text" className="border border-gray-400 px-2 py-0.5 text-sm bg-white flex-1" value={form.contactNumber} onChange={f("contactNumber")} />
          </div>
        </div>

        {/* ── Calculation ── */}
        <SectionHeader title="Calculation (Per Night Per Room Rate)" />
        <div className="px-4 py-2 bg-[#f5f0d8] space-y-1.5">
          <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
            <FormRow label="Receivable Amount (SAR)">
              <input type="number" step="0.01" className="border border-gray-400 px-2 py-0.5 text-sm bg-white w-full" value={form.receivableSar} onChange={f("receivableSar")} />
            </FormRow>
            <FormRow label="Payable Amount (SAR)">
              <input type="number" step="0.01" className="border border-gray-400 px-2 py-0.5 text-sm bg-white w-full" value={form.payableSar} onChange={f("payableSar")} />
            </FormRow>
            <FormRow label="Receivable Amount (Rs)">
              <input type="number" step="0.01" className="border border-gray-400 px-2 py-0.5 text-sm bg-white w-full" value={form.receivablePkr} onChange={f("receivablePkr")} />
            </FormRow>
            <FormRow label="Payable Amount (Rs)">
              <input type="number" step="0.01" className="border border-gray-400 px-2 py-0.5 text-sm bg-white w-full" value={form.payablePkr} onChange={f("payablePkr")} />
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
        <div className="flex justify-center gap-4 py-4 border-t border-gray-300 bg-[#f5f0d8] print:hidden">
          <Button
            className="bg-green-700 hover:bg-green-800 text-white px-10 py-2 text-base font-semibold"
            onClick={handleAccept}
            disabled={save.isPending}
          >
            Accept
          </Button>
          <Button
            variant="destructive"
            className="px-10 py-2 text-base font-semibold"
            onClick={handleClear}
          >
            Clear
          </Button>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print\\:hidden { display: none !important; }
          .max-w-4xl, .max-w-4xl * { visibility: visible; }
          .max-w-4xl { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="text-center py-1 border-y border-gray-300 bg-[#b8d4e4] font-semibold tracking-widest text-sm">
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
