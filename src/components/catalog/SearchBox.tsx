"use client";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";

export function SearchBox({ initial }: { initial: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  const t = useTranslations("search");
  return (
    <form
      role="search"
      className="flex max-w-xl items-center gap-3 border-b border-plum pb-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
      }}
    >
      <Search className="size-4 text-muted" aria-hidden />
      <label htmlFor="search-page-input" className="sr-only">
        {t("inputLabel")}
      </label>
      <input id="search-page-input" value={q} onChange={(e) => setQ(e.target.value)} maxLength={100} placeholder={t("inputLabel")} className="flex-1 bg-transparent py-2 outline-none" />
      <button type="submit" className="eyebrow hover:text-rose-deep">
        {t("submit")}
      </button>
    </form>
  );
}
