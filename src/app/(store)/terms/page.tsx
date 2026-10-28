import { ContentPage, contentMetadata } from "@/components/layout/ContentPage";

export function generateMetadata() {
  return contentMetadata("terms", "Terms & Conditions");
}

export default function Page() {
  return <ContentPage slug="terms" eyebrow="policies" />;
}
