import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePortalAuth } from "@/lib/portal-auth";
import { PortalLayout, PrintHeader } from "@/components/portal-layout";
import { Plane, Printer } from "lucide-react";

interface Ticket {
  id: number; origin: string; destination: string; departureDate: string; returnDate: string | null;
  tripType: string; passengers: number; cabinClass: string; airline: string | null;
  flightNumber: string | null; pnr: string | null; ticketNumber: string | null;
  amount: string; currency: string; issuedAt: string | null; issuedByName: string | null;
  legs: string | null; status: string;
}

interface WebsiteConfig { company_name?: string; company_logo_url?: string; company_tagline?: string; }

function TicketPrint({ t, config, onClose }: { t: Ticket; config?: WebsiteConfig; onClose: () => void }) {
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
          <h2 className="text-xl font-bold text-gray-800">E-TICKET ITINERARY</h2>
          {t.pnr && <p className="text-gray-500">PNR: <span className="font-bold text-gray-800 text-lg tracking-widest">{t.pnr}</span></p>}
        </div>

        <div className="bg-blue-50 rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between">
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-900">{t.origin}</p>
              <p className="text-sm text-gray-500 mt-1">{new Date(t.departureDate).toLocaleDateString("en-PK", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</p>
            </div>
            <div className="flex flex-col items-center px-4">
              <Plane className="h-5 w-5 text-blue-500" />
              <div className="h-px bg-blue-300 w-24 mt-1" />
              <p className="text-xs text-gray-500 mt-1">{t.tripType.replace("_", " ")}</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-900">{t.destination}</p>
              {t.returnDate && <p className="text-sm text-gray-500 mt-1">Return: {new Date(t.returnDate).toLocaleDateString("en-PK", { day: "numeric", month: "short" })}</p>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6 text-sm">
          {t.airline && <div><p className="text-gray-500 text-xs font-semibold uppercase">Airline</p><p className="font-semibold">{t.airline}</p></div>}
          {t.flightNumber && <div><p className="text-gray-500 text-xs font-semibold uppercase">Flight #</p><p className="font-semibold">{t.flightNumber}</p></div>}
          {t.ticketNumber && <div><p className="text-gray-500 text-xs font-semibold uppercase">Ticket #</p><p className="font-semibold font-mono">{t.ticketNumber}</p></div>}
          <div><p className="text-gray-500 text-xs font-semibold uppercase">Class</p><p className="font-semibold capitalize">{t.cabinClass}</p></div>
          <div><p className="text-gray-500 text-xs font-semibold uppercase">Passengers</p><p className="font-semibold">{t.passengers}</p></div>
          {t.issuedAt && <div><p className="text-gray-500 text-xs font-semibold uppercase">Issued On</p><p className="font-semibold">{new Date(t.issuedAt).toLocaleDateString("en-PK")}</p></div>}
          {t.issuedByName && <div><p className="text-gray-500 text-xs font-semibold uppercase">Issued By</p><p className="font-semibold">{t.issuedByName}</p></div>}
          <div><p className="text-gray-500 text-xs font-semibold uppercase">Fare</p><p className="font-bold">{t.currency} {Number(t.amount).toLocaleString()}</p></div>
        </div>

        <div className="mt-8 text-xs text-gray-400 text-center border-t border-gray-200 pt-4">
          {config?.company_name} · E-Ticket Copy · Not valid as boarding pass
        </div>
      </div>
    </div>
  );
}

export default function PortalFlightTicketsPage() {
  const { token } = usePortalAuth();
  const [printing, setPrinting] = useState<Ticket | null>(null);

  const { data: configData } = useQuery<WebsiteConfig>({
    queryKey: ["website-config-public"],
    queryFn: () => fetch("/api/website-config").then((r) => r.json()),
    staleTime: 5 * 60_000,
  });

  const { data, isLoading } = useQuery<{ tickets: Ticket[] }>({
    queryKey: ["portal-flight-tickets"],
    queryFn: () => fetch("/api/portal/flight-tickets", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    enabled: !!token,
  });

  if (printing) return <TicketPrint t={printing} config={configData} onClose={() => setPrinting(null)} />;

  return (
    <PortalLayout>
      <div className="space-y-4 max-w-4xl">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Flight Tickets</h1>
          <p className="text-sm text-gray-500">Your issued flight tickets</p>
        </div>

        {isLoading && <div className="text-center py-10 text-gray-400 text-sm">Loading…</div>}

        {!isLoading && !data?.tickets.length && (
          <div className="text-center py-12 text-gray-400">
            <Plane className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="font-medium">No issued tickets</p>
            <p className="text-sm mt-1">Tickets appear once your ERP account is linked</p>
          </div>
        )}

        <div className="grid gap-3">
          {data?.tickets.map((t) => (
            <div key={t.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-gray-900">{t.origin} → {t.destination}</span>
                    {t.pnr && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-mono font-medium">PNR: {t.pnr}</span>}
                  </div>
                  <div className="flex gap-4 mt-1 text-xs text-gray-500">
                    <span>{new Date(t.departureDate).toLocaleDateString("en-PK", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span>
                    {t.airline && <span>{t.airline}</span>}
                    {t.flightNumber && <span>{t.flightNumber}</span>}
                    <span className="capitalize">{t.cabinClass}</span>
                    <span>{t.passengers} pax</span>
                  </div>
                  {t.ticketNumber && <p className="text-xs text-gray-400 mt-0.5 font-mono">Ticket: {t.ticketNumber}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-semibold text-gray-700">{t.currency} {Number(t.amount).toLocaleString()}</span>
                  <button onClick={() => setPrinting(t)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50">
                    <Printer className="h-3.5 w-3.5" /> Print
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </PortalLayout>
  );
}
