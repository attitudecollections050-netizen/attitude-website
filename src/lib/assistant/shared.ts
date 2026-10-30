// ATTITUDE mini HARU / JIN — shared between the chat widget and the server.
import type { DripAction } from "./characters";
import { STORE_FAQ } from "./faq";

export const ASSISTANT_NAME = "ATTITUDE mini HARU";
export const MAX_MESSAGE_CHARS = 800;
export const MAX_HISTORY = 16;

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ProductSuggestion {
  name: string;
  slug?: string;
  /** Sizes/colours that can go straight into the cart from the chat. */
  variants?: { id: string; label: string; inStock: boolean }[];
  href: string;
  price: string;
  wasPrice: string | null;
  /** Kobo amounts so the chat card can show the shopper's display currency. */
  priceMinor?: number;
  wasPriceMinor?: number | null;
  image: string | null;
  inStock: boolean;
}

export interface AssistantReply {
  reply: string;
  products: ProductSuggestion[];
  /** Animation for the character to play (see characters.ts). */
  action?: DripAction | null;
}

/** Clean, family-friendly jokes used by basic mode (no AI key needed). */
export const JOKES = [
  "Why did the dress break up with the hanger? It felt too hung up on the relationship! 😂",
  "My jeans and I have a lot in common — we both get a little tight after the holidays. 👖",
  "Why did the sneaker go to therapy? It had too many sole problems! 👟",
  "What did the handbag say to the purse? “You complete my look… and my snacks.” 👜",
  "I told my wardrobe a secret. Now it won’t stop closet-ing about it! 🤭",
  "Why don’t T-shirts ever win arguments? They always get pressed! 👕",
  "My heels and I are like Lagos traffic — slow, stylish and full of attitude. 👠",
  "Why was the belt arrested? It held up a pair of trousers! 🚔",
  "What’s a DJ’s favourite fabric? Remix-cotton, obviously! 🎧",
  "I wanted to buy camouflage pants… but I couldn’t find any! 🙈",
];

/** Fun questions the assistant can ask shoppers (basic mode). */
export const FUN_QUESTIONS = [
  "Quick one! 💗 If your outfit today was a song, what song would it be?",
  "Sneakers or heels — which one is more *you*? 👟👠",
  "Pink, black or white: what's your power colour this season?",
  "Are you dressing for a party, work, church, or just to slay at home? 💅",
  "Be honest: how many bags is “too many bags”? I say there's no such thing! 👜",
  "What's one piece in your wardrobe you can't live without?",
];

/** Text that is safe to read aloud: no emojis, markdown or URLs. */
export function speakable(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\((\/[^)\s]*)\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/(^|\s)\/[\w\-/?=&]+/g, "$1")
    .replace(/[*_#`~>]/g, "")
    .replace(/\p{Extended_Pictographic}|️|‍/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Splits text into plain parts and internal links ([label](/path) or bare /path). */
export function linkify(text: string): ({ type: "text"; value: string } | { type: "link"; label: string; href: string })[] {
  const out: ({ type: "text"; value: string } | { type: "link"; label: string; href: string })[] = [];
  const re = /\[([^\]]{1,80})\]\((\/[\w\-/?=&%.]*)\)|(^|[\s(])(\/(?:shop|products|collections|search|cart|checkout|track-order|contact|faq|feedback|account|about|shipping-policy|returns-policy|privacy-policy|terms)[\w\-/?=&%]*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m[1]) {
      if (m.index > last) out.push({ type: "text", value: text.slice(last, m.index) });
      out.push({ type: "link", label: m[1], href: m[2] });
    } else {
      const start = m.index + m[3].length;
      if (start > last) out.push({ type: "text", value: text.slice(last, start) });
      const href = m[4].replace(/[.,!?)]+$/, "");
      out.push({ type: "link", label: href, href });
      last = start + href.length;
      re.lastIndex = last;
      continue;
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ type: "text", value: text.slice(last) });
  return out;
}

/**
 * Basic mode: friendly scripted answers used when no AI key is configured
 * (or the AI is unavailable). It only states things that are always true
 * about this site and points to the right page.
 */
export function basicReply(input: string, seed = Date.now()): string {
  const t = input.toLowerCase();
  const pick = <T,>(arr: T[]) => arr[Math.abs(seed) % arr.length];
  if (/joke|funny|laugh|make me (smile|happy)/.test(t)) return `${pick(JOKES)}\n\nWant another one? Just say “joke” again! 😄`;
  if (/question|quiz|ask me|bored|play/.test(t)) return pick(FUN_QUESTIONS);
  if (/track|where is my order|order status|my order/.test(t)) return "You can check your order anytime on [Track your order](/track-order) — you'll need your order number and the email you used. 📦";
  if (/deliver|shipping|ship|dispatch|how long/.test(t)) return `${STORE_FAQ.delivery} 🚚 More details on our [Shipping policy](/shipping-policy).`;
  if (/return|refund|exchange/.test(t)) return "No stress! Our [Returns & refunds](/returns-policy) page explains how returns and exchanges work. 💗";
  if (/pay|paystack|card|transfer/.test(t)) return `${STORE_FAQ.payment} 🔒`;
  if (/contact|phone|email|whatsapp|human|talk to/.test(t)) return "You can reach the Attitude Collections team on our [Contact page](/contact). 💌";
  if (/size|fit/.test(t)) return `${STORE_FAQ.size} 📏`;
  if (/feedback|review|complain/.test(t)) return "I'd love to hear it! Share your experience with hearts on our [Feedback page](/feedback). 💗";
  const shop = t.match(/(?:find|looking for|want|need|show me|buy)\s+(?:a |an |some )?(.{2,40})/);
  if (shop) return `Ooh, let's find it! 🛍️ Here are results for “${shop[1].replace(/[?.!]+$/, "")}”: [search the shop](/search?q=${encodeURIComponent(shop[1].replace(/[?.!]+$/, ""))})`;
  if (/^(hi|hello|hey|good (morning|afternoon|evening))/.test(t)) return "Hi I'm Haru! 💖 I can find your fit, help with sizes, explain delivery and returns, or tell you a joke. What are we shopping for today, cutie?";
  if (/men|women|bag|shoe|sneaker|dress|shirt|top|jean/.test(t)) return `Let's shop! 🛍️ Try [this search](/search?q=${encodeURIComponent(input.slice(0, 40))}) or browse [the whole shop](/shop).`;
  return `Aigoo, I didn't quite catch that 🙈 ${STORE_FAQ.fallback}`;
}
