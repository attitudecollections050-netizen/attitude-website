import "server-only";
import { createPublicClient } from "@/lib/supabase/public";
import { getCategoryTree } from "@/lib/catalog/queries";
import { getSettings } from "@/lib/settings";
import { formatMoney } from "@/lib/money";
import type { ProductSuggestion } from "./shared";

const POLICY_PAGES = ["about", "faq", "shipping-policy", "returns-policy"];
const PAGE_LIMIT = 3000;

/** Facts the assistant is allowed to rely on, read from the store's own database. */
export async function storeKnowledge(): Promise<string> {
  const [settings, categories, pages] = await Promise.all([
    getSettings(),
    getCategoryTree(),
    createPublicClient().from("content_pages").select("slug, title, body").in("slug", POLICY_PAGES),
  ]);
  const s = settings.store;
  const contact = [
    s.support_email && `Email: ${s.support_email}`,
    s.support_phone && `Phone: ${s.support_phone}`,
    s.whatsapp && `WhatsApp: ${s.whatsapp}`,
    s.business_hours && `Hours: ${s.business_hours}`,
  ].filter(Boolean);
  const cats = categories
    .map((c) => `- ${c.name} (${c.href})${c.children.length ? `: ${c.children.map((x) => `${x.name} (${x.href})`).join(", ")}` : ""}`)
    .join("\n");
  const policyText = (pages.data ?? [])
    .map((p) => `### ${p.title} (/${p.slug})\n${String(p.body).slice(0, PAGE_LIMIT)}`)
    .join("\n\n");

  return `# Store facts
Name: ${s.name} — "${s.tagline}". Online fashion store in Nigeria. Currency: ${s.currency} (Naira, ₦).
Guest checkout: ${settings.checkout.guest_checkout_enabled ? "allowed" : "sign-in required"}.
Payment: Paystack, at checkout. The store never sees or stores card details.
Delivery: fees and delivery times are calculated for the customer's address at checkout (Nigeria and selected international destinations). Do not quote delivery prices.
${settings.promotion.enabled ? `Current offer (applied automatically at checkout, no code needed): ${settings.promotion.label} — when the item total is ${formatMoney(settings.promotion.min_subtotal, "NGN")} or more.` : "There is no store-wide offer running right now."}
Contact details published by the store: ${contact.length ? contact.join(" · ") : "none yet — send people to /contact"}.

# Useful pages
/shop (all products), /search?q=..., /collections, /cart, /checkout, /track-order (needs order number + email), /contact, /faq, /feedback (rate us with hearts), /account, /shipping-policy, /returns-policy, /privacy-policy, /terms.

# Categories
${cats || "(none yet)"}

# Store pages (written by the owner). Text in [square brackets] is an unfinished placeholder: never present it as fact — say the team can confirm via /contact.
${policyText || "(not available)"}`;
}

/** Live product search over published products only (same rules as the shop). */
export async function searchProducts(input: { query?: string | null; maxPriceNaira?: number | null; onSale?: boolean | null; inStockOnly?: boolean | null }): Promise<ProductSuggestion[]> {
  const { data, error } = await createPublicClient().rpc("catalog_search", {
    p_query: input.query?.slice(0, 80) || null,
    p_max_price: input.maxPriceNaira ? Math.round(input.maxPriceNaira * 100) : null,
    p_on_sale: Boolean(input.onSale),
    p_availability: input.inStockOnly ? "in_stock" : null,
    p_sort: input.query ? "popular" : "newest",
    p_limit: 4,
    p_offset: 0,
  });
  if (error) throw new Error(error.message);
  const currency = "NGN";
  return ((data ?? []) as { slug: string; name: string; price: number; sale_price: number | null; image_url: string | null; in_stock: boolean }[]).map((p) => ({
    name: p.name,
    href: `/products/${p.slug}`,
    price: formatMoney(p.sale_price ?? p.price, currency),
    wasPrice: p.sale_price ? formatMoney(p.price, currency) : null,
    priceMinor: p.sale_price ?? p.price,
    wasPriceMinor: p.sale_price ? p.price : null,
    image: p.image_url,
    inStock: p.in_stock,
  }));
}
