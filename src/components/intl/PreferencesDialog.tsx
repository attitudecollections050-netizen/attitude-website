"use client";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { Check, ChevronDown, Globe2, Search, Volume2, X } from "lucide-react";
import { savePreferences } from "@/app/actions/preferences";
import { LOCALES } from "@/lib/intl/config";
import { DripBaby } from "@/components/assistant/DripBaby";
import { canSpeak, speak, stopSpeaking } from "@/components/assistant/voice";
import { playChime } from "@/components/assistant/chime";
import { useDialog } from "@/components/ui/useDialog";
import { cn } from "@/lib/cn";
import { OPEN_PREFS_EVENT, usePreferences } from "./PreferencesProvider";

// What Haru and Jin say on the welcome screen (they always speak English).
const WELCOME_BOTH = "Welcome to Attitude Collections! 💖 We appreciate you! You make our drip special!";
const WELCOME_HARU = "Hi cutie! I'm HARU, thanks for visiting Attitude Collections. We appreciate your love. What language do you prefer? English? We're here to make you slay!";
const WELCOME_JIN = "Yo, welcome! I'm JIN, thanks for checking us out. Choose your language and let's find your perfect fit!";
/** The three languages shown as big buttons; the rest stay in "More languages". */
const FEATURED = ["en", "ko", "fr"];
const noSubscribe = () => () => {};

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
  const [talker, setTalker] = useState<"haru" | "jin" | null>(null);
  // Only known in the browser, so the server and first client render agree (no hydration mismatch).
  const speechOk = useSyncExternalStore(noSubscribe, canSpeak, () => false);
  const spoken = useRef(false);
  // Haru, then Jin, read their welcome aloud (browsers allow it after the first tap).
  const greet = () => {
    if (spoken.current || !canSpeak()) return;
    spoken.current = true;
    speak(WELCOME_HARU, { onStart: () => setTalker("haru"), onEnd: () => speak(WELCOME_JIN, { onStart: () => setTalker("jin"), onEnd: () => setTalker(null) }, "jin") }, "haru");
  };
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
    if (welcome) {
      stopSpeaking();
      playChime();
    }
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
  const canSpeakNow = speechOk;
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
              {welcome ? (
                <div className="relative overflow-hidden bg-[radial-gradient(circle_at_50%_80%,#FFF0F7_0%,#FFB6D9_45%,#E94E8A_100%)] px-5 pb-4 pt-5 text-plum sm:px-8" onPointerDownCapture={greet} data-testid="mascot-welcome">
                  <button type="button" onClick={close} className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-full text-plum/70 hover:bg-white/40" aria-label={t("skip")}>
                    <X className="size-5" />
                  </button>
                  <h2 id={`${id}-title`} className="sr-only">{t("welcomeTitle")}</h2>
                  <m.p
                    initial={{ opacity: 0, y: -8, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: 0.2 }}
                    className="relative mx-auto max-w-sm rounded-2xl border-2 border-white bg-white/90 px-4 py-2 text-center text-sm font-extrabold text-[#C2185B] shadow-lg"
                  >
                    {WELCOME_BOTH}
                  </m.p>
                  <div className="relative mt-2 flex items-end justify-center gap-2">
                    <div className="flex w-1/2 flex-col items-center">
                      <m.p initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 }} className={cn("mb-1 rounded-2xl rounded-br-sm bg-white px-3 py-2 text-[0.68rem] font-semibold leading-snug text-plum shadow", talker === "haru" && "ring-2 ring-[#FFB6D9]")}>
                        {WELCOME_HARU}
                      </m.p>
                      <DripBaby character="haru" action="wave" playKey={talker === "haru" ? 1 : 0} talking={talker === "haru"} className="h-36 w-24 sm:h-44 sm:w-28" />
                      <p className="mt-1 text-[0.62rem] font-extrabold tracking-wide text-plum">DJ ATTITUDE mini HARU 💖</p>
                    </div>
                    <div className="flex w-1/2 flex-col items-center">
                      <m.p initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1 }} className={cn("mb-1 rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-[0.68rem] font-semibold leading-snug text-plum shadow", talker === "jin" && "ring-2 ring-[#E94E8A]")}>
                        {WELCOME_JIN}
                      </m.p>
                      <DripBaby character="jin" action="wave" playKey={talker === "jin" ? 1 : 0} talking={talker === "jin"} className="h-36 w-24 sm:h-44 sm:w-28" />
                      <p className="mt-1 text-[0.62rem] font-extrabold tracking-wide text-white drop-shadow">DJ ATTITUDE mini JIN</p>
                    </div>
                  </div>
                  {canSpeakNow && (
                    <button type="button" onClick={greet} className="relative mx-auto mt-2 flex items-center gap-1 rounded-full bg-white/85 px-3 py-1 text-[0.65rem] font-bold text-[#C2185B] shadow" data-testid="hear-mascots">
                      <Volume2 className="size-3" aria-hidden /> {t("hearUs")}
                    </button>
                  )}
                </div>
              ) : (
                <div className="relative overflow-hidden bg-gradient-to-br from-plum via-[#4a2140] to-rose-deep px-6 pb-6 pt-7 text-white sm:px-8">
                  <div className="pointer-events-none absolute -right-10 -top-10 size-44 rounded-full bg-rose/30 blur-2xl" aria-hidden />
                  <button type="button" onClick={close} className="absolute right-4 top-4 grid size-9 place-items-center rounded-full text-white/80 hover:bg-white/10" aria-label={t("close")}>
                    <X className="size-5" />
                  </button>
                  <div className="relative flex items-center gap-4">
                    <Globe2 className="size-8 shrink-0 text-rose-light" aria-hidden />
                    <div>
                      <h2 id={`${id}-title`} className="font-display text-3xl leading-tight">{t("title")}</h2>
                      <p className="mt-1 text-sm text-white/80">{t("body")}</p>
                    </div>
                  </div>
                </div>
              )}

              <form
                className="flex min-h-0 flex-1 flex-col"
                onSubmit={(e) => {
                  e.preventDefault();
                  submit();
                }}
              >
                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-6 sm:px-8">
                  {welcome && (
                    <div role="radiogroup" aria-label={t("language")}>
                      <span className="text-sm font-semibold">{t("whichLanguage")}</span>
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        {LOCALES.filter((l) => FEATURED.includes(l.code) && prefs.enabledLocales.includes(l.code)).map((l) => (
                          <button
                            key={l.code}
                            type="button"
                            role="radio"
                            aria-checked={locale === l.code}
                            onClick={() => setLocale(l.code)}
                            lang={l.code}
                            className={cn(
                              "rounded-2xl border-2 px-2 py-2.5 text-sm font-bold transition",
                              locale === l.code ? "border-[#E94E8A] bg-[#FFE3F1] text-[#C2185B] shadow-[0_0_0_3px_rgba(255,182,217,0.6)]" : "border-line hover:border-[#FFB6D9]",
                            )}
                            data-testid={`lang-${l.code}`}
                          >
                            {l.native}
                            {l.code === "en" && <span className="block text-[0.6rem] font-semibold text-muted">{t("default")}</span>}
                          </button>
                        ))}
                      </div>
                      <p className="mt-1.5 text-[0.68rem] leading-snug text-muted">{t("mascotsEnglish")}</p>
                    </div>
                  )}
                  <label className="block">
                    <span className="text-sm font-semibold">{welcome ? t("moreLanguages") : t("language")}</span>
                    <select value={locale} onChange={(e) => setLocale(e.target.value)} className="field mt-1.5 !py-2.5 !text-sm" lang={locale}>
                      {LOCALES.filter((l) => prefs.enabledLocales.includes(l.code)).map((l) => (
                        <option key={l.code} value={l.code} lang={l.code}>
                          {l.native}{l.native !== l.name ? ` — ${l.name}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>

                  <details open={!welcome} className="group rounded-2xl [&>summary::-webkit-details-marker]:hidden">
                    <summary className={cn("flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold", !welcome && "hidden")}>
                      <span>
                        {t("deliveryAndCurrency")} <span className="font-normal text-muted">· {flag(country)} <span suppressHydrationWarning>{regionName(country, locale)}</span> · {currency}</span>
                      </span>
                      <ChevronDown className="size-4 transition group-open:rotate-180" aria-hidden />
                    </summary>
                    <div className="space-y-5 pt-3">
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
                    </div>
                  </details>
                  {error && <p className="text-sm text-danger" role="alert">{error}</p>}
                </div>
                <div className="border-t border-line bg-neutral/60 px-6 py-4 sm:px-8">
                  <button
                    type="submit"
                    disabled={pending}
                    className={cn(
                      "flex h-12 w-full items-center justify-center rounded-full text-xs font-bold uppercase tracking-[0.16em] text-white transition disabled:opacity-60",
                      welcome ? "bg-gradient-to-r from-[#FF8CC6] via-[#E94E8A] to-[#C2185B] shadow-[0_10px_24px_-10px_rgba(233,78,138,0.9)] hover:brightness-110" : "bg-plum hover:bg-rose-deep",
                    )}
                    data-testid="prefs-submit"
                  >
                    {pending ? t("saving") : welcome ? t("startShopping") : t("save")}
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
