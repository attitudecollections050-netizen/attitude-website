import type { RatingEntry, RatingSummary } from "@/lib/staff-work";
import { cn } from "@/lib/cn";

const EMPTY: RatingSummary = { recent: [], totalGood: 0, totalPoor: 0, bonuses: 0, deductions: 0 };
const when = (iso: string) => new Date(iso).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" });

/** "Good: 2/3" with three boxes that fill up; resets only when the other kind of rating comes in or the ₦25 is paid. */
function Counter({ label, n, tone }: { label: string; n: number; tone: "good" | "poor" }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={cn("text-sm font-bold tabular-nums", tone === "good" ? "text-[#166534]" : "text-[#B91C1C]")} data-testid={`counter-${tone}`}>
        {label}: {n}/3
      </span>
      <span className="flex gap-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className={cn("h-2.5 w-6 rounded-full", i < n ? (tone === "good" ? "bg-[#16A34A]" : "bg-[#DC2626]") : "bg-black/10")} />
        ))}
      </span>
    </div>
  );
}

export function RatingChip({ r }: { r: RatingEntry }) {
  return (
    <span
      className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold", r.rating === "good" ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#FEE2E2] text-[#B91C1C]")}
      title={`${r.details ?? ""}${r.reason ? ` — ${r.reason}` : ""}`}
    >
      {r.rating === "good" ? "✅ Good" : "❌ Poor"}
    </span>
  );
}

/** One staff member's counters, last 3 ratings and all-time totals. */
export function RatingStats({ good, poor, summary, className }: { good: number; poor: number; summary?: RatingSummary; className?: string }) {
  const s = summary ?? EMPTY;
  const last3 = s.recent.slice(0, 3);
  return (
    <div className={cn("space-y-2", className)} data-testid="rating-stats">
      <Counter label="Good" n={good} tone="good" />
      <Counter label="Poor" n={poor} tone="poor" />
      <p className="flex flex-wrap items-center gap-1 pt-1 text-xs text-black/60" data-testid="last-3">
        <span>Last 3 ratings:</span>
        {last3.length ? last3.map((r, i) => <RatingChip key={i} r={r} />) : <span className="italic">none yet</span>}
      </p>
      <p className="text-[11px] text-black/50" data-testid="all-time">
        All time: {s.totalGood} Good · {s.totalPoor} Poor · {s.bonuses} × +₦25 · {s.deductions} × −₦25
      </p>
    </div>
  );
}

/** Full rating history list (newest first), with what was rated and the reason. */
export function RatingHistory({ entries }: { entries: RatingEntry[] }) {
  if (!entries.length) return <p className="text-sm text-black/50">No ratings yet.</p>;
  return (
    <ul className="divide-y divide-black/10 text-sm" data-testid="rating-history">
      {entries.map((r, i) => (
        <li key={i} className="flex flex-wrap items-start justify-between gap-2 py-2.5">
          <span className="min-w-0">
            <span className="font-medium">{r.details ?? "Work"}</span>
            {r.reason && <span className={cn("block text-xs", r.rating === "poor" ? "text-[#B91C1C]" : "text-black/60")}>“{r.reason}”</span>}
          </span>
          <span className="flex items-center gap-2">
            <RatingChip r={r} />
            <span className="text-xs text-black/50">{when(r.createdAt)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
