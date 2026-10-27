import { requireUser } from "@/lib/auth";
import { AccountNav } from "@/components/account/AccountNav";

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/account");
  return (
    <div className="container-luxe pb-24 pt-12">
      <p className="eyebrow text-rose-deep">My account</p>
      <h1 className="display mt-3 text-5xl sm:text-6xl">Hello{user.user_metadata?.full_name ? `, ${String(user.user_metadata.full_name).split(" ")[0]}` : ""}.</h1>
      <div className="mt-10 grid gap-10 lg:grid-cols-[14rem_1fr]">
        <AccountNav />
        <div>{children}</div>
      </div>
    </div>
  );
}
