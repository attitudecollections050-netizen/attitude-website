import Link from "next/link";
import { Truck, MessageCircle, RotateCcw, MapPin, ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { getCategoryTree, getHomeData, getShowcaseProducts } from "@/lib/catalog/queries";
import { getSettings } from "@/lib/settings";
import { isSupabaseConfigured } from "@/lib/env";
import { Hero } from "@/components/home/Hero";
import { Showcase } from "@/components/showcase/Showcase";
import { SectionHeading } from "@/components/home/SectionHeading";
import { CategoryCards } from "@/components/home/CategoryCards";
import { PromoBanners, StripBanner } from "@/components/home/PromoBanner";
import { CollectionCards } from "@/components/home/CollectionCards";
import { ProductGrid } from "@/components/product/ProductGrid";
import { Reveal } from "@/components/ui/Reveal";
import { NewsletterForm } from "@/components/layout/NewsletterForm";
import { SetupNotice } from "@/components/ui/SetupNotice";
import { Monogram } from "@/components/brand/Wordmark";

export default async function HomePage() {
  const [home, categories, settings, showcase] = await Promise.all([getHomeData(), getCategoryTree(), getSettings(), getShowcaseProducts(5)]);
  const hero = home.banners.find((b) => b.placement === "hero");
  const promos = home.banners.filter((b) => b.placement === "promo");
  const strip = home.banners.find((b) => b.placement === "strip");

  return (
    <>
      {showcase.length > 0 ? (
        <Showcase
          mode="hero"
          products={showcase}
          maxPerItem={settings.checkout.max_quantity_per_item}
          headline={hero?.title ?? "Wear Your Attitude."}
          caption={hero?.eyebrow && hero.eyebrow !== "Attitude Collections" ? hero.eyebrow : "Bold • Modern • Timeless"}
          footer={
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-xl text-sm text-plum-soft">{hero?.subtitle ?? "Statement clothing, shoes and bags curated for confident, modern dressing."}</p>
              <div className="flex flex-wrap gap-3">
                <ButtonLink href={hero?.cta_href ?? "/shop"} variant="primary">
                  {hero?.cta_label ?? "Shop Now"} <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
                </ButtonLink>
                <ButtonLink href="/collections" variant="outline">
                  Explore Collections
                </ButtonLink>
              </div>
            </div>
          }
        />
      ) : (
        <Hero
          eyebrow={hero?.eyebrow ?? "Attitude Collections"}
          title={hero?.title ?? "Wear Your Attitude."}
          subtitle={hero?.subtitle ?? "Statement clothing, shoes and bags curated for confident, modern dressing."}
          imageUrl={hero?.image_url ?? null}
          ctaLabel={hero?.cta_label ?? "Shop Now"}
          ctaHref={hero?.cta_href ?? "/shop"}
        />
      )}

      {!isSupabaseConfigured() && (
        <div className="container-luxe pt-10">
          <SetupNotice />
        </div>
      )}

      {categories.length > 0 && (
        <section className="container-luxe py-20 sm:py-28" aria-labelledby="cat-heading">
          <SectionHeading eyebrow="Shop by category" title="Find your edit" href="/shop" linkLabel="Shop all" id="cat-heading" />
          <div className="mt-10 sm:mt-14">
            <CategoryCards categories={categories} />
          </div>
        </section>
      )}

      {settings.home.show_new_arrivals && home.newArrivals.length > 0 && (
        <section className="container-luxe pb-24" aria-labelledby="new-heading">
          <SectionHeading eyebrow="Just landed" title="New arrivals" href="/shop?sort=newest" id="new-heading" />
          <div className="mt-10">
            <ProductGrid products={home.newArrivals} />
          </div>
        </section>
      )}

      {promos.length > 0 && (
        <section className="container-luxe pb-24" aria-label="Promotions">
          <PromoBanners banners={promos} />
        </section>
      )}

      <section className="overflow-hidden bg-blush py-24 sm:py-32" aria-labelledby="intro-heading">
        <div className="container-luxe grid items-center gap-12 lg:grid-cols-[auto_1fr] lg:gap-24">
          <Reveal className="hidden lg:block">
            <Monogram className="size-56 text-plum" />
          </Reveal>
          <Reveal>
            <p className="eyebrow text-rose-deep">The house of attitude</p>
            <h2 id="intro-heading" className="display mt-4 max-w-3xl text-5xl sm:text-6xl lg:text-7xl">
              {settings.home.intro_title}
            </h2>
            {settings.home.intro_body && <p className="mt-6 max-w-2xl text-base leading-relaxed text-plum-soft sm:text-lg">{settings.home.intro_body}</p>}
            <Link href="/about" className="mt-8 inline-flex items-center gap-3 text-[0.7rem] font-bold uppercase tracking-[0.22em]">
              <span className="link-underline">Our story</span>
              <span className="h-px w-10 bg-rose" />
            </Link>
          </Reveal>
        </div>
      </section>

      {home.collections.length > 0 && (
        <section id="collections" className="container-luxe py-24 sm:py-28" aria-labelledby="col-heading">
          <SectionHeading eyebrow="Curated" title="Featured collections" href="/collections" id="col-heading" />
          <div className="mt-12">
            <CollectionCards collections={home.collections} />
          </div>
        </section>
      )}

      {settings.home.show_featured_products && home.featured.length > 0 && (
        <section className="container-luxe pb-24" aria-labelledby="feat-heading">
          <SectionHeading eyebrow="Handpicked" title="The Attitude edit" id="feat-heading" />
          <div className="mt-10">
            <ProductGrid products={home.featured} />
          </div>
        </section>
      )}

      {settings.home.show_best_sellers && home.bestSellers.length > 0 && (
        <section className="container-luxe pb-24" aria-labelledby="best-heading">
          <SectionHeading eyebrow="Most loved" title="Best sellers" href="/shop?sort=popular" id="best-heading" />
          <div className="mt-10">
            <ProductGrid products={home.bestSellers} />
          </div>
        </section>
      )}

      {strip && <StripBanner banner={strip} />}

      <section className="bg-plum text-white" aria-labelledby="nl-heading">
        <div className="container-luxe grid items-center gap-10 py-20 lg:grid-cols-2">
          <Reveal>
            <p className="eyebrow text-rose-light">Newsletter</p>
            <h2 id="nl-heading" className="display mt-4 text-5xl sm:text-6xl">
              Be first to know.
            </h2>
            <p className="mt-4 max-w-md text-sm text-white/75">New arrivals, edits and offers — straight to your inbox. Unsubscribe any time.</p>
          </Reveal>
          <Reveal delay={0.1}>
            <NewsletterForm />
          </Reveal>
        </div>
      </section>

      <section className="border-b border-line" aria-label="Customer support">
        <ul className="container-luxe grid grid-cols-2 gap-px bg-line lg:grid-cols-4">
          {[
            { icon: Truck, title: "Delivery", text: "Fees calculated for your address", href: "/shipping-policy" },
            { icon: MapPin, title: "Track an order", text: "Order number + email", href: "/track-order" },
            { icon: RotateCcw, title: "Returns", text: "Read our returns policy", href: "/returns-policy" },
            { icon: MessageCircle, title: "Need help?", text: "Contact our team", href: "/contact" },
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
