-- Attitude Collections: database updates 12, 13, 14 and 15
-- (staff management, staff earnings, bank transfer, owner-only revenue).
-- Paste all of this into Supabase → SQL Editor → New query, then press Run. Run it once.

-- ===== 20261030000012_staff_management =====
-- =====================================================================
-- Staff management: the owner invites Product Staff by email.
--
-- * The owner is the 'admin' role (granted automatically to the store's
--   owner address, migration 7). Owner roles can't be removed through the
--   app, and the last owner can never be removed at all.
-- * Product Staff may manage products, variants, stock and product images,
--   and nothing else: orders, customers, payments, reports, settings,
--   shipping, discounts, suppliers and staff stay owner-only.
-- * Deleting products needs an extra per-person permission (off by default).
-- =====================================================================

create table public.staff_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text check (full_name is null or char_length(full_name) <= 120),
  role public.app_role not null check (role <> 'admin'),
  status text not null default 'invited' check (status in ('invited', 'active', 'disabled')),
  can_delete_products boolean not null default false,
  -- True when the account was created by the invitation (not an existing customer account).
  created_by_invite boolean not null default true,
  invited_by uuid references auth.users (id) on delete set null,
  invited_at timestamptz not null default now(),
  last_invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  disabled_at timestamptz,
  updated_at timestamptz not null default now()
);
create index staff_members_email_idx on public.staff_members (lower(email));

alter table public.staff_members enable row level security;
-- Owner manages staff; a staff member can see only their own record. Writes go through
-- owner-checked server actions using the service role, so there is no write policy here.
create policy "staff_members: owner read" on public.staff_members
  for select using (public.is_admin() or user_id = auth.uid());

-- Permission helpers --------------------------------------------------------
create or replace function public.can_manage_products() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1
    from public.user_roles r
    join public.staff_members s on s.user_id = r.user_id and s.status <> 'disabled'
    where r.user_id = auth.uid() and r.role = 'product_staff'
  );
$$;

create or replace function public.can_delete_products() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1
    from public.user_roles r
    join public.staff_members s on s.user_id = r.user_id and s.status <> 'disabled' and s.can_delete_products
    where r.user_id = auth.uid() and r.role = 'product_staff'
  );
$$;
-- Visitors evaluate the product read policies too, so they must be able to call these
-- (they only ever answer for the signed-in user, and are always false for visitors).
grant execute on function public.can_manage_products() to anon, authenticated;
grant execute on function public.can_delete_products() to anon, authenticated;

-- Owner protection --------------------------------------------------------------
create or replace function public.protect_owner_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.role = 'admin' and not exists (
    select 1 from public.user_roles where role = 'admin' and user_id <> old.user_id
  ) then
    raise exception 'The store owner role cannot be removed.' using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
create trigger user_roles_protect_owner
  before delete or update on public.user_roles
  for each row execute function public.protect_owner_role();

create or replace function public.staff_not_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.user_roles where user_id = new.user_id and role = 'admin') then
    raise exception 'The owner account cannot be managed as staff.' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger staff_members_not_owner
  before insert or update on public.staff_members
  for each row execute function public.staff_not_owner();
revoke execute on function public.protect_owner_role() from public, anon, authenticated;
revoke execute on function public.staff_not_owner() from public, anon, authenticated;

-- Product data: owner or Product Staff ---------------------------------------
drop policy "products: public read" on public.products;
create policy "products: public read" on public.products
  for select using (status = 'published' or public.is_staff() or public.can_manage_products());
drop policy "products: admin write" on public.products;
create policy "products: manage insert" on public.products
  for insert with check (public.can_manage_products());
create policy "products: manage update" on public.products
  for update using (public.can_manage_products()) with check (public.can_manage_products());
create policy "products: delete" on public.products
  for delete using (public.can_delete_products());

drop policy "product_images: public read" on public.product_images;
create policy "product_images: public read" on public.product_images
  for select using (exists (select 1 from public.products p where p.id = product_id
                             and (p.status = 'published' or public.is_staff() or public.can_manage_products())));
drop policy "product_images: admin write" on public.product_images;
create policy "product_images: manage" on public.product_images
  for all using (public.can_manage_products()) with check (public.can_manage_products());

drop policy "product_variants: public read" on public.product_variants;
create policy "product_variants: public read" on public.product_variants
  for select using (exists (select 1 from public.products p where p.id = product_id
                             and (p.status = 'published' or public.is_staff() or public.can_manage_products())));
drop policy "product_variants: admin write" on public.product_variants;
create policy "product_variants: manage" on public.product_variants
  for all using (public.can_manage_products()) with check (public.can_manage_products());

drop policy "inventory: public read" on public.inventory;
create policy "inventory: public read" on public.inventory
  for select using (exists (select 1 from public.product_variants v join public.products p on p.id = v.product_id
                             where v.id = variant_id and (p.status = 'published' or public.is_staff() or public.can_manage_products())));

-- Product Staff pick categories for products (read only; categories stay owner-managed).
drop policy "categories: public read" on public.categories;
create policy "categories: public read" on public.categories
  for select using (is_active or public.is_staff() or public.can_manage_products());

-- Stock changes (logged) are allowed for the owner and Product Staff.
create or replace function public.admin_set_stock(p_variant_id uuid, p_on_hand int, p_note text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_old int;
begin
  if not public.can_manage_products() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_on_hand < 0 then
    raise exception 'stock_negative' using errcode = 'P0001';
  end if;
  select on_hand into v_old from public.inventory where variant_id = p_variant_id for update;
  if not found then
    insert into public.inventory (variant_id, on_hand) values (p_variant_id, p_on_hand);
    v_old := 0;
  else
    update public.inventory set on_hand = p_on_hand where variant_id = p_variant_id;
  end if;
  if p_on_hand <> v_old then
    insert into public.inventory_movements (variant_id, delta, reason, note, created_by)
    values (p_variant_id, p_on_hand - v_old, 'manual_adjustment', p_note, auth.uid());
  end if;
end;
$$;

-- Product image storage: owner or Product Staff, and only the product-images bucket.
drop policy "product-images: admin insert" on storage.objects;
drop policy "product-images: admin update" on storage.objects;
drop policy "product-images: admin delete" on storage.objects;
create policy "product-images: manage insert" on storage.objects
  for insert with check (bucket_id = 'product-images' and public.can_manage_products());
create policy "product-images: manage update" on storage.objects
  for update using (bucket_id = 'product-images' and public.can_manage_products());
create policy "product-images: manage delete" on storage.objects
  for delete using (bucket_id = 'product-images' and public.can_manage_products());
-- Size and type limits are enforced by the bucket (5 MB; JPEG, PNG, WebP, AVIF) and by the server.
update storage.buckets set file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
where id = 'product-images';

insert into supabase_migrations.schema_migrations (version, name) values ('20261030000012', 'staff_management') on conflict do nothing;

-- ===== 20261030000013_staff_earnings =====
-- =====================================================================
-- Product Staff earnings: each product remembers who added it.
--
-- * added_by / added_by_email / added_by_name are stamped by the database
--   from the signed-in account; the browser can't choose or change them.
-- * Product Staff see and edit only the products they added (published
--   products stay public for everyone, as before). The owner sees all.
-- * staff_product_stats() returns a person's own counts, or everyone's
--   for the owner. Staff can never read other people's numbers.
-- =====================================================================

alter table public.products
  add column added_by uuid references auth.users (id) on delete set null,
  add column added_by_email text,
  add column added_by_name text;
create index products_added_by_idx on public.products (added_by);

create or replace function public.stamp_product_creator() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.added_by := auth.uid();
      select u.email, coalesce(nullif(p.full_name, ''), u.raw_user_meta_data ->> 'full_name')
        into new.added_by_email, new.added_by_name
      from auth.users u left join public.profiles p on p.id = u.id
      where u.id = auth.uid();
    end if;
  elsif auth.uid() is not null then
    -- Signed-in users (owner included) can't rewrite who added a product.
    new.added_by := old.added_by;
    new.added_by_email := old.added_by_email;
    new.added_by_name := old.added_by_name;
  end if;
  return new;
end;
$$;
revoke execute on function public.stamp_product_creator() from public, anon, authenticated;
create trigger products_stamp_creator
  before insert or update on public.products
  for each row execute function public.stamp_product_creator();

-- May the signed-in person edit this product? Owner: any. Product Staff: their own.
create or replace function public.can_edit_product(p_product_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or (
    public.can_manage_products()
    and exists (select 1 from public.products where id = p_product_id and added_by = auth.uid())
  );
$$;
grant execute on function public.can_edit_product(uuid) to anon, authenticated;

-- Storage objects are named "<product id>/<file>".
create or replace function public.can_edit_product_file(p_name text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_folder text := split_part(p_name, '/', 1);
begin
  if public.is_admin() then return true; end if;
  if v_folder !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
  return public.can_edit_product(v_folder::uuid);
end;
$$;
grant execute on function public.can_edit_product_file(text) to authenticated;

-- Products ----------------------------------------------------------------------
drop policy "products: public read" on public.products;
create policy "products: public read" on public.products
  for select using (status = 'published' or public.is_staff() or (public.can_manage_products() and added_by = auth.uid()));
drop policy "products: manage update" on public.products;
create policy "products: manage update" on public.products
  for update using (public.is_admin() or (public.can_manage_products() and added_by = auth.uid()))
  with check (public.is_admin() or (public.can_manage_products() and added_by = auth.uid()));
drop policy "products: delete" on public.products;
create policy "products: delete" on public.products
  for delete using (public.is_admin() or (public.can_delete_products() and added_by = auth.uid()));

drop policy "product_images: public read" on public.product_images;
create policy "product_images: public read" on public.product_images
  for select using (exists (select 1 from public.products p where p.id = product_id and (p.status = 'published' or public.is_staff()))
                    or public.can_edit_product(product_id));
drop policy "product_images: manage" on public.product_images;
create policy "product_images: manage" on public.product_images
  for all using (public.can_edit_product(product_id)) with check (public.can_edit_product(product_id));

drop policy "product_variants: public read" on public.product_variants;
create policy "product_variants: public read" on public.product_variants
  for select using (exists (select 1 from public.products p where p.id = product_id and (p.status = 'published' or public.is_staff()))
                    or public.can_edit_product(product_id));
drop policy "product_variants: manage" on public.product_variants;
create policy "product_variants: manage" on public.product_variants
  for all using (public.can_edit_product(product_id)) with check (public.can_edit_product(product_id));

drop policy "inventory: public read" on public.inventory;
create policy "inventory: public read" on public.inventory
  for select using (exists (select 1 from public.product_variants v join public.products p on p.id = v.product_id
                             where v.id = variant_id and (p.status = 'published' or public.is_staff() or public.can_edit_product(p.id))));

create or replace function public.admin_set_stock(p_variant_id uuid, p_on_hand int, p_note text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_old int;
begin
  if not public.can_edit_product((select product_id from public.product_variants where id = p_variant_id)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_on_hand < 0 then
    raise exception 'stock_negative' using errcode = 'P0001';
  end if;
  select on_hand into v_old from public.inventory where variant_id = p_variant_id for update;
  if not found then
    insert into public.inventory (variant_id, on_hand) values (p_variant_id, p_on_hand);
    v_old := 0;
  else
    update public.inventory set on_hand = p_on_hand where variant_id = p_variant_id;
  end if;
  if p_on_hand <> v_old then
    insert into public.inventory_movements (variant_id, delta, reason, note, created_by)
    values (p_variant_id, p_on_hand - v_old, 'manual_adjustment', p_note, auth.uid());
  end if;
end;
$$;

-- Product image files: only inside a product folder the person may edit.
drop policy "product-images: manage insert" on storage.objects;
drop policy "product-images: manage update" on storage.objects;
drop policy "product-images: manage delete" on storage.objects;
create policy "product-images: manage insert" on storage.objects
  for insert with check (bucket_id = 'product-images' and public.can_edit_product_file(name));
create policy "product-images: manage update" on storage.objects
  for update using (bucket_id = 'product-images' and public.can_edit_product_file(name));
create policy "product-images: manage delete" on storage.objects
  for delete using (bucket_id = 'product-images' and public.can_edit_product_file(name));

-- Counts behind the earnings (the reward rule itself lives in the app).
-- p_user_id null = everyone (owner only); otherwise that person (themselves, or the owner).
create or replace function public.staff_product_stats(p_user_id uuid default null)
returns table (user_id uuid, products_added int, live_products int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() and (p_user_id is null or p_user_id <> auth.uid() or not public.can_manage_products()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select p.added_by, count(*) filter (where p.status <> 'archived')::int, count(*) filter (where p.status = 'published')::int
    from public.products p
    where p.added_by is not null and (p_user_id is null or p.added_by = p_user_id)
    group by p.added_by;
end;
$$;
revoke execute on function public.staff_product_stats(uuid) from public, anon;
grant execute on function public.staff_product_stats(uuid) to authenticated;

insert into supabase_migrations.schema_migrations (version, name) values ('20261030000013', 'staff_earnings') on conflict do nothing;

-- ===== 20261030000014_bank_transfer =====
-- =====================================================================
-- Manual bank transfer payments.
--
-- * The customer pays into the store's bank account, then submits the
--   transfer details (name, amount, reference, WhatsApp, optional receipt
--   screenshot). Each submission is a payment_claims row: pending until the
--   owner checks the bank app and confirms or declines it.
-- * Confirming runs the same finalize_payment() as card payments: the order
--   becomes Paid, stock is committed and fulfilment starts. The amount
--   recorded is always the order total from the database.
-- * Only the owner can see or review claims. Customers submit through the
--   server (which checks the order's private access token), never directly.
-- =====================================================================

alter table public.orders
  add column payment_method text not null default 'paystack' check (payment_method in ('paystack', 'bank_transfer'));

create table public.payment_claims (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  payment_id uuid not null references public.payments (id) on delete cascade,
  customer_name text not null check (char_length(customer_name) between 2 and 120),
  amount_paid int not null check (amount_paid > 0),
  transfer_reference text not null check (char_length(transfer_reference) between 4 and 64),
  whatsapp text not null check (char_length(whatsapp) between 7 and 32),
  proof_path text,
  status text not null default 'pending' check (status in ('pending', 'verified', 'declined')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 500),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index payment_claims_order_idx on public.payment_claims (order_id);
create index payment_claims_status_idx on public.payment_claims (status, created_at desc);
-- One bank reference can only back one live claim (stops the same receipt being reused).
create unique index payment_claims_reference_live_idx
  on public.payment_claims (upper(regexp_replace(transfer_reference, '\s', '', 'g')))
  where status <> 'declined';

alter table public.payment_claims enable row level security;
create policy "payment_claims: owner read" on public.payment_claims for select using (public.is_admin());

-- Owner confirms or declines a claim.
create or replace function public.admin_review_payment_claim(p_claim_id uuid, p_decision text, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_claim public.payment_claims;
  v_payment public.payments;
  v_order public.orders;
  v_result jsonb := '{}'::jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_decision not in ('verified', 'declined') then
    raise exception 'invalid_decision' using errcode = 'P0001';
  end if;
  select * into v_claim from public.payment_claims where id = p_claim_id for update;
  if not found then
    raise exception 'claim_not_found' using errcode = 'P0001';
  end if;
  if v_claim.status <> 'pending' then
    raise exception 'already_reviewed' using errcode = 'P0001';
  end if;
  select * into v_payment from public.payments where id = v_claim.payment_id;
  select * into v_order from public.orders where id = v_claim.order_id;

  if p_decision = 'verified' then
    v_result := public.finalize_payment(
      v_payment.reference, v_order.total, v_order.currency, v_claim.transfer_reference, 'bank_transfer', now(),
      jsonb_build_object('claim_id', v_claim.id, 'amount_paid', v_claim.amount_paid, 'reviewed_by', auth.uid())
    );
    if not coalesce((v_result ->> 'ok')::boolean, false) then
      raise exception 'finalize_failed: %', v_result ->> 'code' using errcode = 'P0001';
    end if;
  else
    -- Back to "not paid" (unless another submission is still waiting) so the customer can try again.
    if not exists (select 1 from public.payment_claims where order_id = v_order.id and status = 'pending' and id <> v_claim.id) then
      update public.orders set payment_status = 'unpaid' where id = v_order.id and payment_status = 'pending';
    end if;
    insert into public.order_status_history (order_id, status, public_note)
    values (v_order.id, v_order.status, 'We couldn''t confirm your bank transfer yet. Please check the reference and submit it again.');
  end if;

  update public.payment_claims
     set status = p_decision, admin_note = nullif(trim(coalesce(p_note, '')), ''), reviewed_by = auth.uid(), reviewed_at = now()
   where id = v_claim.id;

  return v_result || jsonb_build_object('ok', true, 'decision', p_decision, 'order_id', v_order.id, 'order_number', v_order.order_number);
end;
$$;
revoke execute on function public.admin_review_payment_claim(uuid, text, text) from public, anon;
grant execute on function public.admin_review_payment_claim(uuid, text, text) to authenticated;

-- Receipt screenshots: private bucket, server access only (no policies = no API access).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Bank details shown at checkout (public by design: customers need them to pay).
insert into public.store_settings (key, value, is_public)
values ('bank_transfer', '{"enabled": true, "bank_name": "First Bank", "account_name": "OKONYE JUSTICE JESSICA NKEM", "account_number": "3043027979", "note": ""}', true)
on conflict (key) do nothing;

insert into supabase_migrations.schema_migrations (version, name) values ('20261030000014', 'bank_transfer') on conflict do nothing;

-- ===== 20261030000015_owner_only_revenue =====
-- =====================================================================
-- Sales revenue is for the store owner only.
--
-- is_store_owner(): the signed-in person has the owner (admin) role AND is
-- the store's owner address. admin_dashboard_stats() now leaves revenue
-- out (null) for everyone else, so staff can't read it even by calling the
-- function directly.
-- =====================================================================

create or replace function public.is_store_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() and exists (
    select 1 from auth.users where id = auth.uid() and lower(email) = 'attitudecollections050@gmail.com'
  );
$$;
revoke execute on function public.is_store_owner() from public, anon;
grant execute on function public.is_store_owner() to authenticated;

create or replace function public.admin_dashboard_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'total_orders', (select count(*) from public.orders),
    'paid_orders', (select count(*) from public.orders where payment_status = 'paid'),
    'revenue', case when public.is_store_owner()
                    then (select coalesce(sum(total), 0) from public.orders where payment_status = 'paid' and status <> 'refunded')
               end,
    'pending_fulfilment', (select count(*) from public.orders
                            where payment_status = 'paid' and status in ('paid', 'processing', 'awaiting_supplier', 'ordered_from_supplier')),
    'inventory_conflicts', (select count(*) from public.orders where inventory_conflict and status not in ('cancelled', 'refunded')),
    'products_in_stock', (select count(*) from public.products p where p.status = 'published' and exists (
                            select 1 from public.product_variants v join public.inventory i on i.variant_id = v.id
                            where v.product_id = p.id and v.is_active and i.on_hand > 0)),
    'low_stock_variants', (select count(*) from public.product_variants v join public.inventory i on i.variant_id = v.id
                            join public.products p on p.id = v.product_id
                            where p.status <> 'archived' and v.is_active and i.on_hand > 0 and i.on_hand <= i.low_stock_threshold),
    'out_of_stock_products', (select count(*) from public.products p where p.status = 'published' and not p.allow_backorder
                            and not exists (select 1 from public.product_variants v join public.inventory i on i.variant_id = v.id
                                            where v.product_id = p.id and v.is_active and i.on_hand > 0)),
    'unreviewed_shipping_rates', (select count(*) from public.shipping_rates where is_active and needs_review)
  );
end;
$$;
revoke execute on function public.admin_dashboard_stats() from public, anon;
grant execute on function public.admin_dashboard_stats() to authenticated;

insert into supabase_migrations.schema_migrations (version, name) values ('20261030000015', 'owner_only_revenue') on conflict do nothing;

