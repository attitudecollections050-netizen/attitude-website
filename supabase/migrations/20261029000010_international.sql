-- =====================================================================
-- International store: languages, countries and display currencies.
--
-- * Prices stay in NGN (kobo). Other currencies are DISPLAY currencies:
--   converted with validated exchange rates, never invented.
-- * Payments are charged in the payment currency (NGN unless the admin
--   enables more AND the payment provider account supports them).
-- * Orders keep a snapshot of the display currency/rate used, so history
--   never changes when rates move.
-- =====================================================================

-- Customer preferences (signed-in customers; guests use cookies) ---------
alter table public.profiles
  add column preferred_locale text check (preferred_locale ~ '^[a-z]{2}$'),
  add column preferred_country char(2) check (preferred_country ~ '^[A-Z]{2}$'),
  add column preferred_currency char(3) check (preferred_currency ~ '^[A-Z]{3}$');
grant update (preferred_locale, preferred_country, preferred_currency) on public.profiles to authenticated;

-- Currencies ---------------------------------------------------------------
create table public.currencies (
  code char(3) primary key check (code ~ '^[A-Z]{3}$'),
  name text not null,
  symbol text not null,
  is_enabled boolean not null default false,
  -- Optional adjustment applied on top of the exchange rate (basis points, 300 = +3%).
  markup_bps int not null default 0 check (markup_bps between -2000 and 5000),
  -- Used only when the rate provider is "manual": units of this currency per 1 NGN.
  manual_rate numeric(24, 12) check (manual_rate is null or manual_rate > 0),
  sort_order int not null default 100
);

insert into public.currencies (code, name, symbol, is_enabled, sort_order) values
  ('NGN', 'Nigerian naira', '₦', true, 0),
  ('USD', 'US dollar', '$', true, 10),
  ('GBP', 'British pound', '£', true, 20),
  ('EUR', 'Euro', '€', true, 30),
  ('CAD', 'Canadian dollar', 'C$', true, 40),
  ('GHS', 'Ghanaian cedi', 'GH₵', true, 50),
  ('ZAR', 'South African rand', 'R', true, 60),
  ('KES', 'Kenyan shilling', 'KSh', false, 70),
  ('AUD', 'Australian dollar', 'A$', false, 80),
  ('AED', 'UAE dirham', 'AED', false, 90),
  ('XOF', 'West African CFA franc', 'CFA', false, 100),
  ('XAF', 'Central African CFA franc', 'FCFA', false, 110),
  ('CNY', 'Chinese yuan', '¥', false, 120),
  ('INR', 'Indian rupee', '₹', false, 130),
  ('BRL', 'Brazilian real', 'R$', false, 140),
  ('SAR', 'Saudi riyal', 'SAR', false, 150),
  ('CHF', 'Swiss franc', 'CHF', false, 160),
  ('JPY', 'Japanese yen', '¥', false, 170);

-- NGN is the base currency: always enabled, never adjusted.
alter table public.currencies add constraint ngn_is_base
  check (code <> 'NGN' or (is_enabled and markup_bps = 0));

-- Latest validated rate per currency (units per 1 NGN) ----------------------
create table public.exchange_rates (
  currency char(3) primary key references public.currencies (code) on delete cascade,
  rate numeric(24, 12) not null check (rate > 0),
  source text not null,
  provider_updated_at timestamptz,
  fetched_at timestamptz not null default now()
);

-- Every refresh attempt, for "last successful update" and troubleshooting.
create table public.exchange_rate_log (
  id bigint generated always as identity primary key,
  source text not null,
  ok boolean not null,
  message text,
  currencies_updated int not null default 0,
  created_at timestamptz not null default now()
);
create index exchange_rate_log_created_idx on public.exchange_rate_log (created_at desc);

-- Translations ---------------------------------------------------------------
-- Admin overrides for interface text (bundled translation files are the default).
create table public.translation_overrides (
  locale text not null check (locale ~ '^[a-z]{2}$'),
  key text not null check (char_length(key) between 1 and 200),
  value text not null check (char_length(value) <= 2000),
  updated_at timestamptz not null default now(),
  primary key (locale, key)
);

-- Per-language product/category text, e.g. {"fr": {"name": "...", "description": "..."}}.
alter table public.products add column translations jsonb not null default '{}'::jsonb
  check (jsonb_typeof(translations) = 'object');
alter table public.categories add column translations jsonb not null default '{}'::jsonb
  check (jsonb_typeof(translations) = 'object');
alter table public.collections add column translations jsonb not null default '{}'::jsonb
  check (jsonb_typeof(translations) = 'object');

-- Order snapshot of what the customer saw ------------------------------------
alter table public.orders
  add column display_currency char(3),
  add column display_rate numeric(24, 12) check (display_rate is null or display_rate > 0),
  add column display_total numeric(18, 2),
  add column locale text check (locale is null or locale ~ '^[a-z]{2}$');

-- International settings (public: no secrets here; API keys live in env vars).
insert into public.store_settings (key, value, is_public) values
  ('intl', jsonb_build_object(
     'default_locale', 'en',
     'enabled_locales', jsonb_build_array('en', 'fr', 'es', 'pt', 'ar', 'de', 'zh'),
     'default_country', 'NG',
     'rate_provider', 'open_er_api',
     'auto_update', true,
     'max_rate_age_hours', 36,
     'payment_currencies', jsonb_build_array('NGN'),
     'payment_channels', jsonb_build_object(
        'NG', jsonb_build_array('card', 'bank', 'ussd', 'bank_transfer'),
        'default', jsonb_build_array('card'))
   ), true)
on conflict (key) do nothing;

-- RLS ---------------------------------------------------------------------------
alter table public.currencies enable row level security;
alter table public.exchange_rates enable row level security;
alter table public.exchange_rate_log enable row level security;
alter table public.translation_overrides enable row level security;

create policy "currencies: public read" on public.currencies for select using (true);
create policy "currencies: admin write" on public.currencies for all using (public.is_admin()) with check (public.is_admin());
create policy "exchange_rates: public read" on public.exchange_rates for select using (true);
create policy "exchange_rates: admin write" on public.exchange_rates for all using (public.is_admin()) with check (public.is_admin());
create policy "exchange_rate_log: admin read" on public.exchange_rate_log for select using (public.is_admin());
create policy "translation_overrides: public read" on public.translation_overrides for select using (true);
create policy "translation_overrides: admin write" on public.translation_overrides for all using (public.is_admin()) with check (public.is_admin());
