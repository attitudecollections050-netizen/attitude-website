import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import { env } from "@/lib/env";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: {
    default: "Attitude Collections — Wear Your Attitude.",
    template: "%s | Attitude Collections",
  },
  description:
    "Attitude Collections: statement clothing, shoes, sneakers and bags for men and women. Delivery across Nigeria and selected international destinations.",
  applicationName: "Attitude Collections",
  openGraph: {
    type: "website",
    siteName: "Attitude Collections",
    title: "Attitude Collections — Wear Your Attitude.",
    description: "Statement clothing, shoes, sneakers and bags for men and women.",
    url: env.siteUrl,
    locale: "en_NG",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#251923",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${cormorant.variable} ${manrope.variable}`}>
      <body className="min-h-dvh flex flex-col">{children}</body>
    </html>
  );
}
