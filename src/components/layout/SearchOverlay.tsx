"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { Search, X } from "lucide-react";
import Link from "next/link";
import { useDialog } from "@/components/ui/useDialog";

const SUGGESTIONS = ["Dresses", "Sneakers", "Handbags", "Heels", "Hoodies", "Matching sets"];

export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  useDialog(open, onClose, ref);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70]">
          <m.div className="absolute inset-0 bg-plum/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} aria-hidden />
          <m.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label="Search"
            tabIndex={-1}
            className="absolute inset-x-0 top-0 bg-white outline-none"
            initial={{ y: "-100%" }}
            animate={{ y: 0 }}
            exit={{ y: "-100%" }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="container-luxe py-8 sm:py-12">
              <form
                role="search"
                onSubmit={(e) => {
                  e.preventDefault();
                  const term = q.trim();
                  if (term) router.push(`/search?q=${encodeURIComponent(term)}`);
                }}
                className="flex items-center gap-4 border-b-2 border-plum pb-3"
              >
                <Search className="size-6 shrink-0 text-muted" aria-hidden />
                <label htmlFor="site-search" className="sr-only">
                  Search products
                </label>
                <input
                  id="site-search"
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search for dresses, sneakers, bags…"
                  className="min-w-0 flex-1 bg-transparent font-display text-2xl outline-none placeholder:text-muted/60 sm:text-4xl"
                  maxLength={100}
                  enterKeyHint="search"
                />
                <button type="button" onClick={onClose} className="p-2" aria-label="Close search">
                  <X className="size-5" />
                </button>
              </form>
              <div className="mt-6 flex flex-wrap items-center gap-2">
                <span className="eyebrow mr-2 text-muted">Try searching</span>
                {SUGGESTIONS.map((s) => (
                  <Link key={s} href={`/search?q=${encodeURIComponent(s)}`} className="rounded-full border border-line px-4 py-1.5 text-sm transition hover:border-rose hover:text-rose-deep">
                    {s}
                  </Link>
                ))}
              </div>
            </div>
          </m.div>
        </div>
      )}
    </AnimatePresence>
  );
}
