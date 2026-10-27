import Link from "next/link";
import type { CategoryNode } from "@/lib/catalog/types";
import { SmartImage } from "@/components/ui/SmartImage";
import { Reveal } from "@/components/ui/Reveal";
import { cn } from "@/lib/cn";

export function CategoryCards({ categories }: { categories: CategoryNode[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
      {categories.map((c, i) => (
        <Reveal as="li" key={c.id} delay={i * 0.07} className={cn(i === 0 && "col-span-2 lg:col-span-1")}>
          <Link href={c.href} className="group relative block aspect-[4/5] overflow-hidden rounded-[1.75rem] bg-blush lg:aspect-[3/4.4]">
            <SmartImage
              src={c.image_url}
              alt={c.name}
              fill
              sizes="(min-width:1024px) 20vw, 50vw"
              className="object-cover transition-transform duration-[1.4s] ease-[var(--ease-luxe)] group-hover:scale-[1.07]"
            />
            <span className="absolute inset-0 bg-gradient-to-t from-plum/75 via-plum/10 to-transparent transition-opacity duration-500 group-hover:opacity-90" />
            <span className="absolute inset-x-0 bottom-0 p-4 text-white sm:p-5">
              <span className="block font-display text-2xl leading-tight sm:text-3xl">{c.name}</span>
              <span className="mt-2 inline-flex items-center gap-2 text-[0.62rem] font-bold uppercase tracking-[0.22em] text-pale">
                Shop now
                <span className="h-px w-5 bg-pale transition-all duration-500 group-hover:w-9" />
              </span>
            </span>
          </Link>
        </Reveal>
      ))}
    </ul>
  );
}
