import type { ProductCardData } from "@/lib/catalog/types";
import { ProductCard } from "./ProductCard";
import { Reveal } from "@/components/ui/Reveal";

export function ProductGrid({ products, columns = 4 }: { products: ProductCardData[]; columns?: 3 | 4 }) {
  return (
    <ul className={`grid grid-cols-2 gap-x-3 gap-y-10 sm:gap-x-5 md:grid-cols-3 ${columns === 4 ? "lg:grid-cols-4" : ""}`}>
      {products.map((p, i) => (
        <Reveal as="li" key={p.id} delay={Math.min(i % 4, 3) * 0.06} y={18}>
          <ProductCard product={p} priority={i < 2} />
        </Reveal>
      ))}
    </ul>
  );
}
