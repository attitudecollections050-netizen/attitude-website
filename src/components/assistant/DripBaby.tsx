"use client";
import { m, useMotionValue, useReducedMotion, useTransform, type MotionValue, type TargetAndTransition } from "motion/react";
import { cn } from "@/lib/cn";
import { CHARACTERS, DEFAULT_LOOK, type CharacterId, type DripAction, type ModelLook } from "@/lib/assistant/characters";

/**
 * ATTITUDE mini HARU / ATTITUDE mini JIN — the store's Korean anime-style mascots,
 * drawn from the brand artwork. The whole figure moves for each action (wave, spin,
 * dance, celebrate…); props and effects are layered on by DripStage. `variant="head"`
 * shows the face in a circle for the chat button and message avatars.
 */

const MOVES: Partial<Record<DripAction, { a: TargetAndTransition; loop?: boolean; dur?: number }>> = {
  idle: { a: { y: [0, -3, 0] }, loop: true, dur: 2.6 },
  pose: { a: { rotate: [0, 3, 0, -2, 0], y: [0, -2, 0] }, loop: true, dur: 4 },
  wave: { a: { rotate: [0, -5, 5, -5, 5, 0] }, dur: 1.8 },
  dab: { a: { rotate: [0, -12, -12, 0], x: [0, -4, -4, 0] }, dur: 1.4 },
  blow_kiss: { a: { rotate: [0, -7, -7, 0], scale: [1, 1.04, 1.04, 1] }, dur: 1.4 },
  fire: { a: { y: [0, -12, 0, -12, 0, -12, 0], scale: [1, 1.05, 1, 1.05, 1, 1.05, 1] }, dur: 1.8 },
  dance: { a: { rotate: [-7, 7, -7], y: [0, -8, 0] }, loop: true, dur: 0.8 },
  measure: { a: { scaleX: [1, 0.95, 0.95, 1.02, 1] }, dur: 2 },
  try_on: { a: { scale: [1, 0.85, 1.08, 1] }, dur: 1 },
  boxing: { a: { x: [-4, 4, -4] }, loop: true, dur: 0.5 },
  roast: { a: { rotate: [0, 5, 5], x: [0, 3, 3] }, dur: 0.8 },
  cross_arms: { a: { rotate: [0, -4, -4] }, dur: 0.8 },
  celebrate: { a: { y: [0, -18, 0], rotate: [0, -4, 4, 0] }, loop: true, dur: 0.9 },
  strut: { a: { rotate: [-3, 3, -3], y: [0, -4, 0, -4, 0] }, loop: true, dur: 1 },
  beg: { a: { y: [0, -6, 0, -6, 0], scale: [1, 1.03, 1, 1.03, 1] }, dur: 1.4 },
  hair_flip: { a: { rotate: [0, -10, 8, 0] }, dur: 1 },
  whisper: { a: { rotate: [0, 6, 6], x: [0, 4, 4] }, dur: 0.8 },
  think: { a: { rotate: [0, -4, -4] }, dur: 0.8 },
};

const BUILD = { slim: 0.9, regular: 1, thick: 1.12 } as const;
const HEIGHT = { short: 0.9, average: 1, tall: 1.08 } as const;
// Where the hoodie is in each artwork (percent of the figure), for the magic try-on.
const TORSO: Record<CharacterId, { left: string; top: string; width: string; height: string }> = {
  haru: { left: "22%", top: "38%", width: "56%", height: "26%" },
  jin: { left: "16%", top: "33%", width: "68%", height: "28%" },
};
const WAIST: Record<CharacterId, string> = { haru: "62%", jin: "58%" };

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
  const none = useMotionValue(0);
  const shade = useTransform(backness ?? none, (v) => (v > 0.5 ? "brightness(0.82) saturate(0.9)" : "none"));
  const c = CHARACTERS[character];

  if (variant === "head") {
    return (
      <span className={cn("relative block overflow-hidden rounded-full bg-white", className)} style={{ boxShadow: `inset 0 0 0 2px ${c.color}` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={c.face} alt="" draggable={false} className="size-full object-cover" />
        {talking && !reduce && (
          <m.span aria-hidden className="absolute inset-0 rounded-full" style={{ boxShadow: `0 0 0 3px ${c.color}` }} animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 0.6, repeat: Infinity }} />
        )}
      </span>
    );
  }

  const l = look ?? DEFAULT_LOOK[character];
  const move = (reduce ? MOVES.idle : MOVES[action]) ?? MOVES.idle!;
  return (
    <div className={cn("relative", className)} data-character={character}>
      <m.div
        key={`${action}-${playKey}`}
        className="absolute inset-0"
        style={{ originX: 0.5, originY: 1 }}
        animate={{ ...move.a, transition: { duration: move.dur ?? 1.2, ease: "easeInOut", repeat: move.loop && !reduce ? Infinity : 0 } }}
      >
        <m.div
          className="absolute inset-0"
          style={{ originX: 0.5, originY: 1, scaleX: BUILD[l.build], scaleY: HEIGHT[l.height] }}
          animate={talking && !reduce ? { scaleY: [HEIGHT[l.height], HEIGHT[l.height] * 1.015, HEIGHT[l.height]] } : undefined}
          transition={{ duration: 0.35, repeat: Infinity }}
        >
          <m.img
            src={c.art}
            alt=""
            draggable={false}
            className="absolute inset-0 size-full select-none object-contain object-bottom drop-shadow-[0_6px_14px_rgba(120,20,70,0.35)]"
            style={{ filter: shade }}
          />
          {/* magic try-on: the product photo appears on the hoodie */}
          {outfitImage && (
            <m.span
              key={`o-${outfitImage}-${playKey}`}
              className="absolute overflow-hidden rounded-[30%] border-2 border-white shadow-lg"
              style={TORSO[character]}
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.35, type: "spring", stiffness: 260 }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={outfitImage} alt="" className="size-full object-cover" />
            </m.span>
          )}
          {/* measuring tape round the waist */}
          {action === "measure" && (
            <m.span
              aria-hidden
              className="absolute left-[10%] h-[3.5%] rounded-sm border border-[#C9A300] bg-[repeating-linear-gradient(90deg,#FFD93B_0_6px,#7A5C00_6px_7px)]"
              style={{ top: WAIST[character], originX: 0.5 }}
              initial={{ width: "10%", opacity: 0, left: "45%" }}
              animate={{ width: "80%", opacity: 1, left: "10%" }}
              transition={{ duration: 0.8 }}
            />
          )}
        </m.div>
      </m.div>
      {/* speaking / listening cues */}
      {talking && !reduce && (
        <m.span aria-hidden className="absolute right-0 top-[18%] text-sm" style={{ color: c.color }} animate={{ y: [0, -10], opacity: [0, 1, 0] }} transition={{ duration: 0.9, repeat: Infinity }}>
          ♪
        </m.span>
      )}
      {listening && !reduce && (
        <m.span aria-hidden className="absolute left-1/2 top-[6%] size-[46%] -translate-x-1/2 rounded-full" style={{ boxShadow: `0 0 0 3px ${c.color}` }} animate={{ scale: [1, 1.15], opacity: [0.9, 0] }} transition={{ duration: 1, repeat: Infinity }} />
      )}
    </div>
  );
}
