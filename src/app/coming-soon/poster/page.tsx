import type { Metadata } from "next";
import { LaunchPoster } from "@/components/launch/LaunchCountdown";

export const metadata: Metadata = { title: "Launch poster", robots: { index: false } };

/** 1080×1920 "launches tonight 10PM" poster for WhatsApp. */
export default function PosterPage() {
  return <LaunchPoster />;
}
