import Link from "next/link";
import { Truck, MessageCircle, RotateCcw, MapPin } from "lucide-react";
import { getCategoryTree, getHomeData } from "@/lib/catalog/queries";
import { getSettings } from "@/lib/settings";
import { isSupabaseConfigured } from "@/lib/env";
import { Hero } from "@/components/home/Hero";
import { SectionHeading } from "@/components/home/SectionHeading";
import { CategoryCards } from "@/components/home/CategoryCards";
import { PromoBanners, StripBanner } from "@/components/home/PromoBanner";
import { CollectionCards } from "@/components/home/CollectionCards";
import { ProductGrid } from "@/components/product/ProductGrid";
import { Reveal } from "@/components/ui/Reveal";
import { NewsletterForm } from "@/components/layout/NewsletterForm";
import { SetupNotice } from "@/components/ui/SetupNotice";
import { Monogram } from "@/components/brand/Wordmark";
import { getTranslations } from "next-intl/server";

export default async function HomePage() {
  const [home, categories, settings, t, tc] = await Promise.all([getHomeData(), getCategoryTree(), getSettings(), getTranslations("home"), getTranslations("common")]);
  const hero = home.banners.find((b) => b.placement === "hero");
  const promos = home.banners.filter((b) => b.placement === "promo");
  const strip = home.banners.find((b) => b.placement === "strip");

  return (
    <>
      {/* Hero banner (image and wording from Admin → Homepage → Hero) */}
      <Hero
        eyebrow={hero?.eyebrow ?? "Attitude Collections"}
        title={hero?.title ?? t("tagline")}
        subtitle={hero?.subtitle ?? t("subtitle")}
        imageUrl={hero?.image_url ?? null}
        ctaLabel={hero?.cta_label ?? t("shopNow")}
        ctaHref={hero?.cta_href ?? "/shop"}
      />

      {!isSupabaseConfigured() && (
        <div className="container-luxe pt-10">
          <SetupNotice />
        </div>
      )}

      {categories.length > 0 && (
        <section className="container-luxe py-20 sm:py-28" aria-labelledby="cat-heading">
          <SectionHeading eyebrow={t("byCategory")} title={t("findEdit")} href="/shop" linkLabel={tc("shopAll")} id="cat-heading" />
          <div className="mt-10 sm:mt-14">
            <CategoryCards categories={categories} />
          </div>
        </section>
      )}

      {settings.home.show_new_arrivals && home.newArrivals.length > 0 && (
        <section className="container-luxe pb-24" aria-labelledby="new-heading">
          <SectionHeading eyebrow={t("justLanded")} title={t("newArrivals")} href="/shop?sort=newest" linkLabel={tc("viewAll")} id="new-heading" />
          <div className="mt-10">
            <ProductGrid products={home.newArrivals} />
          </div>
        </section>
      )}

      {promos.length > 0 && (
        <section className="container-luxe pb-24" aria-label={t("promotions")}>
          <PromoBanners banners={promos} />
        </section>
      )}

      <section className="overflow-hidden bg-blush py-24 sm:py-32" aria-labelledby="intro-heading">
        <div className="container-luxe grid items-center gap-12 lg:grid-cols-[auto_1fr] lg:gap-24">
          <Reveal className="hidden lg:block">
            <Monogram className="size-60 drop-shadow-[0_30px_40px_rgba(217,79,145,0.25)]" />
          </Reveal>
          <Reveal>
            <p className="eyebrow text-rose-deep">{t("house")}</p>
            <h2 id="intro-heading" className="display mt-4 max-w-3xl text-5xl sm:text-6xl lg:text-7xl">
              {settings.home.intro_title}
            </h2>
            {settings.home.intro_body && <p className="mt-6 max-w-2xl text-base leading-relaxed text-plum-soft sm:text-lg">{settings.home.intro_body}</p>}
            <Link href="/about" className="mt-8 inline-flex items-center gap-3 text-[0.7rem] font-bold uppercase tracking-[0.22em]">
              <span className="link-underline">{t("ourStory")}</span>
              <span className="h-px w-10 bg-rose" />
            </Link>
          </Reveal>
        </div>
      </section>

      {home.collections.length > 0 && (
        <section id="collections" className="container-luxe py-24 sm:py-28" aria-labelledby="col-heading">
          <SectionHeading eyebrow={t("curated")} title={t("featuredCollections")} href="/collections" linkLabel={tc("viewAll")} id="col-heading" />
          <div className="mt-12">
            <CollectionCards collections={home.collections} />
          </div>
        </section>
      )}

      {settings.home.show_featured_products && home.featured.length > 0 && (
        <section className="container-luxe pb-24" aria-labelledby="feat-heading">
          <SectionHeading eyebrow={t("handpicked")} title={t("attitudeEdit")} id="feat-heading" />
          <div className="mt-10">
            <ProductGrid products={home.featured} />
          </div>
        </section>
      )}

      {settings.home.show_best_sellers && home.bestSellers.length > 0 && (
        <section className="container-luxe pb-24" aria-labelledby="best-heading">
          <SectionHeading eyebrow={t("mostLoved")} title={t("bestSellers")} href="/shop?sort=popular" linkLabel={tc("viewAll")} id="best-heading" />
          <div className="mt-10">
            <ProductGrid products={home.bestSellers} />
          </div>
        </section>
      )}

      {strip && <StripBanner banner={strip} />}

      <section className="bg-plum text-white" aria-labelledby="nl-heading">
        <div className="container-luxe grid items-center gap-10 py-20 lg:grid-cols-2">
          <Reveal>
            <p className="eyebrow text-rose-light">{t("newsletter")}</p>
            <h2 id="nl-heading" className="display mt-4 text-5xl sm:text-6xl">
              {t("beFirst")}
            </h2>
            <p className="mt-4 max-w-md text-sm text-white/75">{t("newsletterBody")}</p>
          </Reveal>
          <Reveal delay={0.1}>
            <NewsletterForm />
          </Reveal>
        </div>
      </section>

      <section className="border-b border-line" aria-label={t("support")}>
        <ul className="container-luxe grid grid-cols-2 gap-px bg-line lg:grid-cols-4">
          {[
            { icon: Truck, title: t("delivery"), text: t("deliveryText"), href: "/shipping-policy" },
            { icon: MapPin, title: t("track"), text: t("trackText"), href: "/track-order" },
            { icon: RotateCcw, title: t("returns"), text: t("returnsText"), href: "/returns-policy" },
            { icon: MessageCircle, title: t("help"), text: t("helpText"), href: "/contact" },
          ].map(({ icon: Icon, title, text, href }) => (
            <li key={title} className="bg-white">
              <Link href={href} className="group flex h-full flex-col items-start gap-3 px-4 py-8 transition-colors hover:bg-blush sm:flex-row sm:items-center sm:px-6">
                <Icon className="size-5 shrink-0 text-rose" aria-hidden />
                <span>
                  <span className="block text-sm font-semibold">{title}</span>
                  <span className="block text-xs text-muted">{text}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
