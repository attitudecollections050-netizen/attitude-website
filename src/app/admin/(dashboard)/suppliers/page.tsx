import { requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { deleteSupplier, saveSupplier } from "@/app/admin/actions/store";
import { ActionForm } from "@/components/admin/ActionForm";
import { Badge, Card, Field, PageHeader, inputCls } from "@/components/admin/ui";

export const metadata = { title: "Suppliers" };

type S = { id: string; name: string; contact_name: string | null; contact_email: string | null; contact_phone: string | null; website: string | null; notes: string | null; is_active: boolean };

function Fields({ s }: { s?: S }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {s && <input type="hidden" name="id" value={s.id} />}
      <Field label="Name"><input name="name" required defaultValue={s?.name} className={inputCls} /></Field>
      <Field label="Contact person"><input name="contact_name" defaultValue={s?.contact_name ?? ""} className={inputCls} /></Field>
      <Field label="Email"><input name="contact_email" type="email" defaultValue={s?.contact_email ?? ""} className={inputCls} /></Field>
      <Field label="Phone"><input name="contact_phone" defaultValue={s?.contact_phone ?? ""} className={inputCls} /></Field>
      <Field label="Website"><input name="website" type="url" defaultValue={s?.website ?? ""} className={inputCls} /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={s?.is_active ?? true} className="size-4 accent-[#d94f91]" /> Active</label>
      <Field label="Notes" className="sm:col-span-2 lg:col-span-3"><textarea name="notes" rows={2} defaultValue={s?.notes ?? ""} className={inputCls} /></Field>
    </div>
  );
}

export default async function SuppliersPage() {
  await requireStaffPage("suppliers:write");
  const db = await createClient();
  const { data } = await db.from("suppliers").select("*").order("name");
  return (
    <div className="space-y-6">
      <PageHeader title="Suppliers" description="Dropshipping partners. Supplier details and costs are internal and never shown to customers. Supplier orders are placed manually — no supplier API is connected." />
      <Card title="Add supplier"><ActionForm action={saveSupplier} submitLabel="Add supplier" resetOnSuccess><Fields /></ActionForm></Card>
      {((data ?? []) as S[]).map((s) => (
        <Card key={s.id} title={s.name} actions={!s.is_active ? <Badge tone="warning">Inactive</Badge> : undefined}>
          <ActionForm action={saveSupplier}><Fields s={s} /></ActionForm>
          <ActionForm action={deleteSupplier} submitLabel="Delete supplier" variant="ghost" confirm="Delete this supplier? Linked products and orders keep their data but lose the link."><input type="hidden" name="id" value={s.id} /></ActionForm>
        </Card>
      ))}
    </div>
  );
}
