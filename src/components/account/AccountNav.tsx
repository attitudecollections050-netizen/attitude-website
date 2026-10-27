"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { cn } from "@/lib/cn";

const LINKS = [
  { href: "/account", label: "Profile" },
  { href: "/account/orders", label: "Orders" },
  { href: "/account/addresses", label: "Addresses" },
];

export function AccountNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Account" className="flex gap-1 overflow-x-auto lg:flex-col">
      {LINKS.map((l) => {
        const active = l.href === "/account" ? pathname === "/account" : pathname.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined} className={cn("whitespace-nowrap px-4 py-3 text-sm transition", active ? "bg-plum text-white" : "hover:bg-blush")}>
            {l.label}
          </Link>
        );
      })}
      <form action={signOut}>
        <button type="submit" className="w-full whitespace-nowrap px-4 py-3 text-left text-sm text-muted hover:bg-blush hover:text-plum">
          Sign out
        </button>
      </form>
    </nav>
  );
}
