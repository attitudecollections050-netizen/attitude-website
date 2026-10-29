"use client";
import { useActionState, useState } from "react";
import { ImagePlus, Plus } from "lucide-react";
import { quickAddProduct } from "@/app/admin/actions/products";
import type { AdminResult } from "@/app/admin/actions/types";
import type { CategoryOption } from "./ProductForm";
import { Notice } from "@/components/ui/Notice";
import { Button } from "@/components/ui/Button";
import { Field, inputCls } from "./ui";

/** Compact "add a product" form for the dashboard; sizes, colours and stock follow on the edit page. */
export function QuickAddProduct({ categories }: { categories: CategoryOption[] }) {
  const [state, action, pending] = useActionState<AdminResult, FormData>(quickAddProduct, null);
  const [file, setFile] = useState<string | null>(null);
  const groups = new Map<string, CategoryOption[]>();
  categories.forEach((c) => {
    const key = c.parent ?? "Top level";
    groups.set(key, [...(groups.get(key) ?? []), c]);
  });
  return (
    <form action={action} className="space-y-4" data-testid="quick-add">
      {state && !state.ok && <Notice tone="error">{state.message}</Notice>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Product name" className="lg:col-span-2">
          <input name="name" required maxLength={140} className={inputCls} placeholder="e.g. Lace-up sweatpants" />
        </Field>
        <Field label="Price (₦)">
          <input name="price" required inputMode="decimal" className={inputCls} placeholder="42000" />
        </Field>
        <Field label="Category">
          <select name="category_id" required defaultValue="" className={inputCls}>
            <option value="" disabled>Choose…</option>
            {[...groups.entries()].map(([group, items]) => (
              <optgroup key={group} label={group}>
                {items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </optgroup>
            ))}
          </select>
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-dashed border-rose/40 bg-blush/50 px-4 py-2.5 text-sm font-semibold text-rose-deep transition hover:border-rose">
          <ImagePlus className="size-4" aria-hidden />
          <span className="max-w-48 truncate">{file ?? "Add photo (optional)"}</span>
          <input name="files" type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple className="sr-only" onChange={(e) => setFile(e.currentTarget.files?.length ? `${e.currentTarget.files.length} photo(s) chosen` : null)} />
        </label>
        <Button type="submit" size="sm" variant="rose" loading={pending} disabled={pending}>
          <Plus className="size-4" aria-hidden /> Add product
        </Button>
        <span className="text-xs text-muted">Saved as a draft. Next you&apos;ll add sizes, colours and stock, then publish.</span>
      </div>
    </form>
  );
}
