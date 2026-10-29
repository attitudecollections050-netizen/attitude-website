// Role model.
// - admin (shown as "Owner"): everything, including Staff Management.
// - staff: orders, fulfilment, customers and feedback (not offered in Staff Management yet).
// - product_staff: products, variants, stock and product images only. Deleting products
//   needs the extra "products:delete" grant the owner can switch on per person.
export type AppRole = "admin" | "staff" | "product_staff";

export type Permission =
  | "orders:read"
  | "orders:update"
  | "catalog:write"
  | "products:write"
  | "products:delete"
  | "staff:manage"
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
  staff: ["orders:read", "orders:update", "messages:read", "customers:read", "feedback:manage"],
  product_staff: ["products:write"],
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

/** First admin page a person may open (Product Staff land on Products). */
export function adminHome(permissions: Permission[]): string {
  if (permissions.includes("orders:read")) return "/admin";
  if (permissions.includes("products:write")) return "/admin/products";
  return "/admin/login?error=forbidden";
}
