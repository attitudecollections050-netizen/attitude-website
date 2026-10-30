"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, animate, m, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { cn } from "@/lib/cn";
import { actionLine, type CharacterId, type DripAction, type ModelLook } from "@/lib/assistant/characters";
import { DripBaby } from "./DripBaby";

const STREET_POSES = ["🛹", "🧱", "🪑", "🤳"] as const;

/** The character performing an action, with its props and effects, plus a caption bubble. */
export function DripStage({
  character,
  look,
  action,
  playKey,
  caption,
  talking,
  listening,
  images = [],
  compact = false,
  className,
}: {
  character: CharacterId;
  look: ModelLook;
  action: DripAction;
  playKey: number;
  caption?: string | null;
  talking?: boolean;
  listening?: boolean;
  /** Product photos: [0] is worn on try-on; [0] and [1] fight in a boxing compare. */
  images?: (string | null)[];
  compact?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const rot = useMotionValue(0);
  const backness = useTransform(rot, (v): number => {
    const a = ((v % 360) + 360) % 360;
    return a > 90 && a < 270 ? 1 : 0;
  });
  const haru = character === "haru";

  // 360° spins (spin, hair flip, try-on twirl).
  useEffect(() => {
    if (reduce) return;
    if (action === "spin" || action === "try_on") {
      rot.set(0);
      const c = animate(rot, 360, { duration: action === "spin" ? 1.6 : 1, delay: action === "try_on" ? 0.9 : 0, ease: "easeInOut" });
      return () => c.stop();
    }
    rot.set(0);
  }, [action, playKey, reduce, rot]);

  // Street poses cycle while idle.
  const [poseIdx, setPoseIdx] = useState(0);
  useEffect(() => {
    if (action !== "pose") return;
    const t = setInterval(() => setPoseIdx((i) => (i + 1) % STREET_POSES.length), 2500);
    return () => clearInterval(t);
  }, [action]);

  const root =
    reduce || action === "idle"
      ? {}
      : action === "strut"
        ? { x: ["-30%", "30%", "-30%"], transition: { duration: 4, repeat: Infinity, ease: "easeInOut" as const } }
        : action === "faint"
          ? { rotate: [0, -82, -82, 0], y: [0, 18, 18, 0], transition: { duration: 2.4, times: [0, 0.25, 0.75, 1] } }
          : {};
  const line = caption ?? actionLine(action, character);
  const worn = action === "try_on" ? (images[0] ?? null) : null;

  return (
    <div className={cn("relative isolate flex items-end gap-2 overflow-hidden", compact && "h-28", className)} data-testid="drip-stage" data-action={action}>
      {/* flashy pink backdrop */}
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 -z-10",
          haru ? "bg-[radial-gradient(circle_at_30%_70%,#FFF0F7_0%,#FFB6D9_40%,#F07AB4_100%)]" : "bg-[radial-gradient(circle_at_30%_70%,#FF9CC4_0%,#E94E8A_40%,#8E1B54_100%)]",
        )}
      />
      <Sparkles reduce={Boolean(reduce)} />

      <div className={cn("relative shrink-0 self-stretch py-1.5", compact ? "w-24" : "w-28")} style={{ perspective: 600 }}>
        <m.div key={`root-${action}-${playKey}`} className="absolute inset-x-0 inset-y-1.5" animate={root} style={{ rotateY: rot, originX: 0.5, originY: 1 }}>
          <DripBaby character={character} look={look} action={action} playKey={playKey} talking={talking} listening={listening} outfitImage={worn} backness={backness} className="size-full" />
        </m.div>
        <Effects action={action} playKey={playKey} haru={haru} pose={STREET_POSES[poseIdx]} images={images} reduce={Boolean(reduce)} />
      </div>

      <AnimatePresence mode="wait">
        {line && (
          <m.p
            key={`${line}-${playKey}`}
            initial={{ opacity: 0, scale: 0.8, x: -8 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={cn(
              "relative mb-4 mr-2 mt-10 min-w-0 flex-1 self-end rounded-2xl rounded-bl-sm border-2 border-white bg-white/95 px-3 py-2 font-bold leading-snug text-[#8E1B54] shadow-lg",
              compact ? "text-[0.7rem]" : "text-xs",
            )}
            data-testid="drip-caption"
          >
            {line}
          </m.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function Sparkles({ reduce }: { reduce: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      {Array.from({ length: 14 }, (_, i) => (
        <m.span
          key={i}
          className="absolute text-white"
          style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%`, fontSize: 6 + ((i * 7) % 10), textShadow: "0 0 6px #fff" }}
          animate={reduce ? undefined : { opacity: [0, 1, 0], scale: [0.5, 1.2, 0.5] }}
          transition={{ duration: 1.4 + (i % 4) * 0.4, repeat: Infinity, delay: (i % 5) * 0.3 }}
        >
          ✦
        </m.span>
      ))}
    </div>
  );
}

function Burst({ x, y, delay, color }: { x: string; y: string; delay: number; color: string }) {
  return (
    <span className="absolute" style={{ left: x, top: y }}>
      {Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2;
        return (
          <m.span
            key={i}
            className="absolute size-1.5 rounded-full"
            style={{ background: color, boxShadow: `0 0 6px ${color}` }}
            initial={{ x: 0, y: 0, opacity: 0 }}
            animate={{ x: Math.cos(a) * 34, y: Math.sin(a) * 34, opacity: [0, 1, 0] }}
            transition={{ duration: 1.1, delay, repeat: Infinity, repeatDelay: 0.6 }}
          />
        );
      })}
    </span>
  );
}

function Effects({ action, playKey, haru, pose, images, reduce }: { action: DripAction; playKey: number; haru: boolean; pose: string; images: (string | null)[]; reduce: boolean }) {
  if (reduce) return null;
  const float = (glyph: string, i: number, base = 50) => (
    <m.span
      key={`${glyph}-${i}-${playKey}`}
      className="absolute text-lg"
      style={{ left: `${base + ((i * 23) % 40) - 20}%`, top: "40%" }}
      initial={{ y: 0, opacity: 0 }}
      animate={{ y: -70, opacity: [0, 1, 0], x: (i % 2 ? 1 : -1) * 14 }}
      transition={{ duration: 1.6, delay: i * 0.25, repeat: Infinity, repeatDelay: 0.4 }}
    >
      {glyph}
    </m.span>
  );
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {action === "fire" && [0, 1, 2, 3].map((i) => float("🔥", i))}
      {action === "blow_kiss" && [0, 1, 2].map((i) => float(i % 2 ? "💋" : "💗", i, 70))}
      {action === "dab" && (haru ? [0, 1, 2].map((i) => float("💋", i, 70)) : [0, 1].map((i) => float("💥", i, 75)))}
      {action === "beg" && [0, 1].map((i) => float("🥺", i))}
      {action === "faint" && [0, 1, 2].map((i) => float("💫", i, 30))}
      {action === "whisper" && float("🤫", 0, 80)}
      {action === "think" && float("💭", 0, 80)}
      {action === "dance" && [0, 1, 2].map((i) => float(i % 2 ? "🎶" : "🎵", i))}
      {action === "try_on" && (
        <m.span key={`snap-${playKey}`} className="absolute left-[60%] top-[38%] text-2xl" initial={{ scale: 0, opacity: 0 }} animate={{ scale: [0, 1.6, 0], opacity: [0, 1, 0] }} transition={{ duration: 0.8 }}>
          ✨
        </m.span>
      )}
      {action === "celebrate" && (
        <>
          <Burst x="15%" y="15%" delay={0} color="#FFD93B" />
          <Burst x="80%" y="10%" delay={0.4} color="#fff" />
          <Burst x="50%" y="0%" delay={0.8} color="#FF8CC6" />
          {Array.from({ length: 16 }, (_, i) => (
            <m.span
              key={i}
              className="absolute h-2 w-1 rounded-sm"
              style={{ left: `${(i * 29) % 100}%`, background: ["#FFD93B", "#fff", "#7CE3FF", "#FF8CC6"][i % 4] }}
              initial={{ y: -10, rotate: 0 }}
              animate={{ y: 170, rotate: 360 }}
              transition={{ duration: 1.8, delay: (i % 6) * 0.2, repeat: Infinity }}
            />
          ))}
          <m.span
            key={`stamp-${playKey}`}
            className="absolute bottom-1 left-1/2 -translate-x-1/2 -rotate-12 whitespace-nowrap rounded-md border-2 border-white bg-[#FF1493] px-1.5 py-0.5 text-[0.55rem] font-black uppercase text-white"
            initial={{ scale: 3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 300 }}
          >
            {haru ? "Haru approved! 💖" : "Jin approved!"}
          </m.span>
        </>
      )}
      {action === "boxing" && (
        <>
          {[0, 1].map((i) => (
            <m.div
              key={i}
              className={cn("absolute top-2 size-10 overflow-hidden rounded-lg border-2 border-white bg-white shadow", i ? "-right-1" : "-left-1")}
              animate={{ x: i ? [0, -8, 0] : [0, 8, 0], rotate: i ? [6, -4, 6] : [-6, 4, -6] }}
              transition={{ duration: 0.6, repeat: Infinity }}
            >
              {images[i] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={images[i]!} alt="" className="size-full object-cover" />
              ) : (
                <span className="grid size-full place-items-center text-lg">👖</span>
              )}
            </m.div>
          ))}
          <m.span className="absolute left-1/2 top-3 -translate-x-1/2 text-xl" animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.5, repeat: Infinity }}>
            🥊
          </m.span>
        </>
      )}
      {action === "pose" && (
        <m.span key={pose} className={cn("absolute text-2xl", pose === "🛹" ? "bottom-0 left-1/2 -translate-x-1/2" : pose === "🤳" ? "right-0 top-1/3" : "-left-1 bottom-6")} initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1, x: pose === "🛹" ? [-4, 4, -4] : 0 }} transition={{ duration: 1, repeat: pose === "🛹" ? Infinity : 0 }}>
          {pose}
        </m.span>
      )}
      {action === "roast" && float("😤", 0, 80)}
      {action === "cross_arms" && float("🤨", 0, 80)}
      {action === "hair_flip" && [0, 1].map((i) => float("✨", i, 30))}
      {action === "spin" && float("🔄", 0, 85)}
      {action === "wave" && float("👋", 0, 85)}
      {action === "strut" && [0, 1].map((i) => float("💅", i))}
    </div>
  );
}
