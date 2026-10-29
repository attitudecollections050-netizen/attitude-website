import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env, isSupabaseConfigured } from "@/lib/env";
import { isLaunched, openBeforeLaunch } from "@/lib/launch";

/** Refreshes the Supabase auth session cookie on every matched request. */
export async function updateSession(request: NextRequest) {
  // Tells server code which area is rendering (the admin always stays in English).
  const forwarded = new Headers(request.headers);
  forwarded.set("x-ac-area", request.nextUrl.pathname.startsWith("/admin") ? "admin" : "store");
  let response = NextResponse.next({ request: { headers: forwarded } });
  if (!isSupabaseConfigured()) return response;

  const supabase = createServerClient(env.supabaseUrl, env.supabasePublicKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        forwarded.set("cookie", request.cookies.toString());
        response = NextResponse.next({ request: { headers: forwarded } });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Validates the JWT and refreshes it when needed. Do not remove.
  const { data } = await supabase.auth.getClaims();

  // Before launch, visitors see the countdown; the owner and staff (by their role) can use everything.
  if (!isLaunched() && !openBeforeLaunch(request.nextUrl.pathname)) {
    const userId = data?.claims?.sub;
    let team = false;
    if (userId) {
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId).limit(1);
      team = Boolean(roles?.length);
    }
    if (!team) {
      const redirect = NextResponse.redirect(new URL("/coming-soon", request.url));
      response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
      redirect.headers.set("Cache-Control", "no-store");
      return redirect;
    }
  }
  return response;
}
