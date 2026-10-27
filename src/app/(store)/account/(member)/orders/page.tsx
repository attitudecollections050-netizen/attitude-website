import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import { CUSTOMER_STATUS_LABELS, type OrderStatus } from "@/lib/orders/status";
import { buttonClasses } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Order history", robots: { index: false } };

export default async function OrdersPage() {
  const supabase = await createClient();
  // RLS limits this to the signed-in customer's own orders.
  const { data: orders } = await supabase
    .from("orders")
    .select("order_number, created_at, status, payment_status, total, currency, order_items ( id )")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <section>
      <h2 className="font-display text-3xl">Order history</h2>
      {!orders || orders.length === 0 ? (
        <div className="mt-6 bg-neutral p-8 text-center">
          <p className="text-sm text-plum-soft">You haven&apos;t placed any orders with this account yet.</p>
          <Link href="/shop" className={buttonClasses("primary", "md", "mt-5")}>Start shopping</Link>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-[0.15em] text-muted">
                <th className="py-3 font-semibold">Order</th>
                <th className="py-3 font-semibold">Date</th>
                <th className="py-3 font-semibold">Status</th>
                <th className="py-3 font-semibold">Items</th>
                <th className="py-3 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.order_number} className="border-b border-line">
                  <td className="py-4">
                    <Link href={`/order/${o.order_number}`} className="font-semibold underline-offset-4 hover:text-rose-deep hover:underline">{o.order_number}</Link>
                  </td>
                  <td className="py-4 text-plum-soft">{new Date(o.created_at).toLocaleDateString("en-NG", { dateStyle: "medium" })}</td>
                  <td className="py-4">{o.payment_status === "paid" || o.status !== "pending_payment" ? CUSTOMER_STATUS_LABELS[o.status as OrderStatus] : "Awaiting payment"}</td>
                  <td className="py-4">{o.order_items?.length ?? 0}</td>
                  <td className="py-4 text-right tabular-nums">{formatMoney(o.total, o.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
