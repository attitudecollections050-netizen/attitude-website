import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { adminHome } from "@/lib/permissions";
import { formatMoney } from "@/lib/money";
import { earningsFor, PRODUCTS_PER_REWARD, REWARD_KOBO } from "@/lib/staff-earnings";
import { buttonClasses } from "@/components/ui/Button";

export const metadata = { title: "My Dashboard" };

const STATUS: Record<string, string> = { published: "Live", draft: "Draft", archived: "Archived" };
const dateFmt = new Intl.DateTimeFormat("en-NG", { month: "short", day: "numeric", year: "numeric", timeZone: "Africa/Lagos" });

type Row = { id: string; name: string; price: number; sale_price: number | null; status: string; created_at: string };

export default async function StaffDashboardPage({ searchParams }: PageProps<"/staff/dashboard">) {
  const { user, roles, permissions } = await requireStaffPage(null);
  const isOwner = roles.includes("admin");
  const sp = await searchParams;
  const as = typeof sp.as === "string" && /^[0-9a-f-]{36}$/.test(sp.as) ? sp.as : null;

  // Staff always see themselves (?as is ignored). The owner may preview a staff member's view.
  let targetId = user.id;
  if (isOwner) {
    if (!as) redirect("/admin/staff");
    targetId = as;
  } else if (!permissions.includes("earnings:self")) {
    redirect(adminHome(permissions));
  }

  const db = await createClient();
  const [{ data: staff }, { data: stats, error: statsError }, { data: products }] = await Promise.all([
    db.from("staff_members").select("full_name, email").eq("user_id", targetId).maybeSingle(),
    // The database refuses anyone else's numbers unless the caller is the owner.
    db.rpc("staff_product_stats", { p_user_id: targetId }),
    db.from("products").select("id, name, price, sale_price, status, created_at").eq("added_by", targetId).order("created_at", { ascending: false }).limit(200),
  ]);
  if (statsError) redirect(isOwner ? "/admin/staff" : adminHome(permissions));
  if (isOwner && !staff) redirect("/admin/staff");

  const row = (stats as { products_added: number; live_products: number }[] | null)?.[0];
  const added = row?.products_added ?? 0;
  const live = row?.live_products ?? 0;
  const e = earningsFor(live);
  const name = staff?.full_name || (!isOwner ? (user.user_metadata?.full_name as string | undefined) : undefined) || "there";
  const email = staff?.email ?? user.email ?? "";
  const reward = formatMoney(REWARD_KOBO);
  const rows = (products ?? []) as Row[];

  return (
    <div className="space-y-10">
      {isOwner && (
        <p className="border border-black px-4 py-3 text-xs uppercase tracking-[0.16em]">Viewing as staff (read only) — this is exactly what {email} sees.</p>
      )}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-black/50">Product Staff</p>
        <h1 className="mt-2 font-display text-4xl sm:text-5xl">Welcome back, {name}</h1>
        <p className="mt-1 text-sm text-black/60">{email}</p>
      </div>

      <section id="earnings" className="grid scroll-mt-6 gap-px border border-black bg-black sm:grid-cols-3" aria-label="My earnings">
        <div className="bg-white p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/50">Products added</p>
          <p className="mt-3 font-display text-5xl">{added}</p>
          <p className="mt-1 text-xs text-black/60">{live} live in the store</p>
        </div>
        <div className="bg-white p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/50">Total earned</p>
          <p className="mt-3 text-5xl font-extrabold tracking-tight text-success" data-testid="earned">{formatMoney(e.earnedKobo)}</p>
          <p className="mt-1 text-xs text-black/60">{reward} per {PRODUCTS_PER_REWARD} live products</p>
        </div>
        <div className="bg-white p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/50">Next payout</p>
          <p className="mt-3 font-display text-5xl">{e.progress}/{PRODUCTS_PER_REWARD}</p>
          <p className="mt-1 text-xs text-black/60">{e.remaining} more {e.remaining === 1 ? "product" : "products"} = +{reward}</p>
        </div>
      </section>

      <div>
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold uppercase tracking-[0.16em]">{e.percent}% to next {reward}</span>
          <span className="text-black/60">{e.progress} of {PRODUCTS_PER_REWARD}</span>
        </div>
        <div className="mt-2 h-2 w-full bg-black/10" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={e.percent} aria-label={`Progress to next ${reward}`}>
          <div className="h-full bg-black transition-[width] duration-700" style={{ width: `${e.percent}%` }} />
        </div>
      </div>

      <section aria-labelledby="my-products">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <h2 id="my-products" className="font-display text-3xl">My added products</h2>
          {!isOwner && <Link href="/admin/products/new" className={buttonClasses("primary", "sm")}>Add new product</Link>}
        </div>
        {rows.length === 0 ? (
          <p className="border border-dashed border-black/30 px-6 py-10 text-center text-sm text-black/60">No products yet. Your first one is a click away.</p>
        ) : (
          <div className="overflow-x-auto border border-black">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead className="border-b border-black text-[11px] uppercase tracking-[0.16em]">
                <tr><th className="px-4 py-3 font-bold">Product name</th><th className="px-4 py-3 font-bold">Price</th><th className="px-4 py-3 font-bold">Date added</th><th className="px-4 py-3 font-bold">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-black/10">
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-medium">{isOwner ? p.name : <Link href={`/admin/products/${p.id}`} className="hover:underline">{p.name}</Link>}</td>
                    <td className="px-4 py-3">{formatMoney(p.sale_price ?? p.price)}</td>
                    <td className="px-4 py-3 text-black/60">{dateFmt.format(new Date(p.created_at))}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] ${p.status === "published" ? "border-black bg-black text-white" : "border-black/30 text-black/60"}`}>{STATUS[p.status] ?? p.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <aside className="border border-black bg-neutral p-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em]">How you earn</p>
        <p className="mt-2 text-sm">
          {reward} for every {PRODUCTS_PER_REWARD} products you add that are live in the store. Drafts count once they&apos;re published; archived products don&apos;t count. Keep adding!
        </p>
      </aside>
    </div>
  );
}
