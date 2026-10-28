"use server";
import { createServiceClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { env, isPaystackConfigured, isSupabaseConfigured } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { checkoutSchema, fieldErrors } from "@/lib/validation";
import { getCartId, priceCart } from "@/lib/cart/server";
import { cartWeight } from "@/lib/cart/assess";
import { loadShippingConfig } from "@/lib/shipping/service";
import { calculateShipping } from "@/lib/shipping/calculator";
import { buildOrderPayload, orderErrorKey } from "@/lib/orders/build";
import { getTranslations } from "next-intl/server";
import { localizeFieldErrors, localizeShippingError } from "@/lib/intl/server-text";
import { getPreferences } from "@/lib/intl/preferences";
import { getDisplayRates } from "@/lib/currency/rates";
import { convertFromNgn } from "@/lib/currency/convert";
import { generatePaymentReference, initializeTransaction, PaystackError } from "@/lib/payments/paystack";
import { consentedVisitorId } from "@/lib/analytics/server";

export type PlaceOrderResult =
  | { ok: true; redirectUrl: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string>; refreshCart?: boolean };

const PAYMENT_LINK_REUSE_MS = 25 * 60 * 1000;

/**
 * Places an order from the server-side cart. Every amount — item prices,
 * discount, shipping and total — is recalculated here from the database.
 */
export async function placeOrder(input: unknown): Promise<PlaceOrderResult> {
  const t = await getTranslations("checkoutErrors");
  if (!isSupabaseConfigured()) return { ok: false, error: t("unavailable") };
  if (!isPaystackConfigured()) {
    return { ok: false, error: t("paymentsOff") };
  }
  if (!(await rateLimit("place-order", 10, 600))) return { ok: false, error: t("tooMany") };

  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: t("checkFields"), fieldErrors: await localizeFieldErrors(fieldErrors(parsed.error)) };
  const data = parsed.data;

  const [settings, user] = await Promise.all([getSettings(), getCurrentUser()]);
  if (!user && !settings.checkout.guest_checkout_enabled) return { ok: false, error: t("signIn") };

  const cartId = await getCartId();
  if (!cartId) return { ok: false, error: t("emptyBag"), refreshCart: true };
  const priced = await priceCart(cartId);
  if (priced.lines.length === 0) return { ok: false, error: t("emptyBag"), refreshCart: true };
  if (priced.discount && !priced.discount.ok) {
    const tc = await getTranslations("cart");
    const reason = priced.discount.reasonCode ? tc(`discountErrors.${priced.discount.reasonCode}`, { min: priced.discount.minSubtotal ? `₦${(priced.discount.minSubtotal / 100).toLocaleString("en-NG")}` : "" }) : priced.discount.reason;
    return { ok: false, error: t("discountProblem", { reason }), refreshCart: true };
  }

  // Shipping is recalculated from the database — the browser only sends which option was picked.
  const discountAmount = priced.discount?.ok ? priced.discount.amount : 0;
  const shippingConfig = await loadShippingConfig(data.address.country_code);
  const quote = calculateShipping({
    address: data.address,
    ...shippingConfig,
    cart: { subtotalAfterDiscount: priced.subtotal - discountAmount, weightGrams: cartWeight(priced.lines) },
    storeCurrency: settings.store.currency,
  });
  if (!quote.ok) {
    const message = await localizeShippingError(quote);
    return { ok: false, error: message, fieldErrors: quote.code === "invalid_address" ? { "address.region": message } : undefined };
  }
  const shipping = quote.options.find((o) => o.rateId === data.shipping_rate_id);
  if (!shipping) return { ok: false, error: t("optionsChanged") };

  const regionName = shippingConfig.regions.find((r) => r.code === data.address.region)?.name ?? data.address.region;

  let payload;
  try {
    payload = buildOrderPayload({
      cartId,
      userId: user?.id ?? null,
      email: data.email,
      address: data.address,
      regionName,
      deliveryInstructions: data.delivery_instructions,
      lines: priced.lines,
      discount: priced.discount,
      shipping,
      tax: settings.tax,
      currency: settings.store.currency,
      nonce: data.nonce,
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message, refreshCart: true };
  }

  const db = createServiceClient();
  const { data: created, error } = await db.rpc("create_order", { p_order: payload.order, p_items: payload.items });
  if (error || !created) {
    console.error("[checkout] create_order:", error?.message);
    return { ok: false, error: t(orderErrorKey(error?.message ?? "")), refreshCart: true };
  }
  const order = created as { order_id: string; order_number: string; access_token: string; total: number; currency: string; payment_status: string };

  if (order.payment_status === "paid") {
    return { ok: true, redirectUrl: `/order/${order.order_number}?token=${order.access_token}` };
  }

  // Lets the verified payment be attributed to this visitor in analytics (consented visitors only).
  const visitorId = await consentedVisitorId();
  if (visitorId) await db.from("orders").update({ analytics_visitor_id: visitorId }).eq("id", order.order_id).is("analytics_visitor_id", null);

  // Snapshot of what the shopper saw: display currency + rate at order time (never changes later).
  const [prefs, rates] = await Promise.all([getPreferences(), getDisplayRates()]);
  const displayTotal = convertFromNgn(order.total, prefs.currency, rates);
  await db
    .from("orders")
    .update({
      locale: prefs.locale,
      display_currency: displayTotal != null ? prefs.currency : "NGN",
      display_rate: displayTotal != null ? (prefs.currency === "NGN" ? 1 : rates.rates[prefs.currency]) : 1,
      display_total: displayTotal ?? order.total / 100,
    })
    .eq("id", order.order_id)
    .is("display_currency", null);

  if (data.save_address && user) {
    const { count } = await db.from("addresses").select("id", { count: "exact", head: true }).eq("user_id", user.id);
    if ((count ?? 0) < 10) {
      await db.from("addresses").insert({ user_id: user.id, ...data.address, is_default: (count ?? 0) === 0 });
    }
  }

  return startPayment(order, channelsFor(settings.intl.payment_channels, data.address.country_code));
}

/** Paystack channels configured for the delivery country (falls back to the "default" list). */
function channelsFor(map: Record<string, string[]> | undefined, country: string): string[] | undefined {
  const list = map?.[country] ?? map?.default;
  return list && list.length ? list : undefined;
}

async function startPayment(order: { order_id: string; order_number: string; access_token: string; total: number; currency: string }, channels?: string[]): Promise<PlaceOrderResult> {
  const t = await getTranslations("checkoutErrors");
  const db = createServiceClient();
  // Re-use a recent payment link instead of creating duplicate transactions (double-clicks, retries).
  const { data: recent } = await db
    .from("payments")
    .select("authorization_url, created_at")
    .eq("order_id", order.order_id)
    .eq("status", "initialized")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recent?.authorization_url && Date.now() - new Date(recent.created_at).getTime() < PAYMENT_LINK_REUSE_MS) {
    return { ok: true, redirectUrl: recent.authorization_url };
  }

  const { data: full } = await db.from("orders").select("email, total, currency").eq("id", order.order_id).single();
  if (!full) return { ok: false, error: t("notFound") };
  const reference = generatePaymentReference(order.order_number);
  const { error: insertError } = await db.from("payments").insert({ order_id: order.order_id, reference, amount: full.total, currency: full.currency });
  if (insertError) return { ok: false, error: t("startFailed") };

  try {
    const init = await initializeTransaction({
      email: full.email,
      amount: full.total,
      currency: full.currency,
      reference,
      callbackUrl: `${env.siteUrl}/checkout/callback`,
      metadata: { order_id: order.order_id, order_number: order.order_number },
      channels,
    });
    await db.from("payments").update({ authorization_url: init.authorizationUrl }).eq("reference", reference);
    await db.from("orders").update({ payment_status: "pending" }).eq("id", order.order_id).in("payment_status", ["unpaid", "failed"]);
    return { ok: true, redirectUrl: init.authorizationUrl };
  } catch (e) {
    await db.from("payments").update({ status: "failed", failure_reason: "initialize_failed" }).eq("reference", reference);
    console.error("[checkout] paystack init:", (e as Error).message);
    return {
      ok: false,
      error: e instanceof PaystackError ? t("providerFailed") : t("startFailed"),
    };
  }
}

/** Retry payment for an unpaid order the visitor can prove access to. */
export async function retryPayment(orderNumber: string, accessToken: string): Promise<PlaceOrderResult> {
  const t = await getTranslations("checkoutErrors");
  if (!isSupabaseConfigured() || !isPaystackConfigured()) return { ok: false, error: t("paymentsUnavailable") };
  if (!/^AC\d{6,}$/.test(orderNumber) || !/^[a-f0-9]{48}$/.test(accessToken)) return { ok: false, error: t("notFound") };
  if (!(await rateLimit("retry-payment", 10, 600))) return { ok: false, error: t("tooMany") };
  const db = createServiceClient();
  const { data: order } = await db
    .from("orders")
    .select("id, order_number, access_token, total, currency, status, payment_status, shipping_address")
    .eq("order_number", orderNumber)
    .eq("access_token", accessToken)
    .maybeSingle();
  if (!order) return { ok: false, error: t("notFound") };
  if (order.payment_status === "paid") return { ok: true, redirectUrl: `/order/${order.order_number}?token=${order.access_token}` };
  if (order.status !== "pending_payment") return { ok: false, error: t("cannotPay") };
  const settings = await getSettings();
  const country = (order.shipping_address as { country_code?: string } | null)?.country_code ?? "";
  return startPayment({ order_id: order.id, order_number: order.order_number, access_token: order.access_token, total: order.total, currency: order.currency }, channelsFor(settings.intl.payment_channels, country));
}
