"use client";
import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { Check, Globe2, Search, X } from "lucide-react";
import { savePreferences } from "@/app/actions/preferences";
import { LOCALES } from "@/lib/intl/config";
import { DripBaby } from "@/components/assistant/DripBaby";
import { useDialog } from "@/components/ui/useDialog";
import { cn } from "@/lib/cn";
import { OPEN_PREFS_EVENT, usePreferences } from "./PreferencesProvider";

/** Pages where we never pop up the welcome screen (payment, order and account flows). */
const quiet = (p: string) => /^\/(checkout|order|account|admin)(\/|$)/.test(p);

export function regionName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}
export function currencyName(code: string, locale: string, fallback: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "currency" }).of(code) ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * First-visit welcome screen and the "change preferences" dialog.
 * Language, country and currency are separate choices; suggestions are only
 * pre-selected, never forced, and the choice is remembered.
 */
export function PreferencesDialog() {
  const prefs = usePreferences();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("prefs");
  const reduce = useReducedMotion();
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const welcome = Boolean(prefs && !prefs.chosen);
  const open = Boolean(prefs && (prefs.dialogOpen || (welcome && !quiet(pathname))));

  const initial = useMemo(
    () =>
      prefs
        ? {
            locale: prefs.chosen ? prefs.locale : prefs.suggested.locale,
            country: prefs.chosen ? prefs.country : (prefs.suggested.country ?? prefs.country),
            currency: prefs.chosen ? prefs.currency : prefs.suggested.currency,
          }
        : { locale: "en", country: "NG", currency: "NGN" },
    [prefs],
  );
  const [locale, setLocale] = useState(initial.locale);
  const [country, setCountry] = useState(initial.country);
  const [currency, setCurrency] = useState(initial.currency);
  const [query, setQuery] = useState("");
  const [lastInitial, setLastInitial] = useState(initial);
  if (lastInitial !== initial) {
    setLastInitial(initial);
    setLocale(initial.locale);
    setCountry(initial.country);
    setCurrency(initial.currency);
  }

  useEffect(() => {
    const onOpen = () => prefs?.openDialog();
    window.addEventListener(OPEN_PREFS_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_PREFS_EVENT, onOpen);
  }, [prefs]);

  const submit = () => {
    setError(null);
    start(async () => {
      const r = await savePreferences({ locale, country, currency });
      if (!r.ok) {
        setError(t("saveError"));
        return;
      }
      setNotice(r.ships ? null : t("noDelivery", { country: regionName(country, locale) }));
      prefs?.closeDialog();
      // Soft refresh: re-renders the page in the new language/currency; the bag is kept.
      router.refresh();
    });
  };

  // Closing the welcome screen keeps the suggested settings, so nobody is forced to choose.
  const close = () => (welcome ? submit() : prefs?.closeDialog());
  useDialog(open, close, panel);

  const displayLocale = locale;
  const countries = useMemo(() => {
    if (!prefs) return [];
    const named = prefs.countries.map((c) => ({ ...c, label: regionName(c.code, displayLocale) }));
    const q = query.trim().toLowerCase();
    const filtered = q ? named.filter((c) => c.label.toLowerCase().includes(q) || c.code.toLowerCase() === q || c.name.toLowerCase().includes(q)) : named;
    return filtered.sort((a, b) => Number(b.code === "NG") - Number(a.code === "NG") || Number(b.ships) - Number(a.ships) || a.label.localeCompare(b.label, displayLocale));
  }, [prefs, query, displayLocale]);

  if (!prefs) return null;
  const selectedCountry = prefs.countries.find((c) => c.code === country);
  const shipsHere = selectedCountry?.ships ?? false;

  return (
    <>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6">
            <m.div className="absolute inset-0 bg-plum/55 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} aria-hidden />
            <m.div
              ref={panel}
              role="dialog"
              aria-modal="true"
              aria-labelledby={`${id}-title`}
              tabIndex={-1}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 40, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: 30, scale: 0.97 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="relative flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-[2rem] bg-white shadow-2xl outline-none sm:max-w-xl sm:rounded-[2rem] sm:rounded-tr-[5rem]"
            >
              <div className="relative overflow-hidden bg-gradient-to-br from-plum via-[#4a2140] to-rose-deep px-6 pb-6 pt-7 text-white sm:px-8">
                <div className="pointer-events-none absolute -right-10 -top-10 size-44 rounded-full bg-rose/30 blur-2xl" aria-hidden />
                <button type="button" onClick={close} className="absolute right-4 top-4 grid size-9 place-items-center rounded-full text-white/80 hover:bg-white/10" aria-label={welcome ? t("skip") : t("close")}>
                  <X className="size-5" />
                </button>
                <div className="relative flex items-center gap-4">
                  {welcome ? <DripBaby variant="head" character="guy" className="size-14 shrink-0" /> : <Globe2 className="size-8 shrink-0 text-rose-light" aria-hidden />}
                  <div>
                    <h2 id={`${id}-title`} className="font-display text-3xl leading-tight">{welcome ? t("welcomeTitle") : t("title")}</h2>
                    <p className="mt-1 text-sm text-white/80">{welcome ? t("welcomeBody") : t("body")}</p>
                  </div>
                </div>
              </div>

              <form
                className="flex min-h-0 flex-1 flex-col"
                onSubmit={(e) => {
                  e.preventDefault();
                  submit();
                }}
              >
                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-6 sm:px-8">
                  <label className="block">
                    <span className="text-sm font-semibold">{t("language")}</span>
                    <select value={locale} onChange={(e) => setLocale(e.target.value)} className="field mt-1.5 !py-2.5 !text-sm" lang={locale}>
                      {LOCALES.filter((l) => prefs.enabledLocales.includes(l.code)).map((l) => (
                        <option key={l.code} value={l.code} lang={l.code}>
                          {l.native}{l.native !== l.name ? ` — ${l.name}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div>
                    <span id={`${id}-country`} className="text-sm font-semibold">{t("country")}</span>
                    <div className="mt-1.5 rounded-2xl border border-line">
                      <label className="flex items-center gap-2 border-b border-line px-3">
                        <Search className="size-4 text-muted" aria-hidden />
                        <span className="sr-only">{t("searchCountry")}</span>
                        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("searchCountry")} className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none" />
                      </label>
                      <ul role="radiogroup" aria-labelledby={`${id}-country`} className="max-h-44 overflow-y-auto p-1.5">
                        {countries.slice(0, 260).map((c) => (
                          <li key={c.code}>
                            <label className={cn("flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-rose-deep", country === c.code ? "bg-pale font-semibold text-rose-deep" : "hover:bg-blush")}>
                              <span className="flex items-center gap-2">
                                <input type="radio" name="country" value={c.code} checked={country === c.code} onChange={() => setCountry(c.code)} className="sr-only" />
                                <span aria-hidden>{flag(c.code)}</span>
                                {/* The server and the browser can spell a few country names differently. */}
                                <span suppressHydrationWarning>{c.label}</span>
                              </span>
                              <span className="flex items-center gap-2 text-[0.65rem] font-normal text-muted">
                                {c.ships ? t("delivers") : t("browseOnly")}
                                {country === c.code && <Check className="size-4 text-rose-deep" aria-hidden />}
                              </span>
                            </label>
                          </li>
                        ))}
                        {countries.length === 0 && <li className="px-3 py-2 text-sm text-muted">{t("noMatch")}</li>}
                      </ul>
                    </div>
                    {selectedCountry && !shipsHere && (
                      <p className="mt-2 rounded-xl bg-[#fff8e8] px-3 py-2 text-xs text-[#6b4a00]" role="status">{t("noDelivery", { country: regionName(country, locale) })}</p>
                    )}
                    {!prefs.chosen && prefs.suggested.country && <p className="mt-1.5 text-[0.7rem] text-muted">{t("suggestedNote")}</p>}
                  </div>

                  <label className="block">
                    <span className="text-sm font-semibold">{t("currency")}</span>
                    <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="field mt-1.5 !py-2.5 !text-sm">
                      {prefs.currencies.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code} {c.symbol} — {currencyName(c.code, locale, c.name)}
                          {c.code !== "NGN" && !prefs.rates.rates[c.code] ? ` (${t("rateUnavailable")})` : ""}
                        </option>
                      ))}
                    </select>
                    <span className="mt-1.5 block text-[0.7rem] leading-snug text-muted">{t("currencyNote", { charge: prefs.chargeCurrency })}</span>
                  </label>
                  {error && <p className="text-sm text-danger" role="alert">{error}</p>}
                </div>
                <div className="border-t border-line bg-neutral/60 px-6 py-4 sm:px-8">
                  <button type="submit" disabled={pending} className="flex h-12 w-full items-center justify-center rounded-full bg-plum text-xs font-bold uppercase tracking-[0.16em] text-white transition hover:bg-rose-deep disabled:opacity-60">
                    {pending ? t("saving") : welcome ? t("continueShopping") : t("save")}
                  </button>
                  <p className="mt-2 text-center text-[0.68rem] text-muted">{t("changeLater")}</p>
                </div>
              </form>
            </m.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {notice && (
          <m.div
            role="status"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed inset-x-3 top-3 z-[81] mx-auto flex max-w-md items-start gap-3 rounded-2xl border border-[#f0d9a8] bg-[#fff8e8] p-4 text-sm text-[#6b4a00] shadow-lg"
          >
            <p className="flex-1">{notice}</p>
            <button type="button" onClick={() => setNotice(null)} aria-label={t("close")} className="-m-1 p-1"><X className="size-4" /></button>
          </m.div>
        )}
      </AnimatePresence>
    </>
  );
}

/** Emoji flag from a country code (purely decorative). */
export function flag(code: string): string {
  return /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : "";
}
