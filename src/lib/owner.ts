import type { AppRole } from "@/lib/permissions";

/** The store owner's sign-in address (also hard-wired in the owner-only database checks). */
export const STORE_OWNER_EMAIL = "attitudecollections050@gmail.com";

/** Owner-only figures (sales revenue) need the owner role AND the owner's address. */
export function isStoreOwner(email: string | null | undefined, roles: AppRole[]): boolean {
  return roles.includes("admin") && (email ?? "").trim().toLowerCase() === STORE_OWNER_EMAIL;
}
