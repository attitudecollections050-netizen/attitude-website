-- =====================================================================
-- Staff-initiated withdrawals (replaces the owner's manual "Pay" flow).
--
-- * A staff member with a balance and saved bank details taps "Withdraw to
--   my account": request_withdrawal() records their whole balance as a
--   'pending' withdrawal, with their bank details copied onto it. One
--   request at a time.
-- * The owner sends the transfer and taps Approve: approve_withdrawal()
--   marks it 'paid'. Or Decline (with a reason): 'rejected', and the money
--   goes back into the balance.
-- * Totals stay calculated (never stored, so they can't drift):
--     withdrawn    = paid withdrawals
--     pending      = requested, not yet approved
--     balance left = total earned − withdrawn − pending
-- =====================================================================

alter table public.staff_payments drop constraint if exists staff_payments_status_check;
alter table public.staff_payments
  add constraint staff_payments_status_check check (status in ('pending', 'paid', 'confirmed', 'rejected')),
  add column if not exists approved_by uuid references auth.users (id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists admin_note text check (admin_note is null or char_length(admin_note) <= 300);
-- Older payouts the staff member confirmed count as paid.
update public.staff_payments set status = 'paid', approved_at = coalesce(approved_at, confirmed_at) where status = 'confirmed' and type = 'withdrawal';

-- The manual owner flow is gone.
drop function if exists public.pay_staff(uuid, numeric, text, text);
drop function if exists public.confirm_my_payout(uuid, boolean, text);

-- Totals: withdrawn = paid; pending = requested.
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
             coalesce(sum(sp.amount) filter (where sp.type in ('earning', 'bonus') and sp.status in ('confirmed', 'paid')), 0) as extra,
             coalesce(sum(sp.amount) filter (where sp.type = 'withdrawal' and sp.status in ('paid', 'confirmed')), 0) as withdrawn,
             coalesce(sum(sp.amount) filter (where sp.type = 'withdrawal' and sp.status = 'pending'), 0) as pending,
             max(sp.approved_at) filter (where sp.type = 'withdrawal' and sp.status in ('paid', 'confirmed')) as last_paid
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

-- A staff member asks to withdraw their whole balance to their saved account.
create or replace function public.request_withdrawal()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_staff public.staff_members;
  v_totals record;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  -- One request at a time, even if the button is tapped twice.
  perform pg_advisory_xact_lock(hashtext('withdraw:' || auth.uid()::text));
  select * into v_staff from public.staff_members where user_id = auth.uid();
  if not found or v_staff.status <> 'active' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_staff.account_number is null or v_staff.bank_name is null or v_staff.account_name is null then
    raise exception 'no_bank_details' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.staff_payments where staff_id = auth.uid() and type = 'withdrawal' and status = 'pending') then
    raise exception 'already_requested' using errcode = 'P0001';
  end if;
  select * into v_totals from public.staff_payment_totals(auth.uid());
  if coalesce(v_totals.balance_left, 0) <= 0 then
    raise exception 'no_balance' using errcode = 'P0001';
  end if;

  insert into public.staff_payments (staff_id, amount, type, status, description, created_by, bank_name, account_number, account_name)
  values (auth.uid(), v_totals.balance_left, 'withdrawal', 'pending', 'Withdrawal request', auth.uid(), v_staff.bank_name, v_staff.account_number, v_staff.account_name)
  returning id into v_id;

  select * into v_totals from public.staff_payment_totals(auth.uid());
  return jsonb_build_object('ok', true, 'payment_id', v_id, 'amount', (select amount from public.staff_payments where id = v_id),
    'total_withdrawn', v_totals.total_withdrawn, 'pending_amount', v_totals.pending_amount, 'balance_left', v_totals.balance_left);
end;
$$;
revoke execute on function public.request_withdrawal() from public, anon;
grant execute on function public.request_withdrawal() to authenticated;

-- The owner approves (after sending the transfer) or declines a request.
create or replace function public.review_withdrawal(p_payment_id uuid, p_approve boolean, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_pay public.staff_payments;
  v_totals record;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_pay from public.staff_payments where id = p_payment_id and type = 'withdrawal' for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_pay.status <> 'pending' then
    raise exception 'already_answered' using errcode = 'P0001';
  end if;
  update public.staff_payments
     set status = case when p_approve then 'paid' else 'rejected' end,
         approved_by = auth.uid(),
         approved_at = now(),
         admin_note = nullif(left(trim(coalesce(p_note, '')), 300), '')
   where id = p_payment_id;
  select * into v_totals from public.staff_payment_totals(v_pay.staff_id);
  return jsonb_build_object('ok', true, 'status', case when p_approve then 'paid' else 'rejected' end, 'staff_id', v_pay.staff_id, 'amount', v_pay.amount,
    'total_withdrawn', v_totals.total_withdrawn, 'pending_amount', v_totals.pending_amount, 'balance_left', v_totals.balance_left);
end;
$$;
revoke execute on function public.review_withdrawal(uuid, boolean, text) from public, anon;
grant execute on function public.review_withdrawal(uuid, boolean, text) to authenticated;
