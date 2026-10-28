# ATTITUDE COLLECTIONS

A premium fashion e-commerce store for men's and women's clothing, bags, women's shoes and sneakers. It ships across Nigeria and to international destinations the owner enables. Products are dropshipped from suppliers.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Motion (Framer Motion) · Supabase (PostgreSQL, Auth, Storage) · Paystack · Vercel.

---

## What's included

- **Storefront:** homepage (editable announcement bar, hero, category cards, new arrivals, featured collections, the Attitude edit, best sellers from real paid orders, promo banners, newsletter, support links), shop-all, category and subcategory pages, product pages, search, collections, cart, checkout, order confirmation, order tracking, About, Contact, FAQ, Shipping, Returns, Privacy, Terms, custom 404 and error pages.
- **Catalogue:** server-side search and filters (category, size, colour, price, availability, sale), sorting (newest, price, best-selling — shown only once genuine sales exist), pagination, quick-add, colour-aware galleries, stock messaging and backorder control.
- **Cart and checkout:** database-backed cart (httpOnly cookie, merged on sign-in), discount codes, stock warnings, address fields that adapt to the country, and a live delivery quote. **Every price, discount, shipping fee and total is recalculated on the server**, then re-verified inside the database before the order is created.
- **Shipping:** a database-driven calculator for Nigerian states and cities and for international zones. It supports flat, weight-based and order-value rates, free-delivery thresholds and delivery windows. A destination with no rate is refused, never charged ₦0.
- **Payments:** Paystack redirect checkout with server-side verification, HMAC-SHA512 webhook signatures, duplicate-webhook protection, idempotent finalisation, failed-payment retry and amount-mismatch rejection.
- **Accounts:** register, sign in, sign out, password reset, email confirmation (when enabled in Supabase), profile, saved addresses, order history and order details. Guest checkout can be switched on or off.
- **Admin (`/admin`):** overview with live figures and launch warnings, orders (search, filter, status updates, tracking, fulfilment, refunds/cancellations, CSV export), products (images, variants, stock, supplier info, publish/archive/delete), categories, collections, shipping, discounts, suppliers, homepage, pages and policies, messages and newsletter, settings. Access is checked on the server **and** enforced by Row Level Security.

---

## 1. Prerequisites

- Node.js **20.9+** (22 recommended)
- A Supabase project (free tier is fine)
- A Paystack account (test keys work immediately; live keys need a verified business)
- Optional: a Resend account for order-confirmation emails

## 2. Local setup

```bash
npm install
cp .env.example .env.local      # fill in the values (see the comments in the file)
```

### Create the database

**Option A: Supabase CLI (recommended)**

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push            # applies supabase/migrations/*
# Optional demo products:
psql "<your-connection-string>" -f supabase/seed.sql
```

**Option B: SQL editor.** In Supabase → SQL Editor, run each file in `supabase/migrations/` **in filename order**. Optionally run `supabase/seed.sql` afterwards for demo products.

### Configure Supabase Auth

In Supabase → Authentication → URL Configuration:

- **Site URL:** `https://your-domain.com` (or `http://localhost:3000` locally)
- **Redirect URLs:** add `https://your-domain.com/auth/confirm` and `http://localhost:3000/auth/confirm`

Email confirmation is controlled under Authentication → Providers → Email. It is recommended in production. Set up custom SMTP so auth emails come from your domain.

### Create your administrator account

1. Start the app (`npm run dev`) and register at `/account/register` with the owner's email.
2. In Supabase → SQL Editor, run:
   ```sql
   select public.grant_role_by_email('owner@your-domain.com', 'admin');
   -- optional: order-handling staff with no catalogue, settings or shipping access
   select public.grant_role_by_email('helper@your-domain.com', 'staff');
   ```
3. Sign in at `/admin/login`.

Nobody can give themselves admin access from the website. The `user_roles` table has no write policy, and the grant function can only run from the SQL editor (service role).

### Run

```bash
npm run dev          # http://localhost:3000
```

## 3. Paystack

1. In Paystack → Settings → API Keys & Webhooks, copy the **test** keys into `PAYSTACK_SECRET_KEY` and `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`.
2. Set the **Webhook URL** to `https://your-domain.com/api/webhooks/paystack`. Paystack signs webhooks with your secret key, so no separate webhook secret is needed.
3. Place a test order with a [Paystack test card](https://paystack.com/docs/payments/test-payments/). Confirm the order shows **Paid** in `/admin/orders` and stock went down by the quantity bought.
4. Only then switch to **live** keys. While test keys are active, checkout shows a "Test mode" notice.

How payment is trusted:

- The order is created server-side with prices from the database. Paystack is initialised for that exact amount.
- The customer returns to `/checkout/callback`, and the server **verifies the transaction with Paystack's API**.
- Webhooks are signature-checked, de-duplicated, then also re-verified with the API. The webhook body is never trusted for amounts.
- `finalize_payment()` rejects amount or currency mismatches and is idempotent. Double callbacks or repeated webhooks never double-count stock or discount usage.

**International cards and currencies.** The store charges in NGN. Whether foreign cards or other currencies are accepted depends on your Paystack account (international payments must be enabled by Paystack). The site does not claim international payment support on its own.

## 4. Shipping — action required before launch

The seed creates **development defaults only**:

| Zone | Covers | Fee |
| --- | --- | --- |
| Same-city delivery (Lagos) | Lagos State, city "Lagos" | ₦2,500 |
| Nigeria — other destinations | Rest of Nigeria | ₦4,000 |

These are **sample values, not verified courier prices**. Both are flagged "needs review", and the admin overview warns you until you confirm them. In **Admin → Shipping**:

1. Change the same-city zone to your actual dispatch city or cities, and set your real fees and delivery windows.
2. Tick **"Price confirmed by me"** on each rate.
3. For international delivery: enable the country, create a zone, add it as a location, and add a verified rate. **No international rates are configured.** Until you add one, checkout tells customers delivery is unavailable and blocks payment.
4. Use **"Test the calculator"** to check any address.

All rates are **manual**. No live courier API is connected; checkout labels them "Rate set by Attitude Collections".

## 5. Content you must complete

Placeholders are shown in `[square brackets]` and highlighted on the site until replaced:

- **Admin → Pages & policies:** About, FAQ, Shipping, Returns & Refunds, Privacy, Terms. Return windows, refund times, dispatch times, governing law, business name and address are left as placeholders. Have the legal pages reviewed by a qualified adviser (for example under the Nigeria Data Protection Act 2023).
- **Admin → Settings:** support email, phone, WhatsApp, business address and hours, social links. Nothing is displayed until set.
- **Admin → Settings → tax:** off by default. Choose "included in prices" or "added at checkout" only if you are required to charge VAT.
- **Admin → Homepage:** banners and imagery.

## 6. Products and images

- `supabase/seed.sql` holds **demo products**: invented names and prices, with remote Unsplash images. Remove them before launch:
  ```sql
  delete from public.products where 'demo' = any(tags);
  ```
- Add real products in **Admin → Products**. Upload photos (JPEG/PNG/WebP/AVIF, up to 5 MB, validated by file contents) to Supabase Storage, or paste supplier image URLs. A remote image host must be added to `images.remotePatterns` in `next.config.ts` before it can be displayed.
- Supplier, supplier reference and supplier cost live in the product's **Supplier (internal)** section and on each order's **Fulfilment (internal)** card. They are never shown to customers.

## 7. Fulfilment workflow (manual dropshipping)

1. A verified payment moves the order to **Paid**, takes the stock, and creates a fulfilment record.
2. Place the order with your supplier yourself. Record the supplier order reference and cost, and move the status through *Awaiting Supplier → Ordered from Supplier*.
3. Add the carrier, tracking number or URL, then mark **Shipped → In Transit → Delivered**. Customers see the tracking details and any public notes.
4. Refunds are issued in the Paystack dashboard, then recorded here with **Refunded**, optionally returning items to stock.

No supplier API is integrated, so supplier orders are never placed automatically. Supplier orders and fulfilment have their own tables, so an automated integration can be added later.

## 7a. Analytics, reports and customer feedback

**Analytics & Reports** (admin only) shows orders, paid/pending/failed payments, sales revenue, average order value, gross vs net sales, discounts, refunds, shipping and tax, pending deliveries, best sellers, category performance, visitors, page views, traffic sources, devices, countries and a conversion funnel, for Today / 7 / 30 / 90 days / this month / last month / this year / any custom range. Every chart and table can be exported as CSV. Definitions are shown at the bottom of the page.

- **Timezone:** days, weeks (Monday start) and months use West Africa Time (`Africa/Lagos`, UTC+1).
- **Sales** come straight from orders whose payment was verified on the server (callback or signed webhook). Orders are counted by the date placed; sales by the date paid. Unpaid, pending, failed, cancelled and refunded orders are never counted as sales. Currencies are reported separately (no exchange-rate conversion).
- **Visitor analytics is first-party and consent-based.** No third-party service or credentials are needed. A small notice asks visitors to allow analytics; only then is a random visitor ID cookie set (13 months). Visitors who decline — or whose browser sends Global Privacy Control / Do Not Track — are not tracked, so real traffic is higher than shown. No IP address, user-agent string, name or email is stored with events; bots are ignored; country comes from Vercel's `x-vercel-ip-country` header. Update your **Privacy Policy** page to mention this analytics cookie.
- **Purchases** in the funnel are recorded by the database when a payment is verified, at most once per order, and only for visitors who allowed analytics.

**Customer Reviews & Feedback** (admin and staff) collects five-heart ratings with positive / neutral / negative experience, optional comment, reason, suggestion and name preference, from:
- the `/feedback` page (linked in the footer);
- a feedback invitation: on desktop when the pointer leaves the top of the window after 20 seconds on the site; on phones and tablets a small dismissible card after ~75 seconds and two pages. It never appears on cart, checkout, payment, order or account pages, shows at most once per visit, waits 14 days after "Maybe later" (60 days after two dismissals) and 120 days after feedback is sent. Browsers do not signal every exit, so not every leaving visitor will see it;
- **product reviews** on product pages for signed-in customers, marked *Verified Purchase* only when their account has a paid, non-refunded order for that product. One review per product per account.

Reviews are never published automatically: only product reviews where the customer ticked consent and an admin pressed **Publish review** appear on the site. Staff can mark feedback reviewed, add private notes, flag spam/abuse (hides it but keeps the record), reply publicly and export CSV. Ratings and customer wording can't be edited. Submissions are validated on the server, rate-limited, and protected by a hidden spam-trap field and a minimum fill time; link-stuffed text is flagged for moderation rather than discarded.

## 8. Deploying to Vercel

1. Push the repository to GitHub and import it in Vercel. The framework is detected automatically.
2. Add every variable from `.env.example` under Project → Settings → Environment Variables. Keep secret ones unprefixed.
3. Set `NEXT_PUBLIC_SITE_URL` to your production domain.
4. Deploy, then update the Supabase Auth URLs and the Paystack webhook URL to the production domain.

Any Node.js host that runs `next build && next start` also works.

## 9. Scripts and tests

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Develop, build and run |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript |
| `npm run test:unit` | Pricing, discounts, Nigerian and international shipping, unsupported destinations, cart and stock rules, checkout validation, server-side order totals, idempotency keys, Paystack signature checks, the payment verification flow, duplicate webhooks, permissions, upload validation, safe content rendering |
| `npm run test:db` | Runs every migration against a **throwaway** PostgreSQL database and tests catalogue search and filters, RLS (customers isolated, supplier/payment data hidden, no self-granted admin), order creation (idempotency, tampered prices, stock, invalid discounts), payment finalisation (mismatch, idempotency, duplicate payments, inventory conflicts), status rules, tracking privacy and rate limiting. Requires `TEST_DATABASE_URL` pointing at a disposable Postgres 15+ server; skipped otherwise |
| `tests/unit/analytics.test.ts`, `feedback.test.ts` | Report date presets and custom ranges in the business timezone, traffic-source/device classification, path and privacy-signal handling, CSV escaping, feedback validation, spam rules, popup frequency limits and quiet pages |
| `tests/db/analytics.test.ts` | Revenue maths (gross, net, refunds, cancellations, shipping, tax, AOV, per currency), payment status counts, timezone-correct date filters and buckets, best sellers and categories, visitors vs visits vs page views, the funnel, once-only purchase events, admin-only reports, feedback summaries, public review moderation, customer isolation from feedback and notes, and verified-purchase checks |
| `npm run check` | Lint, type-check and all tests |

## 10. Project layout

```
src/app/(store)/          storefront routes (home, shop, products, cart, checkout, account, policies…)
src/app/admin/            admin login, dashboard routes and server actions
src/app/api/webhooks/     Paystack webhook
src/app/api/analytics/    first-party analytics collector (consented visitors only)
src/app/api/admin/        CSV exports (orders, reports, feedback)
src/app/actions/          storefront server actions (cart, checkout, shipping, auth, contact…)
src/lib/                  pricing, shipping calculator, payments, cart, orders, catalogue queries, auth
src/components/           UI, layout, product, cart, checkout, admin components
supabase/migrations/      schema, functions, RLS, reference data, storage
supabase/seed.sql         optional demo catalogue
tests/                    unit and database tests
docs/DATABASE.md          schema documentation
```

## 11. Needs your credentials or decisions

- Supabase project URL and keys; run the migrations; set the Auth redirect URLs; create the admin account.
- Paystack test keys, then live keys after testing; set the webhook URL; enable international payments with Paystack if needed.
- **Verified shipping prices** for Nigeria and any international destinations.
- Business details, policies, returns terms and tax decisions.
- Real product photography and supplier products (replace the demo catalogue).
- Optional: Resend API key and a verified sender domain for order emails; custom SMTP for Supabase Auth emails.
