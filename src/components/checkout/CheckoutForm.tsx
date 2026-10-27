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
import { formatMoney } from "@/lib/money";
import { formatDeliveryWindow, type ShippingQuote } from "@/lib/shipping/calculator";
import { variantLabel } from "@/lib/cart/assess";
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
}: {
  countries: CountryOption[];
  regions: Record<string, { code: string; name: string }[]>;
  savedAddresses: SavedAddress[];
  defaultEmail: string;
  signedIn: boolean;
  tax: TaxConfig;
  dutiesNotice: string;
  storeCountry?: string;
}) {
  const { cart } = useCart();
  const [nonce] = useState(() => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random()).slice(2).padEnd(20, "0")));
  const first = savedAddresses.find((a) => countries.some((c) => c.code === a.country_code));
  const [email, setEmail] = useState(defaultEmail);
  const [address, setAddress] = useState<Address>(() =>
    first
      ? { full_name: first.full_name, phone: first.phone, country_code: first.country_code, region: first.region, city: first.city, line1: first.line1, line2: first.line2 ?? "", postal_code: first.postal_code ?? "" }
      : { full_name: "", phone: "", country_code: countries.find((c) => c.code === storeCountry)?.code ?? countries[0]?.code ?? "", region: "", city: "", line1: "", line2: "", postal_code: "" },
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
        <p className="display text-4xl">Your bag is empty</p>
        <Link href="/shop" className="mt-6 inline-block underline underline-offset-4">
          Continue shopping
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
      setError(activeQuote && !activeQuote.ok ? activeQuote.message : "Please complete your address to see delivery options.");
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
            Contact
          </h2>
          {!signedIn && (
            <p className="mt-2 text-sm text-muted">
              Have an account?{" "}
              <Link href="/account/login?next=/checkout" className="underline underline-offset-4">
                Sign in
              </Link>
            </p>
          )}
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-sm sm:col-span-2">
              Email
              <input className="field mt-1.5" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} {...field("email")} />
              <FieldError errors={errors} name="email" />
            </label>
          </div>
        </section>

        <section aria-labelledby="delivery-h">
          <h2 id="delivery-h" className="font-display text-3xl">
            Delivery address
          </h2>
          {savedAddresses.length > 0 && (
            <label className="mt-5 block text-sm">
              Saved addresses
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
              Country
              <select
                className="field mt-1.5"
                value={address.country_code}
                onChange={(e) => setAddress((a) => ({ ...a, country_code: e.target.value, region: "", postal_code: "" }))}
                autoComplete="country"
                {...field("address.country_code")}
              >
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-muted">Only countries we currently deliver to are listed.</span>
            </label>
            <label className="text-sm">
              Full name
              <input className="field mt-1.5" autoComplete="name" value={address.full_name} onChange={(e) => set("full_name", e.target.value)} required {...field("address.full_name")} />
              <FieldError errors={errors} name="address.full_name" />
            </label>
            <label className="text-sm">
              Phone number
              <input className="field mt-1.5" type="tel" autoComplete="tel" placeholder={address.country_code === "NG" ? "+234 801 234 5678" : "+44 20 7946 0000"} value={address.phone} onChange={(e) => set("phone", e.target.value)} required {...field("address.phone")} />
              <FieldError errors={errors} name="address.phone" />
            </label>
            <label className="text-sm sm:col-span-2">
              Street address
              <input className="field mt-1.5" autoComplete="address-line1" value={address.line1} onChange={(e) => set("line1", e.target.value)} required {...field("address.line1")} />
              <FieldError errors={errors} name="address.line1" />
            </label>
            <label className="text-sm sm:col-span-2">
              Apartment, suite, landmark <span className="text-muted">(optional)</span>
              <input className="field mt-1.5" autoComplete="address-line2" value={address.line2} onChange={(e) => set("line2", e.target.value)} />
            </label>
            <label className="text-sm">
              City / town
              <input className="field mt-1.5" autoComplete="address-level2" value={address.city} onChange={(e) => set("city", e.target.value)} required {...field("address.city")} />
              <FieldError errors={errors} name="address.city" />
            </label>
            <label className="text-sm">
              {country?.region_label ?? "Region"} {!(country?.region_required || countryRegions.length) && <span className="text-muted">(optional)</span>}
              {countryRegions.length > 0 ? (
                <select className="field mt-1.5" autoComplete="address-level1" value={address.region} onChange={(e) => set("region", e.target.value)} required {...field("address.region")}>
                  <option value="">Select…</option>
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
              {country?.postal_label ?? "Postal code"} {!country?.postal_required && <span className="text-muted">(optional)</span>}
              <input className="field mt-1.5" autoComplete="postal-code" value={address.postal_code} onChange={(e) => set("postal_code", e.target.value)} required={country?.postal_required} {...field("address.postal_code")} />
              <FieldError errors={errors} name="address.postal_code" />
            </label>
            <label className="text-sm sm:col-span-2">
              Delivery instructions <span className="text-muted">(optional)</span>
              <textarea className="field mt-1.5 min-h-20" maxLength={500} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Gate code, landmark, best time to call…" />
            </label>
            {signedIn && (
              <label className="flex items-center gap-3 text-sm sm:col-span-2">
                <input type="checkbox" className="size-4 accent-[#d94f91]" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} />
                Save this address to my account
              </label>
            )}
          </div>
        </section>

        <section aria-labelledby="shipping-h" aria-busy={quoting}>
          <h2 id="shipping-h" className="font-display text-3xl">
            Delivery method
          </h2>
          <div className="mt-5" aria-live="polite">
            {!addressReady && <p className="text-sm text-muted">Enter your city{countryRegions.length ? ` and ${country?.region_label.toLowerCase()}` : ""} to see delivery options.</p>}
            {addressReady && quoting && (
              <div className="space-y-2">
                <div className="skeleton h-16 w-full" />
                <div className="skeleton h-16 w-full" />
              </div>
            )}
            {addressReady && !quoting && activeQuote && !activeQuote.ok && (
              <Notice tone="error" title="Delivery unavailable">
                {activeQuote.message}
              </Notice>
            )}
            {addressReady && !quoting && activeQuote?.ok && (
              <fieldset className="space-y-2">
                <legend className="sr-only">Choose a delivery method</legend>
                {activeQuote.options.map((o) => {
                  const window = formatDeliveryWindow(o.minDays, o.maxDays);
                  return (
                    <label key={o.rateId} className={cn("flex cursor-pointer items-center gap-4 rounded-2xl border px-4 py-4 transition", rateId === o.rateId ? "border-plum bg-blush" : "border-line hover:border-plum/40")}>
                      <input type="radio" name="shipping" className="size-4 accent-[#d94f91]" checked={rateId === o.rateId} onChange={() => setRateId(o.rateId)} />
                      <Truck className="size-4 text-rose" aria-hidden />
                      <span className="flex-1 text-sm">
                        <span className="font-semibold">{o.methodName}</span>
                        <span className="block text-xs text-muted">
                          {window ? `Estimated ${window}` : "Delivery estimate confirmed after dispatch"}
                          {o.isManual && " · Rate set by Attitude Collections"}
                        </span>
                      </span>
                      <span className="text-sm font-semibold tabular-nums">
                        {o.fee === 0 ? "Free" : formatMoney(o.fee)}
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

      <aside className="h-fit rounded-[1.75rem] bg-neutral p-6 lg:sticky lg:top-28" aria-label="Order summary">
        <h2 className="font-display text-2xl">Order summary</h2>
        <ul className="mt-5 max-h-80 space-y-4 overflow-y-auto pr-1">
          {cart.lines.map((l) => (
            <li key={l.itemId} className="flex gap-3">
              <span className="relative h-20 w-15 shrink-0 overflow-hidden bg-white">
                <SmartImage src={l.imageUrl} alt={l.imageAlt || l.name} fill sizes="60px" className="object-cover" />
                <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-plum text-[0.6rem] font-bold text-white">{l.quantity}</span>
              </span>
              <span className="flex-1 text-sm">
                <span className="block font-semibold leading-snug">{l.name}</span>
                <span className="block text-xs text-muted">{variantLabel(l.size, l.color)}</span>
                {l.warning && !l.purchasable && <span className="block text-xs font-semibold text-danger">{l.warning}</span>}
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
            <dt>Subtotal</dt>
            <dd className="tabular-nums">{formatMoney(totals.subtotal)}</dd>
          </div>
          {(totals.discountTotal > 0 || cart.discount?.freeShipping) && (
            <div className="flex justify-between text-rose-deep">
              <dt>Discount{cart.discount ? ` (${cart.discount.code})` : ""}</dt>
              <dd className="tabular-nums">{totals.discountTotal > 0 ? `−${formatMoney(totals.discountTotal)}` : "Free delivery"}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt>Delivery{selected ? ` · ${selected.methodName}` : ""}</dt>
            <dd className="tabular-nums">{selected ? (totals.shippingFee === 0 ? "Free" : formatMoney(totals.shippingFee)) : "—"}</dd>
          </div>
          {address.city && (
            <div className="flex justify-between text-xs text-muted">
              <dt>Delivering to</dt>
              <dd className="text-right">
                {address.city}
                {address.region ? `, ${countryRegions.find((r) => r.code === address.region)?.name ?? address.region}` : ""}, {country?.name}
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
            <dt>Total</dt>
            <dd className="tabular-nums">{selected ? formatMoney(totals.total) : "—"}</dd>
          </div>
          {tax.mode === "inclusive" && totals.taxIncluded > 0 && (
            <p className="text-xs text-muted">
              Includes {tax.label} of {formatMoney(totals.taxIncluded)}
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
          <Lock className="size-3.5" aria-hidden /> {placing ? "Redirecting to payment…" : selected ? `Pay ${formatMoney(totals.total)}` : "Pay securely"}
        </Button>
        <p className="mt-3 text-center text-xs text-muted">
          You&apos;ll complete payment on Paystack&apos;s secure page. Your final total is confirmed by our server before payment.
        </p>
      </aside>
    </div>
  );
}
