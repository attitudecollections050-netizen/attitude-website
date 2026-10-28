"use client";
import { useCallback } from "react";
import { useTranslations } from "next-intl";

/** Translates common colour names entered in the admin ("Red" → "Rouge"); others stay as written. */
export function useColorName() {
  const t = useTranslations("colors");
  return useCallback(
    (name: string) => {
      const key = name.trim().toLowerCase().replace(/[^a-z]+/g, "_").replace(/^_|_$/g, "");
      return key && t.has(key) ? t(key) : name;
    },
    [t],
  );
}
