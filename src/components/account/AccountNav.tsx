"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

const LINKS = [
  { href: "/account", label: "profile" },
  { href: "/account/orders", label: "orders" },
  { href: "/account/addresses", label: "addresses" },
] as const;

export function AccountNav() {
  const pathname = usePathname();
  const t = useTranslations("account");
  return (
    <nav aria-label={t("nav")} className="flex gap-1 overflow-x-auto lg:flex-col">
      {LINKS.map((l) => {
        const active = l.href === "/account" ? pathname === "/account" : pathname.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined} className={cn("whitespace-nowrap px-4 py-3 text-sm transition", active ? "bg-plum text-white" : "hover:bg-blush")}>
            {t(l.label)}
          </Link>
        );
      })}
      <form action={signOut}>
        <button type="submit" className="w-full whitespace-nowrap px-4 py-3 text-left text-sm text-muted hover:bg-blush hover:text-plum">
          {t("signOut")}
        </button>
      </form>
    </nav>
  );
}
