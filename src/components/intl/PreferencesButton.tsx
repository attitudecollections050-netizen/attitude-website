"use client";
import { useTranslations } from "next-intl";
import { OPEN_PREFS_EVENT } from "./PreferencesProvider";

/** Footer link that reopens the language / country / currency settings. */
export function PreferencesButton({ className }: { className?: string }) {
  const t = useTranslations("footer");
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(OPEN_PREFS_EVENT))}>
      {t("preferences")}
    </button>
  );
}
