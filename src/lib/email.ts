import "server-only";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/groundmail";
import { receiptEmail } from "@/lib/emails/templates";
import { formatMoney } from "@/lib/money";
import { createTranslator } from "next-intl";
import { loadMessages } from "@/lib/intl/messages";
import { DEFAULT_LOCALE, isLocale, localeDir } from "@/lib/intl/config";

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

/** Order receipt in the language the order was placed in. Sent at most once per order. */
export async function sendOrderConfirmation(order: ConfirmationEmailOrder): Promise<boolean> {
  const locale = order.locale && isLocale(order.locale) ? order.locale : DEFAULT_LOCALE;
  const t = createTranslator({ locale, messages: await loadMessages(locale), namespace: "email" });
  const link = `${env.siteUrl}/order/${encodeURIComponent(order.order_number)}?token=${order.access_token}`;
  const total = formatMoney(order.total, order.currency);
  const content = receiptEmail({
    orderNumber: order.order_number,
    customerName: order.customer_name,
    lines: order.items.map((i) => ({ name: i.product_name, detail: i.variant_label, quantity: i.quantity, amount: formatMoney(i.line_total, order.currency) })),
    extras: [{ label: t("delivery", { method: order.shipping_method_name }), amount: formatMoney(order.shipping_fee, order.currency) }],
    total,
    link,
    trackLink: `${env.siteUrl}/track-order`,
    labels: {
      subject: t("subject", { number: order.order_number }),
      greeting: t("greeting", { name: order.customer_name }),
      heading: t("order", { number: order.order_number }),
      total: t("totalPaid"),
      view: t("view"),
      track: t("track"),
      text: t("text", { number: order.order_number, total, link }),
    },
    dir: localeDir(locale),
    lang: locale,
  });
  // The payment webhook and the customer's return page can both finish an order;
  // a fixed key means Groundmail sends the receipt only once.
  const res = await sendEmail({ to: order.email, ...content, type: "receipt", idempotencyKey: `receipt-${order.order_number}`, tags: { order: order.order_number } });
  return res.ok;
}
