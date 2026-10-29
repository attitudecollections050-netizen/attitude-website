"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/groundmail";
import { inviteEmail, notificationEmail } from "@/lib/emails/templates";
import { getCurrentUser } from "@/lib/auth";
import { INVITABLE_ROLES, ROLE_LABELS } from "@/lib/permissions";
import { emailSchema, passwordSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { bool, dbError, guarded, optStr, uuid } from "./helpers";
import type { AdminResult } from "./types";

export type InviteResult = (AdminResult & { link?: string; emailed?: boolean }) | null;

type Svc = ReturnType<typeof createServiceClient>;
/** Case-insensitive exact email match (escapes LIKE wildcards such as "_"). */
const likeEmail = (email: string) => email.replace(/[\\%_]/g, (c) => `\\${c}`);

/** A one-time, expiring sign-in link that lands on "choose your password". */
async function inviteLink(svc: Svc, email: string, fullName: string | null): Promise<{ link: string; userId: string } | { error: string; exists?: boolean }> {
  const redirectTo = `${env.siteUrl}/admin/accept-invite`;
  let res = await svc.auth.admin.generateLink({ type: "invite", email, options: { data: fullName ? { full_name: fullName } : undefined, redirectTo } });
  if (res.error && /already|registered|exists/i.test(res.error.message)) {
    // Already has an account: if it was never confirmed (an earlier invite), send a fresh sign-in link instead.
    const { data: profile } = await svc.from("profiles").select("id").ilike("email", likeEmail(email)).maybeSingle();
    const { data: u } = profile ? await svc.auth.admin.getUserById(profile.id) : { data: null };
    if (!u?.user || u.user.email_confirmed_at) return { error: "exists", exists: true };
    res = await svc.auth.admin.generateLink({ type: "magiclink", email, options: { redirectTo } });
  }
  if (res.error || !res.data?.properties?.hashed_token || !res.data.user) return { error: res.error?.message ?? "Could not create the invitation." };
  const type = res.data.properties.verification_type ?? "invite";
  const link = `${env.siteUrl}/auth/confirm?token_hash=${encodeURIComponent(res.data.properties.hashed_token)}&type=${encodeURIComponent(type)}&next=/admin/accept-invite`;
  return { link, userId: res.data.user.id };
}

async function emailInvite(to: string, name: string | null, link: string, role: string): Promise<boolean> {
  const res = await sendEmail({ to, ...inviteEmail({ name, role, link }), type: "invite" });
  return res.ok;
}

function done(message: string, extra: Partial<NonNullable<InviteResult>> = {}): InviteResult {
  revalidatePath("/admin/staff");
  return { ok: true, message, ...extra };
}

// ------------------------------------------------------------------- invite
export async function inviteStaff(_prev: InviteResult, formData: FormData): Promise<InviteResult> {
  let result: InviteResult = null;
  const r = await guarded("staff:manage", async ({ userId }) => {
    const input = z
      .object({
        email: emailSchema,
        full_name: optStr(120),
        role: z.enum(INVITABLE_ROLES),
        can_delete_products: bool,
      })
      .parse(Object.fromEntries(formData));
    if (!(await rateLimit("staff-invite", 20, 3600))) return { ok: false, message: "Too many invitations in the last hour. Please wait a little." };
    const svc = createServiceClient();
    const { data: existingProfile } = await svc.from("profiles").select("id").ilike("email", likeEmail(input.email)).maybeSingle();
    if (existingProfile) {
      const { data: isOwner } = await svc.from("user_roles").select("role").eq("user_id", existingProfile.id).eq("role", "admin").maybeSingle();
      if (isOwner) return { ok: false, message: "That email belongs to the owner account." };
      const { data: already } = await svc.from("staff_members").select("status").eq("user_id", existingProfile.id).maybeSingle();
      if (already) return { ok: false, message: `${input.email} is already on your staff list (${already.status}).` };
    }

    const inv = await inviteLink(svc, input.email, input.full_name);
    let staffUserId: string;
    let link: string | undefined;
    let createdByInvite = true;
    let status: "invited" | "active" = "invited";
    if ("error" in inv) {
      if (!inv.exists || !existingProfile) return { ok: false, message: inv.error };
      // Existing, confirmed customer account: they keep their own password and simply gain access.
      staffUserId = existingProfile.id;
      createdByInvite = false;
      status = "active";
    } else {
      staffUserId = inv.userId;
      link = inv.link;
    }

    const { error } = await svc.from("staff_members").insert({
      user_id: staffUserId,
      email: input.email,
      full_name: input.full_name,
      role: input.role,
      status,
      can_delete_products: input.can_delete_products,
      created_by_invite: createdByInvite,
      invited_by: userId,
      accepted_at: status === "active" ? new Date().toISOString() : null,
    });
    if (error) return dbError(error);
    const { error: roleErr } = await svc.from("user_roles").insert({ user_id: staffUserId, role: input.role });
    if (roleErr && roleErr.code !== "23505") {
      await svc.from("staff_members").delete().eq("user_id", staffUserId);
      return dbError(roleErr);
    }

    const roleLabel = ROLE_LABELS[input.role];
    if (!link) {
      const emailed = (
        await sendEmail({
          to: input.email,
          ...notificationEmail({
            title: "You now have access to the Attitude Collections dashboard",
            message: `You've been given ${roleLabel} access. Sign in with your existing password.`,
            actionUrl: `${env.siteUrl}/admin/login`,
            actionLabel: "Sign in",
          }),
          type: "staff-access",
        })
      ).ok;
      result = done(`${input.email} already had an account, so they can sign in at /admin/login with their own password.${emailed ? " We emailed them." : ""}`);
      return result;
    }
    const emailed = await emailInvite(input.email, input.full_name, link, roleLabel);
    result = done(
      emailed
        ? `Invitation emailed to ${input.email}.`
        : `Invitation created. Email sending isn't set up, so copy this private link and send it to ${input.email} yourself (for example on WhatsApp).`,
      { link: emailed ? undefined : link, emailed },
    );
    return result;
  });
  return result ?? r;
}

export async function resendInvite(_prev: InviteResult, formData: FormData): Promise<InviteResult> {
  let result: InviteResult = null;
  const r = await guarded("staff:manage", async () => {
    const id = uuid.parse(formData.get("user_id"));
    const svc = createServiceClient();
    const { data: staff } = await svc.from("staff_members").select("email, full_name, role, status").eq("user_id", id).maybeSingle();
    if (!staff) return { ok: false, message: "Staff member not found." };
    if (staff.status !== "invited") return { ok: false, message: "They have already accepted — they sign in with their own password." };
    const inv = await inviteLink(svc, staff.email, staff.full_name);
    if ("error" in inv) return { ok: false, message: inv.exists ? "They have already set their password — they can sign in at /admin/login." : inv.error };
    await svc.from("staff_members").update({ last_invited_at: new Date().toISOString() }).eq("user_id", id);
    const emailed = await emailInvite(staff.email, staff.full_name, inv.link, ROLE_LABELS[staff.role as keyof typeof ROLE_LABELS] ?? staff.role);
    result = done(emailed ? `New invitation emailed to ${staff.email}.` : `New invitation link created for ${staff.email} — copy it and send it to them.`, { link: emailed ? undefined : inv.link, emailed });
    return result;
  });
  return result ?? r;
}

// ------------------------------------------------------- disable / enable / remove
export async function setStaffDisabled(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("staff:manage", async () => {
    const id = uuid.parse(formData.get("user_id"));
    const disable = formData.get("disable") === "1";
    const svc = createServiceClient();
    const { data: staff } = await svc.from("staff_members").select("role, status, accepted_at").eq("user_id", id).maybeSingle();
    if (!staff) return { ok: false, message: "Staff member not found." };
    if (disable) {
      // Removing the role takes effect on their very next request; the ban stops new sign-ins.
      await svc.from("user_roles").delete().eq("user_id", id).eq("role", staff.role);
      const { error } = await svc.from("staff_members").update({ status: "disabled", disabled_at: new Date().toISOString() }).eq("user_id", id);
      if (error) return dbError(error);
      await svc.auth.admin.updateUserById(id, { ban_duration: "876000h" });
      revalidatePath("/admin/staff");
      return { ok: true, message: "Access disabled. They can no longer open the dashboard." };
    }
    await svc.auth.admin.updateUserById(id, { ban_duration: "none" });
    const { error } = await svc.from("staff_members").update({ status: staff.accepted_at ? "active" : "invited", disabled_at: null }).eq("user_id", id);
    if (error) return dbError(error);
    const { error: roleErr } = await svc.from("user_roles").insert({ user_id: id, role: staff.role });
    if (roleErr && roleErr.code !== "23505") return dbError(roleErr);
    revalidatePath("/admin/staff");
    return { ok: true, message: "Access restored." };
  });
}

export async function removeStaff(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("staff:manage", async () => {
    const id = uuid.parse(formData.get("user_id"));
    const svc = createServiceClient();
    const { data: staff } = await svc.from("staff_members").select("role, created_by_invite").eq("user_id", id).maybeSingle();
    if (!staff) return { ok: false, message: "Staff member not found." };
    await svc.from("user_roles").delete().eq("user_id", id).eq("role", staff.role);
    const { error } = await svc.from("staff_members").delete().eq("user_id", id);
    if (error) return dbError(error);
    // Accounts created only for this invitation are deleted; existing customer accounts are kept.
    if (staff.created_by_invite) await svc.auth.admin.deleteUser(id);
    else await svc.auth.admin.updateUserById(id, { ban_duration: "none" });
    revalidatePath("/admin/staff");
    return { ok: true, message: "Staff member removed." };
  });
}

export async function setDeletePermission(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("staff:manage", async () => {
    const id = uuid.parse(formData.get("user_id"));
    const allow = formData.get("allow") === "1";
    const { error } = await createServiceClient().from("staff_members").update({ can_delete_products: allow }).eq("user_id", id);
    if (error) return dbError(error);
    revalidatePath("/admin/staff");
    return { ok: true, message: allow ? "They can now delete products." : "Product deletion turned off." };
  });
}

// ------------------------------------------------------------- accepting
/** Called from the invitation link: the invited person chooses their own password. */
export async function acceptInvite(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Your invitation link has expired. Ask the store owner to send a new one." };
  const svc = createServiceClient();
  const { data: staff } = await svc.from("staff_members").select("status").eq("user_id", user.id).maybeSingle();
  if (!staff || staff.status === "disabled") return { ok: false, message: "This invitation is no longer valid." };
  const parsed = passwordSchema.safeParse(formData.get("password"));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  if (formData.get("password") !== formData.get("confirm")) return { ok: false, message: "Passwords do not match." };
  const name = optStr(120).parse(formData.get("full_name") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data, ...(name ? { data: { full_name: name } } : {}) });
  if (error) return { ok: false, message: error.code === "weak_password" ? "Please choose a stronger password." : "Could not save your password. Please try again." };
  await svc
    .from("staff_members")
    .update({ status: "active", accepted_at: new Date().toISOString(), ...(name ? { full_name: name } : {}) })
    .eq("user_id", user.id)
    .eq("status", "invited");
  if (name) await svc.from("profiles").update({ full_name: name }).eq("id", user.id);
  redirect("/staff/dashboard");
}
