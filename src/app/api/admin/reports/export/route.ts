import { NextResponse, type NextRequest } from "next/server";
import { assertPermission, AuthorizationError } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { periodInstants, resolvePeriod } from "@/lib/analytics/periods";
import { loadAnalyticsReport } from "@/lib/analytics/report";
import { csvMoney, csvResponse, toCsv } from "@/lib/csv";

const TYPES = ["summary", "timeseries", "orders", "best_sellers", "categories", "pages"] as const;
type ExportType = (typeof TYPES)[number];

/** CSV exports of the Analytics & Reports dashboard. Admin only (checked here and again in SQL). */
export async function GET(request: NextRequest) {
  try {
    await assertPermission("reports:read");
  } catch (e) {
    return NextResponse.json({ error: e instanceof AuthorizationError ? e.message : "Unauthorized" }, { status: 403 });
  }
  const sp = Object.fromEntries(request.nextUrl.searchParams);
  const type = (TYPES as readonly string[]).includes(sp.type) ? (sp.type as ExportType) : "summary";
  const period = resolvePeriod(sp);
  const name = `attitude-${type}-${period.from}-to-${period.to}.csv`;

  if (type === "orders") {
    const { fromIso, toIso } = periodInstants(period);
    const db = await createClient();
    const { data, error } = await db
      .from("orders")
      .select("order_number, created_at, paid_at, status, payment_status, customer_name, email, currency, subtotal, discount_total, discount_code, shipping_fee, tax_total, total")
      .not("paid_at", "is", null)
      .gte("paid_at", fromIso)
      .lt("paid_at", toIso)
      .order("paid_at")
      .limit(10000);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const rows = (data ?? []).map((o) => {
      const counted = o.payment_status === "paid" && !["cancelled", "refunded"].includes(o.status);
      return [o.order_number, o.created_at, o.paid_at, o.status, o.payment_status, counted ? "yes" : "no", o.customer_name, o.email, o.currency, csvMoney(o.subtotal), csvMoney(o.discount_total), o.discount_code, csvMoney(o.shipping_fee), csvMoney(o.tax_total), csvMoney(o.total)];
    });
    return csvResponse(toCsv(["order_number", "placed_at", "paid_at", "status", "payment_status", "counted_in_revenue", "customer_name", "email", "currency", "subtotal", "discount", "discount_code", "shipping", "tax", "total"], rows), name);
  }

  const { report: r, error } = await loadAnalyticsReport(period);
  if (!r) return NextResponse.json({ error }, { status: 500 });

  switch (type) {
    case "timeseries": {
      const currencies = [...new Set(r.series.flatMap((p) => Object.keys(p.revenue)))].sort();
      if (currencies.length === 0) currencies.push("NGN");
      return csvResponse(
        toCsv(
          ["period_start", "orders_placed", "paid_orders", ...currencies.map((c) => `revenue_${c}`), "unique_visitors", "page_views"],
          r.series.map((p) => [p.bucket, p.orders, p.paid_orders, ...currencies.map((c) => csvMoney(p.revenue[c] ?? 0)), p.visitors, p.page_views]),
        ),
        name,
      );
    }
    case "best_sellers":
      return csvResponse(toCsv(["product", "currency", "units", "orders", "item_revenue"], r.best_sellers.map((b) => [b.name, b.currency, b.units, b.orders, csvMoney(b.revenue)])), name);
    case "categories":
      return csvResponse(toCsv(["category", "currency", "units", "orders", "item_revenue"], r.categories.map((c) => [c.category, c.currency, c.units, c.orders, csvMoney(c.revenue)])), name);
    case "pages":
      return csvResponse(toCsv(["path", "page_views", "unique_visitors"], r.top_pages.map((p) => [p.path, p.views, p.visitors])), name);
    default: {
      const rows: unknown[][] = [
        ["period", `${period.from} to ${period.to}`, "", "timezone Africa/Lagos"],
        ["orders_placed", r.orders.total],
        ["orders_awaiting_payment", r.orders.awaiting_payment],
        ["orders_failed_payment", r.orders.failed_payment],
        ["pending_deliveries_now", r.pending_deliveries],
        ["payment_attempts", r.payments.attempts],
        ["payments_successful", r.payments.successful],
        ["payments_pending", r.payments.pending],
        ["payments_failed", r.payments.failed],
        ["payments_abandoned", r.payments.abandoned],
        ["duplicate_payments", r.payments.duplicate],
        ["unique_visitors", r.traffic.visitors],
        ["visits", r.traffic.visits],
        ["page_views", r.traffic.page_views],
        ["visitors_who_purchased", r.funnel.purchased],
        ["conversion_rate_percent", r.traffic.visitors ? ((r.funnel.purchased / r.traffic.visitors) * 100).toFixed(2) : ""],
      ];
      for (const s of r.sales) {
        rows.push(
          [`paid_orders_${s.currency}`, s.paid_orders],
          [`qualifying_orders_${s.currency}`, s.qualifying_orders],
          [`gross_sales_${s.currency}`, csvMoney(s.gross_sales)],
          [`discounts_${s.currency}`, csvMoney(s.discounts)],
          [`refunds_${s.currency}`, csvMoney(s.refunds)],
          [`cancellations_${s.currency}`, csvMoney(s.cancellations)],
          [`net_sales_${s.currency}`, csvMoney(s.net_sales)],
          [`shipping_${s.currency}`, csvMoney(s.shipping)],
          [`tax_${s.currency}`, csvMoney(s.tax)],
          [`total_sales_revenue_${s.currency}`, csvMoney(s.revenue)],
          [`average_order_value_${s.currency}`, csvMoney(s.average_order_value)],
        );
      }
      return csvResponse(toCsv(["metric", "value"], rows), name);
    }
  }
}
