import Link from "next/link";
import { cn } from "@/lib/cn";

/** Summary card: label, the number, and a one-line definition. */
export function Stat({ label, value, note, href, emphasis }: { label: string; value: React.ReactNode; note?: string; href?: string; emphasis?: boolean }) {
  const body = (
    <>
      <p className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className={cn("mt-2 font-display tabular-nums leading-none", emphasis ? "text-4xl text-rose-deep" : "text-3xl")}>{value}</p>
      {note && <p className="mt-2 text-[0.68rem] leading-snug text-muted">{note}</p>}
    </>
  );
  const cls = "block h-full rounded-xl border border-line bg-white p-4 transition";
  return <li>{href ? <Link href={href} className={cn(cls, "hover:border-rose")}>{body}</Link> : <div className={cls}>{body}</div>}</li>;
}

/** Ranked horizontal bars rendered as plain HTML (accessible, no colour-only meaning). */
export function BarList({ rows, empty = "No data for this period.", valueLabel }: { rows: { label: React.ReactNode; value: number; display?: string; sub?: string }[]; empty?: string; valueLabel?: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="space-y-2.5" aria-label={valueLabel}>
      {rows.map((r, i) => (
        <li key={i} className="text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate">{r.label}</span>
            <span className="shrink-0 tabular-nums font-semibold">{r.display ?? r.value.toLocaleString("en-NG")}{r.sub && <span className="ml-1.5 text-xs font-normal text-muted">{r.sub}</span>}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-neutral" aria-hidden>
            <div className="h-2 rounded-full bg-rose" style={{ width: `${Math.max((r.value / max) * 100, r.value > 0 ? 2 : 0)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
