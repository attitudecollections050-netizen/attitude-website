import { Notice } from "./Notice";

export function SetupNotice({ what = "the store" }: { what?: string }) {
  return (
    <Notice tone="warning" title="Store database not connected">
      {what} needs Supabase to be configured. Add <code>NEXT_PUBLIC_SUPABASE_URL</code>, <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> and{" "}
      <code>SUPABASE_SECRET_KEY</code> to your environment, run the migrations, then reload. See the README.
    </Notice>
  );
}
