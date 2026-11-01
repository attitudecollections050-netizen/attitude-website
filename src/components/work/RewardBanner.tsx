"use client";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export interface RewardBannerProps {
  /** "win" = confetti and celebration; "loss" = gentle, encouraging. */
  variant: "win" | "loss";
  title: string;
  message?: string;
  /** Text for the main button (defaults to "Yay! 💖" / "I'll do better 💪"). */
  actionLabel?: string;
  onAction?: () => void;
  onClose: () => void;
}

const COLORS = ["#E94E8A", "#FFB6D9", "#FACC15", "#34D399", "#60A5FA", "#C084FC", "#FB923C"];

/** Full-screen confetti on a canvas (no library). Skipped when the person prefers less motion. */
function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
    };
    resize();
    window.addEventListener("resize", resize);
    const W = () => canvas.width, H = () => canvas.height;
    const pieces = Array.from({ length: 160 }, (_, i) => ({
      x: Math.random() * W(),
      y: -Math.random() * H() * (i < 60 ? 0.2 : 1),
      w: (6 + Math.random() * 8) * dpr,
      h: (8 + Math.random() * 10) * dpr,
      vy: (2 + Math.random() * 3.5) * dpr,
      vx: (Math.random() - 0.5) * 2.2 * dpr,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.25,
      color: COLORS[i % COLORS.length],
      round: Math.random() < 0.3,
    }));
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      ctx.clearRect(0, 0, W(), H());
      const fading = t - start > 6000; // stop adding new rounds after 6 s
      let alive = 0;
      for (const p of pieces) {
        p.x += p.vx + Math.sin((t + p.y) / 400) * 0.6 * dpr;
        p.y += p.vy;
        p.rot += p.vr;
        if (p.y > H() + 20) {
          if (fading) continue;
          p.y = -20;
          p.x = Math.random() * W();
        }
        alive++;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.round) {
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
          ctx.fill();
        } else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (alive > 0) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);
  return <canvas ref={ref} className="pointer-events-none absolute inset-0 size-full" aria-hidden data-testid="confetti" />;
}

/**
 * A full-screen reward banner, e.g. "🎉 Congratulations! You just won 25 Naira!" with confetti,
 * or "😢 3 Negatives completed — you lost 25 Naira". Closes with the button, ✕ or Escape.
 */
export function RewardBanner({ variant, title, message, actionLabel, onAction, onClose }: RewardBannerProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const win = variant === "win";
  return (
    <div
      className={cn(
        "fixed inset-0 z-[120] flex items-center justify-center p-5",
        win ? "bg-gradient-to-b from-[#FFE4EF]/95 via-[#FFF5FA]/95 to-[#FEF9C3]/95" : "bg-gradient-to-b from-[#E0E7FF]/95 via-[#F5F3FF]/95 to-[#FFF7ED]/95",
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reward-title"
      data-testid={`reward-${variant}`}
    >
      {win && <Confetti />}
      {!win && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          {Array.from({ length: 14 }, (_, i) => (
            <span key={i} className="reward-drop absolute text-2xl opacity-60" style={{ left: `${(i * 7.3) % 100}%`, animationDelay: `${(i % 7) * 0.45}s` }}>
              💧
            </span>
          ))}
        </div>
      )}
      <div className={cn("reward-pop relative w-full max-w-sm rounded-[2rem] border-4 bg-white p-7 text-center shadow-2xl", win ? "border-[#FFB6D9]" : "border-[#C4B5FD]")}>
        <button ref={closeRef} type="button" onClick={onClose} className="absolute right-3 top-3 grid size-9 place-items-center rounded-full text-black/50 hover:bg-black/5" aria-label="Close" data-testid="reward-close">
          <X className="size-5" />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mascots/girl-face.png" alt="Haru" className={cn("mx-auto size-24 rounded-full border-4 object-cover", win ? "reward-bounce border-[#FFB6D9]" : "border-[#C4B5FD] grayscale-[30%]")} />
        <h2 id="reward-title" className={cn("mt-4 font-display text-2xl font-semibold leading-tight", win ? "text-[#C2185B]" : "text-[#5B21B6]")}>
          {title}
        </h2>
        {message && <p className="mt-3 text-sm leading-relaxed text-plum">{message}</p>}
        <button
          type="button"
          onClick={onAction ?? onClose}
          className={cn("mt-6 w-full rounded-full px-6 py-3 text-base font-bold text-white", win ? "bg-[#E94E8A] shadow-[4px_4px_0_#9D174D]" : "bg-[#7C3AED] shadow-[4px_4px_0_#4C1D95]")}
          data-testid="reward-action"
        >
          {actionLabel ?? (win ? "Yay! 💖" : "I'll do better 💪")}
        </button>
      </div>
    </div>
  );
}
