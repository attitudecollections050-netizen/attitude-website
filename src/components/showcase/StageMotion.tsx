"use client";
import { useRef } from "react";
import { animate, m, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { Footprints, Gem, Glasses, Shirt, ShoppingBag, Sparkles, Watch } from "lucide-react";

const ORBIT_ICONS = [Shirt, ShoppingBag, Footprints, Glasses, Watch, Gem];

/**
 * Clothing & accessory badges circling the product ring. The ring turns slowly
 * while each badge counter-rotates (stays upright) and bobs on its own rhythm.
 */
export function FashionOrbit() {
  const reduce = useReducedMotion();
  return (
    <m.div
      className="pointer-events-none absolute inset-0"
      animate={reduce ? undefined : { rotate: 360 }}
      transition={{ duration: 48, repeat: Infinity, ease: "linear" }}
      aria-hidden
    >
      {ORBIT_ICONS.map((Icon, i) => {
        const deg = (360 / ORBIT_ICONS.length) * i + 20;
        const rad = (deg * Math.PI) / 180;
        return (
          <div
            key={i}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `calc(50% + (var(--r) + 0.2rem) * ${Math.cos(rad).toFixed(4)})`,
              top: `calc(50% + (var(--r) + 0.2rem) * ${Math.sin(rad).toFixed(4)})`,
            }}
          >
            <m.div animate={reduce ? undefined : { rotate: -360 }} transition={{ duration: 48, repeat: Infinity, ease: "linear" }}>
              <m.span
                className="grid size-9 place-items-center rounded-full border border-white/80 bg-white/70 text-rose-deep shadow-[0_8px_20px_-8px_rgba(217,79,145,0.55)] backdrop-blur-md xl:size-10"
                animate={reduce ? undefined : { y: [0, -7, 0], scale: [1, 1.08, 1] }}
                transition={{ duration: 3.2 + (i % 3) * 0.7, repeat: Infinity, ease: "easeInOut", delay: i * 0.35 }}
              >
                <Icon className="size-4 xl:size-[1.1rem]" strokeWidth={1.6} />
              </m.span>
            </m.div>
          </div>
        );
      })}
    </m.div>
  );
}

// Deterministic positions so server and client render the same markup.
const SPARKS = Array.from({ length: 10 }, (_, i) => ({
  left: 12 + ((i * 37) % 76),
  top: 30 + ((i * 53) % 55),
  size: 4 + (i % 3) * 2,
  delay: (i * 0.73) % 5,
  duration: 4.5 + (i % 4),
}));

/** Soft pink sparkles drifting upward around the product. */
export function Sparkle() {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {SPARKS.map((s, i) => (
        <m.span
          key={i}
          className="absolute rounded-full bg-rose/70 shadow-[0_0_10px_2px_rgba(217,79,145,0.45)]"
          style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size }}
          animate={{ y: [0, -60, -110], opacity: [0, 0.9, 0], scale: [0.6, 1, 0.4] }}
          transition={{ duration: s.duration, repeat: Infinity, delay: s.delay, ease: "easeOut" }}
        />
      ))}
      <m.span
        className="absolute right-[16%] top-[14%] text-rose/70"
        animate={{ rotate: [0, 18, 0], scale: [0.9, 1.15, 0.9], opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
      >
        <Sparkles className="size-5" />
      </m.span>
    </div>
  );
}

/**
 * Wraps the product photo: it floats gently, tilts in 3D toward the pointer,
 * and can be dragged/swiped sideways to move to the next or previous item.
 */
export function LivelyProduct({ children, onSwipe, onTap, className }: { children: React.ReactNode; onSwipe?: (dir: 1 | -1) => void; onTap?: () => void; className?: string }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const dragX = useMotionValue(0);
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-10, 10]), { stiffness: 150, damping: 18 });
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [8, -8]), { stiffness: 150, damping: 18 });
  const dragRotate = useTransform(dragX, [-160, 160], [-8, 8]);
  const start = useRef<{ x: number; y: number; t: number; id: number } | null>(null);

  const reset = () => {
    px.set(0);
    py.set(0);
  };

  return (
    <m.div
      ref={ref}
      className={className}
      style={reduce ? undefined : { rotateX, rotateY, x: dragX, rotate: dragRotate, transformPerspective: 900, touchAction: "pan-y" }}
      animate={reduce ? undefined : { y: [0, -10, 0] }}
      transition={{ y: { duration: 6, repeat: Infinity, ease: "easeInOut" } }}
      onPointerMove={(e) => {
        if (reduce) return;
        const r = ref.current?.getBoundingClientRect();
        if (r) {
          px.set((e.clientX - r.left) / r.width - 0.5);
          py.set((e.clientY - r.top) / r.height - 0.5);
        }
        if (onSwipe && start.current && start.current.id === e.pointerId) dragX.set((e.clientX - start.current.x) * 0.6);
      }}
      onPointerDown={(e) => {
        if (!onSwipe && !onTap) return;
        start.current = { x: e.clientX, y: e.clientY, t: Date.now(), id: e.pointerId };
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      }}
      onPointerUp={(e) => {
        const s = start.current;
        start.current = null;
        if (s) {
          const dx = e.clientX - s.x;
          // A short, still press is a tap (opens the full-screen gallery); a long sideways drag is a swipe.
          if (onTap && Math.hypot(dx, e.clientY - s.y) < 8 && Date.now() - s.t < 450) onTap();
          else if (onSwipe && Math.abs(dx) > 60) onSwipe(dx < 0 ? 1 : -1);
        }
        animate(dragX, 0, { type: "spring", stiffness: 260, damping: 22 });
      }}
      onPointerCancel={() => {
        start.current = null;
        animate(dragX, 0, { type: "spring", stiffness: 260, damping: 22 });
        reset();
      }}
      onPointerLeave={reset}
    >
      {children}
    </m.div>
  );
}
