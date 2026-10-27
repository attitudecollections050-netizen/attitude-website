import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireStaffPage } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/orders/status";
import { statusTone } from "@/lib/orders/labels";
import { isPaystackConfigured, paystackMode, serverSecrets } from "@/lib/env";
import { Badge, Card, PageHeader, Table } from "@/components/admin/ui";
import { Notice } from "@/components/ui/Notice";

export const metadata = { title: "Overview" };

interface Stats {
  total_orders: number;
  paid_orders: number;
  revenue: number;
  pending_fulfilment: number;
  inventory_conflicts: number;
  products_in_stock: number;
  low_stock_variants: number;
  out_of_stock_products: number;
  unreviewed_shipping_rates: number;
}

export default async function AdminOverview({ searchParams }: PageProps<"/admin">) {
  await requireStaffPage();
  const sp = await searchParams;
  const db = await createClient();
  const [{ data: stats }, { data: recent }, { data: low }] = await Promise.all([
    db.rpc("admin_dashboard_stats"),
    db.from("orders").select("id, order_number, customer_name, total, currency, status, payment_status, created_at").order("created_at", { ascending: false }).limit(8),
    db
      .from("inventory")
      .select("on_hand, low_stock_threshold, variant:product_variants!inner ( sku, size, color, is_active, product:products!inner ( id, name, status ) )")
      .lte("on_hand", 3)
      .order("on_hand")
      .limit(12),
  ]);
  const s = (stats ?? {}) as Stats;
  type LowRow = { on_hand: number; low_stock_threshold: number; variant: { sku: string; size: string | null; color: string | null; is_active: boolean; product: { id: string; name: string; status: string } } };
  const lowRows = ((low ?? []) as unknown as LowRow[]).filter((r) => r.variant.is_active && r.variant.product.status !== "archived" && r.on_hand <= r.low_stock_threshold);

  const tiles = [
    { label: "Total orders", value: s.total_orders ?? 0, href: "/admin/orders" },
    { label: "Paid orders", value: s.paid_orders ?? 0, href: "/admin/orders?payment=paid" },
    { label: "Sales revenue", value: formatMoney(s.revenue ?? 0), note: "Paid orders, excluding refunds" },
    { label: "Pending fulfilment", value: s.pending_fulfilment ?? 0, href: "/admin/orders?status=to_fulfil" },
    { label: "Products in stock", value: s.products_in_stock ?? 0, href: "/admin/products?stock=in" },
    { label: "Low-stock variants", value: s.low_stock_variants ?? 0, href: "/admin/products?stock=low" },
    { label: "Out-of-stock products", value: s.out_of_stock_products ?? 0, href: "/admin/products?stock=out" },
  ];

  return (
    <div className="space-y-8">
      <PageHeader title="Overview" description="Live figures from your store database." />
      {sp.error === "forbidden" && <Notice tone="error">You don&apos;t have permission to open that section.</Notice>}

      <div className="space-y-3">
        {!isPaystackConfigured() && <Notice tone="warning" title="Payments not configured">Add PAYSTACK_SECRET_KEY and NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY. Customers cannot pay until this is done.</Notice>}
        {paystackMode() === "test" && <Notice tone="info" title="Paystack test mode">Payments use test keys. Switch to live keys only after testing the full flow.</Notice>}
        {!serverSecrets().resendApiKey && <Notice tone="info" title="Email not configured">Order confirmation emails are skipped until RESEND_API_KEY and EMAIL_FROM are set.</Notice>}
        {(s.unreviewed_shipping_rates ?? 0) > 0 && (
          <Notice tone="warning" title={`${s.unreviewed_shipping_rates} shipping rate(s) not yet confirmed`}>
            Development defaults are active (e.g. ₦2,500 same-city, ₦4,000 elsewhere in Nigeria). These are sample values, not verified courier prices. <Link href="/admin/shipping" className="underline">Review shipping rates</Link> before launch.
          </Notice>
        )}
        {(s.inventory_conflicts ?? 0) > 0 && (
          <Notice tone="error" title={`${s.inventory_conflicts} paid order(s) with a stock conflict`}>
            Stock ran out between checkout and payment. <Link href="/admin/orders?conflict=1" className="underline">Review these orders</Link>.
          </Notice>
        )}
      </div>

      <ul className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {tiles.map((t) => {
          const body = (
            <>
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-muted">{t.label}</p>
              <p className="mt-2 font-display text-3xl tabular-nums">{t.value}</p>
              {t.note && <p className="mt-1 text-[0.65rem] text-muted">{t.note}</p>}
            </>
          );
          return (
            <li key={t.label}>
              {t.href ? <Link href={t.href} className="block h-full border border-line bg-white p-4 transition hover:border-rose">{body}</Link> : <div className="h-full border border-line bg-white p-4">{body}</div>}
            </li>
          );
        })}
      </ul>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card title="Recent orders" actions={<Link href="/admin/orders" className="text-xs underline">All orders</Link>}>
          {recent && recent.length > 0 ? (
            <Table>
              <thead><tr><th>Order</th><th>Customer</th><th>Status</th><th className="!text-right">Total</th></tr></thead>
              <tbody>
                {recent.map((o) => (
                  <tr key={o.id}>
                    <td><Link href={`/admin/orders/${o.id}`} className="font-semibold hover:text-rose-deep">{o.order_number}</Link><span className="block text-xs text-muted">{new Date(o.created_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}</span></td>
                    <td>{o.customer_name}</td>
                    <td><Badge tone={statusTone(o.status as OrderStatus)}>{ORDER_STATUS_LABELS[o.status as OrderStatus]}</Badge></td>
                    <td className="text-right tabular-nums">{formatMoney(o.total, o.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <p className="text-sm text-muted">No orders yet.</p>
          )}
        </Card>
        <Card title="Low stock" description="Active variants at or below their low-stock threshold.">
          {lowRows.length === 0 ? (
            <p className="text-sm text-muted">Nothing is running low.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {lowRows.map((r) => (
                <li key={r.variant.sku} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    <Link href={`/admin/products/${r.variant.product.id}`} className="block truncate font-medium hover:text-rose-deep">{r.variant.product.name}</Link>
                    <span className="text-xs text-muted">{[r.variant.color, r.variant.size].filter(Boolean).join(" / ")} · {r.variant.sku}</span>
                  </span>
                  <Badge tone={r.on_hand === 0 ? "danger" : "warning"}>{r.on_hand === 0 ? <><AlertTriangle className="mr-1 size-3" />Out</> : `${r.on_hand} left`}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
