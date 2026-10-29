"use client";

import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { m, useReducedMotion } from "motion/react";
import { MotionProvider } from "@/components/ui/MotionProvider";
import { WhatsAppIcon } from "@/components/ui/WhatsAppLink";
import { launchTime } from "@/lib/launch";
import { cn } from "@/lib/cn";

// ---------- time ----------

// One shared clock that ticks on the client (null during server render, so no hydration mismatch).
let now = 0;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!timer) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      listeners.forEach((l) => l());
    }, 250);
  }
  return () => {
    listeners.delete(cb);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}
const snapshot = () => Math.floor((now || Date.now()) / 1000);

function useCountdown() {
  const sec = useSyncExternalStore(subscribe, snapshot, () => null);
  if (sec === null) return null;
  const left = Math.max(0, Math.floor(launchTime() / 1000) - sec);
  return {
    left,
    days: Math.floor(left / 86400),
    hours: Math.floor((left % 86400) / 3600),
    minutes: Math.floor((left % 3600) / 60),
    seconds: left % 60,
  };
}

const pad = (n: number | undefined) => (n === undefined ? "--" : String(n).padStart(2, "0"));

// ---------- type styles ----------

const GOLD = {
  backgroundImage: "linear-gradient(180deg,#fff8dc 0%,#f6d77f 30%,#d4a23c 52%,#fbe7a6 70%,#b9852b 100%)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
  filter: "drop-shadow(0 2px 1px rgba(120,60,20,0.35)) drop-shadow(0 0 14px rgba(255,236,170,0.55))",
} as const;

const NEON = {
  color: "#fff",
  textShadow: "0 0 4px #fff, 0 0 10px #ff4fb0, 0 0 22px #ff1493, 0 0 44px #ff1493, 0 0 70px #ff69b4",
} as const;

function Gold({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("relative inline-block", className)}>
      <span style={GOLD}>{children}</span>
      {/* moving glint across the gold */}
      <m.span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-clip-text text-transparent"
        style={{ backgroundImage: "linear-gradient(110deg,transparent 40%,rgba(255,255,255,0.95) 50%,transparent 60%)", backgroundSize: "250% 100%", WebkitBackgroundClip: "text" }}
        animate={{ backgroundPosition: ["120% 0%", "-120% 0%"] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "linear", repeatDelay: 1 }}
      >
        {children}
      </m.span>
    </span>
  );
}

function Neon({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <m.span
      className={cn("inline-block", className)}
      style={NEON}
      animate={{ opacity: [1, 1, 0.75, 1, 0.9, 1] }}
      transition={{ duration: 3, repeat: Infinity, times: [0, 0.7, 0.72, 0.75, 0.78, 1] }}
    >
      {children}
    </m.span>
  );
}

// ---------- background ----------

// Fixed pseudo-random layout so server and client render the same thing.
function seeded(count: number, seed: number) {
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  return Array.from({ length: count }, (_, i) => ({ i, x: rnd() * 100, y: rnd() * 100, size: rnd(), delay: rnd() * 6, dur: 6 + rnd() * 8 }));
}
const BOKEH = seeded(14, 7);
const GLITTER = seeded(60, 11);
const CHARMS = seeded(18, 42);

function Diamond({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 20" className={className} aria-hidden>
      <path d="M5 0h14l5 6-12 14L0 6z" fill="#ffd6ea" stroke="#fff" strokeWidth="0.8" />
      <path d="M0 6h24M5 0l3 6 4 14 4-14 3-6M8 6l4-6 4 6" fill="none" stroke="#fff" strokeWidth="0.6" opacity="0.9" />
    </svg>
  );
}

function Backdrop({ still }: { still: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(170deg,#F7BED6_0%,#EE93BD_35%,#E3679F_65%,#F2A9C9_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_42%,rgba(255,235,245,0.75),transparent_50%)]" />
      {BOKEH.map((b) => (
        <m.div
          key={b.i}
          className="absolute rounded-full"
          style={{
            left: `${b.x}%`,
            top: `${b.y}%`,
            width: `${4 + b.size * 12}%`,
            aspectRatio: "1",
            background: b.i % 3 ? "rgba(255,255,255,0.35)" : "rgba(255,105,180,0.35)",
            filter: `blur(${2 + b.size * 6}px)`,
          }}
          animate={still ? undefined : { y: [0, -30, 0], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: b.dur, repeat: Infinity, ease: "easeInOut", delay: b.delay }}
        />
      ))}
      {GLITTER.map((g) => (
        <m.span
          key={g.i}
          className="absolute select-none text-white"
          style={{ left: `${g.x}%`, top: `${g.y}%`, fontSize: `${0.4 + g.size * 1.1}em`, textShadow: "0 0 8px #fff, 0 0 14px #ffb6d9" }}
          animate={still ? { opacity: 0.8 } : { opacity: [0, 1, 0], scale: [0.4, 1.2, 0.4], rotate: [0, 90] }}
          transition={{ duration: 1.6 + g.size * 2.4, repeat: Infinity, delay: g.delay }}
        >
          ✦
        </m.span>
      ))}
      {CHARMS.map((c) => (
        <m.span
          key={c.i}
          className="absolute"
          style={{ left: `${c.x}%`, top: `${c.y}%`, fontSize: `${0.9 + c.size * 1.4}em` }}
          animate={still ? undefined : { y: [30, -90, -200], opacity: [0, 1, 0], rotate: [0, 25, -20], x: [0, 15, -10] }}
          transition={{ duration: c.dur + 2, repeat: Infinity, delay: c.delay, ease: "easeOut" }}
        >
          {c.i % 2 ? (
            <span style={{ color: c.i % 4 === 1 ? "#ff5fae" : "#ffe3f0", textShadow: "0 0 10px rgba(255,255,255,0.9)" }}>♥</span>
          ) : (
            <Diamond className="w-[1em] drop-shadow-[0_0_6px_rgba(255,255,255,0.9)]" />
          )}
        </m.span>
      ))}
    </div>
  );
}

// ---------- crystal hourglass ----------

const GRAINS = Array.from({ length: 22 }, (_, i) => ({ i, dx: ((i * 37) % 9) - 4, delay: (i * 0.09) % 1.1, dur: 0.9 + ((i * 13) % 5) / 10 }));
const GEMS_TOP = [70, 100, 130, 150, 170, 200, 230];

/** Diamond-studded crystal hourglass; the sand level follows the seconds of the current minute. */
export function Hourglass({ seconds, still, className }: { seconds: number | undefined; still?: boolean; className?: string }) {
  const id = useId().replace(/:/g, "");
  const p = seconds === undefined ? 0.5 : 1 - seconds / 60; // share of the minute that has passed
  const topY = 92 + p * 130; // top sand surface: 92 (full) → 222 (empty)
  const pile = 0.15 + p * 0.85; // bottom pile height share
  const glass = "M62 42 H238 C238 140 168 188 156 230 C168 272 238 320 238 418 H62 C62 320 132 272 144 230 C132 188 62 140 62 42 Z";
  const topBulb = "M62 42 H238 C238 140 168 188 156 230 H144 C132 188 62 140 62 42 Z";
  const bottomBulb = "M144 230 H156 C168 272 238 320 238 418 H62 C62 320 132 272 144 230 Z";

  return (
    <svg viewBox="0 0 300 460" className={className} role="img" aria-label="Hourglass with pink sand">
      <defs>
        <linearGradient id={`${id}sand`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffc4e0" />
          <stop offset="1" stopColor="#f06aa8" />
        </linearGradient>
        <pattern id={`${id}glit`} width="23" height="19" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="4" r="0.8" fill="#fff" />
          <circle cx="14" cy="2" r="0.5" fill="#fff" opacity="0.8" />
          <circle cx="9" cy="11" r="0.6" fill="#ffe7a8" />
          <circle cx="19" cy="9" r="0.9" fill="#fff" opacity="0.9" />
          <circle cx="5" cy="16" r="0.45" fill="#fff" opacity="0.7" />
          <circle cx="16" cy="16" r="0.6" fill="#ffd6ea" />
        </pattern>
        <linearGradient id={`${id}glass`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="0.25" stopColor="#ffe6f2" stopOpacity="0.15" />
          <stop offset="0.75" stopColor="#ffe6f2" stopOpacity="0.1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.5" />
        </linearGradient>
        <linearGradient id={`${id}crystal`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.35" stopColor="#f9d7e8" />
          <stop offset="0.6" stopColor="#ffffff" />
          <stop offset="1" stopColor="#efb3cf" />
        </linearGradient>
        <linearGradient id={`${id}gold`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff3c4" />
          <stop offset="0.5" stopColor="#d4a23c" />
          <stop offset="1" stopColor="#f7dc8f" />
        </linearGradient>
        <linearGradient id={`${id}shine`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.85" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${id}gem`}>
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.4" stopColor="#ff8cc6" />
          <stop offset="1" stopColor="#d6337f" />
        </radialGradient>
        <clipPath id={`${id}top`}>
          <path d={topBulb} />
        </clipPath>
        <clipPath id={`${id}bot`}>
          <path d={bottomBulb} />
        </clipPath>
        <clipPath id={`${id}all`}>
          <path d={glass} />
          <rect x="30" y="14" width="240" height="26" rx="8" />
          <rect x="30" y="420" width="240" height="26" rx="8" />
        </clipPath>
      </defs>

      {/* gold filigree crown */}
      <path d="M90 10 C110 -2 130 14 150 4 C170 14 190 -2 210 10" fill="none" stroke={`url(#${id}gold)`} strokeWidth="2.2" />
      <path d="M150 0 l3 4 -3 4 -3 -4z" fill={`url(#${id}gold)`} />

      {/* crystal pillars */}
      {[38, 248].map((x) => (
        <g key={x}>
          <rect x={x} y="36" width="14" height="388" rx="5" fill={`url(#${id}crystal)`} stroke="#fff" strokeWidth="1.2" opacity="0.95" />
          <path d={`M${x + 4} 40 V420 M${x + 10} 40 V420`} stroke="#fff" strokeWidth="1.2" opacity="0.9" />
          {[70, 120, 175, 230, 285, 340, 390].map((y, i) => (
            <g key={y}>
              <path d={`M${x + 7} ${y - (i % 2 ? 5 : 7)} l${i % 2 ? 5 : 7} ${i % 2 ? 5 : 7} l-${i % 2 ? 5 : 7} ${i % 2 ? 5 : 7} l-${i % 2 ? 5 : 7} -${i % 2 ? 5 : 7}z`} fill={`url(#${id}gem)`} stroke="#fff" strokeWidth="1" />
            </g>
          ))}
        </g>
      ))}

      {/* glass */}
      <path d={glass} fill={`url(#${id}glass)`} stroke="#fff" strokeWidth="2.5" />

      {/* top sand (drains) */}
      <g clipPath={`url(#${id}top)`}>
        <m.rect x="40" width="220" fill={`url(#${id}sand)`} initial={false} animate={{ y: topY, height: 240 - topY }} transition={{ duration: 0.9, ease: "easeInOut" }} />
        <m.rect x="40" width="220" fill={`url(#${id}glit)`} initial={false} animate={{ y: topY, height: 240 - topY }} transition={{ duration: 0.9, ease: "easeInOut" }} />
        <m.ellipse cx="150" rx="90" ry="6" fill="#ffd6ea" initial={false} animate={{ cy: topY }} transition={{ duration: 0.9 }} />
      </g>

      {/* falling stream + grains */}
      <g clipPath={`url(#${id}bot)`}>
        <rect x="148.5" y="226" width="3" height="200" fill={`url(#${id}sand)`} opacity="0.9" />
        {!still &&
          GRAINS.map((g) => (
            <m.circle
              key={g.i}
              r={g.i % 3 ? 1.2 : 1.8}
              fill={g.i % 4 ? "#ff9ccc" : "#fff"}
              initial={{ cx: 150, cy: 232, opacity: 0 }}
              animate={{ cx: [150, 150 + g.dx], cy: [232, 410], opacity: [0, 1, 1, 0] }}
              transition={{ duration: g.dur, repeat: Infinity, delay: g.delay, ease: "easeIn" }}
            />
          ))}
        {/* growing pile */}
        <m.g initial={false} animate={{ y: (1 - pile) * 128 }} transition={{ duration: 0.9, ease: "easeInOut" }}>
          <path d="M40 420 L40 395 C90 360 120 300 150 292 C180 300 210 360 260 395 L260 440 L40 440 Z" fill={`url(#${id}sand)`} />
          <path d="M40 420 L40 395 C90 360 120 300 150 292 C180 300 210 360 260 395 L260 440 L40 440 Z" fill={`url(#${id}glit)`} />
        </m.g>
      </g>

      {/* glass highlights */}
      <path d="M78 52 C80 120 112 170 136 210" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity="0.7" />
      <path d="M136 252 C112 290 80 340 78 405" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity="0.6" />
      <path d="M222 60 C220 100 205 130 190 150" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />

      {/* caps */}
      {[14, 420].map((y) => (
        <g key={y}>
          <rect x="30" y={y} width="240" height="26" rx="8" fill={`url(#${id}crystal)`} stroke="#fff" strokeWidth="1.5" />
          <rect x="34" y={y + 3} width="232" height="6" rx="3" fill="#fff" opacity="0.7" />
          {GEMS_TOP.map((x, i) => (
            <circle key={x} cx={x} cy={y + 15} r={i % 2 ? 3.2 : 4.4} fill={`url(#${id}gem)`} stroke="#fff" strokeWidth="0.8" />
          ))}
          <path d={`M40 ${y + 24} H260`} stroke={`url(#${id}gold)`} strokeWidth="1.5" />
        </g>
      ))}

      {/* sweeping shine over the whole crystal */}
      {!still && (
        <g clipPath={`url(#${id}all)`}>
          <m.rect
            y="0"
            width="60"
            height="460"
            fill={`url(#${id}shine)`}
            transform="skewX(-18)"
            initial={{ x: -120 }}
            animate={{ x: [-120, 420] }}
            transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 2.2, ease: "easeInOut" }}
          />
        </g>
      )}
    </svg>
  );
}

// ---------- crystal ice boxes ----------

function CrystalBox({ value, label, heart, className }: { value: string; label: string; heart?: boolean; className?: string }) {
  return (
    <div
      className={cn("relative rounded-[0.9em] p-[0.32em] shadow-[0_0.5em_1.4em_rgba(190,40,110,0.35)]", className)}
      style={{
        background:
          "radial-gradient(circle,#ff8cc6 0 28%,transparent 32%) 0 0/0.62em 0.62em, linear-gradient(135deg,#fff 0%,#f9c2dc 30%,#fff 50%,#f3a7cb 75%,#fff 100%)",
      }}
    >
      <div className="relative flex aspect-[3/4] flex-col items-center justify-center overflow-hidden rounded-[0.65em] border border-white/80 bg-[linear-gradient(160deg,rgba(255,255,255,0.92),rgba(255,226,239,0.8)_45%,rgba(255,255,255,0.9))] shadow-[inset_0_0_1.2em_rgba(255,255,255,0.9)] backdrop-blur-sm">
        <span aria-hidden className="absolute inset-x-[8%] top-[5%] h-[30%] rounded-[0.5em] bg-gradient-to-b from-white/80 to-transparent" />
        <m.span
          key={value}
          className="relative font-display text-[2.6em] font-semibold leading-none tabular-nums"
          initial={heart ? { scale: 1.3 } : { y: "-0.25em", scale: 1.08 }}
          animate={heart ? { scale: [1.3, 0.92, 1.12, 1] } : { y: 0, scale: 1 }}
          transition={heart ? { duration: 0.7, times: [0, 0.3, 0.55, 1] } : { type: "spring", stiffness: 520, damping: 14 }}
        >
          <Gold>{value}</Gold>
        </m.span>
        <span className="relative mt-[0.35em] font-display text-[0.8em] font-semibold" style={{ color: "#b8862f" }}>
          {label}
        </span>
        <m.span
          aria-hidden
          className="absolute inset-y-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/80 to-transparent"
          initial={{ left: "-40%" }}
          animate={{ left: ["-40%", "140%"] }}
          transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 3, ease: "easeInOut" }}
        />
        {heart && <span aria-hidden className="absolute right-[8%] top-[4%] text-[0.7em] text-[#ff4fa3]">♥</span>}
      </div>
    </div>
  );
}

function Boxes({ t, className, testId }: { t: ReturnType<typeof useCountdown>; className?: string; testId?: string }) {
  return (
    <div className={cn("grid grid-cols-4 gap-[0.45em]", className)} role="timer" aria-live="off" data-testid={testId}>
      <CrystalBox value={pad(t?.days)} label="Days" />
      <CrystalBox value={pad(t?.hours)} label="Hours" />
      <CrystalBox value={pad(t?.minutes)} label="Minutes" />
      <CrystalBox value={pad(t?.seconds)} label="Seconds" heart />
    </div>
  );
}

function DateBlock({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col items-center text-center leading-none", className)}>
      <Neon className="font-display text-[1.25em] font-bold tracking-wide">TONIGHT</Neon>
      <Neon className="font-display text-[2.6em] font-bold">10PM</Neon>
      <Gold className="mt-[0.15em] font-display text-[1.5em] font-semibold italic">Thursday</Gold>
      <Gold className="font-display text-[1.5em] font-semibold italic">Oct 29</Gold>
    </div>
  );
}

function Brand({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col items-center leading-none", className)}>
      <Gold className="font-display text-[2.6em] font-semibold tracking-[0.08em]">ATTITUDE</Gold>
      <Gold className="mt-[0.2em] font-display text-[1em] font-semibold tracking-[0.35em]">COLLECTIONS</Gold>
    </div>
  );
}

// ---------- /coming-soon ----------

export function ComingSoon({ whatsappHref }: { whatsappHref: string | null }) {
  const t = useCountdown();
  const reduce = useReducedMotion() ?? false;
  const router = useRouter();
  const done = t?.left === 0;
  useEffect(() => {
    if (done) router.replace("/");
  }, [done, router]);

  return (
    <MotionProvider>
      <main className="relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-8 text-[15px] sm:text-[18px]" data-testid="coming-soon">
        <Backdrop still={reduce} />
        <m.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="relative w-full max-w-xl">
          <Brand />
          <h1 className="mt-4 text-center font-display text-[2em] font-bold leading-tight sm:text-[2.4em]">
            <Neon>WE&rsquo;RE LAUNCHING SOON</Neon>
          </h1>

          <div className="relative mt-2 flex items-center justify-center">
            <DateBlock className="absolute left-0 top-1/2 z-10 -translate-y-1/2 text-[0.85em] sm:left-2 sm:text-[1em]" />
            <m.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1, delay: 0.2 }} className="w-[58%] max-w-[18rem] sm:w-[52%]">
              <Hourglass seconds={t?.seconds} still={reduce} className="w-full drop-shadow-[0_0_30px_rgba(255,255,255,0.8)]" />
            </m.div>
          </div>

          <Boxes t={t} testId="countdown" className="mx-auto mt-4 max-w-lg text-[14px] sm:text-[20px]" />

          <p className="mt-6 text-center font-display text-[1.35em] font-semibold">
            <Gold>Attitude Collections Official Launch</Gold>
          </p>
          <p className="mt-1 text-center text-[0.8em] font-semibold uppercase tracking-[0.3em] text-[#b3246f]">Thursday 10:00 PM</p>

          {whatsappHref && (
            <div className="mt-6 flex justify-center">
              <m.a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
                animate={reduce ? undefined : { boxShadow: ["0 0 0 0 rgba(255,20,147,0.55)", "0 0 0 16px rgba(255,20,147,0)"] }}
                transition={{ duration: 1.6, repeat: Infinity }}
                className="inline-flex items-center gap-2.5 rounded-full border-2 border-white bg-gradient-to-r from-[#ff5fae] to-[#ff1493] px-7 py-3.5 text-sm font-bold uppercase tracking-[0.15em] text-white"
                data-testid="notify-whatsapp"
              >
                <WhatsAppIcon className="size-5" /> Notify Me on WhatsApp
              </m.a>
            </div>
          )}
        </m.div>
      </main>
    </MotionProvider>
  );
}

// ---------- 9:16 frames (WhatsApp Status) ----------

/** A 1080×1920 canvas scaled to fit the screen, for screen recording or screenshots. */
function Frame916({ children, testId }: { children: React.ReactNode; testId: string }) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / 1080, window.innerHeight / 1920));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return (
    <MotionProvider>
      <div className="fixed inset-0 grid place-items-center overflow-hidden bg-black">
        <div style={{ width: 1080 * scale, height: 1920 * scale }}>
          <div
            data-testid={testId}
            className="relative isolate h-[1920px] w-[1080px] origin-top-left overflow-hidden"
            style={{ transform: `scale(${scale})`, fontSize: 40 }}
          >
            <Backdrop still={false} />
            {children}
          </div>
        </div>
      </div>
    </MotionProvider>
  );
}

/** Vertical countdown for a WhatsApp Status recording (/coming-soon/status) — the hourglass look. */
export function StatusCountdown() {
  const t = useCountdown();
  return (
    <Frame916 testId="status-frame">
      <div className="relative flex h-full flex-col items-center px-12 pt-24 pb-28">
        <Brand className="text-[44px]" />
        <div className="relative mt-6 flex w-full flex-1 items-center justify-center">
          <DateBlock className="absolute left-4 top-1/2 z-10 -translate-y-1/2 text-[52px]" />
          <Hourglass seconds={t?.seconds} className="h-[1080px] drop-shadow-[0_0_60px_rgba(255,255,255,0.85)]" />
        </div>
        <Boxes t={t} className="mt-10 w-full text-[64px]" />
      </div>
    </Frame916>
  );
}

/** WhatsApp poster, 1080×1920 (/coming-soon/poster): "launches tonight 10PM" with the hourglass and live boxes. */
export function LaunchPoster() {
  const t = useCountdown();
  return (
    <Frame916 testId="poster-frame">
      <div className="relative flex h-full flex-col items-center px-12 pt-24 pb-24 text-center">
        <Brand className="text-[44px]" />
        <p className="mt-10 font-display text-[92px] font-bold leading-[1.05]">
          <Neon>LAUNCHES</Neon>
          <br />
          <Neon>TONIGHT 10PM</Neon>
        </p>
        <div className="flex flex-1 items-center">
          <Hourglass seconds={t?.seconds} className="h-[760px] drop-shadow-[0_0_60px_rgba(255,255,255,0.85)]" />
        </div>
        <Boxes t={t} className="w-full text-[64px]" />
        <p className="mt-10 font-display text-[44px] font-semibold italic">
          <Gold>Thursday Oct 29 · 10:00 PM WAT</Gold>
        </p>
      </div>
    </Frame916>
  );
}
