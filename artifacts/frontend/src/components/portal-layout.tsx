import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { usePortalAuth } from "@/lib/portal-auth";
import {
  LayoutDashboard, Calendar, FileText, BookOpen, Hotel, Plane,
  Globe, Car, CreditCard, User, Download, LogOut, Menu, X,
} from "lucide-react";
import { useState, useEffect } from "react";

interface WebsiteConfig {
  company_name?: string;
  company_logo_url?: string;
  company_tagline?: string;
}

const NAV_ITEMS = [
  { href: "/portal", label: "Dashboard", icon: LayoutDashboard },
  { href: "/portal/bookings", label: "My Bookings", icon: Calendar },
  { href: "/portal/invoices", label: "Invoices", icon: FileText },
  { href: "/portal/statement", label: "Statement", icon: BookOpen },
  { href: "/portal/hotel-vouchers", label: "Hotel Vouchers", icon: Hotel },
  { href: "/portal/flight-tickets", label: "Flight Tickets", icon: Plane },
  { href: "/portal/visa", label: "Visa Status", icon: Globe },
  { href: "/portal/transport", label: "Transport", icon: Car },
  { href: "/portal/payments", label: "Payments", icon: CreditCard },
  { href: "/portal/profile", label: "Profile", icon: User },
  { href: "/portal/downloads", label: "Downloads", icon: Download },
];

export function PortalLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, logout } = usePortalAuth();
  const [location, navigate] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: config } = useQuery<WebsiteConfig>({
    queryKey: ["website-config-public"],
    queryFn: () => fetch("/api/website-config").then((r) => r.json()),
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (!isAuthenticated) navigate("/portal-login");
  }, [isAuthenticated]);

  if (!isAuthenticated) return null;

  const companyName = config?.company_name ?? "Al Musafir International";
  const logoUrl = config?.company_logo_url;

  const handleLogout = async () => {
    await logout();
    navigate("/portal-login");
  };

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <div className={`flex flex-col h-full ${mobile ? "" : "w-64"} bg-slate-900 text-white`}>
      {/* Brand */}
      <div className="px-4 py-5 border-b border-slate-700 flex items-center gap-3">
        {logoUrl ? (
          <img src={logoUrl} alt={companyName} className="h-8 w-auto object-contain" />
        ) : (
          <div className="h-8 w-8 rounded-lg bg-teal-500 flex items-center justify-center font-bold text-sm">
            {companyName.charAt(0)}
          </div>
        )}
        <div className="min-w-0">
          <div className="text-sm font-bold truncate">{companyName}</div>
          <div className="text-xs text-slate-400">Customer Portal</div>
        </div>
      </div>

      {/* User */}
      <div className="px-4 py-3 border-b border-slate-700">
        <p className="text-xs text-slate-400">Logged in as</p>
        <p className="text-sm font-semibold truncate">{user?.fullName}</p>
        <p className="text-xs text-slate-400 capitalize">{user?.type === "dc" ? "Direct Customer" : "Travel Agency"}</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = location === href || (href !== "/portal" && location.startsWith(href));
          return (
            <Link key={href} href={href}>
              <span
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${
                  active
                    ? "bg-teal-600 text-white font-medium"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-slate-700">
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Desktop sidebar */}
      <div className="hidden md:flex md:flex-col md:w-64 shrink-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="relative w-72 flex flex-col">
            <Sidebar mobile />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shrink-0">
          <button onClick={() => setMobileOpen(true)} className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100">
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-semibold text-sm">{companyName}</span>
          <div className="w-8" />
        </div>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

export function PrintHeader({ config }: { config?: WebsiteConfig }) {
  const companyName = config?.company_name ?? "Al Musafir International";
  const logoUrl = config?.company_logo_url;
  return (
    <div className="flex items-center gap-4 border-b border-gray-300 pb-4 mb-6 print:flex">
      {logoUrl && <img src={logoUrl} alt={companyName} className="h-14 w-auto object-contain" />}
      <div>
        <div className="text-xl font-bold">{companyName}</div>
        {config?.company_tagline && <div className="text-sm text-gray-500">{config.company_tagline}</div>}
      </div>
    </div>
  );
}
