import Link from "next/link";
import { requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import { Badge, Empty, PageHeader, Table, inputCls } from "@/components/admin/ui";
import { buttonClasses } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";

export const metadata = { title: "Customers" };
const PAGE = 40;

/** Registered accounts and guest shoppers, combined by email address. */
export default async function CustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  await requireStaffPage("customers:read");
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const q = one(sp.q).trim().slice(0, 80);
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const db = await createClient();
  const { data, error } = await db.rpc("admin_customers", { p_query: q || null, p_limit: PAGE, p_offset: (page - 1) * PAGE });
  type Row = { email: string; full_name: string | null; phone: string | null; user_id: string | null; registered_at: string | null; orders: number; paid_orders: number; total_spent: number; currency: string; last_order_at: string | null; total_count: number };
  const rows = (data ?? []) as Row[];
  const total = rows[0]?.total_count ?? 0;
  const pages = Math.ceil(total / PAGE);

  return (
    <div>
      <PageHeader title="Customers" description={`${total} customer(s). Registered accounts and guest checkouts, matched by email. “Spent” counts paid orders that weren’t cancelled or refunded.`} />
      <form className="mb-5 grid gap-3 sm:grid-cols-[1fr_auto]" role="search">
        <input name="q" defaultValue={q} placeholder="Search name or email" className={inputCls} aria-label="Search customers" />
        <button className={buttonClasses("primary", "sm", "h-full")}>Search</button>
      </form>
      {error && <Notice tone="error" className="mb-4">{error.message}</Notice>}
      {rows.length === 0 ? (
        <Empty>{q ? "No customers match." : "No customers yet. They appear when someone registers or places an order."}</Empty>
      ) : (
        <Table>
          <thead><tr><th>Customer</th><th>Account</th><th className="!text-right">Orders</th><th className="!text-right">Paid</th><th className="!text-right">Spent</th><th>Last order</th></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.email}>
                <td><span className="font-semibold">{c.full_name || "—"}</span><span className="block text-xs text-muted">{c.email}{c.phone ? ` · ${c.phone}` : ""}</span></td>
                <td>{c.registered_at ? <Badge tone="plum">Registered</Badge> : <Badge>Guest</Badge>}</td>
                <td className="text-right tabular-nums">{c.orders > 0 ? <Link href={`/admin/orders?q=${encodeURIComponent(c.email)}`} className="underline-offset-4 hover:underline">{c.orders}</Link> : 0}</td>
                <td className="text-right tabular-nums">{c.paid_orders}</td>
                <td className="text-right tabular-nums">{formatMoney(c.total_spent, c.currency)}</td>
                <td className="text-xs">{c.last_order_at ? new Date(c.last_order_at).toLocaleDateString("en-NG", { dateStyle: "medium" }) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {pages > 1 && (
        <nav className="mt-6 flex items-center justify-center gap-2 text-sm" aria-label="Pagination">
          {page > 1 && <Link href={`?${new URLSearchParams({ q, page: String(page - 1) })}`} className="px-3 py-1.5 hover:text-rose-deep">← Prev</Link>}
          <span className="text-muted">Page {page} of {pages}</span>
          {page < pages && <Link href={`?${new URLSearchParams({ q, page: String(page + 1) })}`} className="px-3 py-1.5 hover:text-rose-deep">Next →</Link>}
        </nav>
      )}
    </div>
  );
}
