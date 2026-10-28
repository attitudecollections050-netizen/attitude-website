"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { LayoutDashboard, Package, ShoppingBag, Layers, Truck, Tag, Home, Settings, Boxes, Mail, Menu, X, Store, LogOut, FileText, CreditCard, Users, BarChart3, Heart } from "lucide-react";
import { Wordmark } from "@/components/brand/Wordmark";
import { signOut } from "@/app/actions/auth";
import { cn } from "@/lib/cn";

const ITEMS = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, perm: "orders:read" },
  { href: "/admin/products", label: "Products", icon: Package, perm: "catalog:write" },
  { href: "/admin/categories", label: "Categories", icon: Layers, perm: "catalog:write" },
  { href: "/admin/collections", label: "Collections", icon: Boxes, perm: "catalog:write" },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag, perm: "orders:read" },
  { href: "/admin/payments", label: "Payments", icon: CreditCard, perm: "orders:read" },
  { href: "/admin/customers", label: "Customers", icon: Users, perm: "customers:read" },
  { href: "/admin/analytics", label: "Analytics & Reports", icon: BarChart3, perm: "reports:read" },
  { href: "/admin/feedback", label: "Customer Reviews & Feedback", icon: Heart, perm: "feedback:manage" },
  { href: "/admin/shipping", label: "Shipping Management", icon: Truck, perm: "shipping:write" },
  { href: "/admin/suppliers", label: "Dropshipping & Fulfilment", icon: Store, perm: "suppliers:write" },
  { href: "/admin/discounts", label: "Discounts", icon: Tag, perm: "discounts:write" },
  { href: "/admin/homepage", label: "Homepage", icon: Home, perm: "settings:write" },
  { href: "/admin/content", label: "Pages & policies", icon: FileText, perm: "settings:write" },
  { href: "/admin/messages", label: "Messages", icon: Mail, perm: "messages:read" },
  { href: "/admin/settings", label: "Store Settings", icon: Settings, perm: "settings:write" },
] as const;

export function AdminNav({ permissions, email }: { permissions: string[]; email: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = ITEMS.filter((i) => permissions.includes(i.perm));
  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  const list = (
    <nav aria-label="Admin" className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3">
      {items.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={() => setOpen(false)}
          aria-current={isActive(href) ? "page" : undefined}
          className={cn("flex items-center gap-3 rounded-[3px] px-3 py-2 text-sm transition", isActive(href) ? "bg-white/10 text-white" : "text-white/65 hover:bg-white/5 hover:text-white")}
        >
          <Icon className={cn("size-4 shrink-0", isActive(href) && "text-rose")} aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  );
  const footer = (
    <div className="border-t border-white/10 px-6 py-5 text-xs text-white/60">
      <p className="truncate">{email}</p>
      <div className="mt-3 flex items-center justify-between">
        <Link href="/" className="hover:text-white">View store ↗</Link>
        <form action={signOut}>
          <button className="flex items-center gap-1.5 hover:text-white"><LogOut className="size-3.5" /> Sign out</button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-plum lg:flex">
        <div className="px-6 py-6"><Wordmark tone="light" /></div>
        {list}
        {footer}
      </aside>
      <div className="sticky top-0 z-40 flex items-center justify-between bg-plum px-4 py-3 lg:hidden">
        <Wordmark tone="light" compact />
        <button type="button" onClick={() => setOpen(true)} className="p-2 text-white" aria-label="Open admin menu"><Menu className="size-5" /></button>
      </div>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <m.div className="absolute inset-0 bg-black/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
            <m.aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-plum py-4" initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ duration: 0.35 }}>
              <div className="flex items-center justify-between px-6 pb-5">
                <Wordmark tone="light" compact />
                <button type="button" onClick={() => setOpen(false)} className="p-2 text-white" aria-label="Close admin menu"><X className="size-5" /></button>
              </div>
              {list}
              {footer}
            </m.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
