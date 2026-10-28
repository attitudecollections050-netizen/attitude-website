import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/admin";
import { env, isSupabaseConfigured, serverSecrets } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { CLIENT_EVENTS, CONSENT_COOKIE, classifySource, cleanPath, deviceFromUserAgent, isBot, referrerHost } from "@/lib/analytics/shared";

const short = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));

const eventSchema = z.object({
  type: z.enum(CLIENT_EVENTS),
  visitorId: z.string().uuid(),
  sessionId: z.string().uuid(),
  path: z.string().max(600),
  productId: z.string().uuid().optional().nullable(),
  variantId: z.string().uuid().optional().nullable(),
  // True for the first page of a visit: only then are referrer/UTM tags meaningful.
  landing: z.boolean().optional(),
  referrer: z.string().max(1000).optional().nullable(),
  utmSource: short(80),
  utmMedium: short(80),
  utmCampaign: short(120),
});

const accepted = () => new NextResponse(null, { status: 204 });

/**
 * First-party analytics collector. Accepts storefront events from visitors
 * who accepted analytics cookies. Purchases are not accepted here — they are
 * recorded from verified payments in the database.
 */
export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured() || !serverSecrets().supabaseSecretKey) return accepted();
  // Consent is required, and browser privacy signals are honoured server-side too.
  if (request.cookies.get(CONSENT_COOKIE)?.value !== "granted") return accepted();
  if (request.headers.get("sec-gpc") === "1" || request.headers.get("dnt") === "1") return accepted();
  const ua = request.headers.get("user-agent");
  if (isBot(ua)) return accepted();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  const e = parsed.data;
  const path = cleanPath(e.path);
  if (!path || path.startsWith("/admin") || path.startsWith("/api")) return accepted();

  if (!(await rateLimit("analytics", 240, 600))) return NextResponse.json({ error: "Too many events" }, { status: 429 });

  const db = createServiceClient();
  let productId = e.productId ?? null;
  if (e.type === "add_to_cart" && !productId && e.variantId) {
    const { data } = await db.from("product_variants").select("product_id").eq("id", e.variantId).maybeSingle();
    productId = data?.product_id ?? null;
  }
  if (productId) {
    const { data } = await db.from("products").select("id").eq("id", productId).maybeSingle();
    if (!data) productId = null;
  }

  const ownHost = (() => {
    try {
      return new URL(env.siteUrl).hostname;
    } catch {
      return null;
    }
  })();
  const landing = e.type === "page_view" && e.landing === true;
  const refHost = landing ? referrerHost(e.referrer, request.headers.get("host") ?? ownHost) : null;
  const country = request.headers.get("x-vercel-ip-country")?.toUpperCase() ?? null;

  const { error } = await db.from("analytics_events").insert({
    event_type: e.type,
    visitor_id: e.visitorId,
    session_id: e.sessionId,
    path,
    product_id: productId,
    referrer_host: refHost,
    source: landing ? classifySource(refHost, { source: e.utmSource, medium: e.utmMedium }) : null,
    utm_source: landing ? e.utmSource : null,
    utm_medium: landing ? e.utmMedium : null,
    utm_campaign: landing ? e.utmCampaign : null,
    device: deviceFromUserAgent(ua),
    country: country && /^[A-Z]{2}$/.test(country) && country !== "XX" ? country : null,
  });
  if (error) console.error("[analytics]", error.message);
  return accepted();
}
