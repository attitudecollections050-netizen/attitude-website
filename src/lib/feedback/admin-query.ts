import "server-only";
import { createClient } from "@/lib/supabase/server";

export const FEEDBACK_PAGE_SIZE = 25;

export interface FeedbackFilters {
  q: string;
  rating: number | null;
  sentiment: string;
  kind: string;
  status: string;
  moderation: string;
  flagged: string;
  sort: "newest" | "oldest";
  page: number;
}

export function parseFeedbackFilters(sp: Record<string, string | string[] | undefined>): FeedbackFilters {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const rating = Number(one(sp.rating));
  const page = Number(one(sp.page));
  const pick = (v: string, allowed: string[]) => (allowed.includes(v) ? v : "");
  return {
    q: one(sp.q).trim().slice(0, 100),
    rating: Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : null,
    sentiment: pick(one(sp.sentiment), ["positive", "neutral", "negative"]),
    kind: pick(one(sp.kind), ["site", "product"]),
    status: pick(one(sp.status), ["new", "reviewed"]),
    moderation: pick(one(sp.moderation), ["pending", "approved", "hidden"]),
    flagged: pick(one(sp.flagged), ["yes", "no"]),
    sort: one(sp.sort) === "oldest" ? "oldest" : "newest",
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

export function feedbackQueryString(f: FeedbackFilters, extra: Record<string, string | number> = {}): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.rating) p.set("rating", String(f.rating));
  for (const k of ["sentiment", "kind", "status", "moderation", "flagged"] as const) if (f[k]) p.set(k, f[k]);
  if (f.sort !== "newest") p.set("sort", f.sort);
  for (const [k, v] of Object.entries(extra)) p.set(k, String(v));
  return p.toString();
}

const LIST_SELECT =
  "id, kind, rating, sentiment, comment, reason, suggestion, display_name_pref, display_name, publish_consent, is_verified_purchase, source, page_path, status, moderation, flag, response, created_at, product:products ( id, name, slug )";

/** Staff-only listing (RLS: is_staff()). */
export async function queryFeedback(f: FeedbackFilters, opts: { limit?: number; offset?: number } = {}) {
  const db = await createClient();
  let q = db.from("feedback").select(LIST_SELECT, { count: "exact" }).order("created_at", { ascending: f.sort === "oldest" });
  if (f.rating) q = q.eq("rating", f.rating);
  if (f.sentiment) q = q.eq("sentiment", f.sentiment);
  if (f.kind) q = q.eq("kind", f.kind);
  if (f.status) q = q.eq("status", f.status);
  if (f.moderation) q = q.eq("moderation", f.moderation);
  if (f.flagged === "yes") q = q.not("flag", "is", null);
  if (f.flagged === "no") q = q.is("flag", null);
  if (f.q) {
    const term = f.q.replace(/[,%()*]/g, " ").trim();
    if (term) q = q.or(`comment.ilike.%${term}%,suggestion.ilike.%${term}%,display_name.ilike.%${term}%,response.ilike.%${term}%`);
  }
  const limit = opts.limit ?? FEEDBACK_PAGE_SIZE;
  const offset = opts.offset ?? (f.page - 1) * limit;
  return q.range(offset, offset + limit - 1);
}

export interface FeedbackRow {
  id: string;
  kind: "site" | "product";
  rating: number;
  sentiment: "positive" | "neutral" | "negative";
  comment: string | null;
  reason: string | null;
  suggestion: string | null;
  display_name_pref: string;
  display_name: string | null;
  publish_consent: boolean;
  is_verified_purchase: boolean;
  source: string;
  page_path: string | null;
  status: "new" | "reviewed";
  moderation: "pending" | "approved" | "hidden";
  flag: string | null;
  response: string | null;
  created_at: string;
  product: { id: string; name: string; slug: string } | null;
}
