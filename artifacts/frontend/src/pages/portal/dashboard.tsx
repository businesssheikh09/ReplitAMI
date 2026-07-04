import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { usePortalAuth } from "@/lib/portal-auth";
import { PortalLayout } from "@/components/portal-layout";
import {
  Calendar, FileText, Plane, CreditCard, AlertCircle, CheckCircle2,
  Clock, ArrowRight, Info,
} from "lucide-react";

interface DashboardData {
  openInquiries: number;
  pendingPayments: number;
  invoiceCount: number;
  outstandingBalance: string;
  nextFlight: null | { origin: string; destination: string; departureDate: string; airline: string | null; pnr: string | null };
  activity: Array<{ type: string; label: string; date: string }>;
  hasClientLink: boolean;
}

function StatCard({ icon: Icon, label, value, href, color }: {
  icon: React.ElementType; label: string; value: string | number; href: string; color: string;
}) {
  return (
    <Link href={href}>
      <div className={`rounded-xl p-4 text-white cursor-pointer hover:opacity-90 transition-opacity ${color}`}>
        <div className="flex items-center justify-between">
          <Icon className="h-5 w-5 opacity-80" />
          <ArrowRight className="h-4 w-4 opacity-60" />
        </div>
        <div className="mt-3 text-2xl font-bold">{value}</div>
        <div className="text-sm opacity-80 mt-0.5">{label}</div>
      </div>
    </Link>
  );
}

export default function PortalDashboardPage() {
  const { token, user } = usePortalAuth();

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["portal-dashboard"],
    queryFn: () =>
      fetch("/api/portal/dashboard", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    enabled: !!token,
    refetchInterval: 60_000,
  });

  return (
    <PortalLayout>
      <div className="space-y-5 max-w-5xl">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Welcome back, {user?.fullName?.split(" ")[0]} 👋</h1>
          <p className="text-sm text-gray-500 mt-0.5">Here's an overview of your account.</p>
        </div>

        {!data?.hasClientLink && !isLoading && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <p>Your account hasn't been linked to your ERP record yet. Some sections (invoices, hotel vouchers, flights, visa, transport) will show data once our team completes the setup.</p>
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-xl bg-gray-200 animate-pulse" />)}
          </div>
        ) : data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={Calendar} label="Open Bookings" value={data.openInquiries} href="/portal/bookings" color="bg-teal-600" />
            <StatCard icon={CreditCard} label="Pending Payments" value={data.pendingPayments} href="/portal/payments" color="bg-amber-500" />
            <StatCard icon={FileText} label="Invoices" value={data.invoiceCount} href="/portal/invoices" color="bg-blue-600" />
            <StatCard icon={Plane} label="Outstanding" value={`PKR ${Number(data.outstandingBalance).toLocaleString()}`} href="/portal/statement" color="bg-violet-600" />
          </div>
        )}

        {data?.nextFlight && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-widest mb-2">Upcoming Flight</p>
            <div className="flex items-center gap-3">
              <Plane className="h-5 w-5 text-blue-600" />
              <div>
                <p className="font-semibold text-blue-900">{data.nextFlight.origin} → {data.nextFlight.destination}</p>
                <p className="text-sm text-blue-700">
                  {new Date(data.nextFlight.departureDate).toLocaleDateString("en-PK", { weekday: "short", day: "numeric", month: "short" })}
                  {data.nextFlight.airline && ` · ${data.nextFlight.airline}`}
                  {data.nextFlight.pnr && ` · PNR: ${data.nextFlight.pnr}`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Recent Activity */}
        {data?.activity && data.activity.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Recent Activity</h2>
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              {data.activity.map((item, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  {item.type === "payment" ? (
                    <CreditCard className="h-4 w-4 text-amber-500 shrink-0" />
                  ) : (
                    <Calendar className="h-4 w-4 text-teal-500 shrink-0" />
                  )}
                  <span className="text-sm flex-1">{item.label}</span>
                  <span className="text-xs text-gray-400">
                    {new Date(item.date).toLocaleDateString("en-PK", { day: "numeric", month: "short" })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
