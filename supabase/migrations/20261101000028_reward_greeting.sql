-- =====================================================================
-- Reward wording per staff member: the owner chooses how Haru greets each
-- one in Staff Management ("Call them": sis / bro / their first name).
--   win : "🎉 Congratulations sis! You just won 25 Naira!"
--   loss: "😢 Oops! 3 negatives, you lost 25 Naira"
-- The counting, the ₦25 and the resets are unchanged.
-- =====================================================================

alter table public.staff_members
  add column if not exists greeting text not null default 'name' check (greeting in ('sis', 'bro', 'name'));

create or replace function public.rate_staff_task(p_task_id uuid, p_rating text, p_reason text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_task public.staff_tasks;
  v_staff public.staff_members;
  v_reason text := nullif(left(trim(coalesce(p_reason, '')), 300), '');
  v_good int;
  v_poor int;
  v_bonus numeric := 0;
  v_penalty numeric := 0;
  v_balance numeric;
  v_link text;
  v_hi text;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_rating not in ('good', 'poor') then
    raise exception 'invalid_rating' using errcode = 'P0001';
  end if;
  if p_rating = 'poor' and (v_reason is null or char_length(v_reason) < 3) then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;
  select * into v_task from public.staff_tasks where id = p_task_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_task.status not in ('pending_review', 'corrected') then
    raise exception 'already_rated' using errcode = 'P0001';
  end if;
  select * into v_staff from public.staff_members where user_id = v_task.staff_id for update;
  if not found then
    raise exception 'not_staff' using errcode = 'P0001';
  end if;

  insert into public.staff_ratings (task_id, staff_id, staff_email, rating, reason, rated_by)
  values (v_task.id, v_task.staff_id, v_task.staff_email, p_rating, v_reason, auth.uid());
  update public.staff_tasks set status = case when p_rating = 'good' then 'rated_good' else 'rated_poor' end, rated_at = now() where id = v_task.id;

  if p_rating = 'good' then
    v_good := v_staff.good_streak + 1;
    v_poor := 0;
    if v_good >= 3 then
      v_good := 0;
      v_bonus := 25;
      insert into public.staff_payments (staff_id, amount, type, status, description, created_by, confirmed_at)
      values (v_task.staff_id, 25, 'bonus', 'confirmed', 'Auto bonus: 3 good ratings in a row', auth.uid(), now());
    end if;
  else
    v_poor := v_staff.poor_streak + 1;
    v_good := 0;
    if v_poor >= 3 then
      v_poor := 0;
      select coalesce(t.balance_left, 0) into v_balance from public.staff_payment_totals(v_task.staff_id) t;
      v_penalty := least(25, greatest(coalesce(v_balance, 0), 0)); -- never below ₦0
      if v_penalty > 0 then
        insert into public.staff_payments (staff_id, amount, type, status, description, created_by, confirmed_at)
        values (v_task.staff_id, v_penalty, 'penalty', 'confirmed', 'Auto deduction: 3 poor ratings in a row', auth.uid(), now());
      end if;
    end if;
  end if;
  update public.staff_members set good_streak = v_good, poor_streak = v_poor where user_id = v_task.staff_id;
  select coalesce(t.balance_left, 0) into v_balance from public.staff_payment_totals(v_task.staff_id) t;

  -- Haru tells the staff member.
  v_link := coalesce(v_task.link, '/staff/notifications');
  if v_bonus > 0 then
    -- "Congratulations sis!" / "bro!" / "Isioma!" — the owner picks per staff member.
    v_hi := case v_staff.greeting
              when 'sis' then 'sis'
              when 'bro' then 'bro'
              else nullif(split_part(trim(coalesce(v_staff.full_name, '')), ' ', 1), '')
            end;
    insert into public.staff_notifications (staff_id, staff_email, to_role, title, message, type, task_id, link, amount)
    values (v_task.staff_id, v_task.staff_email, 'staff', '🎉 Congratulations' || coalesce(' ' || v_hi, '') || '! You just won 25 Naira!',
      'Wow! You got 3 good ratings in a row! I just added ₦25 to your wallet! Your balance is now ' || public.naira_text(v_balance)
        || '. You are doing amazing, keep up the great work! 💖', 'bonus', v_task.id, '/staff/earnings', 25);
  elsif p_rating = 'good' then
    insert into public.staff_notifications (staff_id, staff_email, to_role, title, message, type, task_id, link)
    values (v_task.staff_id, v_task.staff_email, 'staff', 'Good job! Keep it up! ✨',
      'Sugoi! Amazing work! ' || v_task.task_details || ' was rated GOOD!' || coalesce(' ' || v_reason || '.', '')
        || ' Keep shining! ✨ Your good streak is now ' || v_good || '/3. '
        || case when v_good = 2 then 'One more for a ₦25 bonus!' else (3 - v_good) || ' more for a ₦25 bonus!' end,
      'rated_good', v_task.id, v_link);
  elsif v_penalty > 0 or v_poor = 0 then
    insert into public.staff_notifications (staff_id, staff_email, to_role, title, message, type, task_id, link, amount)
    values (v_task.staff_id, v_task.staff_email, 'staff',
      case when v_penalty > 0 then '😢 Oops! 3 negatives, you lost ' || replace(public.naira_text(v_penalty), '₦', '') || ' Naira' else '😢 Oops! 3 negatives' end,
      'Hey, I know you can do better! You got 3 poor ratings in a row'
        || case when v_penalty > 0 then ', so ' || public.naira_text(v_penalty) || ' was deducted. Your balance is ' || public.naira_text(v_balance) || '.'
           else '. Your balance is ₦0, so nothing was deducted this time.' end
        || ' Last one: ' || v_task.task_details || ' — Reason: ' || v_reason
        || '. Don''t give up! Watch the product well and correct it. You got this! 🌱 I believe in you!',
      'penalty', v_task.id, v_link, nullif(v_penalty, 0));
  else
    insert into public.staff_notifications (staff_id, staff_email, to_role, title, message, type, task_id, link)
    values (v_task.staff_id, v_task.staff_email, 'staff', left('Needs correction - ' || v_reason, 160),
      'Hmm, ' || v_task.task_details || ' was rated POOR... Reason: ' || v_reason
        || '. Please go back and fix it, okay? You can do it! 💪 Poor streak: ' || v_poor || '/3 — '
        || case when v_poor = 2 then 'one more in a row and ₦25 comes off, so be careful!' else 'a Good rating clears it.' end,
      'rated_poor', v_task.id, v_link);
  end if;

  return jsonb_build_object('ok', true, 'rating', p_rating, 'good_streak', v_good, 'poor_streak', v_poor,
    'bonus', v_bonus, 'penalty', v_penalty, 'balance_left', v_balance, 'staff_id', v_task.staff_id);
end;
$$;
revoke execute on function public.rate_staff_task(uuid, text, text) from public, anon;
grant execute on function public.rate_staff_task(uuid, text, text) to authenticated;
