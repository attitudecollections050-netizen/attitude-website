-- =====================================================================
-- Staff payments: what the owner has paid each staff member.
--
-- * staff_payments is a ledger. 'withdrawal' = money paid out to the staff
--   member; 'earning' and 'bonus' = extra money owed to them on top of the
--   automatic product earnings (₦1,000 for every 10 products they add).
-- * Totals are always calculated, never stored, so they can't drift:
--     total_earnings  = product earnings + earning/bonus entries
--     total_withdrawn = sum of withdrawals
--     balance_left    = total_earnings - total_withdrawn
-- * Only the owner (admin) can record payments, through pay_staff().
--   Staff can read their own payments only; nobody can edit or delete them.
-- Amounts are in naira (₦), with kobo as decimals.
-- =====================================================================

create table if not exists public.staff_payments (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references auth.users (id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0 and amount <= 100000000),
  type text not null default 'withdrawal' check (type in ('withdrawal', 'earning', 'bonus')),
  description text check (description is null or char_length(description) <= 200),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists staff_payments_staff_idx on public.staff_payments (staff_id, created_at desc);

alter table public.staff_payments enable row level security;
drop policy if exists "staff_payments: own or owner read" on public.staff_payments;
create policy "staff_payments: own or owner read" on public.staff_payments
  for select using (staff_id = auth.uid() or public.is_admin());
-- No insert/update/delete policies: payments are only written by pay_staff().

-- Totals per staff member. The owner gets everyone; a staff member only themselves.
drop function if exists public.staff_payment_totals(uuid);
create function public.staff_payment_totals(p_user_id uuid default null)
returns table (
  user_id uuid,
  full_name text,
  email text,
  products_added int,
  product_earnings numeric,
  extra_earnings numeric,
  total_earnings numeric,
  total_withdrawn numeric,
  balance_left numeric,
  last_paid_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not public.is_admin() and (p_user_id is null or p_user_id <> auth.uid()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    with people as (
      select s.user_id, s.full_name, s.email from public.staff_members s
      where p_user_id is null or s.user_id = p_user_id
      union
      -- a staff member who isn't in staff_members (e.g. promoted by SQL) still sees their own numbers
      select u.id, coalesce(nullif(pr.full_name, ''), u.raw_user_meta_data ->> 'full_name'), u.email
      from auth.users u left join public.profiles pr on pr.id = u.id
      where p_user_id is not null and u.id = p_user_id
        and not exists (select 1 from public.staff_members s2 where s2.user_id = p_user_id)
    ),
    made as (
      select pe.user_id, count(p.id)::int as n
      from people pe left join public.products p on p.added_by = pe.user_id and p.status <> 'archived'
      group by pe.user_id
    ),
    money as (
      select pe.user_id,
             coalesce(sum(sp.amount) filter (where sp.type in ('earning', 'bonus')), 0) as extra,
             coalesce(sum(sp.amount) filter (where sp.type = 'withdrawal'), 0) as withdrawn,
             max(sp.created_at) filter (where sp.type = 'withdrawal') as last_paid
      from people pe left join public.staff_payments sp on sp.staff_id = pe.user_id
      group by pe.user_id
    )
    select pe.user_id, pe.full_name, pe.email, m.n,
           (m.n / 10 * 1000)::numeric,
           mo.extra,
           (m.n / 10 * 1000)::numeric + mo.extra,
           mo.withdrawn,
           (m.n / 10 * 1000)::numeric + mo.extra - mo.withdrawn,
           mo.last_paid
    from people pe join made m using (user_id) join money mo using (user_id)
    order by pe.full_name nulls last, pe.email;
end;
$$;
revoke execute on function public.staff_payment_totals(uuid) from public, anon;
grant execute on function public.staff_payment_totals(uuid) to authenticated;

-- The owner records a payment (default: a withdrawal / payout) and gets the new totals back.
create or replace function public.pay_staff(p_staff_id uuid, p_amount numeric, p_description text default null, p_type text default 'withdrawal')
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_totals record;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_type not in ('withdrawal', 'earning', 'bonus') then
    raise exception 'invalid_type' using errcode = 'P0001';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 100000000 or round(p_amount, 2) <> p_amount then
    raise exception 'invalid_amount' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.staff_members where user_id = p_staff_id) then
    raise exception 'not_staff' using errcode = 'P0001';
  end if;

  insert into public.staff_payments (staff_id, amount, type, description, created_by)
  values (p_staff_id, p_amount, p_type, nullif(left(trim(coalesce(p_description, '')), 200), ''), auth.uid())
  returning id into v_id;

  select * into v_totals from public.staff_payment_totals(p_staff_id);
  return jsonb_build_object(
    'ok', true,
    'payment_id', v_id,
    'total_earnings', v_totals.total_earnings,
    'total_withdrawn', v_totals.total_withdrawn,
    'balance_left', v_totals.balance_left
  );
end;
$$;
revoke execute on function public.pay_staff(uuid, numeric, text, text) from public, anon;
grant execute on function public.pay_staff(uuid, numeric, text, text) to authenticated;

-- Live updates on both dashboards (Supabase Realtime respects the read policy above).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'staff_payments') then
    alter publication supabase_realtime add table public.staff_payments;
  end if;
end;
$$;
