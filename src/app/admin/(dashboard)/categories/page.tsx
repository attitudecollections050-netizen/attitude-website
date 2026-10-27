import { requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { deleteCategory, saveCategory } from "@/app/admin/actions/catalog";
import { ActionForm } from "@/components/admin/ActionForm";
import { Badge, Card, Field, PageHeader, inputCls } from "@/components/admin/ui";

export const metadata = { title: "Categories" };

type Cat = { id: string; parent_id: string | null; slug: string; name: string; description: string | null; image_url: string | null; sort_order: number; is_active: boolean };

function CategoryFields({ c, parents }: { c?: Cat; parents: Cat[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {c && <input type="hidden" name="id" value={c.id} />}
      <Field label="Name"><input name="name" required defaultValue={c?.name} className={inputCls} /></Field>
      <Field label="Slug" hint="Blank = from name"><input name="slug" defaultValue={c?.slug} className={inputCls} /></Field>
      <Field label="Parent">
        <select name="parent_id" defaultValue={c?.parent_id ?? ""} className={inputCls}>
          <option value="">— Top level —</option>
          {parents.filter((p) => p.id !== c?.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
      <Field label="Sort order"><input name="sort_order" type="number" min={0} defaultValue={c?.sort_order ?? 0} className={inputCls} /></Field>
      <Field label="Image URL" className="sm:col-span-2"><input name="image_url" type="url" defaultValue={c?.image_url ?? ""} className={inputCls} placeholder="https://" /></Field>
      <Field label="Description" className="sm:col-span-2"><input name="description" defaultValue={c?.description ?? ""} className={inputCls} /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={c?.is_active ?? true} className="size-4 accent-[#d94f91]" /> Visible in store</label>
    </div>
  );
}

export default async function CategoriesPage() {
  await requireStaffPage("catalog:write");
  const db = await createClient();
  const { data } = await db.from("categories").select("*").order("sort_order").order("name");
  const cats = (data ?? []) as Cat[];
  const tops = cats.filter((c) => !c.parent_id);
  return (
    <div className="space-y-6">
      <PageHeader title="Categories" description="Top-level categories appear in the main navigation; subcategories appear in dropdowns and filters." />
      <Card title="Add category">
        <ActionForm action={saveCategory} submitLabel="Add category" resetOnSuccess><CategoryFields parents={tops} /></ActionForm>
      </Card>
      {tops.map((top) => (
        <Card key={top.id} title={top.name} actions={!top.is_active ? <Badge tone="warning">Hidden</Badge> : undefined}>
          <details>
            <summary className="cursor-pointer text-sm text-muted">Edit “{top.name}”</summary>
            <div className="mt-4">
              <ActionForm action={saveCategory}><CategoryFields c={top} parents={tops} /></ActionForm>
              <ActionForm action={deleteCategory} submitLabel="Delete category" variant="ghost" confirm={`Delete ${top.name}?`}><input type="hidden" name="id" value={top.id} /></ActionForm>
            </div>
          </details>
          <ul className="mt-4 divide-y divide-line border-t border-line">
            {cats.filter((c) => c.parent_id === top.id).map((c) => (
              <li key={c.id} className="py-3">
                <details>
                  <summary className="flex cursor-pointer items-center gap-3 text-sm">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-xs text-muted">/shop/{top.slug}/{c.slug}</span>
                    {!c.is_active && <Badge tone="warning">Hidden</Badge>}
                  </summary>
                  <div className="mt-3 bg-neutral p-4">
                    <ActionForm action={saveCategory}><CategoryFields c={c} parents={tops} /></ActionForm>
                    <ActionForm action={deleteCategory} submitLabel="Delete" variant="ghost" confirm={`Delete ${c.name}?`}><input type="hidden" name="id" value={c.id} /></ActionForm>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
