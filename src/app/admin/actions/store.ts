"use server";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { bool, dbError, guarded, intStr, money, optInt, optMoney, optStr, slug, str, uuid } from "./helpers";
import type { AdminResult } from "./types";

// -------------------------------------------------------------- discounts
export async function saveDiscount(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("discounts:write", async ({ db }) => {
    const input = z
      .object({
        id: z.union([uuid, z.literal("")]).optional(),
        code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,32}$/, "Code: 3–32 letters, numbers, - or _"),
        description: optStr(200),
        type: z.enum(["percentage", "fixed", "free_shipping"]),
        value: z.string().optional().default(""),
        min_subtotal: optMoney,
        starts_at: z.string().optional().transform((v) => (v ? new Date(v).toISOString() : null)),
        ends_at: z.string().optional().transform((v) => (v ? new Date(v).toISOString() : null)),
        usage_limit: optInt(1, 1_000_000),
        is_active: bool,
      })
      .parse(Object.fromEntries(formData));
    let value = 0;
    if (input.type === "percentage") {
      value = z.coerce.number().int().min(1).max(100).parse(input.value);
    } else if (input.type === "fixed") {
      const v = optMoney.parse(input.value);
      if (!v) return { ok: false, message: "Enter the discount amount in ₦." };
      value = v;
    }
    const { id, ...row } = input;
    const data = { ...row, value, min_subtotal: row.min_subtotal ?? 0 };
    const { error } = id ? await db.from("discounts").update(data).eq("id", id) : await db.from("discounts").insert(data);
    if (error) return dbError(error);
    revalidatePath("/admin/discounts");
    return { ok: true, message: "Discount saved." };
  });
}

export async function deleteDiscount(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("discounts:write", async ({ db }) => {
    const { error } = await db.from("discounts").delete().eq("id", uuid.parse(formData.get("id")));
    if (error) return dbError(error);
    revalidatePath("/admin/discounts");
    return { ok: true, message: "Discount deleted." };
  });
}

// -------------------------------------------------------------- suppliers
export async function saveSupplier(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("suppliers:write", async ({ db }) => {
    const input = z
      .object({
        id: z.union([uuid, z.literal("")]).optional(),
        name: str(120).min(1),
        contact_name: optStr(120),
        contact_email: z.union([z.literal(""), z.string().trim().email()]).transform((v) => v || null),
        contact_phone: optStr(40),
        website: z.union([z.literal(""), z.string().trim().url()]).transform((v) => v || null),
        notes: optStr(5000),
        is_active: bool,
      })
      .parse(Object.fromEntries(formData));
    const { id, ...row } = input;
    const { error } = id ? await db.from("suppliers").update(row).eq("id", id) : await db.from("suppliers").insert(row);
    if (error) return dbError(error);
    revalidatePath("/admin/suppliers");
    return { ok: true, message: "Supplier saved." };
  });
}

export async function deleteSupplier(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("suppliers:write", async ({ db }) => {
    const { error } = await db.from("suppliers").delete().eq("id", uuid.parse(formData.get("id")));
    if (error) return dbError(error);
    revalidatePath("/admin/suppliers");
    return { ok: true, message: "Supplier deleted." };
  });
}

// ---------------------------------------------------------------- banners
export async function saveBanner(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("settings:write", async ({ db }) => {
    const input = z
      .object({
        id: z.union([uuid, z.literal("")]).optional(),
        placement: z.enum(["hero", "promo", "strip"]),
        eyebrow: optStr(60),
        title: str(120).min(1),
        subtitle: optStr(300),
        cta_label: optStr(40),
        cta_href: z.union([z.literal(""), z.string().trim().regex(/^(\/[^\s]*|https:\/\/[^\s]+)$/, "Use a path like /shop or an https:// link")]).transform((v) => v || null),
        image_url: z.union([z.literal(""), z.string().trim().url().regex(/^https:\/\//)]).transform((v) => v || null),
        sort_order: intStr(0, 1000),
        starts_at: z.string().optional().transform((v) => (v ? new Date(v).toISOString() : null)),
        ends_at: z.string().optional().transform((v) => (v ? new Date(v).toISOString() : null)),
        is_active: bool,
      })
      .parse(Object.fromEntries(formData));
    const { id, ...row } = input;
    const { error } = id ? await db.from("home_banners").update(row).eq("id", id) : await db.from("home_banners").insert(row);
    if (error) return dbError(error);
    revalidatePath("/admin/homepage");
    revalidatePath("/");
    return { ok: true, message: "Banner saved." };
  });
}

export async function deleteBanner(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("settings:write", async ({ db }) => {
    const { error } = await db.from("home_banners").delete().eq("id", uuid.parse(formData.get("id")));
    if (error) return dbError(error);
    revalidatePath("/admin/homepage");
    revalidatePath("/");
    return { ok: true, message: "Banner deleted." };
  });
}

// ---------------------------------------------------------------- settings
async function putSetting(db: SupabaseClient, key: string, value: unknown, isPublic = true) {
  const { error } = await db.from("store_settings").upsert({ key, value, is_public: isPublic }, { onConflict: "key" });
  return error;
}

export async function saveAnnouncement(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("settings:write", async ({ db }) => {
    const input = z
      .object({
        enabled: bool,
        text: str(160),
        href: z.union([z.literal(""), z.string().trim().regex(/^(\/[^\s]*|https:\/\/[^\s]+)$/)]).transform((v) => v || null),
      })
      .parse(Object.fromEntries(formData));
    const error = await putSetting(db, "announcement", input);
    if (error) return dbError(error);
    revalidatePath("/", "layout");
    return { ok: true, message: "Announcement bar saved." };
  });
}

export async function saveHomeSettings(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("settings:write", async ({ db }) => {
    const input = z
      .object({ show_new_arrivals: bool, show_best_sellers: bool, show_featured_products: bool, intro_title: str(160).min(1), intro_body: str(1200) })
      .parse(Object.fromEntries(formData));
    const error = await putSetting(db, "home", input);
    if (error) return dbError(error);
    revalidatePath("/");
    return { ok: true, message: "Homepage settings saved." };
  });
}

export async function saveStoreSettings(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("settings:write", async ({ db }) => {
    const url = z.union([z.literal(""), z.string().trim().url().regex(/^https:\/\//)]).transform((v) => v || null);
    const input = z
      .object({
        name: str(80).min(1),
        tagline: str(120),
        currency: z.literal("NGN"),
        support_email: z.union([z.literal(""), z.string().trim().email()]).transform((v) => v || null),
        support_phone: optStr(40),
        whatsapp: optStr(40),
        business_address: optStr(400),
        business_hours: optStr(200),
        instagram: url,
        tiktok: url,
        facebook: url,
        x: url,
      })
      .parse(Object.fromEntries(formData));
    const error = await putSetting(db, "store", input);
    if (error) return dbError(error);
    revalidatePath("/", "layout");
    return { ok: true, message: "Store details saved." };
  });
}

export async function saveCheckoutSettings(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("settings:write", async ({ db }) => {
    const checkout = z.object({ guest_checkout_enabled: bool, max_quantity_per_item: intStr(1, 20) }).parse(Object.fromEntries(formData));
    const tax = z
      .object({
        mode: z.enum(["none", "inclusive", "exclusive"]),
        rate_percent: z.coerce.number().min(0).max(50),
        label: str(30).min(1),
        duties_notice: str(600),
      })
      .parse(Object.fromEntries(formData));
    let error = await putSetting(db, "checkout", checkout);
    if (error) return dbError(error);
    error = await putSetting(db, "tax", { mode: tax.mode, rate_bps: Math.round(tax.rate_percent * 100), label: tax.label, duties_notice: tax.duties_notice });
    if (error) return dbError(error);
    revalidatePath("/", "layout");
    return { ok: true, message: "Checkout & tax settings saved." };
  });
}

// ------------------------------------------------------------ content pages
export async function saveContentPage(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("settings:write", async ({ db }) => {
    const input = z.object({ slug, title: str(120).min(1), summary: optStr(300), body: str(30000) }).parse(Object.fromEntries(formData));
    const { error } = await db.from("content_pages").upsert(input, { onConflict: "slug" });
    if (error) return dbError(error);
    revalidatePath(`/${input.slug}`);
    revalidatePath("/admin/content");
    return { ok: true, message: "Page saved." };
  });
}

// ---------------------------------------------------------------- messages
export async function setMessageStatus(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("messages:read", async ({ db }) => {
    const id = uuid.parse(formData.get("id"));
    const status = z.enum(["new", "in_progress", "resolved"]).parse(formData.get("status"));
    const { error } = await db.from("contact_messages").update({ status }).eq("id", id);
    if (error) return dbError(error);
    revalidatePath("/admin/messages");
    return { ok: true, message: "Updated." };
  });
}

// -------------------------------------------------------------- automatic offer
export async function savePromotion(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("discounts:write", async ({ db }) => {
    const input = z
      .object({
        enabled: bool,
        code: z.string().trim().toUpperCase().max(32),
        min_subtotal: money,
        free_delivery: bool,
        label: str(80).min(1, "Enter the text shoppers see, e.g. 10% off + free delivery"),
      })
      .parse(Object.fromEntries(formData));
    if (input.enabled) {
      const { data: d } = await db.from("discounts").select("type, is_active").eq("code", input.code).maybeSingle();
      if (!d) return { ok: false, message: `Create the discount code ${input.code || "(blank)"} first — it holds the percentage.` };
      if (!d.is_active) return { ok: false, message: `The discount code ${input.code} is switched off. Activate it first.` };
    }
    const error = await putSetting(db, "promotion", input);
    if (error) return dbError(error);
    revalidatePath("/", "layout");
    revalidatePath("/admin/discounts");
    return { ok: true, message: input.enabled ? "Automatic offer is on." : "Automatic offer is off." };
  });
}
