import { cn } from "@/lib/cn";

/**
 * ATTITUDE COLLECTIONS wordmark. The rose "slash" through the A crossbar is
 * the brand signature and is reused in the favicon monogram.
 */
export function Wordmark({ className, tone = "dark", compact = false }: { className?: string; tone?: "dark" | "light"; compact?: boolean }) {
  const ink = tone === "dark" ? "text-plum" : "text-white";
  return (
    <span role="img" className={cn("inline-flex flex-col items-center leading-none select-none", ink, className)} aria-label="Attitude Collections">
      <span aria-hidden className="relative font-display font-medium tracking-[0.22em] text-[1.35rem] sm:text-[1.6rem] pl-[0.22em]">
        <span className="relative">
          A
          <span className="absolute left-[-6%] right-[-6%] top-[58%] h-[2px] -rotate-[12deg] rounded-full bg-rose" />
        </span>
        TTITUDE
      </span>
      {!compact && (
        <span aria-hidden className="mt-1 font-sans text-[0.5rem] sm:text-[0.55rem] font-semibold tracking-[0.62em] pl-[0.62em] opacity-80">
          COLLECTIONS
        </span>
      )}
    </span>
  );
}

export function Monogram({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <path d="M18 50 L32 13 L46 50" fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="square" />
      <path d="M21 38 L47 32" stroke="#D94F91" strokeWidth="4.5" strokeLinecap="round" />
    </svg>
  );
}
