"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { cn } from "@/lib/cn";

// Two shop girls chatting about the launch. `who`: 0 = Tiwa (pink), 1 = Zara (blue), 2 = both.
export const LINES: { who: 0 | 1 | 2; text: string }[] = [
  { who: 0, text: "Hey bestie! Have you heard? Attitude Collections launches TONIGHT at 10PM! 💖" },
  { who: 1, text: "Wait, for real? The new fashion store everyone is talking about?" },
  { who: 0, text: "Yes! Clothes for guys and girls, fresh sneakers and cute bags!" },
  { who: 1, text: "Omo! I need new sneakers and a bag for the weekend!" },
  { who: 0, text: "Ordering is easy too. Pay by bank transfer and chat them on WhatsApp." },
  { who: 1, text: "Say less! I'm setting my alarm for 10PM tonight." },
  { who: 2, text: "Don't miss it! Check out Attitude Collections tonight! ✨" },
];

/** How long each line stays up (the same timing is used to build the Status video's audio). */
export const lineMs = (text: string) => 1600 + text.length * 55;

/** Steps through the conversation on a loop; restarts whenever `run` changes. */
export function useChat(run: number) {
  const [state, setState] = useState({ run, i: 0 });
  useEffect(() => {
    let k = 0;
    let t: ReturnType<typeof setTimeout>;
    const next = () => {
      t = setTimeout(() => {
        k = (k + 1) % LINES.length;
        setState({ run, i: k });
        next();
      }, lineMs(LINES[k].text));
    };
    next();
    return () => clearTimeout(t);
  }, [run]);
  return state.run === run ? state.i : 0;
}

// ---------- characters ----------

interface Look {
  hair: string;
  hairDark: string;
  hoodie: string;
  hoodieDark: string;
  eye: string;
  style: "pigtails" | "buns";
  bottom: "skirt" | "jeans";
}
export const TIWA: Look = { hair: "#F9A8CC", hairDark: "#EC7FB0", hoodie: "#F7A1C4", hoodieDark: "#E57FAA", eye: "#7A3E2B", style: "pigtails", bottom: "skirt" };
export const ZARA: Look = { hair: "#8EA6E8", hairDark: "#6B84D1", hoodie: "#A9C6EE", hoodieDark: "#7FA3DA", eye: "#5B3F9E", style: "buns", bottom: "jeans" };

export function Girl({ look, talking, className, flip }: { look: Look; talking: boolean; className?: string; flip?: boolean }) {
  const skin = "#FFE4D4";
  return (
    <m.svg
      viewBox="0 0 220 320"
      className={className}
      style={flip ? { scaleX: -1 } : undefined}
      animate={talking ? { y: [0, -6, 0] } : { y: 0 }}
      transition={talking ? { duration: 0.6, repeat: Infinity, ease: "easeInOut" } : { duration: 0.3 }}
      aria-hidden
    >
      {/* legs + bottoms */}
      {look.bottom === "jeans" ? (
        <g>
          <rect x="78" y="248" width="30" height="58" rx="8" fill="#5D7FC4" />
          <rect x="112" y="248" width="30" height="58" rx="8" fill="#5D7FC4" />
          <path d="M84 258 v40 M136 258 v40" stroke="#8FA9DD" strokeWidth="2" />
        </g>
      ) : (
        <g>
          <rect x="88" y="270" width="14" height="38" rx="6" fill={skin} />
          <rect x="118" y="270" width="14" height="38" rx="6" fill={skin} />
          <path d="M66 246 H154 L166 282 H54 Z" fill="#fff" stroke="#f3d2e2" strokeWidth="2" />
          <path d="M78 248 L72 282 M96 248 L94 282 M114 248 L116 282 M132 248 L138 282" stroke="#f3d2e2" strokeWidth="2" />
        </g>
      )}
      <ellipse cx="94" cy="308" rx="20" ry="9" fill="#fff" stroke="#f0b7d0" strokeWidth="2" />
      <ellipse cx="126" cy="308" rx="20" ry="9" fill="#fff" stroke="#f0b7d0" strokeWidth="2" />

      {/* hair behind */}
      {look.style === "pigtails" ? (
        <g fill={look.hair}>
          <path d="M44 92 C10 110 14 175 36 196 C40 160 52 130 60 110 Z" />
          <path d="M176 92 C210 110 206 175 184 196 C180 160 168 130 160 110 Z" />
          <circle cx="50" cy="92" r="9" fill="#FF6FAE" />
          <circle cx="170" cy="92" r="9" fill="#FF6FAE" />
        </g>
      ) : (
        <g>
          <circle cx="60" cy="40" r="25" fill={look.hair} />
          <circle cx="160" cy="40" r="25" fill={look.hair} />
          <path d="M44 22 l14 10 -14 10 z M76 22 l-14 10 14 10z" fill="#5C8BE0" />
          <path d="M144 22 l14 10 -14 10 z M176 22 l-14 10 14 10z" fill="#5C8BE0" />
        </g>
      )}
      <ellipse cx="110" cy="100" rx="76" ry="74" fill={look.hair} />

      {/* body */}
      <path d="M58 262 Q50 180 110 168 Q170 180 162 262 Z" fill={look.hoodie} />
      <path d="M78 176 Q110 200 142 176" fill="none" stroke={look.hoodieDark} strokeWidth="5" strokeLinecap="round" />
      <path d="M100 190 v26 M120 190 v26" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <rect x="84" y="224" width="52" height="22" rx="9" fill={look.hoodieDark} opacity="0.6" />
      {look.style === "pigtails" && <path d="M104 230 l6 -6 6 6 -6 6z" fill="#fff" opacity="0.9" />}
      {/* resting arm */}
      <path d="M66 190 Q52 222 60 250" fill="none" stroke={look.hoodie} strokeWidth="20" strokeLinecap="round" />
      <circle cx="61" cy="254" r="9" fill={skin} />
      {/* pointing arm */}
      <m.g
        style={{ originX: "155px", originY: "188px" }}
        animate={talking ? { rotate: [0, -10, 4, 0] } : { rotate: 0 }}
        transition={talking ? { duration: 0.9, repeat: Infinity } : undefined}
      >
        <path d="M154 190 Q178 160 186 124" fill="none" stroke={look.hoodie} strokeWidth="20" strokeLinecap="round" />
        <circle cx="188" cy="116" r="10" fill={skin} />
        <path d="M189 108 V90" stroke={skin} strokeWidth="7" strokeLinecap="round" />
      </m.g>

      {/* face */}
      <ellipse cx="110" cy="108" rx="62" ry="58" fill={skin} />
      <path d="M48 98 Q52 30 110 30 Q168 30 172 98 Q156 74 140 64 Q130 84 112 74 Q96 86 84 64 Q66 76 48 98 Z" fill={look.hair} />
      <path d="M70 60 Q90 44 110 46" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity="0.5" />
      <path d="M150 50 l4 8 9 1 -7 6 2 9 -8 -5 -8 5 2 -9 -7 -6 9 -1z" fill="#FFD95A" stroke="#fff" strokeWidth="1.2" />

      {/* eyes with blink */}
      {[84, 136].map((x) => (
        <m.g key={x} animate={{ scaleY: [1, 1, 0.1, 1] }} transition={{ duration: 4, repeat: Infinity, times: [0, 0.92, 0.95, 1] }}>
          <ellipse cx={x} cy="114" rx="13" ry="16" fill={look.eye} />
          <ellipse cx={x} cy="117" rx="8" ry="10" fill="#2b1630" opacity="0.6" />
          <circle cx={x - 4} cy="107" r="5" fill="#fff" />
          <circle cx={x + 5} cy="121" r="2.4" fill="#fff" />
          <path d={`M${x - 15} 100 Q${x} 92 ${x + 15} 100`} fill="none" stroke="#3b1f2b" strokeWidth="3" strokeLinecap="round" />
        </m.g>
      ))}
      <ellipse cx="68" cy="136" rx="11" ry="6" fill="#FF9FC0" opacity="0.7" />
      <ellipse cx="152" cy="136" rx="11" ry="6" fill="#FF9FC0" opacity="0.7" />
      <circle cx="52" cy="128" r="3" fill="#F6C454" />
      <circle cx="168" cy="128" r="3" fill="#F6C454" />

      {/* mouth */}
      {talking ? (
        <m.ellipse cx="110" cy="144" rx="9" fill="#C2185B" animate={{ ry: [2, 8, 3, 9, 2] }} transition={{ duration: 0.45, repeat: Infinity }} />
      ) : (
        <path d="M100 141 Q110 152 120 141" fill="#C2185B" stroke="#C2185B" strokeWidth="2" strokeLinejoin="round" />
      )}
    </m.svg>
  );
}

// ---------- speech bubble ----------

export function Bubble({ text, side, className }: { text: string; side: "left" | "right" | "center"; className?: string }) {
  const words = text.split(" ");
  return (
    <m.div
      key={text}
      initial={{ opacity: 0, scale: 0.7, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: -6 }}
      transition={{ type: "spring", stiffness: 380, damping: 22 }}
      className={cn(
        "relative rounded-[1.2em] border-[0.15em] border-[#FF7EB9] bg-white px-[1em] py-[0.7em] text-[#8E1B54] shadow-[0_0.4em_1.2em_rgba(214,51,127,0.3)]",
        side === "left" ? "origin-bottom-left" : side === "right" ? "origin-bottom-right" : "origin-bottom",
        className,
      )}
    >
      <p className="font-semibold leading-snug">
        {words.map((w, i) => (
          <m.span key={i} className="inline-block" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.07 }}>
            {w}&nbsp;
          </m.span>
        ))}
      </p>
      <span
        aria-hidden
        className={cn(
          "absolute -bottom-[0.6em] size-[1.1em] rotate-45 border-b-[0.15em] border-r-[0.15em] border-[#FF7EB9] bg-white",
          side === "left" ? "left-[18%]" : side === "right" ? "right-[18%]" : "left-1/2 -translate-x-1/2",
        )}
      />
    </m.div>
  );
}

/** The two girls with their speech bubble — used in the /coming-soon card. */
export function ChatDuo({ index, className }: { index: number; className?: string }) {
  const line = LINES[index];
  return (
    <div className={cn("relative", className)} data-testid="anime-chat">
      <div className="relative h-[6.5em]">
        <AnimatePresence mode="wait">
          <div key={index} className={cn("absolute bottom-0 w-[78%]", line.who === 0 ? "left-0" : line.who === 1 ? "right-0" : "left-[11%]")}>
            <Bubble text={line.text} side={line.who === 0 ? "left" : line.who === 1 ? "right" : "center"} />
          </div>
        </AnimatePresence>
      </div>
      <div className="mt-[0.8em] flex items-end justify-between px-[4%]">
        <Girl look={TIWA} talking={line.who !== 1} className="w-[42%]" />
        <Girl look={ZARA} talking={line.who !== 0} className="w-[42%]" flip />
      </div>
    </div>
  );
}

// ---------- boutique props for the story scene ----------

export function Tee({ color, className }: { color: string; className?: string }) {
  return (
    <svg viewBox="0 0 60 70" className={className} aria-hidden>
      <path d="M30 2 q-4 6 -8 4" stroke="#9b7b8a" strokeWidth="2" fill="none" />
      <path d="M18 10 L4 20 L10 32 L16 28 V66 H44 V28 L50 32 L56 20 L42 10 Q30 18 18 10 Z" fill={color} stroke="#fff" strokeWidth="1.5" />
    </svg>
  );
}
export function Sneaker({ color, className }: { color: string; className?: string }) {
  return (
    <svg viewBox="0 0 80 40" className={className} aria-hidden>
      <path d="M4 30 Q6 12 22 10 L34 18 Q50 20 66 22 Q78 24 76 32 Z" fill="#fff" stroke="#e7bcd0" strokeWidth="2" />
      <path d="M22 10 L34 18 L40 28 L18 28 Z" fill={color} />
      <path d="M4 32 H76 V36 H4 Z" fill={color} opacity="0.7" />
    </svg>
  );
}
export function Bag({ color, className }: { color: string; className?: string }) {
  return (
    <svg viewBox="0 0 60 70" className={className} aria-hidden>
      <path d="M18 22 Q18 4 30 4 Q42 4 42 22" fill="none" stroke={color} strokeWidth="4" />
      <rect x="8" y="22" width="44" height="44" rx="8" fill={color} stroke="#fff" strokeWidth="1.5" />
      <path d="M24 40 q6 6 12 0" stroke="#fff" strokeWidth="2" fill="none" />
    </svg>
  );
}
