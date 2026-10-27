import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createServiceClient } from "@/lib/supabase/admin";
import { serverSecrets } from "@/lib/env";

export async function clientFingerprint(): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return createHash("sha256").update(serverSecrets().rateLimitSalt + ip).digest("hex").slice(0, 32);
}

/**
 * Fixed-window limiter backed by Postgres so it works across serverless
 * instances. Fails open (allows) if the database is unreachable, but logs it.
 */
export async function rateLimit(action: string, max: number, windowSeconds: number): Promise<boolean> {
  try {
    const key = `${action}:${await clientFingerprint()}`;
    const { data, error } = await createServiceClient().rpc("check_rate_limit", {
      p_key: key,
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    if (error) throw error;
    return data === true;
  } catch (e) {
    console.error("[rate-limit] check failed:", (e as Error).message);
    return true;
  }
}
