import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock } from "lucide-react";
import { getOrderForCustomer } from "@/lib/orders/queries";
import { formatMoney } from "@/lib/money";
import { formatDeliveryWindow } from "@/lib/shipping/calculator";
import { OrderHistory, OrderProgress, TrackingList } from "@/components/checkout/OrderTimeline";
import { RetryPaymentButton } from "@/components/checkout/RetryPaymentButton";
import { SmartImage } from "@/components/ui/SmartImage";
import { buttonClasses } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";

export const metadata: Metadata = { title: "Your order", robots: { index: false } };

const PAYMENT_LABEL: Record<string, string> = {
  paid: "Paid",
  pending: "Awaiting payment confirmation",
  unpaid: "Not paid",
  failed: "Payment failed",
  refunded: "Refunded",
  partially_refunded: "Partially refunded",
};

export default async function OrderPage({ params, searchParams }: PageProps<"/order/[orderNumber]">) {
  const { orderNumber } = await params;
  const { token } = await searchParams;
  const order = await getOrderForCustomer(orderNumber, typeof token === "string" ? token : null);
  if (!order) notFound();
  const paid = order.payment_status === "paid";
  const a = order.shipping_address;
  const window = formatDeliveryWindow(order.shipping_min_days, order.shipping_max_days);

  return (
    <div className="container-luxe max-w-5xl pb-24 pt-14">
      <Reveal className="text-center">
        {paid ? <CheckCircle2 className="mx-auto size-10 text-rose" aria-hidden /> : <Clock className="mx-auto size-10 text-warning" aria-hidden />}
        <p className="eyebrow mt-5 text-rose-deep">Order {order.order_number}</p>
        <h1 className="display mt-3 text-5xl sm:text-6xl">{paid ? `Thank you, ${order.customer_name.split(" ")[0]}.` : "Your order is awaiting payment"}</h1>
        <p className="mx-auto mt-4 max-w-lg text-sm text-plum-soft">
          {paid
            ? `Your payment has been verified and your order is confirmed. ${"We'll"} email updates to ${order.email}.`
            : "We haven't received a verified payment for this order yet. If you've just paid, refresh this page in a moment."}
        </p>
        {!paid && order.status === "pending_payment" && (
          <div className="mt-6 flex justify-center">
            <RetryPaymentButton orderNumber={order.order_number} token={order.access_token} />
          </div>
        )}
      </Reveal>

      <div className="mt-14 grid gap-10 lg:grid-cols-[1fr_20rem]">
        <section aria-labelledby="items-h">
          <div className="mb-8">
            <OrderProgress status={order.status} />
          </div>
          <h2 id="items-h" className="font-display text-2xl">Items</h2>
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {order.order_items.map((i) => (
              <li key={i.id} className="flex gap-4 py-4">
                <span className="relative h-24 w-18 shrink-0 overflow-hidden bg-neutral">
                  <SmartImage src={i.image_url} alt={i.product_name} fill sizes="72px" className="object-cover" />
                </span>
                <span className="flex-1 text-sm">
                  {i.product_slug ? <Link href={`/products/${i.product_slug}`} className="font-semibold hover:text-rose-deep">{i.product_name}</Link> : <span className="font-semibold">{i.product_name}</span>}
                  {i.variant_label && <span className="block text-xs text-muted">{i.variant_label}</span>}
                  <span className="block text-xs text-muted">Qty {i.quantity} × {formatMoney(i.unit_price, order.currency)}</span>
                </span>
                <span className="text-sm tabular-nums">{formatMoney(i.line_total, order.currency)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-5 ml-auto max-w-xs space-y-1.5 text-sm">
            <Row label="Subtotal" value={formatMoney(order.subtotal, order.currency)} />
            {order.discount_total > 0 && <Row label={`Discount${order.discount_code ? ` (${order.discount_code})` : ""}`} value={`−${formatMoney(order.discount_total, order.currency)}`} />}
            <Row label={`Delivery · ${order.shipping_method_name}`} value={order.shipping_fee === 0 ? "Free" : formatMoney(order.shipping_fee, order.currency)} />
            {order.tax_total > 0 && <Row label="Tax" value={formatMoney(order.tax_total, order.currency)} />}
            <div className="flex justify-between border-t border-line pt-2 text-base font-semibold">
              <dt>{paid ? "Total paid" : "Total due"}</dt>
              <dd className="tabular-nums">{formatMoney(order.total, order.currency)}</dd>
            </div>
          </dl>

          {(order.shipment_tracking.length > 0 || order.order_status_history.length > 0) && (
            <div className="mt-12 grid gap-10 sm:grid-cols-2">
              {order.shipment_tracking.length > 0 && (
                <div>
                  <h2 className="font-display text-2xl">Tracking</h2>
                  <div className="mt-4"><TrackingList tracking={order.shipment_tracking} /></div>
                </div>
              )}
              <div>
                <h2 className="font-display text-2xl">Updates</h2>
                <div className="mt-4">
                  <OrderHistory history={order.order_status_history.map((h) => ({ status: h.status, note: h.public_note, created_at: h.created_at }))} />
                </div>
              </div>
            </div>
          )}
        </section>

        <aside className="space-y-6 text-sm">
          <div className="bg-neutral p-5">
            <h2 className="eyebrow">Payment</h2>
            <p className="mt-2 font-semibold">{PAYMENT_LABEL[order.payment_status] ?? order.payment_status}</p>
          </div>
          <div className="bg-neutral p-5">
            <h2 className="eyebrow">Delivery address</h2>
            <address className="mt-2 not-italic leading-relaxed text-plum-soft">
              {a.full_name}<br />{a.line1}{a.line2 ? <><br />{a.line2}</> : null}<br />{a.city}{a.region ? `, ${a.region}` : ""}{a.postal_code ? ` ${a.postal_code}` : ""}<br />{a.country_code}<br />{a.phone}
            </address>
            <p className="mt-3"><span className="font-semibold">{order.shipping_method_name}</span>{window && <span className="block text-xs text-muted">Estimated {window} after dispatch</span>}</p>
          </div>
          <div className="bg-blush p-5">
            <h2 className="eyebrow text-rose-deep">What happens next</h2>
            <ol className="mt-3 list-decimal space-y-1.5 pl-4 text-plum-soft">
              <li>We prepare your order{paid ? "" : " once payment is confirmed"}.</li>
              <li>When it is dispatched, tracking details appear here and on the tracking page.</li>
              <li>Questions? <Link href="/contact" className="underline">Contact us</Link> with your order number.</li>
            </ol>
          </div>
          <div className="flex flex-col gap-2">
            <Link href={`/track-order?order=${order.order_number}`} className={buttonClasses("outline")}>Track order</Link>
            <Link href="/shop" className={buttonClasses("ghost")}>Continue shopping</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-plum-soft">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
