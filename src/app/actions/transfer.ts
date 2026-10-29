"use server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured, env } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { getSettings } from "@/lib/settings";
import { toMinor } from "@/lib/money";
import { MAX_IMAGE_BYTES, sniffImageType } from "@/lib/images";
import { normalizeWhatsApp, whatsappUrl } from "@/lib/whatsapp";
import { customerPaidMessage } from "@/lib/payments/bank-transfer";
import { sendEmail } from "@/lib/groundmail";
import { notificationEmail } from "@/lib/emails/templates";

export type TransferClaimState =
  | null
  | { ok: false; message: string; errors?: Record<string, string>; values?: Record<string, string> }
  | { ok: true; message: string; whatsappUrl: string | null; orderUrl: string };

const schema = z.object({
  order_number: z.string().regex(/^AC\d{6,}$/),
  token: z.string().regex(/^[a-f0-9]{48}$/),
  customer_name: z.string().trim().min(2, "Please enter the name on your bank account.").max(120, "That name is too long."),
  amount_paid: z
    .string()
    .trim()
    .transform((v) => toMinor(v))
    .refine((v): v is number => v != null && v > 0 && v <= 100_000_000_00, "Enter the amount you sent, e.g. 47500."),
  transfer_reference: z
    .string()
    .trim()
    .transform((v) => v.replace(/\s+/g, " "))
    .pipe(z.string().min(4, "Please enter the reference from your bank receipt.").max(64, "That reference is too long.").regex(/^[A-Za-z0-9/_.: -]+$/, "Use only letters, numbers and - / _ .")),
  whatsapp: z.string().trim().refine((v) => normalizeWhatsApp(v) != null, "Enter a WhatsApp number we can reach you on, e.g. 0803 123 4567."),
  confirmed: z.literal("on", { error: "Please tick this box once you've completed the transfer." }),
});

const isPdf = (b: Uint8Array) => b.length > 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46; // %PDF

/** The customer tells us they've paid by bank transfer. The owner then confirms it in the dashboard. */
export async function submitTransferClaim(_prev: TransferClaimState, formData: FormData): Promise<TransferClaimState> {
  if (!isSupabaseConfigured()) return { ok: false, message: "Payments aren't available right now. Please contact us." };
  if (!(await rateLimit("transfer-claim", 8, 3600))) return { ok: false, message: "Too many attempts. Please wait a little and try again, or chat with us on WhatsApp." };

  const raw = Object.fromEntries(["order_number", "token", "customer_name", "amount_paid", "transfer_reference", "whatsapp", "confirmed"].map((k) => [k, String(formData.get(k) ?? "").slice(0, 200)]));
  // Sent back on errors so the form keeps what the customer typed.
  const values = { customer_name: raw.customer_name, amount_paid: raw.amount_paid, transfer_reference: raw.transfer_reference, whatsapp: raw.whatsapp, confirmed: raw.confirmed };
  const fail = (message: string, errors?: Record<string, string>): TransferClaimState => ({ ok: false, message, errors, values });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const i of parsed.error.issues) errors[String(i.path[0])] ??= i.message;
    if (errors.order_number || errors.token) return fail("This payment link isn't valid. Please open it again from your order.");
    return fail("Please check the highlighted details.", errors);
  }
  const input = parsed.data;

  const db = createServiceClient();
  const { data: order } = await db
    .from("orders")
    .select("id, order_number, access_token, email, customer_name, total, currency, status, payment_status, payment_method, cart_id")
    .eq("order_number", input.order_number)
    .eq("access_token", input.token)
    .maybeSingle();
  if (!order || order.payment_method !== "bank_transfer") return fail("We couldn't find this order. Please open the link from your order again.");
  const orderUrl = `/order/${order.order_number}?token=${order.access_token}`;
  if (order.payment_status === "paid") return { ok: true, message: "This order is already paid. Thank you!", whatsappUrl: null, orderUrl };
  if (order.status !== "pending_payment") return fail("This order can no longer be paid. Please contact us if you need help.");

  const { data: pending } = await db.from("payment_claims").select("id").eq("order_id", order.id).eq("status", "pending").limit(1);
  if (pending?.length) return fail("We're already checking a transfer for this order. We'll be in touch on WhatsApp shortly.");

  let { data: payment } = await db.from("payments").select("id").eq("order_id", order.id).eq("provider", "bank_transfer").maybeSingle();
  if (!payment) {
    const created = await db
      .from("payments")
      .insert({ order_id: order.id, provider: "bank_transfer", channel: "bank_transfer", reference: `${order.order_number}-TRANSFER`, amount: order.total, currency: order.currency })
      .select("id")
      .single();
    payment = created.data;
  }
  if (!payment) return fail("Something went wrong on our side. Please try again.");

  // Optional receipt screenshot: checked by its actual content, stored privately.
  let proofPath: string | null = null;
  const file = formData.get("proof");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_IMAGE_BYTES) return fail("Please check the highlighted details.", { proof: "That file is larger than 5 MB." });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const img = sniffImageType(bytes);
    const type = isPdf(bytes) ? { mime: "application/pdf", ext: "pdf" } : img && img.ext !== "avif" ? img : null;
    if (!type) return fail("Please check the highlighted details.", { proof: "Upload a JPG, PNG, WebP or PDF screenshot of your receipt." });
    proofPath = `${order.id}/${randomUUID()}.${type.ext}`;
    const { error: upErr } = await db.storage.from("payment-proofs").upload(proofPath, bytes, { contentType: type.mime, upsert: false });
    if (upErr) {
      console.error("[transfer] proof upload:", upErr.message);
      return fail("We couldn't upload your screenshot. You can submit without it and send it on WhatsApp instead.");
    }
  }

  const { error } = await db.from("payment_claims").insert({
    order_id: order.id,
    payment_id: payment.id,
    customer_name: input.customer_name,
    amount_paid: input.amount_paid,
    transfer_reference: input.transfer_reference,
    whatsapp: input.whatsapp,
    proof_path: proofPath,
  });
  if (error) {
    if (proofPath) await db.storage.from("payment-proofs").remove([proofPath]);
    if (error.code === "23505") return fail("Please check the highlighted details.", { transfer_reference: "This reference has already been submitted. Please check it on your bank receipt." });
    console.error("[transfer] claim:", error.message);
    return fail("Something went wrong on our side. Please try again.");
  }

  await db.from("orders").update({ payment_status: "pending" }).eq("id", order.id).in("payment_status", ["unpaid", "failed"]);
  await db.from("order_status_history").insert({ order_id: order.id, status: order.status, public_note: "We've received your transfer details and we're checking them now." });
  // The order is placed, so the bag can be emptied.
  if (order.cart_id) await db.from("cart_items").delete().eq("cart_id", order.cart_id);

  const settings = await getSettings();
  const store = settings.store;
  const amountText = `₦${(input.amount_paid / 100).toLocaleString("en-NG")}`;
  await Promise.all([
    sendEmail({
      to: order.email,
      ...notificationEmail({
        name: input.customer_name.split(" ")[0],
        title: `We've received your payment details for order ${order.order_number}`,
        message: `Thank you! We're checking your transfer of ${amountText} (reference ${input.transfer_reference}) now. This usually takes a few minutes during business hours, and we'll confirm on WhatsApp and by email as soon as it's done.`,
        actionUrl: `${env.siteUrl}${orderUrl}`,
        actionLabel: "View your order",
      }),
      type: "transfer-received",
      idempotencyKey: `transfer-received-${order.order_number}-${input.transfer_reference}`,
    }),
    store.support_email
      ? sendEmail({
          to: store.support_email,
          ...notificationEmail({
            title: `New bank transfer to verify: ${order.order_number}`,
            message: `${input.customer_name} says they sent ${amountText} (order total ₦${(order.total / 100).toLocaleString("en-NG")}).\nReference: ${input.transfer_reference}\nWhatsApp: ${input.whatsapp}\n\nCheck your bank app, then confirm or decline it in the dashboard.`,
            actionUrl: `${env.siteUrl}/admin/transfers`,
            actionLabel: "Review transfer",
          }),
          type: "transfer-to-verify",
        })
      : Promise.resolve(null),
  ]);

  const message = customerPaidMessage({ storeName: store.name, name: input.customer_name, orderNumber: order.order_number, amountKobo: input.amount_paid, reference: input.transfer_reference, whatsapp: input.whatsapp });
  return { ok: true, message: "Thank you! We're verifying your payment.", whatsappUrl: whatsappUrl(store.whatsapp, message), orderUrl };
}
