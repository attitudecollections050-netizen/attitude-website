import type { Metadata } from "next";
import { LaunchStory } from "@/components/launch/LaunchCountdown";

export const metadata: Metadata = { title: "Launch story", robots: { index: false } };

/** 9:16 anime boutique scene with the girls chatting about the launch (tap for sound, then screen-record). */
export default function StoryPage() {
  return <LaunchStory />;
}
