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
            <SmartImage src={b.image_url} alt="" fill sizes="(min-width:768px) 50vw, 100vw" className="object-cover transition-transform duration-[1.6s] ease-[var(--ease-luxe)] group-hover:scale-105" />
            <span className="absolute inset-0 bg-gradient-to-t from-plum/80 via-plum/20 to-transparent" />
            <span className="absolute inset-x-0 bottom-0 p-7 text-white sm:p-10">
              {b.eyebrow && <span className="eyebrow text-pale">{b.eyebrow}</span>}
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
  const body = (
    <div className="container-luxe flex flex-col items-center gap-3 py-12 text-center sm:py-16">
      {banner.eyebrow && <p className="eyebrow text-rose-deep">{banner.eyebrow}</p>}
      <p className="display text-4xl sm:text-6xl">{banner.title}</p>
      {banner.subtitle && <p className="max-w-lg text-sm text-plum-soft">{banner.subtitle}</p>}
      {banner.cta_label && <span className="mt-2 text-[0.68rem] font-bold uppercase tracking-[0.22em] underline underline-offset-8">{banner.cta_label}</span>}
    </div>
  );
  return (
    <section className="bg-pale">
      {banner.cta_href ? (
        <Link href={banner.cta_href} className="block transition-colors hover:bg-[#f8d9e7]">
          {body}
        </Link>
      ) : (
        body
      )}
    </section>
  );
}
