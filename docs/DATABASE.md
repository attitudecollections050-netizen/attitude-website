# Database schema

PostgreSQL on Supabase. Migrations live in `supabase/migrations/` and run in filename order:

| File | Contents |
| --- | --- |
| `…01_schema.sql` | Enums, tables, constraints, indexes, `updated_at` triggers |
| `…02_functions.sql` | Role helpers, catalogue search, order creation, payment finalisation, admin operations, order tracking, rate limiting |
| `…03_rls.sql` | Row Level Security on every table, plus column grants |
| `…04_reference_data.sql` | Countries (Nigeria enabled), Nigerian states and other regions, category tree, **development-default** shipping rates, store settings, homepage banners, editable policy pages |
| `…05_storage.sql` | Public `product-images` bucket (5 MB, JPEG/PNG/WebP/AVIF) with admin-only write policies |
| `supabase/seed.sql` | **Optional demo catalogue** (35 products tagged `demo`). Not needed in production |

## Money

All money is stored as **integers in minor units** (kobo: ₦4,000 = `400000`). The store currency is NGN. A `CHECK` constraint enforces
`orders.total = subtotal − discount_total + shipping_fee + tax_total` and `order_items.line_total = unit_price × quantity`.

## Tables

### Customers & access
| Table | Purpose | Who can read / write (RLS) |
| --- | --- | --- |
| `profiles` | Name, phone, marketing opt-in (1:1 with `auth.users`, created by trigger) | Owner reads/updates `full_name`, `phone`, `marketing_opt_in` only; staff read |
| `user_roles` | `admin` or `staff` per user | Owner can read own roles. **No one can insert/update via the API** — roles are granted with `grant_role_by_email()` from the SQL editor |
| `addresses` | Saved delivery addresses | Owner only |

### Catalogue
| Table | Purpose |
| --- | --- |
| `categories` | Two-level tree (`parent_id`). Top-level = navigation; children = subcategories |
| `products` | Name, slug, description, `price`, optional `sale_price` (< price), `weight_grams`, `status` (draft/published/archived), `is_featured`, `allow_backorder`, `tags`, generated full-text `search` column |
| `product_images` | Ordered images; optional `color` ties an image to a colour; `storage_path` for uploaded files |
| `product_variants` | Size/colour combinations with unique `sku` (`unique nulls not distinct (product_id, size, color)`) |
| `inventory` | `on_hand` + `low_stock_threshold` per variant. Changed only via `admin_set_stock()` or payment finalisation |
| `inventory_movements` | Audit log of every stock change (order, manual adjustment, cancellation, refund) |
| `collections`, `collection_products` | Curated featured collections |

Public (anon) users can read only **published** products and their images/variants/stock, **active** categories and collections.

### Dropshipping (staff/admin only — never readable by customers)
| Table | Purpose |
| --- | --- |
| `suppliers` | Supplier contacts |
| `product_supplier_info` | Per product: supplier, supplier product reference/URL, unit cost, internal notes |
| `fulfilments` | Per order: supplier, supplier order reference, supplier cost, fulfilment status, dispatch date, internal notes |

### Shipping
| Table | Purpose |
| --- | --- |
| `countries` | ISO countries; `is_enabled` controls checkout availability; per-country address labels and required fields |
| `regions` | States/provinces (all 36 Nigerian states + FCT, plus US, CA, AU, GH, KE, ZA, IN, AE) |
| `shipping_zones` | Named zones with a `priority` tie-breaker |
| `shipping_zone_locations` | What a zone covers: whole country, a state/region, or a city within a region. Most specific match wins (city > region > country) |
| `shipping_methods` | e.g. Standard, Express |
| `shipping_rates` | One per zone × method: `flat`, `weight_based` or `order_value_based`; fee; optional delivery window and free-delivery threshold; `is_manual` (always true — no live courier API); `needs_review` (true until the owner confirms the price) |
| `shipping_rate_tiers` | Ranges for weight (grams) or order value (kobo) with a fee |

### Cart, orders & payments
| Table | Purpose | Access |
| --- | --- | --- |
| `carts`, `cart_items` | Server-side carts keyed by an unguessable httpOnly cookie | **Service role only** (no RLS policies) |
| `orders` | Snapshot of customer, address, shipping choice and totals; `status`, `payment_status`, `idempotency_key` (unique), `access_token` for guest confirmation links, `inventory_conflict` flag | Customer reads own (`user_id = auth.uid()`); staff read; **no direct updates** — changes go through functions |
| `order_items` | Line snapshot (name, variant label, SKU, unit price, qty) | Same as orders |
| `order_status_history` | Customer-visible timeline with optional public note | Same as orders |
| `shipment_tracking` | Carrier, tracking number/URL, dispatch date (customer-visible) | Customer reads own; staff write |
| `payments` | Each Paystack attempt: reference (unique), amount, status, channel, verification snapshot | Staff read only |
| `webhook_events` | Received webhooks, unique on `(provider, dedupe_key)` for duplicate protection | Service role only |
| `discounts`, `discount_redemptions` | Codes (percentage/fixed/free delivery, min subtotal, window, usage limit) and one redemption per paid order | Admin only; validated server-side |

### Analytics & feedback
| Table | Purpose | Access |
| --- | --- | --- |
| `analytics_events` | First-party events: `page_view`, `product_view`, `add_to_cart`, `checkout_start`, `purchase`; random `visitor_id` and `session_id`, path (no query string), product, referrer host, source/UTM (first page of a visit only), device category, country. Unique index makes `purchase` once per order | Insert: server (service role) only. Read: **admin only** |
| `orders.analytics_visitor_id` | Consenting visitor's ID copied at checkout; a trigger writes the `purchase` event when `payment_status` becomes `paid` | — |
| `feedback` | Site feedback and product reviews: 1–5 hearts, sentiment, optional comment/reason/suggestion, display-name preference, publish consent, verified purchase, moderation (`pending`/`approved`/`hidden`), flag, public response | Insert: server only (validated). Staff read; staff may update **only** status/moderation/flag/response columns |
| `feedback_notes` | Private staff notes on feedback | Staff only |

### Content & marketing
`store_settings` (key/value JSON: announcement, store/support details, checkout, tax, homepage), `content_pages` (About, FAQ, policies — Markdown-like text with `[placeholders]`), `home_banners`, `newsletter_subscribers`, `contact_messages`, `rate_limits`.

### International (migration 10)
| Table / column | Purpose | Access |
| --- | --- | --- |
| `currencies` | Display currencies: enabled flag, markup (basis points), optional manual rate. NGN is the base and can't be disabled or marked up | Public read, admin write |
| `exchange_rates` | Latest validated rate per currency (units per ₦1), source and fetch time | Public read, admin write (server updates use the service role) |
| `exchange_rate_log` | Every rate-update attempt and its result | Admin read |
| `translation_overrides` | Admin wording that replaces built-in interface text, per language and key | Public read, admin write |
| `products/categories/collections.translations` | Per-language name/description (`{"fr": {"name": …}}`) | Same as the row |
| `profiles.preferred_locale/country/currency` | Signed-in customers' saved choices | Own profile only |
| `orders.display_currency/display_rate/display_total/locale` | Snapshot of what the shopper saw; `total`/`currency` remain the NGN amount charged | Same as the order |
| `store_settings` key `intl` | Enabled languages, default language/country, rate provider, expiry, payment currency (NGN) and Paystack channels by country | Public read (no secrets) |

## Key functions

| Function | Caller | What it does |
| --- | --- | --- |
| `catalog_search(...)` | anon (security invoker) | Search + category/size/colour/price/availability/sale filters, sort by newest/price/popularity, pagination with total count |
| `catalog_facets(category)` | anon | Sizes, colours, price range, and whether genuine sales data exists |
| `product_sales_counts()` | anon | Units sold per product from **paid, non-cancelled** orders only (aggregate, no personal data) |
| `create_order(order, items)` | service role | Idempotent on `idempotency_key`; re-checks every variant is published/active, **unit prices equal current DB prices**, stock is sufficient (unless backorder), subtotal matches, discount is valid |
| `finalize_payment(reference, amount, currency, …)` | service role | Locks the payment row; rejects amount/currency mismatch; idempotent (`already_processed`); flags a second successful payment as `duplicate_payment`; decrements stock once (flags `inventory_conflict` instead of overselling); counts discount usage once; creates the fulfilment record |
| `record_payment_failure(reference, …)` | service role | Marks a failed attempt; never downgrades a verified payment |
| `admin_update_order_status(order, status, note, restock)` | staff | Enforces allowed transitions — **orders can never be set to Paid manually**; refunds/cancellations can return stock that was actually taken |
| `admin_set_stock(variant, qty, note)` | admin | Sets stock and logs the movement |
| `admin_dashboard_stats()` | staff | Overview figures |
| `admin_analytics_report(from, to, tz, bucket)` | admin | Sales (gross, discounts, refunds, cancellations, net, shipping, tax, revenue, AOV per currency), order and payment status counts, pending deliveries, time series, traffic, funnel, top pages/products, sources, referrers, devices, countries, best sellers and categories |
| `admin_feedback_report(from, to, tz, bucket)` | staff | Totals, average hearts, sentiment counts, distribution, trend, common complaints, recent suggestions |
| `admin_customers(query, limit, offset)` | staff | Registered and guest customers by email with order counts and spend |
| `public_product_reviews(product)` / `public_product_review_summary(product)` | anon | Only approved, consented, unflagged reviews; never exposes user IDs or private fields |
| `verified_purchase_order(user, product)` | service role | Paid, non-cancelled, non-refunded order containing the product, used for the Verified Purchase badge |
| `track_order(order_number, email)` | service role | Privacy-limited tracking projection (no street address, phone or payment data) — only when both values match |
| `check_rate_limit(key, max, window)` | service role | Fixed-window limiter shared across serverless instances |
| `grant_role_by_email(email, role)` | SQL editor only | Bootstrap administrators |

## Order status flow

```
pending_payment ──(verified payment only)──▶ paid ─▶ processing ─▶ awaiting_supplier ─▶ ordered_from_supplier ─▶ shipped ─▶ in_transit ─▶ delivered
       │                                       │                                                                                │
       └──▶ cancelled                          └──▶ cancelled / refunded  (refunded allowed from any paid state) ◀──────────────┘
```

Customers see supplier steps as "Processing".
