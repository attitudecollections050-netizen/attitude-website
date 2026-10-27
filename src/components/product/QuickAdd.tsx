"use client";
import { useEffect, useState } from "react";
import { getQuickAddOptions } from "@/app/actions/catalog";
import { useCart } from "@/components/cart/CartProvider";
import { sortSizes } from "@/lib/catalog/filters";
import { cn } from "@/lib/cn";
import { Skeleton } from "@/components/ui/Skeleton";

type Options = NonNullable<Awaited<ReturnType<typeof getQuickAddOptions>>>;

export function QuickAdd({ slug, onDone }: { slug: string; onDone: () => void }) {
  const { add, pending } = useCart();
  const [opts, setOpts] = useState<Options | null>(null);
  const [color, setColor] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getQuickAddOptions(slug).then((o) => {
      if (!alive || !o) return;
      setOpts(o);
      const colors = [...new Set(o.variants.map((v) => v.color).filter(Boolean))] as string[];
      setColor(colors.find((c) => o.variants.some((v) => v.color === c && v.available)) ?? colors[0] ?? null);
    });
    return () => {
      alive = false;
    };
  }, [slug]);

  if (!opts) {
    return (
      <div className="bg-white p-3 shadow-xl">
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  const colors = [...new Set(opts.variants.map((v) => v.color).filter(Boolean))] as string[];
  const forColor = opts.variants.filter((v) => !color || v.color === color);
  const sized = forColor.some((v) => v.size);

  const addVariant = async (variantId: string) => {
    const r = await add(variantId, 1);
    if (r.ok) onDone();
  };

  return (
    <div className="rounded-2xl bg-white/95 p-3 shadow-xl backdrop-blur" role="group" aria-label="Quick add">
      {colors.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {colors.map((c) => {
            const hex = opts.variants.find((v) => v.color === c)?.color_hex;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={cn("size-6 rounded-full border-2 transition", color === c ? "border-plum" : "border-transparent")}
                aria-label={c}
                aria-pressed={color === c}
              >
                <span className="block size-full rounded-full border border-plum/10" style={{ backgroundColor: hex ?? "#ccc" }} />
              </button>
            );
          })}
        </div>
      )}
      {sized ? (
        <div className="flex flex-wrap gap-1.5">
          {sortSizes(forColor.map((v) => v.size!)).map((size) => {
            const v = forColor.find((x) => x.size === size)!;
            return (
              <button
                key={v.id}
                type="button"
                disabled={!v.available || pending}
                onClick={() => addVariant(v.id)}
                className="min-w-10 rounded-full border border-line px-2.5 py-1.5 text-xs font-semibold transition hover:border-plum hover:bg-plum hover:text-white disabled:cursor-not-allowed disabled:text-muted/50 disabled:line-through"
                aria-label={`Add size ${size}${v.available ? "" : " (sold out)"}`}
              >
                {size}
              </button>
            );
          })}
        </div>
      ) : (
        <button
          type="button"
          disabled={pending || !forColor[0]?.available}
          onClick={() => forColor[0] && addVariant(forColor[0].id)}
          className="w-full rounded-full bg-plum py-2.5 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-white transition hover:bg-rose-deep disabled:opacity-50"
        >
          {forColor[0]?.available ? "Add to bag" : "Sold out"}
        </button>
      )}
    </div>
  );
}
