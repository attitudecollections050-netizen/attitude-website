"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { ChevronDown, X } from "lucide-react";
import type { CategoryNode } from "@/lib/catalog/types";
import { Wordmark } from "@/components/brand/Wordmark";
import { useDialog } from "@/components/ui/useDialog";
import { cn } from "@/lib/cn";

export function MobileMenu({ open, onClose, categories, signedIn }: { open: boolean; onClose: () => void; categories: CategoryNode[]; signedIn: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  useDialog(open, onClose, ref);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <m.div className="absolute inset-0 bg-plum/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} aria-hidden />
          <m.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            tabIndex={-1}
            className="absolute inset-y-0 left-0 flex w-[88%] max-w-sm flex-col bg-white outline-none"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <Wordmark compact />
              <button type="button" onClick={onClose} className="-m-2 p-2" aria-label="Close menu">
                <X className="size-5" />
              </button>
            </div>
            <nav aria-label="Mobile" className="flex-1 overflow-y-auto px-5 py-4">
              <ul className="divide-y divide-line">
                <li>
                  <Link href="/shop" className="block py-4 font-display text-2xl">
                    Shop all
                  </Link>
                </li>
                {categories.map((cat, i) => (
                  <m.li key={cat.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 + i * 0.04 }}>
                    <div className="flex items-center justify-between">
                      <Link href={cat.href} className="block flex-1 py-4 font-display text-2xl">
                        {cat.name}
                      </Link>
                      {cat.children.length > 0 && (
                        <button
                          type="button"
                          className="p-3"
                          aria-label={`Show ${cat.name} categories`}
                          aria-expanded={expanded === cat.slug}
                          onClick={() => setExpanded(expanded === cat.slug ? null : cat.slug)}
                        >
                          <ChevronDown className={cn("size-4 transition-transform duration-300", expanded === cat.slug && "rotate-180")} />
                        </button>
                      )}
                    </div>
                    <AnimatePresence initial={false}>
                      {expanded === cat.slug && (
                        <m.ul
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="overflow-hidden pb-3 pl-1"
                        >
                          {cat.children.map((c) => (
                            <li key={c.id}>
                              <Link href={c.href} className="block py-2 text-sm text-plum-soft hover:text-rose-deep">
                                {c.name}
                              </Link>
                            </li>
                          ))}
                        </m.ul>
                      )}
                    </AnimatePresence>
                  </m.li>
                ))}
              </ul>
            </nav>
            <div className="grid gap-3 border-t border-line bg-neutral px-5 py-5 text-sm">
              <Link href={signedIn ? "/account" : "/account/login"} className="font-semibold">
                {signedIn ? "My account" : "Sign in / Register"}
              </Link>
              <Link href="/track-order">Track an order</Link>
              <Link href="/contact">Contact us</Link>
            </div>
          </m.div>
        </div>
      )}
    </AnimatePresence>
  );
}
