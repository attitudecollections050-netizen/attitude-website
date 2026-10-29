// Store launch: until this moment the shop shows /coming-soon to visitors (the team can
// still use everything). Override with NEXT_PUBLIC_LAUNCH_AT (ISO time with offset).
export const LAUNCH_AT = process.env.NEXT_PUBLIC_LAUNCH_AT || "2026-10-29T22:00:00+01:00";

export function launchTime(): number {
  const t = new Date(LAUNCH_AT).getTime();
  return Number.isFinite(t) ? t : 0;
}

export function isLaunched(now = Date.now()): boolean {
  return now >= launchTime();
}

/** Paths that stay open before launch: the countdown, the team's sign-in and dashboard, auth links and APIs. */
export function openBeforeLaunch(pathname: string): boolean {
  return (
    pathname === "/coming-soon" ||
    pathname.startsWith("/coming-soon/") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/staff") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/api/") ||
    ["/account/login", "/account/forgot-password", "/account/reset-password", "/robots.txt", "/sitemap.xml", "/icon.png", "/apple-icon.png", "/manifest.webmanifest"].includes(pathname)
  );
}
