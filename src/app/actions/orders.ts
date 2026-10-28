"use server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import type { OrderStatus } from "@/lib/orders/status";

export interface TrackResult {
  order_number: string;
  status: OrderStatus;
  payment_status: string;
  created_at: string;
  paid_at: string | null;
  shipping_method_name: string;
  shipping_min_days: number | null;
  shipping_max_days: number | null;
  destination: { city: string; region: string; country_code: string };
  items: { name: string; variant: string | null; quantity: number }[];
  tracking: { carrier: string | null; tracking_number: string | null; tracking_url: string | null; dispatched_at: string | null }[];
  history: { status: OrderStatus; note: string | null; created_at: string }[];
}

export type TrackState = { ok: true; order: TrackResult } | { ok: false; error: string } | null;

const schema = z.object({
  // Errors are message keys (track.errors.*), translated by the form.
  order_number: z.string().trim().toUpperCase().regex(/^AC\d{6,}$/, "badNumber"),
  email: z.string().trim().toLowerCase().email("badEmail"),
});

export async function trackOrder(_prev: TrackState, formData: FormData): Promise<TrackState> {
  if (!isSupabaseConfigured()) return { ok: false, error: "unavailable" };
  const parsed = schema.safeParse({ order_number: formData.get("order_number"), email: formData.get("email") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  if (!(await rateLimit("track", 10, 600))) return { ok: false, error: "tooMany" };
  const { data, error } = await createServiceClient().rpc("track_order", { p_order_number: parsed.data.order_number, p_email: parsed.data.email });
  if (error) return { ok: false, error: "lookupFailed" };
  // Same message for "no order" and "wrong email" so order numbers can't be probed.
  if (!data) return { ok: false, error: "notFound" };
  return { ok: true, order: data as TrackResult };
}
