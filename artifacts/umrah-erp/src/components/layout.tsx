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
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { NAV_ITEM_ROLES, ROLE_LABELS, ROLE_COLORS, type UserRole } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const navGroups = [
  {
    title: "Overview",
    items: [{ title: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    title: "CRM",
    items: [
      { title: "Clients", href: "/crm", icon: Users },
      { title: "Follow-ups", href: "/crm/follow-ups", icon: PhoneCall },
    ],
  },
  {
    title: "Sales",
    items: [
      { title: "Quotations", href: "/quotations", icon: FileText },
      { title: "Pending Quotations", href: "/quotations/pending", icon: Package },
      { title: "Hotel Requests", href: "/hotel-requests", icon: Building2 },
    ],
  },
  {
    title: "Direct Bookings",
    items: [
      { title: "Booking Inquiries", href: "/booking-inquiries", icon: Ticket },
      { title: "Portal Users", href: "/portal-users", icon: UserCheck },
      { title: "Flight Requests", href: "/flight-requests", icon: PlaneTakeoff },
    ],
  },
  {
    title: "Operations",
    items: [
      { title: "Hotels", href: "/hotels", icon: Hotel },
      { title: "Vendors", href: "/vendors", icon: Store },
      { title: "Transport", href: "/transport", icon: Car },
      { title: "Flights", href: "/flights", icon: Plane },
      { title: "Visa", href: "/visa", icon: BookOpen },
    ],
  },
  {
    title: "Finance",
    items: [
      { title: "Accounting", href: "/accounting", icon: Calculator },
      { title: "Invoices", href: "/accounting/invoices", icon: Receipt },
      { title: "Expenses", href: "/accounting/expenses", icon: CreditCard },
      { title: "Hotel Invoices DN", href: "/hotel-invoices", icon: Hotel },
      { title: "Vouchers", href: "/accounting/vouchers", icon: FileStack },
      { title: "General Journal", href: "/general-journal", icon: Landmark },
      { title: "Account Ledger", href: "/accounting/ledger", icon: BookOpen },
      { title: "Trial Balance", href: "/accounting/trial-balance", icon: Scale },
      { title: "Reports", href: "/accounting/reports", icon: FileBarChart },
      { title: "P&L Statement", href: "/accounting/pnl", icon: TrendingUp },
      { title: "Balance Sheet", href: "/accounting/balance-sheet", icon: BarChart3 },
      { title: "Financial Years", href: "/accounting/financial-years", icon: CalendarRange },
      { title: "Currency", href: "/currency-settings", icon: ArrowRightLeft },
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
    title: "Admin",
    items: [
      { title: "Users", href: "/users", icon: ShieldCheck },
      { title: "Documents", href: "/documents", icon: Files },
      { title: "GDS Settings", href: "/gds-settings", icon: Settings2 },
      { title: "AI Settings", href: "/ai-settings", icon: Bot },
      { title: "Website Settings", href: "/website-settings", icon: Globe },
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

export function Sidebar() {
  const [location] = useLocation();
  const { logout, user, token } = useAuth();
  const role = (user?.role ?? "") as UserRole;
  const isManagement = role === "management" || role === "admin";
  const { data: unreadData } = useInboxUnread();
  const { data: portalPending } = usePortalPending();
  const { data: pkgInquiries } = usePackageInquiriesPending();
  const { data: flightRequestsData } = useFlightRequestsPending();
  const unreadCount = unreadData?.total ?? 0;
  const pendingPortal = portalPending?.count ?? 0;
  const pendingPkgInquiries = pkgInquiries?.count ?? 0;
  const pendingFlightRequests = flightRequestsData?.count ?? 0;

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
      <div className="flex h-14 items-center px-4 border-b border-sidebar-border">
        <span className="font-bold text-lg tracking-tight">Umrah ERP</span>
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
