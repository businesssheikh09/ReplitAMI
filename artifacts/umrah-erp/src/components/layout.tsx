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
  Globe
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

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
      { title: "Hotel Requests", href: "/hotel-requests", icon: Building2 },
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
      { title: "Currency", href: "/currency-settings", icon: ArrowRightLeft },
    ],
  },
  {
    title: "Admin",
    items: [
      { title: "Users", href: "/users", icon: ShieldCheck },
      { title: "Documents", href: "/documents", icon: Files },
      { title: "GDS Settings", href: "/gds-settings", icon: Settings2 },
      { title: "Website Settings", href: "/website-settings", icon: Globe },
    ],
  },
];

export function Sidebar() {
  const [location] = useLocation();
  const { logout } = useAuth();

  return (
    <div className="flex h-screen w-64 flex-col bg-sidebar border-r border-sidebar-border">
      <div className="flex h-14 items-center px-4 border-b border-sidebar-border">
        <span className="font-bold text-lg tracking-tight">Umrah ERP</span>
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-6 px-2">
          {navGroups.map((group) => (
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

  if (!isAuthenticated && location !== "/login") {
    // Should ideally redirect, but handled in App.tsx generally
  }

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
