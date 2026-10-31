import { requireStaffPage } from "@/lib/auth";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { earningsFor } from "@/lib/staff-earnings";
import { env, serverSecrets } from "@/lib/env";
import { ROLE_LABELS, type AppRole } from "@/lib/permissions";
import { removeStaff, setDeletePermission, setStaffDisabled } from "@/app/admin/actions/staff";
import { ActionForm } from "@/components/admin/ActionForm";
import { ResendInviteButton, StaffInviteForm } from "@/components/admin/StaffForms";
import { Badge, Card, Empty, PageHeader } from "@/components/admin/ui";
import { Notice } from "@/components/ui/Notice";
import { PaymentsLive, WithdrawalReview } from "@/components/admin/PayStaff";
import { naira, PaymentError, staffPaymentHistory, staffPaymentTotals, type StaffPayment, type StaffPaymentTotals } from "@/lib/staff-payments";

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
  // Payments: totals per staff member and the latest payouts (owner's session; the database checks it).
  // Ask the database directly; only a "function/table not found" error means payments aren't set up.
  let payTotals: StaffPaymentTotals[] = [];
  let recentPayments: StaffPayment[] = [];
  let pendingRequests: StaffPayment[] = [];
  let payProblem: { kind: "not_installed" | "error"; message: string } | null = null;
  try {
    let history: StaffPayment[];
    [payTotals, history] = await Promise.all([staffPaymentTotals(), staffPaymentHistory(undefined, 300)]);
    pendingRequests = history.filter((r) => r.type === "withdrawal" && r.status === "pending");
    recentPayments = history.slice(0, 20);
  } catch (e) {
    const err = e instanceof PaymentError ? e : null;
    payProblem = { kind: err?.code === "not_installed" ? "not_installed" : "error", message: err?.message ?? "Couldn't load staff payments." };
    // Server log (Vercel → Logs): which Supabase project this deployment talks to, and the raw error.
    console.error("[staff-payments] check failed", { supabaseUrl: env.supabaseUrl || "(NEXT_PUBLIC_SUPABASE_URL not set)", code: err?.code, detail: err?.detail ?? String(e) });
  }
  const pay = new Map(payTotals.map((t) => [t.userId, t]));

  const payReady = !payProblem;
  const supabaseProject = (() => {
    try {
      return new URL(env.supabaseUrl).host.split(".")[0];
    } catch {
      return "(not set)";
    }
  })();
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

      <PaymentsLive />
      {payReady && (
        <Card
          title={`Withdrawal requests${pendingRequests.length ? ` (${pendingRequests.length})` : ""}`}
          description="Staff ask to withdraw their balance from their earnings page. Send the transfer to the account shown, then tap Approve."
        >
          {pendingRequests.length === 0 ? (
            <Empty>No withdrawal requests right now.</Empty>
          ) : (
            <ul className="divide-y divide-line" data-testid="withdrawal-requests">
              {pendingRequests.map((r) => {
                const who = pay.get(r.staffId);
                const name = who?.name ?? who?.email ?? "Staff member";
                return (
                  <li key={r.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto] sm:items-center" data-testid={`request-${r.staffId}`}>
                    <div>
                      <p className="font-semibold">{name}</p>
                      <p className="text-xs text-muted">Requested {when(r.createdAt)}</p>
                      <p className="mt-1 text-2xl font-extrabold tabular-nums text-plum">{naira(r.amount)}</p>
                    </div>
                    <div className="rounded-xl bg-neutral px-3 py-2 text-sm">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Send to</p>
                      {r.bank ? (
                        <>
                          <p className="font-semibold">{r.bank.bankName}</p>
                          <p className="font-mono text-base tracking-wider">{r.bank.accountNumber}</p>
                          <p>{r.bank.accountName}</p>
                        </>
                      ) : (
                        <p className="text-danger">No bank details on this request.</p>
                      )}
                    </div>
                    <WithdrawalReview paymentId={r.id} name={name} amount={r.amount} bank={r.bank} />
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}
      <Card title="Staff payments" description="What each person has earned, what you've paid them (withdrawn), what's waiting for approval and what's left.">
        {payProblem?.kind === "not_installed" ? (
          <Notice tone="warning">
            Payments aren&apos;t switched on in this database yet. This site is connected to Supabase project <code>{supabaseProject}</code>. In that project&apos;s SQL Editor, run{" "}
            <code>supabase/manual/live-staff-payouts.sql</code> once, then reload this page.
          </Notice>
        ) : payProblem ? (
          <Notice tone="error">
            Couldn&apos;t load staff payments: {payProblem.message} (Supabase project <code>{supabaseProject}</code>; details are in the server log.)
          </Notice>
        ) : payTotals.length === 0 ? (
          <Empty>No staff yet.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-left text-sm" data-testid="staff-payments-table">
              <thead className="border-b border-line text-[11px] uppercase tracking-[0.14em] text-muted">
                <tr>
                  <th className="py-2 pr-3 font-bold">Name</th>
                  <th className="py-2 pr-3 font-bold">Account details</th>
                  <th className="py-2 pr-3 font-bold">Total earned</th>
                  <th className="py-2 pr-3 font-bold">Withdrawn</th>
                  <th className="py-2 pr-3 font-bold">Left</th>
                  <th className="py-2 font-bold">Request</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {payTotals.map((t) => (
                  <tr key={t.userId} data-testid={`pay-row-${t.userId}`}>
                    <td className="py-3 pr-3">
                      <p className="font-semibold">{t.name ?? t.email}</p>
                      <p className="text-xs text-muted">{t.productsAdded} products{t.lastPaidAt ? ` · last paid ${when(t.lastPaidAt)}` : ""}</p>
                    </td>
                    <td className="py-3 pr-3 text-xs" data-testid="account">
                      {t.bank ? (
                        <>
                          <p className="font-semibold">{t.bank.bankName}</p>
                          <p className="font-mono">{t.bank.accountNumber}</p>
                          <p className="text-muted">{t.bank.accountName}</p>
                        </>
                      ) : (
                        <span className="font-semibold text-[#EA580C]">⚠️ Not added yet</span>
                      )}
                    </td>
                    <td className="py-3 pr-3 tabular-nums text-[#2563EB]">
                      {naira(t.totalEarnings)}
                      {t.extraEarnings > 0 && <span className="block text-[11px] text-muted">incl. {naira(t.extraEarnings)} bonus/extra</span>}
                    </td>
                    <td className="py-3 pr-3 font-semibold tabular-nums text-[#EA580C]" data-testid="withdrawn">
                      {naira(t.totalWithdrawn)}
                      {t.pendingAmount > 0 && <span className="block text-[11px] font-normal text-muted" data-testid="pending">+ {naira(t.pendingAmount)} requested</span>}
                    </td>
                    <td className={`py-3 pr-3 font-extrabold tabular-nums ${t.balanceLeft < 0 ? "text-danger" : "text-[#16A34A]"}`} data-testid="balance">{naira(t.balanceLeft)}</td>
                    <td className="py-3">
                      {t.pendingAmount > 0 ? <Badge tone="warning">⏳ Waiting for you</Badge> : <span className="text-xs text-muted">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {recentPayments.length > 0 && (
          <div className="mt-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Recent payments</p>
            <ul className="mt-2 divide-y divide-line text-sm" data-testid="recent-payments">
              {recentPayments.map((r) => {
                const who = pay.get(r.staffId);
                return (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>
                      <span className="font-semibold">{who?.name ?? who?.email ?? "Former staff"}</span>
                      <span className="text-muted"> · {r.description ?? (r.type === "withdrawal" ? "Payout" : r.type)}</span>
                    </span>
                    <span className="flex flex-wrap items-center gap-3">
                      <Badge tone={r.type === "withdrawal" ? "plum" : r.type === "penalty" ? "danger" : "success"}>{r.type === "withdrawal" ? "Withdrawal" : r.type === "bonus" ? "Bonus" : r.type === "penalty" ? "Deduction" : "Earning"}</Badge>
                      {r.type === "withdrawal" && (
                        <Badge tone={r.status === "confirmed" ? "success" : r.status === "pending" ? "warning" : "danger"}>
                          {r.status === "paid" || r.status === "confirmed" ? "✅ Paid" : r.status === "pending" ? "⏳ Requested" : "❌ Declined"}
                        </Badge>
                      )}
                      {r.status === "rejected" && (r.adminNote ?? r.staffNote) && <span className="text-xs text-danger">“{r.adminNote ?? r.staffNote}”</span>}
                      <span className="font-semibold tabular-nums">{r.type === "withdrawal" || r.type === "penalty" ? "−" : "+"}{naira(r.amount)}</span>
                      <span className="text-xs text-muted">{when(r.createdAt)}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </Card>

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
                  {(() => {
                    const earnedNaira = pay.get(s.user_id)?.totalEarnings ?? earningsFor(stats.get(s.user_id)?.products_added ?? 0).earnedKobo / 100;
                    const withdrawn = pay.get(s.user_id)?.totalWithdrawn ?? 0;
                    const left = pay.get(s.user_id)?.balanceLeft ?? earnedNaira - withdrawn;
                    const t = pay.get(s.user_id);
                    return (
                      <div className="w-full space-y-2 text-xs text-muted">
                        <p>Products added: <strong className="text-plum">{stats.get(s.user_id)?.products_added ?? 0}</strong></p>
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" data-testid={`money-line-${s.user_id}`}>
                          <span>Earned: <strong className="font-extrabold text-[#2563EB]">{naira(earnedNaira)}</strong></span>
                          <span aria-hidden>|</span>
                          <span>Withdrawn: <strong className="font-extrabold text-[#EA580C]">{naira(withdrawn)}</strong></span>
                          <span aria-hidden>|</span>
                          <span>Left: <strong className={`font-extrabold ${left < 0 ? "text-danger" : "text-[#16A34A]"}`}>{naira(left)}</strong></span>
                          <span aria-hidden>|</span>
                          <span>
                            Bank:{" "}
                            {t?.bank ? (
                              <strong className="text-plum">{t.bank.bankName.replace(/ Bank$/, "")} - {t.bank.accountNumber.slice(0, 7)}…</strong>
                            ) : (
                              <strong className="text-[#EA580C]">not added</strong>
                            )}
                          </span>
                        </p>
                        {t && t.pendingAmount > 0 && <p className="text-xs font-semibold text-[#EA580C]">⏳ Requested {naira(t.pendingAmount)} — approve it above</p>}
                      </div>
                    );
                  })()}
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
          <li>✓ See their own products and earnings (₦1,000 for every 10 products they add) on their dashboard</li>
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
