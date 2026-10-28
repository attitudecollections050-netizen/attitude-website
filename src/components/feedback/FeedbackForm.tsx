"use client";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, m } from "motion/react";
import { BadgeCheck, Frown, Meh, Smile } from "lucide-react";
import { submitFeedback } from "@/app/actions/feedback";
import { FEEDBACK_REASONS, sentimentFromRating, type Sentiment } from "@/lib/feedback/shared";
import { useTranslations } from "next-intl";
import { buttonClasses } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { cn } from "@/lib/cn";
import { HeartRating } from "./HeartRating";

const SENTIMENTS: { id: Sentiment; icon: typeof Smile }[] = [
  { id: "positive", icon: Smile },
  { id: "neutral", icon: Meh },
  { id: "negative", icon: Frown },
];

export interface FeedbackFormProps {
  kind?: "site" | "product";
  productId?: string;
  source?: "exit_intent" | "timed_prompt" | "form" | "product_page" | "order_page";
  initialSentiment?: Sentiment | null;
  compact?: boolean;
  onSubmitted?: () => void;
  onCancel?: () => void;
  cancelLabel?: string;
}

/**
 * Five-heart feedback form. Everything except the heart rating is optional,
 * and positive, neutral and negative feedback are all accepted equally.
 */
export function FeedbackForm({ kind = "site", productId, source = "form", initialSentiment = null, compact = false, onSubmitted, onCancel, cancelLabel }: FeedbackFormProps) {
  const id = useId();
  const t = useTranslations("feedback");
  const pathname = usePathname();
  const [rating, setRating] = useState(0);
  const [sentiment, setSentiment] = useState<Sentiment | null>(initialSentiment);
  const [sentimentTouched, setSentimentTouched] = useState(Boolean(initialSentiment));
  const [namePref, setNamePref] = useState<"anonymous" | "first_name">("anonymous");
  const startedAt = useRef<number | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string; verified?: boolean } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  const onRate = (v: number) => {
    setRating(v);
    setErrors((e) => ({ ...e, rating: "" }));
    if (!sentimentTouched) setSentiment(sentimentFromRating(v));
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!rating) {
      setErrors({ rating: t("errors.chooseRating") });
      return;
    }
    const f = new FormData(e.currentTarget);
    const payload = {
      kind,
      productId: productId ?? null,
      rating,
      sentiment: sentiment ?? sentimentFromRating(rating),
      comment: String(f.get("comment") ?? ""),
      reason: String(f.get("reason") ?? "") || null,
      suggestion: String(f.get("suggestion") ?? ""),
      displayNamePref: namePref,
      displayName: String(f.get("displayName") ?? ""),
      publishConsent: f.get("publishConsent") === "on",
      source,
      pagePath: pathname,
      website: String(f.get("website") ?? ""),
      startedAt: startedAt.current,
    };
    start(async () => {
      const r = await submitFeedback(payload);
      if (r.ok) {
        setErrors({});
        setResult({ ok: true, text: r.message, verified: r.verified });
        onSubmitted?.();
      } else {
        setErrors(r.fieldErrors ?? {});
        setResult({ ok: false, text: r.error });
      }
    });
  };

  if (result?.ok) {
    return (
      <m.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="py-4 text-center" role="status">
        <p className="font-display text-3xl">{t("thankYou")}</p>
        <p className="mt-2 text-sm text-muted">{result.text}</p>
        {result.verified && (
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-success"><BadgeCheck className="size-4" aria-hidden /> {t("verified")}</p>
        )}
      </m.div>
    );
  }

  const fieldCls = "field !py-2.5 !text-sm";
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <HeartRating value={rating} onChange={onRate} size={compact ? "md" : "lg"} legend={kind === "product" ? t("rateProduct") : t("rateExperience")} describedBy={errors.rating ? `${id}-rating-err` : undefined} />
      {errors.rating && <p id={`${id}-rating-err`} className="-mt-3 text-xs text-danger">{errors.rating}</p>}

      <fieldset>
        <legend className="text-sm font-semibold">{t("overall")}</legend>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {SENTIMENTS.map(({ id: sid, icon: Icon }) => (
            <label
              key={sid}
              className={cn(
                "flex cursor-pointer items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-rose-deep",
                sentiment === sid ? "border-rose bg-pale text-rose-deep" : "border-line hover:border-plum/40",
              )}
            >
              <input
                type="radio"
                name="sentiment"
                value={sid}
                checked={sentiment === sid}
                onChange={() => {
                  setSentiment(sid);
                  setSentimentTouched(true);
                }}
                className="sr-only"
              />
              <Icon className="size-4" aria-hidden /> {t(`sentiment.${sid}`)}
            </label>
          ))}
        </div>
      </fieldset>

      <AnimatePresence initial={false}>
        {rating > 0 && (
          <m.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-4 overflow-hidden">
            <label className="block text-sm">
              <span className="font-semibold">{kind === "product" ? t("yourReview") : t("tellUsMore")} <span className="font-normal text-muted">{t("optional")}</span></span>
              <textarea name="comment" rows={compact ? 3 : 4} maxLength={2000} className={cn(fieldCls, "mt-1.5 resize-y")} aria-invalid={Boolean(errors.comment)} />
              {errors.comment && <span className="mt-1 block text-xs text-danger">{errors.comment}</span>}
            </label>
            <div className={cn("grid gap-4", !compact && "sm:grid-cols-2")}>
              <label className="block text-sm">
                <span className="font-semibold">{t("mainReason")} <span className="font-normal text-muted">{t("optional")}</span></span>
                <select name="reason" defaultValue="" className={cn(fieldCls, "mt-1.5")}>
                  <option value="">{t("chooseReason")}</option>
                  {FEEDBACK_REASONS.map((r) => (
                    <option key={r.id} value={r.id}>{t(`reasons.${r.id}`)}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="font-semibold">{t("improve")} <span className="font-normal text-muted">{t("optional")}</span></span>
                <input name="suggestion" maxLength={1000} className={cn(fieldCls, "mt-1.5")} />
              </label>
            </div>

            <fieldset className="text-sm">
              <legend className="font-semibold">{t("displayAs")}</legend>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
                <label className="flex items-center gap-2"><input type="radio" name="displayNamePref" checked={namePref === "anonymous"} onChange={() => setNamePref("anonymous")} className="accent-rose-deep" /> {t("anonymous")}</label>
                <label className="flex items-center gap-2"><input type="radio" name="displayNamePref" checked={namePref === "first_name"} onChange={() => setNamePref("first_name")} className="accent-rose-deep" /> {t("myFirstName")}</label>
              </div>
              {namePref === "first_name" && (
                <label className="mt-2 block">
                  <span className="sr-only">{t("firstName")}</span>
                  <input name="displayName" maxLength={40} autoComplete="given-name" placeholder={t("firstName")} className={cn(fieldCls, "max-w-xs")} aria-invalid={Boolean(errors.displayName)} />
                  {errors.displayName && <span className="mt-1 block text-xs text-danger">{errors.displayName}</span>}
                </label>
              )}
            </fieldset>

            {kind === "product" && (
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="publishConsent" defaultChecked className="mt-1 accent-rose-deep" />
                <span>{t("publishConsent")}</span>
              </label>
            )}
          </m.div>
        )}
      </AnimatePresence>

      {/* Spam trap: hidden from people, often filled in by bots. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>

      {result && !result.ok && <Notice tone="error">{result.text}</Notice>}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClasses("primary", compact ? "sm" : "md")}>
          {pending ? t("sending") : kind === "product" ? t("submitReview") : t("send")}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-xs font-semibold text-muted underline-offset-4 hover:text-plum hover:underline">
            {cancelLabel ?? t("cancel")}
          </button>
        )}
      </div>
      <p className="text-[0.7rem] leading-relaxed text-muted">
        {t("weRead")} {kind === "site" ? t("privateNote") : t("moderatedNote")}
      </p>
    </form>
  );
}
