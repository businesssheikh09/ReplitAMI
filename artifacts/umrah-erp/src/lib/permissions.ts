export type UserRole = "sales" | "accounts" | "management" | "operations" | "admin";

const ALL: UserRole[] = ["sales", "accounts", "management", "operations", "admin"];
const ADMIN_MGMT: UserRole[] = ["management", "admin"];
const NOT_ACCOUNTS: UserRole[] = ["sales", "management", "operations", "admin"];
const FINANCE_FULL: UserRole[] = ["accounts", "management", "admin"];
const FINANCE_OPS: UserRole[] = ["accounts", "management", "operations", "admin"];

// Dashboard: management only (each other role lands on their own first page)
// accounts: Finance only; sales: CRM+Sales+Ops; operations: CRM+Sales+Ops+Finance invoices/expenses
export const ROUTE_PERMISSIONS: Record<string, UserRole[]> = {
  "/dashboard": ADMIN_MGMT,
  "/crm": NOT_ACCOUNTS,
  "/crm/follow-ups": NOT_ACCOUNTS,
  "/quotations": NOT_ACCOUNTS,
  "/hotel-requests": NOT_ACCOUNTS,
  "/hotels": ["management", "operations", "admin"],
  "/vendors": ["management", "operations", "admin"],
  "/transport": NOT_ACCOUNTS,
  "/flights": NOT_ACCOUNTS,
  "/visa": NOT_ACCOUNTS,
  "/accounting": FINANCE_FULL,
  "/accounting/invoices": FINANCE_OPS,
  "/accounting/expenses": FINANCE_OPS,
  "/accounting/hotel-invoice": ALL,
  "/currency-settings": FINANCE_FULL,
  "/users": ADMIN_MGMT,
  "/documents": NOT_ACCOUNTS,
  "/gds-settings": ADMIN_MGMT,
  "/website-settings": ADMIN_MGMT,
};

export function canAccess(role: string | undefined, route: string): boolean {
  if (!role) return false;
  const r = role as UserRole;
  if (r === "management" || r === "admin") return true;
  const exact = ROUTE_PERMISSIONS[route];
  if (exact) return exact.includes(r);
  const prefix = Object.keys(ROUTE_PERMISSIONS)
    .filter((k) => route.startsWith(k + "/"))
    .sort((a, b) => b.length - a.length)[0];
  if (prefix) return ROUTE_PERMISSIONS[prefix].includes(r);
  return false;
}

// Nav items reflect same access as routes
export const NAV_ITEM_ROLES: Record<string, UserRole[]> = {
  "/dashboard": ADMIN_MGMT,
  "/crm": NOT_ACCOUNTS,
  "/crm/follow-ups": NOT_ACCOUNTS,
  "/quotations": NOT_ACCOUNTS,
  "/hotel-requests": NOT_ACCOUNTS,
  "/hotels": ["management", "operations", "admin"],
  "/vendors": ["management", "operations", "admin"],
  "/transport": NOT_ACCOUNTS,
  "/flights": NOT_ACCOUNTS,
  "/visa": NOT_ACCOUNTS,
  "/accounting": FINANCE_FULL,
  "/accounting/invoices": FINANCE_OPS,
  "/accounting/expenses": FINANCE_OPS,
  "/accounting/hotel-invoice": ALL,
  "/currency-settings": FINANCE_FULL,
  "/users": ADMIN_MGMT,
  "/documents": NOT_ACCOUNTS,
  "/gds-settings": ADMIN_MGMT,
  "/website-settings": ADMIN_MGMT,
};

export const ROLE_LABELS: Record<string, string> = {
  management: "Management",
  admin: "Management",
  sales: "Sales",
  accounts: "Accounts",
  operations: "Operations",
};

export const ROLE_COLORS: Record<string, string> = {
  management: "bg-purple-100 text-purple-800",
  admin: "bg-purple-100 text-purple-800",
  sales: "bg-blue-100 text-blue-800",
  accounts: "bg-amber-100 text-amber-800",
  operations: "bg-emerald-100 text-emerald-800",
};
