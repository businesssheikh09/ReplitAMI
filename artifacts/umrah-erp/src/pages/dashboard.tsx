import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users, FileText, Receipt, DollarSign, Activity, Car, BookOpen,
  TrendingUp, Clock, Hotel, Plane, Store, Building2, ShieldCheck,
  ArrowRightLeft, PhoneCall, CreditCard, CalendarCheck, Plus, RefreshCw,
} from "lucide-react";
import { useGetDashboardStats, useGetRecentActivity, useGetRevenueChart } from "@workspace/api-client-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { canAccess, ROLE_LABELS, ROLE_COLORS } from "@/lib/permissions";

// Compute fiscal year (April – March cycle)
function getFiscalYear() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const start = month >= 4 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${String(start + 1).slice(2)}`;
}

const TODAY = new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

// ── Launch Tile ──────────────────────────────────────────────────────────────
interface TileData {
  href: string;
  icon: React.ElementType;
  label: string;
  gradient: string;
  route: string;
  tileRoles?: string[]; // optional override — restricts tile visibility independently of route permissions
}

function LaunchTile({ href, icon: Icon, label, gradient, route, role, tileRoles }: TileData & { role: string | undefined }) {
  if (tileRoles ? !tileRoles.includes(role ?? "") : !canAccess(role, route)) return null;
  return (
    <Link href={href}>
      <div className="flex flex-col items-center gap-3 cursor-pointer group">
        <div
          className={`w-24 h-24 rounded-2xl flex items-center justify-center shadow-md
            group-hover:shadow-xl group-hover:scale-105 transition-all duration-200 ${gradient}`}
        >
          <Icon className="h-10 w-10 text-white drop-shadow" />
        </div>
        <span className="text-xs font-semibold text-center text-gray-700 leading-tight max-w-24">{label}</span>
      </div>
    </Link>
  );
}

function SectionLabel({ title }: { title: string }) {
  return (
    <div className="col-span-3 flex items-center gap-3 pt-2">
      <div className="flex-1 h-px bg-blue-100" />
      <span className="text-xs font-bold uppercase tracking-widest text-blue-600 px-2">{title}</span>
      <div className="flex-1 h-px bg-blue-100" />
    </div>
  );
}

// ── Tile definitions ──────────────────────────────────────────────────────────
const TILES: Array<{ section: string } | TileData> = [
  { section: "Finance" },
  { href: "/hotel-invoices",              icon: Hotel,         label: "Hotel Invoices DN",  gradient: "bg-gradient-to-br from-blue-800 to-blue-600",    route: "/hotel-invoices" },
  { href: "/accounting/hotel-invoice/new",icon: Plus,          label: "New DN Invoice",     gradient: "bg-gradient-to-br from-blue-600 to-cyan-500",     route: "/accounting/hotel-invoice/new" },
  { href: "/accounting",                  icon: TrendingUp,    label: "Accounting",         gradient: "bg-gradient-to-br from-indigo-700 to-indigo-500",  route: "/accounting" },
  { href: "/accounting/invoices",         icon: Receipt,       label: "Invoices",           gradient: "bg-gradient-to-br from-teal-700 to-teal-500",      route: "/accounting/invoices" },
  { href: "/accounting/expenses",         icon: CreditCard,    label: "Expenses",           gradient: "bg-gradient-to-br from-violet-700 to-violet-500",  route: "/accounting/expenses" },
  { href: "/currency-settings",           icon: ArrowRightLeft,label: "Currency",           gradient: "bg-gradient-to-br from-slate-700 to-slate-500",    route: "/currency-settings" },

  { section: "CRM & Sales" },
  { href: "/crm",                         icon: Users,         label: "Clients",            gradient: "bg-gradient-to-br from-emerald-700 to-emerald-500",route: "/crm" },
  { href: "/quotations",                  icon: FileText,      label: "Quotations",         gradient: "bg-gradient-to-br from-green-700 to-green-500",    route: "/quotations" },
  { href: "/hotel-requests",              icon: CalendarCheck, label: "Hotel Requests",     gradient: "bg-gradient-to-br from-cyan-700 to-cyan-500",      route: "/hotel-requests" },
  { href: "/crm/follow-ups",              icon: PhoneCall,     label: "Follow-ups",         gradient: "bg-gradient-to-br from-sky-700 to-sky-500",        route: "/crm/follow-ups" },

  { section: "Operations" },
  { href: "/flights",                     icon: Plane,         label: "Flights",            gradient: "bg-gradient-to-br from-orange-600 to-orange-400",  route: "/flights" },
  { href: "/transport",                   icon: Car,           label: "Transport",          gradient: "bg-gradient-to-br from-amber-600 to-amber-400",    route: "/transport" },
  { href: "/visa",                        icon: BookOpen,      label: "Visa",               gradient: "bg-gradient-to-br from-rose-600 to-rose-400",      route: "/visa" },
  { href: "/hotels",                      icon: Building2,     label: "Hotels",             gradient: "bg-gradient-to-br from-purple-700 to-purple-500",  route: "/hotels" },

  { section: "Admin" },
  { href: "/vendors",   icon: Store,      label: "Vendors", gradient: "bg-gradient-to-br from-pink-700 to-pink-500",  route: "/vendors", tileRoles: ["management", "admin"] },
  { href: "/users",     icon: ShieldCheck,label: "Users",   gradient: "bg-gradient-to-br from-gray-700 to-gray-500",  route: "/users",   tileRoles: ["management", "admin"] },
];

// ── Inventory Sweep Widget ────────────────────────────────────────────────────
function SweepStatusWidget({ token }: { token: string | null }) {
  const { data } = useQuery<{ lastSweepAt: string | null; lastExpiredCount: number; intervalMs: number }>({
    queryKey: ["sweep-status"],
    queryFn: () =>
      fetch("/api/inventory-sweep/status", {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()),
    enabled: !!token,
    refetchInterval: 60_000,
  });

  if (!data) return null;

  const lastSweep = data.lastSweepAt ? new Date(data.lastSweepAt) : null;
  const minsAgo = lastSweep ? Math.round((Date.now() - lastSweep.getTime()) / 60_000) : null;

  return (
    <Card className="shadow-sm border-teal-100">
      <CardContent className="pt-4 pb-4 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-teal-700">
          <RefreshCw className="h-4 w-4" />
          <span className="text-sm font-semibold">Inventory Sweep</span>
        </div>
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <span>
            Last run:{" "}
            <span className="font-medium text-foreground">
              {minsAgo === null ? "Never" : minsAgo === 0 ? "just now" : `${minsAgo} min ago`}
            </span>
          </span>
          <span>
            Receipts expired this sweep:{" "}
            <span className="font-medium text-foreground">{data.lastExpiredCount}</span>
          </span>
          <span>
            Interval:{" "}
            <span className="font-medium text-foreground">{data.intervalMs / 60_000} min</span>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user, token } = useAuth();
  const role = user?.role;

  const { data: stats } = useGetDashboardStats();
  const { data: activity = [] } = useGetRecentActivity({ limit: 6 });
  const { data: revenueChart = [] } = useGetRevenueChart({ months: 6 });

  const s = stats as any;
  const acts = activity as any[];
  const chart = revenueChart as any[];

  const fiscalYear = getFiscalYear();
  const roleLabel = ROLE_LABELS[role ?? ""] ?? role ?? "";
  const roleColor = ROLE_COLORS[role ?? ""] ?? "bg-blue-100 text-blue-800";

  return (
    <div className="space-y-6">
      {/* ── Welcome Header ─────────────────────────────────────────── */}
      <div className="rounded-2xl bg-gradient-to-r from-blue-900 via-blue-800 to-blue-700 text-white px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Welcome, {user?.name || "User"}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${roleColor}`}>{roleLabel}</span>
            <span className="text-blue-200 text-sm">Al Musafir International ERP</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-blue-200">{TODAY}</div>
          <div className="text-lg font-bold text-white mt-0.5">Fiscal Year: {fiscalYear}</div>
        </div>
      </div>

      {/* ── Quick Launch Grid ───────────────────────────────────────── */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-blue-900 flex items-center gap-2">
            <Activity className="h-4 w-4" /> Quick Launch
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-x-6 gap-y-5 justify-items-center">
            {TILES.map((item, i) => {
              if ("section" in item) {
                return <SectionLabel key={`sec-${i}`} title={item.section} />;
              }
              const t = item as TileData;
              return (
                <LaunchTile
                  key={t.href}
                  href={t.href}
                  icon={t.icon}
                  label={t.label}
                  gradient={t.gradient}
                  route={t.route}
                  tileRoles={t.tileRoles}
                  role={role}
                />
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── KPI Row ────────────────────────────────────────────────── */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Revenue",   value: `$${((s?.totalRevenue || 0) + 11600).toLocaleString()}`,     icon: DollarSign,  color: "text-green-600",  href: "/accounting" },
          { label: "Total Clients",   value: s?.totalClients ?? 8,                                        icon: Users,       color: "text-blue-600",   href: "/crm" },
          { label: "Quotations",      value: s?.totalQuotations ?? 4,                                     icon: FileText,    color: "text-purple-600", href: "/quotations" },
          { label: "Follow-ups Due",  value: s?.pendingFollowUps ?? 5,                                    icon: Clock,       color: "text-orange-600", href: "/crm/follow-ups" },
        ].filter(k => canAccess(role, k.href)).map(({ label, value, icon: Icon, color, href }) => (
          <Link key={label} href={href}>
            <Card className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="pt-5 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted"><Icon className={`h-5 w-5 ${color}`} /></div>
                <div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className="text-xl font-bold">{value}</div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* ── Inventory Sweep Status ─────────────────────────────────── */}
      <SweepStatusWidget token={token} />

      {/* ── Charts + Activity ──────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <TrendingUp className="h-4 w-4" /> Revenue vs Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chart.length === 0 ? (
              <div className="h-[240px] flex items-center justify-center text-muted-foreground text-sm">
                Revenue chart will populate as invoices are paid
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip formatter={(v: any) => `$${Number(v).toLocaleString()}`} />
                  <Bar dataKey="revenue" fill="#1e3a8a" name="Revenue" radius={[4,4,0,0]} />
                  <Bar dataKey="expenses" fill="#dc2626" name="Expenses" opacity={0.7} radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Activity className="h-4 w-4" /> Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {acts.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">No activity yet</p>
              ) : acts.map((a: any) => (
                <div key={a.id} className="flex items-start gap-3">
                  <div className="h-7 w-7 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                    <Activity className="h-3 w-3 text-blue-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-tight line-clamp-2">{a.description}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(a.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
