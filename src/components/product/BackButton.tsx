"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

// True once the visitor has moved between pages inside the site in this tab. Page changes
// inside the app don't update document.referrer, so this is how we know "back" stays on our site.
let movedWithinSite = false;

/** Mounted once in the store layout: notices page changes made inside the site. */
export function NavigationTracker() {
  const pathname = usePathname();
  useEffect(() => {
    const first = (window as unknown as { __acFirstPath?: string }).__acFirstPath;
    if (first === undefined) (window as unknown as { __acFirstPath?: string }).__acFirstPath = pathname;
    else if (first !== pathname) movedWithinSite = true;
  }, [pathname]);
  return null;
}

/**
 * "<" back button: returns to the previous page on this site (shop, home, search…),
 * or to the shop when the product was opened directly from a link.
 */
export function BackButton({ fallback = "/shop", anchor, className }: { fallback?: string; /** CSS selector of the photo it sits on. */ anchor?: string; className?: string }) {
  const router = useRouter();
  const t = useTranslations("product");
  // Fixed on screen: on the photo's top-left corner while the photo is in view, then just
  // under the site header, so it's always there however far down the page you scroll.
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const header = document.querySelector("header")?.getBoundingClientRect();
      const box = anchor ? document.querySelector(anchor)?.getBoundingClientRect() : null;
      const below = Math.max(header ? header.bottom : 0, 0) + 10;
      setPos({ top: Math.max(below, box ? box.top + 12 : below), left: Math.max(box ? box.left + 12 : 12, 8) });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const timer = setInterval(schedule, 500); // header height animates when it shrinks
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(timer);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [anchor]);
  // Rendered at the end of <body> so later page sections can never cover it.
  if (!pos) return null;
  return createPortal(
    <button
      type="button"
      onClick={() => {
        let sameSite = false;
        try {
          sameSite = Boolean(document.referrer) && new URL(document.referrer).origin === window.location.origin;
        } catch {}
        if ((movedWithinSite || sameSite) && window.history.length > 1) router.back();
        else router.push(fallback);
      }}
      aria-label={t("goBack")}
      title={t("goBack")}
      data-testid="back-button"
      style={{ top: pos.top, left: pos.left }}
      className={cn(
        "fixed z-40",
        "inline-flex h-11 min-w-11 items-center justify-center gap-1 rounded-full border border-line bg-white text-plum shadow-[0_10px_28px_-12px_rgba(37,25,35,0.7)] transition hover:bg-plum hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose active:scale-95 sm:pl-2.5 sm:pr-4",
        className,
      )}
    >
      <ChevronLeft className="size-6 -translate-x-px" strokeWidth={2.4} aria-hidden />
      <span className="hidden text-[11px] font-bold uppercase tracking-[0.16em] sm:inline">{t("goBack")}</span>
    </button>,
    document.body,
  );
}
