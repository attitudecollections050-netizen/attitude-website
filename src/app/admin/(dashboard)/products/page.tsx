import Link from "next/link";
import { requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import { Badge, Empty, PageHeader, Table, inputCls } from "@/components/admin/ui";
import { buttonClasses } from "@/components/ui/Button";
import { SmartImage } from "@/components/ui/SmartImage";
import { Notice } from "@/components/ui/Notice";

export const metadata = { title: "Products" };

type Row = {
  id: string; name: string; slug: string; status: string; price: number; sale_price: number | null; is_featured: boolean; allow_backorder: boolean; updated_at: string;
  category: { name: string } | null;
  product_images: { url: string; sort_order: number }[];
  product_variants: { is_active: boolean; inventory: { on_hand: number; low_stock_threshold: number } | null }[];
};

export default async function AdminProductsPage({ searchParams }: PageProps<"/admin/products">) {
  await requireStaffPage("catalog:write");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const status = typeof sp.status === "string" ? sp.status : "";
  const stock = typeof sp.stock === "string" ? sp.stock : "";
  const db = await createClient();
  let query = db
    .from("products")
    .select("id, name, slug, status, price, sale_price, is_featured, allow_backorder, updated_at, category:categories ( name ), product_images ( url, sort_order ), product_variants ( is_active, inventory ( on_hand, low_stock_threshold ) )")
    .order("updated_at", { ascending: false })
    .limit(300);
  if (q) query = query.ilike("name", `%${q.replace(/[%,]/g, "")}%`);
  if (status) query = query.eq("status", status);
  const { data } = await query;
  const rows = ((data ?? []) as unknown as Row[]).map((p) => {
    const active = p.product_variants.filter((v) => v.is_active);
    const total = active.reduce((n, v) => n + Math.max(0, v.inventory?.on_hand ?? 0), 0);
    const low = active.some((v) => (v.inventory?.on_hand ?? 0) > 0 && (v.inventory?.on_hand ?? 0) <= (v.inventory?.low_stock_threshold ?? 3));
    const image = [...p.product_images].sort((a, b) => a.sort_order - b.sort_order)[0]?.url ?? null;
    return { ...p, total, low, image, variants: active.length };
  });
  const filtered = rows.filter((r) => (stock === "out" ? r.total === 0 && !r.allow_backorder : stock === "low" ? r.low : stock === "in" ? r.total > 0 : true));

  return (
    <div>
      <PageHeader title="Products" description={`${filtered.length} product(s)`} actions={<Link href="/admin/products/new" className={buttonClasses("primary", "sm")}>Add product</Link>} />
      {sp.deleted && <Notice tone="success" className="mb-4">Product deleted.</Notice>}
      <form className="mb-5 grid gap-3 sm:grid-cols-[1fr_11rem_11rem_auto]" role="search">
        <input name="q" defaultValue={q} placeholder="Search by name" className={inputCls} aria-label="Search products" />
        <select name="status" defaultValue={status} className={inputCls} aria-label="Status">
          <option value="">Any status</option><option value="published">Published</option><option value="draft">Draft</option><option value="archived">Archived</option>
        </select>
        <select name="stock" defaultValue={stock} className={inputCls} aria-label="Stock">
          <option value="">Any stock</option><option value="in">In stock</option><option value="low">Low stock</option><option value="out">Out of stock</option>
        </select>
        <button className={buttonClasses("primary", "sm", "h-full")}>Filter</button>
      </form>
      {filtered.length === 0 ? (
        <Empty>No products found. <Link href="/admin/products/new" className="underline">Add your first product</Link>.</Empty>
      ) : (
        <Table>
          <thead><tr><th>Product</th><th>Category</th><th>Status</th><th>Stock</th><th className="!text-right">Price</th></tr></thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3 hover:text-rose-deep">
                    <span className="relative size-12 shrink-0 overflow-hidden bg-neutral"><SmartImage src={p.image} alt="" fill sizes="48px" className="object-cover" /></span>
                    <span><span className="font-semibold">{p.name}</span>{p.is_featured && <span className="ml-2"><Badge tone="rose">Featured</Badge></span>}<span className="block text-xs text-muted">{p.variants} variant(s)</span></span>
                  </Link>
                </td>
                <td className="text-xs">{p.category?.name}</td>
                <td><Badge tone={p.status === "published" ? "success" : p.status === "draft" ? "warning" : "neutral"}>{p.status}</Badge></td>
                <td>{p.total === 0 ? <Badge tone={p.allow_backorder ? "warning" : "danger"}>{p.allow_backorder ? "Backorder" : "Out"}</Badge> : <span className="tabular-nums">{p.total}</span>}{p.low && p.total > 0 && <span className="ml-2"><Badge tone="warning">Low</Badge></span>}</td>
                <td className="text-right tabular-nums">{p.sale_price != null ? <><span className="text-rose-deep">{formatMoney(p.sale_price)}</span> <s className="text-xs text-muted">{formatMoney(p.price)}</s></> : formatMoney(p.price)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
