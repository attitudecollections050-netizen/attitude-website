import { z } from "zod";

export const HEART_LABELS = ["Very poor", "Poor", "Average", "Good", "Excellent"] as const;

export const FEEDBACK_REASONS = [
  { id: "product_quality", label: "Product quality" },
  { id: "sizing_fit", label: "Sizing & fit" },
  { id: "price_value", label: "Price & value" },
  { id: "delivery", label: "Delivery" },
  { id: "customer_service", label: "Customer service" },
  { id: "website", label: "Website experience" },
  { id: "payment", label: "Payment" },
  { id: "other", label: "Something else" },
] as const;
export type FeedbackReason = (typeof FEEDBACK_REASONS)[number]["id"];
export const reasonLabel = (id: string | null | undefined) => FEEDBACK_REASONS.find((r) => r.id === id)?.label ?? (id === "unspecified" ? "No reason given" : (id ?? "—"));

export type Sentiment = "positive" | "neutral" | "negative";
export const SENTIMENT_LABELS: Record<Sentiment, string> = { positive: "Positive", neutral: "Neutral", negative: "Negative" };
export const sentimentTone = (s: string) => (s === "positive" ? "success" : s === "negative" ? "danger" : "neutral") as "success" | "danger" | "neutral";

/** Sentiment implied by a heart rating when the customer doesn't pick one. */
export function sentimentFromRating(rating: number): Sentiment {
  if (rating >= 4) return "positive";
  if (rating === 3) return "neutral";
  return "negative";
}

export const FEEDBACK_SOURCES = ["exit_intent", "timed_prompt", "form", "product_page", "order_page"] as const;

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Please keep this under ${max} characters.`)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const feedbackSchema = z
  .object({
    kind: z.enum(["site", "product"]).default("site"),
    productId: z.string().uuid().optional().nullable(),
    rating: z.coerce.number().int().min(1, "Please choose a heart rating.").max(5),
    sentiment: z.enum(["positive", "neutral", "negative"]).optional().nullable(),
    comment: optText(2000),
    reason: z.enum(FEEDBACK_REASONS.map((r) => r.id) as [FeedbackReason, ...FeedbackReason[]]).optional().nullable().or(z.literal("").transform(() => null)),
    suggestion: optText(1000),
    displayNamePref: z.enum(["first_name", "anonymous"]).default("anonymous"),
    displayName: optText(40),
    publishConsent: z.boolean().default(false),
    source: z.enum(FEEDBACK_SOURCES).default("form"),
    pagePath: z.string().max(300).optional().nullable(),
    // Spam traps: a hidden field bots fill in, and when the form was opened.
    website: z.string().max(200).optional().nullable(),
    startedAt: z.number().int().optional().nullable(),
  })
  .refine((v) => v.kind !== "product" || Boolean(v.productId), { message: "Missing product.", path: ["productId"] })
  .refine((v) => v.displayNamePref !== "first_name" || Boolean(v.displayName), { message: "Enter the first name to display, or choose anonymous.", path: ["displayName"] });
export type FeedbackInput = z.input<typeof feedbackSchema>;
export type FeedbackData = z.output<typeof feedbackSchema>;

/** Minimum time a person needs to fill in the form; faster submissions are bots. */
export const MIN_FILL_MS = 2500;

export function countLinks(text: string | null | undefined): number {
  return (text ?? "").match(/(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|net|org|xyz|ru|top|info|biz|io|ng)\b/gi)?.length ?? 0;
}

/**
 * Spam heuristics. These never look at the rating or sentiment, so negative
 * feedback is treated exactly like positive feedback.
 * "reject" = silently drop (bot), "flag" = keep but hold for moderation as spam.
 */
export function spamVerdict(d: Pick<FeedbackData, "website" | "startedAt" | "comment" | "suggestion">, now = Date.now()): "ok" | "flag" | "reject" {
  if (d.website) return "reject";
  if (d.startedAt && now - d.startedAt < MIN_FILL_MS) return "reject";
  const links = countLinks(d.comment) + countLinks(d.suggestion);
  if (links >= 2) return "flag";
  if (/(.)\1{14,}/.test(`${d.comment ?? ""}${d.suggestion ?? ""}`)) return "flag";
  return "ok";
}

// ---------------------------------------------------------------------------
// Feedback invitation frequency rules (stored per browser in localStorage).
// ---------------------------------------------------------------------------
export const PROMPT_STORAGE_KEY = "ac_feedback_prompt";
const DAY = 86_400_000;
export const PROMPT_RULES = {
  /** After "Maybe later" / close, wait this long before asking again. */
  afterDismissMs: 14 * DAY,
  /** After two dismissals, back off further. */
  afterRepeatedDismissMs: 60 * DAY,
  /** After feedback is submitted, don't ask again for this long. */
  afterSubmitMs: 120 * DAY,
  /** Desktop: minimum time on site before exit intent may show the prompt. */
  minEngagedMsDesktop: 20_000,
  /** Mobile: show the gentle prompt after this much time and this many pages. */
  mobileDelayMs: 75_000,
  mobileMinPages: 2,
};

export interface PromptState {
  lastShownAt?: number;
  dismissals?: number;
  submittedAt?: number;
}

/** Paths where we never interrupt: checkout, payment, account and admin flows. */
export function isQuietPath(path: string): boolean {
  return /^\/(checkout|cart|order|account|admin|feedback|track-order)(\/|$)/.test(path);
}

export function canShowPrompt(state: PromptState, now: number, path: string): boolean {
  if (isQuietPath(path)) return false;
  if (state.submittedAt && now - state.submittedAt < PROMPT_RULES.afterSubmitMs) return false;
  if (state.lastShownAt) {
    const wait = (state.dismissals ?? 0) >= 2 ? PROMPT_RULES.afterRepeatedDismissMs : PROMPT_RULES.afterDismissMs;
    if (now - state.lastShownAt < wait) return false;
  }
  return true;
}

export function parsePromptState(raw: string | null): PromptState {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw) as PromptState;
    return typeof v === "object" && v ? v : {};
  } catch {
    return {};
  }
}
