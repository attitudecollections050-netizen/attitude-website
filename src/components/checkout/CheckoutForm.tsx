"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AnimatePresence, m } from "motion/react";
import { Lock, Truck, Info } from "lucide-react";
import { useCart } from "@/components/cart/CartProvider";
import { DiscountForm } from "@/components/cart/DiscountForm";
import { quoteCartShipping } from "@/app/actions/shipping";
import { placeOrder } from "@/app/actions/checkout";
import { computeTotals, type TaxConfig } from "@/lib/pricing";
import type { ShippingQuote } from "@/lib/shipping/calculator";
import { useLocale, useTranslations } from "next-intl";
import { useMoney } from "@/components/intl/PreferencesProvider";
import { useShippingText } from "@/components/intl/useShippingText";
import { useCartText } from "@/components/intl/useCartText";
import { useDiscountLabel } from "@/components/intl/useDiscountLabel";
import { regionName } from "@/components/intl/PreferencesDialog";
import { SmartImage } from "@/components/ui/SmartImage";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { cn } from "@/lib/cn";

export interface CountryOption {
  code: string;
  name: string;
  region_label: string;
  region_required: boolean;
  postal_label: string;
  postal_required: boolean;
}

export interface SavedAddress {
  id: string;
  label: string | null;
  full_name: string;
  phone: string;
  country_code: string;
  region: string;
  city: string;
  line1: string;
  line2: string | null;
  postal_code: string | null;
}

function FieldError({ errors, name }: { errors: Record<string, string>; name: string }) {
  // aria-hidden keeps the message out of the label's accessible name; aria-describedby still announces it.
  return errors[name] ? <p id={`${name}-err`} aria-hidden="true" className="mt-1 text-xs text-danger">{errors[name]}</p> : null;
}

type Address = { full_name: string; phone: string; country_code: string; region: string; city: string; line1: string; line2: string; postal_code: string };

export function CheckoutForm({
  countries,
  regions,
  savedAddresses,
  defaultEmail,
  signedIn,
  tax,
  dutiesNotice,
  storeCountry = "NG",
  preferredCountry,
  paymentMethod = "paystack",
}: {
  countries: CountryOption[];
  regions: Record<string, { code: string; name: string }[]>;
  savedAddresses: SavedAddress[];
  defaultEmail: string;
  signedIn: boolean;
  tax: TaxConfig;
  dutiesNotice: string;
  storeCountry?: string;
  /** The country the shopper chose in their preferences (used as the default when we deliver there). */
  preferredCountry?: string;
  /** "bank_transfer": the next step shows our bank details instead of Paystack. */
  paymentMethod?: "paystack" | "bank_transfer";
}) {
  const { cart } = useCart();
  const t = useTranslations("checkout");
  const tc = useTranslations("cart");
  const locale = useLocale();
  const money = useMoney();
  const formatMoney = money.format;
  const st = useShippingText();
  const ct = useCartText();
  const discountLabel = useDiscountLabel();
  const countryLabel = (code: string) => regionName(code, locale);
  const [nonce] = useState(() => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random()).slice(2).padEnd(20, "0")));
  const first = savedAddresses.find((a) => countries.some((c) => c.code === a.country_code));
  const [email, setEmail] = useState(defaultEmail);
  const [address, setAddress] = useState<Address>(() =>
    first
      ? { full_name: first.full_name, phone: first.phone, country_code: first.country_code, region: first.region, city: first.city, line1: first.line1, line2: first.line2 ?? "", postal_code: first.postal_code ?? "" }
      : { full_name: "", phone: "", country_code: countries.find((c) => c.code === preferredCountry)?.code ?? countries.find((c) => c.code === storeCountry)?.code ?? countries[0]?.code ?? "", region: "", city: "", line1: "", line2: "", postal_code: "" },
  );
  const [instructions, setInstructions] = useState("");
  const [saveAddress, setSaveAddress] = useState(false);
  const [quote, setQuote] = useState<ShippingQuote | null>(null);
  const [rateId, setRateId] = useState<string | null>(null);
  const [quoting, startQuote] = useTransition();
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const quoteSeq = useRef(0);

  const country = countries.find((c) => c.code === address.country_code);
  const countryRegions = regions[address.country_code] ?? [];
  const set = (k: keyof Address, v: string) => setAddress((a) => ({ ...a, [k]: v }));

  // Recalculate delivery whenever the destination or cart total changes (debounced).
  const destKey = `${address.country_code}|${address.region}|${address.city.trim().toLowerCase()}|${address.postal_code.trim()}|${cart.totalBeforeShipping}|${cart.itemCount}`;
  useEffect(() => {
    if (!address.country_code || !address.city.trim() || (countryRegions.length > 0 && !address.region)) {
      return;
    }
    const seq = ++quoteSeq.current;
    const t = setTimeout(() => {
      startQuote(async () => {
        const q = await quoteCartShipping({ country_code: address.country_code, region: address.region, city: address.city, postal_code: address.postal_code });
        if (seq !== quoteSeq.current) return;
        setQuote(q);
        setRateId((prev) => (q.ok ? (q.options.find((o) => o.rateId === prev)?.rateId ?? q.options[0].rateId) : null));
      });
    }, 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destKey]);

  const addressReady = Boolean(address.country_code && address.city.trim() && (countryRegions.length === 0 || address.region));
  const activeQuote = addressReady ? quote : null;
  const selected = activeQuote?.ok ? activeQuote.options.find((o) => o.rateId === rateId) ?? null : null;
  const totals = useMemo(
    () =>
      computeTotals({
        lines: cart.lines.map((l) => ({ unitPrice: l.unitPrice, quantity: l.quantity })),
        discount: cart.discount ? { ok: true, code: cart.discount.code, amount: cart.discount.amount, freeShipping: cart.discount.freeShipping, label: cart.discount.label } : null,
        shippingFee: selected?.fee ?? null,
        tax,
      }),
    [cart, selected, tax],
  );

  if (cart.lines.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="display text-4xl">{tc("empty")}</p>
        <Link href="/shop" className="mt-6 inline-block underline underline-offset-4">
          {tc("continueShopping")}
        </Link>
      </div>
    );
  }

  const international = address.country_code && address.country_code !== storeCountry;
  const canPay = cart.purchasable && Boolean(selected) && !quoting && !placing;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (placing) return;
    setError(null);
    setErrors({});
    if (!selected) {
      setError(activeQuote && !activeQuote.ok ? st.error(activeQuote) : t("completeAddress"));
      return;
    }
    setPlacing(true);
    const r = await placeOrder({ email, address, delivery_instructions: instructions, shipping_rate_id: selected.rateId, nonce, save_address: saveAddress });
    if (r.ok) {
      window.location.assign(r.redirectUrl);
      return; // keep the button disabled while redirecting
    }
    setPlacing(false);
    setError(r.error);
    if (r.fieldErrors) setErrors(r.fieldErrors);
  };

  const field = (name: string) => ({ "aria-invalid": Boolean(errors[name]) || undefined, "aria-describedby": errors[name] ? `${name}-err` : undefined });

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_26rem]">
      {/* The discount code has its own form in the summary, so the two forms are siblings, not nested. */}
      <form id="checkout-form" onSubmit={submit} className="space-y-10" noValidate>
        <section aria-labelledby="contact-h">
          <h2 id="contact-h" className="font-display text-3xl">
            {t("contact")}
          </h2>
          {!signedIn && (
            <p className="mt-2 text-sm text-muted">
              {t("haveAccount")}{" "}
              <Link href="/account/login?next=/checkout" className="underline underline-offset-4">
                {t("signIn")}
              </Link>
            </p>
          )}
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-sm sm:col-span-2">
              {t("email")}
              <input className="field mt-1.5" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} {...field("email")} />
              <FieldError errors={errors} name="email" />
            </label>
          </div>
        </section>

        <section aria-labelledby="delivery-h">
          <h2 id="delivery-h" className="font-display text-3xl">
            {t("deliveryAddress")}
          </h2>
          {savedAddresses.length > 0 && (
            <label className="mt-5 block text-sm">
              {t("savedAddresses")}
              <select
                className="field mt-1.5"
                defaultValue={first?.id}
                onChange={(e) => {
                  const a = savedAddresses.find((x) => x.id === e.target.value);
                  if (a) setAddress({ full_name: a.full_name, phone: a.phone, country_code: a.country_code, region: a.region, city: a.city, line1: a.line1, line2: a.line2 ?? "", postal_code: a.postal_code ?? "" });
                }}
              >
                {savedAddresses.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label ? `${a.label} — ` : ""}
                    {a.line1}, {a.city}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-sm sm:col-span-2">
              {t("country")}
              <select
                className="field mt-1.5"
                value={address.country_code}
                onChange={(e) => setAddress((a) => ({ ...a, country_code: e.target.value, region: "", postal_code: "" }))}
                autoComplete="country"
                {...field("address.country_code")}
              >
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {countryLabel(c.code)}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-muted">{t("countriesNote")}</span>
            </label>
            <label className="text-sm">
              {t("fullName")}
              <input className="field mt-1.5" autoComplete="name" value={address.full_name} onChange={(e) => set("full_name", e.target.value)} required {...field("address.full_name")} />
              <FieldError errors={errors} name="address.full_name" />
            </label>
            <label className="text-sm">
              {t("phone")}
              <input className="field mt-1.5" type="tel" autoComplete="tel" placeholder={address.country_code === "NG" ? "+234 801 234 5678" : "+44 20 7946 0000"} value={address.phone} onChange={(e) => set("phone", e.target.value)} required {...field("address.phone")} />
              <FieldError errors={errors} name="address.phone" />
            </label>
            <label className="text-sm sm:col-span-2">
              {t("street")}
              <input className="field mt-1.5" autoComplete="address-line1" value={address.line1} onChange={(e) => set("line1", e.target.value)} required {...field("address.line1")} />
              <FieldError errors={errors} name="address.line1" />
            </label>
            <label className="text-sm sm:col-span-2">
              {t("line2")} <span className="text-muted">({t("optional")})</span>
              <input className="field mt-1.5" autoComplete="address-line2" value={address.line2} onChange={(e) => set("line2", e.target.value)} />
            </label>
            <label className="text-sm">
              {t("city")}
              <input className="field mt-1.5" autoComplete="address-level2" value={address.city} onChange={(e) => set("city", e.target.value)} required {...field("address.city")} />
              <FieldError errors={errors} name="address.city" />
            </label>
            <label className="text-sm">
              {st.label(country?.region_label ?? "Region")} {!(country?.region_required || countryRegions.length) && <span className="text-muted">({t("optional")})</span>}
              {countryRegions.length > 0 ? (
                <select className="field mt-1.5" autoComplete="address-level1" value={address.region} onChange={(e) => set("region", e.target.value)} required {...field("address.region")}>
                  <option value="">{t("select")}</option>
                  {countryRegions.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input className="field mt-1.5" autoComplete="address-level1" value={address.region} onChange={(e) => set("region", e.target.value)} {...field("address.region")} />
              )}
              <FieldError errors={errors} name="address.region" />
            </label>
            <label className="text-sm">
              {st.label(country?.postal_label ?? "Postal code")} {!country?.postal_required && <span className="text-muted">({t("optional")})</span>}
              <input className="field mt-1.5" autoComplete="postal-code" value={address.postal_code} onChange={(e) => set("postal_code", e.target.value)} required={country?.postal_required} {...field("address.postal_code")} />
              <FieldError errors={errors} name="address.postal_code" />
            </label>
            <label className="text-sm sm:col-span-2">
              {t("instructions")} <span className="text-muted">({t("optional")})</span>
              <textarea className="field mt-1.5 min-h-20" maxLength={500} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder={t("instructionsPlaceholder")} />
            </label>
            {signedIn && (
              <label className="flex items-center gap-3 text-sm sm:col-span-2">
                <input type="checkbox" className="size-4 accent-[#d94f91]" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} />
                {t("saveAddress")}
              </label>
            )}
          </div>
        </section>

        <section aria-labelledby="shipping-h" aria-busy={quoting}>
          <h2 id="shipping-h" className="font-display text-3xl">
            {t("deliveryMethod")}
          </h2>
          <div className="mt-5" aria-live="polite">
            {!addressReady && <p className="text-sm text-muted">{countryRegions.length ? t("enterCityRegion", { region: st.label(country?.region_label ?? "Region").toLowerCase() }) : t("enterCity")}</p>}
            {addressReady && quoting && (
              <div className="space-y-2">
                <div className="skeleton h-16 w-full" />
                <div className="skeleton h-16 w-full" />
              </div>
            )}
            {addressReady && !quoting && activeQuote && !activeQuote.ok && (
              <Notice tone="error" title={t("deliveryUnavailable")}>
                {st.error(activeQuote)}
              </Notice>
            )}
            {addressReady && !quoting && activeQuote?.ok && (
              <fieldset className="space-y-2">
                <legend className="sr-only">{t("chooseMethod")}</legend>
                {activeQuote.options.map((o) => {
                  const window = st.window(o.minDays, o.maxDays);
                  return (
                    <label key={o.rateId} className={cn("flex cursor-pointer items-center gap-4 rounded-2xl border px-4 py-4 transition", rateId === o.rateId ? "border-plum bg-blush" : "border-line hover:border-plum/40")}>
                      <input type="radio" name="shipping" className="size-4 accent-[#d94f91]" checked={rateId === o.rateId} onChange={() => setRateId(o.rateId)} />
                      <Truck className="size-4 text-rose" aria-hidden />
                      <span className="flex-1 text-sm">
                        <span className="font-semibold">{st.method(o.methodName)}</span>
                        <span className="block text-xs text-muted">
                          {window ? t("estimated", { window }) : t("estimateAfterDispatch")}
                          {o.isManual && ` · ${t("manualRate")}`}
                        </span>
                      </span>
                      <span className="text-sm font-semibold tabular-nums">
                        {o.fee === 0 ? tc("free") : formatMoney(o.fee)}
                        {o.freeShippingApplied && <s className="ml-2 text-xs font-normal text-muted">{formatMoney(o.originalFee)}</s>}
                      </span>
                    </label>
                  );
                })}
              </fieldset>
            )}
          </div>
          {international && dutiesNotice && (
            <p className="mt-4 flex gap-2 text-xs leading-relaxed text-muted">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {dutiesNotice}
            </p>
          )}
        </section>
      </form>

      <aside className="h-fit rounded-[1.75rem] bg-neutral p-6 lg:sticky lg:top-28" aria-label={t("summary")}>
        <h2 className="font-display text-2xl">{t("summary")}</h2>
        <ul className="mt-5 max-h-80 space-y-4 overflow-y-auto pr-1">
          {cart.lines.map((l) => (
            <li key={l.itemId} className="flex gap-3">
              <span className="relative h-20 w-15 shrink-0 overflow-hidden bg-white">
                <SmartImage src={l.imageUrl} alt={l.imageAlt || ct.name(l)} fill sizes="60px" className="object-cover" />
                <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-plum text-[0.6rem] font-bold text-white">{l.quantity}</span>
              </span>
              <span className="flex-1 text-sm">
                <span className="block font-semibold leading-snug">{ct.name(l)}</span>
                <span className="block text-xs text-muted">{ct.variant(l.size, l.color)}</span>
                {l.warning && !l.purchasable && <span className="block text-xs font-semibold text-danger">{ct.warning(l)}</span>}
              </span>
              <span className="text-sm tabular-nums">{formatMoney(l.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-6 border-t border-line pt-5">
          <DiscountForm />
        </div>
        <dl className="mt-6 space-y-2 border-t border-line pt-5 text-sm">
          <div className="flex justify-between">
            <dt>{tc("subtotal")}</dt>
            <dd className="tabular-nums">{formatMoney(totals.subtotal)}</dd>
          </div>
          {(totals.discountTotal > 0 || cart.discount?.freeShipping) && (
            <div className="flex justify-between text-rose-deep">
              <dt>{cart.discount ? discountLabel(cart.discount) : tc("discount")}</dt>
              <dd className="tabular-nums">{totals.discountTotal > 0 ? `−${formatMoney(totals.discountTotal)}` : tc("freeDelivery")}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt>{tc("delivery")}{selected ? ` · ${st.method(selected.methodName)}` : ""}</dt>
            <dd className="tabular-nums">{selected ? (totals.shippingFee === 0 ? tc("free") : formatMoney(totals.shippingFee)) : "—"}</dd>
          </div>
          {address.city && (
            <div className="flex justify-between text-xs text-muted">
              <dt>{t("deliveringTo")}</dt>
              <dd className="text-right">
                {address.city}
                {address.region ? `, ${countryRegions.find((r) => r.code === address.region)?.name ?? address.region}` : ""}, {country ? countryLabel(country.code) : ""}
              </dd>
            </div>
          )}
          {tax.mode === "exclusive" && totals.taxTotal > 0 && (
            <div className="flex justify-between">
              <dt>{tax.label}</dt>
              <dd className="tabular-nums">{formatMoney(totals.taxTotal)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-line pt-3 text-lg font-semibold">
            <dt>{t("total")}</dt>
            <dd className="tabular-nums">{selected ? `${money.isEstimate ? "≈ " : ""}${formatMoney(totals.total)}` : "—"}</dd>
          </div>
          {selected && money.isEstimate && (
            <div className="rounded-2xl border border-rose/40 bg-white px-3 py-2.5 text-xs leading-relaxed" role="note">
              <p className="flex justify-between gap-3 text-sm font-semibold text-plum">
                <span>{t("chargedLabel")}</span>
                <span className="tabular-nums">{money.formatCharge(totals.total)}</span>
              </p>
              <p className="mt-1 text-muted">{t("chargedNote", { display: money.currency, charge: money.chargeCurrency })}</p>
            </div>
          )}
          {tax.mode === "inclusive" && totals.taxIncluded > 0 && (
            <p className="text-xs text-muted">
              {t("taxIncluded", { label: tax.label, amount: formatMoney(totals.taxIncluded) })}
            </p>
          )}
        </dl>

        <AnimatePresence>
          {error && (
            <m.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-5">
              <Notice tone="error">{error}</Notice>
            </m.div>
          )}
        </AnimatePresence>

        <Button type="submit" form="checkout-form" size="lg" className="mt-6 w-full" disabled={!canPay} loading={placing}>
          <Lock className="size-3.5" aria-hidden />{" "}
          {placing
            ? t("redirecting")
            : !selected
              ? t("paySecurely")
              : paymentMethod === "bank_transfer"
                ? t("continueTransfer", { amount: money.formatCharge(totals.total) })
                : t("pay", { amount: money.formatCharge(totals.total) })}
        </Button>
        <p className="mt-3 text-center text-xs text-muted">
          {paymentMethod === "bank_transfer" ? t("transferNote") : t("paystackNote", { charge: money.chargeCurrency })}
        </p>
      </aside>
    </div>
  );
}
