"use client";
import { useEffect, useRef, useState } from "react";
import { animate, m, useMotionValue, useReducedMotion, useTransform, type MotionValue } from "motion/react";
import { ChevronLeft, ChevronRight, Expand } from "lucide-react";
import { useTranslations } from "next-intl";
import { SmartImage } from "@/components/ui/SmartImage";
import { cn } from "@/lib/cn";
import type { LightboxImage } from "./ProductLightbox";

const SPRING = { type: "spring", stiffness: 170, damping: 26, mass: 0.9 } as const;
const VISIBLE = 3; // cards drawn on each side of the centre one

/** Signed distance from the centre card, wrapped so the ring of photos never runs out. */
function wrapped(i: number, pos: number, n: number) {
  let d = (((i - pos) % n) + n) % n;
  if (d > n / 2) d -= n;
  return d;
}

/**
 * 3D coverflow for products with many photos: the current photo faces the
 * shopper in a spotlight, the others fan out in perspective on both sides and
 * rotate into the centre. Drag/swipe, click a side photo, use the arrows, the
 * thumbnail rail or the keyboard. Clicking the centre photo opens full screen.
 */
export function CoverflowGallery({
  images,
  index,
  onIndexChange,
  onOpen,
  title,
}: {
  images: LightboxImage[];
  index: number;
  onIndexChange: (i: number) => void;
  onOpen: () => void;
  title: string;
}) {
  const t = useTranslations("product");
  const reduce = useReducedMotion();
  const n = images.length;
  const stage = useRef<HTMLDivElement>(null);
  const pos = useMotionValue(index);
  const [width, setWidth] = useState(0);
  const drag = useRef<{ x: number; y: number; p0: number; t: number; id: number; moved: boolean; axis?: "x" | "y" } | null>(null);
  const settled = useRef(index);

  // Follow index changes (arrows, thumbnails, colour change, full-screen viewer).
  useEffect(() => {
    // Move the shortest way round the ring.
    const cur = pos.get();
    let target = index;
    const diff = wrapped(index, cur, n);
    target = cur + diff;
    settled.current = index;
    if (reduce) pos.set(target);
    else animate(pos, target, SPRING);
  }, [index, n, pos, reduce]);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cardW = Math.min(width * (width < 520 ? 0.56 : 0.42), 340);
  const step = (dir: number) => onIndexChange((((index + dir) % n) + n) % n);

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button[data-control]")) return;
    drag.current = { x: e.clientX, y: e.clientY, p0: pos.get(), t: Date.now(), id: e.pointerId, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.axis) {
      if (Math.hypot(dx, dy) < 8) return;
      d.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (d.axis === "x") (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    }
    if (d.axis !== "x") return;
    d.moved = true;
    pos.stop();
    pos.set(d.p0 - dx / Math.max(cardW * 0.62, 80));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.id !== e.pointerId || !d.moved) return;
    const dx = e.clientX - d.x;
    const v = dx / Math.max(1, Date.now() - d.t);
    // Project a little momentum, then snap to the nearest photo.
    const target = Math.round(pos.get() - v * 1.6);
    const next = (((target % n) + n) % n);
    if (reduce) pos.set(target);
    else animate(pos, target, SPRING);
    settled.current = next;
    if (next !== index) onIndexChange(next);
  };

  return (
    <div className="relative">
      <div
        ref={stage}
        role="group"
        aria-roledescription="carousel"
        aria-label={t("galleryLabel", { name: title })}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") step(1);
          else if (e.key === "ArrowLeft") step(-1);
          else if (e.key === "Enter" || e.key === " ") onOpen();
          else return;
          e.preventDefault();
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (drag.current = null)}
        className="relative isolate aspect-[5/6] w-full select-none overflow-hidden rounded-[2.2rem] rounded-tr-[5rem] bg-[#251923] outline-offset-4 sm:aspect-[6/5] lg:aspect-[11/10]"
        style={{ touchAction: "pan-y", perspective: "1400px" }}
        dir="ltr"
      >
        {/* Spotlight, floor and fine lines */}
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_55%_at_50%_40%,rgba(217,79,145,0.38),transparent_70%)]" aria-hidden />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[32%] bg-[radial-gradient(70%_100%_at_50%_100%,rgba(251,228,238,0.12),transparent_70%)]" aria-hidden />
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,.9)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.9)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" aria-hidden />
        <m.div
          className="pointer-events-none absolute left-1/2 top-[8%] -z-10 h-[70%] w-[46%] -translate-x-1/2 rounded-full border border-rose/25"
          animate={reduce ? undefined : { rotate: 360 }}
          transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
          style={{ borderStyle: "dashed" }}
          aria-hidden
        />

        {/* Cards behind the screen plane (negative z) must still be clickable, so the layer itself ignores the pointer. */}
        <div className="pointer-events-none absolute inset-0" style={{ transformStyle: "preserve-3d" }}>
          {width > 0 &&
            images.map((img, i) => (
              <Card
                key={img.id}
                img={img}
                i={i}
                n={n}
                pos={pos}
                cardW={cardW}
                current={i === index}
                reduce={!!reduce}
                title={title}
                onSelect={() => (i === index ? onOpen() : onIndexChange(i))}
                label={i === index ? `${img.alt || title} · ${t("openGallery")}` : t("showPhoto", { n: i + 1 })}
              />
            ))}
        </div>

        {/* Controls */}
        <button
          type="button"
          data-control
          onClick={() => step(-1)}
          aria-label={t("prevPhoto")}
          className="absolute left-3 top-1/2 z-30 hidden size-11 -translate-y-1/2 place-items-center rounded-[1.15rem_0.45rem_1.15rem_0.45rem] bg-white/10 text-white backdrop-blur transition-[border-radius,background-color] duration-300 hover:rounded-[0.45rem_1.15rem_0.45rem_1.15rem] hover:bg-white/25 sm:left-5 sm:grid"
        >
          <ChevronLeft className="size-5" />
        </button>
        <button
          type="button"
          data-control
          onClick={() => step(1)}
          aria-label={t("nextPhoto")}
          className="absolute right-3 top-1/2 z-30 hidden size-11 -translate-y-1/2 place-items-center rounded-[1.15rem_0.45rem_1.15rem_0.45rem] bg-white/10 text-white backdrop-blur transition-[border-radius,background-color] duration-300 hover:rounded-[0.45rem_1.15rem_0.45rem_1.15rem] hover:bg-white/25 sm:right-5 sm:grid"
        >
          <ChevronRight className="size-5" />
        </button>
        <button
          type="button"
          data-control
          onClick={onOpen}
          aria-label={t("openGallery")}
          className="absolute bottom-4 right-4 z-30 flex h-10 items-center gap-2 rounded-full bg-white/90 pe-4 ps-3 text-xs font-semibold text-plum shadow-lg transition hover:bg-rose hover:text-white sm:bottom-5 sm:right-5"
        >
          <Expand className="size-4" aria-hidden />
          <span className="tabular-nums">
            {String(index + 1).padStart(2, "0")} / {String(n).padStart(2, "0")}
          </span>
        </button>
        <p className="pointer-events-none absolute bottom-5 left-5 z-30 hidden text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-white/50 sm:block" aria-hidden>
          {t("swipe")}
        </p>
        <p className="sr-only" aria-live="polite">{t("photoOf", { current: index + 1, total: n })}</p>
      </div>

      {/* Thumbnail rail with a progress line */}
      <div className="mt-4 flex items-center gap-3">
        <div className="relative h-0.5 flex-1 overflow-hidden rounded-full bg-plum/10" aria-hidden>
          <m.span className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-rose-deep to-rose" animate={{ width: `${((index + 1) / n) * 100}%` }} transition={{ duration: reduce ? 0 : 0.5 }} />
        </div>
      </div>
      <div className="mt-1 flex gap-2 overflow-x-auto px-1 pb-2 pt-3 [scrollbar-width:none]" role="group" aria-label={t("thumbnails")}>
        {images.map((img, i) => (
          <button
            key={img.id}
            type="button"
            onClick={() => onIndexChange(i)}
            aria-label={t("showPhoto", { n: i + 1 })}
            aria-current={i === index ? "true" : undefined}
            className={cn(
              "relative aspect-[3/4] w-12 shrink-0 overflow-hidden rounded-[0.9rem_0.35rem_0.9rem_0.35rem] bg-neutral transition duration-300 sm:w-14",
              i === index ? "-translate-y-1 ring-2 ring-rose ring-offset-2" : "opacity-60 hover:opacity-100",
            )}
          >
            <SmartImage src={img.url} alt="" fill sizes="56px" className="object-cover" draggable={false} />
          </button>
        ))}
      </div>
    </div>
  );
}

function Card({
  img,
  i,
  n,
  pos,
  cardW,
  current,
  reduce,
  title,
  onSelect,
  label,
}: {
  img: LightboxImage;
  i: number;
  n: number;
  pos: MotionValue<number>;
  cardW: number;
  current: boolean;
  reduce: boolean;
  title: string;
  onSelect: () => void;
  label: string;
}) {
  const d = useTransform(pos, (p) => wrapped(i, p, n));
  const abs = useTransform(d, Math.abs);
  // Side cards fan out with shrinking gaps, turn towards the centre and sink back.
  const x = useTransform(d, (v) => Math.sign(v) * (Math.min(Math.abs(v), 1) * cardW * 0.62 + Math.max(0, Math.abs(v) - 1) * cardW * 0.3));
  const rotateY = useTransform(d, (v) => (reduce ? 0 : -Math.max(-1, Math.min(1, v)) * 52));
  const z = useTransform(abs, (a) => (a < 1 ? 80 - a * 200 : -120 - (a - 1) * 90));
  const scale = useTransform(abs, (a) => 1 - Math.min(a, 3) * 0.06);
  const opacity = useTransform(abs, (a) => (a > VISIBLE + 0.4 ? 0 : a > VISIBLE - 0.6 ? Math.max(0, (VISIBLE + 0.4 - a)) : 1));
  const zIndex = useTransform(abs, (a) => Math.round(100 - a * 10));
  const shade = useTransform(abs, (a) => Math.min(0.55, a * 0.22));
  const visibility = useTransform(abs, (a) => (a > VISIBLE + 0.4 ? "hidden" : "visible"));

  return (
    <m.button
      type="button"
      onClick={onSelect}
      aria-label={label}
      aria-current={current ? "true" : undefined}
      tabIndex={current ? 0 : -1}
      className={cn("pointer-events-auto absolute left-1/2 top-[46%] block aspect-[3/4] cursor-pointer outline-none", current && "cursor-zoom-in")}
      style={{ width: cardW, marginLeft: -cardW / 2, marginTop: (-cardW * 4) / 3 / 2, x, z, rotateY, scale, opacity, zIndex, visibility, transformStyle: "preserve-3d" }}
    >
      <span
        className={cn(
          "absolute inset-0 overflow-hidden rounded-[1.6rem] rounded-tr-[3.2rem] bg-[#3a2534] shadow-[0_40px_70px_-30px_rgba(0,0,0,0.85)] transition-shadow duration-500 [-webkit-box-reflect:below_10px_linear-gradient(transparent_62%,rgba(255,255,255,0.22))]",
          current && "ring-2 ring-rose/80 ring-offset-4 ring-offset-[#251923]",
        )}
      >
        <SmartImage src={img.url} alt={current ? img.alt || title : ""} fill sizes="(min-width:1024px) 22rem, 60vw" className="object-cover" draggable={false} fallbackLabel={title} />
        <m.span className="absolute inset-0 bg-[#251923]" style={{ opacity: shade }} aria-hidden />
        <span className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/0 to-white/15" aria-hidden />
      </span>
    </m.button>
  );
}
