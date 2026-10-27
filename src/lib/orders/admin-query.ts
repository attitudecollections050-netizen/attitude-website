import "server-only";
import { createClient } from "@/lib/supabase/server";

export const ORDER_PAGE_SIZE = 25;

export interface AdminOrderFilters {
  q: string;
  status: string;
  payment: string;
  conflict: boolean;
  page: number;
}

export function parseAdminOrderFilters(sp: Record<string, string | string[] | undefined>): AdminOrderFilters {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const page = Number(one(sp.page));
  return {
    q: one(sp.q).trim().slice(0, 100),
    status: one(sp.status),
    payment: one(sp.payment),
    conflict: one(sp.conflict) === "1",
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

/** Staff-only listing (RLS: is_staff()). */
export async function queryAdminOrders(f: AdminOrderFilters, opts: { limit?: number; offset?: number; select?: string } = {}) {
  const db = await createClient();
  let q = db
    .from("orders")
    .select(opts.select ?? "id, order_number, customer_name, email, phone, total, currency, status, payment_status, inventory_conflict, created_at, shipping_method_name, shipping_address", { count: "exact" })
    .order("created_at", { ascending: false });
  if (f.status === "to_fulfil") q = q.eq("payment_status", "paid").in("status", ["paid", "processing", "awaiting_supplier", "ordered_from_supplier"]);
  else if (f.status) q = q.eq("status", f.status);
  if (f.payment) q = q.eq("payment_status", f.payment);
  if (f.conflict) q = q.eq("inventory_conflict", true);
  if (f.q) {
    const term = f.q.replace(/[,%()*]/g, " ").trim();
    if (term) q = q.or(`order_number.ilike.%${term}%,email.ilike.%${term}%,customer_name.ilike.%${term}%,phone.ilike.%${term}%`);
  }
  const limit = opts.limit ?? ORDER_PAGE_SIZE;
  const offset = opts.offset ?? (f.page - 1) * limit;
  return q.range(offset, offset + limit - 1);
}
