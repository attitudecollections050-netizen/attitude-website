// Central access to configuration. Public values are prefixed NEXT_PUBLIC_.
export const env = {
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, ""),
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  supabasePublicKey:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  paystackPublicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || "",
};

export function isSupabaseConfigured() {
  return Boolean(env.supabaseUrl && env.supabasePublicKey);
}

/** Server-only secrets. Never import the values into client components. */
export function serverSecrets() {
  return {
    supabaseSecretKey: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    paystackSecretKey: process.env.PAYSTACK_SECRET_KEY || "",
    rateLimitSalt: process.env.RATE_LIMIT_SALT || "attitude-collections",
  };
}

export function isPaystackConfigured() {
  return Boolean(serverSecrets().paystackSecretKey);
}

export function paystackMode(): "test" | "live" | "unconfigured" {
  const key = serverSecrets().paystackSecretKey;
  if (!key) return "unconfigured";
  return key.startsWith("sk_live_") ? "live" : "test";
}
