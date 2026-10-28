import Link from "next/link";
import type { CategoryNode } from "@/lib/catalog/types";
import type { StoreSettings } from "@/lib/settings";
import { Wordmark } from "@/components/brand/Wordmark";
import { CookieSettingsButton } from "@/components/analytics/CookieConsent";
import { useTranslations } from "next-intl";
import { NewsletterForm } from "./NewsletterForm";
import { PreferencesButton } from "@/components/intl/PreferencesButton";

export function Footer({ categories, settings }: { categories: CategoryNode[]; settings: StoreSettings }) {
  const s = settings.store;
  const t = useTranslations("footer");
  const tc = useTranslations("common");
  const socials = [
    { label: "Instagram", href: s.instagram },
    { label: "TikTok", href: s.tiktok },
    { label: "Facebook", href: s.facebook },
    { label: "X", href: s.x },
  ].filter((x): x is { label: string; href: string } => Boolean(x.href));

  return (
    <footer className="mt-auto bg-plum text-white">
      <div className="container-luxe grid gap-12 py-16 lg:grid-cols-[1.3fr_1fr_1fr_1fr] lg:py-20">
        <div>
          <Wordmark tone="light" />
          <p className="mt-6 max-w-sm font-display text-2xl leading-snug text-white/90">{t("join")}</p>
          <div className="mt-4">
            <NewsletterForm />
          </div>
        </div>
        <FooterCol title={t("shop")} links={[{ label: tc("shopAll"), href: "/shop" }, ...categories.map((c) => ({ label: c.name, href: c.href }))]} />
        <FooterCol
          title={t("help")}
          links={[
            { label: t("contact"), href: "/contact" },
            { label: t("track"), href: "/track-order" },
            { label: t("faq"), href: "/faq" },
            { label: t("shipping"), href: "/shipping-policy" },
            { label: t("returns"), href: "/returns-policy" },
            { label: t("feedback"), href: "/feedback" },
          ]}
        />
        <div>
          <FooterCol
            title={t("brand")}
            links={[
              { label: t("about"), href: "/about" },
              { label: t("account"), href: "/account" },
              { label: t("privacy"), href: "/privacy-policy" },
              { label: t("terms"), href: "/terms" },
            ]}
          />
          {(s.support_email || s.support_phone || s.whatsapp) && (
            <ul className="mt-6 space-y-1.5 text-sm text-white/70">
              {s.support_email && (
                <li>
                  <a href={`mailto:${s.support_email}`} className="link-underline hover:text-white">
                    {s.support_email}
                  </a>
                </li>
              )}
              {s.support_phone && (
                <li>
                  <a href={`tel:${s.support_phone.replace(/\s/g, "")}`} className="link-underline hover:text-white">
                    {s.support_phone}
                  </a>
                </li>
              )}
              {s.whatsapp && (
                <li>
                  <a href={`https://wa.me/${s.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="link-underline hover:text-white">
                    WhatsApp
                  </a>
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-luxe flex flex-col gap-4 py-6 text-xs text-white/60 sm:flex-row sm:items-center sm:justify-between">
          <p>{t("rights", { year: new Date().getFullYear(), name: s.name })}</p>
          {socials.length > 0 && (
            <ul className="flex gap-5">
              {socials.map((x) => (
                <li key={x.label}>
                  <a href={x.href} target="_blank" rel="noopener noreferrer" className="eyebrow !text-[0.6rem] hover:text-white">
                    {x.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center gap-5">
            <PreferencesButton className="hover:text-white" />
            <CookieSettingsButton className="hover:text-white" />
            <p>{t("securePayments")}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <p className="eyebrow text-rose-light">{title}</p>
      <ul className="mt-5 space-y-2.5 text-sm text-white/75">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="link-underline hover:text-white">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
