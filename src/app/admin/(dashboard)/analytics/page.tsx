import Link from "next/link";
import { Download } from "lucide-react";
import { requireStaffPage } from "@/lib/auth";
import { formatMoney, STORE_CURRENCY } from "@/lib/money";
import { REPORT_TZ_LABEL, bucketLabel, localToday, periodQuery, resolvePeriod } from "@/lib/analytics/periods";
import { loadAnalyticsReport, pct, type SalesRow } from "@/lib/analytics/report";
import { Card, PageHeader, Table } from "@/components/admin/ui";
import { Notice } from "@/components/ui/Notice";
import { PeriodFilter } from "@/components/admin/analytics/PeriodFilter";
import { BarList, Stat } from "@/components/admin/analytics/Stat";
import { OrdersChart, RevenueChart, TrafficChart } from "@/components/admin/analytics/Charts";

export const metadata = { title: "Analytics & Reports" };

const EMPTY_SALES = (currency: string): SalesRow => ({
  currency, paid_orders: 0, qualifying_orders: 0, gross_sales: 0, discounts: 0, refunds: 0, cancellations: 0, net_sales: 0,
  shipping: 0, tax: 0, revenue: 0, refunded_to_customers: 0, refunded_orders: 0, cancelled_paid_orders: 0, average_order_value: 0,
});

const SOURCE_LABELS: Record<string, string> = { direct: "Direct / unknown", search: "Search engines", social: "Social media", email: "Email", paid: "Paid ads", referral: "Other websites", campaign: "Tagged campaigns (UTM)" };
const DEVICE_LABELS: Record<string, string> = { mobile: "Mobile", tablet: "Tablet", desktop: "Desktop", unknown: "Unknown" };

export default async function AnalyticsPage({ searchParams }: PageProps<"/admin/analytics">) {
  await requireStaffPage("reports:read");
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const period = resolvePeriod({ period: one(sp.period), from: one(sp.from), to: one(sp.to), bucket: one(sp.bucket) });
  const { report: r, error } = await loadAnalyticsReport(period);
  const qs = periodQuery(period);

  const header = (
    <>
      <PageHeader
        title="Analytics & Reports"
        description={`Sales, payments and store traffic for ${period.label.toLowerCase()} (${period.from} to ${period.to}). Every figure is calculated from your database when the page loads.`}
        actions={
          <details className="relative">
            <summary className="flex h-9 cursor-pointer list-none items-center gap-2 rounded-full border border-plum/25 bg-white px-4 text-[0.7rem] font-bold uppercase tracking-[0.16em] hover:border-plum">
              <Download className="size-3.5" aria-hidden /> Export CSV
            </summary>
            <ul className="absolute right-0 z-10 mt-2 w-56 rounded-xl border border-line bg-white p-1.5 text-sm shadow-lg">
              {[
                ["summary", "Sales & payments summary"],
                ["timeseries", "Sales, orders & traffic by period"],
                ["orders", "Paid orders (line by line)"],
                ["best_sellers", "Best-selling products"],
                ["categories", "Category performance"],
                ["pages", "Most visited pages"],
              ].map(([type, label]) => (
                <li key={type}><a href={`/api/admin/reports/export?type=${type}&${qs}`} className="block rounded-lg px-3 py-2 hover:bg-blush">{label}</a></li>
              ))}
            </ul>
          </details>
        }
      />
      <PeriodFilter preset={period.preset} from={period.from} to={period.to} bucket={period.bucket} today={localToday()} />
    </>
  );

  if (!r) {
    return (
      <div>
        {header}
        <Notice tone="error" title="Reports could not be loaded">{error ?? "Unknown error"}. If you just deployed, make sure the latest database migration has been applied.</Notice>
      </div>
    );
  }

  const currencies = r.sales.length > 0 ? r.sales.map((s) => s.currency) : [STORE_CURRENCY];
  const primary = r.sales.find((s) => s.currency === STORE_CURRENCY) ?? r.sales[0] ?? EMPTY_SALES(STORE_CURRENCY);
  const otherCurrencies = r.sales.filter((s) => s.currency !== primary.currency);
  const series = r.series.map((p) => ({ ...p, label: bucketLabel(p.bucket, period.bucket) }));
  const conversion = pct(r.funnel.purchased, r.traffic.visitors, 2);
  const noTraffic = r.traffic.visitors === 0;
  const funnelSteps = [
    { label: "Visited the website", value: r.funnel.visited },
    { label: "Viewed a product", value: r.funnel.viewed_product },
    { label: "Added to bag", value: r.funnel.added_to_cart },
    { label: "Started checkout", value: r.funnel.started_checkout },
    { label: "Completed purchase", value: r.funnel.purchased },
  ];

  return (
    <div className="space-y-8">
      {header}

      <p className="-mt-4 text-xs text-muted">
        Business timezone: <strong className="font-semibold text-plum">{REPORT_TZ_LABEL}</strong>. Days, weeks (starting Monday) and months follow this timezone. Money is shown per currency and never converted.
      </p>

      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Stat label="Total orders" value={r.orders.total.toLocaleString("en-NG")} note="Orders placed in this period, any status." href="/admin/orders" />
        <Stat label="Paid orders" value={primary.paid_orders + otherCurrencies.reduce((a, s) => a + s.paid_orders, 0)} note="Payment verified with Paystack in this period." href="/admin/orders?payment=paid" />
        <Stat label="Pending payments" value={r.orders.awaiting_payment} note="Placed in this period, payment not yet confirmed." href="/admin/orders?status=pending_payment" />
        <Stat label="Failed payments" value={r.orders.failed_payment} note="Placed in this period; Paystack reported the payment failed." href="/admin/orders?payment=failed" />
        <Stat label="Pending deliveries" value={r.pending_deliveries} note="Right now: paid orders not yet delivered (all dates)." href="/admin/orders?status=to_fulfil" />
        <Stat label="Total sales revenue" value={formatMoney(primary.revenue, primary.currency)} note="Paid orders minus cancelled & refunded ones. Includes shipping and tax." emphasis />
        <Stat label="Average order value" value={formatMoney(primary.average_order_value, primary.currency)} note="Total sales revenue ÷ qualifying paid orders." />
        <Stat label="Website visitors" value={r.traffic.visitors.toLocaleString("en-NG")} note="Unique browsers that accepted analytics cookies." />
        <Stat label="Page views" value={r.traffic.page_views.toLocaleString("en-NG")} note={`${r.traffic.visits.toLocaleString("en-NG")} visits (30-minute sessions).`} />
        <Stat label="Conversion rate" value={conversion} note="Tracked visitors who completed a verified purchase ÷ tracked visitors." />
      </ul>

      {otherCurrencies.length > 0 && (
        <Notice tone="info" title="Sales in other currencies">
          {otherCurrencies.map((s) => `${formatMoney(s.revenue, s.currency)} from ${s.qualifying_orders} order(s)`).join(" · ")}. These are reported separately because no exchange-rate conversion is configured.
        </Notice>
      )}
      {noTraffic && (
        <Notice tone="info" title="No visitor data for this period yet">
          Visitor numbers come from the store&apos;s own privacy-friendly analytics, which starts counting once it is deployed and only includes visitors who tap “Allow analytics” on the cookie notice. Sales figures above come straight from your orders and are complete.
        </Notice>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        {currencies.map((c) => (
          <Card key={c} title={`Total sales over time${currencies.length > 1 ? ` (${c})` : ""}`} description="Revenue from qualifying paid orders, by the date payment was verified.">
            <RevenueChart data={series.map((p) => ({ label: p.label, revenue: p.revenue[c] ?? 0 }))} currency={c} />
          </Card>
        ))}
        <Card title="Number of orders over time" description="Orders placed (by order date) and qualifying paid orders (by payment date).">
          <OrdersChart data={series.map((p) => ({ label: p.label, orders: p.orders, paid_orders: p.paid_orders }))} />
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card title="Payment & revenue report" description="Grouped by the date the payment was verified.">
          <Table fit>
            <thead>
              <tr><th>Measure</th>{(r.sales.length ? r.sales : [primary]).map((s) => <th key={s.currency} className="!text-right">{s.currency}</th>)}</tr>
            </thead>
            <tbody>
              {(
                [
                  ["Gross sales", "gross_sales", "Item value of every order with a verified payment, before discounts."],
                  ["Discounts", "discounts", "Discount codes applied to those orders."],
                  ["Refunds", "refunds", "Item value (after discount) of paid orders since refunded."],
                  ["Cancelled after payment", "cancellations", "Item value of paid orders that were cancelled (refund may still be due)."],
                  ["Net sales", "net_sales", "Gross sales − discounts − refunds − cancellations."],
                  ["Shipping collected", "shipping", "Delivery fees on qualifying orders."],
                  ["Tax", "tax", "Tax on qualifying orders (only if tax is enabled in Store Settings)."],
                  ["Total sales revenue", "revenue", "Net sales + shipping + tax."],
                ] as const
              ).map(([label, key, hint]) => (
                <tr key={key} className={key === "revenue" || key === "net_sales" ? "font-semibold" : undefined}>
                  <td>{label}<span className="block text-[0.68rem] font-normal text-muted">{hint}</span></td>
                  {(r.sales.length ? r.sales : [primary]).map((s) => (
                    <td key={s.currency} className="text-right tabular-nums">{key === "discounts" || key === "refunds" || key === "cancellations" ? (s[key] ? `−${formatMoney(s[key], s.currency)}` : formatMoney(0, s.currency)) : formatMoney(s[key], s.currency)}</td>
                  ))}
                </tr>
              ))}
              <tr>
                <td>Money returned to customers<span className="block text-[0.68rem] text-muted">Full order totals of refunded orders, incl. shipping.</span></td>
                {(r.sales.length ? r.sales : [primary]).map((s) => <td key={s.currency} className="text-right tabular-nums">{formatMoney(s.refunded_to_customers, s.currency)} <span className="text-xs text-muted">({s.refunded_orders})</span></td>)}
              </tr>
            </tbody>
          </Table>
        </Card>
        <Card title="Payments overview" description="Paystack payment attempts started in this period.">
          <BarList
            valueLabel="Payment attempts by status"
            rows={[
              { label: "Successful", value: r.payments.successful },
              { label: "Pending (awaiting customer / confirmation)", value: r.payments.pending },
              { label: "Failed", value: r.payments.failed },
              { label: "Cancelled / abandoned", value: r.payments.abandoned },
              { label: "Refunded orders (refund date in period)", value: r.refunds_in_period },
              { label: "Cancelled orders (cancel date in period)", value: r.cancellations_in_period },
            ]}
          />
          <p className="mt-4 border-t border-line pt-3 text-xs text-muted">
            {r.payments.attempts} payment attempt(s) in total. Payments are only marked successful after the server re-verifies them with Paystack (callback or signed webhook); each payment reference is counted once.
          </p>
          {r.payments.duplicate > 0 && (
            <Notice tone="warning" className="mt-3" title={`${r.payments.duplicate} duplicate payment(s)`}>A customer paid twice for the same order. The extra payment is not counted as sales — refund it from your Paystack dashboard.</Notice>
          )}
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card title="Website traffic" description="Unique visitors and page views per period (consenting visitors only).">
          <TrafficChart data={series.map((p) => ({ label: p.label, visitors: p.visitors, page_views: p.page_views }))} />
        </Card>
        <Card title="Customer conversion funnel" description="Unique tracked visitors who reached each step in this period.">
          <ol className="space-y-3">
            {funnelSteps.map((s, i) => (
              <li key={s.label} className="text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <span><span className="mr-2 text-xs text-muted">{i + 1}</span>{s.label}</span>
                  <span className="tabular-nums font-semibold">{s.value.toLocaleString("en-NG")} <span className="ml-1 text-xs font-normal text-muted">{i === 0 ? "100%" : pct(s.value, funnelSteps[0].value)}</span></span>
                </div>
                <div className="mt-1 h-2.5 rounded-full bg-neutral" aria-hidden>
                  <div className="h-2.5 rounded-full bg-rose" style={{ width: `${funnelSteps[0].value ? Math.max((s.value / funnelSteps[0].value) * 100, s.value ? 2 : 0) : 0}%` }} />
                </div>
                {i > 0 && <p className="mt-0.5 text-[0.68rem] text-muted">{pct(s.value, funnelSteps[i - 1].value)} of the previous step</p>}
              </li>
            ))}
          </ol>
          <p className="mt-4 border-t border-line pt-3 text-xs leading-relaxed text-muted">
            Each step counts a visitor once, however many times they did it. Percentages are of all tracked visitors; the small figure compares with the step before. “Completed purchase” is recorded by the database when a payment is verified — never by the browser — and at most once per order.
          </p>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Best-selling products" description="Units sold in qualifying paid orders.">
          {r.best_sellers.length === 0 ? (
            <p className="text-sm text-muted">No paid sales in this period.</p>
          ) : (
            <Table fit>
              <thead><tr><th>Product</th><th className="!text-right">Units</th><th className="!text-right">Orders</th><th className="!text-right">Item revenue</th></tr></thead>
              <tbody>
                {r.best_sellers.map((b, i) => (
                  <tr key={`${b.product_id ?? b.name}-${b.currency}`}>
                    <td><span className="mr-2 text-xs text-muted">{i + 1}</span>{b.product_id ? <Link href={`/admin/products/${b.product_id}`} className="hover:text-rose-deep">{b.name}</Link> : b.name}</td>
                    <td className="text-right tabular-nums">{b.units}</td>
                    <td className="text-right tabular-nums">{b.orders}</td>
                    <td className="text-right tabular-nums">{formatMoney(b.revenue, b.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
        <Card title="Category performance" description="Item revenue (before order-level discounts) by top-level category.">
          <BarList
            valueLabel="Revenue by category"
            empty="No paid sales in this period."
            rows={r.categories.map((c) => ({ label: `${c.category}${currencies.length > 1 ? ` (${c.currency})` : ""}`, value: c.revenue, display: formatMoney(c.revenue, c.currency), sub: `${c.orders} order${c.orders === 1 ? "" : "s"} · ${c.units} unit${c.units === 1 ? "" : "s"}` }))}
          />
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <Card title="Most visited pages" description="Page views (unique visitors).">
          <BarList valueLabel="Page views by page" rows={r.top_pages.map((p) => ({ label: <span className="font-mono text-xs">{p.path}</span>, value: p.views, sub: `(${p.visitors})` }))} />
        </Card>
        <Card title="Most viewed products" description="Product page views (unique visitors).">
          <BarList valueLabel="Views by product" rows={r.top_viewed_products.map((p) => ({ label: p.name, value: p.views, sub: `(${p.visitors})` }))} />
        </Card>
        <Card title="Traffic sources" description="Visits by where they started.">
          <BarList valueLabel="Visits by source" rows={r.sources.map((s) => ({ label: SOURCE_LABELS[s.source] ?? s.source, value: s.visits }))} />
        </Card>
        <Card title="Referring websites" description="Visits arriving from other sites.">
          <BarList valueLabel="Visits by referring site" rows={r.referrers.map((s) => ({ label: s.host, value: s.visits }))} />
        </Card>
        <Card title="Devices" description="Unique visitors by device type.">
          <BarList valueLabel="Visitors by device" rows={r.devices.map((d) => ({ label: DEVICE_LABELS[d.device] ?? d.device, value: d.visitors }))} />
        </Card>
        <Card title="Countries" description="Unique visitors by country (from the hosting network, IP not stored).">
          <BarList valueLabel="Visitors by country" rows={r.countries.map((c) => ({ label: c.country === "??" ? "Unknown" : countryName(c.country), value: c.visitors }))} />
        </Card>
      </div>

      <Card title="How these numbers are measured">
        <dl className="grid gap-x-10 gap-y-4 text-sm md:grid-cols-2 [&_dd]:mt-0.5 [&_dd]:text-xs [&_dd]:leading-relaxed [&_dd]:text-muted [&_dt]:font-semibold">
          <div><dt>Orders vs sales dates</dt><dd>Order counts use the date the order was placed. Sales and revenue use the date Paystack payment was verified on the server, so an order placed late on the 31st and paid on the 1st counts as next month&apos;s sale.</dd></div>
          <div><dt>Qualifying paid order</dt><dd>Payment verified, and the order is not cancelled or refunded. Unpaid, pending and failed orders are never counted as sales.</dd></div>
          <div><dt>Gross vs net sales</dt><dd>Gross sales is the value of items sold before discounts. Net sales subtracts discounts and the item value of refunded or cancelled paid orders. Total sales revenue adds shipping and tax back on: it is what you actually keep from customers.</dd></div>
          <div><dt>Refunds</dt><dd>An order is treated as refunded when you mark it Refunded in Orders. Partial refunds are not tracked separately; record them in the order notes.</dd></div>
          <div><dt>Unique visitors & visits</dt><dd>A visitor is one browser with a random analytics ID (kept up to 13 months). A visit ends after 30 minutes of inactivity. Page views count every page shown. Visitors who decline cookies, or whose browser sends Do Not Track / Global Privacy Control, are not counted, so real traffic is higher than shown.</dd></div>
          <div><dt>Conversion rate</dt><dd>Tracked visitors who completed a verified purchase in the period ÷ all tracked visitors in the period. Both numbers come from the same consenting group so the rate is not inflated by untracked buyers.</dd></div>
          <div><dt>Traffic sources</dt><dd>Taken from the first page of each visit: UTM tags if present, otherwise the referring website (search engine, social network, email or other site). No referrer = Direct / unknown.</dd></div>
          <div><dt>Privacy</dt><dd>No IP addresses, user-agent strings, names or emails are stored with analytics events, and no third-party trackers are used. Bots and crawlers are ignored.</dd></div>
        </dl>
      </Card>
    </div>
  );
}

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
function countryName(code: string): string {
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}
