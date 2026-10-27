-- =====================================================================
-- ATTITUDE COLLECTIONS — core schema
-- All money values are integers in MINOR currency units (kobo for NGN).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type public.app_role as enum ('admin', 'staff');
create type public.product_status as enum ('draft', 'published', 'archived');
create type public.order_status as enum (
  'pending_payment', 'paid', 'processing', 'awaiting_supplier',
  'ordered_from_supplier', 'shipped', 'in_transit', 'delivered',
  'cancelled', 'refunded'
);
create type public.payment_status as enum ('unpaid', 'pending', 'paid', 'failed', 'refunded', 'partially_refunded');
create type public.payment_attempt_status as enum ('initialized', 'success', 'failed', 'abandoned');
create type public.fulfilment_status as enum (
  'not_started', 'awaiting_supplier', 'ordered_from_supplier', 'shipped', 'delivered', 'cancelled'
);
create type public.discount_type as enum ('percentage', 'fixed', 'free_shipping');
create type public.shipping_rate_type as enum ('flat', 'weight_based', 'order_value_based');
create type public.banner_placement as enum ('hero', 'promo', 'strip');

-- ---------------------------------------------------------------------
-- Generic updated_at trigger
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Customers, profiles, roles
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text check (char_length(full_name) <= 120),
  phone text check (char_length(phone) <= 32),
  marketing_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Roles are granted ONLY by the database owner / service role (see README).
-- No RLS policy lets a signed-in user insert or update rows here.
create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text check (char_length(label) <= 40),
  full_name text not null check (char_length(full_name) between 2 and 120),
  phone text not null check (char_length(phone) between 6 and 32),
  country_code char(2) not null,
  region text not null default '' check (char_length(region) <= 100),
  city text not null check (char_length(city) between 1 and 100),
  line1 text not null check (char_length(line1) between 3 and 200),
  line2 text check (char_length(line2) <= 200),
  postal_code text check (char_length(postal_code) <= 20),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index addresses_user_idx on public.addresses (user_id);

-- ---------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories (id) on delete restrict,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 80),
  description text check (char_length(description) <= 600),
  image_url text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index categories_top_slug_uq on public.categories (slug) where parent_id is null;
create unique index categories_child_slug_uq on public.categories (parent_id, slug) where parent_id is not null;
create index categories_parent_idx on public.categories (parent_id);
create trigger categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();

-- array_to_string is only STABLE; tags are plain text so this wrapper is safe.
create or replace function public.tags_to_text(p_tags text[]) returns text
language sql immutable parallel safe as $$
  select coalesce(array_to_string(p_tags, ' '), '');
$$;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 2 and 140),
  description text not null default '' check (char_length(description) <= 5000),
  details text check (char_length(details) <= 5000),
  category_id uuid not null references public.categories (id) on delete restrict,
  price int not null check (price > 0),
  sale_price int check (sale_price > 0),
  weight_grams int not null default 500 check (weight_grams >= 0),
  status public.product_status not null default 'draft',
  is_featured boolean not null default false,
  allow_backorder boolean not null default false,
  tags text[] not null default '{}',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple', public.tags_to_text(tags)), 'B') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'C')
  ) stored,
  constraint sale_price_below_price check (sale_price is null or sale_price < price)
);
create index products_category_idx on public.products (category_id);
create index products_status_published_idx on public.products (status, published_at desc);
create index products_featured_idx on public.products (is_featured) where is_featured;
create index products_search_idx on public.products using gin (search);
create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();

create or replace function public.products_set_published_at() returns trigger
language plpgsql as $$
begin
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;
create trigger products_published_at before insert or update on public.products
  for each row execute function public.products_set_published_at();

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  url text not null,
  storage_path text,
  alt text not null default '' check (char_length(alt) <= 200),
  color text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index product_images_product_idx on public.product_images (product_id, sort_order);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  sku text not null unique check (char_length(sku) between 1 and 64),
  size text check (char_length(size) <= 20),
  color text check (char_length(color) <= 40),
  color_hex text check (color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique nulls not distinct (product_id, size, color)
);
create index product_variants_product_idx on public.product_variants (product_id);
create index product_variants_size_idx on public.product_variants (size);
create index product_variants_color_idx on public.product_variants (lower(color));

create table public.inventory (
  variant_id uuid primary key references public.product_variants (id) on delete cascade,
  -- may go negative only for products that explicitly allow backorders
  on_hand int not null default 0,
  low_stock_threshold int not null default 3 check (low_stock_threshold >= 0),
  updated_at timestamptz not null default now()
);
create trigger inventory_updated_at before update on public.inventory
  for each row execute function public.set_updated_at();

create table public.inventory_movements (
  id bigint generated always as identity primary key,
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  delta int not null,
  reason text not null check (reason in ('order', 'manual_adjustment', 'restock', 'cancellation', 'refund')),
  order_id uuid,
  note text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index inventory_movements_variant_idx on public.inventory_movements (variant_id, created_at desc);

-- Featured collections (curated sets for the homepage)
create table public.collections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 80),
  description text check (char_length(description) <= 600),
  image_url text,
  is_featured boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create table public.collection_products (
  collection_id uuid not null references public.collections (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  sort_order int not null default 0,
  primary key (collection_id, product_id)
);

-- ---------------------------------------------------------------------
-- Suppliers & dropshipping (ADMIN ONLY — never exposed to customers)
-- ---------------------------------------------------------------------
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  contact_name text,
  contact_email text,
  contact_phone text,
  website text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.product_supplier_info (
  product_id uuid primary key references public.products (id) on delete cascade,
  supplier_id uuid references public.suppliers (id) on delete set null,
  supplier_product_ref text,
  supplier_product_url text,
  supplier_cost int check (supplier_cost >= 0),
  supplier_currency char(3) not null default 'NGN',
  internal_notes text,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Discounts
-- ---------------------------------------------------------------------
create table public.discounts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9_-]{3,32}$'),
  description text,
  type public.discount_type not null,
  -- percentage: 1..100 ; fixed: minor units ; free_shipping: ignored (0)
  value int not null default 0 check (value >= 0),
  min_subtotal int not null default 0 check (min_subtotal >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  usage_limit int check (usage_limit > 0),
  usage_count int not null default 0 check (usage_count >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint discount_percentage_range check (type <> 'percentage' or value between 1 and 100),
  constraint discount_fixed_positive check (type <> 'fixed' or value > 0),
  constraint discount_window check (ends_at is null or starts_at is null or ends_at > starts_at)
);

-- ---------------------------------------------------------------------
-- Shipping
-- ---------------------------------------------------------------------
create table public.countries (
  code char(2) primary key check (code ~ '^[A-Z]{2}$'),
  name text not null,
  is_enabled boolean not null default false,
  region_label text not null default 'State / Province / Region',
  region_required boolean not null default false,
  postal_label text not null default 'Postal code',
  postal_required boolean not null default false,
  sort_order int not null default 100
);

create table public.regions (
  id uuid primary key default gen_random_uuid(),
  country_code char(2) not null references public.countries (code) on delete cascade,
  code text not null,
  name text not null,
  unique (country_code, code)
);

create table public.shipping_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  description text,
  priority int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- A zone matches a destination when ANY of its locations match.
-- city set   => country + region + city must match (most specific)
-- region set => country + region must match
-- otherwise  => country must match
create table public.shipping_zone_locations (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references public.shipping_zones (id) on delete cascade,
  country_code char(2) not null references public.countries (code) on delete cascade,
  region_code text,
  city text,
  constraint city_requires_region check (city is null or region_code is not null)
);
create index shipping_zone_locations_lookup on public.shipping_zone_locations (country_code, region_code);

create table public.shipping_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 60),
  description text,
  is_active boolean not null default true,
  sort_order int not null default 0
);

create table public.shipping_rates (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references public.shipping_zones (id) on delete cascade,
  method_id uuid not null references public.shipping_methods (id) on delete restrict,
  rate_type public.shipping_rate_type not null default 'flat',
  fee int not null default 0 check (fee >= 0),  -- flat fee (or fallback for tiers)
  currency char(3) not null default 'NGN',
  min_days int check (min_days >= 0),
  max_days int check (max_days >= 0),
  free_shipping_threshold int check (free_shipping_threshold > 0),
  is_active boolean not null default true,
  is_manual boolean not null default true,      -- manual rate, NOT a live courier quote
  needs_review boolean not null default true,   -- true until the owner confirms the price
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (zone_id, method_id),
  constraint days_order check (min_days is null or max_days is null or max_days >= min_days)
);
create trigger shipping_rates_updated_at before update on public.shipping_rates
  for each row execute function public.set_updated_at();

-- For weight_based rates: min/max are grams. For order_value_based: minor units.
create table public.shipping_rate_tiers (
  id uuid primary key default gen_random_uuid(),
  rate_id uuid not null references public.shipping_rates (id) on delete cascade,
  min_value int not null default 0 check (min_value >= 0),
  max_value int check (max_value is null or max_value > min_value),
  fee int not null check (fee >= 0)
);
create index shipping_rate_tiers_rate_idx on public.shipping_rate_tiers (rate_id, min_value);

-- ---------------------------------------------------------------------
-- Carts (server-side only; accessed with the service role keyed by an
-- unguessable httpOnly cookie id, so no customer-facing RLS policies)
-- ---------------------------------------------------------------------
create table public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  discount_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index carts_user_idx on public.carts (user_id);
create trigger carts_updated_at before update on public.carts
  for each row execute function public.set_updated_at();

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts (id) on delete cascade,
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  quantity int not null check (quantity between 1 and 20),
  created_at timestamptz not null default now(),
  unique (cart_id, variant_id)
);

-- ---------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------
create sequence public.order_number_seq start 100001;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('AC' || nextval('public.order_number_seq')::text),
  user_id uuid references auth.users (id) on delete set null,
  cart_id uuid,  -- cart to clear once payment is verified
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text not null,
  customer_name text not null,
  shipping_address jsonb not null,
  delivery_instructions text check (char_length(delivery_instructions) <= 500),
  shipping_method_name text not null,
  shipping_rate_id uuid references public.shipping_rates (id) on delete set null,
  shipping_is_manual boolean not null default true,
  shipping_min_days int,
  shipping_max_days int,
  currency char(3) not null default 'NGN',
  subtotal int not null check (subtotal >= 0),
  discount_total int not null default 0 check (discount_total >= 0),
  discount_code text,
  shipping_fee int not null check (shipping_fee >= 0),
  tax_total int not null default 0 check (tax_total >= 0),
  total int not null check (total >= 0),
  status public.order_status not null default 'pending_payment',
  payment_status public.payment_status not null default 'unpaid',
  inventory_conflict boolean not null default false,
  idempotency_key text not null unique,
  access_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  paid_at timestamptz,
  cancelled_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint total_consistent check (total = subtotal - discount_total + shipping_fee + tax_total)
);
create index orders_user_idx on public.orders (user_id, created_at desc);
create index orders_status_idx on public.orders (status, created_at desc);
create index orders_email_idx on public.orders (lower(email));
create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  variant_id uuid references public.product_variants (id) on delete set null,
  product_name text not null,
  product_slug text,
  variant_label text,
  sku text,
  image_url text,
  unit_price int not null check (unit_price >= 0),
  quantity int not null check (quantity > 0),
  line_total int not null check (line_total >= 0),
  constraint line_total_consistent check (line_total = unit_price * quantity)
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);

-- Customer-visible timeline
create table public.order_status_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  status public.order_status not null,
  public_note text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index order_status_history_order_idx on public.order_status_history (order_id, created_at);

-- Customer-visible tracking
create table public.shipment_tracking (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  carrier text,
  tracking_number text,
  tracking_url text check (tracking_url is null or tracking_url ~* '^https?://'),
  dispatched_at timestamptz,
  created_at timestamptz not null default now()
);
create index shipment_tracking_order_idx on public.shipment_tracking (order_id);

-- ADMIN ONLY fulfilment records
create table public.fulfilments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  supplier_id uuid references public.suppliers (id) on delete set null,
  supplier_order_ref text,
  supplier_cost_total int check (supplier_cost_total >= 0),
  status public.fulfilment_status not null default 'not_started',
  dispatched_at timestamptz,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger fulfilments_updated_at before update on public.fulfilments
  for each row execute function public.set_updated_at();

-- ADMIN ONLY payment attempts
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  provider text not null default 'paystack',
  reference text not null unique,
  amount int not null check (amount > 0),
  currency char(3) not null,
  status public.payment_attempt_status not null default 'initialized',
  provider_transaction_id text,
  channel text,
  paid_at timestamptz,
  failure_reason text,
  authorization_url text,
  raw_verification jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_order_idx on public.payments (order_id);
create trigger payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

create table public.webhook_events (
  id bigint generated always as identity primary key,
  provider text not null,
  dedupe_key text not null,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz not null default now(),
  unique (provider, dedupe_key)
);

create table public.discount_redemptions (
  id uuid primary key default gen_random_uuid(),
  discount_id uuid not null references public.discounts (id) on delete cascade,
  order_id uuid not null unique references public.orders (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Content, settings, marketing
-- ---------------------------------------------------------------------
create table public.store_settings (
  key text primary key check (key ~ '^[a-z0-9_]+$'),
  value jsonb not null,
  is_public boolean not null default true,
  updated_at timestamptz not null default now()
);
create trigger store_settings_updated_at before update on public.store_settings
  for each row execute function public.set_updated_at();

create table public.content_pages (
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null,
  summary text,
  body text not null default '',   -- lightweight markdown (headings, paragraphs, lists)
  updated_at timestamptz not null default now()
);
create trigger content_pages_updated_at before update on public.content_pages
  for each row execute function public.set_updated_at();

create table public.home_banners (
  id uuid primary key default gen_random_uuid(),
  placement public.banner_placement not null,
  eyebrow text,
  title text not null check (char_length(title) <= 120),
  subtitle text check (char_length(subtitle) <= 300),
  cta_label text check (char_length(cta_label) <= 40),
  cta_href text check (cta_href is null or cta_href ~ '^(/|https://)'),
  image_url text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  source text,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index newsletter_email_uq on public.newsletter_subscribers (lower(email));

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  order_number text,
  subject text not null check (char_length(subject) between 1 and 160),
  message text not null check (char_length(message) between 10 and 5000),
  status text not null default 'new' check (status in ('new', 'in_progress', 'resolved')),
  created_at timestamptz not null default now()
);

create table public.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  count int not null
);
