import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { ProfileForm } from "@/components/account/ProfileForm";

export const metadata: Metadata = { title: "My account", robots: { index: false } };

export default async function AccountPage() {
  const user = await requireUser("/account");
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("full_name, phone, marketing_opt_in").eq("id", user.id).maybeSingle();
  return (
    <div className="space-y-12">
      <section>
        <h2 className="font-display text-3xl">Profile</h2>
        <div className="mt-6">
          <ProfileForm profile={profile ?? { full_name: null, phone: null, marketing_opt_in: false }} email={user.email ?? ""} />
        </div>
      </section>
      <section>
        <h2 className="font-display text-3xl">Security</h2>
        <p className="mt-3 text-sm text-plum-soft">
          To change your password, <Link href="/account/forgot-password" className="underline underline-offset-4">request a reset link</Link>.
        </p>
      </section>
    </div>
  );
}
