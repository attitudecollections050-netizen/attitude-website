"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { getCurrentRoles, getCurrentUser } from "@/lib/auth";
import { serverSecrets } from "@/lib/env";
import { isStaffRole } from "@/lib/permissions";
import { passwordSchema } from "@/lib/validation";

export type SetPasswordState = { message: string } | null;

/** Saves the signed-in person's new password (from an invitation or a reset link). */
export async function setPassword(_prev: SetPasswordState, formData: FormData): Promise<SetPasswordState> {
  const user = await getCurrentUser();
  if (!user) return { message: "This link has expired or was already used. Ask for a new one and try again." };
  const parsed = passwordSchema.safeParse(formData.get("password"));
  if (!parsed.success) return { message: parsed.error.issues[0].message };
  if (formData.get("password") !== formData.get("confirm")) return { message: "The two passwords don't match." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) {
    if (error.code === "same_password") return { message: "Please choose a password you haven't used before." };
    return { message: error.code === "weak_password" ? "Please choose a stronger password." : "We couldn't save your password. Please try again." };
  }

  // An invited staff member becomes active once they've chosen their own password.
  if (serverSecrets().supabaseSecretKey) {
    await createServiceClient()
      .from("staff_members")
      .update({ status: "active", accepted_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("status", "invited");
  }

  // The owner and staff go to the dashboard (it sends each role to their own home); shoppers to their account.
  redirect(isStaffRole(await getCurrentRoles()) ? "/admin" : "/account");
}
