import "server-only";
import { createPublicClient } from "@/lib/supabase/public";
import { getCategoryTree } from "@/lib/catalog/queries";
import { getSettings } from "@/lib/settings";
import { formatMoney } from "@/lib/money";
import type { ProductSuggestion } from "./shared";
import { STORE_FAQ } from "./faq";
import { CHARACTERS, type CharacterId } from "./characters";
import { collectionFor, ownerOf } from "./collections";

const POLICY_PAGES = ["about", "faq", "shipping-policy", "returns-policy", "size-guide"];
const PAGE_LIMIT = 3000;

/** Facts the assistant is allowed to rely on, read from the store's own database. */
export async function storeKnowledge(character: CharacterId): Promise<string> {
  const [settings, categories, pages, delivery] = await Promise.all([
    getSettings(),
    getCategoryTree(),
    createPublicClient().from("content_pages").select("slug, title, body").in("slug", POLICY_PAGES),
    deliveryFacts(),
  ]);
  const s = settings.store;
  const contact = [
    s.support_email && `Email: ${s.support_email}`,
    s.support_phone && `Phone: ${s.support_phone}`,
    s.whatsapp && `WhatsApp: ${s.whatsapp}`,
    s.business_hours && `Hours: ${s.business_hours}`,
  ].filter(Boolean);
  // Only this mascot's own collection is listed; the other one belongs to the other mascot.
  const other: CharacterId = character === "haru" ? "jin" : "haru";
  const list = (cs: typeof categories) =>
    cs.map((c) => `- ${c.name} (${c.href})${c.children.length ? `: ${c.children.map((x) => `${x.name} (${x.href})`).join(", ")}` : ""}`).join("\n");
  const cats = list(collectionFor(character, categories));
  const otherCats = collectionFor(other, categories).map((c) => c.name).join(", ");
  const policyText = (pages.data ?? [])
    .map((p) => `### ${p.title} (/${p.slug})\n${String(p.body).slice(0, PAGE_LIMIT)}`)
    .join("\n\n");

  return `# Store facts
Name: ${s.name} — "${s.tagline}". Online fashion store in Nigeria. Currency: ${s.currency} (Naira, ₦).
Guest checkout: ${settings.checkout.guest_checkout_enabled ? "allowed" : "sign-in required"}.
Payment: Paystack, at checkout. The store never sees or stores card details.
Delivery: fees and delivery times are calculated for the customer's address at checkout (Nigeria and selected international destinations).
${delivery ? `Delivery options confirmed by the store (quote only these; anything else shows at checkout):\n${delivery}` : "No confirmed delivery prices or times are published yet: do not quote any — say they show at checkout."}
${settings.promotion.enabled ? `Current offer (applied automatically at checkout, no code needed): ${settings.promotion.label} — when the item total is ${formatMoney(settings.promotion.min_subtotal, "NGN")} or more.` : "There is no store-wide offer running right now."}
Contact details published by the store: ${contact.length ? contact.join(" · ") : "none yet — send people to /contact"}.

# Owner-confirmed quick answers (use these; they override the general delivery note above)
- Size: ${STORE_FAQ.size}
- Delivery: ${STORE_FAQ.delivery}
- Payment: ${STORE_FAQ.payment}
- If you can't answer something from these facts, say exactly: "${STORE_FAQ.fallback}" (the chat then shows a WhatsApp button).

# Useful pages
/shop (all products), /search?q=..., /collections, /cart, /checkout, /track-order (needs order number + email), /contact, /faq, /feedback (rate us with hearts), /account, /shipping-policy, /returns-policy, /privacy-policy, /terms.

# Your collection (${CHARACTERS[character].short}'s collection — the only products you search, recommend or describe)
${cats || "(none yet)"}

# Not yours
${CHARACTERS[other].short}'s collection (${otherCats || "the other side of the shop"}) belongs to ${CHARACTERS[other].short}. You cannot see those products. If the shopper asks for them, say that's ${CHARACTERS[other].short}'s collection and tell them to tap "Switch to ${CHARACTERS[other].short.toUpperCase()}?" at the top of the chat.

# Store pages (written by the owner). Text in [square brackets] is an unfinished placeholder: never present it as fact — say the team can confirm via /contact.
${policyText || "(not available)"}`;
}

/** Live product search over published products only (same rules as the shop). */
export async function searchProducts(
  input: { query?: string | null; maxPriceNaira?: number | null; onSale?: boolean | null; inStockOnly?: boolean | null },
  character: CharacterId,
): Promise<ProductSuggestion[]> {
  // Search only inside this mascot's collection (each category includes its sub-categories).
  const scope = collectionFor(character, await getCategoryTree());
  type Row = { id: string; slug: string; name: string; price: number; sale_price: number | null; image_url: string | null; in_stock: boolean };
  const results = await Promise.all(
    scope.map(async (cat) => {
      const { data, error } = await createPublicClient().rpc("catalog_search", {
        p_query: input.query?.slice(0, 80) || null,
        p_category_id: cat.id,
        p_max_price: input.maxPriceNaira ? Math.round(input.maxPriceNaira * 100) : null,
        p_on_sale: Boolean(input.onSale),
        p_availability: input.inStockOnly ? "in_stock" : null,
        p_sort: input.query ? "popular" : "newest",
        p_limit: 4,
        p_offset: 0,
      });
      if (error) throw new Error(error.message);
      return (data ?? []) as Row[];
    }),
  );
  // Take turns across the collection's categories so one category doesn't crowd out the rest.
  const seen = new Set<string>();
  const rows: Row[] = [];
  for (let i = 0; rows.length < 4 && results.some((r) => r[i]); i++) {
    for (const r of results) {
      const row = r[i];
      if (row && !seen.has(row.id) && rows.length < 4) {
        seen.add(row.id);
        rows.push(row);
      }
    }
  }
  const currency = "NGN";
  const variants = await variantOptions(rows.map((r) => r.id));
  return rows.map((p) => ({
    slug: p.slug,
    variants: variants.get(p.id) ?? [],
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

/** Delivery options the owner has confirmed (manual rates still marked "needs review" are left out). */
async function deliveryFacts(): Promise<string> {
  const { data } = await createPublicClient()
    .from("shipping_rates")
    .select("fee, currency, min_days, max_days, free_shipping_threshold, rate_type, needs_review, shipping_zones(name, is_active), shipping_methods(name, is_active)")
    .eq("is_active", true)
    .eq("needs_review", false)
    .limit(30);
  type Row = { fee: number; currency: string; min_days: number | null; max_days: number | null; free_shipping_threshold: number | null; rate_type: string; shipping_zones: { name: string; is_active: boolean } | null; shipping_methods: { name: string; is_active: boolean } | null };
  return ((data ?? []) as unknown as Row[])
    .filter((r) => r.shipping_zones?.is_active && r.shipping_methods?.is_active)
    .map((r) => {
      const days = r.min_days != null && r.max_days != null ? `${r.min_days}–${r.max_days} days` : r.max_days != null ? `up to ${r.max_days} days` : "time shown at checkout";
      const fee = r.rate_type === "flat" ? formatMoney(r.fee, r.currency) : "fee depends on the order (shown at checkout)";
      const free = r.free_shipping_threshold ? `, FREE delivery on orders of ${formatMoney(r.free_shipping_threshold, r.currency)}+` : "";
      return `- ${r.shipping_zones!.name} · ${r.shipping_methods!.name}: ${fee}, ${days}${free}`;
    })
    .join("\n");
}

/** One product's facts for customer support questions (published products only). */
export async function productDetails(slug: string, character: CharacterId) {
  const { data } = await createPublicClient()
    .from("products")
    .select("name, slug, description, details, weight_grams, price, sale_price, allow_backorder, tags, categories(name, slug, parent:categories!parent_id(slug)), product_variants(size, color, is_active, sort_order, inventory(on_hand, low_stock_threshold))")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (!data) return null;
  type V = { size: string | null; color: string | null; is_active: boolean; sort_order: number; inventory: { on_hand: number; low_stock_threshold: number } | null };
  const p = data as unknown as { name: string; slug: string; description: string; details: string | null; weight_grams: number; price: number; sale_price: number | null; allow_backorder: boolean; tags: string[]; categories: { name: string; slug: string; parent: { slug: string } | null } | null; product_variants: V[] };
  const owner = p.categories ? ownerOf(p.categories.slug, p.categories.parent?.slug) : character;
  if (owner !== character) {
    return { name: p.name, not_in_your_collection: true, belongs_to: CHARACTERS[owner].short, note: `This is in ${CHARACTERS[owner].short}'s collection. Tell the shopper to switch to ${CHARACTERS[owner].short.toUpperCase()} for it.` };
  }
  return {
    name: p.name,
    link: `/products/${p.slug}`,
    category: p.categories?.name ?? null,
    price: formatMoney(p.sale_price ?? p.price, "NGN"),
    was_price: p.sale_price ? formatMoney(p.price, "NGN") : null,
    description: p.description.slice(0, 1500),
    details: (p.details ?? "").slice(0, 1500) || null,
    tags: p.tags,
    // 500 g is the default for items the owner hasn't weighed.
    weight: p.weight_grams && p.weight_grams !== 500 ? `${(p.weight_grams / 1000).toFixed(2)} kg` : "not measured",
    sizes: p.product_variants
      .filter((v) => v.is_active)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((v) => {
        const onHand = v.inventory?.on_hand ?? 0;
        return { size: v.size, color: v.color, in_stock: onHand > 0 || p.allow_backorder, low_stock: onHand > 0 && onHand <= (v.inventory?.low_stock_threshold ?? 3) };
      }),
  };
}

/** Active sizes/colours per product, so the chat's "Add to Cart" can add the right one. */
async function variantOptions(productIds: string[]) {
  const out = new Map<string, { id: string; label: string; inStock: boolean }[]>();
  if (!productIds.length) return out;
  const { data } = await createPublicClient()
    .from("product_variants")
    .select("id, product_id, size, color, sort_order, inventory(on_hand), products(allow_backorder)")
    .in("product_id", productIds)
    .eq("is_active", true)
    .order("sort_order");
  type R = { id: string; product_id: string; size: string | null; color: string | null; inventory: { on_hand: number } | null; products: { allow_backorder: boolean } | null };
  for (const v of (data ?? []) as unknown as R[]) {
    const list = out.get(v.product_id) ?? [];
    list.push({ id: v.id, label: [v.size, v.color].filter(Boolean).join(" · ") || "One size", inStock: (v.inventory?.on_hand ?? 0) > 0 || Boolean(v.products?.allow_backorder) });
    out.set(v.product_id, list);
  }
  return out;
}
