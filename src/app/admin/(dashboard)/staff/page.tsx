import { requireStaffPage } from "@/lib/auth";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import { earningsFor } from "@/lib/staff-earnings";
import { serverSecrets } from "@/lib/env";
import { ROLE_LABELS, type AppRole } from "@/lib/permissions";
import { removeStaff, setDeletePermission, setStaffDisabled } from "@/app/admin/actions/staff";
import { ActionForm } from "@/components/admin/ActionForm";
import { ResendInviteButton, StaffInviteForm } from "@/components/admin/StaffForms";
import { Badge, Card, Empty, PageHeader } from "@/components/admin/ui";
import { Notice } from "@/components/ui/Notice";

export const metadata = { title: "Staff Management" };

const when = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" }) : "—";

interface StaffRow {
  user_id: string;
  email: string;
  full_name: string | null;
  role: AppRole;
  status: "invited" | "active" | "disabled";
  can_delete_products: boolean;
  invited_at: string;
  last_invited_at: string;
  accepted_at: string | null;
}

export default async function StaffPage() {
  // Owner only: checked here on the server, and again in every staff action.
  const { user } = await requireStaffPage("staff:manage");
  const canManage = Boolean(serverSecrets().supabaseSecretKey);
  if (!canManage) {
    return (
      <div className="space-y-6">
        <PageHeader title="Staff Management" />
        <Notice tone="warning">Staff Management needs SUPABASE_SECRET_KEY in your hosting environment (it creates and manages login accounts on the server).</Notice>
      </div>
    );
  }
  const svc = createServiceClient();
  const [{ data: staffRows }, { data: ownerRoles }] = await Promise.all([
    svc.from("staff_members").select("user_id, email, full_name, role, status, can_delete_products, invited_at, last_invited_at, accepted_at").order("invited_at", { ascending: false }),
    svc.from("user_roles").select("user_id").eq("role", "admin"),
  ]);
  const staff = (staffRows ?? []) as StaffRow[];
  // Counts come from the owner's own session: the database only gives everyone's numbers to the owner.
  const { data: statRows } = await (await createClient()).rpc("staff_product_stats");
  const stats = new Map(((statRows ?? []) as { user_id: string; products_added: number; live_products: number }[]).map((r) => [r.user_id, r]));
  // Last sign-in comes from Supabase Auth (server only).
  const authInfo = new Map(
    await Promise.all(
      [...staff.map((s) => s.user_id), ...(ownerRoles ?? []).map((o) => o.user_id)].map(async (id) => {
        const { data } = await svc.auth.admin.getUserById(id);
        return [id, { lastSignIn: data.user?.last_sign_in_at ?? null, email: data.user?.email ?? "", name: (data.user?.user_metadata?.full_name as string | undefined) ?? null }] as const;
      }),
    ),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff Management"
        description="Invite people to help run the store with their own login. They never need your password, and they only see what their role allows."
      />

      <Card title="Invite a staff member" description="They receive a private link to choose their own password. The link works once and expires.">
        <StaffInviteForm />
      </Card>

      <Card title="Team">
        <ul className="divide-y divide-line">
          {(ownerRoles ?? []).map((o) => {
            const info = authInfo.get(o.user_id);
            return (
              <li key={o.user_id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] sm:items-center">
                <div className="min-w-0">
                  <p className="font-semibold">{info?.name ?? "Store owner"}{o.user_id === user.id && <span className="ml-1 font-normal text-muted">(you)</span>}</p>
                  <p className="truncate text-sm text-muted">{info?.email}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="plum">{ROLE_LABELS.admin}</Badge>
                  <Badge tone="success">Active</Badge>
                </div>
                <div className="text-xs text-muted">
                  <p>Last login: {when(info?.lastSignIn)}</p>
                  <p>Full access · can&apos;t be removed or downgraded</p>
                </div>
              </li>
            );
          })}
          {staff.map((s) => {
            const info = authInfo.get(s.user_id);
            return (
              <li key={s.user_id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] sm:items-start">
                <div className="min-w-0">
                  <p className="font-semibold">{s.full_name ?? info?.name ?? "—"}</p>
                  <p className="truncate text-sm text-muted">{s.email}</p>
                  <p className="mt-1 text-xs text-muted">Invited {when(s.last_invited_at)} · Last login {when(info?.lastSignIn)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="rose">{ROLE_LABELS[s.role] ?? s.role}</Badge>
                  <Badge tone={s.status === "active" ? "success" : s.status === "invited" ? "warning" : "danger"}>
                    {s.status === "invited" ? "Invited" : s.status === "active" ? "Active" : "Disabled"}
                  </Badge>
                  <span className="text-xs text-muted">Delete products: {s.can_delete_products ? "allowed" : "not allowed"}</span>
                  <p className="w-full text-xs text-muted">
                    Products added: <strong className="text-plum">{stats.get(s.user_id)?.products_added ?? 0}</strong>
                    {" · "}Earned: <strong className="text-base font-extrabold text-success">{formatMoney(earningsFor(stats.get(s.user_id)?.live_products ?? 0).earnedKobo)}</strong>
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <Link href={`/staff/dashboard?as=${s.user_id}`} className="text-xs font-semibold underline underline-offset-4 hover:text-rose-deep">View as staff</Link>
                  <ActionForm action={setDeletePermission} submitLabel={s.can_delete_products ? "Stop deleting" : "Allow deleting"} variant="ghost" inline>
                    <input type="hidden" name="user_id" value={s.user_id} />
                    <input type="hidden" name="allow" value={s.can_delete_products ? "0" : "1"} />
                  </ActionForm>
                  <ActionForm
                    action={setStaffDisabled}
                    submitLabel={s.status === "disabled" ? "Enable" : "Disable"}
                    variant="outline"
                    inline
                    confirm={s.status === "disabled" ? undefined : `Disable ${s.email}? They lose access immediately.`}
                  >
                    <input type="hidden" name="user_id" value={s.user_id} />
                    <input type="hidden" name="disable" value={s.status === "disabled" ? "0" : "1"} />
                  </ActionForm>
                  <ActionForm action={removeStaff} submitLabel="Remove" variant="ghost" inline confirm={`Remove ${s.email} from your staff? Their staff login will be deleted.`}>
                    <input type="hidden" name="user_id" value={s.user_id} />
                  </ActionForm>
                </div>
                {s.status === "invited" && (
                  <div className="sm:col-span-3">
                    <ResendInviteButton userId={s.user_id} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {staff.length === 0 && <div className="mt-4"><Empty>No staff yet. Invite someone above.</Empty></div>}
      </Card>

      <Card title="What Product Staff can do">
        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          <li>✓ Add products, and edit the ones they added: names, descriptions, prices, categories, sizes, colours and stock</li>
          <li>✓ See their own products and earnings (₦1,000 per 10 live products) on their dashboard</li>
          <li>✓ Upload, edit and remove product images</li>
          <li>✓ Publish, unpublish and archive products</li>
          <li>✓ Delete products — only if you switch it on for them</li>
          <li className="text-muted">✗ Orders, payments, revenue and reports</li>
          <li className="text-muted">✗ Customers and their contact details</li>
          <li className="text-muted">✗ Store settings, shipping, discounts, homepage, international settings</li>
          <li className="text-muted">✗ Suppliers, Staff Management, API keys and your account</li>
        </ul>
        <p className="mt-4 text-xs text-muted">These limits are enforced by the server and by the database, not just by hiding menu items.</p>
      </Card>
    </div>
  );
}
