import type { Metadata } from "next";
import { Mail, Phone, MessageCircle, Clock, MapPin } from "lucide-react";
import { getSettings } from "@/lib/settings";
import { ContactForm } from "@/components/layout/ContactForm";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";

export const metadata: Metadata = { title: "Contact us", description: "Get in touch with Attitude Collections.", alternates: { canonical: "/contact" } };

export default async function ContactPage() {
  const { store } = await getSettings();
  const details = [
    store.support_email && { icon: Mail, label: "Email", value: store.support_email, href: `mailto:${store.support_email}` },
    store.support_phone && { icon: Phone, label: "Phone", value: store.support_phone, href: `tel:${store.support_phone.replace(/\s/g, "")}` },
    store.whatsapp && { icon: MessageCircle, label: "WhatsApp", value: store.whatsapp, href: `https://wa.me/${store.whatsapp.replace(/\D/g, "")}` },
    store.business_hours && { icon: Clock, label: "Hours", value: store.business_hours },
    store.business_address && { icon: MapPin, label: "Address", value: store.business_address },
  ].filter(Boolean) as { icon: typeof Mail; label: string; value: string; href?: string }[];

  return (
    <div>
      <header className="bg-blush">
        <div className="container-luxe py-14 sm:py-20">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Contact" }]} />
          <p className="eyebrow mt-8 text-rose-deep">Customer care</p>
          <h1 className="display mt-3 text-5xl sm:text-7xl">Contact us</h1>
          <p className="mt-5 max-w-xl text-plum-soft">Questions about an order, sizing or delivery? Send us a message and we&apos;ll reply by email.</p>
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
                    {d.href ? <a href={d.href} className="mt-1 block link-underline" target={d.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">{d.value}</a> : <span className="mt-1 block whitespace-pre-line">{d.value}</span>}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Please use the form to reach our team.</p>
          )}
          <div className="bg-neutral p-5 text-sm text-plum-soft">
            Looking for an order? <a href="/track-order" className="font-semibold underline underline-offset-4">Track it here</a> with your order number and email.
          </div>
        </aside>
      </div>
    </div>
  );
}
