import { ContentPage, contentMetadata } from "@/components/layout/ContentPage";

export function generateMetadata() {
  return contentMetadata("shipping-policy", "Shipping Policy");
}

export default function Page() {
  return <ContentPage slug="shipping-policy" eyebrow="Policies" />;
}
