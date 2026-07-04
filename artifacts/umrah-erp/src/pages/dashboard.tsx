import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { canAccess, canDo, ROLE_LABELS, ROLE_COLORS } from "@/lib/permissions";
import {
  Hotel, Plus, Search, BedDouble, Receipt, CreditCard, FileSearch,
  Users, Store, BookOpen, Scale, ClipboardCheck, BarChart3, FileBarChart,
  BookOpenText, Plane, RefreshCw, MessageSquare, UserCheck, Banknote,
  ArrowRightLeft, TrendingUp, Clock, AlertCircle, CheckCircle2, FileText,
  Activity, DollarSign, Wallet, LogIn, LogOut, Ticket, PhoneCall, Zap,
  XCircle, Send,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGetDashboardStats } from "@workspace/api-client-react";

const TODAY = new Date().toLocaleDateString("en-GB", {
  weekday: "long", year: "numeric", month: "long", day: "numeric",
});

function getFiscalYear() {
  const now = new Date();
  const m = now.getMonth() + 1;
  const y = m >= 4 ? now.getFullYear() : now.getFullYear() - 1;
  return `${y}-${String(y + 1).slice(2)}`;
}

// ── AMI Office Shortcut Tile ──────────────────────────────────────────────────
interface ShortcutTile {
  href: string;
  icon: React.ElementType;
  label: string;
  color: string;
  route?: string;
  roles?: string[];
}

function Tile({ href, icon: Icon, label, color, route, roles, role }: ShortcutTile & { role?: string }) {
  if (roles ? !roles.includes(role ?? "") : route ? !canAccess(role, route) : false) return null;
  return (
    <Link href={href}>
      <div className="flex flex-col items-center gap-2 cursor-pointer group">
        <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center shadow group-hover:shadow-lg group-hover:scale-105 transition-all duration-200 ${color}`}>
          <Icon className="h-7 w-7 sm:h-9 sm:h-9 text-white drop-shadow" />
        </div>
        <span className="text-[10px] sm:text-xs font-semibold text-center text-gray-700 leading-tight max-w-[72px]">{label}</span>
      </div>
    </Link>
  );
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="col-span-full flex items-center gap-3 pt-1">
      <div className="flex-1 h-px bg-blue-100" />
      <span className="text-[10px] font-bold uppercase tracking-widest text-blue-500 px-2">{label}</span>
      <div className="flex-1 h-px bg-blue-100" />
    </div>
  );
}

// Shortcuts: the 15 AMI office shortcuts + extras
const SHORTCUT_TILES: Array<{ _section: string } | ShortcutTile> = [
  { _section: "Finance" },
  { href: "/accounting/hotel-invoice/new", icon: Hotel,         label: "Record Hotel Invoice",  color: "bg-gradient-to-br from-blue-800 to-blue-600",    route: "/accounting/hotel-invoice/new" },
  { href: "/hotel-invoices",               icon: Search,         label: "Search Hotel Invoice",  color: "bg-gradient-to-br from-blue-600 to-cyan-500",    route: "/hotel-invoices" },
  { href: "/accounting/reports",           icon: BedDouble,      label: "Hotel In/Out",          color: "bg-gradient-to-br from-cyan-700 to-cyan-500",    route: "/accounting/reports" },
  { href: "/accounting/vouchers",          icon: Receipt,        label: "Record Receipt",        color: "bg-gradient-to-br from-teal-700 to-teal-500",    route: "/accounting/vouchers" },
  { href: "/accounting/vouchers",          icon: CreditCard,     label: "Payment Voucher",       color: "bg-gradient-to-br from-violet-700 to-violet-500",route: "/accounting/vouchers" },

  { _section: "Accounting" },
  { href: "/accounting/vouchers",          icon: FileSearch,     label: "Search Voucher",        color: "bg-gradient-to-br from-indigo-700 to-indigo-500",route: "/accounting/vouchers" },
  { href: "/accounting/reports",           icon: Users,          label: "Party Statement",       color: "bg-gradient-to-br from-emerald-700 to-emerald-500",route:"/accounting/reports" },
  { href: "/accounting/reports",           icon: Store,          label: "Vendor Statement",      color: "bg-gradient-to-br from-rose-700 to-rose-500",    route: "/accounting/reports" },
  { href: "/accounting/ledger",            icon: BookOpen,       label: "Ledger",                color: "bg-gradient-to-br from-amber-700 to-amber-500",  route: "/accounting/ledger" },
  { href: "/accounting/reports",           icon: BarChart3,      label: "Party Summary",         color: "bg-gradient-to-br from-pink-700 to-pink-500",    route: "/accounting/reports" },

  { _section: "Reporting" },
  { href: "/accounting/reports",           icon: Scale,          label: "Vendor Summary",        color: "bg-gradient-to-br from-slate-700 to-slate-500",  route: "/accounting/reports" },
  { href: "/accounting/reports",           icon: BookOpenText,   label: "Books",                 color: "bg-gradient-to-br from-sky-700 to-sky-500",      route: "/accounting/reports" },
  { href: "/accounting/reports",           icon: BedDouble,      label: "Room Occupancy",        color: "bg-gradient-to-br from-purple-700 to-purple-500",route: "/accounting/reports" },
  { href: "/accounting/reports",           icon: ClipboardCheck, label: "Booking Validation",    color: "bg-gradient-to-br from-green-700 to-green-500",  route: "/accounting/reports" },
  { href: "/reports",                      icon: FileBarChart,   label: "Reports",               color: "bg-gradient-to-br from-orange-700 to-orange-500",route: "/accounting/reports" },

  { _section: "Operations" },
  { href: "/flights",                      icon: Plane,          label: "Flights",               color: "bg-gradient-to-br from-orange-600 to-amber-500", route: "/flights" },
  { href: "/hotel-requests",               icon: Hotel,          label: "Hotel Requests",        color: "bg-gradient-to-br from-teal-600 to-teal-400",    route: "/hotel-requests" },
  { href: "/quotations",                   icon: FileText,       label: "Quotations",            color: "bg-gradient-to-br from-green-600 to-green-400",  route: "/quotations" },
  { href: "/crm",                          icon: Users,          label: "Clients",               color: "bg-gradient-to-br from-emerald-600 to-emerald-400",route: "/crm" },
  { href: "/crm/follow-ups",               icon: PhoneCall,      label: "Follow-ups",            color: "bg-gradient-to-br from-sky-600 to-sky-400",      route: "/crm/follow-ups" },
];

// ── Widget ────────────────────────────────────────────────────────────────────
interface WidgetProps {
  icon: React.ElementType;
  label: string;
  value: number | string;
  href?: string;
  color: string;
  alert?: boolean;
}

function StatWidget({ icon: Icon, label, value, href, color, alert }: WidgetProps) {
  const content = (
    <Card className={`cursor-pointer hover:shadow-md transition-shadow ${alert && Number(value) > 0 ? "border-amber-300 bg-amber-50/40" : ""}`}>
      <CardContent className="pt-4 pb-4 flex items-center gap-3">
        <div className={`p-2 rounded-lg ${color}`}><Icon className="h-5 w-5 text-white" /></div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className={`text-2xl font-bold ${alert && Number(value) > 0 ? "text-amber-700" : "text-foreground"}`}>{value}</div>
        </div>
        {alert && Number(value) > 0 && <AlertCircle className="h-4 w-4 text-amber-500 ml-auto" />}
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

// ── Recent Items List ─────────────────────────────────────────────────────────
function RecentList({ title, items, icon: Icon }: { title: string; items: any[]; icon: React.ElementType }) {
  if (!items.length) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item: any, i: number) => {
          const ref = item.voucherNumber ?? item.dnNumber ?? `#${item.id}`;
          const name = item.narration ?? item.passengerName ?? "";
          const amount = item.receivablePkr ?? null;
          return (
            <div key={item.id ?? i} className="flex items-center justify-between text-sm border-b last:border-0 pb-1.5 last:pb-0">
              <div className="min-w-0">
                <span className="font-medium">{ref}</span>
                {name && <span className="text-muted-foreground ml-2 text-xs truncate">{name}</span>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {amount != null && (
                  <span className="text-xs font-medium tabular-nums">{Number(amount).toLocaleString()}</span>
                )}
                {item.type && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700">{item.type}</span>
                )}
                {item.status && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium
                    ${item.status === "paid" || item.status === "approved" ? "bg-green-100 text-green-700" :
                      item.status === "draft" ? "bg-gray-100 text-gray-600" :
                      "bg-amber-100 text-amber-700"}`}
                  >{item.status}</span>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ── Inventory Sweep Status ────────────────────────────────────────────────────
function SweepWidget({ token }: { token: string | null }) {
  const { data } = useQuery<{ lastSweepAt: string | null; lastExpiredCount: number; intervalMs: number }>({
    queryKey: ["sweep-status"],
    queryFn: () => fetch("/api/inventory-sweep/status", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    enabled: !!token,
    refetchInterval: 60_000,
  });
  if (!data) return null;
  const lastSweep = data.lastSweepAt ? new Date(data.lastSweepAt) : null;
  const minsAgo = lastSweep ? Math.round((Date.now() - lastSweep.getTime()) / 60_000) : null;
  return (
    <Card className="border-teal-100">
      <CardContent className="pt-3 pb-3 flex items-center gap-4 flex-wrap text-sm">
        <div className="flex items-center gap-2 text-teal-700 font-semibold">
          <RefreshCw className="h-4 w-4" /> Inventory Sweep
        </div>
        <span className="text-muted-foreground">
          Last run: <strong className="text-foreground">{minsAgo === null ? "Never" : minsAgo === 0 ? "just now" : `${minsAgo}m ago`}</strong>
        </span>
        <span className="text-muted-foreground">
          Expired this sweep: <strong className="text-foreground">{data.lastExpiredCount}</strong>
        </span>
      </CardContent>
    </Card>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user, token } = useAuth();
  const role = user?.role as string | undefined;
  const roleLabel = ROLE_LABELS[role ?? ""] ?? role ?? "User";
  const roleColor = ROLE_COLORS[role ?? ""] ?? "bg-blue-100 text-blue-800";
  const headers = { Authorization: `Bearer ${token}` };

  const { data: stats } = useGetDashboardStats();
  const s = stats as any;

  const { data: ops } = useQuery<{
    checkInsToday: number;
    checkOutsToday: number;
    pendingFlightRequests: number;
    refundsPending: number;
    flightsIssuedToday: number;
    whatsappUnread: number;
    portalPending: number;
    bookingInquiriesNew: number;
    recentVouchers: any[];
    recentHotelInvoices: any[];
  }>({
    queryKey: ["dashboard-operational"],
    queryFn: () => fetch("/api/dashboard/operational", { headers }).then((r) => r.json()),
    enabled: !!token,
    refetchInterval: 5 * 60_000,
  });

  const isManagement = ["management", "admin"].includes(role ?? "");
  const isAccounts   = ["accounts", "management", "admin"].includes(role ?? "");
  const isOps        = ["operations", "management", "admin"].includes(role ?? "");
  const isSales      = ["sales", "management", "admin"].includes(role ?? "");
  const isAdmin      = ["management", "admin"].includes(role ?? "");

  const { data: autoSummary } = useQuery<{
    enabled: number;
    running: number;
    failed: number;
    todaySent: number;
    total: number;
  }>({
    queryKey: ["automations-summary"],
    queryFn: () => fetch("/api/automations-summary", { headers }).then((r) => r.json()),
    enabled: !!token && isAdmin,
    refetchInterval: 60_000,
  });

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="rounded-2xl bg-gradient-to-r from-blue-900 via-blue-800 to-blue-700 text-white px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Al Musafir International ERP</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${roleColor}`}>{roleLabel}</span>
            <span className="text-blue-200 text-sm">{user?.name ?? "User"}</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm text-blue-200">{TODAY}</div>
          <div className="text-base font-bold text-white mt-0.5">FY {getFiscalYear()}</div>
        </div>
      </div>

      {/* ── Quick Launch Grid (AMI style) ── */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold text-blue-900 flex items-center gap-2">
            <Activity className="h-4 w-4" /> Quick Launch
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-x-4 gap-y-4 justify-items-center">
            {SHORTCUT_TILES.map((item, i) => {
              if ("_section" in item) {
                return <SectionDivider key={`sec-${i}`} label={item._section} />;
              }
              return (
                <Tile key={`${item.href}-${item.label}`} {...item} role={role} />
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Operational Widgets ── */}
      {ops && (
        <div className="space-y-4">
          {/* Hotel row (operations/management) */}
          {isOps && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-2">Hotel Operations</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatWidget icon={LogIn}  label="Check-ins Today"   value={ops.checkInsToday}         href="/hotel-invoices"     color="bg-teal-600" />
                <StatWidget icon={LogOut} label="Check-outs Today"  value={ops.checkOutsToday}         href="/hotel-invoices"     color="bg-blue-600" />
                <StatWidget icon={Hotel}  label="Hotel Invoices"    value="View"                       href="/hotel-invoices"     color="bg-violet-600" />
                <StatWidget icon={Ticket} label="Booking Inquiries" value={ops.bookingInquiriesNew}    href="/booking-inquiries"  color="bg-indigo-600" alert />
              </div>
            </div>
          )}

          {/* Flights row (operations/management) */}
          {isOps && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-2">Flight Operations</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatWidget icon={Plane}          label="Issued Today"       value={ops.flightsIssuedToday}    href="/flights/staff-log"     color="bg-green-600" />
                <StatWidget icon={Clock}           label="Flight Requests"    value={ops.pendingFlightRequests} href="/flight-requests"        color="bg-amber-600" alert />
                <StatWidget icon={RefreshCw}       label="Refunds Pending"    value={ops.refundsPending}        href="/flights/cancellations"  color="bg-orange-600" alert />
                <StatWidget icon={FileBarChart}    label="BSP Report"         value="View"                      href="/flights/bsp-report"     color="bg-sky-600" />
              </div>
            </div>
          )}

          {/* Finance row (accounts/management) */}
          {isAccounts && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-2">Finance</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatWidget icon={DollarSign}   label="Total Clients"     value={s?.totalClients ?? "—"}       href="/crm"              color="bg-emerald-600" />
                <StatWidget icon={TrendingUp}   label="Monthly Revenue"   value={s?.monthlyRevenue ? `PKR ${Number(s.monthlyRevenue).toLocaleString()}` : "—"} href="/accounting" color="bg-blue-700" />
                <StatWidget icon={Wallet}       label="Vouchers"          value="View"                          href="/accounting/vouchers" color="bg-indigo-600" />
                <StatWidget icon={BookOpen}     label="Ledger"            value="View"                          href="/accounting/ledger"   color="bg-teal-700" />
              </div>
            </div>
          )}

          {/* Admin row (management only) */}
          {isAdmin && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-2">Administration</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatWidget icon={MessageSquare} label="WhatsApp Unread"    value={ops.whatsappUnread}    href="/whatsapp-inbox"  color="bg-green-700" alert />
                <StatWidget icon={UserCheck}     label="Portal Pending"     value={ops.portalPending}     href="/portal-users"    color="bg-sky-700"   alert />
                <StatWidget icon={Users}         label="Staff"              value="Manage"                href="/users"           color="bg-slate-600" />
                <StatWidget icon={FileBarChart}  label="Reports"            value="View"                  href="/reports"         color="bg-orange-600" />
              </div>
            </div>
          )}

          {/* Automation row (admin only) */}
          {isAdmin && autoSummary && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-2">Automation Engine</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatWidget icon={Zap}      label="Active Automations"  value={`${autoSummary.enabled}/${autoSummary.total}`} href="/automation-settings" color="bg-teal-700" />
                <StatWidget icon={Send}     label="Sent Today"          value={autoSummary.todaySent}  href="/automation-logs"     color="bg-blue-700" />
                <StatWidget icon={XCircle}  label="Failed"              value={autoSummary.failed}     href="/automation-logs"     color="bg-red-700" alert />
                <StatWidget icon={CheckCircle2} label="Automation Logs" value="View"                  href="/automation-logs"     color="bg-violet-700" />
              </div>
            </div>
          )}

          {/* Sales row (sales only) */}
          {isSales && !isOps && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-2">Sales</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatWidget icon={Users}     label="Clients"        value={s?.totalClients ?? "—"}  href="/crm"              color="bg-emerald-600" />
                <StatWidget icon={FileText}  label="Quotations"     value={s?.totalQuotations ?? "—"} href="/quotations"     color="bg-green-600" />
                <StatWidget icon={PhoneCall} label="Follow-ups Due" value={s?.pendingFollowUps ?? "—"} href="/crm/follow-ups" color="bg-amber-600" alert />
                <StatWidget icon={Hotel}     label="Hotel Requests" value="View"                    href="/hotel-requests"   color="bg-cyan-600" />
              </div>
            </div>
          )}

          {/* Recent data rows */}
          {(isAccounts || isManagement) && (
            <div className="grid gap-4 md:grid-cols-2">
              <RecentList title="Recent Vouchers"        items={ops.recentVouchers}      icon={Receipt} />
              <RecentList title="Recent Hotel Invoices"  items={ops.recentHotelInvoices} icon={Hotel} />
            </div>
          )}
        </div>
      )}

      {/* ── Inventory Sweep (management/admin) ── */}
      {isAdmin && <SweepWidget token={token} />}
    </div>
  );
}
