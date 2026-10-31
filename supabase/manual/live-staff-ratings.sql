-- =====================================================================
-- Staff work ratings, automatic ₦25 bonus/penalty, and Haru's notifications.
--
-- * Staff work is logged automatically by the database (it can't be faked
--   or forgotten): a product a staff member adds, a design they set on an
--   order item, an order status they change. Each one becomes a staff_task
--   with status 'pending_review', and the owner gets a notification.
-- * The owner rates each task Good or Poor (Poor needs a reason) through
--   rate_staff_task(). Streaks live on staff_members:
--     3 Good in a row -> +₦25 bonus (ledger entry 'bonus'), streak resets
--     3 Poor in a row -> -₦25 penalty (ledger entry 'penalty'), streak resets
--   A Good resets the Poor streak and vice versa. A penalty never takes the
--   balance below ₦0.
-- * Money stays in the staff_payments ledger, so balances are calculated
--   (never stored) and the bonus/penalty shows in the earnings history.
-- * staff_notifications holds Haru's messages: to the owner ('admin') or to
--   one staff member ('staff'). Nobody can write them directly.
-- =====================================================================

-- Streaks ------------------------------------------------------------------
alter table public.staff_members
  add column if not exists good_streak int not null default 0 check (good_streak between 0 and 2),
  add column if not exists poor_streak int not null default 0 check (poor_streak between 0 and 2);

-- Penalty entries in the ledger --------------------------------------------
alter table public.staff_payments drop constraint if exists staff_payments_type_check;
alter table public.staff_payments
  add constraint staff_payments_type_check check (type in ('withdrawal', 'earning', 'bonus', 'penalty'));

-- Totals: extra earnings = earnings + bonuses - penalties.
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
             coalesce(sum(sp.amount) filter (where sp.type in ('earning', 'bonus') and sp.status in ('confirmed', 'paid')), 0)
               - coalesce(sum(sp.amount) filter (where sp.type = 'penalty' and sp.status in ('confirmed', 'paid')), 0) as extra,
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

-- Tables -------------------------------------------------------------------
create table if not exists public.staff_tasks (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references auth.users (id) on delete cascade,
  staff_email text,
  product_id uuid references public.products (id) on delete set null,
  order_id uuid references public.orders (id) on delete set null,
  order_item_id uuid references public.order_items (id) on delete set null,
  task_type text not null check (task_type in ('set_design', 'upload_product', 'update_order')),
  task_details text not null check (char_length(task_details) <= 300),
  link text check (link is null or link ~ '^/[A-Za-z0-9/_-]*$'),
  status text not null default 'pending_review' check (status in ('pending_review', 'rated_good', 'rated_poor', 'corrected')),
  rated_at timestamptz,
  corrected_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists staff_tasks_review_idx on public.staff_tasks (created_at) where status in ('pending_review', 'corrected');
create index if not exists staff_tasks_staff_idx on public.staff_tasks (staff_id, created_at desc);

create table if not exists public.staff_ratings (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.staff_tasks (id) on delete cascade,
  staff_id uuid not null references auth.users (id) on delete cascade,
  staff_email text,
  rating text not null check (rating in ('good', 'poor')),
  reason text check (reason is null or char_length(reason) <= 300),
  rated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists staff_ratings_staff_idx on public.staff_ratings (staff_id, created_at desc);

create table if not exists public.staff_notifications (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid references auth.users (id) on delete cascade, -- who it's for (staff) or about (admin)
  staff_email text,
  to_role text not null check (to_role in ('admin', 'staff')),
  title text not null check (char_length(title) <= 160),
  message text not null check (char_length(message) <= 1000),
  type text not null check (type in ('task_done', 'corrected', 'rated_poor', 'rated_good', 'penalty', 'bonus', 'encouragement')),
  task_id uuid references public.staff_tasks (id) on delete set null,
  link text check (link is null or link ~ '^/[A-Za-z0-9/_?=&-]*$'),
  amount numeric(14, 2),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists staff_notifications_staff_idx on public.staff_notifications (staff_id, created_at desc) where to_role = 'staff';
create index if not exists staff_notifications_admin_idx on public.staff_notifications (created_at desc) where to_role = 'admin';

alter table public.staff_tasks enable row level security;
alter table public.staff_ratings enable row level security;
alter table public.staff_notifications enable row level security;
drop policy if exists "staff_tasks: own or owner read" on public.staff_tasks;
create policy "staff_tasks: own or owner read" on public.staff_tasks for select using (staff_id = auth.uid() or public.is_admin());
drop policy if exists "staff_ratings: own or owner read" on public.staff_ratings;
create policy "staff_ratings: own or owner read" on public.staff_ratings for select using (staff_id = auth.uid() or public.is_admin());
drop policy if exists "staff_notifications: recipient read" on public.staff_notifications;
create policy "staff_notifications: recipient read" on public.staff_notifications
  for select using ((to_role = 'staff' and staff_id = auth.uid()) or (to_role = 'admin' and public.is_admin()));
-- No write policies: everything goes through the functions below.

-- Helpers ------------------------------------------------------------------
create or replace function public.naira_text(p numeric) returns text
language sql immutable as $$
  select '₦' || case when p = trunc(p) then to_char(p, 'FM999,999,999,990') else to_char(p, 'FM999,999,999,990.00') end
$$;

-- Records a piece of staff work (internal: called by the triggers only).
create or replace function public.log_staff_task(
  p_staff uuid, p_type text, p_details text, p_product uuid default null, p_order uuid default null, p_item uuid default null, p_link text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_staff public.staff_members;
  v_task uuid;
  v_who text;
begin
  if p_staff is null then return; end if;
  select * into v_staff from public.staff_members where user_id = p_staff and status <> 'disabled';
  if not found then return; end if; -- the owner's own work isn't rated
  if exists (select 1 from public.user_roles where user_id = p_staff and role = 'admin') then return; end if;
  v_who := coalesce(nullif(v_staff.full_name, ''), v_staff.email);
  insert into public.staff_tasks (staff_id, staff_email, product_id, order_id, order_item_id, task_type, task_details, link)
  values (p_staff, v_staff.email, p_product, p_order, p_item, p_type, left(p_details, 300), p_link)
  returning id into v_task;
  insert into public.staff_notifications (staff_id, staff_email, to_role, title, message, type, task_id, link)
  values (p_staff, v_staff.email, 'admin', 'New staff work to rate ⭐',
          left(v_who || ' just finished: ' || p_details || '. Please rate it Good or Poor 💖', 1000), 'task_done', v_task, '/admin/staff-tasks');
end;
$$;
revoke execute on function public.log_staff_task(uuid, text, text, uuid, uuid, uuid, text) from public, anon, authenticated;

create or replace function public.staff_task_on_product() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.log_staff_task(new.added_by, 'upload_product', 'Uploaded product “' || left(new.name, 150) || '”', new.id, null, null, '/admin/products/' || new.id);
  return null;
end;
$$;
drop trigger if exists staff_task_product on public.products;
create trigger staff_task_product after insert on public.products for each row execute function public.staff_task_on_product();

create or replace function public.staff_task_on_design() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_number text;
begin
  if new.selected_set_by is null or new.selected_image is not distinct from old.selected_image then return null; end if;
  select order_number into v_number from public.orders where id = new.order_id;
  perform public.log_staff_task(
    new.selected_set_by, 'set_design',
    'Set design “' || left(coalesce(new.selected_variant_name, 'photo'), 80) || '” for ' || left(new.product_name, 100) || ' (Order ' || coalesce(v_number, '?') || ')',
    new.product_id, new.order_id, new.id, '/admin/orders/' || new.order_id);
  return null;
end;
$$;
drop trigger if exists staff_task_design on public.order_items;
create trigger staff_task_design after update of selected_image on public.order_items for each row execute function public.staff_task_on_design();

create or replace function public.staff_task_on_order_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or new.status is not distinct from old.status then return null; end if;
  perform public.log_staff_task(
    auth.uid(), 'update_order',
    'Changed Order ' || new.order_number || ' from ' || replace(old.status::text, '_', ' ') || ' to ' || replace(new.status::text, '_', ' '),
    null, new.id, null, '/admin/orders/' || new.id);
  return null;
end;
$$;
drop trigger if exists staff_task_order_status on public.orders;
create trigger staff_task_order_status after update of status on public.orders for each row execute function public.staff_task_on_order_status();

-- The owner rates a task ----------------------------------------------------
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
    insert into public.staff_notifications (staff_id, staff_email, to_role, title, message, type, task_id, link, amount)
    values (v_task.staff_id, v_task.staff_email, 'staff', 'Bonus! ₦25 Added! 🎉',
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
      case when v_penalty > 0 then public.naira_text(v_penalty) || ' Deducted - Try Harder' else '3 poor ratings - Try Harder' end,
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

-- A staff member says they fixed a Poor task; the owner can rate it again.
create or replace function public.mark_task_corrected(p_task_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_task public.staff_tasks;
  v_who text;
begin
  if auth.uid() is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_task from public.staff_tasks where id = p_task_id and staff_id = auth.uid() for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_task.status <> 'rated_poor' then
    raise exception 'not_poor' using errcode = 'P0001';
  end if;
  update public.staff_tasks set status = 'corrected', corrected_at = now() where id = v_task.id;
  select coalesce(nullif(full_name, ''), email) into v_who from public.staff_members where user_id = auth.uid();
  insert into public.staff_notifications (staff_id, staff_email, to_role, title, message, type, task_id, link)
  values (v_task.staff_id, v_task.staff_email, 'admin', 'Staff fixed their work 🔧',
    left(coalesce(v_who, 'A staff member') || ' says they corrected: ' || v_task.task_details || '. Please check and rate it again 💖', 1000),
    'corrected', v_task.id, '/admin/staff-tasks');
  return jsonb_build_object('ok', true, 'status', 'corrected');
end;
$$;
revoke execute on function public.mark_task_corrected(uuid) from public, anon;
grant execute on function public.mark_task_corrected(uuid) to authenticated;

-- Mark notifications read (only ones the caller is allowed to see). NULL = all of them.
create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_n int;
begin
  if auth.uid() is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.staff_notifications n set is_read = true
   where not n.is_read
     and (p_ids is null or n.id = any (p_ids))
     and ((n.to_role = 'staff' and n.staff_id = auth.uid()) or (n.to_role = 'admin' and public.is_admin()));
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
revoke execute on function public.mark_notifications_read(uuid[]) from public, anon;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;

-- Live pop-ups (Realtime follows the read policy above).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'staff_notifications') then
    alter publication supabase_realtime add table public.staff_notifications;
  end if;
end;
$$;
