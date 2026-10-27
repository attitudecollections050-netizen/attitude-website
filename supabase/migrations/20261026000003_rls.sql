-- =====================================================================
-- Row Level Security
--   * Customers can only read/write their own profile, addresses, orders.
--   * Supplier data, payments, fulfilment notes are staff/admin only.
--   * Carts, webhook events and rate limits have NO policies: only the
--     server (service role) can touch them.
-- =====================================================================

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.addresses enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_variants enable row level security;
alter table public.inventory enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.collections enable row level security;
alter table public.collection_products enable row level security;
alter table public.suppliers enable row level security;
alter table public.product_supplier_info enable row level security;
alter table public.discounts enable row level security;
alter table public.countries enable row level security;
alter table public.regions enable row level security;
alter table public.shipping_zones enable row level security;
alter table public.shipping_zone_locations enable row level security;
alter table public.shipping_methods enable row level security;
alter table public.shipping_rates enable row level security;
alter table public.shipping_rate_tiers enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;
alter table public.shipment_tracking enable row level security;
alter table public.fulfilments enable row level security;
alter table public.payments enable row level security;
alter table public.webhook_events enable row level security;
alter table public.discount_redemptions enable row level security;
alter table public.store_settings enable row level security;
alter table public.content_pages enable row level security;
alter table public.home_banners enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.contact_messages enable row level security;
alter table public.rate_limits enable row level security;

-- Profiles ------------------------------------------------------------
create policy "profiles: read own" on public.profiles
  for select using (id = auth.uid() or public.is_staff());
create policy "profiles: update own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Roles: users may see their own roles; nobody can write via the API.
create policy "user_roles: read own" on public.user_roles
  for select using (user_id = auth.uid() or public.is_admin());

-- Addresses -----------------------------------------------------------
create policy "addresses: own" on public.addresses
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Catalogue (public read of live data; admin write) -------------------
create policy "categories: public read" on public.categories
  for select using (is_active or public.is_staff());
create policy "categories: admin write" on public.categories
  for all using (public.is_admin()) with check (public.is_admin());

create policy "products: public read" on public.products
  for select using (status = 'published' or public.is_staff());
create policy "products: admin write" on public.products
  for all using (public.is_admin()) with check (public.is_admin());

create policy "product_images: public read" on public.product_images
  for select using (exists (select 1 from public.products p where p.id = product_id
                             and (p.status = 'published' or public.is_staff())));
create policy "product_images: admin write" on public.product_images
  for all using (public.is_admin()) with check (public.is_admin());

create policy "product_variants: public read" on public.product_variants
  for select using (exists (select 1 from public.products p where p.id = product_id
                             and (p.status = 'published' or public.is_staff())));
create policy "product_variants: admin write" on public.product_variants
  for all using (public.is_admin()) with check (public.is_admin());

create policy "inventory: public read" on public.inventory
  for select using (exists (select 1 from public.product_variants v join public.products p on p.id = v.product_id
                             where v.id = variant_id and (p.status = 'published' or public.is_staff())));
-- Inventory writes go through admin_set_stock() so every change is logged.

create policy "inventory_movements: staff read" on public.inventory_movements
  for select using (public.is_staff());

create policy "collections: public read" on public.collections
  for select using (is_active or public.is_staff());
create policy "collections: admin write" on public.collections
  for all using (public.is_admin()) with check (public.is_admin());
create policy "collection_products: public read" on public.collection_products
  for select using (true);
create policy "collection_products: admin write" on public.collection_products
  for all using (public.is_admin()) with check (public.is_admin());

-- Suppliers (never public) ----------------------------------------------
create policy "suppliers: staff read" on public.suppliers
  for select using (public.is_staff());
create policy "suppliers: admin write" on public.suppliers
  for all using (public.is_admin()) with check (public.is_admin());
create policy "product_supplier_info: staff read" on public.product_supplier_info
  for select using (public.is_staff());
create policy "product_supplier_info: admin write" on public.product_supplier_info
  for all using (public.is_admin()) with check (public.is_admin());

-- Discounts (validated server-side; admin managed) ----------------------
create policy "discounts: admin" on public.discounts
  for all using (public.is_admin()) with check (public.is_admin());
create policy "discount_redemptions: admin read" on public.discount_redemptions
  for select using (public.is_admin());

-- Shipping configuration --------------------------------------------------
create policy "countries: public read" on public.countries for select using (true);
create policy "countries: admin write" on public.countries
  for all using (public.is_admin()) with check (public.is_admin());
create policy "regions: public read" on public.regions for select using (true);
create policy "regions: admin write" on public.regions
  for all using (public.is_admin()) with check (public.is_admin());
create policy "shipping_zones: public read" on public.shipping_zones
  for select using (is_active or public.is_staff());
create policy "shipping_zones: admin write" on public.shipping_zones
  for all using (public.is_admin()) with check (public.is_admin());
create policy "shipping_zone_locations: public read" on public.shipping_zone_locations for select using (true);
create policy "shipping_zone_locations: admin write" on public.shipping_zone_locations
  for all using (public.is_admin()) with check (public.is_admin());
create policy "shipping_methods: public read" on public.shipping_methods
  for select using (is_active or public.is_staff());
create policy "shipping_methods: admin write" on public.shipping_methods
  for all using (public.is_admin()) with check (public.is_admin());
create policy "shipping_rates: public read" on public.shipping_rates
  for select using (is_active or public.is_staff());
create policy "shipping_rates: admin write" on public.shipping_rates
  for all using (public.is_admin()) with check (public.is_admin());
create policy "shipping_rate_tiers: public read" on public.shipping_rate_tiers for select using (true);
create policy "shipping_rate_tiers: admin write" on public.shipping_rate_tiers
  for all using (public.is_admin()) with check (public.is_admin());

-- Orders: customers read their own; changes go through server functions --
create policy "orders: read own" on public.orders
  for select using (user_id = auth.uid() or public.is_staff());

create policy "order_items: read own" on public.order_items
  for select using (exists (select 1 from public.orders o where o.id = order_id
                             and (o.user_id = auth.uid() or public.is_staff())));

create policy "order_status_history: read own" on public.order_status_history
  for select using (exists (select 1 from public.orders o where o.id = order_id
                             and (o.user_id = auth.uid() or public.is_staff())));

create policy "shipment_tracking: read own" on public.shipment_tracking
  for select using (exists (select 1 from public.orders o where o.id = order_id
                             and (o.user_id = auth.uid() or public.is_staff())));
create policy "shipment_tracking: staff write" on public.shipment_tracking
  for all using (public.is_staff()) with check (public.is_staff());

create policy "fulfilments: staff" on public.fulfilments
  for all using (public.is_staff()) with check (public.is_staff());

create policy "payments: staff read" on public.payments
  for select using (public.is_staff());

-- Content & settings --------------------------------------------------------
create policy "store_settings: public read" on public.store_settings
  for select using (is_public or public.is_admin());
create policy "store_settings: admin write" on public.store_settings
  for all using (public.is_admin()) with check (public.is_admin());

create policy "content_pages: public read" on public.content_pages for select using (true);
create policy "content_pages: admin write" on public.content_pages
  for all using (public.is_admin()) with check (public.is_admin());

create policy "home_banners: public read" on public.home_banners
  for select using (is_active or public.is_admin());
create policy "home_banners: admin write" on public.home_banners
  for all using (public.is_admin()) with check (public.is_admin());

create policy "newsletter: admin read" on public.newsletter_subscribers
  for select using (public.is_admin());
create policy "newsletter: admin delete" on public.newsletter_subscribers
  for delete using (public.is_admin());

create policy "contact_messages: staff read" on public.contact_messages
  for select using (public.is_staff());
create policy "contact_messages: staff update" on public.contact_messages
  for update using (public.is_staff()) with check (public.is_staff());

-- Column-level protection: customers can only edit safe profile columns.
revoke update on public.profiles from anon, authenticated;
grant update (full_name, phone, marketing_opt_in) on public.profiles to authenticated;
