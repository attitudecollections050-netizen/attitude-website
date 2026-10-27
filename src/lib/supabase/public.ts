import "server-only";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

let cached: SupabaseClient | null = null;

/** Anonymous, cookie-free client for public catalogue reads (RLS applies as `anon`). */
export function createPublicClient(): SupabaseClient {
  if (!cached) {
    cached = createSupabaseClient(env.supabaseUrl, env.supabasePublicKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}
