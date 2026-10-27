import { ContentPage, contentMetadata } from "@/components/layout/ContentPage";

export function generateMetadata() {
  return contentMetadata("faq", "FAQ");
}

export default function Page() {
  return <ContentPage slug="faq" eyebrow="Help" />;
}
