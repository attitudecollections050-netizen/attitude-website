"use client";
import { AnimatePresence, m } from "motion/react";
import { AlertTriangle } from "lucide-react";
import { BagIcon } from "@/components/brand/StoreIcons";
import { useCart } from "./CartProvider";

export function CartToast() {
  const { toast } = useCart();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[80] flex justify-center px-4" aria-live="polite">
      <AnimatePresence>
        {toast && (
          <m.div
            key={toast.id}
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10 }}
            className={`pointer-events-auto flex items-center gap-3 rounded-[1.4rem_0.5rem_1.4rem_0.5rem] px-5 py-3 text-sm shadow-lg ${toast.tone === "error" ? "bg-danger text-white" : "bg-plum text-white"}`}
            role={toast.tone === "error" ? "alert" : "status"}
          >
            {toast.tone === "error" ? <AlertTriangle className="size-4" /> : <BagIcon className="size-4 text-rose" />}
            {toast.text}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
