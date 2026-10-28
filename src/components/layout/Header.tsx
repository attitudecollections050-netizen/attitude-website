"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { ArrowRight } from "lucide-react";
import { BagIcon, HeartBadge, MenuIcon, SearchIcon } from "@/components/brand/StoreIcons";
import { ProfileMenu } from "./ProfileMenu";
import type { CategoryNode } from "@/lib/catalog/types";
import { Wordmark } from "@/components/brand/Wordmark";
import { useCart } from "@/components/cart/CartProvider";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { MobileMenu } from "./MobileMenu";
import { SearchOverlay } from "./SearchOverlay";
import { SmartImage } from "@/components/ui/SmartImage";
import { PreferencesSwitcher } from "@/components/intl/PreferencesSwitcher";

/** Petal-shaped icon button: corners swap on hover so the shape "turns" like a leaf. */
const ICON_BTN =
  "group relative grid size-10 place-items-center rounded-[1.15rem_0.45rem_1.15rem_0.45rem] text-plum sm:size-11 outline-offset-2 transition-[border-radius,background-color,color,transform,box-shadow] duration-300 ease-[var(--ease-luxe)] hover:-translate-y-0.5 hover:rounded-[0.45rem_1.15rem_0.45rem_1.15rem] hover:bg-gradient-to-br hover:from-blush hover:to-pale hover:text-rose-deep [&.is-open]:rounded-[0.45rem_1.15rem_0.45rem_1.15rem] [&.is-open]:bg-pale [&.is-open]:text-rose-deep";

export function Header({ categories, signedIn }: { categories: CategoryNode[]; signedIn: boolean }) {
  const { cart, setOpen } = useCart();
  const t = useTranslations("header");
  const tc = useTranslations("common");
  const pathname = usePathname();
  const [active, setActive] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Each time the bag count goes up, a little heart drops into the bag and the handle swings.
  const [drops, setDrops] = useState(0);
  const [lastCount, setLastCount] = useState(cart.itemCount);
  if (lastCount !== cart.itemCount) {
    if (cart.itemCount > lastCount) setDrops((d) => d + 1);
    setLastCount(cart.itemCount);
  }

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
              className={cn(ICON_BTN, "-ms-1.5 lg:hidden")}
              onClick={() => setMobileOpen(true)}
              aria-label={t("openMenu")}
              aria-expanded={mobileOpen}
            >
              <MenuIcon className="size-[1.35rem] rtl:-scale-x-100" />
            </button>
            <Link href="/" className="hidden lg:block" aria-label={tc("brandHome")}>
              <Wordmark inline />
            </Link>
          </div>

          <Link href="/" className="justify-self-center lg:hidden" aria-label={tc("brandHome")}>
            <Wordmark inline />
          </Link>

          <nav aria-label={t("mainNav")} className="hidden justify-self-center lg:block">
            <ul className="flex items-center gap-1 xl:gap-2">
              <li onMouseEnter={scheduleClose}>
                <NavLink href="/" active={pathname === "/"}>{tc("home")}</NavLink>
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
                    {cat.shortName ?? cat.name}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center justify-end gap-0.5 sm:gap-1.5">
            {/* Phones get the switcher inside the menu; the header only has room for it from md up. */}
            <span className="mr-1 hidden md:inline-flex 2xl:hidden"><PreferencesSwitcher compact /></span>
            <span className="mr-1 hidden 2xl:inline-flex"><PreferencesSwitcher /></span>
            <div className="flex items-center gap-0.5 sm:rounded-[1.5rem_0.7rem_1.5rem_0.7rem] sm:border sm:border-line/70 sm:bg-white/80 sm:p-1 sm:shadow-[0_10px_30px_-22px_rgba(37,25,35,0.6)] sm:backdrop-blur">
              <button type="button" className={ICON_BTN} onClick={() => setSearchOpen(true)} aria-label={t("search")}>
                <SearchIcon className="size-[1.2rem] transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110" />
              </button>
              <ProfileMenu signedIn={signedIn} buttonClassName={ICON_BTN} />
              <button
                type="button"
                data-bag-anchor
                className="group relative grid size-10 place-items-center rounded-[1.15rem_0.45rem_1.15rem_0.45rem] bg-plum sm:size-11 text-white shadow-[0_10px_22px_-10px_rgba(37,25,35,0.8)] transition-[border-radius,background-color,transform] duration-300 ease-[var(--ease-luxe)] hover:-translate-y-0.5 hover:rounded-[0.45rem_1.15rem_0.45rem_1.15rem] hover:bg-rose-deep"
                onClick={() => setOpen(true)}
                aria-label={t("bag", { count: cart.itemCount })}
              >
                <m.span
                  key={`bag-${drops}`}
                  className="grid place-items-center"
                  initial={drops ? { scaleY: 0.78, scaleX: 1.12 } : false}
                  animate={{ scaleY: 1, scaleX: 1 }}
                  transition={{ type: "spring", stiffness: 520, damping: 13, delay: 0.32 }}
                  style={{ originY: 1 }}
                >
                  <BagIcon swing={drops} className="size-[1.25rem]" />
                </m.span>
                <AnimatePresence>
                  {drops > 0 && (
                    <m.span
                      key={`drop-${drops}`}
                      className="pointer-events-none absolute left-1/2 top-0 -ml-1 size-2 rotate-45 rounded-[2px_50%_50%_50%] bg-rose"
                      initial={{ y: -16, opacity: 0, scale: 0.6 }}
                      animate={{ y: [-16, -2, 12], opacity: [0, 1, 0], scale: [0.6, 1, 0.5] }}
                      transition={{ duration: 0.55, ease: "easeIn" }}
                      aria-hidden
                    />
                  )}
                </AnimatePresence>
                <AnimatePresence>
                  {cart.itemCount > 0 && (
                    <m.span
                      key={cart.itemCount}
                      initial={{ scale: 0.3, rotate: -25, opacity: 0 }}
                      animate={{ scale: 1, rotate: 0, opacity: 1 }}
                      exit={{ scale: 0.3, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 520, damping: 18 }}
                      className="absolute -end-2 -top-2"
                    >
                      <HeartBadge count={cart.itemCount} />
                    </m.span>
                  )}
                </AnimatePresence>
              </button>
            </div>
            <Link
              href="/shop"
              className="group ml-2 hidden h-11 items-center gap-2 rounded-full bg-plum pl-5 pr-4 text-[0.8rem] font-semibold text-white shadow-[0_10px_25px_-12px_rgba(37,25,35,0.7)] transition hover:bg-rose-deep xl:inline-flex"
            >
              {t("shopCollection")}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </div>
        </div>

        <AnimatePresence>
          {activeCat && activeCat.children.length > 0 && (
            <m.div
              key="mega"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
              className="absolute inset-x-0 top-full hidden px-6 pt-3 lg:block"
              onMouseEnter={() => openMenu(activeCat.slug)}
            >
              {/* Floating petal-shaped card that unfolds from the top */}
              <m.div
                initial={{ clipPath: "inset(0% 0% 100% 0% round 2rem)", y: -14, rotateX: -12 }}
                animate={{ clipPath: "inset(0% 0% 0% 0% round 2rem)", y: 0, rotateX: 0 }}
                exit={{ clipPath: "inset(0% 0% 100% 0% round 2rem)", y: -8, transition: { duration: 0.25, ease: [0.64, 0, 0.78, 0] } }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                style={{ transformPerspective: 1200, transformOrigin: "top center" }}
                className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] rounded-tl-[5.5rem] rounded-br-[5.5rem] border border-pale bg-white shadow-[0_40px_80px_-40px_rgba(37,25,35,0.45)]"
              >
                <div className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-gradient-to-br from-pale to-transparent blur-2xl" aria-hidden />
              <div className="relative grid grid-cols-[1fr_1.1fr] gap-12 py-10 pl-16 pr-10">
                <div>
                  <p className="eyebrow text-muted">{activeCat.name}</p>
                  <ul className="mt-5 grid grid-cols-2 gap-x-10 gap-y-3">
                    <li>
                      <Link href={activeCat.href} className="inline-flex items-center gap-2 rounded-full rounded-tl-md bg-gradient-to-r from-rose-deep to-rose px-4 py-1.5 font-display text-xl text-white shadow-[0_10px_24px_-12px_rgba(217,79,145,0.9)] transition hover:brightness-110">
                        {tc("shopAll")} <ArrowRight className="size-4" aria-hidden />
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
                <Link href={activeCat.href} className="group relative block aspect-[16/8] overflow-hidden rounded-[1.5rem] rounded-tr-[4rem] bg-blush">
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
                    <span className="eyebrow">{t("explore")}</span>
                    <span className="mt-1 block font-display text-3xl">{activeCat.name}</span>
                  </span>
                </Link>
              </div>
              </m.div>
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
