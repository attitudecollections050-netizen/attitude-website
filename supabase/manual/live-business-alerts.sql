-- =====================================================================
-- Business alerts for the owner (push + pink pop-ups): orders, payments,
-- bank transfers to check, low stock — alongside the staff-work alerts.
--
-- * admin_alerts: written only by the triggers below; the owner can read
--   them (and receives them live). Each is pushed once (pushed_at).
--     orders   : new order, shipped, delivered, cancelled, delivery failed
--                (cancelled/refunded after it was shipped or in transit)
--     payments : payment received (Paystack/bank), payment failed,
--                customer says they sent a bank transfer (to verify)
--     low_stock: a published product's size/colour drops to its low-stock
--                level or sells out (once per drop, not on every sale)
-- * push_subscriptions.alert_types: which kinds each device wants
--   (Staff work / New orders / Payments / Low stock). All on by default.
-- =====================================================================

alter table public.push_subscriptions
  add column if not exists alert_types text[] not null default array['staff_work', 'orders', 'payments', 'low_stock']
    check (alert_types <@ array['staff_work', 'orders', 'payments', 'low_stock']);

-- Each person sets their own devices' alert types (nothing else on the row).
create or replace function public.set_push_alert_types(p_device_id uuid, p_types text[])
returns text[]
language plpgsql security definer set search_path = public as $$
declare
  v_types text[];
begin
  if auth.uid() is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not (coalesce(p_types, '{}') <@ array['staff_work', 'orders', 'payments', 'low_stock']) then
    raise exception 'invalid_alert_types' using errcode = 'P0001';
  end if;
  update public.push_subscriptions
     set alert_types = (select coalesce(array_agg(distinct t order by t), '{}') from unnest(coalesce(p_types, '{}')) t)
   where id = p_device_id and user_id = auth.uid()
  returning alert_types into v_types;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  return v_types;
end;
$$;
revoke execute on function public.set_push_alert_types(uuid, text[]) from public, anon;
grant execute on function public.set_push_alert_types(uuid, text[]) to authenticated;

create table if not exists public.admin_alerts (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('orders', 'payments', 'low_stock')),
  kind text not null check (kind in ('order_new', 'order_shipped', 'order_delivered', 'order_cancelled', 'delivery_failed',
                                     'payment_received', 'payment_failed', 'transfer_claim', 'low_stock', 'out_of_stock')),
  title text not null check (char_length(title) <= 120),
  message text not null check (char_length(message) <= 500),
  link text check (link is null or link ~ '^/[A-Za-z0-9/_-]*$'),
  order_id uuid references public.orders (id) on delete cascade,
  variant_id uuid references public.product_variants (id) on delete cascade,
  amount int,
  currency char(3),
  pushed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists admin_alerts_created_idx on public.admin_alerts (created_at desc);
create index if not exists admin_alerts_unpushed_idx on public.admin_alerts (created_at) where pushed_at is null;
alter table public.admin_alerts enable row level security;
drop policy if exists "admin_alerts: owner read" on public.admin_alerts;
create policy "admin_alerts: owner read" on public.admin_alerts for select using (public.is_admin());
-- No write policies: only the triggers below write alerts.

-- "₦32,500" from an amount in kobo (other currencies: "USD 25.00").
create or replace function public.money_text(p_minor int, p_currency text) returns text
language sql immutable as $$
  select case when coalesce(p_currency, 'NGN') = 'NGN' then public.naira_text(p_minor / 100.0)
              else p_currency || ' ' || to_char(p_minor / 100.0, 'FM999,999,999,990.00') end
$$;

create or replace function public.add_admin_alert(
  p_category text, p_kind text, p_title text, p_message text, p_link text,
  p_order uuid default null, p_variant uuid default null, p_amount int default null, p_currency text default null
) returns void
language sql security definer set search_path = public as $$
  insert into public.admin_alerts (category, kind, title, message, link, order_id, variant_id, amount, currency)
  values (p_category, p_kind, left(p_title, 120), left(p_message, 500), p_link, p_order, p_variant, p_amount, p_currency);
$$;
revoke execute on function public.add_admin_alert(text, text, text, text, text, uuid, uuid, int, text) from public, anon, authenticated;

-- Orders: new order, payment received/failed, shipped/delivered/cancelled/delivery failed.
create or replace function public.alert_on_order() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_amount text := public.money_text(new.total, new.currency);
  v_link text := '/admin/orders/' || new.id;
  v_method text;
  v_channel text;
begin
  if tg_op = 'INSERT' then
    perform public.add_admin_alert('orders', 'order_new', '🛒 New Order!',
      new.order_number || ' - ' || v_amount || ' - ' || new.customer_name || '. Tap to view.', v_link, new.id, null, new.total, new.currency);
    return null;
  end if;

  if new.payment_status is distinct from old.payment_status then
    if new.payment_status = 'paid' then
      if new.payment_method = 'bank_transfer' then
        v_method := 'Bank transfer';
      else
        select channel into v_channel from public.payments where order_id = new.id and status = 'success' order by paid_at desc nulls last limit 1;
        v_method := 'Paystack' || coalesce(' (' || replace(v_channel, '_', ' ') || ')', '');
      end if;
      perform public.add_admin_alert('payments', 'payment_received', '💰 Payment Received!',
        v_amount || ' for Order ' || new.order_number || ' - ' || new.customer_name || '. Method: ' || v_method, v_link, new.id, null, new.total, new.currency);
    elsif new.payment_status = 'failed' then
      perform public.add_admin_alert('payments', 'payment_failed', '❌ Payment Failed',
        'Order ' || new.order_number || ' - ' || v_amount || ' - ' || new.customer_name || ' tried to pay', v_link, new.id, null, new.total, new.currency);
    end if;
  end if;

  if new.status is distinct from old.status then
    if new.status = 'shipped' then
      perform public.add_admin_alert('orders', 'order_shipped', '🚚 Order Shipped',
        'Order ' || new.order_number || ' - ' || new.customer_name || ' is on its way.', v_link, new.id);
    elsif new.status = 'delivered' then
      perform public.add_admin_alert('orders', 'order_delivered', '✅ Order Delivered',
        'Order ' || new.order_number || ' - ' || new.customer_name || ' was delivered.', v_link, new.id);
    elsif new.status in ('cancelled', 'refunded') and old.status in ('shipped', 'in_transit') then
      perform public.add_admin_alert('orders', 'delivery_failed', '⚠️ Delivery Failed',
        'Order ' || new.order_number || ' - ' || new.customer_name || ' was ' || new.status::text || ' after it was ' || replace(old.status::text, '_', ' ') || '. Check with the customer and courier.', v_link, new.id);
    elsif new.status = 'cancelled' then
      perform public.add_admin_alert('orders', 'order_cancelled', '🚫 Order Cancelled',
        'Order ' || new.order_number || ' - ' || v_amount || ' - ' || new.customer_name || ' was cancelled.', v_link, new.id);
    end if;
  end if;
  return null;
end;
$$;
drop trigger if exists alert_order_insert on public.orders;
create trigger alert_order_insert after insert on public.orders for each row execute function public.alert_on_order();
drop trigger if exists alert_order_update on public.orders;
create trigger alert_order_update after update of status, payment_status on public.orders for each row execute function public.alert_on_order();

-- Bank transfers: the customer says they sent the money — the owner should check the bank.
create or replace function public.alert_on_transfer_claim() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = new.order_id;
  perform public.add_admin_alert('payments', 'transfer_claim', '🏦 Bank Transfer to Check',
    new.customer_name || ' says they sent ' || public.money_text(new.amount_paid, coalesce(v_order.currency, 'NGN')) || ' for Order '
      || coalesce(v_order.order_number, '?') || ' (ref ' || new.transfer_reference || '). Check your bank, then confirm.',
    '/admin/transfers/' || new.id, new.order_id, null, new.amount_paid, v_order.currency);
  return null;
end;
$$;
drop trigger if exists alert_transfer_claim on public.payment_claims;
create trigger alert_transfer_claim after insert on public.payment_claims for each row execute function public.alert_on_transfer_claim();

-- Low stock: once when a published product's size/colour drops to its low-stock level, and when it sells out.
create or replace function public.alert_on_stock() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v record;
  v_was int := case when tg_op = 'UPDATE' then old.on_hand else null end;
  v_label text;
begin
  if new.on_hand > new.low_stock_threshold then return null; end if;
  -- only when it crosses a line: into "low", or into "sold out"
  if v_was is not null and not ((v_was > new.low_stock_threshold) or (v_was > 0 and new.on_hand <= 0)) then return null; end if;
  select p.id as product_id, p.name, p.status, pv.size, pv.color, pv.is_active into v
    from public.product_variants pv join public.products p on p.id = pv.product_id where pv.id = new.variant_id;
  if not found or v.status <> 'published' or not v.is_active then return null; end if;
  v_label := v.name || coalesce(' (' || nullif(concat_ws(' / ', v.size, v.color), '') || ')', '');
  if new.on_hand <= 0 then
    perform public.add_admin_alert('low_stock', 'out_of_stock', '⛔ Sold Out',
      v_label || ' is out of stock. Restock it or hide it.', '/admin/products/' || v.product_id, null, new.variant_id);
  else
    perform public.add_admin_alert('low_stock', 'low_stock', '📦 Low Stock',
      v_label || ' — only ' || new.on_hand || ' left.', '/admin/products/' || v.product_id, null, new.variant_id);
  end if;
  return null;
end;
$$;
drop trigger if exists alert_stock on public.inventory;
create trigger alert_stock after insert or update of on_hand on public.inventory for each row execute function public.alert_on_stock();

-- Live pink pop-ups for the owner (Realtime follows the read policy above).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'admin_alerts') then
    alter publication supabase_realtime add table public.admin_alerts;
  end if;
end;
$$;
