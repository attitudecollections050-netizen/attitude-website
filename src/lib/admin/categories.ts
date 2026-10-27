import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CategoryOption } from "@/components/admin/ProductForm";

export async function categoryOptions(): Promise<CategoryOption[]> {
  const db = await createClient();
  const { data } = await db.from("categories").select("id, name, parent_id, sort_order").order("sort_order");
  const rows = data ?? [];
  const byId = new Map(rows.map((r) => [r.id, r]));
  return rows
    .filter((r) => r.parent_id)
    .map((r) => ({ id: r.id, name: r.name, parent: byId.get(r.parent_id!)?.name ?? null }))
    .concat(rows.filter((r) => !r.parent_id).map((r) => ({ id: r.id, name: `${r.name} (general)`, parent: "Top level" })));
}
