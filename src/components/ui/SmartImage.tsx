"use client";
import Image, { type ImageProps } from "next/image";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { Monogram } from "@/components/brand/Wordmark";

/**
 * next/image with a branded fallback when the source is missing or fails,
 * so a broken supplier URL never shows a broken-image icon.
 */
export function SmartImage({ src, alt, className, fallbackLabel, ...props }: Omit<ImageProps, "src"> & { src: string | null | undefined; fallbackLabel?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div
        {...(alt ? { role: "img", "aria-label": alt } : { "aria-hidden": true })}
        className={cn("absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-blush via-pale to-[#f6d3e2] text-plum/70", className)}
      >
        <Monogram className="size-12 opacity-40 grayscale-[30%]" />
        {fallbackLabel && <span className="px-4 text-center font-display text-lg italic">{fallbackLabel}</span>}
      </div>
    );
  }
  return <Image src={src} alt={alt} className={className} onError={() => setFailed(true)} {...props} />;
}
