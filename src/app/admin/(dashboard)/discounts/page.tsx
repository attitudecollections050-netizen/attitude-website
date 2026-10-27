import { requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatMoney, toMajorString } from "@/lib/money";
import { deleteDiscount, saveDiscount } from "@/app/admin/actions/store";
import { ActionForm } from "@/components/admin/ActionForm";
import { Badge, Card, Field, PageHeader, inputCls } from "@/components/admin/ui";

export const metadata = { title: "Discounts" };

type D = { id: string; code: string; description: string | null; type: "percentage" | "fixed" | "free_shipping"; value: number; min_subtotal: number; starts_at: string | null; ends_at: string | null; usage_limit: number | null; usage_count: number; is_active: boolean };
const local = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16) : "");

function Fields({ d }: { d?: D }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {d && <input type="hidden" name="id" value={d.id} />}
      <Field label="Code"><input name="code" required defaultValue={d?.code} className={`${inputCls} uppercase`} /></Field>
      <Field label="Type">
        <select name="type" defaultValue={d?.type ?? "percentage"} className={inputCls}>
          <option value="percentage">Percentage off</option><option value="fixed">Fixed amount off (₦)</option><option value="free_shipping">Free delivery</option>
        </select>
      </Field>
      <Field label="Value" hint="% (1–100) or ₦ amount; ignored for free delivery"><input name="value" defaultValue={d ? (d.type === "fixed" ? toMajorString(d.value) : String(d.value || "")) : ""} className={inputCls} /></Field>
      <Field label="Minimum subtotal (₦)"><input name="min_subtotal" defaultValue={d ? toMajorString(d.min_subtotal) : ""} className={inputCls} /></Field>
      <Field label="Starts (UTC)"><input name="starts_at" type="datetime-local" defaultValue={local(d?.starts_at ?? null)} className={inputCls} /></Field>
      <Field label="Ends (UTC)"><input name="ends_at" type="datetime-local" defaultValue={local(d?.ends_at ?? null)} className={inputCls} /></Field>
      <Field label="Usage limit" hint="Blank = unlimited"><input name="usage_limit" type="number" min={1} defaultValue={d?.usage_limit ?? ""} className={inputCls} /></Field>
      <Field label="Description (internal)"><input name="description" defaultValue={d?.description ?? ""} className={inputCls} /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={d?.is_active ?? true} className="size-4 accent-[#d94f91]" /> Active</label>
    </div>
  );
}

export default async function DiscountsPage() {
  await requireStaffPage("discounts:write");
  const db = await createClient();
  const { data } = await db.from("discounts").select("*").order("created_at", { ascending: false });
  return (
    <div className="space-y-6">
      <PageHeader title="Discount codes" description="Codes are validated on the server at checkout. Usage is counted only when a payment is verified." />
      <Card title="New discount code"><ActionForm action={saveDiscount} submitLabel="Create code" resetOnSuccess><Fields /></ActionForm></Card>
      {((data ?? []) as D[]).map((d) => (
        <Card
          key={d.id}
          title={d.code}
          description={`${d.type === "percentage" ? `${d.value}% off` : d.type === "fixed" ? `${formatMoney(d.value)} off` : "Free delivery"}${d.min_subtotal ? ` · min ${formatMoney(d.min_subtotal)}` : ""} · used ${d.usage_count}${d.usage_limit ? `/${d.usage_limit}` : ""}`}
          actions={<Badge tone={d.is_active ? "success" : "neutral"}>{d.is_active ? "Active" : "Inactive"}</Badge>}
        >
          <details><summary className="cursor-pointer text-sm text-muted">Edit</summary>
            <div className="mt-4"><ActionForm action={saveDiscount}><Fields d={d} /></ActionForm></div>
            <ActionForm action={deleteDiscount} submitLabel="Delete" variant="ghost" confirm="Delete this code?"><input type="hidden" name="id" value={d.id} /></ActionForm>
          </details>
        </Card>
      ))}
    </div>
  );
}
