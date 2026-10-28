// Reporting periods. All daily/monthly figures use the business timezone
// below (West Africa Time, UTC+1, no daylight saving).
export const REPORT_TZ = "Africa/Lagos";
export const REPORT_TZ_LABEL = "West Africa Time (Africa/Lagos, UTC+1)";

export const PERIOD_PRESETS = [
  { id: "today", label: "Today" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "90d", label: "Last 90 days" },
  { id: "this_month", label: "This month" },
  { id: "last_month", label: "Last month" },
  { id: "this_year", label: "This year" },
  { id: "custom", label: "Custom range" },
] as const;

export type PeriodPreset = (typeof PERIOD_PRESETS)[number]["id"];
export type Bucket = "day" | "week" | "month";

export interface Period {
  preset: PeriodPreset;
  from: string; // YYYY-MM-DD, inclusive, business timezone
  to: string; // YYYY-MM-DD, inclusive
  bucket: Bucket;
  label: string;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 3660;

/** Today's calendar date in the business timezone. */
export function localToday(now: Date = new Date(), tz: string = REPORT_TZ): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function parse(d: string): Date {
  return new Date(`${d}T00:00:00Z`);
}
function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(d: string, n: number): string {
  const x = parse(d);
  x.setUTCDate(x.getUTCDate() + n);
  return fmt(x);
}
export function daysBetween(from: string, to: string): number {
  return Math.round((parse(to).getTime() - parse(from).getTime()) / 86_400_000);
}
function isValidDate(d: unknown): d is string {
  return typeof d === "string" && ISO.test(d) && fmt(parse(d)) === d;
}

export function autoBucket(from: string, to: string): Bucket {
  const days = daysBetween(from, to) + 1;
  if (days <= 45) return "day";
  if (days <= 200) return "week";
  return "month";
}

/** Resolves ?period=…&from=…&to=…&bucket=… into a validated inclusive date range. */
export function resolvePeriod(params: { period?: string; from?: string; to?: string; bucket?: string }, now: Date = new Date()): Period {
  const today = localToday(now);
  const preset = (PERIOD_PRESETS.some((p) => p.id === params.period) ? params.period : "30d") as PeriodPreset;
  let from = today;
  let to = today;
  switch (preset) {
    case "today":
      break;
    case "7d":
      from = addDays(today, -6);
      break;
    case "30d":
      from = addDays(today, -29);
      break;
    case "90d":
      from = addDays(today, -89);
      break;
    case "this_month":
      from = `${today.slice(0, 7)}-01`;
      break;
    case "last_month": {
      const firstThis = parse(`${today.slice(0, 7)}-01`);
      const lastPrev = new Date(firstThis.getTime() - 86_400_000);
      from = `${fmt(lastPrev).slice(0, 7)}-01`;
      to = fmt(lastPrev);
      break;
    }
    case "this_year":
      from = `${today.slice(0, 4)}-01-01`;
      break;
    case "custom": {
      const f = isValidDate(params.from) ? params.from : addDays(today, -29);
      const t = isValidDate(params.to) ? params.to : today;
      [from, to] = f <= t ? [f, t] : [t, f];
      if (daysBetween(from, to) > MAX_DAYS) from = addDays(to, -MAX_DAYS);
      break;
    }
  }
  const bucket: Bucket = params.bucket === "day" || params.bucket === "week" || params.bucket === "month" ? params.bucket : autoBucket(from, to);
  const label = preset === "custom" ? `${from} – ${to}` : PERIOD_PRESETS.find((p) => p.id === preset)!.label;
  return { preset, from, to, bucket, label };
}

/** Query string that reproduces a period (used by links and CSV exports). */
export function periodQuery(p: Pick<Period, "preset" | "from" | "to" | "bucket">): string {
  const q = new URLSearchParams({ period: p.preset, bucket: p.bucket });
  if (p.preset === "custom") {
    q.set("from", p.from);
    q.set("to", p.to);
  }
  return q.toString();
}

/** Human label for a series bucket key (YYYY-MM-DD at the start of the bucket). */
export function bucketLabel(key: string, bucket: Bucket): string {
  const d = parse(key);
  if (bucket === "month") return d.toLocaleDateString("en-NG", { month: "short", year: "numeric", timeZone: "UTC" });
  const s = d.toLocaleDateString("en-NG", { day: "numeric", month: "short", timeZone: "UTC" });
  return bucket === "week" ? `Wk of ${s}` : s;
}

/** [from, to) as ISO instants. Africa/Lagos has a fixed UTC+1 offset (no daylight saving). */
export function periodInstants(p: Pick<Period, "from" | "to">): { fromIso: string; toIso: string } {
  const end = parse(p.to);
  end.setUTCDate(end.getUTCDate() + 1);
  return { fromIso: new Date(`${p.from}T00:00:00+01:00`).toISOString(), toIso: new Date(`${fmt(end)}T00:00:00+01:00`).toISOString() };
}
