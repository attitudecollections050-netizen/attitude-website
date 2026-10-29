import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ComingSoon } from "@/components/launch/LaunchCountdown";
import { isLaunched } from "@/lib/launch";
import { getSettings } from "@/lib/settings";
import { whatsappUrl } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Launching Thursday 10:00 PM",
  description: "Attitude Collections official launch — Thursday 10:00 PM. Get notified on WhatsApp.",
};

export default async function ComingSoonPage() {
  if (isLaunched()) redirect("/");
  const settings = await getSettings();
  const href = whatsappUrl(settings.store.whatsapp, "Hi Attitude Collections! Please notify me when you launch tonight 💖");
  return <ComingSoon whatsappHref={href} />;
}
