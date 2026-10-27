import { requireStaffPage } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { setMessageStatus } from "@/app/admin/actions/store";
import { ActionForm } from "@/components/admin/ActionForm";
import { Badge, Card, Empty, PageHeader } from "@/components/admin/ui";

export const metadata = { title: "Messages" };

export default async function MessagesPage() {
  const { roles } = await requireStaffPage("messages:read");
  const db = await createClient();
  const [{ data: messages }, subs] = await Promise.all([
    db.from("contact_messages").select("*").order("created_at", { ascending: false }).limit(200),
    can(roles, "settings:write") ? db.from("newsletter_subscribers").select("email, created_at, unsubscribed_at").order("created_at", { ascending: false }).limit(1000) : Promise.resolve({ data: null }),
  ]);
  const active = (subs.data ?? []).filter((s) => !s.unsubscribed_at);
  return (
    <div className="space-y-6">
      <PageHeader title="Messages" description="Contact form submissions and newsletter sign-ups." />
      {!messages?.length ? (
        <Empty>No messages yet.</Empty>
      ) : (
        messages.map((m) => (
          <Card
            key={m.id}
            title={m.subject}
            description={`${m.name} · ${m.email}${m.order_number ? ` · order ${m.order_number}` : ""} · ${new Date(m.created_at).toLocaleString("en-NG")}`}
            actions={<Badge tone={m.status === "new" ? "rose" : m.status === "resolved" ? "success" : "warning"}>{m.status.replace("_", " ")}</Badge>}
          >
            <p className="whitespace-pre-line text-sm text-plum-soft">{m.message}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <a href={`mailto:${m.email}?subject=${encodeURIComponent("Re: " + m.subject)}`} className="text-xs underline">Reply by email</a>
              {(["in_progress", "resolved"] as const).filter((s) => s !== m.status).map((s) => (
                <ActionForm key={s} action={setMessageStatus} submitLabel={s === "resolved" ? "Mark resolved" : "Mark in progress"} variant="outline" inline>
                  <input type="hidden" name="id" value={m.id} /><input type="hidden" name="status" value={s} />
                </ActionForm>
              ))}
            </div>
          </Card>
        ))
      )}
      {subs.data && (
        <Card title={`Newsletter subscribers (${active.length})`} description="Export by copying the list below into your email tool.">
          {active.length === 0 ? <p className="text-sm text-muted">No subscribers yet.</p> : <textarea readOnly rows={8} className="field font-mono !text-xs" value={active.map((s) => s.email).join("\n")} aria-label="Subscriber emails" />}
        </Card>
      )}
    </div>
  );
}
