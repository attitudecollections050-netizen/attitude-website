"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { m, useReducedMotion } from "motion/react";
import { MotionProvider } from "@/components/ui/MotionProvider";
import { Monogram } from "@/components/brand/Wordmark";
import { WhatsAppIcon } from "@/components/ui/WhatsAppLink";
import { launchTime } from "@/lib/launch";
import { cn } from "@/lib/cn";

// ---------- time ----------

// One shared clock that ticks every second on the client (null during server render, so no hydration mismatch).
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

// ---------- decoration ----------

// Fixed pseudo-random layout so server and client render the same thing.
function seeded(count: number, seed: number) {
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  return Array.from({ length: count }, (_, i) => ({ i, x: rnd() * 100, y: rnd() * 100, size: rnd(), delay: rnd() * 6, dur: 6 + rnd() * 8 }));
}
const BLOBS = seeded(7, 7);
const CHARMS = seeded(26, 42);
const GLYPHS = ["♥", "✦", "★", "✧", "♥", "❤", "✨"];

function Backdrop({ still }: { still: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(160deg,#FFC1E3_0%,#FF1493_52%,#FFE4E1_100%)]" />
      <m.div
        className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.55),transparent_45%),radial-gradient(circle_at_80%_85%,rgba(255,105,180,0.6),transparent_50%)]"
        animate={still ? undefined : { opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
      {BLOBS.map((b) => (
        <m.div
          key={b.i}
          className="absolute rounded-full blur-3xl"
          style={{
            left: `${b.x}%`,
            top: `${b.y}%`,
            width: `${18 + b.size * 30}%`,
            aspectRatio: "1",
            background: b.i % 2 ? "rgba(255,255,255,0.55)" : "rgba(255,20,147,0.55)",
            translateX: "-50%",
            translateY: "-50%",
          }}
          animate={still ? undefined : { x: [0, 40, -30, 0], y: [0, -50, 30, 0], scale: [1, 1.15, 0.9, 1] }}
          transition={{ duration: b.dur + 6, repeat: Infinity, ease: "easeInOut", delay: b.delay }}
        />
      ))}
      {CHARMS.map((c) => (
        <m.span
          key={c.i}
          className="absolute select-none"
          style={{
            left: `${c.x}%`,
            top: `${c.y}%`,
            fontSize: `${0.8 + c.size * 1.8}em`,
            color: c.i % 3 === 0 ? "#fff" : c.i % 3 === 1 ? "#FF69B4" : "#FFD1E8",
            textShadow: "0 0 12px rgba(255,255,255,0.9)",
          }}
          initial={{ opacity: 0 }}
          animate={still ? { opacity: 0.8 } : { opacity: [0, 1, 1, 0], y: [20, -60, -120, -180], rotate: [0, 20, -15, 10], scale: [0.6, 1.1, 1, 0.7] }}
          transition={{ duration: c.dur, repeat: Infinity, delay: c.delay, ease: "easeOut" }}
        >
          {GLYPHS[c.i % GLYPHS.length]}
        </m.span>
      ))}
    </div>
  );
}

function Shimmer({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <m.span
      className={cn("inline-block bg-clip-text text-transparent", className)}
      style={{
        backgroundImage: "linear-gradient(110deg,#ffffff 20%,#FFD700 35%,#ffffff 45%,#FFB6D9 55%,#ffffff 70%)",
        backgroundSize: "250% 100%",
        filter: "drop-shadow(0 2px 10px rgba(199,21,133,0.55))",
      }}
      animate={{ backgroundPosition: ["100% 0%", "-150% 0%"] }}
      transition={{ duration: 3.2, repeat: Infinity, ease: "linear" }}
    >
      {children}
    </m.span>
  );
}

function Box({ value, label, heart, big }: { value: string; label: string; heart?: boolean; big?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <m.div
        key={value}
        initial={heart ? { scale: 1.25 } : { y: -10, scale: 1.06 }}
        animate={heart ? { scale: [1.25, 0.95, 1.12, 1] } : { y: 0, scale: 1 }}
        transition={heart ? { duration: 0.7, times: [0, 0.3, 0.55, 1] } : { type: "spring", stiffness: 520, damping: 14 }}
        className={cn(
          "relative grid place-items-center overflow-hidden rounded-2xl border border-white/70 bg-gradient-to-b from-[#FF69B4] to-[#FF1493] font-display font-semibold text-white tabular-nums shadow-[0_10px_30px_rgba(199,21,133,0.45),inset_0_2px_0_rgba(255,255,255,0.6)]",
          big ? "h-[11.5em] w-[9.5em] text-[1em]" : "h-[4.6rem] w-[4.1rem] text-[2.1rem] sm:h-24 sm:w-[5.5rem] sm:text-5xl",
        )}
      >
        <span className={cn(big && "text-[6.5em] leading-none")}>{value}</span>
        <span aria-hidden className="absolute inset-x-0 top-0 h-1/2 bg-white/15" />
        {heart && <span aria-hidden className="absolute -right-1 -top-1 text-[0.9em]">♥</span>}
      </m.div>
      <span className={cn("font-semibold uppercase tracking-[0.25em] text-white drop-shadow", big ? "text-[2.4em]" : "text-[0.65rem] sm:text-xs")}>{label}</span>
    </div>
  );
}

/** Small tick mark that flicks with each second (a visual "tick", no sound). */
function Tick({ s }: { s: number | undefined }) {
  return (
    <m.span
      key={s}
      aria-hidden
      initial={{ rotate: -25, opacity: 0.4 }}
      animate={{ rotate: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 600, damping: 12 }}
      className="inline-block origin-bottom text-white"
    >
      ⏱
    </m.span>
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
      <main className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10 text-white">
        <Backdrop still={reduce} />
        <m.section
          initial={{ opacity: 0, y: 30, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
          className="relative w-full max-w-xl rounded-[2rem] border border-white/60 bg-white/20 px-5 py-9 text-center shadow-[0_30px_80px_rgba(199,21,133,0.35)] backdrop-blur-xl sm:px-10 sm:py-12"
          data-testid="coming-soon"
        >
          <m.div
            className="mx-auto grid size-20 place-items-center rounded-full bg-white/90 text-[#C71585] shadow-[0_0_40px_rgba(255,255,255,0.8)] sm:size-24"
            animate={reduce ? undefined : { rotate: [0, -6, 6, 0], scale: [1, 1.05, 1] }}
            transition={{ duration: 4, repeat: Infinity }}
          >
            <Monogram className="size-12 sm:size-14" />
          </m.div>
          <p className="mt-4 font-display text-2xl tracking-[0.35em] sm:text-3xl">ATTITUDE</p>
          <p className="text-[0.7rem] font-semibold tracking-[0.6em] text-white/90">COLLECTIONS</p>

          <h1 className="mt-7 font-display text-4xl font-semibold leading-tight sm:text-6xl">
            <Shimmer>WE&rsquo;RE LAUNCHING SOON</Shimmer>
          </h1>

          <div className="mt-8 flex justify-center gap-2.5 sm:gap-4" role="timer" aria-live="off" data-testid="countdown">
            <Box value={pad(t?.days)} label="Days" />
            <Box value={pad(t?.hours)} label="Hours" />
            <Box value={pad(t?.minutes)} label="Minutes" />
            <Box value={pad(t?.seconds)} label="Seconds" heart />
          </div>

          <p className="mt-8 font-display text-2xl font-semibold sm:text-3xl">Attitude Collections Official Launch</p>
          <p className="mt-2 flex items-center justify-center gap-2 text-sm font-semibold uppercase tracking-[0.3em]">
            <Tick s={t?.seconds} /> Thursday 10:00 PM
          </p>

          {whatsappHref && (
            <m.a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              animate={reduce ? undefined : { boxShadow: ["0 0 0 0 rgba(255,255,255,0.7)", "0 0 0 16px rgba(255,255,255,0)"] }}
              transition={{ duration: 1.6, repeat: Infinity }}
              className="mt-8 inline-flex items-center gap-2.5 rounded-full bg-white px-7 py-3.5 text-sm font-bold uppercase tracking-[0.15em] text-[#C71585]"
              data-testid="notify-whatsapp"
            >
              <WhatsAppIcon className="size-5" /> Notify Me on WhatsApp
            </m.a>
          )}
        </m.section>
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
            className="relative isolate flex h-[1920px] w-[1080px] origin-top-left flex-col items-center justify-center overflow-hidden text-center text-white"
            style={{ transform: `scale(${scale})`, fontSize: 24 }}
          >
            <Backdrop still={false} />
            {children}
          </div>
        </div>
      </div>
    </MotionProvider>
  );
}

function BrandMark() {
  return (
    <m.div initial={{ opacity: 0, y: -40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9 }} className="flex flex-col items-center">
      <m.div
        className="grid size-[200px] place-items-center rounded-full bg-white/90 text-[#C71585] shadow-[0_0_90px_rgba(255,255,255,0.9)]"
        animate={{ rotate: [0, -6, 6, 0], scale: [1, 1.06, 1] }}
        transition={{ duration: 4, repeat: Infinity }}
      >
        <Monogram className="size-[120px]" />
      </m.div>
      <p className="mt-8 font-display text-[88px] leading-none tracking-[0.3em]">ATTITUDE</p>
      <p className="mt-3 text-[30px] font-semibold tracking-[0.7em]">COLLECTIONS</p>
    </m.div>
  );
}

/** Vertical countdown for a WhatsApp Status recording (/coming-soon/status). */
export function StatusCountdown() {
  const t = useCountdown();
  return (
    <Frame916 testId="status-frame">
      <div className="relative flex h-full w-full flex-col items-center justify-between px-16 py-28">
        <BrandMark />
        <div className="flex flex-col items-center">
          <p className="font-display text-[110px] font-semibold leading-[1.05]">
            <Shimmer>WE&rsquo;RE</Shimmer>
            <br />
            <Shimmer>LAUNCHING</Shimmer>
            <br />
            <Shimmer>SOON</Shimmer>
          </p>
          <div className="mt-12 grid grid-cols-2 gap-x-14 gap-y-10" style={{ fontSize: 19 }}>
            <Box big value={pad(t?.days)} label="Days" />
            <Box big value={pad(t?.hours)} label="Hours" />
            <Box big value={pad(t?.minutes)} label="Minutes" />
            <Box big value={pad(t?.seconds)} label="Seconds" heart />
          </div>
        </div>
        <div className="flex flex-col items-center gap-5">
          <p className="font-display text-[64px] font-semibold leading-tight">Official Launch</p>
          <m.p
            className="rounded-full bg-white px-14 py-6 text-[44px] font-bold uppercase tracking-[0.2em] text-[#C71585] shadow-[0_20px_60px_rgba(199,21,133,0.5)]"
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            Thursday 10:00 PM
          </m.p>
        </div>
      </div>
    </Frame916>
  );
}

/** WhatsApp poster, 1080×1920 (/coming-soon/poster): "launches tonight 10PM" with a ticking HH:MM:SS. */
export function LaunchPoster() {
  const t = useCountdown();
  const hours = t ? t.days * 24 + t.hours : undefined;
  return (
    <Frame916 testId="poster-frame">
      <div className="relative flex h-full w-full flex-col items-center justify-between px-14 py-36">
        <BrandMark />
        <div className="flex flex-col items-center">
          <m.p
            className="font-display text-[150px] font-bold leading-[0.95]"
            animate={{ scale: [1, 1.04, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          >
            <Shimmer>LAUNCHES</Shimmer>
            <br />
            <Shimmer>TONIGHT</Shimmer>
          </m.p>
          <m.p
            className="mt-8 rounded-[40px] bg-white px-16 py-4 font-display text-[170px] font-bold leading-none text-[#FF1493] shadow-[0_0_80px_rgba(255,255,255,0.85)]"
            animate={{ rotate: [-2, 2, -2] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          >
            10PM
          </m.p>
          <div className="mt-20 flex items-start gap-6" style={{ fontSize: 17 }}>
            <Box big value={pad(hours)} label="Hours" />
            <span className="mt-[80px] text-[110px] font-bold">:</span>
            <Box big value={pad(t?.minutes)} label="Mins" />
            <span className="mt-[80px] text-[110px] font-bold">:</span>
            <Box big value={pad(t?.seconds)} label="Secs" heart />
          </div>
        </div>
        <p className="text-[40px] font-semibold uppercase tracking-[0.3em]">Wear your ATTITUDE ♥</p>
      </div>
    </Frame916>
  );
}
