import "server-only";
import { createServiceClient } from "@/lib/supabase/admin";
import { sendOrderConfirmation } from "@/lib/email";
import { processPaymentReference, type FinalizeResult, type PaymentDeps } from "./process";
import { verifyTransaction, type PaystackVerification } from "./paystack";

async function finalize(v: PaystackVerification): Promise<FinalizeResult> {
  const { data, error } = await createServiceClient().rpc("finalize_payment", {
    p_reference: v.reference,
    p_amount: v.amount,
    p_currency: v.currency,
    p_provider_transaction_id: String(v.id),
    p_channel: v.channel,
    p_paid_at: v.paid_at,
    p_raw: v.raw,
  });
  if (error) throw error;
  return data as FinalizeResult;
}

async function recordFailure(reference: string, reason: string, raw: unknown): Promise<FinalizeResult> {
  const { data, error } = await createServiceClient().rpc("record_payment_failure", {
    p_reference: reference,
    p_reason: reason,
    p_raw: raw,
  });
  if (error) throw error;
  return data as FinalizeResult;
}

async function onFirstPaid(result: FinalizeResult) {
  if (!result.order_id) return;
  const db = createServiceClient();
  const { data: order } = await db
    .from("orders")
    .select("order_number, customer_name, email, total, currency, shipping_fee, shipping_method_name, access_token, cart_id, order_items(product_name, variant_label, quantity, line_total)")
    .eq("id", result.order_id)
    .single();
  if (!order) return;
  if (order.cart_id) {
    await db.from("cart_items").delete().eq("cart_id", order.cart_id);
    await db.from("carts").update({ discount_code: null }).eq("id", order.cart_id);
  }
  await sendOrderConfirmation({ ...order, items: order.order_items });
}

export const livePaymentDeps: PaymentDeps = { verify: verifyTransaction, finalize, recordFailure, onFirstPaid };

export function processPayment(reference: string) {
  return processPaymentReference(reference, livePaymentDeps);
}
