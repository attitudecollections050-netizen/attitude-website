import { NextResponse, type NextRequest } from "next/server";
import { assertPermission, AuthorizationError } from "@/lib/auth";
import { parseAdminOrderFilters, queryAdminOrders } from "@/lib/orders/admin-query";
import { csvCell } from "@/lib/csv";

export async function GET(request: NextRequest) {
  try {
    await assertPermission("orders:read");
  } catch (e) {
    return NextResponse.json({ error: e instanceof AuthorizationError ? e.message : "Unauthorized" }, { status: 403 });
  }
  const f = parseAdminOrderFilters(Object.fromEntries(request.nextUrl.searchParams));
  const { data, error } = await queryAdminOrders(f, {
    limit: 5000,
    offset: 0,
    select: "order_number, created_at, status, payment_status, customer_name, email, phone, shipping_address, shipping_method_name, subtotal, discount_total, discount_code, shipping_fee, tax_total, total, currency, paid_at",
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const header = ["order_number", "created_at", "status", "payment_status", "customer_name", "email", "phone", "city", "region", "country", "address", "shipping_method", "subtotal", "discount", "discount_code", "shipping_fee", "tax", "total", "currency", "paid_at"];
  type Row = Record<string, unknown> & { shipping_address: Record<string, string | null> };
  const rows = ((data ?? []) as unknown as Row[]).map((o) => {
    const a = o.shipping_address ?? {};
    const m = (v: unknown) => (Number(v) / 100).toFixed(2);
    return [o.order_number, o.created_at, o.status, o.payment_status, o.customer_name, o.email, o.phone, a.city, a.region, a.country_code, [a.line1, a.line2].filter(Boolean).join(", "), o.shipping_method_name, m(o.subtotal), m(o.discount_total), o.discount_code, m(o.shipping_fee), m(o.tax_total), m(o.total), o.currency, o.paid_at].map(csvCell).join(",");
  });
  const body = [header.join(","), ...rows].join("\n");
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
