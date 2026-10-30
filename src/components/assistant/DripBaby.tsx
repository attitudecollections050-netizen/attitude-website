"use client";
import { useId } from "react";
import { m, useMotionValue, useReducedMotion, useTransform, type MotionValue, type TargetAndTransition, type Transition } from "motion/react";
import { cn } from "@/lib/cn";
import { DEFAULT_LOOK, type CharacterId, type DripAction, type ModelLook } from "@/lib/assistant/characters";

/**
 * FAF Drip Guy / FAF Drip Queen — pink, flashy anime babies (big head, chubby cheeks,
 * sparkly eyes) in baggy streetwear. Each body part has its own animation so the
 * character can dab, dance, spin, measure, faint and so on. `variant="head"` crops to
 * the face for the chat button and message avatars.
 */

type Eyes = "normal" | "star" | "happy" | "x" | "side" | "heart" | "big" | "up";
interface Pose {
  body?: TargetAndTransition;
  head?: TargetAndTransition;
  armL?: TargetAndTransition;
  armR?: TargetAndTransition;
  legL?: TargetAndTransition;
  legR?: TargetAndTransition;
  eyes?: Eyes;
  loop?: boolean;
  dur?: number;
}

const POSES: Partial<Record<DripAction, Pose>> = {
  idle: { body: { y: [0, -2, 0] }, armL: { rotate: [6, 12, 6] }, armR: { rotate: [-6, -12, -6] }, loop: true, dur: 2.6 },
  wave: { armR: { rotate: [0, -150, -115, -150, -115, -150, 0] }, head: { rotate: [0, -6, 0, -6, 0] }, dur: 2.2 },
  dab: { armR: { rotate: [0, -128, -128, -128, 0] }, armL: { rotate: [0, -150, -150, -150, 0] }, head: { rotate: [0, -20, -20, -20, 0], y: [0, 6, 6, 6, 0] }, body: { rotate: [0, -6, -6, -6, 0] }, dur: 1.8 },
  spin: { armL: { rotate: [6, 30, 6] }, armR: { rotate: [-6, -30, -6] }, dur: 1.6 },
  fire: { body: { y: [0, -12, 0, -12, 0, -12, 0] }, armR: { rotate: [0, -165, -120, -165, -120, -165, 0] }, armL: { rotate: [0, 40, 20, 40, 0] }, eyes: "star", dur: 2 },
  dance: {
    body: { y: [0, -7, 0, -7, 0], rotate: [-7, 7, -7, 7, -7] },
    armL: { rotate: [50, -10, 50, -10, 50] },
    armR: { rotate: [10, -50, 10, -50, 10] },
    legL: { rotate: [0, -22, 0, -22, 0] },
    legR: { rotate: [22, 0, 22, 0, 22] },
    head: { rotate: [6, -6, 6, -6, 6] },
    eyes: "happy",
    loop: true,
    dur: 1.1,
  },
  measure: { armL: { rotate: [0, -40, -35, -40] }, armR: { rotate: [0, 40, 35, 40] }, head: { rotate: [0, 8, 8, 0], y: [0, 4, 4, 0] }, dur: 2.4 },
  try_on: { armR: { rotate: [0, -95, -85, -95, -20] }, body: { y: [0, 0, -8, 0] }, eyes: "star", dur: 1.8 },
  boxing: { armR: { rotate: [0, -170, -150, -170] }, armL: { rotate: [0, 95, 70, 95] }, dur: 1.6 },
  roast: { armL: { rotate: [0, -75] }, armR: { rotate: [0, 75] }, head: { rotate: [0, 10, 6, 10] }, eyes: "side", dur: 1.2 },
  cross_arms: { armL: { rotate: [0, -75] }, armR: { rotate: [0, 75] }, head: { rotate: [0, -8] }, eyes: "side", dur: 1 },
  celebrate: { body: { y: [0, -16, 0, -16, 0] }, armL: { rotate: [160, 130, 160, 130, 160] }, armR: { rotate: [-160, -130, -160, -130, -160] }, eyes: "happy", loop: true, dur: 1.2 },
  strut: { body: { y: [0, -4, 0, -4, 0] }, legL: { rotate: [-16, 16, -16] }, legR: { rotate: [16, -16, 16] }, armL: { rotate: [20, -20, 20] }, armR: { rotate: [20, -20, 20] }, head: { rotate: [0, 4, 0, -4, 0] }, loop: true, dur: 1 },
  pose: { body: { rotate: [0, 6, 6] }, armL: { rotate: [0, 35, 35] }, armR: { rotate: [0, -8, -8] }, head: { rotate: [0, -8, -8] }, dur: 1 },
  beg: { armL: { rotate: [0, -35, -30, -35] }, armR: { rotate: [0, 35, 30, 35] }, body: { y: [0, -4, 0, -4, 0] }, eyes: "big", dur: 1.6 },
  blow_kiss: { armR: { rotate: [0, -165, -165, -110, 0] }, head: { rotate: [0, -8, -8, 0] }, eyes: "heart", dur: 1.8 },
  hair_flip: { head: { rotate: [0, -28, 16, 0] }, armR: { rotate: [0, -160, -140, 0] }, dur: 1.2 },
  faint: { eyes: "x", armL: { rotate: [0, 150, 150, 0] }, armR: { rotate: [0, -150, -150, 0] }, dur: 2.4 },
  whisper: { armR: { rotate: [0, -168, -168] }, head: { rotate: [0, 10, 10] }, body: { rotate: [0, 5, 5] }, dur: 1 },
  think: { armR: { rotate: [0, -170, -170] }, head: { rotate: [0, -8, -8] }, eyes: "up", dur: 1 },
};

const BUILD = { slim: 0.88, regular: 1, thick: 1.16 } as const;
const HEIGHT = { short: 0.88, average: 1, tall: 1.12 } as const;

export function DripBaby({
  character,
  look,
  action = "idle",
  playKey = 0,
  talking = false,
  listening = false,
  outfitImage,
  backness,
  variant = "full",
  className,
}: {
  character: CharacterId;
  look?: ModelLook;
  action?: DripAction;
  /** Changes to restart the same action. */
  playKey?: number;
  talking?: boolean;
  listening?: boolean;
  /** Product photo "worn" during a try-on. */
  outfitImage?: string | null;
  /** 0–1: how much of the back is showing (during a spin). */
  backness?: MotionValue<number>;
  variant?: "full" | "head";
  className?: string;
}) {
  const reduce = useReducedMotion();
  const id = useId().replace(/:/g, "");
  const none = useMotionValue(0);
  const front = useTransform(backness ?? none, (v) => 1 - v);
  const queen = character === "queen";
  const l = look ?? DEFAULT_LOOK[character];
  const skin = l.skin;
  const pose = (reduce ? POSES.idle : POSES[action]) ?? POSES.idle!;
  const tr: Transition = { duration: pose.dur ?? 1.4, ease: "easeInOut", repeat: pose.loop && !reduce ? Infinity : 0 };
  const eyes: Eyes = talking && pose.eyes === undefined ? "normal" : (pose.eyes ?? "normal");
  const hoodie = queen ? "#FF5FAE" : "#FF3EA5";
  const hoodieDark = queen ? "#E0408F" : "#C81E7E";
  const pants = queen ? "#A49DB0" : "#2C2433";
  const pantsLine = queen ? "#C9C3D3" : "#4A3F55";
  const sx = BUILD[l.build];
  const sy = HEIGHT[l.height];
  const k = `${action}-${playKey}`;
  const part = (p?: TargetAndTransition) => (p ? { ...p, transition: tr } : { rotate: 0, y: 0, x: 0, transition: { duration: 0.3 } });

  return (
    <svg viewBox={variant === "head" ? "26 14 148 148" : "0 0 200 262"} className={cn("block overflow-visible", className)} aria-hidden focusable="false">
      <defs>
        <radialGradient id={`aura-${id}`}>
          <stop offset="0" stopColor="#FFE0F0" />
          <stop offset="0.6" stopColor="#FF8CC6" stopOpacity="0.55" />
          <stop offset="1" stopColor="#FF1493" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`hair-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={queen ? "#FFB3DA" : "#3A2433"} />
          <stop offset="0.5" stopColor={queen ? "#FF5FAE" : "#5B3150"} />
          <stop offset="1" stopColor={queen ? "#C77DFF" : "#2A1626"} />
        </linearGradient>
        <linearGradient id={`cap-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FF8CC6" />
          <stop offset="1" stopColor="#FF1493" />
        </linearGradient>
        <radialGradient id={`iris-${id}`} cx="50%" cy="35%">
          <stop offset="0" stopColor={queen ? "#FF9AD5" : "#FF6FB5"} />
          <stop offset="0.6" stopColor={queen ? "#B23A8A" : "#8E2A6B"} />
          <stop offset="1" stopColor="#3B0F33" />
        </radialGradient>
        <linearGradient id={`gold-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFF3B0" />
          <stop offset="0.5" stopColor="#E9B93B" />
          <stop offset="1" stopColor="#FFE58A" />
        </linearGradient>
        <clipPath id={`outfit-${id}`}>
          <path d="M62 214 Q58 160 100 152 Q142 160 138 214 Z" />
          <rect x="66" y="208" width="68" height="40" rx="10" />
        </clipPath>
      </defs>

      {variant === "full" ? (
        <m.circle cx="100" cy="130" r="98" fill={`url(#aura-${id})`} animate={reduce ? undefined : { scale: [1, 1.06, 1], opacity: [0.8, 1, 0.8] }} transition={{ duration: 2.4, repeat: Infinity }} />
      ) : (
        <circle cx="100" cy="88" r="74" fill={`url(#aura-${id})`} />
      )}

      {/* body (scaled for build and height, standing on the ground line) */}
      <g transform={`translate(100 250) scale(${sx} ${sy}) translate(-100 -250)`}>
        <m.g key={`b-${k}`} animate={part(pose.body)} style={{ originX: 0.5, originY: 1 }}>
          {/* legs: baggy pants + sneakers */}
          {[
            { x: 70, p: pose.legL, key: "l" },
            { x: 102, p: pose.legR, key: "r" },
          ].map((leg) => (
            <m.g key={`${leg.key}-${k}`} animate={part(leg.p)} style={{ originX: 0.5, originY: 0 }}>
              <path d={`M${leg.x} 206 h28 l3 36 h-34 z`} fill={pants} />
              <path d={`M${leg.x + 10} 212 v26 M${leg.x + 19} 214 q2 10 -1 22`} stroke={pantsLine} strokeWidth="1.5" fill="none" />
              <path d={`M${leg.x - 5} 241 h38 q6 0 6 6 v4 h-48 v-4 q0 -6 4 -6 z`} fill="#fff" stroke="#FFB3DA" strokeWidth="1.5" />
              <path d={`M${leg.x + 2} 246 q10 -6 22 0`} stroke="#FF3EA5" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            </m.g>
          ))}
          {/* waistband (a small sag for the street look) */}
          <rect x="68" y="200" width="64" height="9" rx="3" fill={queen ? "#fff" : "#FFD1E8"} />
          <path d="M70 204.5 h60" stroke={queen ? "#FF8CC6" : "#FF3EA5"} strokeWidth="2" strokeDasharray="5 3" />
          {/* hoodie / jersey */}
          <path d="M62 204 Q58 160 100 152 Q142 160 138 204 Z" fill={hoodie} />
          <path d="M80 158 Q100 174 120 158" fill="none" stroke={hoodieDark} strokeWidth="4" strokeLinecap="round" />
          <text x="100" y="192" textAnchor="middle" fontSize="15" fontWeight="900" fill="#fff" fontFamily="system-ui, sans-serif" letterSpacing="1">
            FAF
          </text>
          {/* sparkle glitter on the outfit */}
          {[
            [72, 176],
            [128, 184],
            [90, 198],
            [116, 168],
          ].map(([x, y], i) => (
            <m.path
              key={i}
              d={`M${x} ${y - 3} l1 2 2 1 -2 1 -1 2 -1 -2 -2 -1 2 -1z`}
              fill="#fff"
              animate={reduce ? undefined : { opacity: [0.2, 1, 0.2] }}
              transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.35 }}
            />
          ))}
          {/* gold chain */}
          {!queen && (
            <g>
              <path d="M84 160 Q100 182 116 160" fill="none" stroke={`url(#gold-${id})`} strokeWidth="3" strokeDasharray="3 1.5" />
              <path d="M100 172 l5 6 -5 6 -5 -6z" fill="#FF8CC6" stroke={`url(#gold-${id})`} strokeWidth="1.5" />
            </g>
          )}
          {queen && <rect x="120" y="190" width="16" height="13" rx="3" fill="#fff" stroke="#FF5FAE" strokeWidth="2" />}

          {/* magic try-on: the product photo becomes the outfit */}
          {outfitImage && (
            <m.g key={`o-${outfitImage}-${playKey}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.4 }}>
              <image href={outfitImage} x="56" y="148" width="88" height="102" preserveAspectRatio="xMidYMid slice" clipPath={`url(#outfit-${id})`} />
              <path d="M62 204 Q58 160 100 152 Q142 160 138 204 Z" fill="none" stroke="#fff" strokeWidth="2" opacity="0.8" />
            </m.g>
          )}

          {/* measuring tape */}
          {action === "measure" && (
            <m.g initial={{ scaleX: 0.2, opacity: 0 }} animate={{ scaleX: [0.2, 1.1, 1], opacity: 1 }} transition={{ duration: 1 }} style={{ originX: 0.5 }}>
              <rect x="52" y="198" width="96" height="9" rx="2" fill="#FFD93B" stroke="#C9A300" />
              {Array.from({ length: 12 }, (_, i) => (
                <path key={i} d={`M${56 + i * 8} 198 v4`} stroke="#7A5C00" strokeWidth="1" />
              ))}
            </m.g>
          )}

          {/* arms */}
          {[
            { x: 66, p: pose.armL, key: "al" },
            { x: 134, p: pose.armR, key: "ar" },
          ].map((arm) => (
            <m.g key={`${arm.key}-${k}`} animate={part(arm.p)} style={{ originX: 0.5, originY: 0.08 }}>
              <path d={`M${arm.x} 162 L${arm.x} 196`} stroke={hoodie} strokeWidth="16" strokeLinecap="round" />
              <circle cx={arm.x} cy="201" r="7.5" fill={skin} />
            </m.g>
          ))}
        </m.g>
      </g>

      {/* head */}
      <m.g key={`h-${k}`} animate={part(pose.head)} style={{ originX: 0.5, originY: 1 }}>
        {/* hair behind */}
        {queen ? (
          <g fill={`url(#hair-${id})`}>
            <circle cx="52" cy="38" r="24" />
            <circle cx="148" cy="38" r="24" />
            <ellipse cx="100" cy="88" rx="70" ry="66" />
          </g>
        ) : (
          <ellipse cx="100" cy="86" rx="66" ry="62" fill={`url(#hair-${id})`} />
        )}
        <ellipse cx="38" cy="100" rx="9" ry="11" fill={skin} />
        <ellipse cx="162" cy="100" rx="9" ry="11" fill={skin} />
        {/* big baby face */}
        <ellipse cx="100" cy="98" rx="62" ry="56" fill={skin} />
        {/* back of the head while spinning */}
        {backness && <m.ellipse cx="100" cy="94" rx="64" ry="60" fill={`url(#hair-${id})`} style={{ opacity: backness }} />}

        {queen ? (
          <g>
            <path d="M40 92 Q42 34 100 32 Q158 34 160 92 Q146 66 128 58 Q120 76 100 66 Q82 78 72 58 Q54 68 40 92 Z" fill={`url(#hair-${id})`} />
            {/* heart sunglasses on her head */}
            <g transform="translate(100 40)">
              <path d="M-30 -2 c-6 -10 -20 -4 -14 6 l14 12 14 -12 c6 -10 -8 -16 -14 -6z" fill="#FF1493" stroke="#fff" strokeWidth="2" />
              <path d="M30 -2 c-6 -10 -20 -4 -14 6 l14 12 14 -12 c6 -10 -8 -16 -14 -6z" fill="#FF1493" stroke="#fff" strokeWidth="2" />
              <path d="M-16 4 h32" stroke="#fff" strokeWidth="2" />
            </g>
            <circle cx="40" cy="118" r="6" fill="none" stroke={`url(#gold-${id})`} strokeWidth="2.5" />
            <circle cx="160" cy="118" r="6" fill="none" stroke={`url(#gold-${id})`} strokeWidth="2.5" />
          </g>
        ) : (
          <g>
            {/* backwards pink cap with the snapback strap at the front */}
            <path d="M36 80 Q36 26 100 24 Q164 26 164 80 Q132 64 100 64 Q68 64 36 80 Z" fill={`url(#cap-${id})`} />
            <path d="M80 66 Q100 58 120 66" fill="none" stroke="#fff" strokeWidth="3" strokeDasharray="4 3" />
            <rect x="93" y="60" width="14" height="7" rx="3" fill="#fff" opacity="0.9" />
            <path d="M58 46 Q76 34 100 33" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity="0.5" />
            <path d="M40 84 q4 -8 10 -4 q2 -8 8 -4" fill="none" stroke="#2A1626" strokeWidth="5" strokeLinecap="round" />
            <path d="M160 84 q-4 -8 -10 -4 q-2 -8 -8 -4" fill="none" stroke="#2A1626" strokeWidth="5" strokeLinecap="round" />
            <circle cx="40" cy="116" r="3.5" fill={`url(#gold-${id})`} />
          </g>
        )}

        {/* face (hidden while the back is showing) */}
        <m.g style={{ opacity: front }}>
        <Eyes mode={eyes} id={id} listening={listening} reduce={Boolean(reduce)} />
        <ellipse cx="62" cy="122" rx="12" ry="7" fill="#FF7EB9" opacity="0.6" />
        <ellipse cx="138" cy="122" rx="12" ry="7" fill="#FF7EB9" opacity="0.6" />
        <ellipse cx="100" cy="116" rx="2.5" ry="1.8" fill="#000" opacity="0.18" />
        {/* mouth */}
        {talking ? (
          <m.ellipse cx="100" cy="132" rx="8" fill="#B0124F" animate={reduce ? { ry: 4 } : { ry: [2, 7, 3, 8, 2] }} transition={{ duration: 0.42, repeat: Infinity }} />
        ) : eyes === "x" ? (
          <ellipse cx="100" cy="132" rx="6" ry="7" fill="#B0124F" />
        ) : eyes === "side" ? (
          <path d="M90 133 Q100 129 110 133" stroke="#B0124F" strokeWidth="3" fill="none" strokeLinecap="round" />
        ) : (
          <path d="M88 128 Q100 142 112 128 Z" fill="#B0124F" stroke="#B0124F" strokeWidth="2" strokeLinejoin="round" />
        )}
        {/* sparkle on the head */}
        <m.path
          d="M150 30 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z"
          fill="#FFF3B0"
          animate={reduce ? undefined : { rotate: [0, 90], scale: [0.8, 1.2, 0.8] }}
          transition={{ duration: 1.6, repeat: Infinity }}
          style={{ originX: 0.5, originY: 0.5 }}
        />
        </m.g>
        {backness && (
          <m.text x="100" y="196" textAnchor="middle" fontSize="11" fontWeight="900" fill="#fff" fontFamily="system-ui, sans-serif" style={{ opacity: backness }}>
            DRIP
          </m.text>
        )}
      </m.g>
    </svg>
  );
}

function Eyes({ mode, id, listening, reduce }: { mode: Eyes; id: string; listening: boolean; reduce: boolean }) {
  return (
    <g>
      {[76, 124].map((x) => {
        const y = 100;
        if (mode === "happy") return <path key={x} d={`M${x - 12} ${y + 2} Q${x} ${y - 12} ${x + 12} ${y + 2}`} stroke="#3B0F33" strokeWidth="4" fill="none" strokeLinecap="round" />;
        if (mode === "x")
          return <path key={x} d={`M${x - 9} ${y - 9} l18 18 M${x + 9} ${y - 9} l-18 18`} stroke="#3B0F33" strokeWidth="4" strokeLinecap="round" />;
        if (mode === "star")
          return (
            <m.path
              key={x}
              d={`M${x} ${y - 15} l4.5 10 11 1 -8.5 7 2.6 11 -9.6 -6 -9.6 6 2.6 -11 -8.5 -7 11 -1z`}
              fill="#FFD93B"
              stroke="#FF8C00"
              strokeWidth="1.5"
              animate={reduce ? undefined : { scale: [1, 1.25, 1] }}
              transition={{ duration: 0.5, repeat: Infinity }}
              style={{ originX: 0.5, originY: 0.5 }}
            />
          );
        if (mode === "heart")
          return <path key={x} d={`M${x} ${y + 10} l-12 -11 c-6 -7 2 -16 12 -8 c10 -8 18 1 12 8z`} fill="#FF1493" stroke="#fff" strokeWidth="1.5" />;
        const dx = mode === "side" ? 6 : 0;
        const dy = mode === "up" ? -6 : 0;
        const big = mode === "big" ? 1.15 : 1;
        return (
          <m.g key={x} animate={reduce ? undefined : { scaleY: [1, 1, 0.1, 1] }} transition={{ duration: 4.2, repeat: Infinity, times: [0, 0.93, 0.96, 1] }} style={{ originX: 0.5, originY: 0.5 }}>
            <ellipse cx={x} cy={y} rx={14 * big} ry={17 * big} fill="#fff" />
            <ellipse cx={x + dx} cy={y + 2 + dy} rx={11 * big} ry={14 * big} fill={`url(#iris-${id})`} />
            <circle cx={x + dx - 4} cy={y - 5 + dy} r={4.5 * big} fill="#fff" />
            <circle cx={x + dx + 4} cy={y + 7 + dy} r={2.2} fill="#fff" />
            {listening && <circle cx={x + dx} cy={y + 2 + dy} r={3} fill="#FFD93B" />}
            <path d={`M${x - 15} ${y - 14} Q${x} ${y - 24} ${x + 15} ${y - 14}`} fill="none" stroke="#3B0F33" strokeWidth="3.5" strokeLinecap="round" />
          </m.g>
        );
      })}
      {mode === "side" && <path d="M60 80 l18 -4 M140 76 l-18 -2" stroke="#3B0F33" strokeWidth="3" strokeLinecap="round" />}
    </g>
  );
}
