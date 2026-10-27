import "server-only";
import { z } from "zod";
import { assertPermission, AuthorizationError } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Permission } from "@/lib/permissions";
import type { AdminResult } from "./types";

/**
 * Wraps an admin server action: checks the caller's role on the server, then
 * runs the action with the caller's own Supabase session so Row Level
 * Security is enforced as a second layer.
 */
export async function guarded(
  permission: Permission,
  fn: (ctx: { db: Awaited<ReturnType<typeof createClient>>; userId: string }) => Promise<AdminResult>,
): Promise<AdminResult> {
  try {
    const { user } = await assertPermission(permission);
    const db = await createClient();
    return await fn({ db, userId: user.id });
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false, message: e.message };
    if (e instanceof z.ZodError) return { ok: false, message: e.issues.map((i) => `${i.path.join(".") || "field"}: ${i.message}`).join("; ") };
    // Next.js redirect()/notFound() throw — let those propagate.
    if (e && typeof e === "object" && "digest" in e) throw e;
    console.error("[admin]", e);
    return { ok: false, message: (e as Error).message || "Something went wrong." };
  }
}

export function dbError(error: { message: string; code?: string } | null): AdminResult | null {
  if (!error) return null;
  if (error.code === "23505") return { ok: false, message: "That value already exists (must be unique)." };
  if (error.code === "23503") return { ok: false, message: "This item is still in use elsewhere and can't be removed." };
  if (error.code === "23514") return { ok: false, message: "A value is outside the allowed range." };
  if (error.code === "42501") return { ok: false, message: "You don't have permission to do that." };
  return { ok: false, message: error.message };
}

export const str = (max = 500) => z.string().trim().max(max);
export const optStr = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));
export const bool = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());
export const uuid = z.string().uuid();
export const slug = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens.");
export const intStr = (min = 0, max = 1_000_000) => z.coerce.number().int().min(min).max(max);
export const optInt = (min = 0, max = 1_000_000) =>
  z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().min(min).max(max).nullable());

/** Money entered in major units (₦4,000 or 4000.50) → minor units. */
export const money = z.preprocess(
  (v) => (typeof v === "string" ? v.replace(/[,\s₦]/g, "") : v),
  z.string().regex(/^\d+(\.\d{1,2})?$/, "Enter an amount like 4000 or 4000.50").transform((s) => Math.round(Number(s) * 100)),
);
export const optMoney = z.preprocess(
  (v) => (typeof v === "string" ? v.replace(/[,\s₦]/g, "") : v),
  z.union([z.literal(""), z.undefined(), z.string().regex(/^\d+(\.\d{1,2})?$/, "Enter an amount like 4000")]).transform((s) => (s ? Math.round(Number(s) * 100) : null)),
);

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}
