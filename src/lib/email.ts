import "server-only";
import { serverSecrets, env } from "@/lib/env";
import { formatMoney } from "@/lib/money";
import { createTranslator } from "next-intl";
import { loadMessages } from "@/lib/intl/messages";
import { DEFAULT_LOCALE, isLocale, localeDir } from "@/lib/intl/config";

/**
 * Sends email through Resend when RESEND_API_KEY and EMAIL_FROM are set.
 * Returns false (and logs) when email is not configured — callers must not
 * assume delivery.
 */
export async function sendEmail(to: string, subject: string, html: string, text: string): Promise<boolean> {
  const { resendApiKey, emailFrom } = serverSecrets();
  if (!resendApiKey || !emailFrom) {
    console.info(`[email] not configured — skipped "${subject}" to ${to.replace(/(.).+@/, "$1***@")}`);
    return false;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: emailFrom, to: [to], subject, html, text }),
  });
  if (!res.ok) {
    console.error("[email] send failed:", res.status, await res.text().catch(() => ""));
    return false;
  }
  return true;
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export interface ConfirmationEmailOrder {
  order_number: string;
  customer_name: string;
  email: string;
  total: number;
  currency: string;
  shipping_fee: number;
  shipping_method_name: string;
  access_token: string;
  /** Language the order was placed in (falls back to English). */
  locale?: string | null;
  items: { product_name: string; variant_label: string | null; quantity: number; line_total: number }[];
}

export async function sendOrderConfirmation(order: ConfirmationEmailOrder) {
  const locale = order.locale && isLocale(order.locale) ? order.locale : DEFAULT_LOCALE;
  const t = createTranslator({ locale, messages: await loadMessages(locale), namespace: "email" });
  const dir = localeDir(locale);
  const link = `${env.siteUrl}/order/${encodeURIComponent(order.order_number)}?token=${order.access_token}`;
  const rows = order.items
    .map(
      (i) =>
        `<tr><td style="padding:6px 0">${esc(i.product_name)}${i.variant_label ? ` <span style="color:#7a6a74">(${esc(i.variant_label)})</span>` : ""} × ${i.quantity}</td><td style="text-align:end">${formatMoney(i.line_total, order.currency)}</td></tr>`,
    )
    .join("");
  const html = `<div dir="${dir}" lang="${locale}" style="font-family:Arial,sans-serif;color:#251923;max-width:560px;margin:auto">
  <h1 style="font-family:Georgia,serif;font-weight:400;letter-spacing:.08em">ATTITUDE COLLECTIONS</h1>
  <p>${esc(t("greeting", { name: order.customer_name }))}</p>
  <p><strong>${esc(t("order", { number: order.order_number }))}</strong></p>
  <table style="width:100%;border-collapse:collapse">${rows}
  <tr><td style="padding-top:10px">${esc(t("delivery", { method: order.shipping_method_name }))}</td><td style="text-align:end;padding-top:10px">${formatMoney(order.shipping_fee, order.currency)}</td></tr>
  <tr><td style="padding-top:10px"><strong>${esc(t("totalPaid"))}</strong></td><td style="text-align:end;padding-top:10px"><strong>${formatMoney(order.total, order.currency)}</strong></td></tr></table>
  <p><a href="${link}" style="color:#D94F91">${esc(t("view"))}</a> · <a href="${env.siteUrl}/track-order" style="color:#D94F91">${esc(t("track"))}</a></p>
  </div>`;
  const text = t("text", { number: order.order_number, total: formatMoney(order.total, order.currency), link });
  return sendEmail(order.email, t("subject", { number: order.order_number }), html, text);
}
