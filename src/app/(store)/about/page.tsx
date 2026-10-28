import { ContentPage, contentMetadata } from "@/components/layout/ContentPage";

export function generateMetadata() {
  return contentMetadata("about", "About Us");
}

export default function Page() {
  return <ContentPage slug="about" eyebrow="story" />;
}
