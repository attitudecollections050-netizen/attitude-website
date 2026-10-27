"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { formatMoney } from "@/lib/money";
import { calculateShipping, formatDeliveryWindow } from "@/lib/shipping/calculator";
import { loadShippingConfig } from "@/lib/shipping/service";
import { bool, dbError, guarded, intStr, money, optInt, optMoney, optStr, str, uuid } from "./helpers";
import type { AdminResult } from "./types";

const cc = z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/);
const done = (message: string): AdminResult => {
  revalidatePath("/admin/shipping");
  return { ok: true, message };
};

export async function saveCountry(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("shipping:write", async ({ db }) => {
    const input = z
      .object({ code: cc, is_enabled: bool, region_label: str(40).min(1), region_required: bool, postal_label: str(40).min(1), postal_required: bool })
      .parse(Object.fromEntries(formData));
    const { code, ...row } = input;
    const { error } = await db.from("countries").update(row).eq("code", code);
    return dbError(error) ?? done(`${code} saved.`);
  });
}

export async function enableCountry(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("shipping:write", async ({ db }) => {
    const code = cc.parse(formData.get("code"));
    const { error } = await db.from("countries").update({ is_enabled: true }).eq("code", code);
    return dbError(error) ?? done(`${code} enabled. Add it to a shipping zone with a verified rate — until then checkout will show delivery as unavailable.`);
  });
}

export async function saveZone(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("shipping:write", async ({ db }) => {
    const input = z
      .object({ id: z.union([uuid, z.literal("")]).optional(), name: str(80).min(1), description: optStr(300), priority: intStr(0, 1000), is_active: bool })
      .parse(Object.fromEntries(formData));
    const { id, ...row } = input;
    const { error } = id ? await db.from("shipping_zones").update(row).eq("id", id) : await db.from("shipping_zones").insert(row);
    return dbError(error) ?? done("Zone saved.");
  });
}

export async function deleteZone(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("shipping:write", async ({ db }) => {
    const { error } = await db.from("shipping_zones").delete().eq("id", uuid.parse(formData.get("id")));
    return dbError(error) ?? done("Zone deleted.");
  });
}

export async function addZoneLocation(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("shipping:write", async ({ db }) => {
    const input = z
      .object({ zone_id: uuid, country_code: cc, region_code: optStr(20), city: optStr(100) })
      .parse(Object.fromEntries(formData));
    if (input.city && !input.region_code) return { ok: false, message: "Choose a state/region when adding a city." };
    const { error } = await db.from("shipping_zone_locations").insert(input);
    return dbError(error) ?? done("Location added.");
  });
}

export async function removeZoneLocation(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("shipping:write", async ({ db }) => {
    const { error } = await db.from("shipping_zone_locations").delete().eq("id", uuid.parse(formData.get("id")));
    return dbError(error) ?? done("Location removed.");
  });
}

export async function saveMethod(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("shipping:write", async ({ db }) => {
    const input = z
      .object({ id: z.union([uuid, z.literal("")]).optional(), name: str(60).min(1), description: optStr(200), sort_order: intStr(0, 1000), is_active: bool })
      .parse(Object.fromEntries(formData));
    const { id, ...row } = input;
    const { error } = id ? await db.from("shipping_methods").update(row).eq("id", id) : await db.from("shipping_methods").insert(row);
    return dbError(error) ?? done("Delivery method saved.");
  });
}

export async function deleteMethod(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("shipping:write", async ({ db }) => {
    const { error } = await db.from("shipping_methods").delete().eq("id", uuid.parse(formData.get("id")));
    return dbError(error) ?? done("Delivery method deleted.");
  });
}

export async function saveRate(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("shipping:write", async ({ db }) => {
    const input = z
      .object({
        id: z.union([uuid, z.literal("")]).optional(),
        zone_id: uuid,
        method_id: uuid,
        rate_type: z.enum(["flat", "weight_based", "order_value_based"]),
        fee: money,
        min_days: optInt(0, 365),
        max_days: optInt(0, 365),
        free_shipping_threshold: optMoney,
        is_active: bool,
        confirmed: bool,
        notes: optStr(500),
      })
      .parse(Object.fromEntries(formData));
    if (input.min_days != null && input.max_days != null && input.max_days < input.min_days) return { ok: false, message: "Max days must be ≥ min days." };
    const { id, confirmed, ...row } = input;
    const data = { ...row, currency: "NGN", is_manual: true, needs_review: !confirmed };
    const { error } = id ? await db.from("shipping_rates").update(data).eq("id", id) : await db.from("shipping_rates").insert(data);
    if (error?.code === "23505") return { ok: false, message: "This zone already has a rate for that delivery method — edit it instead." };
    return dbError(error) ?? done(confirmed ? "Rate saved and marked as confirmed." : "Rate saved (still marked as needing review).");
  });
}

export async function deleteRate(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("shipping:write", async ({ db }) => {
    const { error } = await db.from("shipping_rates").delete().eq("id", uuid.parse(formData.get("id")));
    return dbError(error) ?? done("Rate deleted.");
  });
}

export async function addTier(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("shipping:write", async ({ db }) => {
    const rateId = uuid.parse(formData.get("rate_id"));
    const kind = z.enum(["weight_based", "order_value_based"]).parse(formData.get("kind"));
    const fee = money.parse(formData.get("fee"));
    const parse = kind === "weight_based" ? (v: FormDataEntryValue | null) => optInt(0, 10_000_000).parse(v ?? "") : (v: FormDataEntryValue | null) => optMoney.parse(v ?? "");
    const min = parse(formData.get("min_value")) ?? 0;
    const max = parse(formData.get("max_value"));
    if (max != null && max <= min) return { ok: false, message: "'Up to' must be greater than 'From'." };
    const { error } = await db.from("shipping_rate_tiers").insert({ rate_id: rateId, min_value: min, max_value: max, fee });
    return dbError(error) ?? done("Tier added.");
  });
}

export async function deleteTier(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("shipping:write", async ({ db }) => {
    const { error } = await db.from("shipping_rate_tiers").delete().eq("id", uuid.parse(formData.get("id")));
    return dbError(error) ?? done("Tier removed.");
  });
}

/** Runs the real calculator against the saved configuration. */
export async function testQuote(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("shipping:write", async () => {
    const input = z
      .object({ country_code: cc, region: z.string().trim().max(100).default(""), city: z.string().trim().max(100), postal_code: z.string().trim().max(20).default(""), subtotal: money, weight: intStr(0, 1_000_000) })
      .parse(Object.fromEntries(formData));
    const config = await loadShippingConfig(input.country_code);
    const q = calculateShipping({
      address: input,
      ...config,
      cart: { subtotalAfterDiscount: input.subtotal, weightGrams: input.weight },
      storeCurrency: "NGN",
    });
    if (!q.ok) return { ok: false, message: `Unavailable (${q.code}): ${q.message}` };
    return {
      ok: true,
      message: `Zone “${q.zoneName}”: ` + q.options.map((o) => `${o.methodName} ${o.fee === 0 ? "Free" : formatMoney(o.fee)}${formatDeliveryWindow(o.minDays, o.maxDays) ? ` (${formatDeliveryWindow(o.minDays, o.maxDays)})` : ""}`).join(" · "),
    };
  });
}
