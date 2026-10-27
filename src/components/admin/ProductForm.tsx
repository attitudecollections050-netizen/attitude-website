import { toMajorString } from "@/lib/money";
import { Field, inputCls } from "./ui";

export interface CategoryOption {
  id: string;
  name: string;
  parent: string | null;
}

export function ProductFields({
  categories,
  product,
}: {
  categories: CategoryOption[];
  product?: {
    name: string; slug: string; description: string; details: string | null; category_id: string; price: number; sale_price: number | null;
    weight_grams: number; status: string; is_featured: boolean; allow_backorder: boolean; tags: string[];
  };
}) {
  const groups = new Map<string, CategoryOption[]>();
  categories.forEach((c) => {
    const key = c.parent ?? "Top level";
    groups.set(key, [...(groups.get(key) ?? []), c]);
  });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Product name" className="sm:col-span-2"><input name="name" required defaultValue={product?.name} className={inputCls} maxLength={140} /></Field>
      <Field label="URL slug" hint="Leave blank to generate from the name."><input name="slug" defaultValue={product?.slug} className={inputCls} pattern="[a-z0-9]+(-[a-z0-9]+)*" /></Field>
      <Field label="Category">
        <select name="category_id" required defaultValue={product?.category_id ?? ""} className={inputCls}>
          <option value="" disabled>Choose…</option>
          {[...groups.entries()].map(([group, items]) => (
            <optgroup key={group} label={group}>
              {items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </optgroup>
          ))}
        </select>
      </Field>
      <Field label="Price (₦)"><input name="price" required inputMode="decimal" defaultValue={toMajorString(product?.price)} className={inputCls} placeholder="25000" /></Field>
      <Field label="Sale price (₦)" hint="Optional. Must be lower than the price."><input name="sale_price" inputMode="decimal" defaultValue={toMajorString(product?.sale_price)} className={inputCls} /></Field>
      <Field label="Weight (grams)" hint="Used for weight-based shipping rates."><input name="weight_grams" type="number" min={0} required defaultValue={product?.weight_grams ?? 500} className={inputCls} /></Field>
      <Field label="Status">
        <select name="status" defaultValue={product?.status ?? "draft"} className={inputCls}>
          <option value="draft">Draft (hidden)</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
      </Field>
      <Field label="Description" className="sm:col-span-2"><textarea name="description" rows={5} defaultValue={product?.description} className={inputCls} maxLength={5000} /></Field>
      <Field label="Details & care" className="sm:col-span-2"><textarea name="details" rows={3} defaultValue={product?.details ?? ""} className={inputCls} maxLength={5000} /></Field>
      <Field label="Tags" hint="Comma separated — used in search." className="sm:col-span-2"><input name="tags" defaultValue={product?.tags.join(", ")} className={inputCls} /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_featured" defaultChecked={product?.is_featured} className="size-4 accent-[#d94f91]" /> Featured on homepage</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="allow_backorder" defaultChecked={product?.allow_backorder} className="size-4 accent-[#d94f91]" /> Allow backorders when out of stock</label>
    </div>
  );
}
