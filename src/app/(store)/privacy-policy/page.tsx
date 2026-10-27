import { ContentPage, contentMetadata } from "@/components/layout/ContentPage";

export function generateMetadata() {
  return contentMetadata("privacy-policy", "Privacy Policy");
}

export default function Page() {
  return <ContentPage slug="privacy-policy" eyebrow="Policies" />;
}
