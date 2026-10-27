import "server-only";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, serverSecrets } from "@/lib/env";

let cached: SupabaseClient | null = null;

/**
 * Service-role client. Bypasses Row Level Security — use ONLY on the server
 * for trusted operations (carts, order creation, payment finalisation) after
 * validating input. Never pass it, or anything it returns unfiltered, to the browser.
 */
export function createServiceClient(): SupabaseClient {
  const key = serverSecrets().supabaseSecretKey;
  if (!env.supabaseUrl || !key) {
    throw new Error("SUPABASE_SECRET_KEY (service role) is not configured.");
  }
  if (!cached) {
    cached = createSupabaseClient(env.supabaseUrl, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}
