"use client";
import { m } from "motion/react";
import { ArrowRight } from "lucide-react";
import { SmartImage } from "@/components/ui/SmartImage";
import { ButtonLink } from "@/components/ui/Button";

export function Hero({
  eyebrow,
  title,
  subtitle,
  imageUrl,
  ctaLabel,
  ctaHref,
}: {
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
}) {
  const words = title.split(" ");
  return (
    <section className="relative isolate overflow-hidden bg-plum text-white" aria-labelledby="hero-heading">
      <m.div className="absolute inset-0 -z-10" initial={{ scale: 1.12 }} animate={{ scale: 1 }} transition={{ duration: 2.4, ease: [0.22, 1, 0.36, 1] }}>
        <SmartImage src={imageUrl} alt="" fill preload sizes="100vw" className="object-cover object-[50%_25%]" />
      </m.div>
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-plum/85 via-plum/45 to-plum/5" aria-hidden />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-plum/70 via-transparent to-transparent" aria-hidden />

      <div className="container-luxe flex min-h-[78svh] flex-col justify-end pb-14 pt-32 sm:min-h-[86svh] sm:pb-20 lg:min-h-[calc(100svh-7rem)]">
        <m.p className="eyebrow text-pale" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          {eyebrow ?? "Attitude Collections"}
        </m.p>
        <h1 id="hero-heading" className="display mt-5 max-w-4xl text-[3.4rem] leading-[0.92] sm:text-8xl lg:text-[8.5rem]">
          {words.map((w, i) => (
            <span key={i} className="inline-block overflow-hidden pb-2 align-bottom">
              <m.span
                className={`inline-block ${i === words.length - 1 ? "italic text-pale" : ""}`}
                initial={{ y: "105%" }}
                animate={{ y: 0 }}
                transition={{ delay: 0.3 + i * 0.12, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              >
                {w}
                {i < words.length - 1 ? " " : ""}
              </m.span>
            </span>
          ))}
        </h1>
        {subtitle && (
          <m.p className="mt-6 max-w-md text-[0.95rem] leading-relaxed text-white/85 sm:text-base" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75 }}>
            {subtitle}
          </m.p>
        )}
        <m.div className="mt-9 flex flex-wrap gap-3" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}>
          <ButtonLink href={ctaHref ?? "/shop"} variant="rose" size="lg">
            {ctaLabel ?? "Shop Now"} <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </ButtonLink>
          <ButtonLink href="/collections" variant="light" size="lg" className="!bg-white/10 !text-white backdrop-blur hover:!bg-white hover:!text-plum">
            Explore Collections
          </ButtonLink>
        </m.div>
      </div>
    </section>
  );
}
