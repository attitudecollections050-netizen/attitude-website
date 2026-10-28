import Link from "next/link";
import { BadgeCheck, MessageSquareReply } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { createPublicClient } from "@/lib/supabase/public";
import { HEART_LABELS } from "@/lib/feedback/shared";
import { Hearts } from "./HeartRating";
import { FeedbackForm } from "./FeedbackForm";

interface PublicReview {
  id: string;
  rating: number;
  comment: string | null;
  display_name: string | null;
  is_verified_purchase: boolean;
  created_at: string;
  response: string | null;
}

export async function getReviewSummary(productId: string): Promise<{ count: number; average: number | null }> {
  const { data } = await createPublicClient().rpc("public_product_review_summary", { p_product_id: productId });
  const s = (data ?? {}) as { count?: number; average?: number | null };
  return { count: Number(s.count ?? 0), average: s.average == null ? null : Number(s.average) };
}

/** Approved, consented reviews for a product, plus the review form for signed-in customers. */
export async function ProductReviews({ productId, slug }: { productId: string; slug: string }) {
  const [{ data }, summary, user] = await Promise.all([
    createPublicClient().rpc("public_product_reviews", { p_product_id: productId, p_limit: 20 }),
    getReviewSummary(productId),
    getCurrentUser(),
  ]);
  const reviews = (data ?? []) as PublicReview[];

  return (
    <section className="mt-16 grid gap-12 border-t border-line pt-14 lg:grid-cols-[1fr_24rem]" aria-labelledby="reviews-heading">
      <div>
        <p className="eyebrow text-rose-deep">Customer reviews</p>
        <h2 id="reviews-heading" className="display mt-3 text-4xl">What customers say</h2>
        {summary.count > 0 && summary.average != null ? (
          <p className="mt-4 flex items-center gap-3 text-sm">
            <Hearts value={summary.average} label={`Average ${summary.average} out of 5 hearts`} />
            <span className="font-semibold">{summary.average.toFixed(1)}</span>
            <span className="text-muted">from {summary.count} {summary.count === 1 ? "review" : "reviews"}</span>
          </p>
        ) : (
          <p className="mt-4 text-sm text-muted">No reviews yet.</p>
        )}
        <ul className="mt-8 divide-y divide-line">
          {reviews.map((r) => (
            <li key={r.id} className="py-6">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Hearts value={r.rating} label={`${r.rating} out of 5 hearts: ${HEART_LABELS[r.rating - 1]}`} />
                <span className="text-sm font-semibold">{r.display_name ?? "Anonymous customer"}</span>
                {r.is_verified_purchase && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-success"><BadgeCheck className="size-3.5" aria-hidden /> Verified Purchase</span>
                )}
                <time dateTime={r.created_at} className="text-xs text-muted">{new Date(r.created_at).toLocaleDateString("en-NG", { dateStyle: "medium" })}</time>
              </div>
              {r.comment && <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-plum-soft">{r.comment}</p>}
              {r.response && (
                <div className="mt-4 border-l-2 border-rose bg-blush px-4 py-3 text-sm">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-deep"><MessageSquareReply className="size-3.5" aria-hidden /> Response from Attitude Collections</p>
                  <p className="mt-1 whitespace-pre-line text-plum-soft">{r.response}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
      <aside className="h-fit rounded-3xl border border-line bg-white p-6">
        <h3 className="font-display text-2xl">Write a review</h3>
        {user ? (
          <div className="mt-4">
            <p className="mb-4 text-xs text-muted">If you bought this item with this account, your review is marked “Verified Purchase”.</p>
            <FeedbackForm kind="product" productId={productId} source="product_page" compact />
          </div>
        ) : (
          <p className="mt-3 text-sm text-plum-soft">
            <Link href={`/account/login?next=${encodeURIComponent(`/products/${slug}`)}`} className="underline underline-offset-4">Sign in</Link> to review this product. Reviews from customers who bought it are marked “Verified Purchase”.
          </p>
        )}
      </aside>
    </section>
  );
}
