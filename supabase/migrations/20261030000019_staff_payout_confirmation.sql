-- =====================================================================
-- Staff payouts with bank details and receipt confirmation.
--
-- * Staff save their own bank details (bank, 10-digit account number,
--   account name) with set_my_bank_details().
-- * A payout (withdrawal) needs those details: pay_staff() copies them onto
--   the payment and marks it 'pending'.
-- * The staff member then confirms they received it (→ 'confirmed') or says
--   they didn't (→ 'rejected') with confirm_my_payout().
-- * Totals: withdrawn = confirmed payouts; pending = payouts awaiting
--   confirmation; balance left = total earned − withdrawn − pending (so the
--   owner can't accidentally pay the same money twice). A rejected payout
--   goes back into the balance. Bonuses/extra earnings are confirmed at once.
-- =====================================================================

alter table public.staff_members
  add column if not exists bank_name text check (bank_name is null or char_length(bank_name) between 2 and 60),
  add column if not exists account_number text check (account_number is null or account_number ~ '^[0-9]{10}$'),
  add column if not exists account_name text check (account_name is null or char_length(account_name) between 2 and 120),
  add column if not exists bank_updated_at timestamptz;

alter table public.staff_payments
  add column if not exists status text not null default 'confirmed' check (status in ('pending', 'confirmed', 'rejected')),
  add column if not exists bank_name text,
  add column if not exists account_number text,
  add column if not exists account_name text,
  add column if not exists confirmed_at timestamptz,
  add column if not exists staff_note text check (staff_note is null or char_length(staff_note) <= 300);
create index if not exists staff_payments_pending_idx on public.staff_payments (staff_id) where status = 'pending';

-- Staff save (or change) their own bank details.
create or replace function public.set_my_bank_details(p_bank_name text, p_account_number text, p_account_name text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_number text := regexp_replace(coalesce(p_account_number, ''), '\s', '', 'g');
begin
  if auth.uid() is null or not exists (select 1 from public.staff_members where user_id = auth.uid()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_number !~ '^[0-9]{10}$' then
    raise exception 'invalid_account_number' using errcode = 'P0001';
  end if;
  if char_length(trim(coalesce(p_bank_name, ''))) < 2 or char_length(trim(p_bank_name)) > 60 then
    raise exception 'invalid_bank' using errcode = 'P0001';
  end if;
  if char_length(trim(coalesce(p_account_name, ''))) < 2 or char_length(trim(p_account_name)) > 120 then
    raise exception 'invalid_account_name' using errcode = 'P0001';
  end if;
  update public.staff_members
     set bank_name = trim(p_bank_name), account_number = v_number, account_name = upper(trim(p_account_name)), bank_updated_at = now(), updated_at = now()
   where user_id = auth.uid();
end;
$$;
revoke execute on function public.set_my_bank_details(text, text, text) from public, anon;
grant execute on function public.set_my_bank_details(text, text, text) to authenticated;

-- A staff member's own bank details (the owner can read anyone's).
create or replace function public.staff_bank_details(p_user_id uuid default null)
returns table (user_id uuid, bank_name text, account_number text, account_name text, bank_updated_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or (not public.is_admin() and coalesce(p_user_id, auth.uid()) <> auth.uid()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select s.user_id, s.bank_name, s.account_number, s.account_name, s.bank_updated_at
    from public.staff_members s
    where (p_user_id is null and public.is_admin()) or s.user_id = coalesce(p_user_id, auth.uid());
end;
$$;
revoke execute on function public.staff_bank_details(uuid) from public, anon;
grant execute on function public.staff_bank_details(uuid) to authenticated;

-- Totals now separate confirmed (withdrawn) and pending payouts.
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
  pending_amount numeric,
  balance_left numeric,
  last_paid_at timestamptz,
  bank_name text,
  account_number text,
  account_name text
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
      select s.user_id, s.full_name, s.email, s.bank_name, s.account_number, s.account_name from public.staff_members s
      where p_user_id is null or s.user_id = p_user_id
      union
      select u.id, coalesce(nullif(pr.full_name, ''), u.raw_user_meta_data ->> 'full_name'), u.email, null::text, null::text, null::text
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
             coalesce(sum(sp.amount) filter (where sp.type in ('earning', 'bonus') and sp.status = 'confirmed'), 0) as extra,
             coalesce(sum(sp.amount) filter (where sp.type = 'withdrawal' and sp.status = 'confirmed'), 0) as withdrawn,
             coalesce(sum(sp.amount) filter (where sp.type = 'withdrawal' and sp.status = 'pending'), 0) as pending,
             max(sp.created_at) filter (where sp.type = 'withdrawal' and sp.status <> 'rejected') as last_paid
      from people pe left join public.staff_payments sp on sp.staff_id = pe.user_id
      group by pe.user_id
    )
    select pe.user_id, pe.full_name, pe.email, m.n,
           (m.n / 10 * 1000)::numeric,
           mo.extra,
           (m.n / 10 * 1000)::numeric + mo.extra,
           mo.withdrawn,
           mo.pending,
           (m.n / 10 * 1000)::numeric + mo.extra - mo.withdrawn - mo.pending,
           mo.last_paid,
           pe.bank_name, pe.account_number, pe.account_name
    from people pe join made m using (user_id) join money mo using (user_id)
    order by pe.full_name nulls last, pe.email;
end;
$$;
revoke execute on function public.staff_payment_totals(uuid) from public, anon;
grant execute on function public.staff_payment_totals(uuid) to authenticated;

-- Payouts need the staff member's bank details (copied onto the payment) and start as pending.
create or replace function public.pay_staff(p_staff_id uuid, p_amount numeric, p_description text default null, p_type text default 'withdrawal')
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_staff public.staff_members;
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
  select * into v_staff from public.staff_members where user_id = p_staff_id;
  if not found then
    raise exception 'not_staff' using errcode = 'P0001';
  end if;
  if p_type = 'withdrawal' and (v_staff.account_number is null or v_staff.bank_name is null or v_staff.account_name is null) then
    raise exception 'no_bank_details' using errcode = 'P0001';
  end if;

  insert into public.staff_payments (staff_id, amount, type, description, created_by, status, bank_name, account_number, account_name, confirmed_at)
  values (
    p_staff_id, p_amount, p_type, nullif(left(trim(coalesce(p_description, '')), 200), ''), auth.uid(),
    case when p_type = 'withdrawal' then 'pending' else 'confirmed' end,
    case when p_type = 'withdrawal' then v_staff.bank_name end,
    case when p_type = 'withdrawal' then v_staff.account_number end,
    case when p_type = 'withdrawal' then v_staff.account_name end,
    case when p_type = 'withdrawal' then null else now() end
  )
  returning id into v_id;

  select * into v_totals from public.staff_payment_totals(p_staff_id);
  return jsonb_build_object(
    'ok', true,
    'payment_id', v_id,
    'status', case when p_type = 'withdrawal' then 'pending' else 'confirmed' end,
    'total_earnings', v_totals.total_earnings,
    'total_withdrawn', v_totals.total_withdrawn,
    'pending_amount', v_totals.pending_amount,
    'balance_left', v_totals.balance_left
  );
end;
$$;
revoke execute on function public.pay_staff(uuid, numeric, text, text) from public, anon;
grant execute on function public.pay_staff(uuid, numeric, text, text) to authenticated;

-- The staff member confirms they received a payout (or says they didn't).
create or replace function public.confirm_my_payout(p_payment_id uuid, p_received boolean, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_pay public.staff_payments;
  v_totals record;
begin
  if auth.uid() is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_pay from public.staff_payments where id = p_payment_id for update;
  if not found or v_pay.staff_id <> auth.uid() then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_pay.status <> 'pending' then
    raise exception 'already_answered' using errcode = 'P0001';
  end if;
  update public.staff_payments
     set status = case when p_received then 'confirmed' else 'rejected' end,
         confirmed_at = now(),
         staff_note = nullif(left(trim(coalesce(p_note, '')), 300), '')
   where id = p_payment_id;
  select * into v_totals from public.staff_payment_totals(auth.uid());
  return jsonb_build_object(
    'ok', true,
    'status', case when p_received then 'confirmed' else 'rejected' end,
    'total_withdrawn', v_totals.total_withdrawn,
    'pending_amount', v_totals.pending_amount,
    'balance_left', v_totals.balance_left
  );
end;
$$;
revoke execute on function public.confirm_my_payout(uuid, boolean, text) from public, anon;
grant execute on function public.confirm_my_payout(uuid, boolean, text) to authenticated;
