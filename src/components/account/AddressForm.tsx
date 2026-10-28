"use client";
import { keepValues } from "@/components/ui/keepForm";
import { useActionState, useEffect, useRef, useState } from "react";
import { saveAddress, type AuthState } from "@/app/actions/auth";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import type { CountryOption } from "@/components/checkout/CheckoutForm";
import { useLocale, useTranslations } from "next-intl";
import { regionName } from "@/components/intl/PreferencesDialog";
import { useShippingText } from "@/components/intl/useShippingText";

export function AddressForm({ countries, regions }: { countries: CountryOption[]; regions: Record<string, { code: string; name: string }[]> }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(saveAddress, null);
  const t = useTranslations("account");
  const tc = useTranslations("checkout");
  const locale = useLocale();
  const ship = useShippingText();
  const [country, setCountry] = useState(countries[0]?.code ?? "NG");
  const c = countries.find((x) => x.code === country);
  const list = regions[country] ?? [];
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);
  const err = (k: string) => state?.errors?.[k] && <span className="mt-1 block text-xs text-danger">{state.errors[k]}</span>;
  return (
    <form ref={formRef} action={action} onSubmit={keepValues(action)} className="grid gap-4 sm:grid-cols-2">
      {state && <Notice tone={state.ok ? "success" : "error"} className="sm:col-span-2">{state.message}</Notice>}
      <label className="text-sm">{t("label")} <span className="text-muted">{t("labelHint")}</span><input name="label" className="field mt-1.5" maxLength={40} /></label>
      <label className="text-sm">
        {tc("country")}
        <select name="country_code" className="field mt-1.5" value={country} onChange={(e) => setCountry(e.target.value)}>
          {countries.map((x) => <option key={x.code} value={x.code}>{regionName(x.code, locale)}</option>)}
        </select>
      </label>
      <label className="text-sm">{tc("fullName")}<input name="full_name" required className="field mt-1.5" />{err("full_name")}</label>
      <label className="text-sm">{tc("phone")}<input name="phone" type="tel" required className="field mt-1.5" />{err("phone")}</label>
      <label className="text-sm sm:col-span-2">{tc("street")}<input name="line1" required className="field mt-1.5" />{err("line1")}</label>
      <label className="text-sm sm:col-span-2">{tc("line2")} <span className="text-muted">({tc("optional")})</span><input name="line2" className="field mt-1.5" /></label>
      <label className="text-sm">{tc("city")}<input name="city" required className="field mt-1.5" />{err("city")}</label>
      <label className="text-sm">
        {ship.label(c?.region_label ?? "Region")}
        {list.length ? (
          <select name="region" className="field mt-1.5" required defaultValue="">
            <option value="">{tc("select")}</option>
            {list.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
          </select>
        ) : (
          <input name="region" className="field mt-1.5" />
        )}
      </label>
      <label className="text-sm">{ship.label(c?.postal_label ?? "Postal code")}<input name="postal_code" className="field mt-1.5" /></label>
      <label className="flex items-center gap-3 self-end text-sm"><input type="checkbox" name="is_default" className="size-4 accent-[#d94f91]" /> {t("setDefault")}</label>
      <div className="sm:col-span-2"><Button type="submit" loading={pending} disabled={pending}>{t("saveAddress")}</Button></div>
    </form>
  );
}
