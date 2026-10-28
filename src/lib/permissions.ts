// Role model. Admins can do everything. Staff can work orders, fulfilment, customers and feedback.
export type AppRole = "admin" | "staff";

export type Permission =
  | "orders:read"
  | "orders:update"
  | "catalog:write"
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
};

export function can(roles: AppRole[], permission: Permission): boolean {
  return roles.some((r) => MATRIX[r]?.includes(permission));
}

export function isStaffRole(roles: AppRole[]): boolean {
  return roles.includes("admin") || roles.includes("staff");
}
