-- =====================================================================
-- Functions: auth helpers, catalogue queries, order + payment processing
-- =====================================================================

-- ---------------------------------------------------------------------
-- Auth / role helpers
-- ---------------------------------------------------------------------
create or replace function public.has_role(p_role public.app_role) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles where user_id = auth.uid() and role = p_role
  );
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role('admin');
$$;

-- Staff can manage orders & fulfilment; admins can do everything.
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles where user_id = auth.uid() and role in ('admin', 'staff')
  );
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, nullif(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Run manually from the SQL editor (service role) to bootstrap an admin.
create or replace function public.grant_role_by_email(p_email text, p_role public.app_role) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
begin
  select id into v_user from auth.users where lower(email) = lower(p_email);
  if v_user is null then
    raise exception 'No user with email %', p_email;
  end if;
  insert into public.user_roles (user_id, role) values (v_user, p_role) on conflict do nothing;
end;
$$;

-- ---------------------------------------------------------------------
-- Rate limiting (fixed window)
-- ---------------------------------------------------------------------
create or replace function public.check_rate_limit(p_key text, p_max int, p_window_seconds int) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  insert into public.rate_limits as rl (key, window_start, count)
  values (p_key, now(), 1)
  on conflict (key) do update set
    count = case when rl.window_start < now() - make_interval(secs => p_window_seconds) then 1 else rl.count + 1 end,
    window_start = case when rl.window_start < now() - make_interval(secs => p_window_seconds) then now() else rl.window_start end
  returning count into v_count;
  return v_count <= p_max;
end;
$$;

-- ---------------------------------------------------------------------
-- Sales counts from genuine paid orders (aggregate only, no PII)
-- ---------------------------------------------------------------------
create or replace function public.product_sales_counts() returns table (product_id uuid, units bigint)
language sql stable security definer set search_path = public as $$
  select oi.product_id, sum(oi.quantity)::bigint
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where o.payment_status = 'paid'
    and o.status not in ('cancelled', 'refunded')
    and oi.product_id is not null
  group by oi.product_id;
$$;

-- ---------------------------------------------------------------------
-- Catalogue search (SECURITY INVOKER: RLS applies to the caller)
-- ---------------------------------------------------------------------
create or replace function public.catalog_search(
  p_query text default null,
  p_category_id uuid default null,
  p_sizes text[] default null,
  p_colors text[] default null,
  p_min_price int default null,
  p_max_price int default null,
  p_availability text default null,       -- 'in_stock' | 'out_of_stock'
  p_on_sale boolean default false,
  p_featured boolean default false,
  p_sort text default 'newest',            -- newest | price_asc | price_desc | popular | name
  p_limit int default 24,
  p_offset int default 0,
  p_collection_id uuid default null
) returns table (
  id uuid,
  slug text,
  name text,
  price int,
  sale_price int,
  category_id uuid,
  published_at timestamptz,
  image_url text,
  image_alt text,
  hover_image_url text,
  colors jsonb,
  sizes text[],
  in_stock boolean,
  units_sold bigint,
  total_count bigint
)
language sql stable security invoker set search_path = public as $$
  with q as (
    select nullif(
      array_to_string(
        array(
          select t || ':*'
          from regexp_split_to_table(lower(coalesce(p_query, '')), '[^a-z0-9]+') as t
          where t <> ''
        ),
        ' & '
      ),
      ''
    ) as tsq
  ),
  sales as (select * from public.product_sales_counts()),
  base as (
    select
      p.*,
      coalesce(p.sale_price, p.price) as effective_price,
      coalesce(s.units, 0) as units,
      (
        p.allow_backorder or exists (
          select 1 from public.product_variants v
          join public.inventory i on i.variant_id = v.id
          where v.product_id = p.id and v.is_active and i.on_hand > 0
        )
      ) as available
    from public.products p
    left join sales s on s.product_id = p.id
    cross join q
    where p.status = 'published'
      and (p_featured is not true or p.is_featured)
      and (p_collection_id is null or p.id in (
        select cp.product_id from public.collection_products cp where cp.collection_id = p_collection_id))
      and (p_on_sale is not true or p.sale_price is not null)
      and (
        p_category_id is null
        or p.category_id = p_category_id
        or p.category_id in (select c.id from public.categories c where c.parent_id = p_category_id)
      )
      and (
        q.tsq is null
        or p.search @@ to_tsquery('simple', q.tsq)
        or p.name ilike '%' || trim(p_query) || '%'
      )
      and (p_min_price is null or coalesce(p.sale_price, p.price) >= p_min_price)
      and (p_max_price is null or coalesce(p.sale_price, p.price) <= p_max_price)
      and (
        p_sizes is null or cardinality(p_sizes) = 0 or exists (
          select 1 from public.product_variants v
          where v.product_id = p.id and v.is_active and v.size = any (p_sizes)
        )
      )
      and (
        p_colors is null or cardinality(p_colors) = 0 or exists (
          select 1 from public.product_variants v
          where v.product_id = p.id and v.is_active and lower(v.color) = any (p_colors)
        )
      )
  ),
  filtered as (
    select * from base
    where p_availability is null
       or (p_availability = 'in_stock' and available)
       or (p_availability = 'out_of_stock' and not available)
  )
  select
    f.id, f.slug, f.name, f.price, f.sale_price, f.category_id, f.published_at,
    img.url, img.alt, img2.url,
    coalesce((
      select jsonb_agg(distinct jsonb_build_object('name', v.color, 'hex', v.color_hex))
      from public.product_variants v
      where v.product_id = f.id and v.is_active and v.color is not null
    ), '[]'::jsonb),
    coalesce(array(
      select distinct v.size from public.product_variants v
      where v.product_id = f.id and v.is_active and v.size is not null
    ), '{}'),
    f.available,
    f.units,
    count(*) over ()
  from filtered f
  left join lateral (
    select pi.url, pi.alt from public.product_images pi
    where pi.product_id = f.id order by pi.sort_order, pi.created_at limit 1
  ) img on true
  left join lateral (
    select pi.url from public.product_images pi
    where pi.product_id = f.id order by pi.sort_order, pi.created_at offset 1 limit 1
  ) img2 on true
  order by
    case when p_sort = 'price_asc' then f.effective_price end asc nulls last,
    case when p_sort = 'price_desc' then f.effective_price end desc nulls last,
    case when p_sort = 'popular' then f.units end desc nulls last,
    case when p_sort = 'name' then f.name end asc,
    f.published_at desc nulls last,
    f.id
  limit least(greatest(coalesce(p_limit, 24), 1), 60)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- Facet values for the filter UI
create or replace function public.catalog_facets(p_category_id uuid default null)
returns jsonb
language sql stable security invoker set search_path = public as $$
  with scoped as (
    select p.* from public.products p
    where p.status = 'published'
      and (
        p_category_id is null
        or p.category_id = p_category_id
        or p.category_id in (select c.id from public.categories c where c.parent_id = p_category_id)
      )
  )
  select jsonb_build_object(
    'sizes', coalesce((
      select jsonb_agg(size order by min_sort, size)
      from (
        select v.size, min(v.sort_order) as min_sort
        from public.product_variants v join scoped s on s.id = v.product_id
        where v.is_active and v.size is not null group by v.size
      ) x
    ), '[]'::jsonb),
    'colors', coalesce((
      select jsonb_agg(jsonb_build_object('name', color, 'hex', hex) order by color)
      from (
        select min(v.color) as color, min(v.color_hex) as hex
        from public.product_variants v join scoped s on s.id = v.product_id
        where v.is_active and v.color is not null group by lower(v.color)
      ) y
    ), '[]'::jsonb),
    'min_price', (select min(coalesce(sale_price, price)) from scoped),
    'max_price', (select max(coalesce(sale_price, price)) from scoped),
    'has_sales', exists (select 1 from public.product_sales_counts() sc join scoped s on s.id = sc.product_id)
  );
$$;

-- ---------------------------------------------------------------------
-- Order creation (called by the server with the service role only).
-- Prices are computed server-side from the database, then re-verified here.
-- ---------------------------------------------------------------------
create or replace function public.create_order(p_order jsonb, p_items jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_existing public.orders;
  v_order public.orders;
  v_item jsonb;
  v_row record;
  v_subtotal int := 0;
  v_discount public.discounts;
begin
  select * into v_existing from public.orders where idempotency_key = p_order ->> 'idempotency_key';
  if found then
    return jsonb_build_object('created', false, 'order_id', v_existing.id, 'order_number', v_existing.order_number,
      'access_token', v_existing.access_token, 'total', v_existing.total, 'currency', v_existing.currency,
      'status', v_existing.status, 'payment_status', v_existing.payment_status);
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_cart' using errcode = 'P0001';
  end if;

  -- Re-verify every line against current catalogue data and stock.
  for v_item in select * from jsonb_array_elements(p_items) loop
    select v.id as variant_id, v.sku, p.id as product_id, p.status, p.allow_backorder,
           coalesce(p.sale_price, p.price) as unit_price, coalesce(i.on_hand, 0) as on_hand, v.is_active
      into v_row
      from public.product_variants v
      join public.products p on p.id = v.product_id
      left join public.inventory i on i.variant_id = v.id
      where v.id = (v_item ->> 'variant_id')::uuid
      for share of v;
    if not found or v_row.status <> 'published' or not v_row.is_active then
      raise exception 'variant_unavailable:%', v_item ->> 'variant_id' using errcode = 'P0001';
    end if;
    if (v_item ->> 'unit_price')::int <> v_row.unit_price then
      raise exception 'price_changed:%', v_row.sku using errcode = 'P0001';
    end if;
    if not v_row.allow_backorder and v_row.on_hand < (v_item ->> 'quantity')::int then
      raise exception 'insufficient_stock:%', v_row.sku using errcode = 'P0001';
    end if;
    v_subtotal := v_subtotal + v_row.unit_price * (v_item ->> 'quantity')::int;
  end loop;

  if v_subtotal <> (p_order ->> 'subtotal')::int then
    raise exception 'subtotal_mismatch' using errcode = 'P0001';
  end if;

  if nullif(p_order ->> 'discount_code', '') is not null then
    select * into v_discount from public.discounts where code = p_order ->> 'discount_code' for share;
    if not found or not v_discount.is_active
       or (v_discount.starts_at is not null and v_discount.starts_at > now())
       or (v_discount.ends_at is not null and v_discount.ends_at <= now())
       or (v_discount.usage_limit is not null and v_discount.usage_count >= v_discount.usage_limit) then
      raise exception 'discount_invalid' using errcode = 'P0001';
    end if;
  end if;

  insert into public.orders (
    user_id, cart_id, email, phone, customer_name, shipping_address, delivery_instructions,
    shipping_method_name, shipping_rate_id, shipping_is_manual, shipping_min_days, shipping_max_days,
    currency, subtotal, discount_total, discount_code, shipping_fee, tax_total, total, idempotency_key
  ) values (
    nullif(p_order ->> 'user_id', '')::uuid,
    nullif(p_order ->> 'cart_id', '')::uuid,
    p_order ->> 'email', p_order ->> 'phone', p_order ->> 'customer_name',
    p_order -> 'shipping_address', nullif(p_order ->> 'delivery_instructions', ''),
    p_order ->> 'shipping_method_name', nullif(p_order ->> 'shipping_rate_id', '')::uuid,
    coalesce((p_order ->> 'shipping_is_manual')::boolean, true),
    (p_order ->> 'shipping_min_days')::int, (p_order ->> 'shipping_max_days')::int,
    p_order ->> 'currency', (p_order ->> 'subtotal')::int, (p_order ->> 'discount_total')::int,
    nullif(p_order ->> 'discount_code', ''), (p_order ->> 'shipping_fee')::int,
    (p_order ->> 'tax_total')::int, (p_order ->> 'total')::int, p_order ->> 'idempotency_key'
  ) returning * into v_order;

  insert into public.order_items (order_id, product_id, variant_id, product_name, product_slug, variant_label, sku,
                                  image_url, unit_price, quantity, line_total)
  select v_order.id, (x ->> 'product_id')::uuid, (x ->> 'variant_id')::uuid, x ->> 'product_name', x ->> 'product_slug',
         nullif(x ->> 'variant_label', ''), x ->> 'sku', nullif(x ->> 'image_url', ''),
         (x ->> 'unit_price')::int, (x ->> 'quantity')::int, (x ->> 'unit_price')::int * (x ->> 'quantity')::int
  from jsonb_array_elements(p_items) x;

  insert into public.order_status_history (order_id, status, public_note)
  values (v_order.id, 'pending_payment', 'Order placed — awaiting payment.');

  return jsonb_build_object('created', true, 'order_id', v_order.id, 'order_number', v_order.order_number,
    'access_token', v_order.access_token, 'total', v_order.total, 'currency', v_order.currency,
    'status', v_order.status, 'payment_status', v_order.payment_status);
exception
  when unique_violation then
    -- concurrent duplicate submit with the same idempotency key
    select * into v_existing from public.orders where idempotency_key = p_order ->> 'idempotency_key';
    if found then
      return jsonb_build_object('created', false, 'order_id', v_existing.id, 'order_number', v_existing.order_number,
        'access_token', v_existing.access_token, 'total', v_existing.total, 'currency', v_existing.currency,
        'status', v_existing.status, 'payment_status', v_existing.payment_status);
    end if;
    raise;
end;
$$;

-- ---------------------------------------------------------------------
-- Payment finalisation — idempotent; call ONLY after server-side
-- verification with the payment provider.
-- ---------------------------------------------------------------------
create or replace function public.finalize_payment(
  p_reference text,
  p_amount int,
  p_currency text,
  p_provider_transaction_id text,
  p_channel text,
  p_paid_at timestamptz,
  p_raw jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_payment public.payments;
  v_order public.orders;
  v_item record;
  v_conflict boolean := false;
  v_updated int;
begin
  select * into v_payment from public.payments where reference = p_reference for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'unknown_reference');
  end if;
  select * into v_order from public.orders where id = v_payment.order_id for update;

  if v_payment.status = 'success' then
    return jsonb_build_object('ok', true, 'code', 'already_processed', 'order_id', v_order.id,
      'order_number', v_order.order_number);
  end if;

  if p_amount <> v_payment.amount or upper(p_currency) <> v_payment.currency or v_payment.amount <> v_order.total then
    update public.payments
       set status = 'failed', failure_reason = 'amount_or_currency_mismatch', raw_verification = p_raw
     where id = v_payment.id;
    return jsonb_build_object('ok', false, 'code', 'amount_mismatch', 'order_id', v_order.id);
  end if;

  if v_order.payment_status = 'paid' then
    -- A second successful attempt for an already-paid order: record it for refund.
    update public.payments
       set status = 'success', provider_transaction_id = p_provider_transaction_id, channel = p_channel,
           paid_at = coalesce(p_paid_at, now()), raw_verification = p_raw,
           failure_reason = 'duplicate_payment_refund_required'
     where id = v_payment.id;
    return jsonb_build_object('ok', true, 'code', 'duplicate_payment', 'order_id', v_order.id,
      'order_number', v_order.order_number);
  end if;

  update public.payments
     set status = 'success', provider_transaction_id = p_provider_transaction_id, channel = p_channel,
         paid_at = coalesce(p_paid_at, now()), raw_verification = p_raw, failure_reason = null
   where id = v_payment.id;

  update public.payments set status = 'abandoned'
   where order_id = v_order.id and id <> v_payment.id and status = 'initialized';

  -- Commit inventory now that payment is verified.
  for v_item in
    select oi.variant_id, oi.quantity, coalesce(p.allow_backorder, false) as allow_backorder
    from public.order_items oi
    left join public.products p on p.id = oi.product_id
    where oi.order_id = v_order.id
  loop
    if v_item.variant_id is null then
      v_conflict := true;
      continue;
    end if;
    update public.inventory
       set on_hand = on_hand - v_item.quantity
     where variant_id = v_item.variant_id
       and (v_item.allow_backorder or on_hand >= v_item.quantity);
    get diagnostics v_updated = row_count;
    if v_updated = 0 then
      v_conflict := true;
    else
      insert into public.inventory_movements (variant_id, delta, reason, order_id)
      values (v_item.variant_id, -v_item.quantity, 'order', v_order.id);
    end if;
  end loop;

  update public.orders
     set payment_status = 'paid',
         status = case when status = 'pending_payment' then 'paid'::public.order_status else status end,
         paid_at = coalesce(p_paid_at, now()),
         inventory_conflict = v_conflict
   where id = v_order.id;

  insert into public.order_status_history (order_id, status, public_note)
  values (v_order.id, case when v_order.status = 'pending_payment' then 'paid'::public.order_status else v_order.status end,
          'Payment confirmed.');

  insert into public.fulfilments (order_id, status) values (v_order.id, 'not_started')
  on conflict (order_id) do nothing;

  if v_order.discount_code is not null then
    with d as (
      update public.discounts set usage_count = usage_count + 1
       where code = v_order.discount_code
      returning id
    )
    insert into public.discount_redemptions (discount_id, order_id, email)
    select d.id, v_order.id, v_order.email from d
    on conflict (order_id) do nothing;
  end if;

  return jsonb_build_object('ok', true, 'code', 'paid', 'order_id', v_order.id,
    'order_number', v_order.order_number, 'inventory_conflict', v_conflict);
end;
$$;

create or replace function public.record_payment_failure(p_reference text, p_reason text, p_raw jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_payment public.payments;
begin
  select * into v_payment from public.payments where reference = p_reference for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'unknown_reference');
  end if;
  if v_payment.status = 'success' then
    -- never downgrade a verified payment
    return jsonb_build_object('ok', true, 'code', 'already_paid');
  end if;
  update public.payments set status = 'failed', failure_reason = left(p_reason, 200), raw_verification = p_raw
   where id = v_payment.id;
  update public.orders set payment_status = 'failed'
   where id = v_payment.order_id and payment_status in ('unpaid', 'pending');
  return jsonb_build_object('ok', true, 'code', 'failed');
end;
$$;

-- ---------------------------------------------------------------------
-- Admin operations (checked against the caller's role)
-- ---------------------------------------------------------------------
create or replace function public.order_status_transition_allowed(
  p_from public.order_status, p_to public.order_status, p_paid boolean
) returns boolean
language sql immutable as $$
  select case p_from
    when 'pending_payment' then p_to in ('cancelled')
    when 'paid' then p_to in ('processing', 'awaiting_supplier', 'ordered_from_supplier', 'shipped', 'cancelled', 'refunded')
    when 'processing' then p_to in ('awaiting_supplier', 'ordered_from_supplier', 'shipped', 'cancelled', 'refunded')
    when 'awaiting_supplier' then p_to in ('ordered_from_supplier', 'shipped', 'cancelled', 'refunded')
    when 'ordered_from_supplier' then p_to in ('shipped', 'in_transit', 'cancelled', 'refunded')
    when 'shipped' then p_to in ('in_transit', 'delivered', 'refunded')
    when 'in_transit' then p_to in ('delivered', 'refunded')
    when 'delivered' then p_to in ('refunded')
    when 'cancelled' then p_to = 'refunded' and p_paid
    else false
  end
  and (p_to <> 'refunded' or p_paid);
$$;

create or replace function public.admin_update_order_status(
  p_order_id uuid,
  p_status public.order_status,
  p_public_note text default null,
  p_restock boolean default false
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders;
  v_item record;
begin
  if not public.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;
  if not public.order_status_transition_allowed(v_order.status, p_status, v_order.payment_status = 'paid') then
    raise exception 'invalid_transition:% -> %', v_order.status, p_status using errcode = 'P0001';
  end if;

  update public.orders set
    status = p_status,
    cancelled_at = case when p_status = 'cancelled' then now() else cancelled_at end,
    refunded_at = case when p_status = 'refunded' then now() else refunded_at end,
    payment_status = case when p_status = 'refunded' then 'refunded'::public.payment_status else payment_status end
  where id = p_order_id;

  insert into public.order_status_history (order_id, status, public_note, created_by)
  values (p_order_id, p_status, nullif(trim(p_public_note), ''), auth.uid());

  -- Return stock only when inventory was actually taken for this order.
  if p_restock and p_status in ('cancelled', 'refunded') and v_order.payment_status = 'paid'
     and v_order.status not in ('cancelled', 'refunded') then
    for v_item in
      select m.variant_id, -sum(m.delta) as qty from public.inventory_movements m
      where m.order_id = p_order_id group by m.variant_id having sum(m.delta) < 0
    loop
      update public.inventory set on_hand = on_hand + v_item.qty where variant_id = v_item.variant_id;
      insert into public.inventory_movements (variant_id, delta, reason, order_id, created_by)
      values (v_item.variant_id, v_item.qty, case when p_status = 'refunded' then 'refund' else 'cancellation' end,
              p_order_id, auth.uid());
    end loop;
  end if;

  update public.fulfilments set status = case p_status
      when 'awaiting_supplier' then 'awaiting_supplier'::public.fulfilment_status
      when 'ordered_from_supplier' then 'ordered_from_supplier'
      when 'shipped' then 'shipped'
      when 'in_transit' then 'shipped'
      when 'delivered' then 'delivered'
      when 'cancelled' then 'cancelled'
      else status end
  where order_id = p_order_id;

  return jsonb_build_object('ok', true, 'status', p_status);
end;
$$;

create or replace function public.admin_set_stock(p_variant_id uuid, p_on_hand int, p_note text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_old int;
begin
  if not public.is_admin() then
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

create or replace function public.admin_dashboard_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'total_orders', (select count(*) from public.orders),
    'paid_orders', (select count(*) from public.orders where payment_status = 'paid'),
    'revenue', (select coalesce(sum(total), 0) from public.orders where payment_status = 'paid' and status <> 'refunded'),
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

-- ---------------------------------------------------------------------
-- Public order tracking: returns a privacy-limited projection only when
-- the order number AND email match. Called server-side (rate limited).
-- ---------------------------------------------------------------------
create or replace function public.track_order(p_order_number text, p_email text) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when o.id is null then null else jsonb_build_object(
    'order_number', o.order_number,
    'status', o.status,
    'payment_status', o.payment_status,
    'created_at', o.created_at,
    'paid_at', o.paid_at,
    'shipping_method_name', o.shipping_method_name,
    'shipping_min_days', o.shipping_min_days,
    'shipping_max_days', o.shipping_max_days,
    'destination', jsonb_build_object(
      'city', o.shipping_address ->> 'city',
      'region', o.shipping_address ->> 'region',
      'country_code', o.shipping_address ->> 'country_code'
    ),
    'items', coalesce((select jsonb_agg(jsonb_build_object('name', oi.product_name, 'variant', oi.variant_label,
                                                           'quantity', oi.quantity) order by oi.product_name)
                       from public.order_items oi where oi.order_id = o.id), '[]'::jsonb),
    'tracking', coalesce((select jsonb_agg(jsonb_build_object('carrier', t.carrier, 'tracking_number', t.tracking_number,
                                                              'tracking_url', t.tracking_url, 'dispatched_at', t.dispatched_at)
                                           order by t.created_at)
                          from public.shipment_tracking t where t.order_id = o.id), '[]'::jsonb),
    'history', coalesce((select jsonb_agg(jsonb_build_object('status', h.status, 'note', h.public_note,
                                                             'created_at', h.created_at) order by h.created_at)
                         from public.order_status_history h where h.order_id = o.id), '[]'::jsonb)
  ) end
  from (select 1) dummy
  left join public.orders o
    on upper(o.order_number) = upper(trim(p_order_number)) and lower(o.email) = lower(trim(p_email));
$$;

-- ---------------------------------------------------------------------
-- Execute privileges: lock down the sensitive functions.
-- ---------------------------------------------------------------------
revoke execute on function public.create_order(jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.finalize_payment(text, int, text, text, text, timestamptz, jsonb) from public, anon, authenticated;
revoke execute on function public.record_payment_failure(text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.track_order(text, text) from public, anon, authenticated;
revoke execute on function public.check_rate_limit(text, int, int) from public, anon, authenticated;
revoke execute on function public.grant_role_by_email(text, public.app_role) from public, anon, authenticated;
grant execute on function public.create_order(jsonb, jsonb) to service_role;
grant execute on function public.finalize_payment(text, int, text, text, text, timestamptz, jsonb) to service_role;
grant execute on function public.record_payment_failure(text, text, jsonb) to service_role;
grant execute on function public.track_order(text, text) to service_role;
grant execute on function public.check_rate_limit(text, int, int) to service_role;
grant execute on function public.grant_role_by_email(text, public.app_role) to service_role;

revoke execute on function public.admin_update_order_status(uuid, public.order_status, text, boolean) from public, anon;
revoke execute on function public.admin_set_stock(uuid, int, text) from public, anon;
revoke execute on function public.admin_dashboard_stats() from public, anon;
grant execute on function public.admin_update_order_status(uuid, public.order_status, text, boolean) to authenticated;
grant execute on function public.admin_set_stock(uuid, int, text) to authenticated;
grant execute on function public.admin_dashboard_stats() to authenticated;
