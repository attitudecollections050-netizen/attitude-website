import "server-only";
import { createClient } from "@/lib/supabase/server";
import { REPORT_TZ, type Period } from "./periods";

export interface SalesRow {
  currency: string;
  paid_orders: number;
  qualifying_orders: number;
  gross_sales: number;
  discounts: number;
  refunds: number;
  cancellations: number;
  net_sales: number;
  shipping: number;
  tax: number;
  revenue: number;
  refunded_to_customers: number;
  refunded_orders: number;
  cancelled_paid_orders: number;
  average_order_value: number;
}

export interface SeriesPoint {
  bucket: string;
  orders: number;
  paid_orders: number;
  revenue: Record<string, number>;
  visitors: number;
  page_views: number;
}

export interface AnalyticsReport {
  range: { from: string; to: string; timezone: string; bucket: string };
  orders: { total: number; awaiting_payment: number; failed_payment: number; cancelled_unpaid: number };
  sales: SalesRow[];
  payments: { attempts: number; successful: number; duplicate: number; pending: number; failed: number; abandoned: number };
  refunds_in_period: number;
  cancellations_in_period: number;
  pending_deliveries: number;
  series: SeriesPoint[];
  traffic: { visitors: number; visits: number; page_views: number; product_views: number };
  funnel: { visited: number; viewed_product: number; added_to_cart: number; started_checkout: number; purchased: number };
  top_pages: { path: string; views: number; visitors: number }[];
  top_viewed_products: { product_id: string; name: string; views: number; visitors: number }[];
  referrers: { host: string; visitors: number; visits: number }[];
  sources: { source: string; visitors: number; visits: number }[];
  devices: { device: string; visitors: number }[];
  countries: { country: string; visitors: number }[];
  best_sellers: { product_id: string | null; name: string; currency: string; units: number; revenue: number; orders: number }[];
  categories: { category: string; currency: string; units: number; revenue: number; orders: number }[];
}

/** Runs the admin-only report function with the caller's own session (RLS + role check in SQL). */
export async function loadAnalyticsReport(p: Period): Promise<{ report: AnalyticsReport | null; error: string | null }> {
  const db = await createClient();
  const { data, error } = await db.rpc("admin_analytics_report", { p_from: p.from, p_to: p.to, p_tz: REPORT_TZ, p_bucket: p.bucket });
  if (error) return { report: null, error: error.message };
  return { report: data as AnalyticsReport, error: null };
}

export interface FeedbackReport {
  total: number;
  average: number | null;
  positive: number;
  neutral: number;
  negative: number;
  unreviewed: number;
  flagged: number;
  distribution: { rating: number; count: number }[];
  series: { bucket: string; total: number; positive: number; neutral: number; negative: number; average: number | null }[];
  complaints: { reason: string; count: number; average: number }[];
  suggestions: { id: string; suggestion: string; rating: number; created_at: string }[];
}

export async function loadFeedbackReport(p: Period): Promise<{ report: FeedbackReport | null; error: string | null }> {
  const db = await createClient();
  const { data, error } = await db.rpc("admin_feedback_report", { p_from: p.from, p_to: p.to, p_tz: REPORT_TZ, p_bucket: p.bucket });
  if (error) return { report: null, error: error.message };
  return { report: data as FeedbackReport, error: null };
}

/** Percentage helper that never divides by zero. */
export function pct(part: number, whole: number, digits = 1): string {
  if (!whole) return "—";
  return `${((part / whole) * 100).toFixed(digits)}%`;
}
