"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, animate, m, useMotionValue, useReducedMotion, useTransform, type MotionValue } from "motion/react";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { CloseIcon } from "@/components/brand/StoreIcons";
import { SmartImage } from "@/components/ui/SmartImage";
import { useDialog } from "@/components/ui/useDialog";
import { cn } from "@/lib/cn";

export interface LightboxImage {
  id: string;
  url: string;
  alt: string;
}

const MAX_ZOOM = 4;
const DOUBLE_TAP_ZOOM = 2.5;
const SPRING = { type: "spring", stiffness: 320, damping: 34 } as const;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Full-screen product photo viewer: swipe or arrow keys to browse, pinch,
 * double-tap, scroll-wheel or the +/− buttons to zoom, drag to pan while
 * zoomed, swipe down (or Escape / the phone's back button) to close.
 */
export function ProductLightbox({
  open,
  images,
  index,
  onIndexChange,
  onClose,
  title,
}: {
  open: boolean;
  images: LightboxImage[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
  title: string;
}) {
  const t = useTranslations("product");
  const reduce = useReducedMotion();
  const panel = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const thumbs = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [scale, setScaleState] = useState(1);
  const [chrome, setChrome] = useState(true);
  const aspects = useRef<Record<string, number>>({});

  const trackX = useMotionValue(0);
  const zs = useMotionValue(1);
  const zx = useMotionValue(0);
  const zy = useMotionValue(0);
  const dragY = useMotionValue(0);
  const backdrop = useTransform(dragY, [0, 320], [1, 0.25]);
  const count = images.length;
  const current = clamp(index, 0, Math.max(count - 1, 0));

  // ---------------------------------------------------------------- closing
  const closedByHistory = useRef(false);
  const close = useCallback(() => {
    if (window.history.state?.acLightbox) window.history.back();
    else onClose();
  }, [onClose]);
  useDialog(open, close, panel);

  // The phone/browser back button closes the viewer instead of leaving the page.
  useEffect(() => {
    if (!open) return;
    closedByHistory.current = false;
    window.history.pushState({ ...window.history.state, acLightbox: true }, "");
    const onPop = () => {
      closedByHistory.current = true;
      onClose();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (!closedByHistory.current && window.history.state?.acLightbox) window.history.back();
    };
  }, [open, onClose]);

  // ------------------------------------------------------------- measuring
  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const r = stage.current?.getBoundingClientRect();
      if (r) setSize({ w: r.width, h: r.height });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [open, chrome]);

  // --------------------------------------------------------------- zooming
  const bounds = useCallback(
    (s: number) => {
      const img = images[current];
      const ar = (img && aspects.current[img.id]) || size.w / Math.max(size.h, 1);
      const cw = Math.min(size.w, size.h * ar);
      const ch = Math.min(size.h, size.w / ar);
      return { x: Math.max(0, (s * cw - size.w) / 2), y: Math.max(0, (s * ch - size.h) / 2) };
    },
    [images, current, size],
  );
  const setZoom = useCallback(
    (s: number, x: number, y: number, animated = true) => {
      const ns = clamp(s, 1, MAX_ZOOM);
      const b = bounds(ns);
      const nx = ns === 1 ? 0 : clamp(x, -b.x, b.x);
      const ny = ns === 1 ? 0 : clamp(y, -b.y, b.y);
      if (animated && !reduce) {
        animate(zs, ns, SPRING);
        animate(zx, nx, SPRING);
        animate(zy, ny, SPRING);
      } else {
        zs.set(ns);
        zx.set(nx);
        zy.set(ny);
      }
      setScaleState(ns);
    },
    [bounds, reduce, zs, zx, zy],
  );
  /** Zoom by a factor keeping the point (px, py) — relative to the stage centre — under the finger. */
  const zoomAt = useCallback(
    (factor: number, px: number, py: number, animated = true) => {
      const s0 = zs.get();
      const s1 = clamp(s0 * factor, 1, MAX_ZOOM);
      const qx = (px - zx.get()) / s0;
      const qy = (py - zy.get()) / s0;
      setZoom(s1, px - s1 * qx, py - s1 * qy, animated);
    },
    [setZoom, zs, zx, zy],
  );

  // ----------------------------------------------------------- navigation
  const goTo = useCallback(
    (i: number) => {
      const next = clamp(i, 0, count - 1);
      setZoom(1, 0, 0, false);
      onIndexChange(next);
      if (reduce) trackX.set(-next * size.w);
      else animate(trackX, -next * size.w, SPRING);
    },
    [count, onIndexChange, reduce, setZoom, size.w, trackX],
  );

  // Keep the strip in place when opening, resizing or changing photo from outside.
  useLayoutEffect(() => {
    if (open && size.w) trackX.set(-current * size.w);
  }, [open, size.w, current, trackX]);

  // Reset when (re)opened.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setChrome(true);
      setScaleState(1);
    }
  }
  useEffect(() => {
    if (!open) return;
    zs.set(1);
    zx.set(0);
    zy.set(0);
    dragY.set(0);
  }, [open, zs, zx, zy, dragY]);

  // Keep the active thumbnail in view.
  useEffect(() => {
    if (!open) return;
    thumbs.current?.querySelector<HTMLElement>(`[data-thumb="${current}"]`)?.scrollIntoView({ block: "nearest", inline: "center", behavior: reduce ? "auto" : "smooth" });
  }, [open, current, reduce]);

  // ------------------------------------------------------------- keyboard
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.("input,textarea,select")) return;
      if (e.key === "ArrowRight") goTo(current + 1);
      else if (e.key === "ArrowLeft") goTo(current - 1);
      else if (e.key === "+" || e.key === "=") zoomAt(1.5, 0, 0);
      else if (e.key === "-" || e.key === "_") zoomAt(1 / 1.5, 0, 0);
      else if (e.key === "0") setZoom(1, 0, 0);
      else return;
      e.preventDefault();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, current, goTo, zoomAt, setZoom]);

  // -------------------------------------------------------------- gestures
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    kind: "none" | "pan" | "swipe" | "dismiss" | "pinch" | "pending";
    x0: number;
    y0: number;
    t0: number;
    zx0: number;
    zy0: number;
    track0: number;
    dist0?: number;
    s0?: number;
    qx?: number;
    qy?: number;
    moved: boolean;
    /** Recent finger speed (px/ms), for flicks. */
    vx?: number;
    vy?: number;
    lx?: number;
    ly?: number;
    lt?: number;
  } | null>(null);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const local = (x: number, y: number) => {
    const r = stage.current!.getBoundingClientRect();
    return { px: x - (r.left + r.width / 2), py: y - (r.top + r.height / 2) };
  };
  const startPinch = () => {
    const [a, b] = [...pointers.current.values()];
    const mid = local((a.x + b.x) / 2, (a.y + b.y) / 2);
    const s0 = zs.get();
    gesture.current = {
      kind: "pinch", x0: 0, y0: 0, t0: Date.now(), zx0: zx.get(), zy0: zy.get(), track0: trackX.get(), moved: true,
      dist0: Math.hypot(a.x - b.x, a.y - b.y), s0, qx: (mid.px - zx.get()) / s0, qy: (mid.py - zy.get()) / s0,
    };
    animate(trackX, -current * size.w, SPRING);
    animate(dragY, 0, SPRING);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    // Buttons over the photo (arrows) handle their own clicks.
    if ((e.target as HTMLElement).closest("button")) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) return startPinch();
    if (pointers.current.size > 2) return;
    gesture.current = { kind: "pending", x0: e.clientX, y0: e.clientY, t0: Date.now(), zx0: zx.get(), zy0: zy.get(), track0: trackX.get(), moved: false, lx: e.clientX, ly: e.clientY, lt: performance.now() };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (!g) return;
    if (g.kind === "pinch" && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const mid = local((a.x + b.x) / 2, (a.y + b.y) / 2);
      const s = clamp((g.s0! * Math.hypot(a.x - b.x, a.y - b.y)) / g.dist0!, 0.85, MAX_ZOOM + 0.5);
      zs.set(s);
      zx.set(mid.px - s * g.qx!);
      zy.set(mid.py - s * g.qy!);
      return;
    }
    const dx = e.clientX - g.x0;
    const dy = e.clientY - g.y0;
    const now = performance.now();
    if (g.lt !== undefined && now > g.lt) {
      const k = Math.min(1, (now - g.lt) / 50);
      g.vx = (g.vx ?? 0) * (1 - k) + ((e.clientX - g.lx!) / (now - g.lt)) * k;
      g.vy = (g.vy ?? 0) * (1 - k) + ((e.clientY - g.ly!) / (now - g.lt)) * k;
    }
    g.lx = e.clientX;
    g.ly = e.clientY;
    g.lt = now;
    if (g.kind === "pending") {
      if (Math.hypot(dx, dy) < 8) return;
      g.moved = true;
      g.kind = zs.get() > 1.01 ? "pan" : Math.abs(dx) > Math.abs(dy) ? "swipe" : dy > 0 ? "dismiss" : "swipe";
    }
    if (g.kind === "pan") {
      const b = bounds(zs.get());
      const rubber = (v: number, lim: number) => (v > lim ? lim + (v - lim) * 0.3 : v < -lim ? -lim + (v + lim) * 0.3 : v);
      zx.set(rubber(g.zx0 + dx, b.x));
      zy.set(rubber(g.zy0 + dy, b.y));
    } else if (g.kind === "swipe") {
      const atEdge = (current === 0 && dx > 0) || (current === count - 1 && dx < 0);
      trackX.set(g.track0 + (atEdge ? dx * 0.3 : dx));
    } else if (g.kind === "dismiss") {
      dragY.set(Math.max(0, dy));
    }
  };

  const endGesture = (e: React.PointerEvent, cancelled = false) => {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (!g) return;
    if (g.kind === "pinch") {
      if (pointers.current.size >= 1) {
        // One finger still down: carry on as a pan from here.
        const [p] = [...pointers.current.values()];
        gesture.current = { kind: "pan", x0: p.x, y0: p.y, t0: Date.now(), zx0: zx.get(), zy0: zy.get(), track0: trackX.get(), moved: true };
      } else gesture.current = null;
      const s = zs.get();
      setZoom(s < 1.05 ? 1 : s, zx.get(), zy.get());
      return;
    }
    if (pointers.current.size > 0) return;
    gesture.current = null;
    const dx = e.clientX - g.x0;
    const dy = e.clientY - g.y0;
    const dt = Math.max(1, Date.now() - g.t0);
    if (cancelled) {
      animate(trackX, -current * size.w, SPRING);
      animate(dragY, 0, SPRING);
      return;
    }
    if (g.kind === "pan") return setZoom(zs.get(), zx.get(), zy.get());
    if (g.kind === "swipe") {
      const fast = Math.abs(g.vx ?? dx / dt) > 0.35;
      if ((dx < -size.w * 0.18 || (fast && dx < -30)) && current < count - 1) return goTo(current + 1);
      if ((dx > size.w * 0.18 || (fast && dx > 30)) && current > 0) return goTo(current - 1);
      return goTo(current);
    }
    if (g.kind === "dismiss") {
      if (dy > 120 || (dy > 40 && (g.vy ?? dy / dt) > 0.5)) return close();
      animate(dragY, 0, SPRING);
      return;
    }
    // A tap: double tap zooms, single tap shows/hides the controls.
    if (dt < 300) {
      const now = Date.now();
      const prev = lastTap.current;
      if (prev && now - prev.t < 300 && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < 30) {
        lastTap.current = null;
        if (tapTimer.current) clearTimeout(tapTimer.current);
        if (zs.get() > 1.01) setZoom(1, 0, 0);
        else {
          const { px, py } = local(e.clientX, e.clientY);
          setZoom(DOUBLE_TAP_ZOOM, -px * (DOUBLE_TAP_ZOOM - 1), -py * (DOUBLE_TAP_ZOOM - 1));
        }
        return;
      }
      lastTap.current = { t: now, x: e.clientX, y: e.clientY };
      if (tapTimer.current) clearTimeout(tapTimer.current);
      if (e.pointerType !== "mouse") tapTimer.current = setTimeout(() => setChrome((c) => !c), 300);
    }
  };

  useEffect(() => () => {
    if (tapTimer.current) clearTimeout(tapTimer.current);
  }, []);

  const onWheel = (e: React.WheelEvent) => {
    const { px, py } = local(e.clientX, e.clientY);
    if (zs.get() <= 1.01 && !e.ctrlKey && Math.abs(e.deltaX) > Math.abs(e.deltaY) * 1.5 && Math.abs(e.deltaX) > 30) {
      return goTo(current + (e.deltaX > 0 ? 1 : -1));
    }
    zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0025)), px, py, false);
  };

  const iconBtn =
    "grid size-11 place-items-center rounded-[1.15rem_0.45rem_1.15rem_0.45rem] bg-white/10 text-white backdrop-blur transition-[border-radius,background-color] duration-300 hover:rounded-[0.45rem_1.15rem_0.45rem_1.15rem] hover:bg-white/20 disabled:opacity-30";

  return (
    <AnimatePresence>
      {open && (
        <m.div
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-label={t("galleryLabel", { name: title })}
          tabIndex={-1}
          className="fixed inset-0 z-[90] flex flex-col text-white outline-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.2 } }}
        >
          <m.div className="absolute inset-0 bg-[#130c12]" style={{ opacity: backdrop }} aria-hidden />

          {/* Top bar */}
          <m.div
            className="relative z-10 flex items-center gap-3 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5"
            animate={{ opacity: chrome ? 1 : 0, y: chrome ? 0 : -12 }}
            style={{ pointerEvents: chrome ? "auto" : "none" }}
          >
            <p className="min-w-0 flex-1 truncate font-display text-lg sm:text-xl" lang="und">{title}</p>
            <p className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tabular-nums" aria-live="polite">
              <span className="sr-only">{t("photoOf", { current: current + 1, total: count })}</span>
              <span aria-hidden>{current + 1} / {count}</span>
            </p>
            <div className="hidden items-center gap-1.5 sm:flex">
              <button type="button" className={iconBtn} onClick={() => zoomAt(1 / 1.5, 0, 0)} disabled={scale <= 1} aria-label={t("zoomOut")}>
                <Minus className="size-4" />
              </button>
              <button type="button" className={iconBtn} onClick={() => zoomAt(1.5, 0, 0)} disabled={scale >= MAX_ZOOM} aria-label={t("zoomIn")}>
                <Plus className="size-4" />
              </button>
            </div>
            <button type="button" className={iconBtn} onClick={close} aria-label={t("closeGallery")}>
              <CloseIcon className="size-5" />
            </button>
          </m.div>

          {/* Photos */}
          <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row-reverse">
            <div
              ref={stage}
              dir="ltr"
              className={cn("relative min-h-0 flex-1 overflow-hidden", scale > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in")}
              style={{ touchAction: "none" }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={(e) => endGesture(e)}
              onPointerCancel={(e) => endGesture(e, true)}
              onWheel={onWheel}
              onDoubleClick={(e) => {
                if (e.nativeEvent instanceof PointerEvent && e.nativeEvent.pointerType !== "mouse") return;
                if (zs.get() > 1.01) setZoom(1, 0, 0);
                else {
                  const { px, py } = local(e.clientX, e.clientY);
                  setZoom(DOUBLE_TAP_ZOOM, -px * (DOUBLE_TAP_ZOOM - 1), -py * (DOUBLE_TAP_ZOOM - 1));
                }
              }}
            >
              <m.div className="flex h-full" style={{ x: trackX, y: dragY }}>
                {images.map((img, i) => (
                  <Slide
                    key={img.id}
                    image={img}
                    active={i === current}
                    near={Math.abs(i - current) <= 1}
                    width={size.w}
                    zs={zs}
                    zx={zx}
                    zy={zy}
                    title={title}
                    onAspect={(ar) => {
                      aspects.current[img.id] = ar;
                    }}
                  />
                ))}
              </m.div>

              {count > 1 && (
                <m.div className="pointer-events-none absolute inset-y-0 left-0 right-0 hidden items-center justify-between px-4 sm:flex" animate={{ opacity: chrome ? 1 : 0 }}>
                  <button type="button" className={cn(iconBtn, "pointer-events-auto size-12")} onClick={() => goTo(current - 1)} disabled={current === 0} aria-label={t("prevPhoto")}>
                    <ChevronLeft className="size-5" />
                  </button>
                  <button type="button" className={cn(iconBtn, "pointer-events-auto size-12")} onClick={() => goTo(current + 1)} disabled={current === count - 1} aria-label={t("nextPhoto")}>
                    <ChevronRight className="size-5" />
                  </button>
                </m.div>
              )}
            </div>

            {/* Thumbnails: along the bottom on phones, down the side on large screens */}
            {count > 1 && (
              <m.div
                ref={thumbs}
                role="group"
                aria-label={t("thumbnails")}
                className="relative z-10 flex shrink-0 gap-2 overflow-x-auto px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 [scrollbar-width:none] lg:w-28 lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden lg:px-4 lg:py-4"
                animate={{ opacity: chrome ? 1 : 0, y: chrome ? 0 : 16 }}
                style={{ pointerEvents: chrome ? "auto" : "none" }}
              >
                {images.map((img, i) => (
                  <button
                    key={img.id}
                    type="button"
                    data-thumb={i}
                    onClick={() => goTo(i)}
                    aria-label={t("showPhoto", { n: i + 1 })}
                    aria-current={i === current ? "true" : undefined}
                    className={cn(
                      "relative aspect-[3/4] w-14 shrink-0 overflow-hidden rounded-[0.9rem_0.35rem_0.9rem_0.35rem] bg-white/10 transition duration-300 lg:w-full",
                      i === current ? "opacity-100 ring-2 ring-rose ring-offset-2 ring-offset-[#130c12]" : "opacity-50 hover:opacity-90",
                    )}
                  >
                    <SmartImage src={img.url} alt="" fill sizes="80px" className="object-cover" draggable={false} />
                  </button>
                ))}
              </m.div>
            )}
          </div>

          <m.p className="pointer-events-none absolute inset-x-0 bottom-24 z-10 text-center text-[0.68rem] text-white/60 lg:bottom-6" animate={{ opacity: chrome && scale === 1 ? 1 : 0 }} aria-hidden>
            {t("galleryHint")}
          </m.p>
        </m.div>
      )}
    </AnimatePresence>
  );
}

function Slide({
  image,
  active,
  near,
  width,
  zs,
  zx,
  zy,
  title,
  onAspect,
}: {
  image: LightboxImage;
  active: boolean;
  near: boolean;
  width: number;
  zs: MotionValue<number>;
  zx: MotionValue<number>;
  zy: MotionValue<number>;
  title: string;
  onAspect: (ar: number) => void;
}) {
  return (
    <div className="relative h-full shrink-0 select-none" style={{ width: width || "100%" }} aria-hidden={!active}>
      {near && (
        <m.div className="absolute inset-0" style={active ? { scale: zs, x: zx, y: zy } : undefined}>
          <SmartImage
            src={image.url}
            alt={image.alt || title}
            fill
            // Twice the screen width on phones/tablets so zoomed-in details stay sharp.
            sizes="(min-width: 1024px) 100vw, 200vw"
            preload={active}
            draggable={false}
            className="object-contain"
            fallbackLabel={title}
            onLoad={(e) => {
              const el = e.currentTarget as HTMLImageElement;
              if (el.naturalWidth && el.naturalHeight) onAspect(el.naturalWidth / el.naturalHeight);
            }}
          />
        </m.div>
      )}
    </div>
  );
}
