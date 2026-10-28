"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { signOut } from "@/app/actions/auth";
import { ProfileIcon } from "@/components/brand/StoreIcons";
import { cn } from "@/lib/cn";

/** Header profile button with a small petal-shaped dropdown of account links. */
export function ProfileMenu({ signedIn, buttonClassName }: { signedIn: boolean; buttonClassName: string }) {
  const t = useTranslations("header");
  const ta = useTranslations("account");
  const tm = useTranslations("menu");
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const id = useId();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    wrap.current?.querySelector<HTMLElement>("[data-first]")?.focus();
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const links = signedIn
    ? [
        { href: "/account", label: t("account") },
        { href: "/account/orders", label: ta("orders") },
        { href: "/account/addresses", label: ta("addresses") },
        { href: "/track-order", label: tm("track") },
      ]
    : [
        { href: "/account/login", label: t("signIn") },
        { href: "/account/register", label: ta("createAccount") },
        { href: "/track-order", label: tm("track") },
      ];

  return (
    <div ref={wrap} className="relative hidden sm:block" onBlur={(e) => !wrap.current?.contains(e.relatedTarget as Node) && setOpen(false)}>
      <button
        ref={button}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={`${id}-menu`}
        aria-label={signedIn ? t("account") : t("signIn")}
        className={cn(buttonClassName, open && "is-open")}
      >
        <ProfileIcon active={signedIn} className="size-[1.2rem]" />
      </button>
      <AnimatePresence>
        {open && (
          <m.div
            id={`${id}-menu`}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, y: -10, rotate: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0, rotate: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.75, y: -6, transition: { duration: 0.16 } }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
            style={{ transformOrigin: "top" }}
            className="absolute end-0 top-[calc(100%+0.7rem)] z-[60] w-60 rounded-[1.6rem] rounded-se-[0.5rem] border border-pale bg-white p-2 shadow-[0_28px_60px_-24px_rgba(37,25,35,0.45)]"
          >
            <span className="absolute -top-1.5 end-4 size-3 rotate-45 rounded-[2px] border-l border-t border-pale bg-white" aria-hidden />
            <div className="flex items-center gap-3 rounded-[1.2rem] rounded-tr-[0.35rem] bg-gradient-to-br from-blush to-pale px-3 py-3">
              <span className="grid size-9 place-items-center rounded-[0.9rem_0.35rem] bg-white text-rose-deep shadow-sm"><ProfileIcon active={signedIn} className="size-[1.1rem]" /></span>
              <p className="text-sm font-semibold">{signedIn ? ta("welcomeBack") : ta("joinUs")}</p>
            </div>
            <ul className="mt-1.5 space-y-0.5">
              {links.map((l, i) => (
                <m.li key={l.href} initial={reduce ? false : { opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 + i * 0.04 }}>
                  <Link
                    href={l.href}
                    data-first={i === 0 ? "" : undefined}
                    className="group flex items-center justify-between rounded-[1rem] rounded-tr-[0.35rem] px-3 py-2.5 text-sm transition hover:bg-blush hover:text-rose-deep focus-visible:bg-blush"
                  >
                    {l.label}
                    <ArrowUpRight className="size-3.5 -translate-x-1 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" aria-hidden />
                  </Link>
                </m.li>
              ))}
            </ul>
            {signedIn && (
              <form action={signOut} className="mt-1 border-t border-line pt-1">
                <button type="submit" className="w-full rounded-[1rem] px-3 py-2.5 text-left text-sm text-muted transition hover:bg-blush hover:text-plum rtl:text-right">
                  {ta("signOut")}
                </button>
              </form>
            )}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
