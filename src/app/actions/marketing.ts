"use server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { contactSchema, emailSchema, fieldErrors } from "@/lib/validation";
import { getSettings } from "@/lib/settings";
import { sendEmail } from "@/lib/email";
import { getTranslations } from "next-intl/server";
import { localizeFieldErrors } from "@/lib/intl/server-text";

/** Form messages in the visitor's language. */
async function fm(key: string): Promise<string> {
  return (await getTranslations("forms"))(key);
}

export type FormState = { ok: boolean; message: string; errors?: Record<string, string> } | null;

export async function subscribeNewsletter(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return { ok: false, message: await fm("newsletterUnavailable") };
  if (String(formData.get("company") ?? "") !== "") return { ok: true, message: await fm("subscribed") }; // honeypot
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { ok: false, message: await fm("invalidEmail") };
  if (!(await rateLimit("newsletter", 5, 600))) return { ok: false, message: await fm("tooMany") };
  const { error } = await createServiceClient()
    .from("newsletter_subscribers")
    .upsert({ email: parsed.data, source: "footer", unsubscribed_at: null }, { onConflict: "email", ignoreDuplicates: true });
  if (error && !/duplicate|unique/i.test(error.message)) {
    console.error("[newsletter]", error.message);
    return { ok: false, message: await fm("subscribeFailed") };
  }
  return { ok: true, message: await fm("onTheList") };
}

export async function submitContact(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return { ok: false, message: await fm("contactUnavailable") };
  const parsed = contactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: await fm("checkFields"), errors: await localizeFieldErrors(fieldErrors(parsed.error)) };
  if (parsed.data.website) return { ok: true, message: await fm("messageSent") };
  if (!(await rateLimit("contact", 5, 3600))) return { ok: false, message: await fm("tooManyMessages") };
  const { website: _hp, ...row } = parsed.data;
  void _hp;
  const { error } = await createServiceClient().from("contact_messages").insert({ ...row, order_number: row.order_number || null });
  if (error) {
    console.error("[contact]", error.message);
    return { ok: false, message: await fm("sendFailed") };
  }
  const settings = await getSettings();
  if (settings.store.support_email) {
    const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
    await sendEmail(
      settings.store.support_email,
      `New enquiry: ${row.subject}`,
      `<p><strong>${esc(row.name)}</strong> (${esc(row.email)})${row.order_number ? ` — order ${esc(row.order_number)}` : ""}</p><p>${esc(row.message).replace(/\n/g, "<br>")}</p>`,
      `${row.name} (${row.email}): ${row.message}`,
    ).catch(() => false);
  }
  return { ok: true, message: await fm("messageSentReply") };
}

export async function unsubscribeNewsletter(email: string) {
  const parsed = z.string().email().safeParse(email);
  if (!parsed.success) return;
  await createServiceClient().from("newsletter_subscribers").update({ unsubscribed_at: new Date().toISOString() }).ilike("email", parsed.data);
}
