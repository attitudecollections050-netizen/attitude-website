import { describe, expect, it } from "vitest";
import { PROMPT_RULES, canShowPrompt, countLinks, feedbackSchema, isQuietPath, parsePromptState, sentimentFromRating, spamVerdict } from "@/lib/feedback/shared";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 28, 12);

describe("heart ratings & feedback validation", () => {
  it("maps hearts to a default sentiment", () => {
    expect([1, 2, 3, 4, 5].map(sentimentFromRating)).toEqual(["negative", "negative", "neutral", "positive", "positive"]);
  });

  it("accepts a heart rating alone — everything else is optional", () => {
    const r = feedbackSchema.parse({ rating: 2 });
    expect(r).toMatchObject({ rating: 2, kind: "site", displayNamePref: "anonymous", publishConsent: false });
    expect([r.comment, r.suggestion, r.reason].every((v) => v == null)).toBe(true);
  });

  it("accepts negative and positive feedback equally", () => {
    expect(feedbackSchema.safeParse({ rating: 1, sentiment: "negative", comment: "Terrible delivery", reason: "delivery" }).success).toBe(true);
    expect(feedbackSchema.safeParse({ rating: 5, sentiment: "positive", comment: "Lovely" }).success).toBe(true);
  });

  it("rejects missing or out-of-range ratings and bad input", () => {
    expect(feedbackSchema.safeParse({}).success).toBe(false);
    expect(feedbackSchema.safeParse({ rating: 0 }).success).toBe(false);
    expect(feedbackSchema.safeParse({ rating: 6 }).success).toBe(false);
    expect(feedbackSchema.safeParse({ rating: 3, reason: "made_up" }).success).toBe(false);
    expect(feedbackSchema.safeParse({ rating: 3, comment: "x".repeat(2001) }).success).toBe(false);
    expect(feedbackSchema.safeParse({ rating: 3, kind: "product" }).success).toBe(false);
    expect(feedbackSchema.safeParse({ rating: 3, displayNamePref: "first_name" }).success).toBe(false);
    expect(feedbackSchema.safeParse({ rating: 3, displayNamePref: "first_name", displayName: "Ada" }).success).toBe(true);
  });
});

describe("spam protection", () => {
  const base = { website: null, startedAt: NOW - 10_000, comment: null, suggestion: null };
  it("rejects bots that fill the hidden field or submit instantly", () => {
    expect(spamVerdict({ ...base, website: "http://spam" }, NOW)).toBe("reject");
    expect(spamVerdict({ ...base, startedAt: NOW - 500 }, NOW)).toBe("reject");
  });
  it("flags link-stuffed text for moderation instead of discarding it", () => {
    expect(countLinks("visit http://a.com and www.b.net")).toBe(2);
    expect(spamVerdict({ ...base, comment: "buy http://a.com http://b.com" }, NOW)).toBe("flag");
  });
  it("never treats an honest negative review as spam", () => {
    expect(spamVerdict({ ...base, comment: "The dress tore after one wear and support never replied. Very disappointed." }, NOW)).toBe("ok");
  });
});

describe("feedback invitation frequency", () => {
  it("never interrupts checkout, payment, cart, order or account pages", () => {
    for (const p of ["/checkout", "/checkout/callback", "/cart", "/order/AC1001", "/account/orders", "/admin", "/feedback"]) {
      expect(isQuietPath(p)).toBe(true);
      expect(canShowPrompt({}, NOW, p)).toBe(false);
    }
    expect(isQuietPath("/shop")).toBe(false);
    expect(canShowPrompt({}, NOW, "/products/satin-dress")).toBe(true);
  });

  it("backs off after a dismissal and further after repeated dismissals", () => {
    const once = { lastShownAt: NOW - 3 * DAY, dismissals: 1 };
    expect(canShowPrompt(once, NOW, "/")).toBe(false);
    expect(canShowPrompt({ ...once, lastShownAt: NOW - PROMPT_RULES.afterDismissMs - 1 }, NOW, "/")).toBe(true);
    const twice = { lastShownAt: NOW - 30 * DAY, dismissals: 2 };
    expect(canShowPrompt(twice, NOW, "/")).toBe(false);
    expect(canShowPrompt({ ...twice, lastShownAt: NOW - PROMPT_RULES.afterRepeatedDismissMs - 1 }, NOW, "/")).toBe(true);
  });

  it("stays quiet for months after feedback is submitted", () => {
    expect(canShowPrompt({ submittedAt: NOW - 30 * DAY }, NOW, "/")).toBe(false);
    expect(canShowPrompt({ submittedAt: NOW - PROMPT_RULES.afterSubmitMs - 1 }, NOW, "/")).toBe(true);
  });

  it("survives corrupted stored state", () => {
    expect(parsePromptState("{oops")).toEqual({});
    expect(parsePromptState(null)).toEqual({});
    expect(parsePromptState('{"dismissals":1}')).toEqual({ dismissals: 1 });
  });
});
