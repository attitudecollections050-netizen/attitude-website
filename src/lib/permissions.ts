// Role model. Admins can do everything. Staff can work orders & fulfilment only.
export type AppRole = "admin" | "staff";

export type Permission =
  | "orders:read"
  | "orders:update"
  | "catalog:write"
  | "shipping:write"
  | "discounts:write"
  | "settings:write"
  | "suppliers:write"
  | "messages:read";

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
  ],
  staff: ["orders:read", "orders:update", "messages:read"],
};

export function can(roles: AppRole[], permission: Permission): boolean {
  return roles.some((r) => MATRIX[r]?.includes(permission));
}

export function isStaffRole(roles: AppRole[]): boolean {
  return roles.includes("admin") || roles.includes("staff");
}
