import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Users,
  PhoneCall,
  FileText,
  Building2,
  Hotel,
  Store,
  Car,
  Plane,
  BookOpen,
  Calculator,
  Receipt,
  CreditCard,
  ShieldCheck,
  Files,
  Settings2,
  ArrowRightLeft,
  Globe,
  MessageSquare,
  Send,
  Ticket,
  Package,
  UserCheck,
  Bot,
  Landmark,
  PlaneTakeoff,
  Library,
  FileStack,
  Scale,
  TrendingUp,
  BarChart3,
  CalendarRange,
  FileBarChart,
  XCircle,
  ClipboardList,
  FileSearch,
  Banknote,
  Zap,
  ScrollText,
  Map,
  Bell,
  X,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { NAV_ITEM_ROLES, ROLE_LABELS, ROLE_COLORS, type UserRole } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const navGroups = [
  {
    title: "Dashboard",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { title: "Reports Overview", href: "/reports", icon: FileBarChart },
    ],
  },
  {
    title: "Sales",
    items: [
      { title: "Clients (CRM)", href: "/crm", icon: Users },
      { title: "Follow-ups", href: "/crm/follow-ups", icon: PhoneCall },
      { title: "Quotations", href: "/quotations", icon: FileText },
      { title: "Package Inquiries", href: "/quotations/pending", icon: Package },
      { title: "Hotel Requests", href: "/hotel-requests", icon: Building2 },
    ],
  },
  {
    title: "Recording",
    items: [
      { title: "Hotel Invoice (DN)", href: "/accounting/hotel-invoice/new", icon: Hotel },
      { title: "Receipt Voucher", href: "/accounting/vouchers/new?type=RV", icon: Receipt },
      { title: "Payment Voucher", href: "/accounting/vouchers/new?type=PV", icon: CreditCard },
      { title: "Journal Voucher", href: "/accounting/vouchers/new?type=JV", icon: FileStack },
      { title: "Cash Voucher", href: "/accounting/vouchers/new?type=CV", icon: Banknote },
      { title: "Voucher Register", href: "/accounting/vouchers", icon: BookOpen },
    ],
  },
  {
    title: "Finance",
    items: [
      { title: "Accounting", href: "/accounting", icon: Calculator },
      { title: "Invoices", href: "/accounting/invoices", icon: Receipt },
      { title: "Hotel Invoices DN", href: "/hotel-invoices", icon: Hotel },
      { title: "Expenses", href: "/accounting/expenses", icon: CreditCard },
      { title: "Vouchers", href: "/accounting/vouchers", icon: FileStack },
      { title: "General Journal", href: "/general-journal", icon: Landmark },
      { title: "Account Ledger", href: "/accounting/ledger", icon: BookOpen },
      { title: "Trial Balance", href: "/accounting/trial-balance", icon: Scale },
      { title: "P&L Statement", href: "/accounting/pnl", icon: TrendingUp },
      { title: "Balance Sheet", href: "/accounting/balance-sheet", icon: BarChart3 },
      { title: "Financial Years", href: "/accounting/financial-years", icon: CalendarRange },
      { title: "Currency", href: "/currency-settings", icon: ArrowRightLeft },
    ],
  },
  {
    title: "Reports",
    items: [
      { title: "Accounting Reports", href: "/accounting/reports", icon: FileBarChart },
      { title: "BSP Report", href: "/flights/bsp-report", icon: Banknote },
      { title: "Staff Ticket Log", href: "/flights/staff-log", icon: ClipboardList },
    ],
  },
  {
    title: "Operations",
    items: [
      { title: "Flights", href: "/flights", icon: Plane },
      { title: "Transport", href: "/transport", icon: Car },
      { title: "Visa", href: "/visa", icon: BookOpen },
      { title: "Passenger Documents", href: "/flights/passengers", icon: FileSearch },
      { title: "Cancellations & Refunds", href: "/flights/cancellations", icon: XCircle },
    ],
  },
  {
    title: "Portal",
    items: [
      { title: "Portal Users", href: "/portal-users", icon: UserCheck },
      { title: "Booking Inquiries", href: "/booking-inquiries", icon: Ticket },
      { title: "Flight Requests", href: "/flight-requests", icon: PlaneTakeoff },
    ],
  },
  {
    title: "Messaging",
    items: [
      { title: "WhatsApp Inbox", href: "/whatsapp-inbox", icon: MessageSquare },
      { title: "Message Campaign", href: "/bot-campaign", icon: Send },
      { title: "Media Library", href: "/media-library", icon: Library },
    ],
  },
  {
    title: "Files",
    items: [
      { title: "Hotels", href: "/hotels", icon: Hotel },
      { title: "Vendors", href: "/vendors", icon: Store },
      { title: "Documents", href: "/documents", icon: Files },
    ],
  },
  {
    title: "Admin",
    items: [
      { title: "Users", href: "/users", icon: ShieldCheck },
      { title: "GDS Settings", href: "/gds-settings", icon: Settings2 },
      { title: "AI Settings", href: "/ai-settings", icon: Bot },
      { title: "Local Airlines", href: "/local-airline-settings", icon: Plane },
      { title: "ERP Settings", href: "/erp-settings", icon: Settings2 },
      { title: "Website Settings", href: "/website-settings", icon: Globe },
      { title: "Automation Engine", href: "/automation-settings", icon: Zap },
      { title: "Automation Logs", href: "/automation-logs", icon: ScrollText },
      { title: "Project Map", href: "/project-map", icon: Map },
    ],
  },
];

function useInboxUnread() {
  const { isAuthenticated, user, token } = useAuth();
  const role = (user?.role ?? "") as UserRole;
  const canSee = isAuthenticated && (role === "management" || role === "admin");
  return useQuery<{ total: number }>({
    queryKey: ["whatsapp-inbox-unread", token],
    queryFn: () =>
      fetch("/api/whatsapp-inbox/unread-count", {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.ok ? r.json() : { total: 0 }),
    enabled: canSee && !!token,
    refetchInterval: 30_000,
    staleTime: 20_000,
  });
}

function usePortalPending() {
  const { isAuthenticated, user, token } = useAuth();
  const role = (user?.role ?? "") as UserRole;
  const canSee = isAuthenticated && (role === "management" || role === "admin");
  return useQuery<{ count: number }>({
    queryKey: ["portal-pending-count", token],
    queryFn: () =>
      fetch("/api/portal/users?status=pending_approval", { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.ok ? r.json() : [])
        .then((users) => ({ count: Array.isArray(users) ? users.length : 0 })),
    enabled: canSee && !!token,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

function usePackageInquiriesPending() {
  const { isAuthenticated, token } = useAuth();
  return useQuery<{ count: number }>({
    queryKey: ["package-inquiries-count", token],
    queryFn: () =>
      fetch("/api/package-inquiries/count", { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.ok ? r.json() : { count: 0 }),
    enabled: isAuthenticated && !!token,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

function useFlightRequestsPending() {
  const { isAuthenticated, token } = useAuth();
  return useQuery<{ count: number }>({
    queryKey: ["flight-requests-count", token],
    queryFn: () =>
      fetch("/api/flight-requests/count", { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.ok ? r.json() : { count: 0 }),
    enabled: isAuthenticated && !!token,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

function useDraftQuotationsCount() {
  const { isAuthenticated, token } = useAuth();
  return useQuery<{ count: number }>({
    queryKey: ["draft-quotations-count", token],
    queryFn: () =>
      fetch("/api/quotations?status=draft", { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.ok ? r.json() : [])
        .then((qs) => ({ count: Array.isArray(qs) ? qs.length : 0 })),
    enabled: isAuthenticated && !!token,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

/* ── Notification centre ───────────────────────────────────────────────────── */

type NotificationItem = {
  key: string;
  category: string;
  label: string;
  sublabel: string;
  href: string;
  urgency: "urgent" | "warning" | "info";
};

function useNotifications() {
  const { isAuthenticated, token } = useAuth();
  const enabled = isAuthenticated && !!token;
  const headers = { Authorization: `Bearer ${token}` };

  const { data: hotelInvoices = [] } = useQuery<any[]>({
    queryKey: ["hotel-invoices-notify", token],
    queryFn: () =>
      fetch("/api/invoices/hotel", { headers }).then((r) => (r.ok ? r.json() : [])),
    enabled,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const { data: flightRequests = [] } = useQuery<any[]>({
    queryKey: ["flight-requests-notify", token],
    queryFn: () =>
      fetch("/api/flight-requests", { headers }).then((r) => (r.ok ? r.json() : [])),
    enabled,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const { data: pkgInquiries = [] } = useQuery<any[]>({
    queryKey: ["pkg-inquiries-notify", token],
    queryFn: () =>
      fetch("/api/package-inquiries", { headers }).then((r) => (r.ok ? r.json() : [])),
    enabled,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const { data: portalPendingUsers = [] } = useQuery<any[]>({
    queryKey: ["portal-pending-notify", token],
    queryFn: () =>
      fetch("/api/portal/users?status=pending_approval", { headers }).then((r) =>
        r.ok ? r.json() : []
      ),
    enabled,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const { data: draftQuotationsList = [] } = useQuery<any[]>({
    queryKey: ["draft-quotations-notify", token],
    queryFn: () =>
      fetch("/api/quotations?status=draft", { headers }).then((r) =>
        r.ok ? r.json() : []
      ),
    enabled,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const todayStr = new Date().toISOString().slice(0, 10);
  const in3DaysStr = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);

  const items: NotificationItem[] = [];

  /* Tentative hotel invoices with option date ≤ today (urgent) or ≤ 3 days (warning) */
  for (const inv of hotelInvoices as any[]) {
    if (inv.status !== "tentative") continue;
    const optDate: string | undefined = inv.optionDate;
    if (!optDate) continue;
    if (optDate > in3DaysStr) continue;
    const urgency: "urgent" | "warning" = optDate <= todayStr ? "urgent" : "warning";
    const catLabel =
      urgency === "urgent" ? "⚠ Tentative — Option Expired" : "⏳ Tentative — Option Due Soon";
    items.push({
      key: `hotel-${inv.id}`,
      category: catLabel,
      label: `${inv.dnNumber} — ${inv.passengerName || inv.partyName || "Guest"}`,
      sublabel: `${inv.hotelName || "Hotel"} · Option: ${optDate}`,
      href: `/accounting/hotel-invoice/${inv.id}`,
      urgency,
    });
  }

  /* Package inquiries — pending */
  for (const inq of pkgInquiries as any[]) {
    if (inq.status !== "pending") continue;
    items.push({
      key: `pkg-${inq.id}`,
      category: "Package Inquiries",
      label: inq.name || inq.clientName || "Inquiry",
      sublabel: inq.packageName || inq.email || "",
      href: "/quotations/pending",
      urgency: "info",
    });
  }

  /* Flight requests — pending */
  for (const fr of flightRequests as any[]) {
    if (fr.status !== "pending") continue;
    items.push({
      key: `fr-${fr.id}`,
      category: "Flight Requests",
      label: fr.clientName || fr.requestNumber || `Request #${fr.id}`,
      sublabel: `${fr.origin || ""}${fr.destination ? " → " + fr.destination : ""} · ${fr.departureDate || ""}`.trim().replace(/^·\s*/, ""),
      href: "/flight-requests",
      urgency: "info",
    });
  }

  /* Portal users awaiting approval */
  for (const u of portalPendingUsers as any[]) {
    items.push({
      key: `portal-${u.id}`,
      category: "Portal Approvals",
      label: u.name || u.email || "User",
      sublabel: u.email || u.phone || "",
      href: "/portal-users",
      urgency: "info",
    });
  }

  /* Draft quotations */
  for (const q of draftQuotationsList as any[]) {
    items.push({
      key: `qt-${q.id}`,
      category: "Draft Quotations",
      label: `${q.referenceNo} — ${q.clientName || "Client"}`,
      sublabel: q.title || "",
      href: `/quotations/${q.id}`,
      urgency: "info",
    });
  }

  const hasUrgent = items.some((i) => i.urgency === "urgent");
  return { items, hasUrgent };
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { items, hasUrgent } = useNotifications();
  const total = items.length;

  /* Group by category, preserving insertion order */
  const groups: Record<string, NotificationItem[]> = {};
  for (const item of items) {
    if (!groups[item.category]) groups[item.category] = [];
    groups[item.category].push(item);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-1.5 rounded-md hover:bg-sidebar-accent/50 transition-colors focus:outline-none"
        title="Notifications"
        aria-label="Open notifications"
      >
        <Bell
          className={`h-4 w-4 ${hasUrgent ? "text-red-500" : "text-sidebar-foreground/70"}`}
        />
        {total > 0 && (
          <span
            className={`absolute -top-0.5 -right-0.5 min-w-[16px] h-4 text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 text-white ${
              hasUrgent ? "bg-red-500" : "bg-slate-500"
            }`}
          >
            {total > 99 ? "99+" : total}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Backdrop — closes on outside click */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Notification panel */}
          <div className="absolute top-9 left-0 z-50 w-80 max-h-[70vh] overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50 sticky top-0">
              <span className="font-semibold text-sm text-gray-800">
                Alerts &amp; Notifications
                {total > 0 && (
                  <span className="ml-2 text-xs font-normal text-gray-400">({total})</span>
                )}
              </span>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close notifications"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {total === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                ✓ All clear — no pending alerts
              </div>
            ) : (
              <div>
                {Object.entries(groups).map(([cat, catItems]) => {
                  const catUrgent = catItems.some((i) => i.urgency === "urgent");
                  const catWarning = catItems.some((i) => i.urgency === "warning");
                  return (
                    <div key={cat}>
                      <div
                        className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
                          catUrgent
                            ? "bg-red-50 text-red-700"
                            : catWarning
                            ? "bg-amber-50 text-amber-700"
                            : "bg-gray-50 text-gray-500"
                        }`}
                      >
                        {cat}
                      </div>
                      {catItems.map((item) => (
                        <Link key={item.key} href={item.href}>
                          <span
                            onClick={() => setOpen(false)}
                            className={`flex flex-col px-3 py-2 border-b border-gray-100 cursor-pointer hover:bg-gray-50 border-l-2 ${
                              item.urgency === "urgent"
                                ? "border-l-red-400"
                                : item.urgency === "warning"
                                ? "border-l-amber-400"
                                : "border-l-blue-200"
                            }`}
                          >
                            <span className="text-sm font-medium text-gray-800 truncate">
                              {item.label}
                            </span>
                            {item.sublabel && (
                              <span className="text-xs text-gray-500 truncate">
                                {item.sublabel}
                              </span>
                            )}
                          </span>
                        </Link>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function Sidebar() {
  const [location] = useLocation();
  const { logout, user, token } = useAuth();
  const role = (user?.role ?? "") as UserRole;
  const isManagement = role === "management" || role === "admin";
  const { data: unreadData } = useInboxUnread();
  const { data: portalPending } = usePortalPending();
  const { data: pkgInquiries } = usePackageInquiriesPending();
  const { data: flightRequestsData } = useFlightRequestsPending();
  const { data: draftQuotationsData } = useDraftQuotationsCount();
  const unreadCount = unreadData?.total ?? 0;
  const pendingPortal = portalPending?.count ?? 0;
  const pendingPkgInquiries = pkgInquiries?.count ?? 0;
  const pendingFlightRequests = flightRequestsData?.count ?? 0;
  const draftQuotations = draftQuotationsData?.count ?? 0;

  const filteredGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (isManagement) return true;
        const allowed = NAV_ITEM_ROLES[item.href];
        return allowed ? allowed.includes(role) : false;
      }),
    }))
    .filter((group) => group.items.length > 0);

  const roleBadgeClass = ROLE_COLORS[role] ?? "bg-gray-100 text-gray-700";
  const roleLabel = ROLE_LABELS[role] ?? role;

  return (
    <div className="flex h-screen w-64 flex-col bg-sidebar border-r border-sidebar-border">
      <div className="flex h-14 items-center justify-between px-4 border-b border-sidebar-border">
        <span className="font-bold text-lg tracking-tight">Umrah ERP</span>
        <NotificationBell />
      </div>

      {user && (
        <div className="px-4 py-3 border-b border-sidebar-border">
          <p className="text-sm font-medium truncate">{user.name}</p>
          <span className={cn("inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium", roleBadgeClass)}>
            {roleLabel}
          </span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-6 px-2">
          {filteredGroups.map((group) => (
            <div key={group.title}>
              <h4 className="mb-2 px-2 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
                {group.title}
              </h4>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = location === item.href || location.startsWith(item.href + "/");
                  return (
                    <Link key={item.href} href={item.href}>
                      <span
                        className={cn(
                          "group flex w-full items-center rounded-md px-2 py-1.5 text-sm font-medium",
                          isActive
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                        )}
                      >
                        <Icon className="mr-2 h-4 w-4" />
                        {item.title}
                        {item.href === "/whatsapp-inbox" && unreadCount > 0 && (
                          <Badge className="ml-auto h-5 min-w-5 rounded-full px-1 text-xs" variant="destructive">
                            {unreadCount > 99 ? "99+" : unreadCount}
                          </Badge>
                        )}
                        {item.href === "/portal-users" && pendingPortal > 0 && (
                          <Badge className="ml-auto h-5 min-w-5 rounded-full px-1 text-xs bg-amber-500 text-white border-0">
                            {pendingPortal}
                          </Badge>
                        )}
                        {item.href === "/quotations" && draftQuotations > 0 && (
                          <Badge className="ml-auto h-5 min-w-5 rounded-full px-1 text-xs bg-slate-500 text-white border-0">
                            {draftQuotations} draft{draftQuotations !== 1 ? "s" : ""}
                          </Badge>
                        )}
                        {item.href === "/quotations/pending" && pendingPkgInquiries > 0 && (
                          <Badge className="ml-auto h-5 min-w-5 rounded-full px-1 text-xs bg-orange-500 text-white border-0">
                            {pendingPkgInquiries}
                          </Badge>
                        )}
                        {item.href === "/flight-requests" && pendingFlightRequests > 0 && (
                          <Badge className="ml-auto h-5 min-w-5 rounded-full px-1 text-xs bg-sky-500 text-white border-0">
                            {pendingFlightRequests}
                          </Badge>
                        )}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      <div className="p-4 border-t border-sidebar-border">
        <Button variant="outline" className="w-full justify-start" onClick={logout}>
          Log out
        </Button>
      </div>
    </div>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [location] = useLocation();

  if (location === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto overflow-x-hidden p-6">
        {children}
      </main>
    </div>
  );
}
