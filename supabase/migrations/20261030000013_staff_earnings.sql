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
