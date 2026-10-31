-- =====================================================================
-- Staff choose how much to withdraw: any amount from ₦500 up to their
-- available balance (it used to be the whole balance). Checked here in the
-- database as well as on the page.
-- =====================================================================

-- A staff member asks to withdraw an amount of their choice (₦500 up to their balance;
-- no amount = their whole balance) to their saved account.
drop function if exists public.request_withdrawal();
create or replace function public.request_withdrawal(p_amount numeric default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_staff public.staff_members;
  v_totals record;
  v_id uuid;
  v_amount numeric;
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
  if coalesce(v_totals.balance_left, 0) < 500 then
    raise exception 'no_balance' using errcode = 'P0001';
  end if;
  v_amount := coalesce(p_amount, v_totals.balance_left);
  if round(v_amount, 2) <> v_amount then
    raise exception 'invalid_amount' using errcode = 'P0001';
  end if;
  if v_amount < 500 then
    raise exception 'amount_too_small' using errcode = 'P0001';
  end if;
  if v_amount > v_totals.balance_left then
    raise exception 'amount_too_large' using errcode = 'P0001';
  end if;

  insert into public.staff_payments (staff_id, amount, type, status, description, created_by, bank_name, account_number, account_name)
  values (auth.uid(), v_amount, 'withdrawal', 'pending', 'Withdrawal request', auth.uid(), v_staff.bank_name, v_staff.account_number, v_staff.account_name)
  returning id into v_id;

  select * into v_totals from public.staff_payment_totals(auth.uid());
  return jsonb_build_object('ok', true, 'payment_id', v_id, 'amount', (select amount from public.staff_payments where id = v_id),
    'total_withdrawn', v_totals.total_withdrawn, 'pending_amount', v_totals.pending_amount, 'balance_left', v_totals.balance_left);
end;
$$;
revoke execute on function public.request_withdrawal(numeric) from public, anon;
grant execute on function public.request_withdrawal(numeric) to authenticated;

