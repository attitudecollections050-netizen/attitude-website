import "server-only";
import { cache } from "react";
import { createServiceClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import type { PromotionConfig, TaxConfig } from "@/lib/pricing";
import { createPublicClient } from "@/lib/supabase/public";
import { serverSecrets } from "@/lib/env";

export interface StoreSettings {
  announcement: { enabled: boolean; text: string; href: string | null };
  store: {
    name: string;
    tagline: string;
    currency: string;
    support_email: string | null;
    support_phone: string | null;
    whatsapp: string | null;
    business_address: string | null;
    business_hours: string | null;
    instagram: string | null;
    tiktok: string | null;
    facebook: string | null;
    x: string | null;
  };
  checkout: { guest_checkout_enabled: boolean; max_quantity_per_item: number };
  promotion: PromotionConfig;
  tax: TaxConfig & { duties_notice: string };
  home: {
    show_new_arrivals: boolean;
    show_best_sellers: boolean;
    show_featured_products: boolean;
    intro_title: string;
    intro_body: string;
  };
}

export const DEFAULT_SETTINGS: StoreSettings = {
  announcement: { enabled: false, text: "", href: null },
  store: {
    name: "Attitude Collections",
    tagline: "Wear Your Attitude.",
    currency: "NGN",
    support_email: null,
    support_phone: null,
    whatsapp: null,
    business_address: null,
    business_hours: null,
    instagram: null,
    tiktok: null,
    facebook: null,
    x: null,
  },
  checkout: { guest_checkout_enabled: true, max_quantity_per_item: 10 },
  promotion: { enabled: false, code: "", min_subtotal: 0, free_delivery: false, label: "" },
  tax: { mode: "none", rate_bps: 0, label: "VAT", duties_notice: "" },
  home: {
    show_new_arrivals: true,
    show_best_sellers: true,
    show_featured_products: true,
    intro_title: "Fashion with a point of view.",
    intro_body: "",
  },
};

export function mergeSettings(rows: { key: string; value: unknown }[]): StoreSettings {
  const merged = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, Record<string, unknown>>;
  for (const row of rows) {
    if (row.key in merged && row.value && typeof row.value === "object") {
      merged[row.key] = { ...merged[row.key], ...(row.value as Record<string, unknown>) };
    }
  }
  return merged as unknown as StoreSettings;
}

/** Store settings, read once per request. */
export const getSettings = cache(async (): Promise<StoreSettings> => {
  if (!isSupabaseConfigured()) return DEFAULT_SETTINGS;
  try {
    // Settings shown on the storefront are public, so the public key is enough when the
    // secret key isn't configured (e.g. a deployment without SUPABASE_SECRET_KEY).
    const db = serverSecrets().supabaseSecretKey ? createServiceClient() : createPublicClient();
    const { data, error } = await db.from("store_settings").select("key, value");
    if (error) throw error;
    return mergeSettings(data ?? []);
  } catch (e) {
    console.error("[settings] falling back to defaults:", (e as Error).message);
    return DEFAULT_SETTINGS;
  }
});
