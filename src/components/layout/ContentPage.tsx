import { notFound } from "next/navigation";
import { getContentPage } from "@/lib/catalog/queries";
import { Markdown } from "@/components/ui/Markdown";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Reveal } from "@/components/ui/Reveal";
import { isSupabaseConfigured } from "@/lib/env";
import { SetupNotice } from "@/components/ui/SetupNotice";
import { getLocale, getTranslations } from "next-intl/server";
import { Languages } from "lucide-react";

/** Store pages written in Admin → Content. `eyebrow` is a key in the "content" messages. */
export async function ContentPage({ slug, eyebrow, children }: { slug: string; eyebrow: "story" | "help" | "policies"; children?: React.ReactNode }) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="container-luxe py-16">
        <SetupNotice what="This page" />
      </div>
    );
  }
  const page = await getContentPage(slug);
  if (!page) notFound();
  const [t, tc, locale] = await Promise.all([getTranslations("content"), getTranslations("common"), getLocale()]);
  return (
    <article>
      <header className="bg-blush">
        <div className="container-luxe max-w-4xl py-14 sm:py-20">
          <Breadcrumbs items={[{ label: tc("home"), href: "/" }, { label: page.title }]} />
          <p className="eyebrow mt-8 text-rose-deep">{t(eyebrow)}</p>
          <h1 className="display mt-3 text-5xl sm:text-7xl" lang="en">{page.title}</h1>
          {page.summary && <p className="mt-5 max-w-xl text-plum-soft" lang="en">{page.summary}</p>}
          {locale !== "en" && (
            <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-xs text-plum-soft">
              <Languages className="size-4 text-rose-deep" aria-hidden /> {tc("englishOnly")}
            </p>
          )}
        </div>
      </header>
      <div className="container-luxe max-w-3xl py-14">
        <Reveal>
          <div lang="en" dir="ltr">
            <Markdown source={page.body} />
          </div>
        </Reveal>
        {children}
        <p className="mt-14 text-xs text-muted">{t("updated", { date: new Date(page.updated_at).toLocaleDateString(locale, { dateStyle: "long", timeZone: "Africa/Lagos" }) })}</p>
      </div>
    </article>
  );
}

export async function contentMetadata(slug: string, fallbackTitle: string) {
  const page = isSupabaseConfigured() ? await getContentPage(slug) : null;
  return { title: page?.title ?? fallbackTitle, description: page?.summary ?? undefined, alternates: { canonical: `/${slug}` } };
}
