import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck } from "lucide-react";
import { requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { HEART_LABELS, SENTIMENT_LABELS, reasonLabel, sentimentTone } from "@/lib/feedback/shared";
import { addFeedbackNote, moderateFeedback, saveFeedbackResponse } from "@/app/admin/actions/feedback";
import { ActionForm } from "@/components/admin/ActionForm";
import { Badge, Card, PageHeader, inputCls } from "@/components/admin/ui";
import { Hearts } from "@/components/feedback/HeartRating";
import { Notice } from "@/components/ui/Notice";

export const metadata = { title: "Feedback" };

const SOURCE_LABELS: Record<string, string> = {
  exit_intent: "Exit-intent invitation (desktop)",
  timed_prompt: "Gentle prompt (mobile)",
  form: "Feedback page",
  product_page: "Product page",
  order_page: "Order page",
};

export default async function FeedbackDetailPage({ params }: PageProps<"/admin/feedback/[id]">) {
  await requireStaffPage("feedback:manage");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await createClient();
  const [{ data: fb }, { data: notes }] = await Promise.all([
    db.from("feedback").select("*, product:products ( id, name, slug ), order:orders ( id, order_number )").eq("id", id).maybeSingle(),
    db.from("feedback_notes").select("id, note, created_at, author_id").eq("feedback_id", id).order("created_at"),
  ]);
  if (!fb) notFound();
  const authorIds = [...new Set((notes ?? []).map((n) => n.author_id).filter(Boolean))] as string[];
  const { data: authors } = authorIds.length ? await db.from("profiles").select("id, email, full_name").in("id", authorIds) : { data: [] };
  const authorName = (aid: string | null) => {
    const a = (authors ?? []).find((x) => x.id === aid);
    return a?.full_name || a?.email || "Staff";
  };

  const op = (value: string, label: string, variant: "primary" | "outline" | "rose" | "ghost" = "outline", confirm?: string) => (
    <ActionForm action={moderateFeedback} submitLabel={label} variant={variant} inline confirm={confirm}>
      <input type="hidden" name="id" value={fb.id} />
      <input type="hidden" name="op" value={value} />
    </ActionForm>
  );
  const shownName = fb.display_name_pref === "first_name" && fb.display_name ? fb.display_name : "Anonymous";

  return (
    <div className="space-y-6">
      <PageHeader title={fb.kind === "product" ? "Product review" : "Site feedback"} back={{ href: "/admin/feedback", label: "All feedback" }} description={`Received ${new Date(fb.created_at).toLocaleString("en-NG", { dateStyle: "full", timeStyle: "short" })}`} />

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Card>
            <div className="flex flex-wrap items-center gap-3">
              <Hearts value={fb.rating} className="[&>span]:!size-5 [&_svg]:!size-5" label={`${fb.rating} out of 5 hearts`} />
              <span className="font-semibold">{fb.rating}/5 · {HEART_LABELS[fb.rating - 1]}</span>
              <Badge tone={sentimentTone(fb.sentiment)}>{SENTIMENT_LABELS[fb.sentiment as keyof typeof SENTIMENT_LABELS]}</Badge>
              {fb.is_verified_purchase && <span className="inline-flex items-center gap-1 text-xs font-semibold text-success"><BadgeCheck className="size-4" aria-hidden />Verified purchase</span>}
            </div>
            <dl className="mt-5 space-y-4 text-sm">
              <div><dt className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-muted">Comment</dt><dd className="mt-1 whitespace-pre-line">{fb.comment || <span className="italic text-muted">No written comment</span>}</dd></div>
              <div><dt className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-muted">Reason for rating</dt><dd className="mt-1">{fb.reason ? reasonLabel(fb.reason) : <span className="text-muted">Not given</span>}</dd></div>
              <div><dt className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-muted">Suggestion</dt><dd className="mt-1 whitespace-pre-line">{fb.suggestion || <span className="text-muted">None</span>}</dd></div>
            </dl>
          </Card>

          {fb.kind === "product" && (
            <Card title="Public response" description="Shown under the review on the product page when the review is published.">
              <ActionForm action={saveFeedbackResponse} submitLabel="Save response">
                <input type="hidden" name="id" value={fb.id} />
                <textarea name="response" defaultValue={fb.response ?? ""} rows={4} maxLength={2000} className={inputCls} aria-label="Response to the customer" placeholder="Thank the customer or explain what you're doing about it…" />
              </ActionForm>
            </Card>
          )}

          <Card title="Internal notes" description="Private to your team — never shown to customers.">
            {(notes ?? []).length === 0 ? <p className="text-sm text-muted">No notes yet.</p> : (
              <ul className="mb-4 space-y-3">
                {(notes ?? []).map((n) => (
                  <li key={n.id} className="rounded-lg bg-neutral px-4 py-3 text-sm">
                    <p className="whitespace-pre-line">{n.note}</p>
                    <p className="mt-1 text-xs text-muted">{authorName(n.author_id)} · {new Date(n.created_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}</p>
                  </li>
                ))}
              </ul>
            )}
            <ActionForm action={addFeedbackNote} submitLabel="Add note" resetOnSuccess>
              <input type="hidden" name="id" value={fb.id} />
              <textarea name="note" rows={3} maxLength={2000} className={inputCls} aria-label="New internal note" placeholder="e.g. Called the customer, replacement sent." required />
            </ActionForm>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Status">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-xs text-muted">Review</dt><dd>{fb.status === "new" ? <Badge tone="rose">New</Badge> : <Badge>Reviewed</Badge>}</dd></div>
              <div><dt className="text-xs text-muted">Public visibility</dt><dd>{fb.moderation === "approved" ? <Badge tone="success">Published</Badge> : fb.moderation === "hidden" ? <Badge tone="warning">Hidden</Badge> : <Badge>Pending</Badge>}</dd></div>
              <div><dt className="text-xs text-muted">Flag</dt><dd>{fb.flag ? <Badge tone="danger">{fb.flag}</Badge> : "—"}</dd></div>
              <div><dt className="text-xs text-muted">May be shown publicly</dt><dd>{fb.publish_consent ? "Yes, customer agreed" : "No"}</dd></div>
            </dl>
            <div className="mt-5 flex flex-wrap gap-2">
              {fb.status === "new" ? op("reviewed", "Mark reviewed", "primary") : op("unreviewed", "Mark as new")}
              {fb.kind === "product" && fb.publish_consent && !fb.flag && fb.moderation !== "approved" && op("approve", "Publish review", "rose")}
              {fb.moderation !== "hidden" && op("hide", "Hide from public")}
              {fb.moderation === "hidden" && !fb.flag && op("pending", "Unhide (back to pending)")}
            </div>
            <div className="mt-4 border-t border-line pt-4">
              <p className="mb-2 text-xs text-muted">Flag spam or abusive content. Flagged feedback is hidden but kept on record. Don&apos;t flag honest negative feedback.</p>
              <div className="flex flex-wrap gap-2">
                {fb.flag ? op("unflag", "Remove flag") : (
                  <>
                    {op("flag_spam", "Flag as spam", "ghost")}
                    {op("flag_abusive", "Flag as abusive", "ghost")}
                    {op("flag_other", "Flag (other)", "ghost")}
                  </>
                )}
              </div>
            </div>
            {fb.kind === "site" && <Notice className="mt-4">Site feedback is private and is never published on the website.</Notice>}
          </Card>

          <Card title="Details">
            <dl className="space-y-2.5 text-sm [&_dt]:text-xs [&_dt]:text-muted">
              <div><dt>Display name preference</dt><dd>{shownName}</dd></div>
              {fb.product && <div><dt>Product</dt><dd><Link href={`/admin/products/${fb.product.id}`} className="underline">{fb.product.name}</Link> · <Link href={`/products/${fb.product.slug}`} className="text-xs underline" target="_blank">view in store ↗</Link></dd></div>}
              {fb.order && <div><dt>Verified with order</dt><dd><Link href={`/admin/orders/${fb.order.id}`} className="underline">{fb.order.order_number}</Link></dd></div>}
              <div><dt>Submitted via</dt><dd>{SOURCE_LABELS[fb.source] ?? fb.source}</dd></div>
              {fb.page_path && <div><dt>Page</dt><dd className="font-mono text-xs">{fb.page_path}</dd></div>}
              <div><dt>Customer account</dt><dd>{fb.user_id ? "Signed in" : "Guest"}</dd></div>
              {fb.reviewed_at && <div><dt>Reviewed</dt><dd>{new Date(fb.reviewed_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}</dd></div>}
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
