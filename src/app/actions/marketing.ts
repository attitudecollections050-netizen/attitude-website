"use server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { contactSchema, emailSchema, fieldErrors } from "@/lib/validation";
import { getSettings } from "@/lib/settings";
import { sendEmail } from "@/lib/email";

export type FormState = { ok: boolean; message: string; errors?: Record<string, string> } | null;

export async function subscribeNewsletter(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return { ok: false, message: "Newsletter sign-up is not available yet." };
  if (String(formData.get("company") ?? "") !== "") return { ok: true, message: "Thank you for subscribing." }; // honeypot
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { ok: false, message: "Please enter a valid email address." };
  if (!(await rateLimit("newsletter", 5, 600))) return { ok: false, message: "Too many attempts. Please try again later." };
  const { error } = await createServiceClient()
    .from("newsletter_subscribers")
    .upsert({ email: parsed.data, source: "footer", unsubscribed_at: null }, { onConflict: "email", ignoreDuplicates: true });
  if (error && !/duplicate|unique/i.test(error.message)) {
    console.error("[newsletter]", error.message);
    return { ok: false, message: "We couldn't subscribe you right now. Please try again." };
  }
  return { ok: true, message: "Thank you — you're on the list." };
}

export async function submitContact(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return { ok: false, message: "The contact form is not available yet." };
  const parsed = contactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Please correct the highlighted fields.", errors: fieldErrors(parsed.error) };
  if (parsed.data.website) return { ok: true, message: "Thank you — your message has been sent." };
  if (!(await rateLimit("contact", 5, 3600))) return { ok: false, message: "Too many messages. Please try again later." };
  const { website: _hp, ...row } = parsed.data;
  void _hp;
  const { error } = await createServiceClient().from("contact_messages").insert({ ...row, order_number: row.order_number || null });
  if (error) {
    console.error("[contact]", error.message);
    return { ok: false, message: "We couldn't send your message. Please try again." };
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
  return { ok: true, message: "Thank you — your message has been sent. We'll reply by email." };
}

export async function unsubscribeNewsletter(email: string) {
  const parsed = z.string().email().safeParse(email);
  if (!parsed.success) return;
  await createServiceClient().from("newsletter_subscribers").update({ unsubscribed_at: new Date().toISOString() }).ilike("email", parsed.data);
}
