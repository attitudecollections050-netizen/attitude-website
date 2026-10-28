import { NextResponse, type NextRequest } from "next/server";
import { assertPermission, AuthorizationError } from "@/lib/auth";
import { parseFeedbackFilters, queryFeedback, type FeedbackRow } from "@/lib/feedback/admin-query";
import { csvResponse, toCsv } from "@/lib/csv";

/** CSV of feedback matching the current filters. Internal notes are not included. */
export async function GET(request: NextRequest) {
  try {
    await assertPermission("feedback:manage");
  } catch (e) {
    return NextResponse.json({ error: e instanceof AuthorizationError ? e.message : "Unauthorized" }, { status: 403 });
  }
  const f = parseFeedbackFilters(Object.fromEntries(request.nextUrl.searchParams));
  const { data, error } = await queryFeedback(f, { limit: 10000, offset: 0 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = ((data ?? []) as unknown as FeedbackRow[]).map((r) => [
    r.created_at, r.kind, r.product?.name ?? "", r.rating, r.sentiment, r.reason ?? "", r.comment ?? "", r.suggestion ?? "",
    r.display_name_pref === "first_name" ? (r.display_name ?? "") : "Anonymous", r.is_verified_purchase ? "yes" : "no",
    r.publish_consent ? "yes" : "no", r.status, r.moderation, r.flag ?? "", r.response ?? "", r.source,
  ]);
  const header = ["submitted_at", "type", "product", "hearts", "sentiment", "reason", "comment", "suggestion", "display_name", "verified_purchase", "public_consent", "review_status", "visibility", "flag", "response", "source"];
  return csvResponse(toCsv(header, rows), `attitude-feedback-${new Date().toISOString().slice(0, 10)}.csv`);
}
