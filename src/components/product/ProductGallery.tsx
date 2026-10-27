"use client";
import { useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { SmartImage } from "@/components/ui/SmartImage";
import { cn } from "@/lib/cn";

export function ProductGallery({ images, name }: { images: { id: string; url: string; alt: string }[]; name: string }) {
  const [index, setIndex] = useState(0);
  // Reset when the image set changes (e.g. colour switch) without an effect.
  const [lastKey, setLastKey] = useState(images.map((i) => i.id).join());
  const key = images.map((i) => i.id).join();
  if (key !== lastKey) {
    setLastKey(key);
    setIndex(0);
  }
  const current = images[index] ?? null;

  return (
    <div className="grid gap-3 lg:grid-cols-[5rem_1fr]">
      <div className="relative order-1 aspect-[3/4] overflow-hidden bg-neutral lg:order-2">
        <AnimatePresence initial={false} mode="popLayout">
          <m.div
            key={current?.id ?? "none"}
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 1.03 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <SmartImage src={current?.url} alt={current?.alt || name} fill preload sizes="(min-width:1024px) 50vw, 100vw" className="object-cover" fallbackLabel={name} />
          </m.div>
        </AnimatePresence>
        {images.length > 1 && (
          <div className="absolute inset-x-0 bottom-4 flex justify-center gap-1.5 lg:hidden">
            {images.map((img, i) => (
              <button
                key={img.id}
                type="button"
                onClick={() => setIndex(i)}
                className={cn("h-1.5 rounded-full transition-all", i === index ? "w-6 bg-plum" : "w-1.5 bg-plum/30")}
                aria-label={`Show image ${i + 1}`}
                aria-current={i === index}
              />
            ))}
          </div>
        )}
      </div>
      {images.length > 1 && (
        <ul className="order-2 hidden flex-col gap-3 lg:order-1 lg:flex">
          {images.map((img, i) => (
            <li key={img.id}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                className={cn("relative block aspect-[3/4] w-full overflow-hidden bg-neutral transition", i === index ? "ring-1 ring-plum ring-offset-2" : "opacity-70 hover:opacity-100")}
                aria-label={`Show image ${i + 1}`}
                aria-current={i === index}
              >
                <SmartImage src={img.url} alt="" fill sizes="80px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
