"use client";
import { useId, useState } from "react";
import { m, useReducedMotion } from "motion/react";
import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

/**
 * Five-heart rating input. Native radio buttons underneath, so arrow keys,
 * screen readers and form validation work as expected.
 */
export function HeartRating({
  value,
  onChange,
  name = "rating",
  size = "md",
  legend,
  describedBy,
}: {
  value: number;
  onChange: (v: number) => void;
  name?: string;
  size?: "md" | "lg";
  legend?: string;
  describedBy?: string;
}) {
  const id = useId();
  const t = useTranslations("feedback");
  const labels = [t("hearts.1"), t("hearts.2"), t("hearts.3"), t("hearts.4"), t("hearts.5")];
  const reduce = useReducedMotion();
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  const icon = size === "lg" ? "size-9" : "size-7";

  return (
    <fieldset aria-describedby={describedBy}>
      <legend className="text-sm font-semibold">{legend ?? t("yourRating")}</legend>
      <div className="mt-2 flex items-center gap-1" onMouseLeave={() => setHover(0)}>
        {labels.map((label, i) => {
          const n = i + 1;
          const active = n <= shown;
          const inputId = `${id}-${n}`;
          return (
            <span key={n} className="relative" onMouseEnter={() => setHover(n)}>
              <input
                id={inputId}
                type="radio"
                name={name}
                value={n}
                checked={value === n}
                onChange={() => onChange(n)}
                className="peer absolute inset-0 cursor-pointer opacity-0"
                aria-label={t("heartAria", { count: n, label })}
              />
              <label
                htmlFor={inputId}
                className="block cursor-pointer rounded-full p-1 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-rose-deep"
                aria-hidden
              >
                <m.span
                  className="block"
                  animate={reduce ? undefined : { scale: value === n ? [1, 1.3, 1] : hover === n ? 1.15 : 1 }}
                  transition={{ duration: value === n ? 0.35 : 0.15 }}
                >
                  <Heart
                    className={cn(icon, "transition-colors duration-200", active ? "fill-rose text-rose drop-shadow-[0_4px_10px_rgba(217,79,145,0.35)]" : "fill-transparent text-rose/40")}
                    strokeWidth={1.6}
                  />
                </m.span>
              </label>
            </span>
          );
        })}
        <span className="ml-2 min-w-[5.5rem] text-sm font-medium text-rose-deep" aria-live="polite">
          {shown ? labels[shown - 1] : ""}
        </span>
      </div>
    </fieldset>
  );
}

/** Read-only heart display (e.g. average rating). */
export function Hearts({ value, className, label }: { value: number; className?: string; label?: string }) {
  const t = useTranslations("feedback");
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} role="img" aria-label={label ?? t("outOf5", { value })}>
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = Math.max(0, Math.min(1, value - (n - 1)));
        return (
          <span key={n} className="relative inline-block size-4" aria-hidden>
            <Heart className="absolute inset-0 size-4 fill-transparent text-rose/40" strokeWidth={1.6} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Heart className="size-4 fill-rose text-rose" strokeWidth={1.6} />
            </span>
          </span>
        );
      })}
    </span>
  );
}
