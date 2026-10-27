"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { ArrowRight, Menu, Search, ShoppingBag, User } from "lucide-react";
import type { CategoryNode } from "@/lib/catalog/types";
import { Wordmark } from "@/components/brand/Wordmark";
import { useCart } from "@/components/cart/CartProvider";
import { cn } from "@/lib/cn";
import { MobileMenu } from "./MobileMenu";
import { SearchOverlay } from "./SearchOverlay";
import { SmartImage } from "@/components/ui/SmartImage";

export function Header({ categories, signedIn }: { categories: CategoryNode[]; signedIn: boolean }) {
  const { cart, setOpen } = useCart();
  const pathname = usePathname();
  const [active, setActive] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close menus on navigation (render-time reset avoids an extra effect pass).
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setActive(null);
    setMobileOpen(false);
    setSearchOpen(false);
  }

  const openMenu = (slug: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setActive(slug);
  };
  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setActive(null), 140);
  };

  const activeCat = categories.find((c) => c.slug === active) ?? null;

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-50 border-b transition-[background-color,box-shadow,border-color] duration-300",
          scrolled || activeCat ? "border-line bg-white/95 shadow-[0_8px_30px_-20px_rgba(37,25,35,0.35)] backdrop-blur" : "border-transparent bg-white",
        )}
        onMouseLeave={scheduleClose}
        onKeyDown={(e) => e.key === "Escape" && setActive(null)}
      >
        <div className={cn("container-luxe grid grid-cols-[1fr_auto_1fr] items-center gap-4 transition-[height] duration-300 lg:grid-cols-[auto_1fr_auto]", scrolled ? "h-16" : "h-[4.5rem] lg:h-20")}>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="-ml-2 grid size-10 place-items-center rounded-full transition hover:bg-blush lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              aria-expanded={mobileOpen}
            >
              <Menu className="size-5" />
            </button>
            <Link href="/" className="hidden lg:block" aria-label="Attitude Collections — home">
              <Wordmark inline />
            </Link>
          </div>

          <Link href="/" className="justify-self-center lg:hidden" aria-label="Attitude Collections — home">
            <Wordmark inline />
          </Link>

          <nav aria-label="Main" className="hidden justify-self-center lg:block">
            <ul className="flex items-center gap-1 xl:gap-2">
              <li onMouseEnter={scheduleClose}>
                <NavLink href="/" active={pathname === "/"}>Home</NavLink>
              </li>
              {categories.map((cat) => (
                <li key={cat.id} onMouseEnter={() => openMenu(cat.slug)}>
                  <NavLink
                    href={cat.href}
                    active={active === cat.slug || pathname.startsWith(cat.href)}
                    hasMenu={cat.children.length > 0}
                    expanded={active === cat.slug}
                    onFocus={() => openMenu(cat.slug)}
                  >
                    {cat.name.replace("Clothing", "").trim()}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center justify-end gap-0.5 sm:gap-1.5">
            <button type="button" className="grid size-10 place-items-center rounded-full transition hover:bg-blush" onClick={() => setSearchOpen(true)} aria-label="Search products">
              <Search className="size-[1.15rem]" />
            </button>
            <Link href={signedIn ? "/account" : "/account/login"} className="hidden size-10 place-items-center rounded-full transition hover:bg-blush sm:grid" aria-label={signedIn ? "My account" : "Sign in"}>
              <User className="size-[1.15rem]" />
            </Link>
            <button
              type="button"
              className="relative grid size-10 place-items-center rounded-full transition hover:bg-blush"
              onClick={() => setOpen(true)}
              aria-label={`Shopping bag, ${cart.itemCount} item${cart.itemCount === 1 ? "" : "s"}`}
            >
              <ShoppingBag className="size-[1.15rem]" />
              <AnimatePresence>
                {cart.itemCount > 0 && (
                  <m.span
                    key={cart.itemCount}
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.4, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                    className="absolute right-0.5 top-0.5 grid min-w-[1.1rem] place-items-center rounded-full bg-plum px-1 text-[0.6rem] font-bold leading-[1.1rem] text-white ring-2 ring-white"
                  >
                    {cart.itemCount > 99 ? "99+" : cart.itemCount}
                  </m.span>
                )}
              </AnimatePresence>
            </button>
            <Link
              href="/shop"
              className="group ml-2 hidden h-11 items-center gap-2 rounded-full bg-plum pl-5 pr-4 text-[0.8rem] font-semibold text-white shadow-[0_10px_25px_-12px_rgba(37,25,35,0.7)] transition hover:bg-rose-deep xl:inline-flex"
            >
              Shop the collection
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </div>
        </div>

        <AnimatePresence>
          {activeCat && activeCat.children.length > 0 && (
            <m.div
              key="mega"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6, transition: { duration: 0.18 } }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-x-0 top-full hidden border-b border-line bg-white lg:block"
              onMouseEnter={() => openMenu(activeCat.slug)}
            >
              <div className="container-luxe grid grid-cols-[1fr_1.1fr] gap-12 py-10">
                <div>
                  <p className="eyebrow text-muted">{activeCat.name}</p>
                  <ul className="mt-5 grid grid-cols-2 gap-x-10 gap-y-3">
                    <li>
                      <Link href={activeCat.href} className="font-display text-xl hover:text-rose-deep">
                        Shop all
                      </Link>
                    </li>
                    {activeCat.children.map((child, i) => (
                      <m.li key={child.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.02 * i }}>
                        <Link href={child.href} className="font-display text-xl transition-colors hover:text-rose-deep">
                          {child.name}
                        </Link>
                      </m.li>
                    ))}
                  </ul>
                </div>
                <Link href={activeCat.href} className="group relative block aspect-[16/8] overflow-hidden bg-blush">
                  <SmartImage
                    src={activeCat.image_url}
                    alt={activeCat.name}
                    fill
                    sizes="40vw"
                    className="object-cover transition-transform duration-[1.2s] ease-[var(--ease-luxe)] group-hover:scale-105"
                    fallbackLabel={activeCat.name}
                  />
                  <span className="absolute inset-0 bg-gradient-to-t from-plum/60 to-transparent" />
                  <span className="absolute bottom-6 left-6 text-white">
                    <span className="eyebrow">Explore</span>
                    <span className="mt-1 block font-display text-3xl">{activeCat.name}</span>
                  </span>
                </Link>
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </header>

      <MobileMenu open={mobileOpen} onClose={() => setMobileOpen(false)} categories={categories} signedIn={signedIn} />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}

function NavLink({
  href,
  active,
  hasMenu,
  expanded,
  onFocus,
  children,
}: {
  href: string;
  active: boolean;
  hasMenu?: boolean;
  expanded?: boolean;
  onFocus?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onFocus={onFocus}
      aria-haspopup={hasMenu ? "true" : undefined}
      aria-expanded={hasMenu ? expanded : undefined}
      aria-current={active && href === "/" ? "page" : undefined}
      className={cn("relative block px-3 py-3 text-[0.86rem] transition-colors", active ? "font-semibold text-plum" : "text-plum-soft hover:text-plum")}
    >
      {children}
      <span className={cn("absolute inset-x-3 bottom-1 h-[2px] origin-center rounded-full bg-plum transition-transform duration-300", active ? "scale-x-100" : "scale-x-0")} />
    </Link>
  );
}
