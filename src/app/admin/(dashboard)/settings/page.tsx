import { isEmailConfigured } from "@/lib/groundmail";
import { requireStaffPage } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { isPaystackConfigured, paystackMode, env } from "@/lib/env";
import { saveCheckoutSettings, saveStoreSettings } from "@/app/admin/actions/store";
import { ActionForm } from "@/components/admin/ActionForm";
import { Badge, Card, Field, PageHeader, inputCls } from "@/components/admin/ui";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireStaffPage("settings:write");
  const s = await getSettings();
  const mode = paystackMode();
  return (
    <div className="space-y-6">
      <PageHeader title="Store Settings" description="Leave unknown details blank — nothing is shown on the site until you fill it in." />
      <Card title="Store & customer support">
        <ActionForm action={saveStoreSettings}>
          <input type="hidden" name="currency" value="NGN" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Store name"><input name="name" defaultValue={s.store.name} className={inputCls} /></Field>
            <Field label="Tagline"><input name="tagline" defaultValue={s.store.tagline} className={inputCls} /></Field>
            <Field label="Currency" hint="Prices and payments are in Nigerian Naira."><input value="NGN (₦)" disabled className={inputCls} /></Field>
            <Field label="Support email"><input name="support_email" type="email" defaultValue={s.store.support_email ?? ""} className={inputCls} /></Field>
            <Field label="Support phone"><input name="support_phone" defaultValue={s.store.support_phone ?? ""} className={inputCls} /></Field>
            <Field label="WhatsApp number"><input name="whatsapp" defaultValue={s.store.whatsapp ?? ""} className={inputCls} placeholder="+234…" /></Field>
            <Field label="Business hours"><input name="business_hours" defaultValue={s.store.business_hours ?? ""} className={inputCls} /></Field>
            <Field label="Business address" className="sm:col-span-2"><textarea name="business_address" rows={2} defaultValue={s.store.business_address ?? ""} className={inputCls} /></Field>
            <Field label="Instagram URL"><input name="instagram" type="url" defaultValue={s.store.instagram ?? ""} className={inputCls} /></Field>
            <Field label="TikTok URL"><input name="tiktok" type="url" defaultValue={s.store.tiktok ?? ""} className={inputCls} /></Field>
            <Field label="Facebook URL"><input name="facebook" type="url" defaultValue={s.store.facebook ?? ""} className={inputCls} /></Field>
            <Field label="X URL"><input name="x" type="url" defaultValue={s.store.x ?? ""} className={inputCls} /></Field>
          </div>
        </ActionForm>
      </Card>
      <Card title="Checkout, tax & duties" description="Taxes are only charged if you configure them. Confirm your obligations with a qualified adviser.">
        <ActionForm action={saveCheckoutSettings}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="guest_checkout_enabled" defaultChecked={s.checkout.guest_checkout_enabled} className="size-4 accent-[#d94f91]" /> Allow guest checkout</label>
            <Field label="Max quantity per item"><input name="max_quantity_per_item" type="number" min={1} max={20} defaultValue={s.checkout.max_quantity_per_item} className={inputCls} /></Field>
            <Field label="Tax mode">
              <select name="mode" defaultValue={s.tax.mode} className={inputCls}>
                <option value="none">No tax</option><option value="inclusive">Included in prices</option><option value="exclusive">Added at checkout</option>
              </select>
            </Field>
            <Field label="Tax rate (%)"><input name="rate_percent" type="number" step="0.01" min={0} max={50} defaultValue={s.tax.rate_bps / 100} className={inputCls} /></Field>
            <Field label="Tax label"><input name="label" defaultValue={s.tax.label} className={inputCls} /></Field>
            <Field label="International duties notice" hint="Shown at checkout for non-Nigerian addresses." className="sm:col-span-2 lg:col-span-3"><textarea name="duties_notice" rows={2} defaultValue={s.tax.duties_notice} className={inputCls} /></Field>
          </div>
        </ActionForm>
      </Card>
      <Card title="Integrations" description="Configured with environment variables on your host — secrets are never stored in the database or shown here.">
        <ul className="space-y-3 text-sm">
          <li className="flex items-center justify-between gap-3">Paystack payments <Badge tone={mode === "live" ? "success" : mode === "test" ? "warning" : "danger"}>{mode === "unconfigured" ? "Not configured" : `${mode} mode`}</Badge></li>
          <li className="flex items-center justify-between gap-3">Paystack webhook URL <code className="text-xs">{env.siteUrl}/api/webhooks/paystack</code></li>
          <li className="flex items-center justify-between gap-3">Emails (Groundmail) <Badge tone={isEmailConfigured() ? "success" : "neutral"}>{isEmailConfigured() ? "Configured" : "Not configured"}</Badge></li>
          <li className="flex items-center justify-between gap-3">Live courier quotes <Badge>Not connected — manual rates</Badge></li>
          <li className="flex items-center justify-between gap-3">Supplier API <Badge>Not connected — manual fulfilment</Badge></li>
        </ul>
        {!isPaystackConfigured() && <p className="mt-4 text-xs text-danger">Set PAYSTACK_SECRET_KEY and NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY to accept payments.</p>}
        <p className="mt-4 text-xs text-muted">Admin access is granted from the Supabase SQL editor (see README) — it can&apos;t be granted from this dashboard.</p>
      </Card>
    </div>
  );
}
