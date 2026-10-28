import { ContentPage, contentMetadata } from "@/components/layout/ContentPage";

export function generateMetadata() {
  return contentMetadata("returns-policy", "Returns & Refunds");
}

export default function Page() {
  return <ContentPage slug="returns-policy" eyebrow="policies" />;
}
