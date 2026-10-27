"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { bool, dbError, guarded, intStr, optStr, slug, slugify, str, uuid } from "./helpers";
import type { AdminResult } from "./types";

const imageUrl = z.union([z.literal(""), z.string().trim().url().regex(/^https:\/\//, "Use an https:// URL")]).transform((v) => v || null);

function revalidateCatalog() {
  revalidatePath("/", "layout");
}

export async function saveCategory(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("catalog:write", async ({ db }) => {
    const input = z
      .object({
        id: z.union([uuid, z.literal("")]).optional(),
        parent_id: z.union([uuid, z.literal("")]).transform((v) => v || null),
        name: str(80).min(1),
        slug: z.string().trim().optional(),
        description: optStr(600),
        image_url: imageUrl,
        sort_order: intStr(0, 10000),
        is_active: bool,
      })
      .parse(Object.fromEntries(formData));
    const { id, ...row } = input;
    const data = { ...row, slug: slug.parse(row.slug || slugify(row.name)) };
    if (id && data.parent_id === id) return { ok: false, message: "A category can't be its own parent." };
    const { error } = id ? await db.from("categories").update(data).eq("id", id) : await db.from("categories").insert(data);
    if (error) return dbError(error);
    revalidatePath("/admin/categories");
    revalidateCatalog();
    return { ok: true, message: id ? "Category saved." : "Category added." };
  });
}

export async function deleteCategory(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("catalog:write", async ({ db }) => {
    const id = uuid.parse(formData.get("id"));
    const { count } = await db.from("products").select("id", { count: "exact", head: true }).eq("category_id", id);
    if ((count ?? 0) > 0) return { ok: false, message: `Move or delete the ${count} product(s) in this category first.` };
    const { error } = await db.from("categories").delete().eq("id", id);
    if (error) return dbError(error);
    revalidatePath("/admin/categories");
    revalidateCatalog();
    return { ok: true, message: "Category deleted." };
  });
}

export async function saveCollection(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("catalog:write", async ({ db }) => {
    const input = z
      .object({
        id: z.union([uuid, z.literal("")]).optional(),
        name: str(80).min(1),
        slug: z.string().trim().optional(),
        description: optStr(600),
        image_url: imageUrl,
        sort_order: intStr(0, 10000),
        is_featured: bool,
        is_active: bool,
      })
      .parse(Object.fromEntries(formData));
    const { id, ...row } = input;
    const data = { ...row, slug: slug.parse(row.slug || slugify(row.name)) };
    const { error } = id ? await db.from("collections").update(data).eq("id", id) : await db.from("collections").insert(data);
    if (error) return dbError(error);
    revalidatePath("/admin/collections");
    revalidateCatalog();
    return { ok: true, message: "Collection saved." };
  });
}

export async function deleteCollection(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("catalog:write", async ({ db }) => {
    const { error } = await db.from("collections").delete().eq("id", uuid.parse(formData.get("id")));
    if (error) return dbError(error);
    revalidatePath("/admin/collections");
    revalidateCatalog();
    return { ok: true, message: "Collection deleted." };
  });
}

export async function setCollectionProducts(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("catalog:write", async ({ db }) => {
    const id = uuid.parse(formData.get("collection_id"));
    const ids = z.array(uuid).max(200).parse(formData.getAll("product_ids"));
    const { error: delErr } = await db.from("collection_products").delete().eq("collection_id", id);
    if (delErr) return dbError(delErr);
    if (ids.length) {
      const { error } = await db.from("collection_products").insert(ids.map((pid, i) => ({ collection_id: id, product_id: pid, sort_order: i })));
      if (error) return dbError(error);
    }
    revalidatePath("/admin/collections");
    revalidateCatalog();
    return { ok: true, message: `${ids.length} product(s) in collection.` };
  });
}
