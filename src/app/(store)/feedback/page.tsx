import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { FeedbackForm } from "@/components/feedback/FeedbackForm";

export const metadata: Metadata = {
  title: "Share your feedback",
  description: "Tell Attitude Collections how we're doing — rate your experience with hearts.",
  alternates: { canonical: "/feedback" },
};

export default function FeedbackPage() {
  return (
    <div>
      <header className="bg-blush">
        <div className="container-luxe py-14 sm:py-20">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Feedback" }]} />
          <p className="eyebrow mt-8 text-rose-deep">We&apos;re listening</p>
          <h1 className="display mt-3 text-5xl sm:text-7xl">How are we doing? 💗</h1>
          <p className="mt-5 max-w-xl text-plum-soft">
            Rate your experience with up to five hearts. Good or bad, every response is read by our team and helps us improve. Need help with an order instead? <Link href="/contact" className="underline underline-offset-4">Contact us</Link>.
          </p>
        </div>
      </header>
      <div className="container-luxe max-w-2xl py-16">
        <FeedbackForm source="form" />
      </div>
    </div>
  );
}
