"use server";
import { createHash } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { clientFingerprint, rateLimit } from "@/lib/rate-limit";
import { consentedVisitorId } from "@/lib/analytics/server";
import { cleanPath } from "@/lib/analytics/shared";
import { feedbackSchema, sentimentFromRating, spamVerdict } from "@/lib/feedback/shared";

import { getTranslations } from "next-intl/server";

/** Feedback messages in the shopper's language. */
async function ft(key: string, values?: Record<string, string | number>): Promise<string> {
  return (await getTranslations("feedback.errors"))(key, values);
}
const ISSUE_KEYS: Record<string, string> = {
  "Please choose a heart rating.": "chooseRating",
  "Missing product.": "cantReview",
  "Enter the first name to display, or choose anonymous.": "firstName",
};
async function localizeFeedbackIssue(message: string): Promise<string> {
  const max = /^Please keep this under (\d+) characters\.$/.exec(message);
  if (max) return ft("tooLong", { max: Number(max[1]) });
  return ISSUE_KEYS[message] ? ft(ISSUE_KEYS[message]) : message;
}

export type FeedbackResult = { ok: true; message: string; verified?: boolean } | { ok: false; error: string; fieldErrors?: Record<string, string> };

const RECENT_SITE_FEEDBACK_MS = 24 * 60 * 60 * 1000;

/**
 * Stores customer feedback or a product review. Validation, spam checks and
 * the verified-purchase check all happen here on the server. Ratings are
 * stored exactly as submitted — negative feedback is never filtered out.
 */
export async function submitFeedback(input: unknown): Promise<FeedbackResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: await ft("unavailable") };
  const parsed = feedbackSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[i.path.join(".") || "form"] ??= await localizeFeedbackIssue(i.message);
    return { ok: false, error: Object.values(fieldErrors)[0] ?? await ft("checkForm"), fieldErrors };
  }
  const d = parsed.data;
  const verdict = spamVerdict(d);
  // Bots get a normal-looking reply but nothing is stored.
  if (verdict === "reject") return { ok: true, message: await ft("thanks") };
  if (!(await rateLimit("feedback", 5, 3600))) return { ok: false, error: await ft("tooMany") };

  const db = createServiceClient();
  const [user, visitorId, fingerprint] = await Promise.all([getCurrentUser(), consentedVisitorId(), clientFingerprint()]);
  const submitterKey = createHash("sha256").update(`feedback:${user?.id ?? fingerprint}`).digest("hex").slice(0, 40);

  let orderId: string | null = null;
  if (d.kind === "product") {
    if (!user) return { ok: false, error: await ft("signIn") };
    const { data: product } = await db.from("products").select("id").eq("id", d.productId!).eq("status", "published").maybeSingle();
    if (!product) return { ok: false, error: await ft("cantReview") };
    const { data: existing } = await db.from("feedback").select("id").eq("kind", "product").eq("user_id", user.id).eq("product_id", d.productId!).maybeSingle();
    if (existing) return { ok: false, error: await ft("alreadyReviewed") };
    const { data: purchase } = await db.rpc("verified_purchase_order", { p_user_id: user.id, p_product_id: d.productId! });
    orderId = (purchase as string | null) ?? null;
  } else {
    // One site-feedback submission per person per day prevents accidental duplicates.
    const since = new Date(Date.now() - RECENT_SITE_FEEDBACK_MS).toISOString();
    const { count } = await db.from("feedback").select("id", { count: "exact", head: true }).eq("kind", "site").eq("submitter_key", submitterKey).gte("created_at", since);
    if ((count ?? 0) > 0) return { ok: false, error: await ft("alreadyToday") };
  }

  const { error } = await db.from("feedback").insert({
    kind: d.kind,
    product_id: d.kind === "product" ? d.productId : null,
    order_id: orderId,
    user_id: user?.id ?? null,
    rating: d.rating,
    sentiment: d.sentiment ?? sentimentFromRating(d.rating),
    comment: d.comment,
    reason: d.reason ?? null,
    suggestion: d.suggestion,
    display_name_pref: d.displayNamePref,
    display_name: d.displayNamePref === "first_name" ? d.displayName?.split(/\s+/)[0]?.slice(0, 40) : null,
    publish_consent: d.publishConsent,
    is_verified_purchase: Boolean(orderId),
    source: d.source,
    page_path: cleanPath(d.pagePath ?? null),
    visitor_id: visitorId,
    submitter_key: submitterKey,
    flag: verdict === "flag" ? "spam" : null,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: await ft("alreadyReviewed") };
    console.error("[feedback]", error.message);
    return { ok: false, error: await ft("saveFailed") };
  }
  const published = d.publishConsent && d.kind === "product";
  return { ok: true, verified: Boolean(orderId), message: await ft(published ? "savedPublished" : "saved") };
}
