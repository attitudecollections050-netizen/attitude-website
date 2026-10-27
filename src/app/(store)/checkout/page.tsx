import type { Metadata } from "next";
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

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="container-luxe py-16">
        <SetupNotice what="Checkout" />
      </div>
    );
  }
  const [user, settings, countries] = await Promise.all([getCurrentUser(), getSettings(), listEnabledCountries()]);
  const regions = await listRegionsByCountry(countries.map((c) => c.code));

  if (!user && !settings.checkout.guest_checkout_enabled) {
    return (
      <div className="container-luxe flex flex-col items-center gap-5 py-24 text-center">
        <h1 className="display text-5xl">Sign in to check out</h1>
        <p className="text-sm text-muted">Please sign in or create an account to complete your order.</p>
        <div className="flex gap-3">
          <Link href="/account/login?next=/checkout" className={buttonClasses("primary")}>Sign in</Link>
          <Link href="/account/register?next=/checkout" className={buttonClasses("outline")}>Create account</Link>
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
      <h1 className="display text-5xl sm:text-6xl">Checkout</h1>
      {!isPaystackConfigured() && (
        <Notice tone="warning" title="Payments not configured" className="mt-6">
          Paystack keys are missing, so orders cannot be paid yet. Add <code>PAYSTACK_SECRET_KEY</code> to the server environment.
        </Notice>
      )}
      {paystackMode() === "test" && (
        <Notice tone="info" title="Test mode" className="mt-6">
          Payments are running in Paystack test mode — no real money will be charged.
        </Notice>
      )}
      {countries.length === 0 && (
        <Notice tone="error" className="mt-6" title="Delivery not available">
          No delivery destinations are enabled yet. Please contact us.
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
        />
      </div>
    </div>
  );
}
