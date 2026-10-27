import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { can, isStaffRole, type AppRole, type Permission } from "@/lib/permissions";

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

/** For admin pages: redirects to the admin login when not authorised. */
export async function requireStaffPage(permission: Permission = "orders:read") {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  const roles = await getCurrentRoles();
  if (!isStaffRole(roles)) redirect("/admin/login?error=forbidden");
  if (!can(roles, permission)) redirect("/admin?error=forbidden");
  return { user, roles };
}

/** For server actions / route handlers: throws when not authorised. */
export async function assertPermission(permission: Permission) {
  const user = await getCurrentUser();
  if (!user) throw new AuthorizationError("Please sign in.");
  const roles = await getCurrentRoles();
  if (!can(roles, permission)) throw new AuthorizationError();
  return { user, roles };
}
