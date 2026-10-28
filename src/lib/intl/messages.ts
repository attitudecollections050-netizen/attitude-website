import "server-only";
import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import { DEFAULT_LOCALE, type Locale } from "./config";
import en from "@/messages/en.json";

export type Messages = typeof en;
type Tree = { [k: string]: string | Tree };

const loaders: Record<Locale, () => Promise<{ default: unknown }>> = {
  en: () => import("@/messages/en.json"),
  fr: () => import("@/messages/fr.json"),
  es: () => import("@/messages/es.json"),
  pt: () => import("@/messages/pt.json"),
  ar: () => import("@/messages/ar.json"),
  de: () => import("@/messages/de.json"),
  zh: () => import("@/messages/zh.json"),
};

/** Deep-merges b onto a (b wins) for keys English has, ignoring empty strings so English shows instead of blanks. */
export function mergeMessages(a: Tree, b: Tree): Tree {
  const out: Tree = { ...a };
  for (const [k, v] of Object.entries(b ?? {})) {
    if (typeof v === "string") {
      if (v.trim() && typeof a[k] === "string") out[k] = v;
    } else if (v && typeof v === "object" && typeof a[k] === "object") {
      out[k] = mergeMessages(a[k] as Tree, v);
    }
  }
  return out;
}

/** Sets "a.b.c" in a tree, only for keys that exist in English (overrides can't create junk keys). */
export function applyOverride(tree: Tree, key: string, value: string): void {
  const parts = key.split(".");
  let node: Tree = tree;
  for (let i = 0; i < parts.length - 1; i++) {
    const next = node[parts[i]];
    if (!next || typeof next !== "object") return;
    node = next;
  }
  const last = parts[parts.length - 1];
  if (typeof node[last] === "string" && value.trim()) node[last] = value;
}

/** English, then the bundled translation, then admin overrides from the database. */
export const loadMessages = cache(async (locale: Locale): Promise<Messages> => {
  let messages = structuredClone(en) as unknown as Tree;
  if (locale !== DEFAULT_LOCALE) {
    const mod = await loaders[locale]?.().catch(() => null);
    if (mod) messages = mergeMessages(messages, mod.default as Tree);
  }
  if (isSupabaseConfigured()) {
    try {
      const { data } = await createPublicClient().from("translation_overrides").select("key, value").eq("locale", locale);
      for (const row of data ?? []) applyOverride(messages, row.key, row.value);
    } catch (e) {
      console.error("[i18n] overrides:", (e as Error).message);
    }
  }
  return messages as unknown as Messages;
});
