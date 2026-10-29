import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Translations: cookie-based locale (URLs stay the same in every language).
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const supabaseUrl = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL) : undefined;
  } catch {
    return undefined;
  }
})();

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    formats: ["image/avif", "image/webp"],
    // Only for running the store against a Supabase on this machine (never set in production).
    ...(process.env.ALLOW_LOCAL_IMAGES === "1" ? { dangerouslyAllowLocalIP: true } : {}),
    remotePatterns: [
      // Supabase Storage (product uploads)
      ...(supabaseUrl
        ? [
            {
              protocol: supabaseUrl.protocol === "http:" ? ("http" as const) : ("https" as const),
              hostname: supabaseUrl.hostname,
              ...(supabaseUrl.port ? { port: supabaseUrl.port } : {}),
              pathname: "/storage/v1/object/public/**",
            },
          ]
        : []),
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
      // Demo seed imagery only — replace with your own product photography.
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: "6mb" },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // Microphone is allowed for this site only (Dj Attitude Mini voice messages); never for embedded frames.
          { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
