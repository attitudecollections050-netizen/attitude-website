export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "processing"
  | "awaiting_supplier"
  | "ordered_from_supplier"
  | "shipped"
  | "in_transit"
  | "delivered"
  | "cancelled"
  | "refunded";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: "Pending Payment",
  paid: "Paid",
  processing: "Processing",
  awaiting_supplier: "Awaiting Supplier",
  ordered_from_supplier: "Ordered from Supplier",
  shipped: "Shipped",
  in_transit: "In Transit",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

/** Customer-facing wording (internal supplier steps are shown as "Processing"). */
export const CUSTOMER_STATUS_LABELS: Record<OrderStatus, string> = {
  ...ORDER_STATUS_LABELS,
  awaiting_supplier: "Processing",
  ordered_from_supplier: "Processing",
};

/** Mirrors public.order_status_transition_allowed() for the admin UI. */
export function allowedTransitions(from: OrderStatus, paid: boolean): OrderStatus[] {
  const map: Record<OrderStatus, OrderStatus[]> = {
    pending_payment: ["cancelled"],
    paid: ["processing", "awaiting_supplier", "ordered_from_supplier", "shipped", "cancelled", "refunded"],
    processing: ["awaiting_supplier", "ordered_from_supplier", "shipped", "cancelled", "refunded"],
    awaiting_supplier: ["ordered_from_supplier", "shipped", "cancelled", "refunded"],
    ordered_from_supplier: ["shipped", "in_transit", "cancelled", "refunded"],
    shipped: ["in_transit", "delivered", "refunded"],
    in_transit: ["delivered", "refunded"],
    delivered: ["refunded"],
    cancelled: paid ? ["refunded"] : [],
    refunded: [],
  };
  return map[from].filter((s) => s !== "refunded" || paid);
}

export const CUSTOMER_PROGRESS: OrderStatus[] = ["paid", "processing", "shipped", "in_transit", "delivered"];

export function progressIndex(status: OrderStatus): number {
  if (status === "awaiting_supplier" || status === "ordered_from_supplier") return 1;
  return CUSTOMER_PROGRESS.indexOf(status);
}
