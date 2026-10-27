import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaffPage } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { categoryOptions } from "@/lib/admin/categories";
import { toMajorString } from "@/lib/money";
import {
  addImageUrl, deleteImage, deleteProduct, deleteVariant, generateVariants, saveSupplierInfo, saveVariant, setProductStatus, updateImage, updateProduct, uploadProductImages,
} from "@/app/admin/actions/products";
import { ActionForm } from "@/components/admin/ActionForm";
import { ProductFields } from "@/components/admin/ProductForm";
import { Badge, Card, Field, PageHeader, inputCls } from "@/components/admin/ui";
import { SmartImage } from "@/components/ui/SmartImage";
import { Notice } from "@/components/ui/Notice";

export const metadata = { title: "Edit product" };

export default async function EditProductPage({ params, searchParams }: PageProps<"/admin/products/[id]">) {
  const { roles } = await requireStaffPage("catalog:write");
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = await createClient();
  const [{ data: product }, categories, { data: suppliers }, { data: supplierInfo }] = await Promise.all([
    db
      .from("products")
      .select("*, product_images ( id, url, alt, color, sort_order, storage_path ), product_variants ( id, sku, size, color, color_hex, is_active, sort_order, inventory ( on_hand, low_stock_threshold ) )")
      .eq("id", id)
      .maybeSingle(),
    categoryOptions(),
    db.from("suppliers").select("id, name").eq("is_active", true).order("name"),
    db.from("product_supplier_info").select("*").eq("product_id", id).maybeSingle(),
  ]);
  if (!product) notFound();
  const images = [...(product.product_images as { id: string; url: string; alt: string; color: string | null; sort_order: number }[])].sort((a, b) => a.sort_order - b.sort_order);
  type V = { id: string; sku: string; size: string | null; color: string | null; color_hex: string | null; is_active: boolean; sort_order: number; inventory: { on_hand: number; low_stock_threshold: number } | { on_hand: number; low_stock_threshold: number }[] | null };
  const variants = [...(product.product_variants as V[])]
    .map((v) => ({ ...v, inv: Array.isArray(v.inventory) ? v.inventory[0] : v.inventory }))
    .sort((a, b) => a.sort_order - b.sort_order || (a.color ?? "").localeCompare(b.color ?? ""));
  const colorNames = [...new Set(variants.map((v) => v.color).filter(Boolean))] as string[];

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/admin/products", label: "Products" }}
        title={product.name}
        actions={
          <>
            <Badge tone={product.status === "published" ? "success" : "warning"}>{product.status}</Badge>
            {product.status === "published" && <Link href={`/products/${product.slug}`} target="_blank" className="text-xs underline">View in store ↗</Link>}
          </>
        }
      />
      {sp.created && <Notice tone="success">Product created. Now add images and variants — it stays hidden until published.</Notice>}
      {product.status === "published" && variants.length === 0 && <Notice tone="warning">This product is published but has no variants, so it can&apos;t be bought. Add at least one variant below.</Notice>}

      <Card title="Details">
        <ActionForm action={updateProduct} submitLabel="Save details">
          <input type="hidden" name="id" value={product.id} />
          <ProductFields categories={categories} product={product} />
        </ActionForm>
      </Card>

      <Card title="Images" description="JPEG, PNG, WebP or AVIF up to 5 MB. Tag an image with a colour to show it when that colour is selected. The first image is the main image.">
        {images.length > 0 && (
          <ul className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {images.map((img) => (
              <li key={img.id} className="border border-line p-3">
                <div className="relative aspect-[3/4] bg-neutral"><SmartImage src={img.url} alt={img.alt} fill sizes="240px" className="object-cover" /></div>
                <ActionForm action={updateImage} submitLabel="Save">
                  <input type="hidden" name="id" value={img.id} />
                  <input type="hidden" name="product_id" value={product.id} />
                  <div className="mt-3 grid gap-2">
                    <Field label="Alt text"><input name="alt" defaultValue={img.alt} className={inputCls} placeholder="Describe the image" /></Field>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Colour">
                        <select name="color" defaultValue={img.color ?? ""} className={inputCls}>
                          <option value="">All colours</option>
                          {colorNames.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </Field>
                      <Field label="Order"><input name="sort_order" type="number" min={0} defaultValue={img.sort_order} className={inputCls} /></Field>
                    </div>
                  </div>
                </ActionForm>
                <ActionForm action={deleteImage} submitLabel="Delete image" variant="ghost" confirm="Delete this image?">
                  <input type="hidden" name="id" value={img.id} />
                  <input type="hidden" name="product_id" value={product.id} />
                </ActionForm>
              </li>
            ))}
          </ul>
        )}
        <div className="grid gap-6 lg:grid-cols-2">
          <ActionForm action={uploadProductImages} submitLabel="Upload" resetOnSuccess className="bg-neutral p-4">
            <input type="hidden" name="product_id" value={product.id} />
            <p className="mb-3 text-sm font-semibold">Upload images</p>
            <div className="grid gap-3">
              <input type="file" name="files" accept="image/jpeg,image/png,image/webp,image/avif" multiple required className="text-sm" />
              <Field label="Alt text (applies to all)"><input name="alt" className={inputCls} defaultValue={product.name} /></Field>
              <Field label="Colour (optional)">
                <select name="color" className={inputCls}><option value="">All colours</option>{colorNames.map((c) => <option key={c} value={c}>{c}</option>)}</select>
              </Field>
            </div>
          </ActionForm>
          <ActionForm action={addImageUrl} submitLabel="Add URL" resetOnSuccess className="bg-neutral p-4">
            <input type="hidden" name="product_id" value={product.id} />
            <p className="mb-3 text-sm font-semibold">Add by URL (e.g. supplier image)</p>
            <div className="grid gap-3">
              <Field label="Image URL"><input name="url" type="url" required className={inputCls} placeholder="https://" /></Field>
              <Field label="Alt text"><input name="alt" className={inputCls} defaultValue={product.name} /></Field>
            </div>
          </ActionForm>
        </div>
      </Card>

      <Card title="Variants & stock" description="Each size/colour combination is a variant with its own stock. Customers can't buy variants with zero stock unless backorders are enabled.">
        <div className="space-y-3">
          {variants.map((v) => (
            <div key={v.id} className="border border-line p-3">
              <ActionForm action={saveVariant} submitLabel="Save">
                <input type="hidden" name="id" value={v.id} />
                <input type="hidden" name="product_id" value={product.id} />
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
                  <Field label="SKU" className="col-span-2"><input name="sku" defaultValue={v.sku} required className={inputCls} /></Field>
                  <Field label="Size"><input name="size" defaultValue={v.size ?? ""} className={inputCls} /></Field>
                  <Field label="Colour"><input name="color" defaultValue={v.color ?? ""} className={inputCls} /></Field>
                  <Field label="Hex"><input name="color_hex" defaultValue={v.color_hex ?? ""} className={inputCls} placeholder="#D94F91" /></Field>
                  <Field label="Stock"><input name="on_hand" type="number" min={0} defaultValue={Math.max(0, v.inv?.on_hand ?? 0)} className={inputCls} /></Field>
                  <Field label="Low at"><input name="low_stock_threshold" type="number" min={0} defaultValue={v.inv?.low_stock_threshold ?? 3} className={inputCls} /></Field>
                  <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={v.is_active} className="size-4 accent-[#d94f91]" /> Active</label>
                </div>
              </ActionForm>
              <ActionForm action={deleteVariant} submitLabel="Delete variant" variant="ghost" confirm="Delete this variant? Past orders keep their details.">
                <input type="hidden" name="id" value={v.id} />
                <input type="hidden" name="product_id" value={product.id} />
              </ActionForm>
            </div>
          ))}
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <ActionForm action={saveVariant} submitLabel="Add variant" resetOnSuccess className="bg-neutral p-4">
            <input type="hidden" name="product_id" value={product.id} />
            <p className="mb-3 text-sm font-semibold">Add one variant</p>
            <div className="grid grid-cols-2 gap-2">
              <Field label="SKU" className="col-span-2"><input name="sku" required className={inputCls} /></Field>
              <Field label="Size"><input name="size" className={inputCls} /></Field>
              <Field label="Colour"><input name="color" className={inputCls} /></Field>
              <Field label="Hex"><input name="color_hex" className={inputCls} placeholder="#251923" /></Field>
              <Field label="Stock"><input name="on_hand" type="number" min={0} defaultValue={0} className={inputCls} /></Field>
              <Field label="Low at"><input name="low_stock_threshold" type="number" min={0} defaultValue={3} className={inputCls} /></Field>
              <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" name="is_active" defaultChecked className="size-4 accent-[#d94f91]" /> Active</label>
            </div>
          </ActionForm>
          <ActionForm action={generateVariants} submitLabel="Generate" resetOnSuccess className="bg-neutral p-4">
            <input type="hidden" name="product_id" value={product.id} />
            <p className="mb-3 text-sm font-semibold">Generate size × colour grid</p>
            <div className="grid gap-2">
              <Field label="Sizes" hint="Comma separated, e.g. XS, S, M, L"><input name="sizes" className={inputCls} /></Field>
              <Field label="Colours" hint="Name:#hex, comma separated, e.g. Black:#1C1A1B, Rose:#D94F91"><input name="colors" className={inputCls} /></Field>
              <Field label="Starting stock per variant"><input name="stock" type="number" min={0} defaultValue={0} className={inputCls} /></Field>
            </div>
          </ActionForm>
        </div>
      </Card>

      {can(roles, "suppliers:write") && (
        <Card title="Supplier (internal)" description="Never shown to customers.">
          <ActionForm action={saveSupplierInfo} submitLabel="Save supplier details">
            <input type="hidden" name="product_id" value={product.id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Supplier">
                <select name="supplier_id" defaultValue={supplierInfo?.supplier_id ?? ""} className={inputCls}>
                  <option value="">—</option>
                  {(suppliers ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
              <Field label="Supplier product reference"><input name="supplier_product_ref" defaultValue={supplierInfo?.supplier_product_ref ?? ""} className={inputCls} /></Field>
              <Field label="Supplier product URL"><input name="supplier_product_url" type="url" defaultValue={supplierInfo?.supplier_product_url ?? ""} className={inputCls} /></Field>
              <Field label="Supplier cost per unit (₦)"><input name="supplier_cost" inputMode="decimal" defaultValue={toMajorString(supplierInfo?.supplier_cost)} className={inputCls} /></Field>
              <Field label="Internal notes" className="sm:col-span-2"><textarea name="internal_notes" rows={3} defaultValue={supplierInfo?.internal_notes ?? ""} className={inputCls} /></Field>
            </div>
          </ActionForm>
          {!suppliers?.length && <p className="mt-3 text-xs text-muted"><Link href="/admin/suppliers" className="underline">Add a supplier</Link> first to link it here.</p>}
        </Card>
      )}

      <Card title="Visibility & removal">
        <div className="flex flex-wrap gap-3">
          {product.status !== "published" && (
            <ActionForm action={setProductStatus} submitLabel="Publish" inline><input type="hidden" name="id" value={product.id} /><input type="hidden" name="status" value="published" /></ActionForm>
          )}
          {product.status !== "draft" && (
            <ActionForm action={setProductStatus} submitLabel="Unpublish (draft)" variant="outline" inline><input type="hidden" name="id" value={product.id} /><input type="hidden" name="status" value="draft" /></ActionForm>
          )}
          {product.status !== "archived" && (
            <ActionForm action={setProductStatus} submitLabel="Archive" variant="outline" inline><input type="hidden" name="id" value={product.id} /><input type="hidden" name="status" value="archived" /></ActionForm>
          )}
          <ActionForm action={deleteProduct} submitLabel="Delete permanently" variant="ghost" inline confirm="Permanently delete this product, its variants and images? Past orders keep their item details. Archiving is usually better.">
            <input type="hidden" name="id" value={product.id} />
          </ActionForm>
        </div>
      </Card>
    </div>
  );
}
