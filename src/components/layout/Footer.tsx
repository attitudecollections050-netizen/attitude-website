import Link from "next/link";
import type { CategoryNode } from "@/lib/catalog/types";
import type { StoreSettings } from "@/lib/settings";
import { Wordmark } from "@/components/brand/Wordmark";
import { NewsletterForm } from "./NewsletterForm";

export function Footer({ categories, settings }: { categories: CategoryNode[]; settings: StoreSettings }) {
  const s = settings.store;
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
          <p className="mt-6 max-w-sm font-display text-2xl leading-snug text-white/90">Join the list for new arrivals, edits and early access.</p>
          <div className="mt-4">
            <NewsletterForm />
          </div>
        </div>
        <FooterCol title="Shop" links={[{ label: "Shop all", href: "/shop" }, ...categories.map((c) => ({ label: c.name, href: c.href }))]} />
        <FooterCol
          title="Help"
          links={[
            { label: "Contact us", href: "/contact" },
            { label: "Track your order", href: "/track-order" },
            { label: "FAQ", href: "/faq" },
            { label: "Shipping policy", href: "/shipping-policy" },
            { label: "Returns & refunds", href: "/returns-policy" },
          ]}
        />
        <div>
          <FooterCol
            title="Attitude"
            links={[
              { label: "About us", href: "/about" },
              { label: "My account", href: "/account" },
              { label: "Privacy policy", href: "/privacy-policy" },
              { label: "Terms & conditions", href: "/terms" },
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
          <p>© {new Date().getFullYear()} {s.name}. All rights reserved.</p>
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
          <p>Secure payments by Paystack</p>
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
