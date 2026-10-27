import type { OrderStatus } from "./status";

export function statusTone(s: OrderStatus): "neutral" | "rose" | "success" | "warning" | "danger" | "plum" {
  switch (s) {
    case "pending_payment":
      return "warning";
    case "paid":
      return "rose";
    case "delivered":
      return "success";
    case "cancelled":
    case "refunded":
      return "danger";
    case "shipped":
    case "in_transit":
      return "plum";
    default:
      return "neutral";
  }
}
