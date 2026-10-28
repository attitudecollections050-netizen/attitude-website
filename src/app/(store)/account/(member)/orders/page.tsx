import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import type { OrderStatus } from "@/lib/orders/status";
import { getLocale, getTranslations } from "next-intl/server";
import { buttonClasses } from "@/components/ui/Button";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("account"))("orderHistory"), robots: { index: false } };
}

export default async function OrdersPage() {
  const user = await requireUser("/account/orders");
  const supabase = await createClient();
  const [t, ts, locale] = await Promise.all([getTranslations("account"), getTranslations("orderStatus"), getLocale()]);
  // RLS already limits customers to their own orders; the explicit filter also keeps
  // staff accounts (who may read every order) to their personal history here.
  const { data: orders } = await supabase
    .from("orders")
    .select("order_number, created_at, status, payment_status, total, currency, order_items ( id )")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <section>
      <h2 className="font-display text-3xl">{t("orderHistory")}</h2>
      {!orders || orders.length === 0 ? (
        <div className="mt-6 bg-neutral p-8 text-center">
          <p className="text-sm text-plum-soft">{t("noOrders")}</p>
          <Link href="/shop" className={buttonClasses("primary", "md", "mt-5")}>{t("startShopping")}</Link>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-[0.15em] text-muted">
                <th className="py-3 font-semibold">{t("colOrder")}</th>
                <th className="py-3 font-semibold">{t("colDate")}</th>
                <th className="py-3 font-semibold">{t("colStatus")}</th>
                <th className="py-3 font-semibold">{t("colItems")}</th>
                <th className="py-3 text-right font-semibold">{t("colTotal")}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.order_number} className="border-b border-line">
                  <td className="py-4">
                    <Link href={`/order/${o.order_number}`} className="font-semibold underline-offset-4 hover:text-rose-deep hover:underline">{o.order_number}</Link>
                  </td>
                  <td className="py-4 text-plum-soft">{new Date(o.created_at).toLocaleDateString(locale, { dateStyle: "medium", timeZone: "Africa/Lagos" })}</td>
                  <td className="py-4">{o.payment_status === "paid" || o.status !== "pending_payment" ? ts(o.status as OrderStatus) : t("awaitingPayment")}</td>
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
