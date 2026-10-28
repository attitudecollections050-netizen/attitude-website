"use client";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, m } from "motion/react";
import { Frown, Heart, Smile, X } from "lucide-react";
import { useDialog } from "@/components/ui/useDialog";
import { browserOptedOut, getConsent } from "@/lib/analytics/client";
import { PROMPT_RULES, PROMPT_STORAGE_KEY, canShowPrompt, isQuietPath, parsePromptState, type PromptState, type Sentiment } from "@/lib/feedback/shared";
import { FeedbackForm } from "./FeedbackForm";

const SESSION_SHOWN = "ac_fb_shown";
const SESSION_PAGES = "ac_fb_pages";
const SESSION_START = "ac_fb_start";

function loadState(): PromptState {
  try {
    return parsePromptState(localStorage.getItem(PROMPT_STORAGE_KEY));
  } catch {
    return {};
  }
}
function saveState(s: PromptState) {
  try {
    localStorage.setItem(PROMPT_STORAGE_KEY, JSON.stringify(s));
  } catch {}
}
function session(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function setSession(key: string, v: string) {
  try {
    sessionStorage.setItem(key, v);
  } catch {}
}

/**
 * Polite feedback invitation.
 *  - Desktop: shown when the pointer leaves the top of the window (the usual
 *    "about to leave" signal) after the visitor has spent some time here.
 *    Browsers give no reliable signal for every exit, so some visitors will
 *    simply never see it.
 *  - Touch devices: no exit signal exists, so a small dismissible card is
 *    offered after a couple of pages and some time on the site.
 * Never on checkout, cart, payment, order or account pages; at most once per
 * visit; backs off after "Maybe later" and after feedback is sent.
 */
export function FeedbackInvite() {
  const pathname = usePathname();
  const [mode, setMode] = useState<"closed" | "nudge" | "dialog">("closed");
  const [step, setStep] = useState<"choose" | "form">("choose");
  const [sentiment, setSentiment] = useState<Sentiment | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [origin, setOrigin] = useState<"exit_intent" | "timed_prompt">("exit_intent");
  const panel = useRef<HTMLDivElement>(null);
  const pathRef = useRef(pathname);
  const modeRef = useRef(mode);
  const submittedRef = useRef(submitted);
  useEffect(() => {
    pathRef.current = pathname;
    modeRef.current = mode;
    submittedRef.current = submitted;
  }, [pathname, mode, submitted]);

  const eligible = useCallback(() => {
    if (session(SESSION_SHOWN)) return false;
    // Let the cookie question be answered first so prompts never stack.
    if (getConsent() === null && !browserOptedOut()) return false;
    return canShowPrompt(loadState(), Date.now(), pathRef.current);
  }, []);

  const show = useCallback((as: "nudge" | "dialog") => {
    setSession(SESSION_SHOWN, "1");
    saveState({ ...loadState(), lastShownAt: Date.now() });
    setStep("choose");
    setSentiment(null);
    setSubmitted(false);
    setOrigin(as === "dialog" ? "exit_intent" : "timed_prompt");
    setMode(as);
  }, []);

  const close = useCallback(() => {
    if (modeRef.current !== "closed" && !submittedRef.current) {
      const s = loadState();
      saveState({ ...s, dismissals: (s.dismissals ?? 0) + 1 });
    }
    modeRef.current = "closed";
    setMode("closed");
  }, []);

  // Count pages viewed this visit (used for the touch-device prompt).
  useEffect(() => {
    if (!session(SESSION_START)) setSession(SESSION_START, String(Date.now()));
    setSession(SESSION_PAGES, String(Number(session(SESSION_PAGES) ?? 0) + 1));
  }, [pathname]);
  // Never show over checkout, payment or account pages, even if opened just before navigating there.
  const visible = isQuietPath(pathname) ? "closed" : mode;

  useEffect(() => {
    const desktop = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    // Time on site counts from the start of the visit, not from this page load.
    const onSiteMs = () => Date.now() - Number(session(SESSION_START) ?? Date.now());

    if (desktop) {
      const onOut = (e: MouseEvent) => {
        if (e.relatedTarget || e.clientY > 0) return;
        if (onSiteMs() < PROMPT_RULES.minEngagedMsDesktop) return;
        if (eligible()) show("dialog");
      };
      document.documentElement.addEventListener("mouseleave", onOut);
      return () => document.documentElement.removeEventListener("mouseleave", onOut);
    }

    const tick = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const pages = Number(session(SESSION_PAGES) ?? 0);
      if (onSiteMs() >= PROMPT_RULES.mobileDelayMs && pages >= PROMPT_RULES.mobileMinPages && eligible()) {
        clearInterval(tick);
        show("nudge");
      }
    }, 5000);
    return () => clearInterval(tick);
  }, [eligible, show]);

  useDialog(visible === "dialog", close, panel);
  const t = useTranslations("feedback.invite");

  const choose = (s: Sentiment | null) => {
    setSentiment(s);
    setStep("form");
  };
  const onSubmitted = () => {
    submittedRef.current = true;
    setSubmitted(true);
    saveState({ ...loadState(), submittedAt: Date.now() });
  };

  return (
    <AnimatePresence>
      {visible === "nudge" && (
        <m.aside
          key="nudge"
          aria-label={t("aria")}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          className="fixed inset-x-3 bottom-3 z-[55] rounded-2xl border border-line bg-white p-4 shadow-[0_24px_60px_-20px_rgba(37,25,35,0.4)]"
        >
          <button type="button" onClick={close} className="absolute right-2 top-2 grid size-9 place-items-center rounded-full text-muted hover:bg-neutral" aria-label={t("closeAria")}>
            <X className="size-4" />
          </button>
          <p className="pr-8 text-sm font-semibold">{t("title")}</p>
          <p className="mt-1 text-xs text-muted">{t("body")}</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => setMode("dialog")} className="rounded-full bg-plum px-4 py-2 text-xs font-semibold text-white">{t("share")}</button>
            <button type="button" onClick={close} className="rounded-full border border-line px-4 py-2 text-xs font-semibold">{t("later")}</button>
          </div>
        </m.aside>
      )}

      {visible === "dialog" && (
        <div key="dialog" className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6">
          <m.div className="absolute inset-0 bg-plum/40 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} aria-hidden />
          <m.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-invite-title"
            tabIndex={-1}
            initial={{ opacity: 0, y: 40, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl outline-none sm:max-w-lg sm:rounded-3xl sm:p-8"
          >
            <button type="button" onClick={close} className="absolute right-3 top-3 grid size-10 place-items-center rounded-full text-muted transition hover:bg-neutral hover:text-plum" aria-label={t("close")}>
              <X className="size-5" />
            </button>
            <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-pale text-rose" aria-hidden>
              <Heart className="size-6 fill-rose" />
            </div>
            <h2 id="feedback-invite-title" className="text-center font-display text-3xl leading-tight">{t("title")}</h2>
            <p className="mt-2 text-center text-sm text-muted">{t("body")}</p>

            {step === "choose" ? (
              <div className="mt-6 space-y-2.5">
                <ChoiceButton icon={<Smile className="size-5" />} onClick={() => choose("positive")}>{t("positive")}</ChoiceButton>
                <ChoiceButton icon={<Frown className="size-5" />} onClick={() => choose("negative")}>{t("negative")}</ChoiceButton>
                <ChoiceButton icon={<Heart className="size-5" />} onClick={() => choose(null)}>{t("hearts")}</ChoiceButton>
                <button type="button" onClick={close} className="mx-auto mt-2 block text-xs font-semibold text-muted underline-offset-4 hover:text-plum hover:underline">
                  {t("later")}
                </button>
              </div>
            ) : (
              <div className="mt-6">
                <FeedbackForm compact source={origin} initialSentiment={sentiment} onSubmitted={onSubmitted} onCancel={close} cancelLabel={submitted ? t("close") : t("later")} />
                {submitted && (
                  <button type="button" onClick={close} className="mx-auto mt-2 block text-xs font-semibold text-muted underline-offset-4 hover:underline">{t("close")}</button>
                )}
              </div>
            )}
          </m.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function ChoiceButton({ icon, children, onClick }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border border-line px-5 py-3.5 text-left text-sm font-semibold transition hover:border-rose hover:bg-blush focus-visible:border-rose"
    >
      <span className="text-rose-deep" aria-hidden>{icon}</span>
      {children}
    </button>
  );
}
