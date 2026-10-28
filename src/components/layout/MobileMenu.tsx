"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { AnimatePresence, m, useReducedMotion, type Variants } from "motion/react";
import { ArrowUpRight, ChevronDown, Sparkles } from "lucide-react";
import { CloseIcon } from "@/components/brand/StoreIcons";
import type { CategoryNode } from "@/lib/catalog/types";
import { Wordmark } from "@/components/brand/Wordmark";
import { useDialog } from "@/components/ui/useDialog";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { PreferencesSwitcher } from "@/components/intl/PreferencesSwitcher";

// The panel "blooms" open from the menu button (top-left) as a growing circle,
// inside a petal shape: soft corners with a long sweeping curve on the right.
const PETAL = "rounded-[2rem] rounded-tr-[7rem] rounded-br-[3.5rem]";
const ORIGIN = "2.25rem 2.25rem";

const list: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.055, delayChildren: 0.18 } },
};
const item: Variants = {
  hidden: { opacity: 0, x: -24, y: 10, filter: "blur(6px)" },
  show: { opacity: 1, x: 0, y: 0, filter: "blur(0px)", transition: { type: "spring", stiffness: 260, damping: 24 } },
};

export function MobileMenu({ open, onClose, categories, signedIn }: { open: boolean; onClose: () => void; categories: CategoryNode[]; signedIn: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const t = useTranslations("menu");
  const tc = useTranslations("common");
  const [expanded, setExpanded] = useState<string | null>(null);
  useDialog(open, onClose, ref);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <m.div className="absolute inset-0 bg-plum/45 backdrop-blur-[3px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} aria-hidden />
          <m.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label={t("label")}
            tabIndex={-1}
            className={cn(
              "absolute bottom-3 left-3 top-3 flex w-[86%] max-w-sm flex-col overflow-hidden bg-white shadow-[0_40px_90px_-30px_rgba(37,25,35,0.6)] outline-none",
              PETAL,
            )}
            initial={reduce ? { opacity: 0 } : { clipPath: `circle(0% at ${ORIGIN})`, rotate: -4, scale: 0.94 }}
            animate={reduce ? { opacity: 1 } : { clipPath: `circle(160% at ${ORIGIN})`, rotate: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { clipPath: `circle(0% at ${ORIGIN})`, rotate: -3, scale: 0.96, transition: { duration: 0.42, ease: [0.64, 0, 0.78, 0] } }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: "top left" }}
          >
            {/* soft pink glow and drifting orb inside the petal */}
            <div className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-gradient-to-br from-pale via-blush to-transparent blur-2xl" aria-hidden />
            <m.div
              className="pointer-events-none absolute -bottom-10 -left-10 size-40 rounded-full bg-rose/15 blur-2xl"
              animate={reduce ? undefined : { x: [0, 20, 0], y: [0, -16, 0] }}
              transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
              aria-hidden
            />

            <div className="relative flex items-center justify-between px-6 pb-3 pt-5">
              <Wordmark compact />
              <m.button
                type="button"
                onClick={onClose}
                className="grid size-10 place-items-center rounded-full bg-plum text-white shadow-md"
                aria-label={t("closeMenu")}
                initial={reduce ? undefined : { rotate: -90, scale: 0.5 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ delay: 0.25, type: "spring", stiffness: 300, damping: 18 }}
                whileTap={{ scale: 0.9 }}
              >
                <CloseIcon className="size-5" />
              </m.button>
            </div>

            <div className="relative px-6 pb-3">
              <PreferencesSwitcher className="bg-white/80" />
            </div>
            <nav aria-label={t("mobileNav")} className="relative flex-1 overflow-y-auto px-5 pb-4">
              <m.ul variants={list} initial="hidden" animate="show" className="space-y-1.5">
                <m.li variants={item} className="pb-2 pt-1">
                  <Link
                    href="/shop"
                    onClick={onClose}
                    className="group flex items-center justify-between rounded-full rounded-tl-lg bg-gradient-to-r from-rose-deep via-rose to-[#F283B8] py-3.5 pl-6 pr-3 text-white shadow-[0_14px_30px_-14px_rgba(217,79,145,0.9)]"
                  >
                    <span className="flex items-center gap-2 font-display text-[1.7rem] leading-none">
                      <Sparkles className="size-4" aria-hidden /> {tc("shopAll")}
                    </span>
                    <span className="grid size-9 place-items-center rounded-full bg-white/20 transition-transform duration-300 group-hover:rotate-45">
                      <ArrowUpRight className="size-4" aria-hidden />
                    </span>
                  </Link>
                </m.li>
                {categories.map((cat, i) => (
                  <m.li key={cat.id} variants={item}>
                    <div className={cn("flex items-center rounded-[1.4rem] rounded-tr-[2.4rem] transition-colors", expanded === cat.slug ? "bg-blush" : "hover:bg-blush/70")}>
                      <Link href={cat.href} onClick={onClose} className="flex flex-1 items-baseline gap-3 py-3 pl-4">
                        <span className="w-5 text-[0.6rem] font-bold tabular-nums text-rose-deep" aria-hidden>{String(i + 1).padStart(2, "0")}</span>
                        <span className="font-display text-2xl">{cat.name}</span>
                      </Link>
                      {cat.children.length > 0 && (
                        <button
                          type="button"
                          className="mr-1.5 grid size-10 place-items-center rounded-full transition hover:bg-white"
                          aria-label={t("showSub", { name: cat.name })}
                          aria-expanded={expanded === cat.slug}
                          onClick={() => setExpanded(expanded === cat.slug ? null : cat.slug)}
                        >
                          <ChevronDown className={cn("size-4 transition-transform duration-300", expanded === cat.slug && "rotate-180 text-rose-deep")} />
                        </button>
                      )}
                    </div>
                    <AnimatePresence initial={false}>
                      {expanded === cat.slug && (
                        <m.ul
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                          className="ml-9 overflow-hidden border-l-2 border-pale"
                        >
                          {cat.children.map((c, j) => (
                            <m.li key={c.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.03 * j }}>
                              <Link href={c.href} onClick={onClose} className="block py-2 pl-4 text-sm text-plum-soft transition-colors hover:text-rose-deep">
                                {c.name}
                              </Link>
                            </m.li>
                          ))}
                        </m.ul>
                      )}
                    </AnimatePresence>
                  </m.li>
                ))}
              </m.ul>
            </nav>

            <m.div
              className="relative mx-3 mb-3 grid grid-cols-3 gap-2 rounded-[1.6rem] rounded-br-[2.8rem] bg-plum p-2 text-center text-[0.7rem] font-semibold text-white"
              initial={reduce ? undefined : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              {[
                { href: signedIn ? "/account" : "/account/login", label: signedIn ? t("account") : t("signIn") },
                { href: "/track-order", label: t("track") },
                { href: "/contact", label: t("contact") },
              ].map((l) => (
                <Link key={l.href} href={l.href} onClick={onClose} className="rounded-full px-2 py-2.5 transition hover:bg-white/10">
                  {l.label}
                </Link>
              ))}
            </m.div>
          </m.div>
        </div>
      )}
    </AnimatePresence>
  );
}
