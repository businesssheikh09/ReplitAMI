import { useQuery } from "@tanstack/react-query";
import { usePortalAuth } from "@/lib/portal-auth";
import { PortalLayout } from "@/components/portal-layout";
import { Car } from "lucide-react";

interface TransportBooking {
  id: number; type: string; vehicleType: string; pickupLocation: string; dropoffLocation: string;
  date: string; passengers: number; driverName: string | null; driverPhone: string | null;
  status: string; amount: string; currency: string; notes: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  pending:   "bg-amber-50 text-amber-700",
  confirmed: "bg-teal-50 text-teal-700",
  completed: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-50 text-red-700",
};

export default function PortalTransportPage() {
  const { token } = usePortalAuth();

  const { data, isLoading } = useQuery<{ bookings: TransportBooking[] }>({
    queryKey: ["portal-transport"],
    queryFn: () => fetch("/api/portal/transport", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    enabled: !!token,
  });

  return (
    <PortalLayout>
      <div className="space-y-4 max-w-3xl">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Transport</h1>
          <p className="text-sm text-gray-500">Scheduled pickups and transfers</p>
        </div>

        {isLoading && <div className="text-center py-10 text-gray-400 text-sm">Loading…</div>}

        {!isLoading && !data?.bookings.length && (
          <div className="text-center py-12 text-gray-400">
            <Car className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="font-medium">No transport bookings</p>
            <p className="text-sm mt-1">Bookings appear once your ERP account is linked</p>
          </div>
        )}

        <div className="space-y-3">
          {data?.bookings.map((b) => (
            <div key={b.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 capitalize">{b.type.replace(/_/g, " ")}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[b.status] ?? "bg-gray-100 text-gray-600"}`}>{b.status}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-0.5">
                    {b.pickupLocation} → {b.dropoffLocation}
                  </p>
                  <div className="flex gap-3 mt-1 text-xs text-gray-500">
                    <span>{new Date(b.date).toLocaleString("en-PK", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                    <span>{b.vehicleType}</span>
                    <span>{b.passengers} pax</span>
                  </div>
                  {(b.driverName || b.driverPhone) && (
                    <div className="mt-2 flex gap-3 text-xs text-gray-500">
                      <span className="font-medium text-gray-700">Driver:</span>
                      {b.driverName && <span>{b.driverName}</span>}
                      {b.driverPhone && <a href={`tel:${b.driverPhone}`} className="text-teal-600 hover:underline">{b.driverPhone}</a>}
                    </div>
                  )}
                  {b.notes && <p className="mt-1 text-xs text-gray-400">{b.notes}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-gray-700">{b.currency} {Number(b.amount).toLocaleString()}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </PortalLayout>
  );
}
