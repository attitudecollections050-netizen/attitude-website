import Link from "next/link";
import type { HomeBanner } from "@/lib/catalog/queries";
import { SmartImage } from "@/components/ui/SmartImage";
import { Reveal } from "@/components/ui/Reveal";

export function PromoBanners({ banners }: { banners: HomeBanner[] }) {
  if (banners.length === 0) return null;
  return (
    <div className={`grid gap-4 ${banners.length > 1 ? "md:grid-cols-2" : ""}`}>
      {banners.slice(0, 2).map((b, i) => {
        const inner = (
          <>
            {/* Silent motion: slow zoom, a pink light sweep and a soft glow */}
            <span className="absolute inset-0 overflow-hidden">
              <SmartImage
                src={b.image_url}
                alt=""
                fill
                sizes="(min-width:768px) 50vw, 100vw"
                className="animate-kenburns object-cover motion-reduce:animate-none"
                style={{ animationDelay: `${i * -6}s` }}
              />
            </span>
            <span className="absolute inset-0 bg-gradient-to-t from-plum/85 via-rose-deep/25 to-transparent" />
            <span className="absolute -inset-y-10 -left-1/3 w-1/3 animate-sweep bg-gradient-to-r from-transparent via-white/25 to-transparent mix-blend-overlay motion-reduce:hidden" style={{ animationDelay: `${i * 1.8}s` }} />
            <span className="absolute -right-16 -top-16 size-56 animate-blob rounded-full bg-[radial-gradient(circle,rgba(242,131,184,0.55),rgba(242,131,184,0)_70%)] motion-reduce:animate-none" />
            <span className="absolute inset-x-0 bottom-0 p-7 text-white sm:p-10">
              {b.eyebrow && <span className="eyebrow inline-flex items-center gap-2 text-pale"><span className="size-1.5 animate-pulse rounded-full bg-rose-light" />{b.eyebrow}</span>}
              <span className="display mt-3 block text-4xl sm:text-5xl">{b.title}</span>
              {b.subtitle && <span className="mt-3 block max-w-sm text-sm text-white/85">{b.subtitle}</span>}
              {b.cta_label && (
                <span className="mt-6 inline-flex items-center gap-3 text-[0.68rem] font-bold uppercase tracking-[0.22em]">
                  {b.cta_label}
                  <span className="h-px w-8 bg-white transition-all duration-500 group-hover:w-14" />
                </span>
              )}
            </span>
          </>
        );
        return (
          <Reveal key={b.id} delay={i * 0.1}>
            {b.cta_href ? (
              <Link href={b.cta_href} className="group relative block aspect-[4/5] overflow-hidden rounded-[2rem] bg-plum sm:aspect-[5/4]">
                {inner}
              </Link>
            ) : (
              <div className="group relative aspect-[4/5] overflow-hidden rounded-[2rem] bg-plum sm:aspect-[5/4]">{inner}</div>
            )}
          </Reveal>
        );
      })}
    </div>
  );
}

export function StripBanner({ banner }: { banner: HomeBanner }) {
  const words = Array.from({ length: 6 }, () => banner.eyebrow || banner.title);
  const body = (
    <div className="container-luxe relative flex flex-col items-center gap-3 py-12 text-center sm:py-16">
      {banner.eyebrow && <p className="eyebrow text-rose-deep">{banner.eyebrow}</p>}
      <p className="display text-4xl sm:text-6xl">{banner.title}</p>
      {banner.subtitle && <p className="max-w-lg text-sm text-plum-soft">{banner.subtitle}</p>}
      {banner.cta_label && <span className="mt-2 text-[0.68rem] font-bold uppercase tracking-[0.22em] underline underline-offset-8">{banner.cta_label}</span>}
    </div>
  );
  return (
    <section className="relative overflow-hidden bg-[linear-gradient(110deg,#fbe4ee,#fff0f5,#f8c9de,#fbe4ee)] bg-[length:300%_100%] animate-pinkshift motion-reduce:animate-none">
      {/* Scrolling word ribbon (silent motion) */}
      <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 overflow-hidden opacity-[0.045]" aria-hidden>
        <div className="flex w-max animate-marquee whitespace-nowrap font-sans text-[7rem] font-extrabold uppercase leading-none tracking-tight text-plum motion-reduce:animate-none sm:text-[10rem]">
          {[...words, ...words].map((w, i) => (
            <span key={i} className="px-8">{w} ✦</span>
          ))}
        </div>
      </div>
      {banner.cta_href ? (
        <Link href={banner.cta_href} className="block transition-colors hover:bg-white/30">
          {body}
        </Link>
      ) : (
        body
      )}
    </section>
  );
}
