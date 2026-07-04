import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePortalAuth } from "@/lib/portal-auth";
import { PortalLayout, PrintHeader } from "@/components/portal-layout";
import { Hotel, Printer } from "lucide-react";

interface HotelVoucher {
  id: number; dnNumber: string; invoiceDate: string; passengerName: string | null;
  nationality: string | null; noOfPax: number; noOfRooms: number; noOfNights: number | null;
  hotelName: string | null; hotelView: string | null; roomType: string | null; bedType: string | null;
  checkIn: string | null; checkOut: string | null; cnfNumber: string | null; reference: string | null;
  roomNumber: string | null; remarks: string | null; receivableSar: string | null; receivablePkr: string | null;
  status: string;
}

interface WebsiteConfig { company_name?: string; company_logo_url?: string; company_tagline?: string; }

function VoucherPrint({ v, config, onClose }: { v: HotelVoucher; config?: WebsiteConfig; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-white z-50 overflow-y-auto p-8">
      <div className="max-w-2xl mx-auto">
        <div className="print:hidden flex justify-between items-center mb-6">
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700">← Back</button>
          <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium">
            <Printer className="h-4 w-4" /> Print
          </button>
        </div>

        <PrintHeader config={config} />

        <div className="text-center mb-8">
          <h2 className="text-xl font-bold text-gray-800">HOTEL VOUCHER</h2>
          <p className="text-gray-500 text-sm">Confirmation Copy</p>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          <div className="space-y-3 text-sm">
            <div><p className="text-gray-500 text-xs font-semibold uppercase">DN Number</p><p className="font-bold text-lg">{v.dnNumber}</p></div>
            {v.cnfNumber && <div><p className="text-gray-500 text-xs font-semibold uppercase">CNF / Confirmation #</p><p className="font-bold text-blue-700">{v.cnfNumber}</p></div>}
            {v.reference && <div><p className="text-gray-500 text-xs font-semibold uppercase">Reference</p><p className="font-medium">{v.reference}</p></div>}
            <div><p className="text-gray-500 text-xs font-semibold uppercase">Invoice Date</p><p className="font-medium">{v.invoiceDate}</p></div>
          </div>
          <div className="space-y-3 text-sm">
            {v.passengerName && <div><p className="text-gray-500 text-xs font-semibold uppercase">Guest Name</p><p className="font-bold">{v.passengerName}</p></div>}
            {v.nationality && <div><p className="text-gray-500 text-xs font-semibold uppercase">Nationality</p><p className="font-medium">{v.nationality}</p></div>}
            <div><p className="text-gray-500 text-xs font-semibold uppercase">Pax / Rooms</p><p className="font-medium">{v.noOfPax} pax / {v.noOfRooms} room(s)</p></div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-xl p-5 mb-6 text-sm">
          <h3 className="font-bold text-gray-800 mb-3">{v.hotelName ?? "Hotel Details"}</h3>
          <div className="grid grid-cols-2 gap-3">
            {v.checkIn && <div><p className="text-gray-500 text-xs">Check-In</p><p className="font-semibold">{v.checkIn}</p></div>}
            {v.checkOut && <div><p className="text-gray-500 text-xs">Check-Out</p><p className="font-semibold">{v.checkOut}</p></div>}
            {v.noOfNights && <div><p className="text-gray-500 text-xs">Nights</p><p className="font-semibold">{v.noOfNights}</p></div>}
            {v.roomType && <div><p className="text-gray-500 text-xs">Room Type</p><p className="font-semibold">{v.roomType}</p></div>}
            {v.bedType && <div><p className="text-gray-500 text-xs">Bed Type</p><p className="font-semibold">{v.bedType}</p></div>}
            {v.hotelView && <div><p className="text-gray-500 text-xs">View</p><p className="font-semibold">{v.hotelView}</p></div>}
            {v.roomNumber && <div><p className="text-gray-500 text-xs">Room Number</p><p className="font-semibold">{v.roomNumber}</p></div>}
          </div>
          {v.remarks && <p className="mt-3 text-gray-600 text-xs">{v.remarks}</p>}
        </div>

        {(v.receivableSar || v.receivablePkr) && (
          <div className="border-t border-gray-200 pt-4 text-sm space-y-1">
            {v.receivableSar && <div className="flex justify-between"><span className="text-gray-500">Amount (SAR)</span><span className="font-semibold">SAR {Number(v.receivableSar).toLocaleString()}</span></div>}
            {v.receivablePkr && <div className="flex justify-between"><span className="text-gray-500">Amount (PKR)</span><span className="font-semibold">PKR {Number(v.receivablePkr).toLocaleString()}</span></div>}
          </div>
        )}

        <div className="mt-8 text-xs text-gray-400 text-center border-t border-gray-200 pt-4">
          {config?.company_name} · This is a computer-generated voucher
        </div>
      </div>
    </div>
  );
}

export default function PortalHotelVouchersPage() {
  const { token } = usePortalAuth();
  const [printing, setPrinting] = useState<HotelVoucher | null>(null);

  const { data: configData } = useQuery<WebsiteConfig>({
    queryKey: ["website-config-public"],
    queryFn: () => fetch("/api/website-config").then((r) => r.json()),
    staleTime: 5 * 60_000,
  });

  const { data, isLoading } = useQuery<{ vouchers: HotelVoucher[] }>({
    queryKey: ["portal-hotel-vouchers"],
    queryFn: () => fetch("/api/portal/hotel-vouchers", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    enabled: !!token,
  });

  if (printing) return <VoucherPrint v={printing} config={configData} onClose={() => setPrinting(null)} />;

  return (
    <PortalLayout>
      <div className="space-y-4 max-w-4xl">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Hotel Vouchers</h1>
          <p className="text-sm text-gray-500">Your hotel booking confirmations</p>
        </div>

        {isLoading && <div className="text-center py-10 text-gray-400 text-sm">Loading…</div>}

        {!isLoading && !data?.vouchers.length && (
          <div className="text-center py-12 text-gray-400">
            <Hotel className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="font-medium">No hotel vouchers</p>
            <p className="text-sm mt-1">Vouchers appear once your ERP account is linked</p>
          </div>
        )}

        <div className="grid gap-3">
          {data?.vouchers.map((v) => (
            <div key={v.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-gray-900">{v.hotelName ?? "Hotel Booking"}</p>
                    {v.cnfNumber && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">CNF: {v.cnfNumber}</span>}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${v.status === "confirmed" ? "bg-teal-50 text-teal-700" : "bg-gray-100 text-gray-500"}`}>{v.status}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">DN: {v.dnNumber} · {v.noOfPax} pax · {v.noOfRooms} room(s)</p>
                  <div className="flex gap-4 mt-1 text-xs text-gray-500">
                    {v.checkIn && <span>In: {v.checkIn}</span>}
                    {v.checkOut && <span>Out: {v.checkOut}</span>}
                    {v.noOfNights && <span>{v.noOfNights} nights</span>}
                    {v.roomType && <span>{v.roomType}</span>}
                  </div>
                </div>
                <button onClick={() => setPrinting(v)} className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50">
                  <Printer className="h-3.5 w-3.5" /> Print
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </PortalLayout>
  );
}
