import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { listEnabledCountries, listRegionsByCountry } from "@/lib/shipping/service";
import { deleteAddress } from "@/app/actions/auth";
import { AddressForm } from "@/components/account/AddressForm";

export const metadata: Metadata = { title: "Saved addresses", robots: { index: false } };

export default async function AddressesPage() {
  const supabase = await createClient();
  const [{ data: addresses }, countries] = await Promise.all([
    supabase.from("addresses").select("*").order("is_default", { ascending: false }).order("created_at", { ascending: false }),
    listEnabledCountries(),
  ]);
  const regions = await listRegionsByCountry(countries.map((c) => c.code));
  const regionName = (cc: string, code: string) => regions[cc]?.find((r) => r.code === code)?.name ?? code;
  return (
    <div className="space-y-12">
      <section>
        <h2 className="font-display text-3xl">Saved addresses</h2>
        {!addresses?.length ? (
          <p className="mt-4 text-sm text-muted">No saved addresses yet.</p>
        ) : (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {addresses.map((a) => (
              <li key={a.id} className="border border-line p-5 text-sm">
                <p className="font-semibold">{a.label ?? "Address"} {a.is_default && <span className="ml-2 bg-pale px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.15em] text-rose-deep">Default</span>}</p>
                <address className="mt-2 not-italic leading-relaxed text-plum-soft">
                  {a.full_name}<br />{a.line1}{a.line2 && <><br />{a.line2}</>}<br />{a.city}{a.region ? `, ${regionName(a.country_code, a.region)}` : ""} {a.postal_code}<br />{a.country_code} · {a.phone}
                </address>
                <form action={deleteAddress} className="mt-3">
                  <input type="hidden" name="id" value={a.id} />
                  <button type="submit" className="text-xs underline underline-offset-4 hover:text-danger">Remove</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2 className="font-display text-3xl">Add an address</h2>
        <div className="mt-6 max-w-2xl"><AddressForm countries={countries} regions={regions} /></div>
      </section>
    </div>
  );
}
