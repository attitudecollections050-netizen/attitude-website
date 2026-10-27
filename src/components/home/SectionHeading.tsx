import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";

export function SectionHeading({ eyebrow, title, href, linkLabel = "View all", id }: { eyebrow: string; title: string; href?: string; linkLabel?: string; id?: string }) {
  return (
    <Reveal className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="eyebrow text-rose-deep">{eyebrow}</p>
        <h2 id={id} className="display mt-3 text-4xl sm:text-5xl lg:text-6xl">
          {title}
        </h2>
      </div>
      {href && (
        <Link href={href} className="group inline-flex items-center gap-2 text-[0.7rem] font-bold uppercase tracking-[0.2em]">
          <span className="link-underline">{linkLabel}</span>
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
        </Link>
      )}
    </Reveal>
  );
}
