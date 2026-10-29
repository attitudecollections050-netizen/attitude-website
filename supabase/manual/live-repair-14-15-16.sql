-- =====================================================================
-- Attitude Collections — live database repair (safe to run more than once).
-- Paste everything into Supabase → SQL Editor → New query → Run.
--
-- 1. Removes "allow_checkout_insert": it let any signed-in user write order
--    rows directly (any price, any status). Orders are only created by the
--    server's create_order(), which recalculates every price.
-- 2. Finishes update 14 (bank transfer): orders.payment_method, the
--    payment_claims table, the owner's confirm/decline function and the
--    private receipt bucket. Tidies the bank account name's spacing.
-- 3. Update 15: sales revenue only for the store owner (also in the database).
-- 4. Update 16: get_my_stats() for signed-in users only, archived products excluded.
-- 5. PART 2 (bottom, optional): turns accounts marked profiles.role = 'staff'
--    into proper Product Staff.
-- =====================================================================

-- 1 ------------------------------------------------------------------------
drop policy if exists "allow_checkout_insert" on public.orders;

-- 2 ------------------------------------------------------------------------
alter table public.orders
  add column if not exists payment_method text not null default 'paystack' check (payment_method in ('paystack', 'bank_transfer'));

create table if not exists public.payment_claims (
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
create index if not exists payment_claims_order_idx on public.payment_claims (order_id);
create index if not exists payment_claims_status_idx on public.payment_claims (status, created_at desc);
create unique index if not exists payment_claims_reference_live_idx
  on public.payment_claims (upper(regexp_replace(transfer_reference, '\s', '', 'g')))
  where status <> 'declined';

alter table public.payment_claims enable row level security;
drop policy if exists "payment_claims: owner read" on public.payment_claims;
create policy "payment_claims: owner read" on public.payment_claims for select using (public.is_admin());

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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

insert into public.store_settings (key, value, is_public)
values ('bank_transfer', '{"enabled": true, "bank_name": "First Bank", "account_name": "OKONYE JUSTICE JESSICA", "account_number": "3043027979", "note": ""}', true)
on conflict (key) do nothing;
-- One space between names (customers copy this into their bank app).
update public.store_settings
   set value = jsonb_set(value, '{account_name}', to_jsonb(regexp_replace(trim(value ->> 'account_name'), '\s+', ' ', 'g')))
 where key = 'bank_transfer' and value ? 'account_name';

-- 3 ------------------------------------------------------------------------
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

-- 4 ------------------------------------------------------------------------
create or replace function public.get_my_stats()
returns table (product_count bigint, earnings integer, remaining integer)
language plpgsql stable security definer set search_path = public as $$
begin
  return query
    select count(*)::bigint,
           (count(*) / 10 * 1000)::int,
           (10 - count(*) % 10)::int
    from public.products
    where added_by = auth.uid() and auth.uid() is not null and status <> 'archived';
end;
$$;
revoke execute on function public.get_my_stats() from public, anon;
grant execute on function public.get_my_stats() to authenticated;

-- is_owner() (used by some order/profile rules): pin its search path.
do $$
begin
  if to_regprocedure('public.is_owner()') is not null then
    execute 'alter function public.is_owner() set search_path = public';
  end if;
end $$;

-- Record the updates so the migration history matches the code.
insert into supabase_migrations.schema_migrations (version, name) values
  ('20261030000012', 'staff_management'),
  ('20261030000013', 'staff_earnings'),
  ('20261030000014', 'bank_transfer'),
  ('20261030000015', 'owner_only_revenue'),
  ('20261030000016', 'my_stats')
on conflict do nothing;

-- =====================================================================
-- PART 2 (optional): make accounts marked profiles.role = 'staff' proper
-- Product Staff, so they can sign in to the dashboard, add products and see
-- their earnings. Skip this part if those accounts shouldn't have access.
-- (You can disable or remove them any time in Admin → Staff Management.)
-- =====================================================================
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'role') then
    insert into public.staff_members (user_id, email, full_name, role, status, created_by_invite, accepted_at)
    select p.id, u.email, p.full_name, 'product_staff', 'active', false, now()
      from public.profiles p join auth.users u on u.id = p.id
     where p.role = 'staff'
       and not exists (select 1 from public.user_roles r where r.user_id = p.id and r.role = 'admin')
    on conflict (user_id) do nothing;
    insert into public.user_roles (user_id, role)
    select s.user_id, 'product_staff'
      from public.staff_members s join public.profiles p on p.id = s.user_id
     where p.role = 'staff' and s.status <> 'disabled'
       and not exists (select 1 from public.user_roles r where r.user_id = s.user_id and r.role = 'product_staff');
  end if;
end $$;
