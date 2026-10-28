import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getLocale, getTranslations } from "next-intl/server";
import { listEnabledCountries, listRegionsByCountry } from "@/lib/shipping/service";
import { deleteAddress } from "@/app/actions/auth";
import { AddressForm } from "@/components/account/AddressForm";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("account"))("savedAddresses"), robots: { index: false } };
}

export default async function AddressesPage() {
  const supabase = await createClient();
  const [t, locale] = await Promise.all([getTranslations("account"), getLocale()]);
  const countryName = (cc: string) => {
    try {
      return new Intl.DisplayNames([locale], { type: "region" }).of(cc) ?? cc;
    } catch {
      return cc;
    }
  };
  const [{ data: addresses }, countries] = await Promise.all([
    supabase.from("addresses").select("*").order("is_default", { ascending: false }).order("created_at", { ascending: false }),
    listEnabledCountries(),
  ]);
  const regions = await listRegionsByCountry(countries.map((c) => c.code));
  const regionName = (cc: string, code: string) => regions[cc]?.find((r) => r.code === code)?.name ?? code;
  return (
    <div className="space-y-12">
      <section>
        <h2 className="font-display text-3xl">{t("savedAddresses")}</h2>
        {!addresses?.length ? (
          <p className="mt-4 text-sm text-muted">{t("noAddresses")}</p>
        ) : (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {addresses.map((a) => (
              <li key={a.id} className="border border-line p-5 text-sm">
                <p className="font-semibold">{a.label ?? t("address")} {a.is_default && <span className="ml-2 bg-pale px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.15em] text-rose-deep">{t("default")}</span>}</p>
                <address className="mt-2 not-italic leading-relaxed text-plum-soft">
                  {a.full_name}<br />{a.line1}{a.line2 && <><br />{a.line2}</>}<br />{a.city}{a.region ? `, ${regionName(a.country_code, a.region)}` : ""} {a.postal_code}<br />{countryName(a.country_code)} · {a.phone}
                </address>
                <form action={deleteAddress} className="mt-3">
                  <input type="hidden" name="id" value={a.id} />
                  <button type="submit" className="text-xs underline underline-offset-4 hover:text-danger">{t("remove")}</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2 className="font-display text-3xl">{t("addAddress")}</h2>
        <div className="mt-6 max-w-2xl"><AddressForm countries={countries} regions={regions} /></div>
      </section>
    </div>
  );
}
