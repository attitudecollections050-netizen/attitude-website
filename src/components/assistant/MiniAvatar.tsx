"use client";
import { useId } from "react";
import { m, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";

/**
 * Dj Attitude Mini — a little pink DJ girl with space buns, a bow and
 * headphones. Blinks on her own; her mouth moves while she is talking.
 */
export function MiniAvatar({ talking = false, listening = false, className }: { talking?: boolean; listening?: boolean; className?: string }) {
  const reduce = useReducedMotion();
  const id = useId().replace(/:/g, "");
  const animate = !reduce;

  return (
    <svg viewBox="0 0 120 120" className={cn("block", className)} aria-hidden focusable="false">
      <defs>
        <radialGradient id={`bg-${id}`} cx="50%" cy="38%" r="70%">
          <stop offset="0%" stopColor="#FFF0F5" />
          <stop offset="100%" stopColor="#FBD3E4" />
        </radialGradient>
        <linearGradient id={`hair-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F283B8" />
          <stop offset="100%" stopColor="#D94F91" />
        </linearGradient>
        <linearGradient id={`skin-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#B97A55" />
          <stop offset="100%" stopColor="#A2643F" />
        </linearGradient>
        <clipPath id={`clip-${id}`}>
          <circle cx="60" cy="60" r="60" />
        </clipPath>
      </defs>

      <g clipPath={`url(#clip-${id})`}>
        <circle cx="60" cy="60" r="60" fill={`url(#bg-${id})`} />

        {/* little sparkles */}
        <m.g animate={animate ? { opacity: [0.3, 1, 0.3] } : undefined} transition={{ duration: 2.4, repeat: Infinity }}>
          <path d="M18 30 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2z" fill="#F283B8" />
          <path d="M100 22 l1.5 3.5 l3.5 1.5 l-3.5 1.5 l-1.5 3.5 l-1.5 -3.5 l-3.5 -1.5 l3.5 -1.5z" fill="#D94F91" />
        </m.g>

        {/* body / top */}
        <path d="M24 122 C26 98 42 88 60 88 C78 88 94 98 96 122 Z" fill="#251923" />
        <path d="M44 92 Q60 104 76 92 L74 90 Q60 99 46 90 Z" fill="#F283B8" />
        <text x="60" y="114" textAnchor="middle" fontSize="10" fontWeight="700" fill="#F283B8" fontFamily="Manrope, sans-serif">A</text>
        <rect x="53" y="78" width="14" height="12" rx="5" fill={`url(#skin-${id})`} />

        {/* hair back + space buns */}
        <circle cx="34" cy="26" r="13" fill={`url(#hair-${id})`} />
        <circle cx="86" cy="26" r="13" fill={`url(#hair-${id})`} />
        <path d="M27 58 C24 30 40 18 60 18 C80 18 96 30 93 58 C95 70 92 80 86 84 L34 84 C28 80 25 70 27 58 Z" fill={`url(#hair-${id})`} />

        {/* face */}
        <ellipse cx="60" cy="56" rx="26" ry="27" fill={`url(#skin-${id})`} />

        {/* fringe */}
        <path d="M33 50 C34 30 50 26 60 28 C72 26 86 32 87 50 C80 40 72 37 66 38 C64 44 56 46 46 44 C40 44 36 46 33 50 Z" fill={`url(#hair-${id})`} />

        {/* eyes (blink) */}
        <m.g
          style={{ transformOrigin: "60px 58px", transformBox: "view-box" }}
          animate={animate ? { scaleY: [1, 1, 0.1, 1] } : undefined}
          transition={{ duration: 4, times: [0, 0.92, 0.96, 1], repeat: Infinity }}
        >
          <ellipse cx="50" cy="58" rx="4.6" ry="5.6" fill="#251923" />
          <ellipse cx="70" cy="58" rx="4.6" ry="5.6" fill="#251923" />
          <circle cx="51.8" cy="55.8" r="1.7" fill="#fff" />
          <circle cx="71.8" cy="55.8" r="1.7" fill="#fff" />
        </m.g>
        {/* lashes */}
        <path d="M44.5 54 l-2.5 -2 M45.5 52.4 l-1.6 -2.6 M75.5 54 l2.5 -2 M74.5 52.4 l1.6 -2.6" stroke="#251923" strokeWidth="1.3" strokeLinecap="round" />

        {/* blush */}
        <ellipse cx="44" cy="66" rx="5" ry="3" fill="#F283B8" opacity="0.65" />
        <ellipse cx="76" cy="66" rx="5" ry="3" fill="#F283B8" opacity="0.65" />

        {/* mouth */}
        {talking ? (
          <m.ellipse
            cx="60"
            cy="70"
            rx="4.5"
            fill="#7A2350"
            initial={{ ry: 1.5 }}
            animate={animate ? { ry: [1.5, 4, 2, 3.6, 1.5] } : { ry: 3 }}
            transition={{ duration: 0.6, repeat: Infinity }}
          />
        ) : (
          <path d="M53 68 Q60 75 67 68" stroke="#7A2350" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        )}

        {/* headphones */}
        <path d="M30 58 C28 30 44 20 60 20 C76 20 92 30 90 58" stroke="#251923" strokeWidth="5" fill="none" strokeLinecap="round" />
        <rect x="23" y="52" width="12" height="19" rx="6" fill="#251923" />
        <rect x="85" y="52" width="12" height="19" rx="6" fill="#251923" />
        <rect x="25.5" y="55" width="7" height="13" rx="3.5" fill="#D94F91" />
        <rect x="87.5" y="55" width="7" height="13" rx="3.5" fill="#D94F91" />
        <path d="M91 61.5 c-1.3-1.6-3.6-0.4-2.6 1.4 l2.6 2.6 l2.6-2.6 c1-1.8-1.3-3-2.6-1.4z" fill="#fff" />

        {/* bow */}
        <g transform="translate(84 14) rotate(12)">
          <path d="M0 0 L-9 -6 L-9 6 Z" fill="#251923" stroke="#251923" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M0 0 L9 -6 L9 6 Z" fill="#251923" stroke="#251923" strokeWidth="1.5" strokeLinejoin="round" />
          <circle r="2.6" fill="#F283B8" />
        </g>

        {/* listening rings */}
        {listening && (
          <m.circle cx="60" cy="60" r="56" fill="none" stroke="#D94F91" strokeWidth="3" initial={{ opacity: 0.8, scale: 0.9 }} animate={animate ? { opacity: [0.8, 0], scale: [0.9, 1.05] } : undefined} transition={{ duration: 1.2, repeat: Infinity }} style={{ transformOrigin: "60px 60px" }} />
        )}
      </g>
    </svg>
  );
}
