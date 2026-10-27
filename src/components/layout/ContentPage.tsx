import { notFound } from "next/navigation";
import { getContentPage } from "@/lib/catalog/queries";
import { Markdown } from "@/components/ui/Markdown";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Reveal } from "@/components/ui/Reveal";
import { isSupabaseConfigured } from "@/lib/env";
import { SetupNotice } from "@/components/ui/SetupNotice";

export async function ContentPage({ slug, eyebrow, children }: { slug: string; eyebrow: string; children?: React.ReactNode }) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="container-luxe py-16">
        <SetupNotice what="This page" />
      </div>
    );
  }
  const page = await getContentPage(slug);
  if (!page) notFound();
  return (
    <article>
      <header className="bg-blush">
        <div className="container-luxe max-w-4xl py-14 sm:py-20">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: page.title }]} />
          <p className="eyebrow mt-8 text-rose-deep">{eyebrow}</p>
          <h1 className="display mt-3 text-5xl sm:text-7xl">{page.title}</h1>
          {page.summary && <p className="mt-5 max-w-xl text-plum-soft">{page.summary}</p>}
        </div>
      </header>
      <div className="container-luxe max-w-3xl py-14">
        <Reveal>
          <Markdown source={page.body} />
        </Reveal>
        {children}
        <p className="mt-14 text-xs text-muted">Last updated {new Date(page.updated_at).toLocaleDateString("en-NG", { dateStyle: "long" })}</p>
      </div>
    </article>
  );
}

export async function contentMetadata(slug: string, fallbackTitle: string) {
  const page = isSupabaseConfigured() ? await getContentPage(slug) : null;
  return { title: page?.title ?? fallbackTitle, description: page?.summary ?? undefined, alternates: { canonical: `/${slug}` } };
}
