"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { ArrowRight, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { useTranslations } from "next-intl";
import { SmartImage } from "@/components/ui/SmartImage";
import { ButtonLink } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { createHeroTrack, type HeroTrack } from "@/lib/audio/heroTrack";

/**
 * Homepage hero as a short fashion film (about 19 seconds, looping): an intro with a handwritten
 * "ATTITUDE", a giant headline snapping into focus, the hero photo floating with call-out labels,
 * a "choose your ATTITUDE" split, then the title and call to action. Pink on plum, story-style
 * progress bars, original music on request ("Tap for sound"), and a pause button. Visitors who
 * prefer reduced motion get the still final frame. Wording and images come from Admin → Homepage.
 */

const SCENES = [
  { id: "intro", ms: 2600 },
  { id: "headline", ms: 3200 },
  { id: "photo", ms: 5200 },
  { id: "choose", ms: 3800 },
  { id: "cta", ms: 4800 },
] as const;
type SceneId = (typeof SCENES)[number]["id"];
const TOTAL = SCENES.reduce((n, s) => n + s.ms, 0);
const EASE = [0.22, 1, 0.36, 1] as const;

const noopSubscribe = () => () => {};

export interface Edition {
  label: string;
  image: string | null;
}

export function Hero({
  eyebrow,
  title,
  subtitle,
  imageUrl,
  ctaLabel,
  ctaHref,
  editions = [],
}: {
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  /** Each loop of the film features the next edition (e.g. Sneaker, Bag, Clothing). */
  editions?: Edition[];
}) {
  const t = useTranslations("home");
  // Decided in the browser only, so the server and first render agree (the film's first frame).
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const prefersReduced = useReducedMotion();
  const reduce = mounted && Boolean(prefersReduced);
  const [scene, setScene] = useState(0);
  const [loop, setLoop] = useState(0); // which edition this pass of the film features
  const elapsed = useRef(0); // ms into the current scene
  const bars = useRef<(HTMLSpanElement | null)[]>([]);
  const [second, setSecond] = useState(0); // whole seconds into the film, for the timecode
  const [paused, setPaused] = useState(false);
  const [sound, setSound] = useState(false);
  const track = useRef<HeroTrack | null>(null);
  const root = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(true);

  const current: SceneId = reduce ? "cta" : SCENES[scene].id;
  const running = !reduce && !paused && inView;

  // One clock drives the scenes; the progress bars are updated directly (no re-render per frame).
  useEffect(() => {
    const paint = () => {
      SCENES.forEach((sc, i) => {
        const el = bars.current[i];
        if (el) el.style.width = i < scene ? "100%" : i === scene ? `${Math.min(100, (elapsed.current / sc.ms) * 100)}%` : "0%";
      });
    };
    paint();
    if (!running) return;
    const before = SCENES.slice(0, scene).reduce((n, sc) => n + sc.ms, 0);
    let last = performance.now();
    let frame = requestAnimationFrame(function loop(now) {
      elapsed.current += now - last;
      last = now;
      if (elapsed.current >= SCENES[scene].ms) {
        elapsed.current = 0;
        if (scene === SCENES.length - 1) setLoop((n) => n + 1);
        setScene((scene + 1) % SCENES.length);
        return;
      }
      paint();
      const sec = Math.floor((before + elapsed.current) / 1000);
      setSecond((prev) => (prev === sec ? prev : sec));
      frame = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(frame);
  }, [running, scene]);

  // Sound effects on scene changes.
  useEffect(() => {
    if (!sound) return;
    if (SCENES[scene].id === "cta") track.current?.chime();
    else track.current?.whoosh();
  }, [scene, sound]);

  // Pause the film (and music) when the hero scrolls out of view.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!track.current) return;
    if (sound && inView && !paused) void track.current.play();
    else track.current.pause();
  }, [sound, inView, paused]);
  useEffect(() => () => track.current?.dispose(), []);

  const toggleSound = useCallback(async () => {
    if (!track.current) track.current = createHeroTrack();
    if (!track.current) return;
    if (sound) {
      track.current.pause();
      setSound(false);
    } else {
      await track.current.play();
      setSound(true);
      setPaused(false);
    }
  }, [sound]);

  const words = title.split(" ");
  const list: Edition[] = editions.length ? editions : [{ label: "New Edition", image: imageUrl }];
  const edition = list[loop % list.length];
  const tiles = [0, 1, 2].map((i) => list[(loop + i) % list.length]);

  return (
    <section
      ref={root}
      className="relative isolate overflow-hidden bg-plum text-white"
      aria-labelledby="hero-heading"
      aria-roledescription="video"
      data-scene={current}
    >
      {/* The real heading, always there for search engines and screen readers */}
      <h1 id="hero-heading" className="sr-only">{title}</h1>

      {/* Moving pink wash */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <span className="absolute -left-[15%] -top-[25%] size-[70vmax] animate-blob rounded-full bg-[radial-gradient(circle,#d94f91_0%,rgba(217,79,145,0)_65%)] opacity-70 motion-reduce:animate-none" />
        <span className="absolute -bottom-[30%] -right-[10%] size-[65vmax] animate-blob rounded-full bg-[radial-gradient(circle,#f283b8_0%,rgba(242,131,184,0)_62%)] opacity-55 [animation-delay:-5s] motion-reduce:animate-none" />
        <span className="absolute left-[30%] top-[35%] size-[45vmax] animate-blob rounded-full bg-[radial-gradient(circle,#7a2458_0%,rgba(122,36,88,0)_65%)] opacity-80 [animation-delay:-9s] motion-reduce:animate-none" />
        {/* film grain */}
        <span className="absolute inset-0 opacity-[0.09] mix-blend-overlay [background-image:url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22160%22 height=%22160%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%222%22/></filter><rect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/></svg>')]" />
      </div>

      <div className="relative min-h-[82svh] sm:min-h-[86svh] lg:min-h-[calc(100svh-7rem)]">
        {/* Story-style progress bars + HUD */}
        {!reduce && (
          <div className="absolute inset-x-0 top-0 z-20 px-4 pt-4 sm:px-8 sm:pt-6">
            <div className="flex gap-1.5" aria-hidden>
              {SCENES.map((s, i) => (
                <span key={s.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/20">
                  <span
                    ref={(el) => {
                      bars.current[i] = el;
                    }}
                    className="block h-full w-0 rounded-full bg-gradient-to-r from-rose-light to-white"
                  />
                </span>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-white/70" aria-hidden>
              <span>Attitude® · Vol.01</span>
              <span className="hidden sm:inline">New season · {edition.label} · Lagos</span>
              <span className="tabular-nums">{fmt(second * 1000)} / {fmt(TOTAL)}</span>
            </div>
          </div>
        )}

        <AnimatePresence mode="sync" initial={false}>
          <m.div
            key={current}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.45 } }}
            transition={{ duration: 0.5 }}
            aria-hidden={current !== "cta"}
          >
            {current === "intro" && <Intro edition={edition.label} />}
            {current === "headline" && <Headline edition={edition.label} />}
            {current === "photo" && <Photo imageUrl={edition.image ?? imageUrl} edition={edition.label} drop={(loop % list.length) + 1} />}
            {current === "choose" && <Choose tiles={tiles} fallback={imageUrl} />}
            {current === "cta" && (
              <Cta imageUrl={imageUrl} eyebrow={eyebrow} words={words} subtitle={subtitle} ctaLabel={ctaLabel ?? t("shopNow")} ctaHref={ctaHref ?? "/shop"} explore={t("exploreCollections")} still={Boolean(reduce)} />
            )}
          </m.div>
        </AnimatePresence>

        {/* Always-available shop button (outside the last scene) and the film controls */}
        <div className="absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-3 px-4 pb-5 sm:px-8 sm:pb-8">
          <AnimatePresence>
            {current !== "cta" && (
              <m.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
                <ButtonLink href={ctaHref ?? "/shop"} variant="rose" size="md">
                  {ctaLabel ?? t("shopNow")} <ArrowRight className="size-4" aria-hidden />
                </ButtonLink>
              </m.div>
            )}
          </AnimatePresence>
        </div>
        {/* Film controls: top right, clear of the chat button in the corner */}
        {!reduce && (
          <div className="absolute right-4 top-14 z-20 sm:right-8 sm:top-16">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPaused((p) => !p)}
                aria-label={paused ? "Play the banner film" : "Pause the banner film"}
                className="grid size-11 place-items-center rounded-full bg-white/12 text-white ring-1 ring-white/25 backdrop-blur transition hover:bg-white hover:text-plum"
              >
                {paused ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}
              </button>
              <button
                type="button"
                onClick={toggleSound}
                aria-pressed={sound}
                aria-label={sound ? "Turn sound off" : "Turn sound on"}
                data-testid="hero-sound"
                className={cn(
                  "relative inline-flex h-11 items-center gap-2 rounded-full px-4 text-[11px] font-bold uppercase tracking-[0.16em] ring-1 backdrop-blur transition",
                  sound ? "bg-white text-rose-deep ring-white" : "bg-rose text-white ring-rose-light/60 hover:bg-rose-deep",
                )}
              >
                {!sound && <span className="pointer-events-none absolute -inset-1 animate-pulse rounded-full ring-2 ring-rose-light/70 motion-reduce:hidden" aria-hidden />}
                <span className="relative inline-flex items-center gap-2">
                  {sound ? <Equalizer /> : <VolumeX className="size-4" aria-hidden />}
                  {sound ? "Sound on" : "Tap for sound"}
                  {sound && <Volume2 className="size-4" aria-hidden />}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  return `00:${String(s).padStart(2, "0")}`;
}

function Equalizer() {
  return (
    <span className="flex h-3.5 items-end gap-[2px]" aria-hidden>
      {[0, 0.25, 0.5, 0.15].map((d, i) => (
        <m.span key={i} className="w-[3px] rounded-sm bg-current" animate={{ height: ["30%", "100%", "45%", "85%", "30%"] }} transition={{ duration: 0.9, repeat: Infinity, delay: d }} />
      ))}
    </span>
  );
}

/** Script word that "writes" itself left to right. */
function Scribble({ text, className, delay = 0 }: { text: string; className?: string; delay?: number }) {
  return (
    <m.span
      className={cn("inline-block font-display italic leading-none", className)}
      initial={{ clipPath: "inset(0 100% 0 0)" }}
      animate={{ clipPath: "inset(0 0% 0 0)" }}
      transition={{ delay, duration: 1.3, ease: "easeInOut" }}
    >
      {text}
    </m.span>
  );
}

function Intro({ edition }: { edition: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-[#140b12]/90 px-6 text-center">
      <m.div className="flex items-center gap-4 font-mono text-[10px] uppercase tracking-[0.25em] text-white/70" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
        <span>Vol.01<br />Part 26</span>
        <m.span className="size-8 rounded-full bg-[conic-gradient(from_0deg,#d94f91,#f283b8,#fff0f5,#d94f91)]" animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }} />
        <span>{edition.split(" ")[0]}<br />Edition</span>
      </m.div>
      <div className="relative mt-6">
        <span className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center font-sans text-[22vw] font-extrabold leading-none text-white/[0.06] sm:text-[14rem]" aria-hidden>AC</span>
        <Scribble text="ATTITUDE" className="text-[13vw] text-rose-light sm:text-8xl lg:text-9xl" delay={0.25} />
      </div>
      <div className="mt-8 h-[3px] w-56 overflow-hidden rounded-full bg-white/15">
        <m.span className="block h-full bg-gradient-to-r from-rose to-rose-light" initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: 2.2, ease: "easeInOut" }} />
      </div>
      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.3em] text-white/60">Loading the {edition}</p>
    </div>
  );
}

function Headline({ edition }: { edition: string }) {
  return (
    <div className="flex h-full items-center justify-center overflow-hidden">
      <m.p
        className="whitespace-nowrap bg-gradient-to-b from-white via-pale to-rose-light bg-clip-text font-sans text-[21vw] font-extrabold leading-none tracking-tight text-transparent sm:text-[17vw]"
        initial={{ filter: "blur(28px)", scale: 1.25, letterSpacing: "0.12em", opacity: 0.4 }}
        animate={{ filter: "blur(0px)", scale: 1, letterSpacing: "-0.03em", opacity: 1 }}
        transition={{ duration: 1.6, ease: EASE }}
      >
        ATTITUDE
      </m.p>
      <m.p className="absolute bottom-[22%] flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.35em] text-white/85" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 }}>
        <span className="h-px w-8 bg-rose-light" /> {edition} <span className="h-px w-8 bg-rose-light" />
      </m.p>
    </div>
  );
}

function Callout({ className, label, value, delay, side }: { className: string; label: string; value: string; delay: number; side: "left" | "right" }) {
  return (
    <m.div className={cn("absolute flex items-center gap-2", side === "right" && "flex-row-reverse text-right", className)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay, duration: 0.5 }}>
      <span className="rounded-md border border-white/25 bg-white/10 px-2.5 py-1.5 font-mono text-[9px] uppercase leading-tight tracking-[0.16em] backdrop-blur sm:text-[10px]">
        <span className="block text-rose-light">{label}</span>
        {value}
      </span>
      <m.span className="h-px bg-gradient-to-r from-white/80 to-white/0" initial={{ width: 0 }} animate={{ width: 64 }} transition={{ delay: delay + 0.2, duration: 0.6 }} />
      <span className="size-2 rounded-full bg-rose-light shadow-[0_0_12px_#f283b8]" />
    </m.div>
  );
}

function Photo({ imageUrl, edition, drop }: { imageUrl: string | null; edition: string; drop: number }) {
  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden">
      <m.p
        className="pointer-events-none absolute top-[14%] whitespace-nowrap font-sans text-[19vw] font-extrabold leading-none tracking-tight text-transparent [-webkit-text-stroke:1.5px_rgba(242,131,184,0.55)] sm:text-[15vw]"
        initial={{ x: "8%" }}
        animate={{ x: "-8%" }}
        transition={{ duration: 5.2, ease: "linear" }}
        aria-hidden
      >
        ATTITUDE ATTITUDE
      </m.p>
      <m.div
        className="relative mt-16 aspect-[4/5] h-[46%] max-h-[34rem] animate-floaty overflow-hidden rounded-[2.2rem] shadow-[0_40px_90px_-30px_rgba(217,79,145,0.85)] ring-1 ring-white/30 sm:mt-10 sm:h-[60%]"
        initial={{ scale: 0.82, rotate: -6, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ duration: 1, ease: EASE }}
      >
        <SmartImage src={imageUrl} alt="" fill preload sizes="(min-width:1024px) 30rem, 70vw" className="object-cover object-[50%_25%]" />
        <span className="absolute inset-0 bg-gradient-to-t from-rose-deep/40 via-transparent to-white/10" />
        <span className="absolute inset-y-0 -left-1/3 w-1/3 animate-sweep bg-gradient-to-r from-transparent via-white/35 to-transparent" />
      </m.div>
      <Callout className="left-[4%] top-[36%] sm:left-[14%]" label={edition} value="New season" delay={0.7} side="left" />
      <Callout className="right-[4%] top-[58%] sm:right-[14%]" label="Made to be seen" value={`Drop ${String(drop).padStart(2, "0")}`} delay={1.2} side="right" />
      <div className="absolute bottom-[20%] left-[6%] -rotate-6 sm:left-[16%]">
        <Scribble text="wear your ATTITUDE" className="text-3xl text-white sm:text-6xl" delay={1.6} />
      </div>
    </div>
  );
}

function Choose({ tiles, fallback }: { tiles: Edition[]; fallback: string | null }) {
  return (
    <div className="grid h-full grid-rows-[auto_1fr] gap-3 px-4 pb-24 pt-28 sm:grid-cols-[0.8fr_1.2fr] sm:grid-rows-1 sm:gap-4 sm:px-8 sm:pt-32">
      <div className="flex flex-col justify-center gap-4 rounded-[1.6rem] bg-blush px-6 py-7 text-plum shadow-[0_30px_60px_-30px_rgba(217,79,145,0.7)] sm:px-10">
        <m.p className="font-mono text-[10px] uppercase tracking-[0.3em] text-rose-deep" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          Three editions · one ATTITUDE
        </m.p>
        <m.p className="font-sans text-4xl font-extrabold uppercase leading-[0.95] tracking-tight sm:text-6xl" initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15, duration: 0.7, ease: EASE }}>
          Choose your <span className="font-display font-normal italic text-rose-deep">ATTITUDE</span>
        </m.p>
        <div className="flex gap-2" aria-hidden>
          {["#d94f91", "#251923", "#f283b8", "#fff0f5"].map((c, i) => (
            <m.span key={c} className="size-6 rounded-full border-2 border-white shadow" style={{ background: c }} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.4 + i * 0.1, type: "spring", stiffness: 400, damping: 18 }} />
          ))}
        </div>
      </div>
      <div className="grid min-h-0 grid-cols-3 gap-2 sm:gap-3">
        {tiles.map((tile, i) => (
          <m.div
            key={i}
            className="relative overflow-hidden rounded-2xl bg-rose-deep"
            initial={{ y: i % 2 ? "-30%" : "30%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 + i * 0.15, duration: 0.8, ease: EASE }}
          >
            <SmartImage src={tile.image ?? fallback} alt="" fill sizes="25vw" className="animate-kenburns object-cover object-[50%_25%] motion-reduce:animate-none" />
            <span className="absolute inset-0 bg-gradient-to-t from-plum/80 via-transparent to-transparent" />
            <span className="absolute inset-x-0 bottom-0 p-2.5 font-mono text-[9px] uppercase leading-tight tracking-[0.18em] text-white sm:p-4 sm:text-[11px]">{tile.label}</span>
          </m.div>
        ))}
      </div>
    </div>
  );
}

function Cta({ imageUrl, eyebrow, words, subtitle, ctaLabel, ctaHref, explore, still }: { imageUrl: string | null; eyebrow: string | null; words: string[]; subtitle: string | null; ctaLabel: string; ctaHref: string; explore: string; still: boolean }) {
  return (
    <div className="relative h-full">
      <div className="absolute inset-0 overflow-hidden">
        <SmartImage src={imageUrl} alt="" fill preload sizes="100vw" className={cn("object-cover object-[50%_25%]", !still && "animate-kenburns")} />
      </div>
      <div className="absolute inset-0 bg-gradient-to-r from-plum/90 via-plum/45 to-rose-deep/20" />
      <div className="absolute inset-0 bg-gradient-to-t from-plum/80 via-transparent to-transparent" />
      <div className="container-luxe relative flex h-full flex-col justify-end pb-24 pt-28 sm:pb-28">
        <m.p className="eyebrow text-pale" initial={still ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          {eyebrow ?? "Attitude Collections"}
        </m.p>
        <p className="display mt-4 max-w-4xl text-[3.2rem] leading-[0.92] sm:text-8xl lg:text-[8rem]" aria-hidden>
          {words.map((w, i) => (
            <span key={i} className="inline-block overflow-hidden pb-2 align-bottom">
              <m.span
                className={cn("inline-block", i === words.length - 1 && "italic text-rose-light")}
                initial={still ? false : { y: "105%" }}
                animate={{ y: 0 }}
                transition={{ delay: 0.2 + i * 0.1, duration: 0.8, ease: EASE }}
              >
                {w}
                {i < words.length - 1 ? " " : ""}
              </m.span>
            </span>
          ))}
        </p>
        {subtitle && (
          <m.p className="mt-5 max-w-md text-[0.95rem] leading-relaxed text-white/85 sm:text-base" initial={still ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
            {subtitle}
          </m.p>
        )}
        <m.div className="mt-8 flex flex-wrap gap-3" initial={still ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75 }}>
          <ButtonLink href={ctaHref} variant="rose" size="lg">
            {ctaLabel} <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
          </ButtonLink>
          <ButtonLink href="/collections" variant="light" size="lg" className="!bg-white/10 !text-white backdrop-blur hover:!bg-white hover:!text-plum">
            {explore}
          </ButtonLink>
        </m.div>
        <m.p className="mt-8 font-mono text-[10px] uppercase tracking-[0.3em] text-white/70" initial={still ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }}>
          Ready to wear your ATTITUDE?
        </m.p>
      </div>
    </div>
  );
}
