import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductBySlug, getRelatedProducts } from "@/lib/catalog/queries";
import { getSettings } from "@/lib/settings";
import { listEnabledCountries, listRegionsByCountry } from "@/lib/shipping/service";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ProductPurchase } from "@/components/product/ProductPurchase";
import { ProductGrid } from "@/components/product/ProductGrid";
import { Reveal } from "@/components/ui/Reveal";
import { env } from "@/lib/env";

export async function generateMetadata({ params }: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product not found" };
  const description = product.description.slice(0, 155) || `Shop ${product.name} at Attitude Collections.`;
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
  const [related, settings, countries] = await Promise.all([getRelatedProducts(product), getSettings(), listEnabledCountries()]);
  const regions = await listRegionsByCountry(countries.map((c) => c.code));

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
  };
  const top = product.category.parent ?? product.category;

  return (
    <div className="container-luxe pb-24 pt-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: top.name, href: `/shop/${top.slug}` },
          ...(product.category.parent ? [{ label: product.category.name, href: `/shop/${top.slug}/${product.category.slug}` }] : []),
          { label: product.name },
        ]}
      />
      <div className="mt-8">
        <ProductPurchase product={product} maxPerItem={settings.checkout.max_quantity_per_item} destinations={{ countries, regions }}>
          <div className="mt-2">
            <details className="group border-b border-line py-5" open>
              <summary className="eyebrow flex cursor-pointer list-none items-center justify-between">
                Description <span className="text-lg leading-none transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-plum-soft">{product.description}</p>
            </details>
            {product.details && (
              <details className="group border-b border-line py-5">
                <summary className="eyebrow flex cursor-pointer list-none items-center justify-between">
                  Details & care <span className="text-lg leading-none transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-plum-soft">{product.details}</p>
              </details>
            )}
          </div>
        </ProductPurchase>
      </div>

      {related.length > 0 && (
        <section className="mt-28" aria-labelledby="related-heading">
          <Reveal>
            <p className="eyebrow text-rose-deep">Complete the look</p>
            <h2 id="related-heading" className="display mt-3 text-4xl sm:text-5xl">
              You may also like
            </h2>
          </Reveal>
          <div className="mt-10">
            <ProductGrid products={related} />
          </div>
        </section>
      )}
    </div>
  );
}
