"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { ArrowRight, ChevronDown, ChevronUp, Minus, PackageSearch, Plus, ShieldCheck, Truck } from "lucide-react";
import type { ProductDetail } from "@/lib/catalog/types";
import { sortSizes } from "@/lib/catalog/filters";
import { formatMoney } from "@/lib/money";
import { useCart } from "@/components/cart/CartProvider";
import { SmartImage } from "@/components/ui/SmartImage";
import { cn } from "@/lib/cn";

type Variant = ProductDetail["variants"][number];

const EASE = [0.22, 1, 0.36, 1] as const;
const blurIn = {
  initial: { opacity: 0, filter: "blur(14px)", scale: 0.97 },
  animate: { opacity: 1, filter: "blur(0px)", scale: 1 },
  exit: { opacity: 0, filter: "blur(14px)", scale: 1.02 },
  transition: { duration: 0.55, ease: EASE },
};

/** Angles (degrees, screen space) for options placed on the left arc of the ring. */
function orbitAngles(n: number): number[] {
  if (n <= 1) return [180];
  const spread = Math.min(110, 27.5 * (n - 1));
  return Array.from({ length: n }, (_, i) => 180 + spread / 2 - (spread / (n - 1)) * i);
}

/** Position on the ring as CSS calc() values, driven by the --r custom property. */
function onRing(deg: number, extra = "0rem") {
  const rad = (deg * Math.PI) / 180;
  return {
    left: `calc(50% + (var(--r) + ${extra}) * ${Math.cos(rad).toFixed(4)})`,
    top: `calc(50% + (var(--r) + ${extra}) * ${Math.sin(rad).toFixed(4)})`,
  };
}

function colorsOf(p: ProductDetail) {
  const seen = new Map<string, string | null>();
  p.variants.forEach((v) => v.color && !seen.has(v.color) && seen.set(v.color, v.color_hex));
  return [...seen.entries()].map(([name, hex]) => ({ name, hex }));
}

function splitTitle(name: string) {
  const parts = name.trim().split(" ");
  if (parts.length < 2) return { lead: name, last: "" };
  return { lead: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
}

function splitDescription(text: string) {
  const match = text.match(/^([^]+?[.!?])\s+([^]+)$/);
  return match ? { lead: match[1], rest: match[2] } : { lead: text, rest: "" };
}

function Gem({ hex }: { hex: string | null }) {
  const c = hex ?? "#cccccc";
  return (
    <span
      className="block size-full rounded-full"
      style={{ background: `radial-gradient(circle at 32% 28%, #ffffff 0%, ${c}cc 38%, ${c} 62%, #00000033 100%)` }}
    />
  );
}

export interface ShowcaseProps {
  products: ProductDetail[];
  mode: "hero" | "product";
  maxPerItem: number;
  /** Vertical headline, e.g. "Wear Your Attitude." */
  headline: string;
  /** Small vertical caption next to the headline. */
  caption?: string;
  /** Optional row rendered along the bottom of the card (intro text, calls to action). */
  footer?: React.ReactNode;
}

export function Showcase({ products, mode, maxPerItem, headline, caption = "Bold • Modern • Timeless", footer }: ShowcaseProps) {
  const router = useRouter();
  const { add, pending } = useCart();
  const [index, setIndex] = useState(0);
  const product = products[index];

  // Per-product selection state, reset when the slide changes.
  const colors = useMemo(() => colorsOf(product), [product]);
  const available = (v: Variant) => product.allow_backorder || v.on_hand > 0;
  const firstColor = () => colors.find((c) => product.variants.some((v) => v.color === c.name && available(v)))?.name ?? colors[0]?.name ?? null;
  const [color, setColor] = useState<string | null>(firstColor);
  const [size, setSize] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [imageIndex, setImageIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastProduct, setLastProduct] = useState(product.id);
  if (lastProduct !== product.id) {
    setLastProduct(product.id);
    setColor(firstColor());
    setSize(null);
    setQty(1);
    setImageIndex(0);
    setError(null);
  }

  const images = useMemo(() => {
    const tagged = product.images.filter((i) => i.color && i.color === color);
    if (tagged.length) return tagged;
    const untagged = product.images.filter((i) => !i.color);
    return untagged.length ? untagged : product.images;
  }, [product.images, color]);
  const image = images[Math.min(imageIndex, Math.max(images.length - 1, 0))] ?? null;

  const forColor = product.variants.filter((v) => !color || v.color === color);
  const sizes = sortSizes([...new Set(forColor.map((v) => v.size).filter(Boolean))] as string[]);
  const variant = sizes.length === 0 ? forColor[0] ?? null : forColor.find((v) => v.size === size) ?? null;
  const anyAvailable = product.variants.some(available);
  const maxQty = variant ? (product.allow_backorder ? maxPerItem : Math.max(1, Math.min(maxPerItem, variant.on_hand))) : maxPerItem;

  // The counter steps through products on the homepage and through photos on a product page.
  const total = mode === "hero" ? products.length : Math.max(images.length, 1);
  const position = mode === "hero" ? index : Math.min(imageIndex, total - 1);
  const go = (delta: number) => {
    if (total <= 1) return;
    const next = (position + delta + total) % total;
    if (mode === "hero") setIndex(next);
    else setImageIndex(next);
  };

  const onSale = product.sale_price != null && product.sale_price < product.price;
  const price = product.sale_price ?? product.price;
  const { lead, last } = splitTitle(product.name);
  const desc = splitDescription(product.description);
  const headWords = headline.trim().split(" ");
  const headLast = headWords.pop();
  // One h1 per page: the headline on the homepage, the product name on a product page.
  const HeadTag = mode === "hero" ? "h1" : "p";
  const TitleTag = mode === "hero" ? "h2" : "h1";

  const stock = (() => {
    if (!anyAvailable) return { text: "Sold out", tone: "text-danger" };
    if (!variant) return null;
    if (variant.on_hand <= 0) return product.allow_backorder ? { text: "Available on backorder", tone: "text-warning" } : { text: "This option is sold out", tone: "text-danger" };
    if (variant.on_hand <= 3) return { text: `Only ${variant.on_hand} left`, tone: "text-warning" };
    return { text: "In stock", tone: "text-success" };
  })();

  const submit = async (buyNow: boolean) => {
    setError(null);
    if (!variant) return setError("Please choose a size.");
    if (!available(variant)) return setError("This option is sold out.");
    const r = await add(variant.id, Math.min(qty, maxQty), { openDrawer: !buyNow });
    if (!r.ok) setError(r.error);
    else if (buyNow) router.push("/checkout");
  };

  const angles = orbitAngles(colors.length);
  const activeColor = Math.max(0, colors.findIndex((c) => c.name === color));
  const imageFor = (c: string) => product.images.find((i) => i.color === c) ?? null;

  const counter = (
    <div className="flex items-end gap-5">
      <div className="text-center">
        <AnimatePresence mode="popLayout" initial={false}>
          <m.p key={position} className="font-sans text-3xl font-light tabular-nums" initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -14, opacity: 0 }}>
            {String(position + 1).padStart(2, "0")}
          </m.p>
        </AnimatePresence>
        <span className="mx-auto my-1.5 block h-px w-5 bg-plum/25" />
        <p className="text-sm tabular-nums text-muted">/ {String(total).padStart(2, "0")}</p>
      </div>
      <div className="flex flex-col items-center gap-2 pb-1">
        <button type="button" onClick={() => go(-1)} disabled={total <= 1} className="grid size-8 place-items-center rounded-full transition hover:bg-white disabled:opacity-30" aria-label={mode === "hero" ? "Previous product" : "Previous photo"}>
          <ChevronUp className="size-4" />
        </button>
        <span className="h-px w-3 bg-plum/40" aria-hidden />
        <button type="button" onClick={() => go(1)} disabled={total <= 1} className="grid size-8 place-items-center rounded-full transition hover:bg-white disabled:opacity-30" aria-label={mode === "hero" ? "Next product" : "Next photo"}>
          <ChevronDown className="size-4" />
        </button>
      </div>
    </div>
  );

  return (
    <section
      className="relative isolate overflow-hidden bg-neutral"
      aria-roledescription={mode === "hero" ? "carousel" : undefined}
      aria-label={mode === "hero" ? "Featured pieces" : product.name}
    >
      {/* Soft, blurred backdrop taken from the current photo */}
      <AnimatePresence initial={false}>
        <m.div key={image?.url ?? "none"} className="absolute inset-0 -z-10" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.9 }} aria-hidden>
          <SmartImage src={image?.url} alt="" fill sizes="40vw" className="scale-125 object-cover opacity-50 blur-3xl" />
        </m.div>
      </AnimatePresence>
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-white/70 via-neutral/60 to-white/80" aria-hidden />

      <div className="container-luxe py-6 sm:py-10">
        <div className="relative rounded-[2rem] border border-white/80 bg-white/75 shadow-[0_30px_80px_-40px_rgba(37,25,35,0.35)] backdrop-blur-xl">
          <div className="grid gap-8 p-5 sm:p-8 lg:grid-cols-[6.5rem_minmax(0,1fr)_minmax(19rem,25rem)] lg:gap-6 lg:p-10 xl:gap-10">
            {/* Vertical headline + counter */}
            <div className="hidden lg:flex lg:flex-col lg:items-start lg:justify-between">
              <div className="flex items-start gap-3">
                <HeadTag className="display text-[3.4rem] leading-none [writing-mode:vertical-rl] rotate-180 xl:text-[4.2rem]">
                  {headWords.join(" ")} <span className="italic text-rose-deep">{headLast}</span>
                </HeadTag>
                <p className="eyebrow mt-4 text-[0.6rem] text-muted [writing-mode:vertical-rl] rotate-180">{caption}</p>
              </div>
              <div className="mt-8 flex flex-col gap-4">
                <span className="ml-3 h-12 w-px bg-plum/20" aria-hidden />
                {counter}
              </div>
            </div>

            {/* Mobile headline */}
            <div className="flex items-end justify-between gap-4 lg:hidden">
              <div>
                <p className="eyebrow text-[0.6rem] text-muted">{caption}</p>
                <HeadTag className="display mt-2 text-4xl sm:text-5xl">
                  {headWords.join(" ")} <span className="italic text-rose-deep">{headLast}</span>
                </HeadTag>
              </div>
              {total > 1 && counter}
            </div>

            {/* Stage: product in a glowing ring with colour options on an orbit */}
            <div className="relative mx-auto aspect-square w-full max-w-[34rem] [--r:9.5rem] sm:[--r:13rem] lg:max-w-none lg:[--r:11.5rem] xl:[--r:14.5rem] 2xl:[--r:16rem]">
              {/* rings */}
              <div className="absolute left-1/2 top-1/2 size-[calc(var(--r)*2)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-plum/10" aria-hidden />
              <div className="absolute left-1/2 top-1/2 size-[calc(var(--r)*2+2.5rem)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-plum/[0.07]" aria-hidden />
              <div className="absolute left-1/2 top-1/2 size-[calc(var(--r)*2-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-white via-white/60 to-pale/60 shadow-[0_0_80px_10px_rgba(255,255,255,0.9),inset_0_0_40px_rgba(217,79,145,0.08)]" aria-hidden />
              <m.span
                className="absolute left-1/2 top-1/2 size-[calc(var(--r)*2)] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-transparent border-b-rose/50 border-l-rose/20"
                animate={{ rotate: 360 }}
                transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                aria-hidden
              />

              {/* product photo */}
              <div className="absolute left-1/2 top-1/2 size-[calc(var(--r)*2-3.5rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full bg-neutral shadow-[0_25px_60px_-25px_rgba(37,25,35,0.45)]">
                <AnimatePresence mode="popLayout" initial={false}>
                  <m.div key={`${product.id}-${image?.id ?? "x"}`} className="absolute inset-0" {...blurIn}>
                    <SmartImage
                      src={image?.url}
                      alt={image?.alt || product.name}
                      fill
                      preload={mode === "product" || index === 0}
                      sizes="(min-width:1280px) 32rem, (min-width:640px) 24rem, 80vw"
                      className="object-cover"
                      fallbackLabel={product.name}
                    />
                  </m.div>
                </AnimatePresence>
              </div>

              {/* orbit of colour options (desktop/tablet) */}
              {colors.length > 0 && (
                <div className="absolute inset-0 hidden sm:block" role="radiogroup" aria-label="Colour">
                  {colors.map((c, i) => {
                    const pos = onRing(angles[i], "3.4rem");
                    const dot = onRing(angles[i]);
                    const selected = i === activeColor;
                    const img = imageFor(c.name);
                    const has = product.variants.some((v) => v.color === c.name && available(v));
                    return (
                      <div key={c.name}>
                        <span
                          className={cn("absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-500", selected ? "size-6 border border-plum/30 bg-white shadow" : "size-2 bg-plum/30")}
                          style={dot}
                          aria-hidden
                        >
                          {selected && <span className="absolute left-1/2 top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-plum" />}
                        </span>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          aria-label={`${c.name}${has ? "" : " (sold out)"}`}
                          onClick={() => {
                            setColor(c.name);
                            setSize(null);
                            setImageIndex(0);
                          }}
                          className="group absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5"
                          style={pos}
                        >
                          <span
                            className={cn(
                              "relative block size-14 overflow-hidden rounded-full border-4 border-white bg-white shadow-[0_10px_25px_-12px_rgba(37,25,35,0.5)] transition-transform duration-300 group-hover:scale-110 xl:size-16",
                              selected && "ring-2 ring-plum/70 ring-offset-2",
                              !has && "opacity-50",
                            )}
                          >
                            {img ? <SmartImage src={img.url} alt="" fill sizes="64px" className="object-cover" /> : <Gem hex={c.hex} />}
                          </span>
                          <span className={cn("text-[0.7rem]", selected ? "font-semibold text-plum" : "text-muted")}>{c.name}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Details panel */}
            <div className="flex flex-col justify-center" aria-live="polite">
              <AnimatePresence mode="wait" initial={false}>
                <m.div key={product.id} {...blurIn}>
                  <p className="eyebrow text-muted">{product.category.parent?.name ?? product.category.name}</p>
                  <TitleTag className="display mt-3 text-[2.6rem] sm:text-5xl xl:text-[3.6rem]">
                    {mode === "hero" ? (
                      <Link href={`/products/${product.slug}`} className="hover:text-rose-deep">
                        <span className="font-semibold">{lead}</span> {last && <span className="font-light italic">{last}</span>}
                      </Link>
                    ) : (
                      <>
                        <span className="font-semibold">{lead}</span> {last && <span className="font-light italic">{last}</span>}
                      </>
                    )}
                  </TitleTag>
                  <p className="mt-3 text-[0.95rem] text-plum-soft">{desc.lead}</p>
                  {desc.rest && <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted">{desc.rest}</p>}
                </m.div>
              </AnimatePresence>

              {/* mobile colour row */}
              {colors.length > 0 && (
                <div className="mt-6 sm:hidden" role="radiogroup" aria-label="Colour">
                  <p className="eyebrow text-[0.62rem]">Colour · <span className="normal-case tracking-normal text-muted">{color}</span></p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {colors.map((c) => (
                      <button
                        key={c.name}
                        type="button"
                        role="radio"
                        aria-checked={c.name === color}
                        aria-label={c.name}
                        onClick={() => {
                          setColor(c.name);
                          setSize(null);
                          setImageIndex(0);
                        }}
                        className={cn("size-10 overflow-hidden rounded-full border-4 border-white shadow", c.name === color && "ring-2 ring-plum/70 ring-offset-1")}
                      >
                        <Gem hex={c.hex} />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {sizes.length > 0 && (
                <fieldset className="mt-7">
                  <legend className="eyebrow text-[0.65rem]">Size{size ? ` · ${size}` : ""}</legend>
                  <div className="mt-3 flex flex-wrap gap-2.5">
                    {sizes.map((s) => {
                      const v = forColor.find((x) => x.size === s)!;
                      const ok = available(v);
                      const on = size === s;
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
                          aria-pressed={on}
                          aria-label={`Size ${s}${ok ? "" : " — sold out"}`}
                          className={cn(
                            "grid h-12 min-w-12 place-items-center rounded-full border px-3 text-sm font-medium tabular-nums transition duration-300",
                            on ? "border-plum bg-plum text-white shadow-lg shadow-plum/25" : "border-plum/15 bg-white/60 hover:border-plum",
                            !ok && "cursor-not-allowed text-muted/50 line-through hover:border-plum/15",
                          )}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              )}

              <div className="mt-7">
                <p className="eyebrow text-[0.65rem]">Price</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <span className="font-sans text-[2rem] font-bold leading-none tabular-nums">{formatMoney(price)}</span>
                  {onSale && (
                    <>
                      <s className="text-base text-muted tabular-nums">{formatMoney(product.price)}</s>
                      <span className="rounded-full bg-pale px-3 py-1 text-xs font-bold text-rose-deep">{Math.round((1 - product.sale_price! / product.price) * 100)}% OFF</span>
                    </>
                  )}
                </div>
                {stock && <p className={cn("mt-2 text-xs font-semibold", stock.tone)}>{stock.text}</p>}
              </div>

              <ul className="mt-6 grid grid-cols-3 gap-3 text-[0.72rem] leading-tight text-plum-soft">
                <li className="flex items-center gap-2"><ShieldCheck className="size-5 shrink-0" aria-hidden /> Secure checkout</li>
                <li className="flex items-center gap-2"><Truck className="size-5 shrink-0" aria-hidden /> Doorstep delivery</li>
                <li className="flex items-center gap-2"><PackageSearch className="size-5 shrink-0" aria-hidden /> Order tracking</li>
              </ul>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <div className="inline-flex h-14 items-center rounded-full bg-white px-2 shadow-[0_10px_30px_-15px_rgba(37,25,35,0.4)]" role="group" aria-label="Quantity">
                  <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1 || !anyAvailable} className="grid size-10 place-items-center rounded-full transition hover:bg-blush disabled:opacity-30" aria-label="Decrease quantity">
                    <Minus className="size-4" />
                  </button>
                  <output className="w-8 text-center text-lg font-semibold tabular-nums" aria-live="polite">{qty}</output>
                  <button type="button" onClick={() => setQty((q) => Math.min(maxQty, q + 1))} disabled={qty >= maxQty || !anyAvailable} className="grid size-10 place-items-center rounded-full transition hover:bg-blush disabled:opacity-30" aria-label="Increase quantity">
                    <Plus className="size-4" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => submit(false)}
                  disabled={!anyAvailable || pending}
                  aria-busy={pending || undefined}
                  className="group inline-flex h-14 flex-1 items-center justify-between gap-4 whitespace-nowrap rounded-full bg-plum pl-7 pr-6 text-xs font-bold uppercase tracking-[0.16em] text-white shadow-[0_15px_35px_-15px_rgba(37,25,35,0.8)] transition duration-300 hover:bg-rose-deep active:scale-[0.98] disabled:opacity-50 sm:flex-none sm:min-w-56"
                >
                  {anyAvailable ? "Add to bag" : "Sold out"}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
                </button>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
                {mode === "product" && anyAvailable && (
                  <button type="button" onClick={() => submit(true)} disabled={pending} className="font-bold uppercase tracking-[0.16em] underline underline-offset-4 hover:text-rose-deep">
                    Buy now
                  </button>
                )}
                {mode === "hero" && (
                  <Link href={`/products/${product.slug}`} className="font-bold uppercase tracking-[0.16em] underline underline-offset-4 hover:text-rose-deep">
                    View details
                  </Link>
                )}
              </div>
              {error && <p className="mt-3 text-sm font-semibold text-danger" role="alert">{error}</p>}
            </div>
          </div>
          {footer && <div className="border-t border-plum/[0.07] px-5 py-5 sm:px-8 lg:px-10">{footer}</div>}
        </div>
      </div>
      {mode === "hero" && (
        <p className="sr-only" aria-live="polite">
          {`Showing ${index + 1} of ${products.length}: ${product.name}`}
        </p>
      )}
    </section>
  );
}
