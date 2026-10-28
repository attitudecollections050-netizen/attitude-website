import { useTranslations } from "next-intl";
import Link from "next/link";
import { SmartImage } from "@/components/ui/SmartImage";
import { Reveal } from "@/components/ui/Reveal";

export interface CollectionCard {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  image_url: string | null;
  count: number;
}

export function CollectionCards({ collections }: { collections: CollectionCard[] }) {
  const t = useTranslations("home");
  return (
    <ul className="grid gap-6 md:grid-cols-2">
      {collections.map((c, i) => (
        <Reveal as="li" key={c.id} delay={i * 0.08}>
          <Link href={`/collections/${c.slug}`} className="group grid gap-5 sm:grid-cols-[1.1fr_1fr] sm:items-center">
            <span className="relative block aspect-[4/5] overflow-hidden rounded-[1.75rem] bg-blush">
              <SmartImage src={c.image_url} alt={c.name} fill sizes="(min-width:768px) 28vw, 100vw" className="object-cover transition-transform duration-[1.4s] ease-[var(--ease-luxe)] group-hover:scale-105" fallbackLabel={c.name} />
            </span>
            <span>
              <span className="eyebrow text-muted">
                {c.count} {c.count === 1 ? "piece" : "pieces"}
              </span>
              <span className="display mt-3 block text-4xl transition-colors group-hover:text-rose-deep">{c.name}</span>
              {c.description && <span className="mt-3 block text-sm leading-relaxed text-plum-soft">{c.description}</span>}
              <span className="mt-5 inline-flex items-center gap-3 text-[0.68rem] font-bold uppercase tracking-[0.22em]">
                {t("explore")}
                <span className="h-px w-8 bg-plum transition-all duration-500 group-hover:w-14 group-hover:bg-rose-deep" />
              </span>
            </span>
          </Link>
        </Reveal>
      ))}
    </ul>
  );
}
