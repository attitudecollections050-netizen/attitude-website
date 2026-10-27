import "server-only";
import { serverSecrets, env } from "@/lib/env";
import { formatMoney } from "@/lib/money";

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
  items: { product_name: string; variant_label: string | null; quantity: number; line_total: number }[];
}

export async function sendOrderConfirmation(order: ConfirmationEmailOrder) {
  const link = `${env.siteUrl}/order/${encodeURIComponent(order.order_number)}?token=${order.access_token}`;
  const rows = order.items
    .map(
      (i) =>
        `<tr><td style="padding:6px 0">${esc(i.product_name)}${i.variant_label ? ` <span style="color:#7a6a74">(${esc(i.variant_label)})</span>` : ""} × ${i.quantity}</td><td style="text-align:right">${formatMoney(i.line_total, order.currency)}</td></tr>`,
    )
    .join("");
  const html = `<div style="font-family:Arial,sans-serif;color:#251923;max-width:560px;margin:auto">
  <h1 style="font-family:Georgia,serif;font-weight:400;letter-spacing:.08em">ATTITUDE COLLECTIONS</h1>
  <p>Hi ${esc(order.customer_name)}, thank you for your order. Your payment has been confirmed.</p>
  <p><strong>Order ${esc(order.order_number)}</strong></p>
  <table style="width:100%;border-collapse:collapse">${rows}
  <tr><td style="padding-top:10px">Delivery (${esc(order.shipping_method_name)})</td><td style="text-align:right;padding-top:10px">${formatMoney(order.shipping_fee, order.currency)}</td></tr>
  <tr><td style="padding-top:10px"><strong>Total paid</strong></td><td style="text-align:right;padding-top:10px"><strong>${formatMoney(order.total, order.currency)}</strong></td></tr></table>
  <p><a href="${link}" style="color:#D94F91">View your order</a> · <a href="${env.siteUrl}/track-order" style="color:#D94F91">Track your order</a></p>
  </div>`;
  const text = `Thank you for your order ${order.order_number}. Total paid: ${formatMoney(order.total, order.currency)}. View it at ${link}`;
  return sendEmail(order.email, `Order ${order.order_number} confirmed`, html, text);
}
