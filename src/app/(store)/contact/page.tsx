import type { Metadata } from "next";
import { Mail, Phone, Clock, MapPin } from "lucide-react";
import { WhatsAppIcon, WhatsAppLink } from "@/components/ui/WhatsAppLink";
import { getSettings } from "@/lib/settings";
import { getTranslations } from "next-intl/server";
import { ContactForm } from "@/components/layout/ContactForm";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("contact");
  return { title: t("title"), description: t("metaDescription"), alternates: { canonical: "/contact" } };
}

export default async function ContactPage() {
  const [{ store }, t, tc] = await Promise.all([getSettings(), getTranslations("contact"), getTranslations("common")]);
  const details = [
    store.support_email && { icon: Mail, label: t("email"), value: store.support_email, href: `mailto:${store.support_email}` },
    store.support_phone && { icon: Phone, label: t("phone"), value: store.support_phone, href: `tel:${store.support_phone.replace(/\s/g, "")}` },
    store.whatsapp && { icon: WhatsAppIcon, label: "WhatsApp", value: store.whatsapp, whatsapp: true },
    store.business_hours && { icon: Clock, label: t("hours"), value: store.business_hours },
    store.business_address && { icon: MapPin, label: t("address"), value: store.business_address },
  ].filter(Boolean) as { icon: typeof Mail | typeof WhatsAppIcon; label: string; value: string; href?: string; whatsapp?: boolean }[];

  return (
    <div>
      <header className="bg-blush">
        <div className="container-luxe py-14 sm:py-20">
          <Breadcrumbs items={[{ label: tc("home"), href: "/" }, { label: t("crumb") }]} />
          <p className="eyebrow mt-8 text-rose-deep">{t("eyebrow")}</p>
          <h1 className="display mt-3 text-5xl sm:text-7xl">{t("title")}</h1>
          <p className="mt-5 max-w-xl text-plum-soft">{t("intro")}</p>
          {store.whatsapp && <div className="mt-8"><WhatsAppLink number={store.whatsapp} variant="button" label="Chat with us on WhatsApp" message={`Hello ${store.name}! I have a question.`} /></div>}
        </div>
      </header>
      <div className="container-luxe grid gap-14 py-16 lg:grid-cols-[1fr_22rem]">
        <ContactForm />
        <aside className="space-y-6">
          {details.length > 0 ? (
            <ul className="space-y-5">
              {details.map((d) => (
                <li key={d.label} className="flex gap-4">
                  <d.icon className="mt-0.5 size-4 text-rose" aria-hidden />
                  <span className="text-sm">
                    <span className="eyebrow block text-muted">{d.label}</span>
                    {d.whatsapp ? <span className="mt-2 block"><WhatsAppLink number={d.value} showNumber /></span> : d.href ? <a href={d.href} className="mt-1 block link-underline" target={d.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">{d.value}</a> : <span className="mt-1 block whitespace-pre-line">{d.value}</span>}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">{t("useForm")}</p>
          )}
          <div className="bg-neutral p-5 text-sm text-plum-soft">
            {t.rich("lookingForOrder", { link: (c) => <a href="/track-order" className="font-semibold underline underline-offset-4">{c}</a> })}
          </div>
        </aside>
      </div>
    </div>
  );
}
