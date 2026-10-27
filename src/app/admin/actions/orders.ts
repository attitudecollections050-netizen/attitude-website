"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { bool, dbError, guarded, optMoney, optStr, uuid } from "./helpers";
import type { AdminResult } from "./types";

const STATUSES = ["pending_payment", "paid", "processing", "awaiting_supplier", "ordered_from_supplier", "shipped", "in_transit", "delivered", "cancelled", "refunded"] as const;

export async function updateOrderStatus(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("orders:update", async ({ db }) => {
    const input = z
      .object({ order_id: uuid, status: z.enum(STATUSES), public_note: optStr(500), restock: bool })
      .parse(Object.fromEntries(formData));
    const { error } = await db.rpc("admin_update_order_status", {
      p_order_id: input.order_id,
      p_status: input.status,
      p_public_note: input.public_note,
      p_restock: input.restock,
    });
    if (error) {
      if (error.message.includes("invalid_transition")) return { ok: false, message: "That status change isn't allowed from the current status." };
      return dbError(error);
    }
    revalidatePath(`/admin/orders/${input.order_id}`);
    revalidatePath("/admin/orders");
    return { ok: true, message: "Status updated." };
  });
}

export async function saveFulfilment(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("orders:update", async ({ db }) => {
    const input = z
      .object({
        order_id: uuid,
        supplier_id: z.union([uuid, z.literal("")]).transform((v) => v || null),
        supplier_order_ref: optStr(120),
        supplier_cost_total: optMoney,
        status: z.enum(["not_started", "awaiting_supplier", "ordered_from_supplier", "shipped", "delivered", "cancelled"]),
        dispatched_at: z.union([z.literal(""), z.string().date()]).transform((v) => (v ? new Date(v).toISOString() : null)),
        internal_notes: optStr(5000),
      })
      .parse(Object.fromEntries(formData));
    const { order_id, ...row } = input;
    const { error } = await db.from("fulfilments").upsert({ order_id, ...row }, { onConflict: "order_id" });
    if (error) return dbError(error);
    revalidatePath(`/admin/orders/${order_id}`);
    return { ok: true, message: "Fulfilment record saved (internal only)." };
  });
}

export async function addTracking(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("orders:update", async ({ db }) => {
    const input = z
      .object({
        order_id: uuid,
        carrier: optStr(80),
        tracking_number: optStr(120),
        tracking_url: z.union([z.literal(""), z.string().trim().url().regex(/^https?:\/\//)]).transform((v) => v || null),
        dispatched_at: z.union([z.literal(""), z.string().date()]).transform((v) => (v ? new Date(v).toISOString() : null)),
      })
      .parse(Object.fromEntries(formData));
    if (!input.tracking_number && !input.tracking_url) return { ok: false, message: "Enter a tracking number or URL." };
    const { error } = await db.from("shipment_tracking").insert(input);
    if (error) return dbError(error);
    revalidatePath(`/admin/orders/${input.order_id}`);
    return { ok: true, message: "Tracking added — the customer can now see it." };
  });
}

export async function removeTracking(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  return guarded("orders:update", async ({ db }) => {
    const id = uuid.parse(formData.get("id"));
    const orderId = uuid.parse(formData.get("order_id"));
    const { error } = await db.from("shipment_tracking").delete().eq("id", id).eq("order_id", orderId);
    if (error) return dbError(error);
    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true, message: "Removed." };
  });
}

