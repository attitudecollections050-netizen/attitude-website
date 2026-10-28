import "server-only";
import { createServiceClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import type { OrderStatus } from "./status";

export interface CustomerOrderView {
  id: string;
  order_number: string;
  access_token: string;
  email: string;
  customer_name: string;
  phone: string;
  shipping_address: { full_name: string; phone: string; country_code: string; region: string; city: string; line1: string; line2: string | null; postal_code: string | null };
  delivery_instructions: string | null;
  shipping_method_name: string;
  shipping_is_manual: boolean;
  shipping_min_days: number | null;
  shipping_max_days: number | null;
  currency: string;
  subtotal: number;
  discount_total: number;
  discount_code: string | null;
  shipping_fee: number;
  tax_total: number;
  total: number;
  status: OrderStatus;
  payment_status: string;
  created_at: string;
  paid_at: string | null;
  /** What the shopper saw at order time (display only; the charge is `total` in `currency`). */
  display_currency: string | null;
  display_total: number | string | null;
  order_items: { id: string; product_name: string; product_slug: string | null; variant_label: string | null; image_url: string | null; unit_price: number; quantity: number; line_total: number }[];
  order_status_history: { status: OrderStatus; public_note: string | null; created_at: string }[];
  shipment_tracking: { carrier: string | null; tracking_number: string | null; tracking_url: string | null; dispatched_at: string | null }[];
}

const SELECT = `id, order_number, access_token, user_id, email, customer_name, phone, shipping_address, delivery_instructions,
  shipping_method_name, shipping_is_manual, shipping_min_days, shipping_max_days, currency, subtotal, discount_total, discount_code,
  shipping_fee, tax_total, total, status, payment_status, created_at, paid_at, display_currency, display_total,
  order_items ( id, product_name, product_slug, variant_label, image_url, unit_price, quantity, line_total ),
  order_status_history ( status, public_note, created_at ),
  shipment_tracking ( carrier, tracking_number, tracking_url, dispatched_at )`;

/**
 * Loads an order for the customer view. Access requires either the order's
 * secret access token (from the confirmation link/email) or being the signed-in owner.
 * Internal data (supplier, costs, notes, payments) is never selected.
 */
export async function getOrderForCustomer(orderNumber: string, token: string | null): Promise<CustomerOrderView | null> {
  if (!/^AC\d{6,}$/.test(orderNumber)) return null;
  const { data } = await createServiceClient().from("orders").select(SELECT).eq("order_number", orderNumber).maybeSingle();
  if (!data) return null;
  let allowed = Boolean(token && /^[a-f0-9]{48}$/.test(token) && token === data.access_token);
  if (!allowed && data.user_id) {
    const user = await getCurrentUser();
    allowed = user?.id === data.user_id;
  }
  if (!allowed) return null;
  const { user_id: _u, ...rest } = data;
  void _u;
  const view = rest as unknown as CustomerOrderView;
  view.order_status_history = [...view.order_status_history].sort((a, b) => a.created_at.localeCompare(b.created_at));
  return view;
}
