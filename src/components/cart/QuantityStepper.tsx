"use client";
import { Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 10,
  disabled,
  label,
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
  const t = useTranslations("product");
  label ??= t("quantity");
  const h = size === "sm" ? "h-9" : "h-12";
  return (
    <div className={cn("inline-flex items-center rounded-full border border-line bg-white px-0.5", h)} role="group" aria-label={label}>
      <button
        type="button"
        className={cn("grid place-items-center text-plum transition hover:bg-blush disabled:opacity-30", size === "sm" ? "w-8" : "w-11", "h-full")}
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={disabled || value <= min}
        aria-label={t("decrease")}
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
        aria-label={t("increase")}
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}
