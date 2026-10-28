import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { TrackOrderForm } from "@/components/checkout/TrackOrderForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("track");
  return { title: t("title"), description: t("metaDescription") };
}

export default async function TrackOrderPage({ searchParams }: PageProps<"/track-order">) {
  const { order } = await searchParams;
  const t = await getTranslations("track");
  return (
    <div className="container-luxe max-w-4xl pb-24 pt-14">
      <p className="eyebrow text-rose-deep">{t("eyebrow")}</p>
      <h1 className="display mt-3 text-5xl sm:text-6xl">{t("title")}</h1>
      <p className="mt-4 max-w-lg text-sm text-plum-soft">{t("intro")}</p>
      <div className="mt-10">
        <TrackOrderForm initialOrder={typeof order === "string" ? order.slice(0, 20) : ""} />
      </div>
    </div>
  );
}
