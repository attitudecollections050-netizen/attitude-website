"use client";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CalendarRange } from "lucide-react";
import { PERIOD_PRESETS, periodQuery, type Bucket, type PeriodPreset } from "@/lib/analytics/periods";
import { inputCls } from "@/components/admin/ui";
import { buttonClasses } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

/** Date-range controls in one row above the dashboard. Changing them updates the URL, which reloads every figure. */
export function PeriodFilter({ preset, from, to, bucket, today }: { preset: PeriodPreset; from: string; to: string; bucket: Bucket; today: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [custom, setCustom] = useState({ from, to });
  const go = (next: { preset: PeriodPreset; bucket?: Bucket | ""; from?: string; to?: string }) => {
    const q = new URLSearchParams(periodQuery({ preset: next.preset, from: next.from ?? from, to: next.to ?? to, bucket: (next.bucket || bucket) as Bucket }));
    if (next.bucket === "") q.delete("bucket");
    router.push(`${pathname}?${q.toString()}`);
  };

  return (
    <div className="mb-6 flex flex-wrap items-end gap-3 border border-line bg-white p-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Reporting period">
        {PERIOD_PRESETS.filter((p) => p.id !== "custom").map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => go({ preset: p.id, bucket: "" })}
            aria-pressed={preset === p.id}
            className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold transition", preset === p.id ? "border-plum bg-plum text-white" : "border-line hover:border-plum/50")}
          >
            {p.label}
          </button>
        ))}
      </div>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          go({ preset: "custom", from: custom.from, to: custom.to, bucket: "" });
        }}
      >
        <label className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-muted">
          From
          <input type="date" value={custom.from} max={today} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} className={cn(inputCls, "mt-1 block !w-auto")} required />
        </label>
        <label className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-muted">
          To
          <input type="date" value={custom.to} max={today} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} className={cn(inputCls, "mt-1 block !w-auto")} required />
        </label>
        <button className={buttonClasses(preset === "custom" ? "primary" : "outline", "sm")}>
          <CalendarRange className="size-3.5" aria-hidden /> Custom range
        </button>
      </form>
      <label className="ml-auto text-[0.65rem] font-bold uppercase tracking-[0.12em] text-muted">
        Group by
        <select value={bucket} onChange={(e) => go({ preset, bucket: e.target.value as Bucket })} className={cn(inputCls, "mt-1 block !w-auto")}>
          <option value="day">Day</option>
          <option value="week">Week</option>
          <option value="month">Month</option>
        </select>
      </label>
    </div>
  );
}
