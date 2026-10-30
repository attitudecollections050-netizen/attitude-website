import { getTranslations } from "next-intl/server";
import { CurrencyNotice } from "@/components/intl/CurrencyNotice";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductBySlug, getRelatedProducts } from "@/lib/catalog/queries";
import { getSettings } from "@/lib/settings";
import { listEnabledCountries, listRegionsByCountry } from "@/lib/shipping/service";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import Link from "next/link";
import { Showcase } from "@/components/showcase/Showcase";
import { MascotContext } from "@/components/assistant/MascotContext";
import { audienceOf, isFreeSize } from "@/lib/catalog/free-size";
import { DeliveryEstimator } from "@/components/product/DeliveryEstimator";
import { ProductReviews, getReviewSummary } from "@/components/feedback/ProductReviews";
import { TrackEvent } from "@/components/analytics/AnalyticsTracker";
import { ProductGrid } from "@/components/product/ProductGrid";
import { Reveal } from "@/components/ui/Reveal";
import { env } from "@/lib/env";

export async function generateMetadata({ params }: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  const tp = await getTranslations("pages");
  if (!product) return { title: tp("productNotFound") };
  const description = product.description.slice(0, 155) || tp("shopCategoryMeta", { name: product.name });
  return {
    title: product.name,
    description,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      title: `${product.name} | Attitude Collections`,
      description,
      images: product.images.slice(0, 1).map((i) => ({ url: i.url, alt: i.alt || product.name })),
    },
  };
}

export default async function ProductPage({ params }: PageProps<"/products/[slug]">) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  const [related, settings, countries, reviews] = await Promise.all([getRelatedProducts(product), getSettings(), listEnabledCountries(), getReviewSummary(product.id)]);
  const [regions, t, tc] = await Promise.all([listRegionsByCountry(countries.map((c) => c.code)), getTranslations("product"), getTranslations("common")]);

  const inStock = product.allow_backorder || product.variants.some((v) => v.on_hand > 0);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: product.images.map((i) => i.url),
    sku: product.variants[0]?.sku,
    brand: { "@type": "Brand", name: "Attitude Collections" },
    offers: {
      "@type": "Offer",
      url: `${env.siteUrl}/products/${product.slug}`,
      priceCurrency: settings.store.currency,
      price: ((product.sale_price ?? product.price) / 100).toFixed(2),
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
    // Only real, approved reviews are summarised here.
    ...(reviews.count > 0 && reviews.average != null
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: reviews.average, reviewCount: reviews.count, bestRating: 5, worstRating: 1 } }
      : {}),
  };
  const top = product.category.parent ?? product.category;

  return (
    <div className="pb-24">
      <TrackEvent type="product_view" productId={product.id} />
      <MascotContext
        audience={audienceOf(`${top.slug} ${product.category.slug} ${product.category.name} ${product.name} ${product.tags.join(" ")}`)}
        freeSize={isFreeSize(product, product.variants.map((v) => v.size))}
        product={product.name}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <div className="container-luxe pt-6">
        <Breadcrumbs
          items={[
            { label: tc("home"), href: "/" },
            { label: top.name, href: `/shop/${top.slug}` },
            ...(product.category.parent ? [{ label: product.category.name, href: `/shop/${top.slug}/${product.category.slug}` }] : []),
            { label: product.name },
          ]}
        />
      </div>
      <Showcase mode="product" products={[product]} maxPerItem={settings.checkout.max_quantity_per_item} headline={top.name} caption={product.category.name} />

      <div className="container-luxe">
        <div className="grid gap-x-16 gap-y-2 py-10 lg:grid-cols-2">
          <div>
            <details className="group border-b border-line py-5" open>
              <summary className="eyebrow flex cursor-pointer list-none items-center justify-between">
                {t("description")} <span className="text-lg leading-none transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-plum-soft">{product.description}</p>
            </details>
            {product.details && (
              <details className="group border-b border-line py-5">
                <summary className="eyebrow flex cursor-pointer list-none items-center justify-between">
                  {t("details")} <span className="text-lg leading-none transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-plum-soft">{product.details}</p>
              </details>
            )}
          </div>
          <div>
            <ul className="grid gap-3 border-b border-line py-5 text-sm text-plum-soft">
              <li>{t("deliveryNote")}</li>
              <li>
                {t.rich("policies", {
                  returns: (chunks) => <Link href="/returns-policy" className="underline underline-offset-4">{chunks}</Link>,
                  shipping: (chunks) => <Link href="/shipping-policy" className="underline underline-offset-4">{chunks}</Link>,
                })}
              </li>
              <li><CurrencyNotice /></li>
            </ul>
            <DeliveryEstimator slug={product.slug} destinations={{ countries, regions }} />
          </div>
        </div>

      <ProductReviews productId={product.id} slug={product.slug} />

      {related.length > 0 && (
        <section className="mt-16" aria-labelledby="related-heading">
          <Reveal>
            <p className="eyebrow text-rose-deep">{t("completeLook")}</p>
            <h2 id="related-heading" className="display mt-3 text-4xl sm:text-5xl">
              {t("youMayLike")}
            </h2>
          </Reveal>
          <div className="mt-10">
            <ProductGrid products={related} />
          </div>
        </section>
      )}
      </div>
    </div>
  );
}
