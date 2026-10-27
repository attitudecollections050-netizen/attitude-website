import { requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { saveContentPage } from "@/app/admin/actions/store";
import { ActionForm } from "@/components/admin/ActionForm";
import { Badge, Card, Field, PageHeader, inputCls } from "@/components/admin/ui";

export const metadata = { title: "Pages & policies" };

export default async function ContentAdmin() {
  await requireStaffPage("settings:write");
  const db = await createClient();
  const { data } = await db.from("content_pages").select("*").order("slug");
  return (
    <div className="space-y-6">
      <PageHeader
        title="Pages & policies"
        description="Format: '## Heading', '### Sub-heading', '- list item', **bold**, [link text](/path). Text in [square brackets] is a placeholder and is highlighted on the site until you replace it."
      />
      {(data ?? []).map((p) => {
        const placeholders = (p.body.match(/\[[^\]]+\](?!\()/g) ?? []).length;
        return (
          <Card key={p.slug} title={p.title} description={`/${p.slug}`} actions={placeholders > 0 ? <Badge tone="warning">{placeholders} placeholder(s) to complete</Badge> : <Badge tone="success">Complete</Badge>}>
            <details>
              <summary className="cursor-pointer text-sm text-muted">Edit page</summary>
              <ActionForm action={saveContentPage}>
                <input type="hidden" name="slug" value={p.slug} />
                <div className="mt-4 grid gap-3">
                  <Field label="Title"><input name="title" defaultValue={p.title} className={inputCls} /></Field>
                  <Field label="Summary"><input name="summary" defaultValue={p.summary ?? ""} className={inputCls} /></Field>
                  <Field label="Content"><textarea name="body" rows={18} defaultValue={p.body} className={`${inputCls} font-mono !text-xs`} /></Field>
                </div>
              </ActionForm>
            </details>
          </Card>
        );
      })}
    </div>
  );
}
