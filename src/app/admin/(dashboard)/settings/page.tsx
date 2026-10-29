import { isEmailConfigured } from "@/lib/groundmail";
import { requireStaffPage } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { isPaystackConfigured, paystackMode, env } from "@/lib/env";
import { saveBankTransferSettings, saveCheckoutSettings, saveStoreSettings } from "@/app/admin/actions/store";
import { bankTransferActive } from "@/lib/payments/bank-transfer";
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
            <Field label="WhatsApp number" hint="Used for every “Chat on WhatsApp” button and for payment confirmations."><input name="whatsapp" defaultValue={s.store.whatsapp ?? ""} className={inputCls} placeholder="0803 123 4567" /></Field>
            <Field label="Business hours"><input name="business_hours" defaultValue={s.store.business_hours ?? ""} className={inputCls} /></Field>
            <Field label="Business address" className="sm:col-span-2"><textarea name="business_address" rows={2} defaultValue={s.store.business_address ?? ""} className={inputCls} /></Field>
            <Field label="Instagram URL"><input name="instagram" type="url" defaultValue={s.store.instagram ?? ""} className={inputCls} /></Field>
            <Field label="TikTok URL"><input name="tiktok" type="url" defaultValue={s.store.tiktok ?? ""} className={inputCls} /></Field>
            <Field label="Facebook URL"><input name="facebook" type="url" defaultValue={s.store.facebook ?? ""} className={inputCls} /></Field>
            <Field label="X URL"><input name="x" type="url" defaultValue={s.store.x ?? ""} className={inputCls} /></Field>
          </div>
        </ActionForm>
      </Card>
      <section id="bank-transfer" className="scroll-mt-6">
        <Card
          title="Bank transfer payments"
          description="While this is on, customers pay by bank transfer at checkout: they see these details, transfer the money, and submit their reference. You confirm each one under Bank Transfers."
          actions={<Badge tone={bankTransferActive(s.bank_transfer) ? "success" : "neutral"}>{bankTransferActive(s.bank_transfer) ? "On" : "Off"}</Badge>}
        >
          <ActionForm action={saveBankTransferSettings}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="flex items-center gap-2 text-sm sm:col-span-2 lg:col-span-3"><input type="checkbox" name="enabled" defaultChecked={s.bank_transfer.enabled} className="size-4 accent-[#d94f91]" /> Accept payment by bank transfer</label>
              <Field label="Bank name"><input name="bank_name" defaultValue={s.bank_transfer.bank_name} maxLength={60} className={inputCls} placeholder="First Bank" /></Field>
              <Field label="Account name"><input name="account_name" defaultValue={s.bank_transfer.account_name} maxLength={120} className={inputCls} /></Field>
              <Field label="Account number" hint="10 digits (NUBAN)."><input name="account_number" defaultValue={s.bank_transfer.account_number} inputMode="numeric" maxLength={10} pattern="\d{10}" className={inputCls} /></Field>
              <Field label="Extra note for customers (optional)" className="sm:col-span-2 lg:col-span-3"><input name="note" defaultValue={s.bank_transfer.note} maxLength={300} className={inputCls} placeholder="e.g. Transfers are confirmed between 8am and 9pm." /></Field>
            </div>
          </ActionForm>
        </Card>
      </section>
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
        {!isPaystackConfigured() && !bankTransferActive(s.bank_transfer) && <p className="mt-4 text-xs text-danger">Turn on bank transfer above, or set PAYSTACK_SECRET_KEY and NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY, to accept payments.</p>}
        <p className="mt-4 text-xs text-muted">Admin access is granted from the Supabase SQL editor (see README) — it can&apos;t be granted from this dashboard.</p>
      </Card>
    </div>
  );
}
