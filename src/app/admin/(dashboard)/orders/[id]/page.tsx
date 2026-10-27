import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStaffPage } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { formatMoney, toMajorString } from "@/lib/money";
import { ORDER_STATUS_LABELS, allowedTransitions, type OrderStatus } from "@/lib/orders/status";
import { statusTone } from "@/lib/orders/labels";
import { formatDeliveryWindow } from "@/lib/shipping/calculator";
import { addTracking, removeTracking, saveFulfilment, updateOrderStatus } from "@/app/admin/actions/orders";
import { ActionForm } from "@/components/admin/ActionForm";
import { Badge, Card, Field, PageHeader, Table, inputCls } from "@/components/admin/ui";
import { Notice } from "@/components/ui/Notice";

export const metadata = { title: "Order" };

export default async function AdminOrderPage({ params }: PageProps<"/admin/orders/[id]">) {
  const { roles } = await requireStaffPage("orders:read");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = await createClient();
  const [{ data: order }, { data: suppliers }] = await Promise.all([
    db
      .from("orders")
      .select(
        `*, order_items ( id, product_id, product_name, product_slug, variant_label, sku, unit_price, quantity, line_total ),
         order_status_history ( id, status, public_note, created_at ),
         shipment_tracking ( id, carrier, tracking_number, tracking_url, dispatched_at ),
         fulfilments ( supplier_id, supplier_order_ref, supplier_cost_total, status, dispatched_at, internal_notes ),
         payments ( reference, amount, currency, status, channel, paid_at, failure_reason, created_at )`,
      )
      .eq("id", id)
      .maybeSingle(),
    db.from("suppliers").select("id, name").order("name"),
  ]);
  if (!order) notFound();

  const productIds = (order.order_items as { product_id: string | null }[]).map((i) => i.product_id).filter(Boolean) as string[];
  const { data: supplierInfo } = productIds.length
    ? await db.from("product_supplier_info").select("product_id, supplier_product_ref, supplier_cost, supplier:suppliers ( name )").in("product_id", productIds)
    : { data: [] };
  const infoBy = new Map((supplierInfo ?? []).map((s) => [s.product_id, s]));

  const status = order.status as OrderStatus;
  const paid = order.payment_status === "paid";
  const transitions = allowedTransitions(status, paid);
  const canUpdate = can(roles, "orders:update");
  const ful = (Array.isArray(order.fulfilments) ? order.fulfilments[0] : order.fulfilments) as { supplier_id: string | null; supplier_order_ref: string | null; supplier_cost_total: number | null; status: string; dispatched_at: string | null; internal_notes: string | null } | null;
  const a = order.shipping_address as Record<string, string | null>;
  const history = [...(order.order_status_history as { id: number; status: OrderStatus; public_note: string | null; created_at: string }[])].sort((x, y) => x.created_at.localeCompare(y.created_at));
  const payments = [...(order.payments as { reference: string; amount: number; currency: string; status: string; channel: string | null; paid_at: string | null; failure_reason: string | null; created_at: string }[])].sort((x, y) => y.created_at.localeCompare(x.created_at));
  const estimatedCost = (order.order_items as { product_id: string | null; quantity: number }[]).reduce((sum, i) => sum + (infoBy.get(i.product_id ?? "")?.supplier_cost ?? 0) * i.quantity, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/admin/orders", label: "Orders" }}
        title={`Order ${order.order_number}`}
        description={`Placed ${new Date(order.created_at).toLocaleString("en-NG", { dateStyle: "long", timeStyle: "short" })}`}
        actions={<><Badge tone={statusTone(status)}>{ORDER_STATUS_LABELS[status]}</Badge><Badge tone={paid ? "success" : "warning"}>Payment: {order.payment_status}</Badge></>}
      />
      {order.inventory_conflict && <Notice tone="error" title="Stock conflict">At least one item didn&apos;t have enough stock when payment was confirmed. Source it from the supplier or cancel and refund the order.</Notice>}
      {payments.some((p) => p.failure_reason === "duplicate_payment_refund_required") && <Notice tone="error" title="Duplicate payment received">The customer paid more than once for this order. Refund the extra transaction in your Paystack dashboard.</Notice>}

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Card title="Items">
            <Table>
              <thead><tr><th>Product</th><th>SKU</th><th>Supplier ref (internal)</th><th>Qty</th><th className="!text-right">Line total</th></tr></thead>
              <tbody>
                {(order.order_items as { id: string; product_id: string | null; product_name: string; variant_label: string | null; sku: string | null; unit_price: number; quantity: number; line_total: number }[]).map((i) => {
                  const info = infoBy.get(i.product_id ?? "");
                  const sup = info && (Array.isArray(info.supplier) ? info.supplier[0] : info.supplier) as { name: string } | null;
                  return (
                    <tr key={i.id}>
                      <td>{i.product_name}<span className="block text-xs text-muted">{i.variant_label}</span></td>
                      <td className="font-mono text-xs">{i.sku}</td>
                      <td className="text-xs">{info ? <>{sup?.name ?? "—"}<span className="block text-muted">{info.supplier_product_ref ?? ""}{info.supplier_cost != null ? ` · cost ${formatMoney(info.supplier_cost)}` : ""}</span></> : <span className="text-muted">Not set</span>}</td>
                      <td>{i.quantity} × {formatMoney(i.unit_price, order.currency)}</td>
                      <td className="text-right tabular-nums">{formatMoney(i.line_total, order.currency)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            <dl className="ml-auto mt-4 max-w-xs space-y-1 text-sm">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatMoney(order.subtotal, order.currency)}</dd></div>
              {order.discount_total > 0 && <div className="flex justify-between"><dt>Discount {order.discount_code && `(${order.discount_code})`}</dt><dd>−{formatMoney(order.discount_total, order.currency)}</dd></div>}
              <div className="flex justify-between"><dt>Shipping ({order.shipping_method_name}{order.shipping_is_manual ? ", manual rate" : ""})</dt><dd>{formatMoney(order.shipping_fee, order.currency)}</dd></div>
              {order.tax_total > 0 && <div className="flex justify-between"><dt>Tax</dt><dd>{formatMoney(order.tax_total, order.currency)}</dd></div>}
              <div className="flex justify-between border-t border-line pt-1 font-semibold"><dt>Total</dt><dd>{formatMoney(order.total, order.currency)}</dd></div>
              {estimatedCost > 0 && <div className="flex justify-between text-xs text-muted"><dt>Est. supplier cost (internal)</dt><dd>{formatMoney(estimatedCost)}</dd></div>}
            </dl>
          </Card>

          {canUpdate && (
            <Card title="Update status" description="Customers see the status and your optional public note. Orders can only be marked paid by verified payments.">
              {transitions.length === 0 ? (
                <p className="text-sm text-muted">No further status changes are available.</p>
              ) : (
                <ActionForm action={updateOrderStatus} submitLabel="Update status">
                  <input type="hidden" name="order_id" value={order.id} />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="New status">
                      <select name="status" className={inputCls} required>
                        {transitions.map((t) => <option key={t} value={t}>{ORDER_STATUS_LABELS[t]}</option>)}
                      </select>
                    </Field>
                    <Field label="Public note (optional)" hint="Shown to the customer on their order timeline.">
                      <input name="public_note" className={inputCls} maxLength={500} />
                    </Field>
                  </div>
                  {paid && (
                    <label className="mt-3 flex items-center gap-2 text-sm">
                      <input type="checkbox" name="restock" className="size-4 accent-[#d94f91]" /> Return items to stock (only applies when cancelling or refunding)
                    </label>
                  )}
                  <p className="mt-3 text-xs text-muted">Refunds must be issued in your Paystack dashboard — this records the refund in the store.</p>
                </ActionForm>
              )}
            </Card>
          )}

          <Card title="Fulfilment (internal)" description="Supplier details, costs and notes are never shown to customers.">
            <ActionForm action={saveFulfilment} submitLabel="Save fulfilment">
              <input type="hidden" name="order_id" value={order.id} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Supplier">
                  <select name="supplier_id" defaultValue={ful?.supplier_id ?? ""} className={inputCls}>
                    <option value="">—</option>
                    {(suppliers ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </Field>
                <Field label="Fulfilment status">
                  <select name="status" defaultValue={ful?.status ?? "not_started"} className={inputCls}>
                    {[["not_started", "Not started"], ["awaiting_supplier", "Awaiting supplier"], ["ordered_from_supplier", "Ordered from supplier"], ["shipped", "Shipped"], ["delivered", "Delivered"], ["cancelled", "Cancelled"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </Field>
                <Field label="Supplier order reference"><input name="supplier_order_ref" defaultValue={ful?.supplier_order_ref ?? ""} className={inputCls} /></Field>
                <Field label="Supplier cost (₦)"><input name="supplier_cost_total" inputMode="decimal" defaultValue={toMajorString(ful?.supplier_cost_total)} className={inputCls} /></Field>
                <Field label="Dispatch date"><input type="date" name="dispatched_at" defaultValue={ful?.dispatched_at?.slice(0, 10) ?? ""} className={inputCls} /></Field>
                <Field label="Internal notes" className="sm:col-span-2"><textarea name="internal_notes" rows={3} defaultValue={ful?.internal_notes ?? ""} className={inputCls} /></Field>
              </div>
              <p className="mt-3 text-xs text-muted">Supplier orders are placed manually — no supplier API is connected.</p>
            </ActionForm>
          </Card>

          <Card title="Tracking" description="Visible to the customer on their order page and the tracking page.">
            {(order.shipment_tracking as { id: string; carrier: string | null; tracking_number: string | null; tracking_url: string | null; dispatched_at: string | null }[]).map((t) => (
              <div key={t.id} className="mb-3 flex items-start justify-between gap-3 bg-neutral p-3 text-sm">
                <span>
                  <span className="font-semibold">{t.carrier ?? "Courier"}</span> {t.tracking_number && <span className="font-mono">{t.tracking_number}</span>}
                  {t.tracking_url && <a href={t.tracking_url} target="_blank" rel="noopener noreferrer" className="block text-xs text-rose-deep underline">{t.tracking_url}</a>}
                </span>
                <ActionForm action={removeTracking} submitLabel="Remove" variant="ghost" inline confirm="Remove this tracking entry?">
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="order_id" value={order.id} />
                </ActionForm>
              </div>
            ))}
            <ActionForm action={addTracking} submitLabel="Add tracking" resetOnSuccess>
              <input type="hidden" name="order_id" value={order.id} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Carrier"><input name="carrier" className={inputCls} placeholder="e.g. GIG Logistics" /></Field>
                <Field label="Tracking number"><input name="tracking_number" className={inputCls} /></Field>
                <Field label="Tracking URL"><input name="tracking_url" type="url" className={inputCls} placeholder="https://" /></Field>
                <Field label="Dispatch date"><input name="dispatched_at" type="date" className={inputCls} /></Field>
              </div>
            </ActionForm>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Customer">
            <p className="text-sm font-semibold">{order.customer_name}</p>
            <p className="text-sm"><a href={`mailto:${order.email}`} className="underline">{order.email}</a></p>
            <p className="text-sm">{order.phone}</p>
            <p className="mt-2 text-xs text-muted">{order.user_id ? "Registered customer" : "Guest checkout"}</p>
          </Card>
          <Card title="Delivery">
            <address className="text-sm not-italic leading-relaxed">
              {a.full_name}<br />{a.line1}{a.line2 && <><br />{a.line2}</>}<br />{a.city}, {a.region} {a.postal_code}<br />{a.country_code}<br />{a.phone}
            </address>
            <p className="mt-3 text-sm"><span className="font-semibold">{order.shipping_method_name}</span> · {formatMoney(order.shipping_fee, order.currency)}</p>
            <p className="text-xs text-muted">{formatDeliveryWindow(order.shipping_min_days, order.shipping_max_days) ?? "No estimate configured"}{order.shipping_is_manual ? " · manual rate" : ""}</p>
            {order.delivery_instructions && <p className="mt-3 bg-neutral p-3 text-sm"><span className="font-semibold">Instructions:</span> {order.delivery_instructions}</p>}
          </Card>
          <Card title="Payments">
            {payments.length === 0 ? <p className="text-sm text-muted">No payment attempts.</p> : (
              <ul className="space-y-3 text-sm">
                {payments.map((p) => (
                  <li key={p.reference} className="border-b border-line pb-3 last:border-0">
                    <div className="flex items-center justify-between"><span className="font-mono text-xs">{p.reference}</span><Badge tone={p.status === "success" ? "success" : p.status === "failed" ? "danger" : "neutral"}>{p.status}</Badge></div>
                    <p className="text-xs text-muted">{formatMoney(p.amount, p.currency)} · {p.channel ?? "—"} · {new Date(p.created_at).toLocaleString("en-NG")}</p>
                    {p.failure_reason && <p className="text-xs text-danger">{p.failure_reason}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Timeline">
            <ol className="space-y-3 text-sm">
              {history.map((h) => (
                <li key={h.id}>
                  <span className="font-semibold">{ORDER_STATUS_LABELS[h.status]}</span>
                  <span className="block text-xs text-muted">{new Date(h.created_at).toLocaleString("en-NG")}</span>
                  {h.public_note && <span className="block text-xs">“{h.public_note}”</span>}
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}
