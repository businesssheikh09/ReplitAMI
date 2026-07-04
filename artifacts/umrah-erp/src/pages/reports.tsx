import { Link } from "wouter";
import {
  FileBarChart, BookOpenText, Receipt, Banknote, BookOpen,
  Hotel, ClipboardCheck, Plane, BarChart3, Scale, BedDouble,
  Users, Store, ArrowRightLeft, FileText, MessageSquare, UserCheck,
  TrendingUp, FileSearch,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { canAccess } from "@/lib/permissions";

interface ReportLink {
  href: string;
  label: string;
  description: string;
  icon: React.ElementType;
  iconColor: string;
  bg: string;
  route?: string;
  roles?: string[];
}

const REPORT_SECTIONS: { title: string; items: ReportLink[] }[] = [
  {
    title: "Accounting Reports",
    items: [
      { href: "/accounting/reports", label: "Party Statement",     description: "Client-wise transaction history",       icon: Users,         iconColor: "text-blue-600",   bg: "bg-blue-50",    route: "/accounting/reports" },
      { href: "/accounting/reports", label: "Vendor Statement",    description: "Vendor-wise ledger",                    icon: Store,         iconColor: "text-violet-600", bg: "bg-violet-50",  route: "/accounting/reports" },
      { href: "/accounting/reports", label: "Cash Book",           description: "Daily cash receipts and payments",      icon: Banknote,      iconColor: "text-green-600",  bg: "bg-green-50",   route: "/accounting/reports" },
      { href: "/accounting/reports", label: "Receipt Book",        description: "All receipt vouchers",                  icon: Receipt,       iconColor: "text-teal-600",   bg: "bg-teal-50",    route: "/accounting/reports" },
      { href: "/accounting/reports", label: "Payment Book",        description: "All payment vouchers",                  icon: FileText,      iconColor: "text-orange-600", bg: "bg-orange-50",  route: "/accounting/reports" },
      { href: "/accounting/reports", label: "Journal Book",        description: "General journal entries",               icon: BookOpen,      iconColor: "text-indigo-600", bg: "bg-indigo-50",  route: "/accounting/reports" },
      { href: "/accounting/reports", label: "Party Summary",       description: "Summarised party balances",             icon: BarChart3,     iconColor: "text-pink-600",   bg: "bg-pink-50",    route: "/accounting/reports" },
      { href: "/accounting/reports", label: "Vendor Summary",      description: "Summarised vendor balances",            icon: Scale,         iconColor: "text-rose-600",   bg: "bg-rose-50",    route: "/accounting/reports" },
      { href: "/accounting/trial-balance", label: "Trial Balance", description: "Account balances at a glance",          icon: ArrowRightLeft,iconColor: "text-slate-600",  bg: "bg-slate-50",   route: "/accounting/trial-balance" },
      { href: "/accounting/reports", label: "Fortnight Ledger",    description: "Fortnightly summary",                   icon: BookOpenText,  iconColor: "text-cyan-600",   bg: "bg-cyan-50",    route: "/accounting/reports" },
      { href: "/accounting/reports", label: "FX Ledger",           description: "Foreign currency entries",              icon: ArrowRightLeft,iconColor: "text-amber-600",  bg: "bg-amber-50",   route: "/accounting/reports" },
      { href: "/accounting/vouchers", label: "Search Vouchers",    description: "Search and filter all vouchers",        icon: FileSearch,    iconColor: "text-gray-600",   bg: "bg-gray-50",    route: "/accounting/vouchers" },
    ],
  },
  {
    title: "Hotel Reports",
    items: [
      { href: "/hotel-invoices",     label: "Hotel Invoices",      description: "All hotel DN invoices",                 icon: Hotel,         iconColor: "text-blue-600",   bg: "bg-blue-50",    route: "/hotel-invoices" },
      { href: "/accounting/reports", label: "Hotel Check-in/Out",  description: "Today's arrivals & departures",         icon: BedDouble,     iconColor: "text-teal-600",   bg: "bg-teal-50",    route: "/accounting/reports" },
      { href: "/accounting/reports", label: "Room Occupancy",      description: "Occupancy status by hotel",             icon: BedDouble,     iconColor: "text-cyan-600",   bg: "bg-cyan-50",    route: "/accounting/reports" },
      { href: "/accounting/reports", label: "Booking Validation",  description: "Verify booking vs payment",             icon: ClipboardCheck,iconColor: "text-green-600",  bg: "bg-green-50",   route: "/accounting/reports" },
      { href: "/accounting/reports", label: "DN Report",           description: "Debit note summary by hotel",           icon: FileBarChart,  iconColor: "text-indigo-600", bg: "bg-indigo-50",  route: "/accounting/reports" },
    ],
  },
  {
    title: "Flight Reports",
    items: [
      { href: "/flights/bsp-report", label: "BSP Report",          description: "Airline settlement report",             icon: Plane,         iconColor: "text-orange-600", bg: "bg-orange-50",  route: "/flights/bsp-report", roles: ["accounts","management","admin","operations"] },
      { href: "/flights/staff-log",  label: "Staff Ticket Log",    description: "Tickets issued by staff",               icon: FileText,      iconColor: "text-amber-600",  bg: "bg-amber-50",   route: "/flights/staff-log" },
      { href: "/flights/cancellations", label: "Cancellations",    description: "Cancelled & refunded tickets",          icon: Receipt,       iconColor: "text-red-600",    bg: "bg-red-50",     route: "/flights/cancellations" },
      { href: "/flights/passengers", label: "Passenger Documents", description: "Passport & CNIC records",               icon: UserCheck,     iconColor: "text-teal-600",   bg: "bg-teal-50",    route: "/flights/passengers", roles: ["management","admin","operations"] },
    ],
  },
  {
    title: "Portal Reports",
    items: [
      { href: "/portal-users",       label: "Portal Registrations",description: "Customer portal sign-ups",              icon: UserCheck,     iconColor: "text-sky-600",    bg: "bg-sky-50",     route: "/portal-users", roles: ["management","admin"] },
      { href: "/booking-inquiries",  label: "Booking Inquiries",   description: "Online booking requests",               icon: ClipboardCheck,iconColor: "text-violet-600", bg: "bg-violet-50",  route: "/booking-inquiries", roles: ["management","admin"] },
    ],
  },
  {
    title: "WhatsApp Reports",
    items: [
      { href: "/whatsapp-inbox",     label: "WhatsApp Inbox",      description: "All incoming messages",                 icon: MessageSquare, iconColor: "text-green-600",  bg: "bg-green-50",   route: "/whatsapp-inbox", roles: ["management","admin"] },
    ],
  },
];

function ReportCard({ item, role }: { item: ReportLink; role: string | undefined }) {
  if (item.roles) {
    if (!item.roles.includes(role ?? "")) return null;
  } else if (item.route && !canAccess(role, item.route)) {
    return null;
  }
  const { href, label, description, icon: Icon, iconColor, bg } = item;
  return (
    <Link href={href}>
      <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-white hover:bg-muted/40 hover:border-teal-300 hover:shadow-sm transition-all cursor-pointer group">
        <div className={`p-2 rounded-lg ${bg} shrink-0`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground group-hover:text-teal-700 transition-colors truncate">{label}</p>
          <p className="text-xs text-muted-foreground truncate">{description}</p>
        </div>
      </div>
    </Link>
  );
}

export default function ReportsPage() {
  const { user } = useAuth();
  const role = user?.role as string | undefined;

  return (
    <div className="space-y-7 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Reports Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">All reports grouped by category. Role-based visibility applies.</p>
      </div>

      {REPORT_SECTIONS.map((section) => {
        const visible = section.items.filter((item) =>
          item.roles ? item.roles.includes(role ?? "") : item.route ? canAccess(role, item.route) : true
        );
        if (!visible.length) return null;
        return (
          <div key={section.title} className="space-y-3">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-blue-800">{section.title}</h2>
              <div className="flex-1 h-px bg-blue-100" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {visible.map((item) => (
                <ReportCard key={item.label} item={item} role={role} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
