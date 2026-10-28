import Link from "next/link";
import { requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import { isPaystackConfigured, paystackMode } from "@/lib/env";
import { Badge, Empty, PageHeader, Table, inputCls } from "@/components/admin/ui";
import { buttonClasses } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";

export const metadata = { title: "Payments" };

const PAGE = 30;
const STATUS: Record<string, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  success: { label: "Successful", tone: "success" },
  initialized: { label: "Pending", tone: "warning" },
  failed: { label: "Failed", tone: "danger" },
  abandoned: { label: "Abandoned", tone: "neutral" },
};

/** Every Paystack payment attempt, as verified by the server. */
export default async function PaymentsPage({ searchParams }: PageProps<"/admin/payments">) {
  await requireStaffPage("orders:read");
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const status = Object.keys(STATUS).includes(one(sp.status)) ? one(sp.status) : "";
  const q = one(sp.q).replace(/[,%()*]/g, " ").trim().slice(0, 80);
  const page = Math.max(1, Number(one(sp.page)) || 1);

  const db = await createClient();
  let query = db
    .from("payments")
    .select("id, reference, amount, currency, status, channel, paid_at, failure_reason, created_at, order:orders!inner ( id, order_number, email, customer_name, payment_status, status )", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (status) query = query.eq("status", status);
  if (q) query = query.or(`reference.ilike.%${q}%`);
  const { data, count, error } = await query;
  type Row = { id: string; reference: string; amount: number; currency: string; status: string; channel: string | null; paid_at: string | null; failure_reason: string | null; created_at: string; order: { id: string; order_number: string; email: string; customer_name: string; payment_status: string; status: string } };
  const rows = (data ?? []) as unknown as Row[];
  const pages = Math.ceil((count ?? 0) / PAGE);
  const qs = (extra: Record<string, string | number>) => {
    const p = new URLSearchParams();
    if (status) p.set("status", status);
    if (q) p.set("q", q);
    for (const [k, v] of Object.entries(extra)) p.set(k, String(v));
    return p.toString();
  };

  return (
    <div>
      <PageHeader title="Payments" description="Each Paystack payment attempt. A payment is only marked successful after the server re-checks it with Paystack — the browser can never mark an order paid." actions={<Link href="/admin/analytics" className={buttonClasses("outline", "sm")}>Revenue reports</Link>} />
      {!isPaystackConfigured() && <Notice tone="warning" title="Paystack not configured" className="mb-5">Add PAYSTACK_SECRET_KEY and NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY in your hosting environment to accept payments.</Notice>}
      {paystackMode() === "test" && <Notice tone="info" title="Test mode" className="mb-5">You are using Paystack test keys. These payments are not real money.</Notice>}
      <form className="mb-5 grid gap-3 sm:grid-cols-[1fr_12rem_auto]" role="search">
        <input name="q" defaultValue={q} placeholder="Search payment reference" className={inputCls} aria-label="Search payment reference" />
        <select name="status" defaultValue={status} className={inputCls} aria-label="Payment status">
          <option value="">All statuses</option>
          {Object.entries(STATUS).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
        </select>
        <button className={buttonClasses("primary", "sm", "h-full")}>Filter</button>
      </form>
      {error && <Notice tone="error" className="mb-4">{error.message}</Notice>}
      {rows.length === 0 ? (
        <Empty>No payments yet. They appear here when customers start paying at checkout.</Empty>
      ) : (
        <Table>
          <thead><tr><th>Started</th><th>Order</th><th>Reference</th><th>Status</th><th>Channel</th><th className="!text-right">Amount</th></tr></thead>
          <tbody>
            {rows.map((p) => {
              const s = STATUS[p.status] ?? { label: p.status, tone: "neutral" as const };
              return (
                <tr key={p.id}>
                  <td className="text-xs">{new Date(p.created_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}{p.paid_at && <span className="block text-muted">Paid {new Date(p.paid_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}</span>}</td>
                  <td><Link href={`/admin/orders/${p.order.id}`} className="font-semibold hover:text-rose-deep">{p.order.order_number}</Link><span className="block text-xs text-muted">{p.order.customer_name}</span></td>
                  <td className="font-mono text-xs">{p.reference}</td>
                  <td>
                    <Badge tone={s.tone}>{s.label}</Badge>
                    {p.failure_reason === "duplicate_payment_refund_required" ? <span className="mt-1 block text-xs text-danger">Duplicate — refund in Paystack</span> : p.failure_reason && <span className="mt-1 block max-w-[14rem] truncate text-xs text-muted" title={p.failure_reason}>{p.failure_reason}</span>}
                    {p.order.payment_status === "refunded" && <span className="mt-1 block text-xs text-muted">Order refunded</span>}
                  </td>
                  <td className="text-xs capitalize">{p.channel ?? "—"}</td>
                  <td className="text-right tabular-nums">{formatMoney(p.amount, p.currency)}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
      {pages > 1 && (
        <nav className="mt-6 flex items-center justify-center gap-2 text-sm" aria-label="Pagination">
          {page > 1 && <Link href={`?${qs({ page: page - 1 })}`} className="px-3 py-1.5 hover:text-rose-deep">← Prev</Link>}
          <span className="text-muted">Page {page} of {pages}</span>
          {page < pages && <Link href={`?${qs({ page: page + 1 })}`} className="px-3 py-1.5 hover:text-rose-deep">Next →</Link>}
        </nav>
      )}
    </div>
  );
}
