import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Skip static assets, images, sounds, the service worker and the payment webhook (raw body, no cookies).
    "/((?!_next/static|_next/image|favicon.ico|api/webhooks|sw\\.js|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|mp3)$).*)",
  ],
};
