"use server";
import { restoreProfilePreferences } from "./preferences";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { env, isSupabaseConfigured } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { attachCartToUser } from "@/lib/cart/server";
import { emailSchema, fieldErrors, loginSchema, passwordSchema, registerSchema, safeNextPath, addressSchema, phoneSchema } from "@/lib/validation";
import { getCurrentUser } from "@/lib/auth";
import type { AppRole } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { localizeFieldErrors, localizeMessage } from "@/lib/intl/server-text";

/** Account messages in the shopper's language. */
async function am(key: string): Promise<string> {
  return (await getTranslations("auth"))(key);
}

export type AuthState = { ok: boolean; message: string; errors?: Record<string, string> } | null;

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!isSupabaseConfigured()) return { ok: false, message: await am("unavailable") };
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { ok: false, message: await am("checkDetails"), errors: await localizeFieldErrors(fieldErrors(parsed.error)) };
  if (!(await rateLimit("login", 8, 600))) return { ok: false, message: await am("tooManySignIn") };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    if (error?.code === "email_not_confirmed") return { ok: false, message: await am("confirmEmail") };
    return { ok: false, message: await am("incorrect") };
  }
  await attachCartToUser(data.user.id).catch((e) => console.error("[auth] cart merge:", e.message));
  await restoreProfilePreferences(data.user.id).catch((e) => console.error("[auth] preferences:", e.message));
  // The owner and staff go to their dashboard unless the sign-in asked for a specific page.
  const requested = formData.get("next");
  let destination = safeNextPath(requested);
  if (!requested || destination === "/account") {
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    const list = (roles ?? []).map((r) => r.role as AppRole);
    // Owner and order staff → the dashboard; Product Staff → their own dashboard.
    if (list.includes("admin") || list.includes("staff")) destination = "/admin";
    else if (list.includes("product_staff")) destination = "/staff/dashboard";
  }
  redirect(destination);
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!isSupabaseConfigured()) return { ok: false, message: await am("unavailable") };
  const parsed = registerSchema.safeParse({ full_name: formData.get("full_name"), email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { ok: false, message: await am("checkDetails"), errors: await localizeFieldErrors(fieldErrors(parsed.error)) };
  if (!(await rateLimit("register", 5, 3600))) return { ok: false, message: await am("tooMany") };
  const next = safeNextPath(formData.get("next"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.full_name }, emailRedirectTo: `${env.siteUrl}/auth/confirm?next=${encodeURIComponent(next)}` },
  });
  if (error) {
    return { ok: false, message: error.code === "weak_password" ? await am("weakPassword") : await am("createFailed") };
  }
  if (data.session && data.user) {
    await attachCartToUser(data.user.id).catch(() => {});
    redirect(next);
  }
  // Email confirmation enabled (recommended): same response whether or not the email already exists.
  return { ok: true, message: await am("checkEmail") };
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/");
}

export async function requestPasswordReset(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!isSupabaseConfigured()) return { ok: false, message: await am("unavailable") };
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { ok: false, message: await am("invalidEmail") };
  if (!(await rateLimit("reset", 5, 3600))) return { ok: false, message: await am("tooMany") };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data, { redirectTo: `${env.siteUrl}/auth/confirm?next=/account/reset-password` });
  return { ok: true, message: await am("resetSent") };
}

export async function updatePassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: await am("resetExpired") };
  const parsed = passwordSchema.safeParse(formData.get("password"));
  if (!parsed.success) return { ok: false, message: await localizeMessage(parsed.error.issues[0].message) };
  if (formData.get("password") !== formData.get("confirm")) return { ok: false, message: await am("passwordsMismatch") };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) return { ok: false, message: await am("passwordFailed") };
  return { ok: true, message: await am("passwordUpdated") };
}

export async function updateProfile(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: await am("signInAgain") };
  const parsed = z
    .object({ full_name: z.string().trim().min(2, "Enter your name.").max(120), phone: z.union([phoneSchema, z.literal("")]), marketing_opt_in: z.boolean() })
    .safeParse({ full_name: formData.get("full_name"), phone: formData.get("phone") ?? "", marketing_opt_in: formData.get("marketing_opt_in") === "on" });
  if (!parsed.success) return { ok: false, message: await am("checkDetails"), errors: await localizeFieldErrors(fieldErrors(parsed.error)) };
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.full_name, phone: parsed.data.phone || null, marketing_opt_in: parsed.data.marketing_opt_in })
    .eq("id", user.id);
  if (error) return { ok: false, message: await am("profileFailed") };
  revalidatePath("/account");
  return { ok: true, message: await am("profileSaved") };
}

export async function saveAddress(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: await am("signInAgain") };
  const parsed = addressSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: await am("checkAddress"), errors: await localizeFieldErrors(fieldErrors(parsed.error)) };
  const label = String(formData.get("label") ?? "").trim().slice(0, 40) || null;
  const isDefault = formData.get("is_default") === "on";
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  if (isDefault) await supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id);
  const row = { ...parsed.data, label, is_default: isDefault, user_id: user.id };
  const { error } = id && z.string().uuid().safeParse(id).success
    ? await supabase.from("addresses").update(row).eq("id", id).eq("user_id", user.id)
    : await supabase.from("addresses").insert(row);
  if (error) return { ok: false, message: await am("addressFailed") };
  revalidatePath("/account/addresses");
  return { ok: true, message: await am("addressSaved") };
}

export async function deleteAddress(formData: FormData) {
  const user = await getCurrentUser();
  const id = String(formData.get("id") ?? "");
  if (!user || !z.string().uuid().safeParse(id).success) return;
  const supabase = await createClient();
  await supabase.from("addresses").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/account/addresses");
}
