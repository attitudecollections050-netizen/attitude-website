import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";

export const metadata: Metadata = { title: "Link expired", robots: { index: false, follow: false } };

/** Where /auth/confirm sends links that are invalid, already used or expired. */
export default function AuthCodeErrorPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-plum px-4 py-16">
      <div className="w-full max-w-md rounded-[1.6rem] bg-white p-8 text-center shadow-[0_40px_90px_-40px_rgba(217,79,145,0.8)] sm:p-10">
        <div className="flex justify-center"><Wordmark /></div>
        <h1 className="mt-8 font-display text-3xl">This link has expired</h1>
        <p className="mt-3 text-sm leading-relaxed text-plum-soft">
          Email links work once and only for a limited time. If you were invited to the team, ask the store owner to send a new invitation from Staff Management. If you were resetting your password, request a new link.
        </p>
        <div className="mt-7 flex flex-col gap-3">
          <Link href="/account/forgot-password" className="inline-flex h-12 items-center justify-center rounded-full bg-plum px-6 text-xs font-bold uppercase tracking-[0.16em] text-white transition hover:bg-rose-deep">Request a new reset link</Link>
          <Link href="/account/login" className="text-sm font-semibold text-rose-deep underline underline-offset-4">Go to sign in</Link>
        </div>
      </div>
    </div>
  );
}
