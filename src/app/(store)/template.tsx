"use client";
import { m } from "motion/react";

/** Subtle page transition on every navigation (disabled for reduced motion). */
export default function StoreTemplate({ children }: { children: React.ReactNode }) {
  return (
    <m.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </m.div>
  );
}
