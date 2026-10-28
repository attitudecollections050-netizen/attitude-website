import Link from "next/link";

/**
 * Long moving banner at the very top of the store. The text comes from
 * Admin → Homepage → Announcement bar; separate several messages with "|".
 * It pauses on hover/focus and stays still for visitors who prefer reduced motion.
 */
export function AnnouncementBar({ text, href }: { text: string; href: string | null }) {
  if (!text) return null;
  const parts = text.split("|").map((t) => t.trim()).filter(Boolean);
  const run = (key: string, hidden = false) => (
    <div key={key} className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {Array.from({ length: 4 }).flatMap((_, r) =>
        parts.map((p, i) => (
          <span key={`${r}-${i}`} className="flex items-center">
            <span className="eyebrow whitespace-nowrap px-6 !tracking-[0.22em] text-[0.64rem] sm:text-[0.7rem]">{p}</span>
            <span className="text-rose-light" aria-hidden>✦</span>
          </span>
        )),
      )}
    </div>
  );
  const track = (
    <div className="group relative flex overflow-hidden bg-gradient-to-r from-plum via-[#4a2140] to-plum py-2.5 text-white">
      <span className="sr-only">{parts.join(". ")}</span>
      <div className="flex w-max animate-marquee group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused] motion-reduce:animate-none" aria-hidden>
        {run("a", true)}
        {run("b", true)}
      </div>
      <span className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-plum to-transparent" aria-hidden />
      <span className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-plum to-transparent" aria-hidden />
    </div>
  );
  return href ? (
    <Link href={href} className="block" aria-label={parts.join(". ")}>
      {track}
    </Link>
  ) : (
    track
  );
}
