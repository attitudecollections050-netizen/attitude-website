import { categoryOptions } from "@/lib/admin/categories";
import { QuickAddProduct } from "@/components/admin/QuickAddProduct";
import { isStoreOwner } from "@/lib/owner";
import { getSettings } from "@/lib/settings";
import { bankTransferActive } from "@/lib/payments/bank-transfer";
import { isEmailConfigured } from "@/lib/groundmail";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { naira, staffPaymentTotals } from "@/lib/staff-payments";
import { PaymentsLive } from "@/components/admin/PayStaff";
import { requireStaffPage } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/orders/status";
import { statusTone } from "@/lib/orders/labels";
import { isPaystackConfigured, paystackMode } from "@/lib/env";
import { Badge, Card, PageHeader, Table } from "@/components/admin/ui";
import { Notice } from "@/components/ui/Notice";

export const metadata = { title: "Overview" };

interface Stats {
  total_orders: number;
  paid_orders: number;
  revenue: number | null;
  pending_fulfilment: number;
  inventory_conflicts: number;
  products_in_stock: number;
  low_stock_variants: number;
  out_of_stock_products: number;
  unreviewed_shipping_rates: number;
}

export default async function AdminOverview({ searchParams }: PageProps<"/admin">) {
  const { user, roles, permissions } = await requireStaffPage(null);
  const sp = await searchParams;
  const db = await createClient();
  // Only the store owner gets the store overview (orders, sales, revenue). Everyone else on the
  // team sees their own numbers instead, and orders/revenue are never fetched for them.
  const owner = isStoreOwner(user.email, roles);
  if (!owner) {
    const canAdd = permissions.includes("products:write");
    const [{ data: mine }, categories, [payTotals]] = await Promise.all([
      db.rpc("get_my_stats"),
      canAdd ? categoryOptions() : Promise.resolve([]),
      staffPaymentTotals(user.id).catch(() => []),
    ]);
    const m = (Array.isArray(mine) ? mine[0] : mine) as { product_count: number | string; earnings: number; remaining: number } | null;
    return (
      <MyStats
        count={Number(m?.product_count ?? 0)}
        earnings={m?.earnings ?? 0}
        remaining={m?.remaining ?? 10}
        withdrawn={payTotals?.totalWithdrawn ?? 0}
        pending={payTotals?.pendingAmount ?? 0}
        hasBank={Boolean(payTotals?.bank)}
        balanceLeft={payTotals?.balanceLeft ?? m?.earnings ?? 0}
        userId={user.id}
        categories={categories}
        canAdd={canAdd}
        forbidden={sp.error === "forbidden"}
      />
    );
  }
  const canVerify = permissions.includes("payments:verify");
  const canAddProducts = permissions.includes("products:write");
  const [settings, pendingTransfers, categories] = await Promise.all([
    getSettings(),
    canVerify ? db.from("payment_claims").select("id", { count: "exact", head: true }).eq("status", "pending").then((r) => r.count ?? 0) : Promise.resolve(0),
    canAddProducts ? categoryOptions() : Promise.resolve([]),
  ]);
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
    ...(owner && s.revenue != null ? [{ label: "Sales revenue", value: formatMoney(s.revenue), note: "Paid orders, excluding refunds" }] : []),
    { label: "Pending fulfilment", value: s.pending_fulfilment ?? 0, href: "/admin/orders?status=to_fulfil" },
    { label: "Products in stock", value: s.products_in_stock ?? 0, href: "/admin/products?stock=in" },
    { label: "Low-stock variants", value: s.low_stock_variants ?? 0, href: "/admin/products?stock=low" },
    { label: "Out-of-stock products", value: s.out_of_stock_products ?? 0, href: "/admin/products?stock=out" },
  ];

  return (
    <div className="space-y-8">
      <PageHeader title="Overview" description="Live figures from your store database." />
      {canAddProducts && (
        <Card title="Add a product" description="Name, price, category and a photo. You'll add sizes, colours and stock on the next page.">
          <QuickAddProduct categories={categories} />
        </Card>
      )}
      {sp.error === "forbidden" && <Notice tone="error">You don&apos;t have permission to open that section.</Notice>}

      <div className="space-y-3">
        {pendingTransfers > 0 && (
          <Link href="/admin/transfers" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose/30 bg-[linear-gradient(90deg,#fff0f5,#ffffff)] px-5 py-4 shadow-[0_16px_40px_-30px_rgba(184,53,122,0.7)] transition hover:border-rose">
            <span>
              <span className="block text-sm font-bold text-plum">{pendingTransfers} bank transfer{pendingTransfers === 1 ? "" : "s"} waiting for you</span>
              <span className="block text-xs text-plum-soft">Check your bank app, then confirm or decline so customers hear back quickly.</span>
            </span>
            <span className="rounded-full bg-rose px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white">Review now</span>
          </Link>
        )}
        {!isPaystackConfigured() && !bankTransferActive(settings.bank_transfer) && (
          <Notice tone="warning" title="Payments not configured">
            Customers can&apos;t pay yet. Turn on bank transfer in <Link href="/admin/settings#bank-transfer" className="underline">Store Settings</Link>, or add PAYSTACK_SECRET_KEY and NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY in Vercel → Settings → Environment Variables and redeploy.
          </Notice>
        )}
        {!bankTransferActive(settings.bank_transfer) && paystackMode() === "test" && <Notice tone="info" title="Paystack test mode">Payments use test keys. Switch to live keys only after testing the full flow.</Notice>}
        {!isEmailConfigured() && <Notice tone="info" title="Email not configured">Order receipts and staff invitations aren&apos;t emailed until GROUNDMAIL_API_KEY and EMAIL_FROM are set in Vercel → Settings → Environment Variables.</Notice>}
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

/** The team's view of /admin: their own products and earnings (₦1,000 for every 10 products added). */
function MyStats({
  count,
  earnings,
  remaining,
  withdrawn,
  pending,
  hasBank,
  balanceLeft,
  userId,
  categories,
  canAdd,
  forbidden,
}: {
  count: number;
  earnings: number;
  remaining: number;
  withdrawn: number;
  pending: number;
  hasBank: boolean;
  balanceLeft: number;
  userId: string;
  categories: Awaited<ReturnType<typeof categoryOptions>>;
  canAdd: boolean;
  forbidden: boolean;
}) {
  const progress = (10 - remaining) % 10;
  return (
    <div className="space-y-8">
      <PageHeader title="My dashboard" description="Your products and earnings. ₦1,000 for every 10 products you add." />
      {forbidden && <Notice tone="error">You don&apos;t have permission to open that section.</Notice>}
      <PaymentsLive staffId={userId} />
      {pending > 0 && (
        <Link href="/staff/earnings" className="block border-2 border-[#EA580C] bg-[#FFF7ED] px-4 py-3 text-sm font-semibold text-[#9A3412]" data-testid="my-pending-alert">
          ⏳ Withdrawal requested: {naira(pending)} is waiting for the owner to approve.
        </Link>
      )}
      {!hasBank && (
        <Link href="/staff/earnings#bank-h" className="block border border-[#EA580C] bg-[#FFF7ED] px-4 py-3 text-sm font-semibold text-[#9A3412]" data-testid="my-bank-warning">
          ⚠️ Add your bank details to receive payments →
        </Link>
      )}
      <ul className="grid gap-3 sm:grid-cols-2" data-testid="my-payments">
        <li className="border border-line bg-white p-5">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-muted">Total withdrawn</p>
          <p className="mt-2 text-4xl font-extrabold tabular-nums" data-testid="my-withdrawn">{naira(withdrawn)}</p>
          <Link href="/staff/earnings#pay-history" className="mt-1 inline-block text-xs underline">See withdrawal history</Link>
        </li>
        <li className="border border-line bg-white p-5">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-muted">Balance left</p>
          <p className={`mt-2 text-4xl font-extrabold tabular-nums ${balanceLeft < 0 ? "text-danger" : "text-success"}`} data-testid="my-balance">{naira(balanceLeft)}</p>
          {balanceLeft >= 500 && pending === 0 && (
            <Link href="/staff/earnings#withdraw" className="mt-2 inline-block rounded-full bg-[#2563EB] px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-white" data-testid="my-withdraw-link">
              Withdraw money →
            </Link>
          )}
        </li>
      </ul>
      <ul className="grid gap-3 sm:grid-cols-3" data-testid="my-stats">
        <li className="border border-line bg-white p-5">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-muted">My products added</p>
          <p className="mt-2 font-display text-4xl tabular-nums" data-testid="my-count">{count}</p>
          <Link href="/admin/products" className="mt-1 inline-block text-xs underline">See my products</Link>
        </li>
        <li className="border border-line bg-white p-5">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-muted">My earnings</p>
          <p className="mt-2 text-4xl font-extrabold tabular-nums text-success" data-testid="my-earnings">{formatMoney(earnings * 100)}</p>
        </li>
        <li className="border border-line bg-white p-5">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-muted">Remaining to next ₦1,000</p>
          <p className="mt-2 font-display text-4xl tabular-nums" data-testid="my-remaining">{remaining}</p>
          <div className="mt-3 h-1.5 w-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={10} aria-valuenow={progress} aria-label="Progress to the next ₦1,000">
            <div className="h-full bg-rose" style={{ width: `${progress * 10}%` }} />
          </div>
        </li>
      </ul>
      {canAdd && (
        <Card title="Add a product" description="Name, price, category and a photo. You'll add sizes, colours and stock on the next page.">
          <QuickAddProduct categories={categories} />
        </Card>
      )}
    </div>
  );
}
