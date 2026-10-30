import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { persona } from "@/lib/assistant/persona";
import { productDetails, searchProducts, storeKnowledge } from "@/lib/assistant/knowledge";
import { parseAction } from "@/lib/assistant/characters";
import { MAX_HISTORY, MAX_MESSAGE_CHARS, type AssistantReply, type ProductSuggestion } from "@/lib/assistant/shared";

const MODEL = process.env.ASSISTANT_MODEL || "claude-opus-5-5";
const MAX_TOOL_ROUNDS = 3;

const bodySchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(MAX_MESSAGE_CHARS * 2) }))
    .min(1)
    .max(MAX_HISTORY * 2),
  character: z.preprocess((v) => (v === "guy" ? "jin" : v === "queen" ? "haru" : v), z.enum(["haru", "jin"]).default("haru")),
});

const detailsInput = z.object({ slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(140) });

const searchInput = z.object({
  query: z.string().max(80).nullish(),
  max_price_naira: z.number().positive().max(100_000_000).nullish(),
  on_sale: z.boolean().nullish(),
  in_stock_only: z.boolean().nullish(),
});

const tools: Anthropic.Beta.BetaTool[] = [
  {
    name: "search_products",
    description:
      "Search the store's published products. Use for any request to find, recommend or check items (type, colour, style, occasion, budget). Returns up to 4 products with name, price, link and stock.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Short search words, e.g. 'pink dress', 'white sneakers', 'leather bag'. Omit to list newest items." },
        max_price_naira: { type: "number", description: "Maximum price in Naira (e.g. 30000), only if the shopper gave a budget." },
        on_sale: { type: "boolean", description: "Only discounted items." },
        in_stock_only: { type: "boolean", description: "Only items currently in stock." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "product_details",
    description:
      "Get one product's facts for support questions: description and details (fabric, care), weight, category, price, and each size/colour with in_stock and low_stock. Use the slug from search_products results.",
    input_schema: {
      type: "object",
      properties: { slug: { type: "string", description: "The product slug, e.g. 'horse-baggy-pants'." } },
      required: ["slug"],
      additionalProperties: false,
    },
  },
];

/**
 * Chat endpoint for ATTITUDE mini HARU / ATTITUDE mini JIN. Returns 503 { offline: true } when no
 * Anthropic API key is configured so the widget can switch to basic mode.
 */
export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ offline: true }, { status: 503 });
  if (!(await rateLimit("assistant", 30, 600))) {
    return NextResponse.json({ error: "Whoa, you're typing faster than my beats! 🎧 Give me a minute and try again." }, { status: 429 });
  }
  let parsed;
  try {
    parsed = bodySchema.safeParse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  // Keep the most recent turns, starting with a user message, each trimmed.
  let history = parsed.data.messages.slice(-MAX_HISTORY).map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }));
  while (history.length && history[0].role !== "user") history = history.slice(1);
  if (!history.length || history[history.length - 1].role !== "user") return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const knowledge = isSupabaseConfigured() ? await storeKnowledge().catch(() => "Store facts are temporarily unavailable.") : "Store facts are not available yet.";
  const client = new Anthropic();
  const messages: Anthropic.Beta.BetaMessageParam[] = history.map((m) => ({ role: m.role, content: m.content }));
  const products: ProductSuggestion[] = [];

  try {
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 2000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low" },
        system: [{ type: "text", text: `${persona(parsed.data.character)}\n\n${knowledge}`, cache_control: { type: "ephemeral" } }],
        tools: isSupabaseConfigured() ? tools : [],
        messages,
      });

      if (response.stop_reason === "refusal") {
        return NextResponse.json<AssistantReply>({ reply: "Aigoo, I can't help with that one 🙈 — but I can help you find a super cute fit!", products: [], action: "cross_arms" });
      }
      const toolUses = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
      if (response.stop_reason !== "tool_use" || toolUses.length === 0 || round === MAX_TOOL_ROUNDS) {
        const reply = response.content
          .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
          .map((b) => b.text)
          .join("")
          .trim();
        const { action, text } = parseAction(reply);
        return NextResponse.json<AssistantReply>({ reply: text || "Annyeong! 💖 What can I help you with?", products: dedupe(products), action });
      }

      messages.push({ role: "assistant", content: response.content });
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const call of toolUses) {
        if (call.name === "product_details") {
          const input = detailsInput.safeParse(call.input);
          if (!input.success) {
            results.push({ type: "tool_result", tool_use_id: call.id, content: "Invalid tool input.", is_error: true });
            continue;
          }
          try {
            const found = await productDetails(input.data.slug);
            results.push({ type: "tool_result", tool_use_id: call.id, content: found ? JSON.stringify(found) : "No published product with that slug." });
          } catch (e) {
            console.error("[assistant] details failed:", (e as Error).message);
            results.push({ type: "tool_result", tool_use_id: call.id, content: "Product details are unavailable right now.", is_error: true });
          }
          continue;
        }
        const input = searchInput.safeParse(call.input);
        if (call.name !== "search_products" || !input.success) {
          results.push({ type: "tool_result", tool_use_id: call.id, content: "Invalid tool input.", is_error: true });
          continue;
        }
        try {
          const found = await searchProducts({ query: input.data.query, maxPriceNaira: input.data.max_price_naira, onSale: input.data.on_sale, inStockOnly: input.data.in_stock_only });
          products.push(...found);
          results.push({ type: "tool_result", tool_use_id: call.id, content: found.length ? JSON.stringify(found.map((p) => ({ name: p.name, slug: p.slug, link: p.href, price: p.price, was_price: p.wasPrice, in_stock: p.inStock, sizes: p.variants?.map((v) => v.label) }))) : "No matching products found." });
        } catch (e) {
          console.error("[assistant] search failed:", (e as Error).message);
          results.push({ type: "tool_result", tool_use_id: call.id, content: "Product search is unavailable right now.", is_error: true });
        }
      }
      messages.push({ role: "user", content: results });
    }
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "So many people want to chat right now! 💃 Please try again in a moment." }, { status: 429 });
    }
    if (e instanceof Anthropic.AuthenticationError) {
      console.error("[assistant] invalid ANTHROPIC_API_KEY");
      return NextResponse.json({ offline: true }, { status: 503 });
    }
    console.error("[assistant]", e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : (e as Error).message);
    return NextResponse.json({ offline: true }, { status: 503 });
  }
  return NextResponse.json({ offline: true }, { status: 503 });
}

function dedupe(list: ProductSuggestion[]): ProductSuggestion[] {
  const seen = new Set<string>();
  return list.filter((p) => (seen.has(p.href) ? false : (seen.add(p.href), true))).slice(0, 4);
}
