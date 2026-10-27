import { cn } from "@/lib/cn";

/** Brand mark: the pink "A" with the black swoosh (transparent PNG/WebP in /public/brand). */
export function Monogram({ className }: { className?: string }) {
  return (
    <span className={cn("inline-block shrink-0", className)} aria-hidden>
      <picture className="block size-full">
        <source srcSet="/brand/attitude-logo.webp" type="image/webp" />
        <img src="/brand/attitude-logo.png" alt="" width={384} height={344} decoding="async" className="size-full object-contain" />
      </picture>
    </span>
  );
}

/**
 * ATTITUDE COLLECTIONS logo lockup: the "A" mark beside the name.
 * `inline` is the header size, the default is slightly larger, `compact` drops "COLLECTIONS".
 */
export function Wordmark({ className, tone = "dark", compact = false, inline = false }: { className?: string; tone?: "dark" | "light"; compact?: boolean; inline?: boolean }) {
  const ink = tone === "dark" ? "text-plum" : "text-white";
  return (
    <span role="img" aria-label="Attitude Collections" className={cn("inline-flex items-center leading-none select-none", inline || compact ? "gap-2.5" : "gap-3", ink, className)}>
      <Monogram className={inline || compact ? "size-9" : "size-11"} />
      <span aria-hidden className="flex flex-col">
        <span className={cn("font-display font-medium tracking-[0.3em]", inline || compact ? "text-[1.3rem]" : "text-[1.5rem]")}>ATTITUDE</span>
        {!compact && <span className="mt-0.5 font-sans text-[0.45rem] font-semibold tracking-[0.68em] opacity-70">COLLECTIONS</span>}
      </span>
    </span>
  );
}
