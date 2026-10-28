"use client";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, m } from "motion/react";
import { Cookie } from "lucide-react";
import { OPEN_CONSENT, browserOptedOut, getConsent, setConsent } from "@/lib/analytics/client";

/**
 * Asks before any analytics cookie is set. Visitors whose browser sends
 * Global Privacy Control or Do Not Track are never tracked or asked.
 */
export function CookieConsent() {
  const [open, setOpen] = useState(false);
  const [optedOut, setOptedOut] = useState(false);

  useEffect(() => {
    if (browserOptedOut() || getConsent() !== null) return;
    // Wait until the welcome (language/country/currency) screen has been answered.
    const t = setInterval(() => {
      if (!/(?:^|; )ac_prefs=1/.test(document.cookie)) return;
      clearInterval(t);
      setTimeout(() => setOpen(true), 1200);
    }, 800);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const reopen = () => {
      setOptedOut(browserOptedOut());
      setOpen(true);
    };
    window.addEventListener(OPEN_CONSENT, reopen);
    return () => window.removeEventListener(OPEN_CONSENT, reopen);
  }, []);

  const t = useTranslations("cookies");
  const choose = (v: "granted" | "denied") => {
    setConsent(v);
    setOpen(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <m.section
          role="region"
          aria-label={t("aria")}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-md rounded-2xl border border-line bg-white/95 p-5 text-sm shadow-[0_24px_60px_-20px_rgba(37,25,35,0.35)] backdrop-blur sm:left-5 sm:right-auto sm:mx-0"
        >
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-pale text-rose-deep"><Cookie className="size-4" aria-hidden /></span>
            <div>
              <p className="font-semibold">{t("title")}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                {t("body")}{" "}
                <Link href="/privacy-policy" className="underline">{t("privacy")}</Link>
              </p>
              {optedOut ? (
                <p className="mt-3 text-xs text-muted">{t("dnt")}</p>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => choose("granted")} className="rounded-full bg-plum px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-deep">{t("allow")}</button>
                  <button type="button" onClick={() => choose("denied")} className="rounded-full border border-line px-4 py-2 text-xs font-semibold transition hover:border-plum">{t("deny")}</button>
                </div>
              )}
            </div>
          </div>
        </m.section>
      )}
    </AnimatePresence>
  );
}

/** Footer link to change the analytics choice later. */
export function CookieSettingsButton({ className }: { className?: string }) {
  const t = useTranslations("cookies");
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT))}>
      {t("settings")}
    </button>
  );
}
