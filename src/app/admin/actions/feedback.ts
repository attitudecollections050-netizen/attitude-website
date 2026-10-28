"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbError, guarded, uuid } from "./helpers";
import type { AdminResult } from "./types";

const OPS = ["reviewed", "unreviewed", "approve", "hide", "pending", "flag_spam", "flag_abusive", "flag_other", "unflag"] as const;

function refresh(id: string) {
  revalidatePath("/admin/feedback");
  revalidatePath(`/admin/feedback/${id}`);
}

/**
 * Moderation. Nothing here edits what the customer wrote or their rating;
 * "hide" keeps the record for the admin team and only removes it from public view.
 */
export async function moderateFeedback(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("feedback:manage", async ({ db, userId }) => {
    const { id, op } = z.object({ id: uuid, op: z.enum(OPS) }).parse(Object.fromEntries(formData));
    const { data: fb, error: readError } = await db.from("feedback").select("id, kind, publish_consent, flag, status").eq("id", id).maybeSingle();
    if (readError) return dbError(readError);
    if (!fb) return { ok: false, message: "Feedback not found." };

    const now = new Date().toISOString();
    let patch: Record<string, unknown>;
    let message: string;
    switch (op) {
      case "reviewed":
        patch = { status: "reviewed", reviewed_at: now, reviewed_by: userId };
        message = "Marked as reviewed.";
        break;
      case "unreviewed":
        patch = { status: "new", reviewed_at: null, reviewed_by: null };
        message = "Marked as new.";
        break;
      case "approve":
        if (fb.kind !== "product") return { ok: false, message: "Only product reviews are shown publicly." };
        if (!fb.publish_consent) return { ok: false, message: "The customer did not agree to their review being shown publicly." };
        if (fb.flag) return { ok: false, message: "Remove the flag before publishing." };
        patch = { moderation: "approved", status: "reviewed", reviewed_at: now, reviewed_by: userId };
        message = "Approved — now visible on the product page.";
        break;
      case "hide":
        patch = { moderation: "hidden", status: "reviewed", reviewed_at: now, reviewed_by: userId };
        message = "Hidden from public view. The record is kept here.";
        break;
      case "pending":
        patch = { moderation: "pending" };
        message = "Moved back to pending.";
        break;
      case "unflag":
        patch = { flag: null };
        message = "Flag removed.";
        break;
      default: {
        const flag = op.replace("flag_", "");
        // Flagged content is never public.
        patch = { flag, moderation: "hidden", status: "reviewed", reviewed_at: now, reviewed_by: userId };
        message = `Flagged as ${flag} and hidden from public view.`;
      }
    }
    const { error } = await db.from("feedback").update(patch).eq("id", id);
    if (error) return dbError(error);
    refresh(id);
    return { ok: true, message };
  });
}

export async function addFeedbackNote(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("feedback:manage", async ({ db, userId }) => {
    const { id, note } = z.object({ id: uuid, note: z.string().trim().min(1, "Write a note first.").max(2000) }).parse(Object.fromEntries(formData));
    const { error } = await db.from("feedback_notes").insert({ feedback_id: id, author_id: userId, note });
    if (error) return dbError(error);
    refresh(id);
    return { ok: true, message: "Note added." };
  });
}

export async function saveFeedbackResponse(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("feedback:manage", async ({ db, userId }) => {
    const { id, response } = z.object({ id: uuid, response: z.string().trim().max(2000) }).parse(Object.fromEntries(formData));
    const { error } = await db
      .from("feedback")
      .update(response ? { response, responded_at: new Date().toISOString(), responded_by: userId } : { response: null, responded_at: null, responded_by: null })
      .eq("id", id);
    if (error) return dbError(error);
    refresh(id);
    return { ok: true, message: response ? "Response saved. It shows under the review if the review is published." : "Response removed." };
  });
}
