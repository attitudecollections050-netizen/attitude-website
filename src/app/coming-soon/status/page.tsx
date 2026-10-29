import type { Metadata } from "next";
import { StatusCountdown } from "@/components/launch/LaunchCountdown";

export const metadata: Metadata = { title: "Launch countdown (Status)", robots: { index: false } };

/** 9:16 countdown to screen-record for WhatsApp Status. */
export default function StatusPage() {
  return <StatusCountdown />;
}
