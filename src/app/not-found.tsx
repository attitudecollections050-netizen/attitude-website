import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Wordmark } from "@/components/brand/Wordmark";
import { buttonClasses } from "@/components/ui/Button";

export default async function NotFound() {
  const t = await getTranslations("errors");
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-blush px-4 text-center">
      <Link href="/" aria-label={t("home")}><Wordmark /></Link>
      <p className="display text-[7rem] leading-none text-rose sm:text-[10rem]">404</p>
      <h1 className="display text-4xl sm:text-5xl">{t("notFoundTitle")}</h1>
      <p className="max-w-md text-sm text-plum-soft">{t("notFoundBody")}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/" className={buttonClasses("primary")}>{t("backHome")}</Link>
        <Link href="/shop" className={buttonClasses("outline")}>{t("shopAll")}</Link>
      </div>
    </div>
  );
}
