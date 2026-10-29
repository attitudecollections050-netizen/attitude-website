"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/admin";
import { MAX_IMAGE_BYTES, sniffImageType } from "@/lib/images";
import { bool, dbError, guarded, productAccess, intStr, money, optMoney, optStr, slug, slugify, str, uuid } from "./helpers";
import type { AdminResult } from "./types";

const productSchema = z
  .object({
    name: str(140).min(2, "Name is required"),
    slug: z.string().trim().optional(),
    description: str(5000),
    details: optStr(5000),
    category_id: uuid,
    price: money,
    sale_price: optMoney,
    weight_grams: intStr(0, 100000),
    status: z.enum(["draft", "published", "archived"]),
    is_featured: bool,
    allow_backorder: bool,
    tags: z
      .string()
      .optional()
      .transform((v) => [...new Set((v ?? "").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 20)),
  })
  .refine((p) => p.sale_price == null || p.sale_price < p.price, { message: "Sale price must be lower than the regular price.", path: ["sale_price"] });

function revalidateProduct(productSlug?: string) {
  revalidatePath("/admin/products");
  revalidatePath("/shop", "layout");
  revalidatePath("/");
  if (productSlug) revalidatePath(`/products/${productSlug}`);
}

export async function createProduct(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  let newId: string | null = null;
  const result = await guarded("products:write", async ({ db }) => {
    const p = productSchema.parse(Object.fromEntries(formData));
    const finalSlug = slug.parse(p.slug || slugify(p.name));
    const { data, error } = await db.from("products").insert({ ...p, slug: finalSlug }).select("id").single();
    if (error) return dbError(error);
    newId = data.id;
    revalidateProduct();
    return { ok: true, message: "Product created." };
  });
  if (newId) redirect(`/admin/products/${newId}?created=1`);
  return result;
}

export async function updateProduct(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("products:write", async ({ db }) => {
    const id = uuid.parse(formData.get("id"));
    const denied = await productAccess(db, id);
    if (denied) return denied;
    const p = productSchema.parse(Object.fromEntries(formData));
    const finalSlug = slug.parse(p.slug || slugify(p.name));
    const { error } = await db.from("products").update({ ...p, slug: finalSlug }).eq("id", id);
    if (error) return dbError(error);
    revalidateProduct(finalSlug);
    revalidatePath(`/admin/products/${id}`);
    return { ok: true, message: "Product saved." };
  });
}

export async function setProductStatus(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("products:write", async ({ db }) => {
    const id = uuid.parse(formData.get("id"));
    const status = z.enum(["draft", "published", "archived"]).parse(formData.get("status"));
    const denied = await productAccess(db, id);
    if (denied) return denied;
    const { data, error } = await db.from("products").update({ status }).eq("id", id).select("slug").single();
    if (error) return dbError(error);
    revalidateProduct(data.slug);
    revalidatePath(`/admin/products/${id}`);
    return { ok: true, message: `Product ${status}.` };
  });
}

export async function deleteProduct(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  let deleted = false;
  // Deleting needs its own permission: owner, or Product Staff the owner has allowed to delete.
  const result = await guarded("products:delete", async ({ db }) => {
    const id = uuid.parse(formData.get("id"));
    const denied = await productAccess(db, id);
    if (denied) return denied;
    const { data: imgs } = await db.from("product_images").select("storage_path").eq("product_id", id);
    const { error } = await db.from("products").delete().eq("id", id);
    if (error) return dbError(error);
    const paths = (imgs ?? []).map((i) => i.storage_path).filter(Boolean) as string[];
    if (paths.length) await createServiceClient().storage.from("product-images").remove(paths);
    deleted = true;
    revalidateProduct();
    return { ok: true, message: "Deleted." };
  });
  if (deleted) redirect("/admin/products?deleted=1");
  return result;
}

// ---------------------------------------------------------------- images
export async function uploadProductImages(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("products:write", async ({ db }) => {
    const productId = uuid.parse(formData.get("product_id"));
    const denied = await productAccess(db, productId);
    if (denied) return denied;
    const alt = optStr(200).parse(formData.get("alt") ?? "") ?? "";
    const color = optStr(40).parse(formData.get("color") ?? "");
    const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length === 0) return { ok: false, message: "Choose at least one image." };
    if (files.length > 10) return { ok: false, message: "Upload up to 10 images at a time." };

    const { data: last } = await db.from("product_images").select("sort_order").eq("product_id", productId).order("sort_order", { ascending: false }).limit(1).maybeSingle();
    let sort = (last?.sort_order ?? -1) + 1;
    const storage = createServiceClient().storage.from("product-images");
    for (const file of files) {
      if (file.size > MAX_IMAGE_BYTES) return { ok: false, message: `${file.name} is larger than 5 MB.` };
      const bytes = new Uint8Array(await file.arrayBuffer());
      const type = sniffImageType(bytes);
      if (!type) return { ok: false, message: `${file.name} is not a JPEG, PNG, WebP or AVIF image.` };
      const path = `${productId}/${randomUUID()}.${type.ext}`;
      const { error: upErr } = await storage.upload(path, bytes, { contentType: type.mime, cacheControl: "31536000", upsert: false });
      if (upErr) return { ok: false, message: `Upload failed: ${upErr.message}` };
      const url = storage.getPublicUrl(path).data.publicUrl;
      const { error } = await db.from("product_images").insert({ product_id: productId, url, storage_path: path, alt, color, sort_order: sort++ });
      if (error) {
        await storage.remove([path]);
        return dbError(error);
      }
    }
    revalidatePath(`/admin/products/${productId}`);
    revalidateProduct();
    return { ok: true, message: `${files.length} image(s) uploaded.` };
  });
}

export async function addImageUrl(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("products:write", async ({ db }) => {
    const input = z
      .object({ product_id: uuid, url: z.string().trim().url().regex(/^https:\/\//, "Use an https:// URL"), alt: optStr(200), color: optStr(40) })
      .parse(Object.fromEntries(formData));
    const denied = await productAccess(db, input.product_id);
    if (denied) return denied;
    const { data: last } = await db.from("product_images").select("sort_order").eq("product_id", input.product_id).order("sort_order", { ascending: false }).limit(1).maybeSingle();
    const { error } = await db.from("product_images").insert({ ...input, alt: input.alt ?? "", sort_order: (last?.sort_order ?? -1) + 1 });
    if (error) return dbError(error);
    revalidatePath(`/admin/products/${input.product_id}`);
    revalidateProduct();
    return { ok: true, message: "Image added. Remote hosts must be allowed in next.config.ts images.remotePatterns." };
  });
}

export async function updateImage(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("products:write", async ({ db }) => {
    const input = z.object({ id: uuid, product_id: uuid, alt: str(200), color: optStr(40), sort_order: intStr(0, 1000) }).parse(Object.fromEntries(formData));
    const { id, product_id, ...row } = input;
    const denied = await productAccess(db, product_id);
    if (denied) return denied;
    const { error } = await db.from("product_images").update(row).eq("id", id).eq("product_id", product_id);
    if (error) return dbError(error);
    revalidatePath(`/admin/products/${product_id}`);
    revalidateProduct();
    return { ok: true, message: "Saved." };
  });
}

export async function deleteImage(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("products:write", async ({ db }) => {
    const id = uuid.parse(formData.get("id"));
    const productId = uuid.parse(formData.get("product_id"));
    const denied = await productAccess(db, productId);
    if (denied) return denied;
    const { data, error } = await db.from("product_images").delete().eq("id", id).eq("product_id", productId).select("storage_path").maybeSingle();
    if (error) return dbError(error);
    if (data?.storage_path) await createServiceClient().storage.from("product-images").remove([data.storage_path]);
    revalidatePath(`/admin/products/${productId}`);
    revalidateProduct();
    return { ok: true, message: "Image removed." };
  });
}

// -------------------------------------------------------------- variants
const hex = z.union([z.literal(""), z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Colour hex like #D94F91")]).transform((v) => v || null);

export async function saveVariant(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("products:write", async ({ db }) => {
    const input = z
      .object({
        id: z.union([uuid, z.literal("")]).optional(),
        product_id: uuid,
        sku: z.string().trim().toUpperCase().regex(/^[A-Z0-9._-]{1,64}$/, "SKU: letters, numbers, - _ ."),
        size: optStr(20),
        color: optStr(40),
        color_hex: hex,
        is_active: bool,
        on_hand: intStr(0, 1_000_000),
        low_stock_threshold: intStr(0, 10_000),
      })
      .parse(Object.fromEntries(formData));
    const { id, on_hand, low_stock_threshold, ...row } = input;
    const denied = await productAccess(db, input.product_id);
    if (denied) return denied;
    let variantId = id || null;
    if (variantId) {
      const { error } = await db.from("product_variants").update(row).eq("id", variantId).eq("product_id", input.product_id);
      if (error) return dbError(error);
    } else {
      const { data, error } = await db.from("product_variants").insert(row).select("id").single();
      if (error) return dbError(error);
      variantId = data.id;
    }
    const { error: stockErr } = await db.rpc("admin_set_stock", { p_variant_id: variantId, p_on_hand: on_hand, p_note: "Admin edit" });
    if (stockErr) return dbError(stockErr);
    await createServiceClient().from("inventory").update({ low_stock_threshold }).eq("variant_id", variantId);
    revalidatePath(`/admin/products/${input.product_id}`);
    revalidateProduct();
    return { ok: true, message: id ? "Variant saved." : "Variant added." };
  });
}

export async function generateVariants(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("products:write", async ({ db }) => {
    const input = z
      .object({ product_id: uuid, sizes: z.string().max(400).default(""), colors: z.string().max(800).default(""), stock: intStr(0, 100000) })
      .parse(Object.fromEntries(formData));
    const sizes = input.sizes.split(",").map((s) => s.trim()).filter(Boolean);
    const colors = input.colors
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean)
      .map((c) => {
        const [name, h] = c.split(":").map((x) => x.trim());
        return { name, hex: h && /^#[0-9A-Fa-f]{6}$/.test(h) ? h : null };
      });
    if (sizes.length === 0 && colors.length === 0) return { ok: false, message: "Enter sizes and/or colours." };
    const denied = await productAccess(db, input.product_id);
    if (denied) return denied;
    const { data: product } = await db.from("products").select("slug").eq("id", input.product_id).single();
    const base = (product?.slug ?? "SKU").replace(/-/g, "").slice(0, 14).toUpperCase();
    const combos = (colors.length ? colors : [{ name: null as string | null, hex: null as string | null }]).flatMap((c) =>
      (sizes.length ? sizes : [null]).map((s) => ({ color: c.name, color_hex: c.hex, size: s })),
    );
    if (combos.length > 100) return { ok: false, message: "That would create more than 100 variants." };
    let created = 0;
    for (const [i, c] of combos.entries()) {
      const sku = [base, c.color?.slice(0, 3).toUpperCase(), c.size?.toUpperCase()].filter(Boolean).join("-").replace(/[^A-Z0-9._-]/g, "");
      const { data, error } = await db
        .from("product_variants")
        .insert({ product_id: input.product_id, sku: `${sku}-${randomUUID().slice(0, 4).toUpperCase()}`, size: c.size, color: c.color, color_hex: c.color_hex, sort_order: i })
        .select("id")
        .single();
      if (error) {
        if (error.code === "23505") continue; // combination already exists
        return dbError(error);
      }
      await db.rpc("admin_set_stock", { p_variant_id: data.id, p_on_hand: input.stock, p_note: "Initial stock" });
      created++;
    }
    revalidatePath(`/admin/products/${input.product_id}`);
    revalidateProduct();
    return { ok: true, message: `${created} variant(s) created${created < combos.length ? ` (${combos.length - created} already existed)` : ""}.` };
  });
}

export async function deleteVariant(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("products:write", async ({ db }) => {
    const id = uuid.parse(formData.get("id"));
    const productId = uuid.parse(formData.get("product_id"));
    const denied = await productAccess(db, productId);
    if (denied) return denied;
    const { error } = await db.from("product_variants").delete().eq("id", id).eq("product_id", productId);
    if (error) return dbError(error);
    revalidatePath(`/admin/products/${productId}`);
    revalidateProduct();
    return { ok: true, message: "Variant deleted." };
  });
}

// ---------------------------------------------------------- supplier info
export async function saveSupplierInfo(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("suppliers:write", async ({ db }) => {
    const input = z
      .object({
        product_id: uuid,
        supplier_id: z.union([uuid, z.literal("")]).transform((v) => v || null),
        supplier_product_ref: optStr(120),
        supplier_product_url: z.union([z.literal(""), z.string().trim().url()]).transform((v) => v || null),
        supplier_cost: optMoney,
        internal_notes: optStr(5000),
      })
      .parse(Object.fromEntries(formData));
    const { error } = await db.from("product_supplier_info").upsert({ ...input, updated_at: new Date().toISOString() }, { onConflict: "product_id" });
    if (error) return dbError(error);
    revalidatePath(`/admin/products/${input.product_id}`);
    return { ok: true, message: "Supplier details saved (internal only)." };
  });
}
