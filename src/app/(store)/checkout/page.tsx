import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { getPreferences } from "@/lib/intl/preferences";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { isPaystackConfigured, isSupabaseConfigured, paystackMode } from "@/lib/env";
import { listEnabledCountries, listRegionsByCountry } from "@/lib/shipping/service";
import { createClient } from "@/lib/supabase/server";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { Notice } from "@/components/ui/Notice";
import { SetupNotice } from "@/components/ui/SetupNotice";
import { buttonClasses } from "@/components/ui/Button";
import { TrackCheckoutStart } from "@/components/analytics/AnalyticsTracker";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("checkout"))("title"), robots: { index: false } };
}

export default async function CheckoutPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="container-luxe py-16">
        <SetupNotice what="Checkout" />
      </div>
    );
  }
  const [user, settings, countries, t, prefs, locale] = await Promise.all([getCurrentUser(), getSettings(), listEnabledCountries(), getTranslations("checkout"), getPreferences(), getLocale()]);
  const prefCountryShips = countries.some((c) => c.code === prefs.country);
  const prefCountryName = (() => {
    try {
      return new Intl.DisplayNames([locale], { type: "region" }).of(prefs.country) ?? prefs.country;
    } catch {
      return prefs.country;
    }
  })();
  const regions = await listRegionsByCountry(countries.map((c) => c.code));

  if (!user && !settings.checkout.guest_checkout_enabled) {
    return (
      <div className="container-luxe flex flex-col items-center gap-5 py-24 text-center">
        <h1 className="display text-5xl">{t("signInTitle")}</h1>
        <p className="text-sm text-muted">{t("signInBody")}</p>
        <div className="flex gap-3">
          <Link href="/account/login?next=/checkout" className={buttonClasses("primary")}>{t("signIn")}</Link>
          <Link href="/account/register?next=/checkout" className={buttonClasses("outline")}>{t("createAccount")}</Link>
        </div>
      </div>
    );
  }

  let saved: Parameters<typeof CheckoutForm>[0]["savedAddresses"] = [];
  if (user) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("addresses")
      .select("id, label, full_name, phone, country_code, region, city, line1, line2, postal_code")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    saved = data ?? [];
  }

  return (
    <div className="container-luxe pb-24 pt-12">
      <TrackCheckoutStart />
      <h1 className="display text-5xl sm:text-6xl">{t("title")}</h1>
      {!isPaystackConfigured() && (
        <Notice tone="warning" title={t("notConfiguredTitle")} className="mt-6">
          {t("notConfigured")}
        </Notice>
      )}
      {paystackMode() === "test" && (
        <Notice tone="info" title={t("testMode")} className="mt-6">
          {t("testModeBody")}
        </Notice>
      )}
      {countries.length === 0 && (
        <Notice tone="error" className="mt-6" title={t("noDestinationsTitle")}>
          {t("noDestinations")}
        </Notice>
      )}
      {countries.length > 0 && !prefCountryShips && (
        <Notice tone="warning" className="mt-6">
          {t("noDeliveryCountry", { country: prefCountryName })}
        </Notice>
      )}
      <div className="mt-10">
        <CheckoutForm
          countries={countries}
          regions={regions}
          savedAddresses={saved}
          defaultEmail={user?.email ?? ""}
          signedIn={Boolean(user)}
          tax={settings.tax}
          dutiesNotice={settings.tax.duties_notice}
          preferredCountry={prefs.country}
        />
      </div>
    </div>
  );
}
