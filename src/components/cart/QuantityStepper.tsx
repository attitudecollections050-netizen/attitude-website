"use client";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/cn";

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 10,
  disabled,
  label = "Quantity",
  size = "md",
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  label?: string;
  size?: "sm" | "md";
}) {
  const h = size === "sm" ? "h-9" : "h-12";
  return (
    <div className={cn("inline-flex items-center border border-line", h)} role="group" aria-label={label}>
      <button
        type="button"
        className={cn("grid place-items-center text-plum transition hover:bg-blush disabled:opacity-30", size === "sm" ? "w-8" : "w-11", "h-full")}
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={disabled || value <= min}
        aria-label={`Decrease ${label.toLowerCase()}`}
      >
        <Minus className="size-3.5" />
      </button>
      <output className={cn("min-w-8 text-center text-sm tabular-nums font-semibold")} aria-live="polite">
        {value}
      </output>
      <button
        type="button"
        className={cn("grid place-items-center text-plum transition hover:bg-blush disabled:opacity-30", size === "sm" ? "w-8" : "w-11", "h-full")}
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={disabled || value >= max}
        aria-label={`Increase ${label.toLowerCase()}`}
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}
