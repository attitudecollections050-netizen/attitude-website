import { requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { deleteBanner, saveAnnouncement, saveBanner, saveHomeSettings } from "@/app/admin/actions/store";
import { ActionForm } from "@/components/admin/ActionForm";
import { Badge, Card, Field, PageHeader, inputCls } from "@/components/admin/ui";
import { SmartImage } from "@/components/ui/SmartImage";

export const metadata = { title: "Homepage" };

type B = { id: string; placement: "hero" | "promo" | "strip"; eyebrow: string | null; title: string; subtitle: string | null; cta_label: string | null; cta_href: string | null; image_url: string | null; sort_order: number; is_active: boolean; starts_at: string | null; ends_at: string | null };
const local = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16) : "");

function BannerFields({ b }: { b?: B }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {b && <input type="hidden" name="id" value={b.id} />}
      <Field label="Placement">
        <select name="placement" defaultValue={b?.placement ?? "promo"} className={inputCls}>
          <option value="hero">Hero (top of homepage)</option><option value="promo">Promo tile</option><option value="strip">Full-width strip</option>
        </select>
      </Field>
      <Field label="Eyebrow"><input name="eyebrow" defaultValue={b?.eyebrow ?? ""} className={inputCls} /></Field>
      <Field label="Title" className="sm:col-span-2"><input name="title" required defaultValue={b?.title} className={inputCls} /></Field>
      <Field label="Subtitle" className="sm:col-span-2"><input name="subtitle" defaultValue={b?.subtitle ?? ""} className={inputCls} /></Field>
      <Field label="Button label"><input name="cta_label" defaultValue={b?.cta_label ?? ""} className={inputCls} /></Field>
      <Field label="Button link" hint="/shop/women or https://…"><input name="cta_href" defaultValue={b?.cta_href ?? ""} className={inputCls} /></Field>
      <Field label="Image URL" className="sm:col-span-2"><input name="image_url" type="url" defaultValue={b?.image_url ?? ""} className={inputCls} placeholder="https://" /></Field>
      <Field label="Show from (UTC)"><input name="starts_at" type="datetime-local" defaultValue={local(b?.starts_at ?? null)} className={inputCls} /></Field>
      <Field label="Show until (UTC)"><input name="ends_at" type="datetime-local" defaultValue={local(b?.ends_at ?? null)} className={inputCls} /></Field>
      <Field label="Sort order"><input name="sort_order" type="number" min={0} defaultValue={b?.sort_order ?? 0} className={inputCls} /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={b?.is_active ?? true} className="size-4 accent-[#d94f91]" /> Active</label>
    </div>
  );
}

export default async function HomepageAdmin() {
  await requireStaffPage("settings:write");
  const db = await createClient();
  const [{ data }, settings] = await Promise.all([db.from("home_banners").select("*").order("placement").order("sort_order"), getSettings()]);
  return (
    <div className="space-y-6">
      <PageHeader title="Homepage" description="Announcement bar, hero, promotional banners and sections. Featured products are set per product; featured collections under Collections." />
      <Card title="Announcement bar">
        <ActionForm action={saveAnnouncement}>
          <div className="grid gap-3 sm:grid-cols-[1fr_16rem_auto]">
            <Field label="Text" hint="Scrolls across the top of the store. Separate messages with |, e.g. 10% DISCOUNT | FREE DELIVERY. Only advertise offers that checkout actually applies."><input name="text" defaultValue={settings.announcement.text} maxLength={160} className={inputCls} /></Field>
            <Field label="Link (optional)"><input name="href" defaultValue={settings.announcement.href ?? ""} className={inputCls} /></Field>
            <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" name="enabled" defaultChecked={settings.announcement.enabled} className="size-4 accent-[#d94f91]" /> Show</label>
          </div>
        </ActionForm>
      </Card>
      <Card title="Homepage sections">
        <ActionForm action={saveHomeSettings}>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="show_new_arrivals" defaultChecked={settings.home.show_new_arrivals} className="size-4 accent-[#d94f91]" /> New arrivals</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="show_featured_products" defaultChecked={settings.home.show_featured_products} className="size-4 accent-[#d94f91]" /> Featured products</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="show_best_sellers" defaultChecked={settings.home.show_best_sellers} className="size-4 accent-[#d94f91]" /> Best sellers (from real paid orders)</label>
            <Field label="Brand intro title" className="sm:col-span-3"><input name="intro_title" defaultValue={settings.home.intro_title} className={inputCls} /></Field>
            <Field label="Brand intro text" className="sm:col-span-3"><textarea name="intro_body" rows={3} defaultValue={settings.home.intro_body} className={inputCls} /></Field>
          </div>
        </ActionForm>
      </Card>
      <Card title="Add banner"><ActionForm action={saveBanner} submitLabel="Add banner" resetOnSuccess><BannerFields /></ActionForm></Card>
      {((data ?? []) as B[]).map((b) => (
        <Card key={b.id} title={b.title} actions={<div className="flex gap-2"><Badge tone="plum">{b.placement}</Badge>{!b.is_active && <Badge tone="warning">Inactive</Badge>}</div>}>
          <div className="grid gap-5 lg:grid-cols-[10rem_1fr]">
            <div className="relative aspect-[4/5] bg-neutral"><SmartImage src={b.image_url} alt="" fill sizes="160px" className="object-cover" /></div>
            <div>
              <ActionForm action={saveBanner}><BannerFields b={b} /></ActionForm>
              <ActionForm action={deleteBanner} submitLabel="Delete banner" variant="ghost" confirm="Delete this banner?"><input type="hidden" name="id" value={b.id} /></ActionForm>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
