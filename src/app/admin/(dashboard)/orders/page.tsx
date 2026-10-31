import Link from "next/link";
import { requireStaffPage } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/orders/status";
import { statusTone } from "@/lib/orders/labels";
import { ORDER_PAGE_SIZE, parseAdminOrderFilters, queryAdminOrders } from "@/lib/orders/admin-query";
import { Badge, Empty, PageHeader, Table, inputCls } from "@/components/admin/ui";
import { buttonClasses } from "@/components/ui/Button";
import { SmartImage } from "@/components/ui/SmartImage";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Orders" };

export default async function AdminOrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  await requireStaffPage("orders:read");
  const sp = await searchParams;
  const f = parseAdminOrderFilters(sp);
  const { data, count, error } = await queryAdminOrders(f);
  const orders = (data ?? []) as unknown as { id: string; order_number: string; customer_name: string; email: string; total: number; currency: string; status: OrderStatus; payment_status: string; inventory_conflict: boolean; created_at: string; shipping_address: { city: string; country_code: string } }[];
  const pages = Math.ceil((count ?? 0) / ORDER_PAGE_SIZE);
  // Item photos for these orders: the exact design the customer picked where it was recorded.
  type Thumb = { order_id: string; product_name: string; variant_label: string | null; quantity: number; selected_image: string | null };
  const { data: itemRows } = orders.length
    ? await (await createClient()).from("order_items").select("order_id, product_name, variant_label, quantity, selected_image").in("order_id", orders.map((o) => o.id))
    : { data: [] as Thumb[] };
  const itemsBy = new Map<string, Thumb[]>();
  for (const i of (itemRows ?? []) as Thumb[]) itemsBy.set(i.order_id, [...(itemsBy.get(i.order_id) ?? []), i]);
  const qs = (extra: Record<string, string | number>) => {
    const p = new URLSearchParams();
    if (f.q) p.set("q", f.q);
    if (f.status) p.set("status", f.status);
    if (f.payment) p.set("payment", f.payment);
    if (f.conflict) p.set("conflict", "1");
    Object.entries(extra).forEach(([k, v]) => p.set(k, String(v)));
    return p.toString();
  };

  return (
    <div>
      <PageHeader
        title="Orders"
        description={`${count ?? 0} order(s)`}
        actions={<a href={`/api/admin/orders/export?${qs({})}`} className={buttonClasses("outline", "sm")}>Export CSV</a>}
      />
      <form className="mb-5 grid gap-3 sm:grid-cols-[1fr_12rem_12rem_auto]" role="search">
        <input name="q" defaultValue={f.q} placeholder="Search order no., email, name, phone" className={inputCls} aria-label="Search orders" />
        <select name="status" defaultValue={f.status} className={inputCls} aria-label="Order status">
          <option value="">All statuses</option>
          <option value="to_fulfil">Needs fulfilment</option>
          {Object.entries(ORDER_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select name="payment" defaultValue={f.payment} className={inputCls} aria-label="Payment status">
          <option value="">Any payment</option>
          {["paid", "pending", "unpaid", "failed", "refunded"].map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <button className={buttonClasses("primary", "sm", "h-full")}>Filter</button>
      </form>
      {error && <p className="mb-4 text-sm text-danger">{error.message}</p>}
      {orders.length === 0 ? (
        <Empty>No orders match.</Empty>
      ) : (
        <Table>
          <thead><tr><th>Item image (exact design)</th><th>Order</th><th>Customer</th><th>Destination</th><th>Status</th><th>Payment</th><th className="!text-right">Total</th></tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td className="!py-2">
                  <Link href={`/admin/orders/${o.id}`} className="flex flex-col gap-2" aria-label={`Items in ${o.order_number}`} data-testid={`thumbs-${o.order_number}`}>
                    {(itemsBy.get(o.id) ?? []).slice(0, 6).map((i, n) => (
                      <span key={n} className="flex items-center gap-2.5">
                        {i.selected_image ? (
                          <span className="relative block size-20 shrink-0 overflow-hidden rounded-xl border-2 border-success bg-neutral">
                            <SmartImage src={i.selected_image} alt={`${i.product_name} — chosen design`} fill sizes="80px" className="object-cover" />
                            {i.quantity > 1 && <span className="absolute bottom-0 right-0 bg-plum px-1 text-[10px] font-bold text-white">×{i.quantity}</span>}
                          </span>
                        ) : (
                          <span className="grid size-20 shrink-0 place-items-center rounded-xl border-2 border-dashed border-warning bg-[#fff8e8] px-1 text-center text-[10px] font-semibold leading-tight text-[#6b4a00]" data-testid="no-design">
                            ⚠ Design not recorded
                          </span>
                        )}
                        <span className="min-w-0 max-w-[11rem] text-xs leading-snug">
                          <span className="line-clamp-2 font-semibold text-plum">{i.product_name}</span>
                          <span className="block text-muted">{i.variant_label ?? "—"}{i.quantity > 1 ? ` · ×${i.quantity}` : ""}</span>
                        </span>
                      </span>
                    ))}
                  </Link>
                </td>
                <td>
                  <Link href={`/admin/orders/${o.id}`} className="font-semibold hover:text-rose-deep">{o.order_number}</Link>
                  {o.inventory_conflict && <span className="ml-2"><Badge tone="danger">Stock conflict</Badge></span>}
                  <span className="block text-xs text-muted">{new Date(o.created_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}</span>
                </td>
                <td>{o.customer_name}<span className="block text-xs text-muted">{o.email}</span></td>
                <td className="text-xs">{o.shipping_address?.city}, {o.shipping_address?.country_code}</td>
                <td><Badge tone={statusTone(o.status)}>{ORDER_STATUS_LABELS[o.status]}</Badge></td>
                <td><Badge tone={o.payment_status === "paid" ? "success" : o.payment_status === "failed" ? "danger" : "neutral"}>{o.payment_status}</Badge></td>
                <td className="text-right tabular-nums">{formatMoney(o.total, o.currency)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {pages > 1 && (
        <nav className="mt-6 flex items-center justify-center gap-2 text-sm" aria-label="Pagination">
          {f.page > 1 && <Link href={`?${qs({ page: f.page - 1 })}`} className="px-3 py-1.5 hover:text-rose-deep">← Prev</Link>}
          <span className="text-muted">Page {f.page} of {pages}</span>
          {f.page < pages && <Link href={`?${qs({ page: f.page + 1 })}`} className="px-3 py-1.5 hover:text-rose-deep">Next →</Link>}
        </nav>
      )}
    </div>
  );
}
