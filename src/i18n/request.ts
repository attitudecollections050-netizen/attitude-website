import { getRequestConfig } from "next-intl/server";
import { cache } from "react";
import { DEFAULT_LOCALE, type Locale } from "@/lib/intl/config";
import { getPreferences, isAdminArea } from "@/lib/intl/preferences";
import { loadMessages } from "@/lib/intl/messages";

export default getRequestConfig(async () => {
  const locale: Locale = (await isAdminArea()) ? DEFAULT_LOCALE : (await getPreferences()).locale;
  return {
    locale,
    messages: await loadMessages(locale),
    timeZone: "Africa/Lagos",
    // Any key still missing after the English fallback shows English-ish text, never a raw key.
    getMessageFallback: ({ key }) => key.split(".").pop()!.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()),
    onError: cachedWarn,
  };
});

const cachedWarn = cache((e: Error) => {
  if (process.env.NODE_ENV !== "production") console.warn("[i18n]", e.message);
});
