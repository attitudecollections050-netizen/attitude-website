import { requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { deleteCollection, saveCollection, setCollectionProducts } from "@/app/admin/actions/catalog";
import { ActionForm } from "@/components/admin/ActionForm";
import { Badge, Card, Field, PageHeader, inputCls } from "@/components/admin/ui";

export const metadata = { title: "Collections" };

type Col = { id: string; slug: string; name: string; description: string | null; image_url: string | null; sort_order: number; is_featured: boolean; is_active: boolean; collection_products: { product_id: string }[] };

function Fields({ c }: { c?: Col }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {c && <input type="hidden" name="id" value={c.id} />}
      <Field label="Name"><input name="name" required defaultValue={c?.name} className={inputCls} /></Field>
      <Field label="Slug" hint="Blank = from name"><input name="slug" defaultValue={c?.slug} className={inputCls} /></Field>
      <Field label="Image URL"><input name="image_url" type="url" defaultValue={c?.image_url ?? ""} className={inputCls} placeholder="https://" /></Field>
      <Field label="Sort order"><input name="sort_order" type="number" min={0} defaultValue={c?.sort_order ?? 0} className={inputCls} /></Field>
      <Field label="Description" className="sm:col-span-2"><input name="description" defaultValue={c?.description ?? ""} className={inputCls} /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_featured" defaultChecked={c?.is_featured ?? true} className="size-4 accent-[#d94f91]" /> Feature on homepage</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={c?.is_active ?? true} className="size-4 accent-[#d94f91]" /> Active</label>
    </div>
  );
}

export default async function CollectionsAdmin() {
  await requireStaffPage("catalog:write");
  const db = await createClient();
  const [{ data: cols }, { data: products }] = await Promise.all([
    db.from("collections").select("*, collection_products ( product_id )").order("sort_order"),
    db.from("products").select("id, name, status").neq("status", "archived").order("name"),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="Featured collections" description="Curated sets of products. Featured collections appear on the homepage." />
      <Card title="New collection"><ActionForm action={saveCollection} submitLabel="Create" resetOnSuccess><Fields /></ActionForm></Card>
      {((cols ?? []) as Col[]).map((c) => {
        const selected = new Set(c.collection_products.map((p) => p.product_id));
        return (
          <Card key={c.id} title={c.name} actions={<div className="flex gap-2">{c.is_featured && <Badge tone="rose">Homepage</Badge>}{!c.is_active && <Badge tone="warning">Inactive</Badge>}<Badge>{selected.size} products</Badge></div>}>
            <ActionForm action={saveCollection}><Fields c={c} /></ActionForm>
            <details className="mt-5 border-t border-line pt-4">
              <summary className="cursor-pointer text-sm font-semibold">Choose products</summary>
              <ActionForm action={setCollectionProducts} submitLabel="Save products">
                <input type="hidden" name="collection_id" value={c.id} />
                <div className="mt-3 grid max-h-80 gap-1 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
                  {(products ?? []).map((p) => (
                    <label key={p.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="product_ids" value={p.id} defaultChecked={selected.has(p.id)} className="size-4 accent-[#d94f91]" />
                      {p.name} {p.status === "draft" && <span className="text-xs text-muted">(draft)</span>}
                    </label>
                  ))}
                </div>
              </ActionForm>
            </details>
            <ActionForm action={deleteCollection} submitLabel="Delete collection" variant="ghost" confirm="Delete this collection? Products are not deleted."><input type="hidden" name="id" value={c.id} /></ActionForm>
          </Card>
        );
      })}
    </div>
  );
}
