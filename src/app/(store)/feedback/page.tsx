import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { FeedbackForm } from "@/components/feedback/FeedbackForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("feedback");
  return { title: t("metaTitle"), description: t("metaDescription"), alternates: { canonical: "/feedback" } };
}

export default async function FeedbackPage() {
  const [t, tc] = await Promise.all([getTranslations("feedback"), getTranslations("common")]);
  return (
    <div>
      <header className="bg-blush">
        <div className="container-luxe py-14 sm:py-20">
          <Breadcrumbs items={[{ label: tc("home"), href: "/" }, { label: t("crumb") }]} />
          <p className="eyebrow mt-8 text-rose-deep">{t("eyebrow")}</p>
          <h1 className="display mt-3 text-5xl sm:text-7xl">{t("pageTitle")}</h1>
          <p className="mt-5 max-w-xl text-plum-soft">
            {t.rich("pageIntro", { link: (c) => <Link href="/contact" className="underline underline-offset-4">{c}</Link> })}
          </p>
        </div>
      </header>
      <div className="container-luxe max-w-2xl py-16">
        <FeedbackForm source="form" />
      </div>
    </div>
  );
}
