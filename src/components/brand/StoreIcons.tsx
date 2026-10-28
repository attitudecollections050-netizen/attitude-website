"use client";
import { m, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";

// Attitude Collections' own icon set: a tote with a heart clasp, a portrait with a
// sparkle, a lens with a glint and an asymmetric menu. Stroke-based, 24×24,
// drawn in currentColor so they follow the surrounding text colour.

type IconProps = { className?: string; strokeWidth?: number };

const base = (className?: string) => cn("size-5 shrink-0", className);

/** Tote bag with an arched handle and a heart clasp. Change `swing` to make the handle sway. */
export function BagIcon({ className, strokeWidth = 1.6, swing }: IconProps & { swing?: number }) {
  const reduce = useReducedMotion();
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={base(className)} aria-hidden>
      <m.path
        key={swing}
        d="M8.6 9.4V7.7a3.4 3.4 0 0 1 6.8 0v1.7"
        style={{ originX: "50%", originY: "100%" }}
        animate={reduce || !swing ? { rotate: 0 } : { rotate: [-16, 11, -6, 3, 0] }}
        transition={{ duration: 0.9, ease: "easeOut" }}
      />
      <path d="M5.1 9.4h13.8l-1.15 9.5a2.3 2.3 0 0 1-2.28 2H8.53a2.3 2.3 0 0 1-2.28-2z" />
      <path d="M12 16.4c-1.7-1.05-2.45-1.9-2.45-2.75a1.25 1.25 0 0 1 2.45-.45 1.25 1.25 0 0 1 2.45.45c0 .85-.75 1.7-2.45 2.75z" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Portrait with a small sparkle; the sparkle fills in when `active` (e.g. signed in). */
export function ProfileIcon({ className, strokeWidth = 1.6, active = false }: IconProps & { active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={base(className)} aria-hidden>
      <circle cx="11" cy="8.9" r="3.5" />
      <path d="M4.2 20.4c.95-3.7 3.55-5.75 6.8-5.75 3.25 0 5.85 2.05 6.8 5.75" />
      <path
        d="M18.9 2.6l.55 1.45 1.45.55-1.45.55-.55 1.45-.55-1.45-1.45-.55 1.45-.55z"
        className={cn("transition-colors duration-300", active ? "fill-rose stroke-rose" : "fill-current")}
        strokeWidth={0.8}
      />
    </svg>
  );
}

/** Magnifier with a glint inside and a tapered handle. */
export function SearchIcon({ className, strokeWidth = 1.6 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={base(className)} aria-hidden>
      <circle cx="10.4" cy="10.4" r="6.4" />
      <path d="M15.2 15.2l4.9 4.9" strokeWidth={strokeWidth + 0.9} />
      <path d="M8.3 7.3c.3 1.05.75 1.5 1.8 1.8-1.05.3-1.5.75-1.8 1.8-.3-1.05-.75-1.5-1.8-1.8 1.05-.3 1.5-.75 1.8-1.8z" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Asymmetric menu: three lines of falling length and a rose dot. Lines even out on hover (needs a `group` parent). */
export function MenuIcon({ className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" className={base(className)} aria-hidden>
      <path d="M4 6.5h16" />
      <path d="M4 12h11" className="origin-left transition-transform duration-300 group-hover:scale-x-[1.45]" />
      <path d="M4 17.5h6" className="origin-left transition-transform duration-300 group-hover:scale-x-[2.65]" />
      <circle cx="17.6" cy="17.5" r="1.45" className="fill-rose stroke-none transition-opacity duration-300 group-hover:opacity-0" />
    </svg>
  );
}

/** Two softly curved strokes crossing over a dot. */
export function CloseIcon({ className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" className={base(className)} aria-hidden>
      <path d="M6.2 6.2c3.6 3.2 8.4 8 11.6 11.6" />
      <path d="M17.8 6.2c-3.2 3.6-8 8.4-11.6 11.6" />
      <circle cx="12" cy="12" r="1.15" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Heart-shaped counter badge for the bag. */
export function HeartBadge({ count, className }: { count: number; className?: string }) {
  return (
    <span className={cn("relative grid h-[1.35rem] w-[1.5rem] place-items-center", className)}>
      <svg viewBox="0 0 24 22" className="absolute inset-0 size-full drop-shadow-[0_3px_6px_rgba(217,79,145,0.55)]" aria-hidden>
        <path d="M12 21C4.6 16.4 1 12.3 1 8.1 1 4.6 3.7 2 7 2c2.1 0 3.9 1.1 5 2.8C13.1 3.1 14.9 2 17 2c3.3 0 6 2.6 6 6.1 0 4.2-3.6 8.3-11 12.9z" className="fill-rose stroke-white" strokeWidth={1.6} />
      </svg>
      <span className="relative -mt-0.5 text-[0.58rem] font-bold leading-none text-white tabular-nums">{count > 99 ? "99+" : count}</span>
    </span>
  );
}
