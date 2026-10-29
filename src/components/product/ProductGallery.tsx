"use client";
import { useRef, useState } from "react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight, Expand } from "lucide-react";
import { useTranslations } from "next-intl";
import { SmartImage } from "@/components/ui/SmartImage";
import { cn } from "@/lib/cn";
import type { LightboxImage } from "./ProductLightbox";

/**
 * Standard product gallery: one large photo with thumbnails (down the side on
 * desktop, underneath on phones). Swipe or use the arrows to browse; tap the
 * photo to open the full-screen viewer.
 */
export function ProductGallery({
  images,
  index,
  onIndexChange,
  onOpen,
  title,
  overlay,
}: {
  images: LightboxImage[];
  index: number;
  onIndexChange: (i: number) => void;
  onOpen: () => void;
  title: string;
  /** Shown over the left edge of the main photo (the colour choices). */
  overlay?: React.ReactNode;
}) {
  const t = useTranslations("product");
  const reduce = useReducedMotion();
  const n = images.length;
  const img = images[index] ?? null;
  const [dir, setDir] = useState(1);
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  const go = (to: number) => {
    if (n < 2) return;
    const next = (to + n) % n;
    setDir(to > index ? 1 : -1);
    onIndexChange(next);
  };

  return (
    <div className={cn("flex flex-col gap-3", n > 1 && "lg:flex-row-reverse lg:gap-4")}>
      <div className="relative min-w-0 flex-1">
        <div
          className="group relative aspect-[4/5] w-full cursor-zoom-in select-none overflow-hidden rounded-xl bg-neutral sm:rounded-2xl"
          style={{ touchAction: "pan-y" }}
          onPointerDown={(e) => (start.current = { x: e.clientX, y: e.clientY, t: Date.now() })}
          onPointerUp={(e) => {
            const s = start.current;
            start.current = null;
            if (!s) return;
            const dx = e.clientX - s.x;
            const dy = e.clientY - s.y;
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(index + (dx < 0 ? 1 : -1));
            else if (Math.hypot(dx, dy) < 8 && Date.now() - s.t < 450 && !(e.target as HTMLElement).closest("button, [role=radiogroup]")) onOpen();
          }}
          onPointerCancel={() => (start.current = null)}
        >
          <AnimatePresence initial={false} custom={dir}>
            <m.div
              key={img?.id ?? "none"}
              className="absolute inset-0"
              custom={dir}
              initial={reduce ? { opacity: 0 } : { opacity: 0, x: `${dir * 6}%` }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: `${dir * -6}%` }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              <SmartImage
                src={img?.url}
                alt={img?.alt || title}
                fill
                preload
                draggable={false}
                sizes="(min-width:1024px) 50vw, 100vw"
                className="object-cover transition-transform duration-700 ease-[var(--ease-luxe)] group-hover:scale-[1.03]"
                fallbackLabel={title}
              />
            </m.div>
          </AnimatePresence>

          {overlay}
          {img && (
            <button
              type="button"
              onClick={onOpen}
              aria-label={t("openGallery")}
              className="absolute bottom-4 right-4 z-10 grid size-11 place-items-center rounded-full bg-white/90 text-plum shadow-md backdrop-blur transition hover:bg-plum hover:text-white"
            >
              <Expand className="size-4" aria-hidden />
            </button>
          )}
          {n > 1 && (
            <>
              <button
                type="button"
                onClick={() => go(index - 1)}
                aria-label={t("prevPhoto")}
                className="absolute left-3 top-1/2 z-10 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-plum opacity-0 shadow transition group-hover:opacity-100 focus-visible:opacity-100 sm:grid"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                onClick={() => go(index + 1)}
                aria-label={t("nextPhoto")}
                className="absolute right-3 top-1/2 z-10 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-plum opacity-0 shadow transition group-hover:opacity-100 focus-visible:opacity-100 sm:grid"
              >
                <ChevronRight className="size-5" />
              </button>
              {/* Dots on phones */}
              <div className="absolute inset-x-0 bottom-4 z-10 flex justify-center gap-1.5 sm:hidden" aria-hidden>
                {images.map((x, i) => (
                  <span key={x.id} className={cn("h-1.5 rounded-full transition-all", i === index ? "w-5 bg-white" : "w-1.5 bg-white/60")} />
                ))}
              </div>
            </>
          )}
        </div>
        <p className="sr-only" aria-live="polite">{t("photoOf", { current: index + 1, total: n })}</p>
      </div>

      {n > 1 && (
        <div className="flex gap-2 overflow-x-auto px-1.5 py-1.5 [scrollbar-width:none] lg:w-20 lg:flex-col lg:overflow-visible lg:py-0" role="group" aria-label={t("thumbnails")}>
          {images.map((x, i) => (
            <button
              key={x.id}
              type="button"
              onClick={() => go(i)}
              aria-label={t("showPhoto", { n: i + 1 })}
              aria-current={i === index ? "true" : undefined}
              className={cn(
                "relative aspect-[4/5] w-16 shrink-0 overflow-hidden rounded-lg bg-neutral transition lg:w-full",
                i === index ? "ring-2 ring-plum ring-offset-2" : "opacity-60 hover:opacity-100",
              )}
            >
              <SmartImage src={x.url} alt="" fill sizes="80px" className="object-cover" draggable={false} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
