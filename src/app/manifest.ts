import type { MetadataRoute } from "next";

// Makes the site installable ("Add to Home Screen"), which iPhones need for push notifications.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Attitude Collections",
    short_name: "Attitude",
    description: "Statement clothing, shoes, sneakers and bags for men and women.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#E94E8A",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
