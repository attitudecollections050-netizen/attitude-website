// Role model.
// - admin (shown as "Owner"): everything, including Staff Management.
// - staff: orders, fulfilment, customers and feedback (not offered in Staff Management yet).
// - product_staff: the products they added (variants, stock, images) and their own earnings
//   dashboard. Deleting needs the extra "products:delete" grant the owner can switch on per person.
export type AppRole = "admin" | "staff" | "product_staff";

export type Permission =
  | "orders:read"
  | "orders:update"
  | "catalog:write"
  | "products:write"
  | "products:delete"
  | "staff:manage"
  | "earnings:self"
  /** See their own work ratings and Haru's notifications (every staff member, not the owner). */
  | "work:self"
  | "payments:verify"
  | "shipping:write"
  | "discounts:write"
  | "settings:write"
  | "suppliers:write"
  | "messages:read"
  | "customers:read"
  | "feedback:manage"
  | "reports:read";

const MATRIX: Record<AppRole, Permission[]> = {
  admin: [
    "orders:read",
    "orders:update",
    "catalog:write",
    "products:write",
    "products:delete",
    "staff:manage",
    "payments:verify",
    "shipping:write",
    "discounts:write",
    "settings:write",
    "suppliers:write",
    "messages:read",
    "customers:read",
    "feedback:manage",
    "reports:read",
  ],
  // Financial reports and analytics stay admin-only.
  staff: ["orders:read", "orders:update", "messages:read", "customers:read", "feedback:manage", "work:self"],
  product_staff: ["products:write", "earnings:self", "work:self"],
};

export const ROLE_LABELS: Record<AppRole, string> = { admin: "Owner", staff: "Order staff", product_staff: "Product Staff" };
/** Roles the owner can give through Staff Management. */
export const INVITABLE_ROLES = ["product_staff"] as const;

/** Effective permissions for a set of roles, plus per-person extras (e.g. product deletion). */
export function permissionsFor(roles: AppRole[], extras: { canDeleteProducts?: boolean } = {}): Permission[] {
  const out = new Set<Permission>(roles.flatMap((r) => MATRIX[r] ?? []));
  if (roles.includes("product_staff") && extras.canDeleteProducts) out.add("products:delete");
  return [...out];
}

export function can(roles: AppRole[], permission: Permission): boolean {
  return roles.some((r) => MATRIX[r]?.includes(permission));
}

export function isStaffRole(roles: AppRole[]): boolean {
  return roles.includes("admin") || roles.includes("staff") || roles.includes("product_staff");
}

/** First page a person lands on after signing in (everyone on the team starts at /admin). */
export function adminHome(permissions: Permission[]): string {
  if (permissions.includes("orders:read")) return "/admin";
  if (permissions.includes("earnings:self")) return "/admin";
  if (permissions.includes("products:write")) return "/admin/products";
  return "/admin/login?error=forbidden";
}
