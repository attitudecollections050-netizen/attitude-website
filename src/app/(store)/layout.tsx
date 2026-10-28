import { after } from "next/server";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { getCategoryTree } from "@/lib/catalog/queries";
import { getPreferences } from "@/lib/intl/preferences";
import { enabledCurrencies, getDisplayRates, maybeRefreshRates } from "@/lib/currency/rates";
import { createPublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import { PreferencesProvider, type PreferencesValue } from "@/components/intl/PreferencesProvider";
import { PreferencesDialog } from "@/components/intl/PreferencesDialog";
import { getSettings } from "@/lib/settings";
import { getCartView } from "@/lib/cart/server";
import { getCurrentUser } from "@/lib/auth";
import { MotionProvider } from "@/components/ui/MotionProvider";
import { CartProvider } from "@/components/cart/CartProvider";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { CartToast } from "@/components/cart/CartToast";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { AnalyticsTracker } from "@/components/analytics/AnalyticsTracker";
import { CookieConsent } from "@/components/analytics/CookieConsent";
import { FeedbackInvite } from "@/components/feedback/FeedbackInvite";
import { AssistantWidget } from "@/components/assistant/AssistantWidget";

// Cart, session and stock are per-request: never prerender these routes.
export const dynamic = "force-dynamic";

export default async function StoreLayout({ children }: LayoutProps<"/">) {
  const [categories, settings, cart, user, prefs, messages, currencies, rates, countries] = await Promise.all([
    getCategoryTree(),
    getSettings(),
    getCartView(),
    getCurrentUser(),
    getPreferences(),
    getMessages(),
    enabledCurrencies(),
    getDisplayRates(),
    isSupabaseConfigured()
      ? createPublicClient().from("countries").select("code, name, is_enabled").order("name").then((r) => r.data ?? [])
      : Promise.resolve([{ code: "NG", name: "Nigeria", is_enabled: true }]),
  ]);
  const t = await getTranslations("store");
  // Keeps exchange rates fresh without slowing the page (throttled; see lib/currency/rates).
  after(maybeRefreshRates);
  const intl: PreferencesValue = {
    locale: prefs.locale,
    country: prefs.country,
    currency: prefs.currency,
    chosen: prefs.chosen,
    suggested: prefs.suggested,
    enabledLocales: prefs.enabledLocales,
    currencies: (currencies.length ? currencies : [{ code: "NGN", symbol: "₦", name: "Nigerian naira" }]).map((c) => ({ code: c.code, symbol: c.symbol, name: c.name })),
    countries: countries.map((c) => ({ code: c.code, name: c.name, ships: c.is_enabled })),
    rates,
    chargeCurrency: settings.intl.payment_currencies[0] ?? "NGN",
  };
  return (
    <NextIntlClientProvider locale={prefs.locale} messages={messages} timeZone="Africa/Lagos">
    <PreferencesProvider value={intl}>
    <MotionProvider>
      <CartProvider initialCart={cart}>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-white focus:px-4 focus:py-2">
          {t("skip")}
        </a>
        {settings.announcement.enabled && <AnnouncementBar text={announcementText(settings.announcement.text, t)} href={settings.announcement.href} />}
        <Header categories={categories} signedIn={Boolean(user)} />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer categories={categories} settings={settings} />
        <CartDrawer />
        <CartToast />
        <AnalyticsTracker />
        <CookieConsent />
        <FeedbackInvite />
        <AssistantWidget />
        <PreferencesDialog />
      </CartProvider>
    </MotionProvider>
    </PreferencesProvider>
    </NextIntlClientProvider>
  );
}

/**
 * The announcement is written in Admin → Homepage (English). A translation saved in
 * Admin → International (key "store.announcement") wins; the shipped default offer
 * text has built-in translations; anything else is shown as written.
 */
function announcementText(text: string, t: Awaited<ReturnType<typeof getTranslations<"store">>>): string {
  const custom = t("announcement").trim();
  if (custom) return custom;
  const norm = (v: string) => v.replace(/\s+/g, " ").trim().toLowerCase();
  return norm(text) === norm(DEFAULT_ANNOUNCEMENT) ? t("announcementDefault") : text;
}
const DEFAULT_ANNOUNCEMENT = "10% OFF ORDERS OF ₦200,000+ | FREE DELIVERY ON ORDERS OF ₦200,000+";
