import Link from "next/link";
import { BadgeCheck, Download, Flag } from "lucide-react";
import { requireStaffPage } from "@/lib/auth";
import { bucketLabel, localToday, periodQuery, resolvePeriod } from "@/lib/analytics/periods";
import { loadFeedbackReport } from "@/lib/analytics/report";
import { FEEDBACK_PAGE_SIZE, feedbackQueryString, parseFeedbackFilters, queryFeedback, type FeedbackRow } from "@/lib/feedback/admin-query";
import { HEART_LABELS, SENTIMENT_LABELS, reasonLabel, sentimentTone } from "@/lib/feedback/shared";
import { Badge, Card, Empty, PageHeader, inputCls } from "@/components/admin/ui";
import { buttonClasses } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { PeriodFilter } from "@/components/admin/analytics/PeriodFilter";
import { BarList, Stat } from "@/components/admin/analytics/Stat";
import { FeedbackTrendChart } from "@/components/admin/analytics/Charts";
import { Hearts } from "@/components/feedback/HeartRating";

export const metadata = { title: "Customer Reviews & Feedback" };

export default async function FeedbackAdminPage({ searchParams }: PageProps<"/admin/feedback">) {
  await requireStaffPage("feedback:manage");
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const period = resolvePeriod({ period: one(sp.period) ?? "90d", from: one(sp.from), to: one(sp.to), bucket: one(sp.bucket) });
  const f = parseFeedbackFilters(sp);
  const [{ report: r, error }, list] = await Promise.all([loadFeedbackReport(period), queryFeedback(f)]);
  const rows = (list.data ?? []) as unknown as FeedbackRow[];
  const pages = Math.ceil((list.count ?? 0) / FEEDBACK_PAGE_SIZE);
  const pq = periodQuery(period);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Customer Reviews & Feedback"
        description="Every heart rating and comment customers send — positive, neutral and negative. Notes and flags are visible to staff only."
        actions={<a href={`/api/admin/feedback/export?${feedbackQueryString(f)}`} className={buttonClasses("outline", "sm")}><Download className="size-3.5" aria-hidden /> Export CSV</a>}
      />

      <section aria-labelledby="fb-summary">
        <h2 id="fb-summary" className="sr-only">Summary for the selected period</h2>
        <PeriodFilter preset={period.preset} from={period.from} to={period.to} bucket={period.bucket} today={localToday()} />
        {!r ? (
          <Notice tone="error" title="Summary could not be loaded">{error}</Notice>
        ) : (
          <>
            <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              <Stat label="Feedback received" value={r.total} note={`${period.label}.`} />
              <Stat label="Average rating" value={r.average != null ? <span className="inline-flex items-center gap-2">{Number(r.average).toFixed(1)}<Hearts value={Number(r.average)} /></span> : "—"} note="Mean of 1–5 hearts." />
              <Stat label="Positive" value={r.positive} note="As chosen by the customer (or 4–5 hearts)." href={`?${feedbackQueryString({ ...f, sentiment: "positive", page: 1 })}&${pq}`} />
              <Stat label="Neutral" value={r.neutral} note="Or 3 hearts." href={`?${feedbackQueryString({ ...f, sentiment: "neutral", page: 1 })}&${pq}`} />
              <Stat label="Negative" value={r.negative} note="Or 1–2 hearts." href={`?${feedbackQueryString({ ...f, sentiment: "negative", page: 1 })}&${pq}`} />
              <Stat label="Awaiting review" value={r.unreviewed} note={`${r.flagged} flagged as spam/abuse.`} href={`?${feedbackQueryString({ ...f, status: "new", page: 1 })}&${pq}`} />
            </ul>

            <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
              <Card title="Feedback trends" description="Submissions per period, split by sentiment.">
                <FeedbackTrendChart data={r.series.map((s) => ({ label: bucketLabel(s.bucket, period.bucket), positive: s.positive, neutral: s.neutral, negative: s.negative }))} />
              </Card>
              <Card title="Rating distribution">
                <BarList
                  valueLabel="Submissions by heart rating"
                  empty="No feedback in this period."
                  rows={[...r.distribution].reverse().map((d) => ({
                    label: <Link href={`?${feedbackQueryString({ ...f, rating: d.rating, page: 1 })}&${pq}`} className="inline-flex items-center gap-2 hover:text-rose-deep"><Hearts value={d.rating} /> <span className="text-xs text-muted">{HEART_LABELS[d.rating - 1]}</span></Link>,
                    value: d.count,
                  }))}
                />
              </Card>
              <Card title="Common complaints" description="Reasons given with negative or 1–2 heart feedback.">
                <BarList valueLabel="Complaints by reason" empty="No complaints in this period." rows={r.complaints.map((c) => ({ label: reasonLabel(c.reason), value: c.count, sub: `avg ${Number(c.average).toFixed(1)}♥` }))} />
              </Card>
              <Card title="Customer suggestions" description="Most recent improvement ideas.">
                {r.suggestions.length === 0 ? (
                  <p className="text-sm text-muted">No suggestions in this period.</p>
                ) : (
                  <ul className="divide-y divide-line text-sm">
                    {r.suggestions.map((s) => (
                      <li key={s.id} className="py-2.5">
                        <Link href={`/admin/feedback/${s.id}`} className="hover:text-rose-deep">“{s.suggestion}”</Link>
                        <span className="mt-0.5 flex items-center gap-2 text-xs text-muted"><Hearts value={s.rating} /> {new Date(s.created_at).toLocaleDateString("en-NG", { dateStyle: "medium" })}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </>
        )}
      </section>

      <section aria-labelledby="fb-list" className="space-y-4">
        <h2 id="fb-list" className="text-base font-semibold">All feedback <span className="font-normal text-muted">({list.count ?? 0})</span></h2>
        <form className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_repeat(6,auto)_auto]" role="search">
          <input name="q" defaultValue={f.q} placeholder="Search comments, suggestions, names" className={inputCls} aria-label="Search feedback" />
          <select name="rating" defaultValue={f.rating ?? ""} className={inputCls} aria-label="Rating">
            <option value="">Any rating</option>
            {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} ♥ {HEART_LABELS[n - 1]}</option>)}
          </select>
          <select name="sentiment" defaultValue={f.sentiment} className={inputCls} aria-label="Sentiment">
            <option value="">Any sentiment</option>
            <option value="positive">Positive</option>
            <option value="neutral">Neutral</option>
            <option value="negative">Negative</option>
          </select>
          <select name="kind" defaultValue={f.kind} className={inputCls} aria-label="Type">
            <option value="">Site & product</option>
            <option value="site">Site feedback</option>
            <option value="product">Product reviews</option>
          </select>
          <select name="status" defaultValue={f.status} className={inputCls} aria-label="Review status">
            <option value="">New & reviewed</option>
            <option value="new">New</option>
            <option value="reviewed">Reviewed</option>
          </select>
          <select name="moderation" defaultValue={f.moderation} className={inputCls} aria-label="Public visibility">
            <option value="">Any visibility</option>
            <option value="pending">Pending</option>
            <option value="approved">Published</option>
            <option value="hidden">Hidden</option>
          </select>
          <select name="sort" defaultValue={f.sort} className={inputCls} aria-label="Sort">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
          <button className={buttonClasses("primary", "sm", "h-full")}>Filter</button>
          {Array.from(new URLSearchParams(pq)).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        </form>
        {list.error && <Notice tone="error">{list.error.message}</Notice>}
        {rows.length === 0 ? (
          <Empty>No feedback matches these filters yet.</Empty>
        ) : (
          <ul className="divide-y divide-line border border-line bg-white">
            {rows.map((fb) => (
              <li key={fb.id}>
                <Link href={`/admin/feedback/${fb.id}`} className="block px-5 py-4 transition hover:bg-blush/60">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <Hearts value={fb.rating} label={`${fb.rating} hearts`} />
                    <Badge tone={sentimentTone(fb.sentiment)}>{SENTIMENT_LABELS[fb.sentiment]}</Badge>
                    <Badge tone={fb.kind === "product" ? "plum" : "neutral"}>{fb.kind === "product" ? "Product review" : "Site feedback"}</Badge>
                    {fb.is_verified_purchase && <span className="inline-flex items-center gap-1 text-[0.7rem] font-semibold text-success"><BadgeCheck className="size-3.5" aria-hidden />Verified purchase</span>}
                    {fb.status === "new" && <Badge tone="rose">New</Badge>}
                    {fb.moderation === "approved" && <Badge tone="success">Published</Badge>}
                    {fb.moderation === "hidden" && <Badge tone="warning">Hidden</Badge>}
                    {fb.flag && <Badge tone="danger"><Flag className="mr-1 size-3" aria-hidden />{fb.flag}</Badge>}
                    <time className="ml-auto text-xs text-muted" dateTime={fb.created_at}>{new Date(fb.created_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}</time>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-plum-soft">{fb.comment || <span className="italic text-muted">No written comment</span>}</p>
                  <p className="mt-1 text-xs text-muted">
                    {fb.product ? `On ${fb.product.name} · ` : ""}
                    {fb.reason ? `Reason: ${reasonLabel(fb.reason)} · ` : ""}
                    {fb.display_name_pref === "first_name" && fb.display_name ? fb.display_name : "Anonymous"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {pages > 1 && (
          <nav className="flex items-center justify-center gap-2 text-sm" aria-label="Pagination">
            {f.page > 1 && <Link href={`?${feedbackQueryString(f, { page: f.page - 1 })}&${pq}`} className="px-3 py-1.5 hover:text-rose-deep">← Prev</Link>}
            <span className="text-muted">Page {f.page} of {pages}</span>
            {f.page < pages && <Link href={`?${feedbackQueryString(f, { page: f.page + 1 })}&${pq}`} className="px-3 py-1.5 hover:text-rose-deep">Next →</Link>}
          </nav>
        )}
      </section>
    </div>
  );
}
