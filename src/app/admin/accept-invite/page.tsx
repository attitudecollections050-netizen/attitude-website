import { redirect } from "next/navigation";

/** Older invitation links pointed here; staff now choose their password at /auth/set-password. */
export default function AcceptInvitePage() {
  redirect("/auth/set-password");
}
