import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { adminHome, permissionsFor, type AppRole, type Permission } from "@/lib/permissions";

/** The authenticated user, verified with Supabase Auth (not just the cookie). */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
});

export const getCurrentRoles = cache(async (): Promise<AppRole[]> => {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  return (data ?? []).map((r) => r.role as AppRole);
});

/** The signed-in person's staff record (Product Staff), if any. */
export const getStaffRecord = cache(async (): Promise<{ status: string; can_delete_products: boolean } | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("staff_members").select("status, can_delete_products").eq("user_id", user.id).maybeSingle();
  return data ?? null;
});

/**
 * Everything the signed-in person may do in the admin, checked against the database on
 * every request. Product Staff whose access was disabled get nothing.
 */
export const getCurrentPermissions = cache(async (): Promise<Permission[]> => {
  let roles = await getCurrentRoles();
  let canDeleteProducts = false;
  if (roles.includes("product_staff")) {
    const staff = await getStaffRecord();
    if (!staff || staff.status === "disabled") roles = roles.filter((r) => r !== "product_staff");
    else canDeleteProducts = staff.can_delete_products;
  }
  return permissionsFor(roles, { canDeleteProducts });
});

export async function requireUser(next = "/account"): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(`/account/login?next=${encodeURIComponent(next)}`);
  return user;
}

export class AuthorizationError extends Error {
  constructor(message = "You are not allowed to perform this action.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/**
 * For admin pages: redirects to the admin login when not signed in or not staff, and to the
 * person's own admin home when they lack this page's permission. Pass null for "any staff".
 */
export async function requireStaffPage(permission: Permission | null = "orders:read") {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  const [roles, permissions] = await Promise.all([getCurrentRoles(), getCurrentPermissions()]);
  if (permissions.length === 0) redirect("/admin/login?error=forbidden");
  // Invited staff choose their own password before using the dashboard.
  if (roles.includes("product_staff") && (await getStaffRecord())?.status === "invited") redirect("/auth/set-password");
  if (permission && !permissions.includes(permission)) {
    const home = adminHome(permissions);
    redirect(home === "/admin" ? "/admin?error=forbidden" : home);
  }
  return { user, roles, permissions };
}

/** For server actions / route handlers: throws when not authorised. */
export async function assertPermission(permission: Permission) {
  const user = await getCurrentUser();
  if (!user) throw new AuthorizationError("Please sign in.");
  const [roles, permissions] = await Promise.all([getCurrentRoles(), getCurrentPermissions()]);
  if (!permissions.includes(permission)) throw new AuthorizationError();
  return { user, roles, permissions };
}
