"use client";
import { useEffect } from "react";
import { emitDrip } from "@/lib/assistant/events";
import type { Audience } from "@/lib/catalog/free-size";

/** Tells the mascots what the shopper is looking at (women's/men's item, free size). */
export function MascotContext({ audience, freeSize, product }: { audience: Audience; freeSize: boolean; product: string }) {
  useEffect(() => {
    // After the widget has mounted and read the page path.
    const t = setTimeout(() => emitDrip({ type: "context", audience, freeSize, product }), 400);
    return () => clearTimeout(t);
  }, [audience, freeSize, product]);
  return null;
}
