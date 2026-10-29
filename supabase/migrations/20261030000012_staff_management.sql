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
