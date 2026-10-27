"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Truck, RotateCcw, ShieldCheck } from "lucide-react";
import Link from "next/link";
import type { ProductDetail } from "@/lib/catalog/types";
import { sortSizes } from "@/lib/catalog/filters";
import { Price } from "@/components/ui/Price";
import { Button } from "@/components/ui/Button";
import { QuantityStepper } from "@/components/cart/QuantityStepper";
import { useCart } from "@/components/cart/CartProvider";
import { cn } from "@/lib/cn";
import { ProductGallery } from "./ProductGallery";
import { DeliveryEstimator, type DestinationOptions } from "./DeliveryEstimator";

export function ProductPurchase({ product, maxPerItem, destinations, children }: { product: ProductDetail; maxPerItem: number; destinations: DestinationOptions; children?: React.ReactNode }) {
  const router = useRouter();
  const { add, pending } = useCart();
  const colors = useMemo(() => {
    const seen = new Map<string, string | null>();
    product.variants.forEach((v) => v.color && !seen.has(v.color) && seen.set(v.color, v.color_hex));
    return [...seen.entries()].map(([name, hex]) => ({ name, hex }));
  }, [product.variants]);

  const available = (v: ProductDetail["variants"][number]) => product.allow_backorder || v.on_hand > 0;
  const [color, setColor] = useState<string | null>(() => colors.find((c) => product.variants.some((v) => v.color === c.name && available(v)))?.name ?? colors[0]?.name ?? null);
  const forColor = product.variants.filter((v) => !color || v.color === color);
  const sizes = sortSizes([...new Set(forColor.map((v) => v.size).filter(Boolean))] as string[]);
  const [size, setSize] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const variant = sizes.length === 0 ? forColor[0] ?? null : forColor.find((v) => v.size === size) ?? null;
  const maxQty = variant ? (product.allow_backorder ? maxPerItem : Math.max(0, Math.min(maxPerItem, variant.on_hand))) : maxPerItem;
  const anyAvailable = product.variants.some(available);

  const images = useMemo(() => {
    const colored = product.images.filter((i) => i.color && i.color === color);
    if (colored.length) return colored;
    const untagged = product.images.filter((i) => !i.color);
    return untagged.length ? untagged : product.images;
  }, [product.images, color]);

  const stockText = (() => {
    if (!anyAvailable) return { text: "Sold out", tone: "text-danger" };
    if (!variant) return null;
    if (variant.on_hand <= 0) return product.allow_backorder ? { text: "Available on backorder — ships when restocked", tone: "text-warning" } : { text: "This option is sold out", tone: "text-danger" };
    if (variant.on_hand <= 3) return { text: `Only ${variant.on_hand} left in stock`, tone: "text-warning" };
    return { text: "In stock", tone: "text-success" };
  })();

  const submit = async (buyNow: boolean) => {
    setError(null);
    if (!variant) {
      setError("Please select a size.");
      return;
    }
    if (!available(variant)) {
      setError("This option is sold out.");
      return;
    }
    const r = await add(variant.id, Math.min(qty, Math.max(maxQty, 1)), { openDrawer: !buyNow });
    if (!r.ok) setError(r.error);
    else if (buyNow) router.push("/checkout");
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
      <ProductGallery images={images} name={product.name} />
      <div className="lg:sticky lg:top-28 lg:self-start">
        <p className="eyebrow text-rose-deep">{product.category.parent?.name ?? product.category.name}</p>
        <h1 className="display mt-3 text-4xl sm:text-5xl">{product.name}</h1>
        <div className="mt-4 flex items-center gap-3">
          <Price price={product.price} salePrice={product.sale_price} size="lg" />
          {product.sale_price != null && (
            <span className="bg-pale px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.15em] text-rose-deep">
              Save {Math.round((1 - product.sale_price / product.price) * 100)}%
            </span>
          )}
        </div>

        {colors.length > 0 && (
          <fieldset className="mt-8">
            <legend className="eyebrow">
              Colour: <span className="font-sans normal-case tracking-normal text-plum-soft">{color}</span>
            </legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {colors.map((c) => {
                const has = product.variants.some((v) => v.color === c.name && available(v));
                return (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => {
                      setColor(c.name);
                      setSize(null);
                      setQty(1);
                    }}
                    aria-pressed={color === c.name}
                    aria-label={`${c.name}${has ? "" : " (sold out)"}`}
                    className={cn("relative grid size-10 place-items-center rounded-full border-2 transition", color === c.name ? "border-plum" : "border-transparent hover:border-line")}
                  >
                    <span className="size-7 rounded-full border border-plum/15" style={{ backgroundColor: c.hex ?? "#ccc" }} />
                    {!has && <span className="absolute h-px w-8 rotate-45 bg-plum/60" aria-hidden />}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        {sizes.length > 0 && (
          <fieldset className="mt-7">
            <div className="flex items-center justify-between">
              <legend className="eyebrow">Size{size ? `: ${size}` : ""}</legend>
              <Link href="/faq" className="text-xs underline underline-offset-4 text-muted hover:text-plum">
                Size help
              </Link>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {sizes.map((s) => {
                const v = forColor.find((x) => x.size === s)!;
                const ok = available(v);
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={!ok}
                    onClick={() => {
                      setSize(s);
                      setQty(1);
                      setError(null);
                    }}
                    aria-pressed={size === s}
                    className={cn(
                      "h-11 min-w-12 border px-3 text-sm font-semibold transition",
                      size === s ? "border-plum bg-plum text-white" : "border-line hover:border-plum",
                      !ok && "cursor-not-allowed text-muted/50 line-through hover:border-line",
                    )}
                    aria-label={`Size ${s}${ok ? "" : " — sold out"}`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        {stockText && <p className={cn("mt-5 text-sm font-semibold", stockText.tone)} aria-live="polite">{stockText.text}</p>}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <QuantityStepper value={qty} onChange={setQty} max={Math.max(1, maxQty)} disabled={!anyAvailable} />
          <Button className="flex-1" size="lg" onClick={() => submit(false)} disabled={!anyAvailable || pending} loading={pending}>
            {anyAvailable ? "Add to bag" : "Sold out"}
          </Button>
        </div>
        {anyAvailable && (
          <Button variant="outline" size="lg" className="mt-3 w-full" onClick={() => submit(true)} disabled={pending}>
            Buy now
          </Button>
        )}
        {error && (
          <p className="mt-3 text-sm font-semibold text-danger" role="alert">
            {error}
          </p>
        )}

        <ul className="mt-8 grid gap-3 border-y border-line py-6 text-sm text-plum-soft">
          <li className="flex gap-3">
            <Truck className="size-4 shrink-0 text-rose" aria-hidden /> Delivery fees and estimates are calculated for your address at checkout.
          </li>
          <li className="flex gap-3">
            <RotateCcw className="size-4 shrink-0 text-rose" aria-hidden />
            <span>
              See our{" "}
              <Link href="/returns-policy" className="underline underline-offset-4">
                returns policy
              </Link>
              .
            </span>
          </li>
          <li className="flex gap-3">
            <ShieldCheck className="size-4 shrink-0 text-rose" aria-hidden /> Secure checkout — we never see your card details.
          </li>
        </ul>

        <DeliveryEstimator slug={product.slug} destinations={destinations} />
        {children}
      </div>
    </div>
  );
}
