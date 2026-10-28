-- =====================================================================
-- Analytics & reports, customer feedback and heart ratings.
--
-- Analytics is first-party and consent-based: the storefront only sends
-- events after the visitor accepts analytics cookies, using a random
-- visitor id (no IP address, no user agent, no fingerprinting is stored).
-- Purchases are never sent by the browser — they are recorded by a trigger
-- when the order's payment is verified, at most once per order.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Analytics events
-- ---------------------------------------------------------------------
create table public.analytics_events (
  id bigint generated always as identity primary key,
  event_type text not null check (event_type in ('page_view', 'product_view', 'add_to_cart', 'checkout_start', 'purchase')),
  visitor_id uuid not null,
  session_id uuid,
  path text check (char_length(path) <= 300),
  product_id uuid references public.products (id) on delete set null,
  order_id uuid references public.orders (id) on delete cascade,
  referrer_host text check (char_length(referrer_host) <= 120),
  source text check (source in ('direct', 'search', 'social', 'email', 'paid', 'referral', 'campaign')),
  utm_source text check (char_length(utm_source) <= 80),
  utm_medium text check (char_length(utm_medium) <= 80),
  utm_campaign text check (char_length(utm_campaign) <= 120),
  device text check (device in ('mobile', 'tablet', 'desktop')),
  country char(2) check (country ~ '^[A-Z]{2}$'),
  value int check (value >= 0),
  currency char(3),
  created_at timestamptz not null default now()
);
create index analytics_events_created_idx on public.analytics_events (created_at);
create index analytics_events_type_created_idx on public.analytics_events (event_type, created_at);
create index analytics_events_visitor_idx on public.analytics_events (visitor_id, created_at);
create index analytics_events_product_idx on public.analytics_events (product_id) where product_id is not null;
-- One purchase event per order, whatever retries the payment flow makes.
create unique index analytics_events_purchase_once on public.analytics_events (order_id) where event_type = 'purchase';

-- The consenting visitor's id is copied onto the order at checkout so the
-- verified payment can be attributed to the same visitor.
alter table public.orders add column analytics_visitor_id uuid;

create or replace function public.analytics_record_purchase() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.payment_status = 'paid' and old.payment_status is distinct from 'paid' and new.analytics_visitor_id is not null then
    insert into public.analytics_events (event_type, visitor_id, order_id, value, currency, created_at)
    values ('purchase', new.analytics_visitor_id, new.id, new.total, new.currency, coalesce(new.paid_at, now()))
    on conflict (order_id) where event_type = 'purchase' do nothing;
  end if;
  return new;
end;
$$;
revoke execute on function public.analytics_record_purchase() from public, anon, authenticated;
create trigger orders_analytics_purchase
  after update of payment_status on public.orders
  for each row execute function public.analytics_record_purchase();

alter table public.analytics_events enable row level security;
-- Inserts come only from the server (service role). Reports are admin-only.
create policy "analytics_events: admin read" on public.analytics_events
  for select using (public.is_admin());

-- ---------------------------------------------------------------------
-- Customer feedback & product reviews (five-heart rating)
-- ---------------------------------------------------------------------
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'site' check (kind in ('site', 'product')),
  product_id uuid references public.products (id) on delete set null,
  order_id uuid references public.orders (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  sentiment text not null check (sentiment in ('positive', 'neutral', 'negative')),
  comment text check (char_length(comment) <= 2000),
  reason text check (reason in ('product_quality', 'sizing_fit', 'price_value', 'delivery', 'customer_service', 'website', 'payment', 'other')),
  suggestion text check (char_length(suggestion) <= 1000),
  display_name_pref text not null default 'anonymous' check (display_name_pref in ('first_name', 'anonymous')),
  display_name text check (char_length(display_name) <= 40),
  publish_consent boolean not null default false,
  is_verified_purchase boolean not null default false,
  source text not null default 'form' check (source in ('exit_intent', 'timed_prompt', 'form', 'product_page', 'order_page')),
  page_path text check (char_length(page_path) <= 300),
  visitor_id uuid,
  submitter_key text,
  status text not null default 'new' check (status in ('new', 'reviewed')),
  moderation text not null default 'pending' check (moderation in ('pending', 'approved', 'hidden')),
  flag text check (flag in ('spam', 'abusive', 'other')),
  response text check (char_length(response) <= 2000),
  responded_at timestamptz,
  responded_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index feedback_created_idx on public.feedback (created_at desc);
create index feedback_product_idx on public.feedback (product_id, created_at desc) where kind = 'product';
create index feedback_rating_idx on public.feedback (rating);
create index feedback_submitter_idx on public.feedback (submitter_key, created_at desc);
-- One review per product per customer account.
create unique index feedback_one_review_per_product on public.feedback (user_id, product_id) where kind = 'product' and user_id is not null;
create trigger feedback_updated_at before update on public.feedback
  for each row execute function public.set_updated_at();

-- Private notes: staff only, never shown to customers.
create table public.feedback_notes (
  id bigint generated always as identity primary key,
  feedback_id uuid not null references public.feedback (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  note text not null check (char_length(note) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index feedback_notes_feedback_idx on public.feedback_notes (feedback_id, created_at);

alter table public.feedback enable row level security;
alter table public.feedback_notes enable row level security;
-- Submissions go through the server (validation, rate limits, purchase check).
create policy "feedback: staff read" on public.feedback for select using (public.is_staff());
create policy "feedback: staff moderate" on public.feedback for update using (public.is_staff()) with check (public.is_staff());
revoke insert, update, delete on public.feedback from anon, authenticated;
grant update (status, moderation, flag, response, responded_at, responded_by, reviewed_at, reviewed_by) on public.feedback to authenticated;
create policy "feedback_notes: staff" on public.feedback_notes for all using (public.is_staff()) with check (public.is_staff());
revoke all on public.feedback_notes from anon;

-- Public, moderated product reviews: only approved, consented, unflagged.
create or replace function public.public_product_reviews(p_product_id uuid, p_limit int default 20)
returns table (id uuid, rating smallint, comment text, display_name text, is_verified_purchase boolean,
               created_at timestamptz, response text, responded_at timestamptz)
language sql stable security definer set search_path = public as $$
  select f.id, f.rating, f.comment,
         case when f.display_name_pref = 'first_name' and nullif(trim(f.display_name), '') is not null then f.display_name else null end,
         f.is_verified_purchase, f.created_at, f.response, f.responded_at
    from public.feedback f
   where f.kind = 'product' and f.product_id = p_product_id
     and f.publish_consent and f.moderation = 'approved' and f.flag is null
   order by f.created_at desc
   limit least(greatest(p_limit, 1), 50);
$$;

create or replace function public.public_product_review_summary(p_product_id uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('count', count(*), 'average', round(avg(rating)::numeric, 1))
    from public.feedback f
   where f.kind = 'product' and f.product_id = p_product_id
     and f.publish_consent and f.moderation = 'approved' and f.flag is null;
$$;
grant execute on function public.public_product_reviews(uuid, int) to anon, authenticated;
grant execute on function public.public_product_review_summary(uuid) to anon, authenticated;

-- Has this account bought this product (verified, not cancelled/refunded)?
create or replace function public.verified_purchase_order(p_user_id uuid, p_product_id uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select o.id from public.orders o
    join public.order_items oi on oi.order_id = o.id
   where o.user_id = p_user_id and oi.product_id = p_product_id
     and o.payment_status = 'paid' and o.paid_at is not null
     and o.status not in ('cancelled', 'refunded')
   order by o.paid_at desc
   limit 1;
$$;
revoke execute on function public.verified_purchase_order(uuid, uuid) from public, anon, authenticated;
grant execute on function public.verified_purchase_order(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------
-- Reporting helpers
-- ---------------------------------------------------------------------
-- Converts an inclusive local-date range into a [from, to) UTC range.
create or replace function public.report_range(p_from date, p_to date, p_tz text, out ts_from timestamptz, out ts_to timestamptz)
language plpgsql stable set search_path = public as $$
begin
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'invalid_range' using errcode = '22023';
  end if;
  if p_to - p_from > 3660 then
    raise exception 'range_too_long' using errcode = '22023';
  end if;
  ts_from := p_from::timestamp at time zone p_tz;
  ts_to := (p_to + 1)::timestamp at time zone p_tz;
end;
$$;

-- Sales, payments, traffic and funnel for one period. Admin only.
--
-- Definitions (also shown in the dashboard):
--   * Orders are counted by the date they were placed.
--   * Sales are counted by the date payment was verified (paid_at).
--   * Gross sales  = item value (subtotal, before discounts) of every order with a verified payment.
--   * Net sales    = gross sales − discounts − item value of paid orders later refunded or cancelled.
--   * Total sales revenue = net sales + shipping + tax  (= order totals of qualifying paid orders).
--   * Qualifying paid order = verified payment, not refunded, not cancelled.
create or replace function public.admin_analytics_report(p_from date, p_to date, p_tz text default 'Africa/Lagos', p_bucket text default 'day')
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  r record;
  v_step interval;
  v jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_bucket not in ('day', 'week', 'month') then
    raise exception 'invalid_bucket' using errcode = '22023';
  end if;
  select * into r from public.report_range(p_from, p_to, p_tz);
  v_step := ('1 ' || p_bucket)::interval;

  with
  paid as (
    select o.*,
           (o.payment_status = 'paid' and o.status not in ('cancelled', 'refunded')) as qualifies,
           (o.status = 'refunded' or o.payment_status in ('refunded', 'partially_refunded')) as was_refunded,
           (o.status = 'cancelled' and o.payment_status = 'paid') as cancelled_after_payment
      from public.orders o
     where o.paid_at is not null and o.paid_at >= r.ts_from and o.paid_at < r.ts_to
  ),
  placed as (
    select * from public.orders o where o.created_at >= r.ts_from and o.created_at < r.ts_to
  ),
  ev as (
    select * from public.analytics_events e where e.created_at >= r.ts_from and e.created_at < r.ts_to
  ),
  buckets as (
    select b from generate_series(date_trunc(p_bucket, p_from::timestamp), date_trunc(p_bucket, p_to::timestamp), v_step) as b
  )
  select jsonb_build_object(
    'range', jsonb_build_object('from', p_from, 'to', p_to, 'timezone', p_tz, 'bucket', p_bucket),
    'orders', (select jsonb_build_object(
        'total', count(*),
        'awaiting_payment', count(*) filter (where status = 'pending_payment' and payment_status in ('unpaid', 'pending')),
        'failed_payment', count(*) filter (where payment_status = 'failed'),
        'cancelled_unpaid', count(*) filter (where status = 'cancelled' and paid_at is null)
      ) from placed),
    'sales', coalesce((select jsonb_agg(s order by s.currency) from (
        select currency,
               count(*) as paid_orders,
               count(*) filter (where qualifies) as qualifying_orders,
               coalesce(sum(subtotal), 0) as gross_sales,
               coalesce(sum(discount_total), 0) as discounts,
               coalesce(sum(subtotal - discount_total) filter (where was_refunded), 0) as refunds,
               coalesce(sum(subtotal - discount_total) filter (where cancelled_after_payment), 0) as cancellations,
               coalesce(sum(subtotal - discount_total) filter (where qualifies), 0) as net_sales,
               coalesce(sum(shipping_fee) filter (where qualifies), 0) as shipping,
               coalesce(sum(tax_total) filter (where qualifies), 0) as tax,
               coalesce(sum(total) filter (where qualifies), 0) as revenue,
               coalesce(sum(total) filter (where was_refunded), 0) as refunded_to_customers,
               count(*) filter (where was_refunded) as refunded_orders,
               count(*) filter (where cancelled_after_payment) as cancelled_paid_orders,
               case when count(*) filter (where qualifies) > 0
                    then round(sum(total) filter (where qualifies)::numeric / count(*) filter (where qualifies))::int
                    else 0 end as average_order_value
          from paid group by currency) s), '[]'::jsonb),
    'payments', (select jsonb_build_object(
        'attempts', count(*),
        'successful', count(*) filter (where status = 'success' and coalesce(failure_reason, '') <> 'duplicate_payment_refund_required'),
        'duplicate', count(*) filter (where status = 'success' and failure_reason = 'duplicate_payment_refund_required'),
        'pending', count(*) filter (where status = 'initialized'),
        'failed', count(*) filter (where status = 'failed'),
        'abandoned', count(*) filter (where status = 'abandoned')
      ) from public.payments p where p.created_at >= r.ts_from and p.created_at < r.ts_to),
    'refunds_in_period', (select count(*) from public.orders o where o.refunded_at >= r.ts_from and o.refunded_at < r.ts_to),
    'cancellations_in_period', (select count(*) from public.orders o where o.cancelled_at >= r.ts_from and o.cancelled_at < r.ts_to),
    'pending_deliveries', (select count(*) from public.orders o
        where o.payment_status = 'paid' and o.status in ('paid', 'processing', 'awaiting_supplier', 'ordered_from_supplier', 'shipped', 'in_transit')),
    'series', (select coalesce(jsonb_agg(x order by x.bucket), '[]'::jsonb) from (
        select to_char(b.b, 'YYYY-MM-DD') as bucket,
               coalesce(po.n, 0) as orders,
               coalesce(pa.n, 0) as paid_orders,
               coalesce(rv.revenue, '{}'::jsonb) as revenue,
               coalesce(tv.visitors, 0) as visitors,
               coalesce(tv.page_views, 0) as page_views
          from buckets b
          left join (select date_trunc(p_bucket, o.created_at at time zone p_tz) as k, count(*) as n
                       from placed o group by 1) po on po.k = b.b
          left join (select date_trunc(p_bucket, o.paid_at at time zone p_tz) as k, count(*) as n
                       from paid o where o.qualifies group by 1) pa on pa.k = b.b
          left join (select t.k, jsonb_object_agg(t.currency, t.total) as revenue from (
                       select date_trunc(p_bucket, o.paid_at at time zone p_tz) as k, o.currency, sum(o.total) as total
                         from paid o where o.qualifies group by 1, 2) t group by t.k) rv on rv.k = b.b
          left join (select date_trunc(p_bucket, e.created_at at time zone p_tz) as k,
                            count(distinct e.visitor_id) as visitors,
                            count(*) filter (where e.event_type = 'page_view') as page_views
                       from ev e group by 1) tv on tv.k = b.b) x),
    'traffic', (select jsonb_build_object(
        'visitors', count(distinct visitor_id),
        'visits', count(distinct session_id),
        'page_views', count(*) filter (where event_type = 'page_view'),
        'product_views', count(*) filter (where event_type = 'product_view')
      ) from ev),
    'funnel', (select jsonb_build_object(
        'visited', count(distinct visitor_id),
        'viewed_product', count(distinct visitor_id) filter (where event_type = 'product_view'),
        'added_to_cart', count(distinct visitor_id) filter (where event_type = 'add_to_cart'),
        'started_checkout', count(distinct visitor_id) filter (where event_type = 'checkout_start'),
        'purchased', count(distinct visitor_id) filter (where event_type = 'purchase')
      ) from ev),
    'top_pages', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select path, count(*) as views, count(distinct visitor_id) as visitors from ev
         where event_type = 'page_view' and path is not null group by path order by views desc, path limit 10) t),
    'top_viewed_products', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select e.product_id, p.name, count(*) as views, count(distinct e.visitor_id) as visitors
          from ev e join public.products p on p.id = e.product_id
         where e.event_type = 'product_view' group by e.product_id, p.name order by views desc, p.name limit 10) t),
    'referrers', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select referrer_host as host, count(distinct visitor_id) as visitors, count(distinct session_id) as visits from ev
         where referrer_host is not null group by referrer_host order by visits desc, host limit 10) t),
    'sources', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select source, count(distinct visitor_id) as visitors, count(distinct session_id) as visits from ev
         where event_type = 'page_view' and source is not null group by 1 order by visits desc, source) t),
    'devices', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select coalesce(device, 'unknown') as device, count(distinct visitor_id) as visitors from ev
         where event_type = 'page_view' group by 1 order by visitors desc, device) t),
    'countries', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select coalesce(country, '??') as country, count(distinct visitor_id) as visitors from ev
         where event_type = 'page_view' group by 1 order by visitors desc, country limit 10) t),
    'best_sellers', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select oi.product_id, max(oi.product_name) as name, o.currency,
               sum(oi.quantity) as units, sum(oi.line_total) as revenue, count(distinct o.id) as orders
          from paid o join public.order_items oi on oi.order_id = o.id
         where o.qualifies
         group by oi.product_id, coalesce(oi.product_id::text, oi.product_name), o.currency
         order by units desc, revenue desc limit 10) t),
    'categories', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select coalesce(parent.name, c.name, 'Uncategorised') as category, o.currency,
               sum(oi.quantity) as units, sum(oi.line_total) as revenue, count(distinct o.id) as orders
          from paid o
          join public.order_items oi on oi.order_id = o.id
          left join public.products p on p.id = oi.product_id
          left join public.categories c on c.id = p.category_id
          left join public.categories parent on parent.id = c.parent_id
         where o.qualifies
         group by 1, o.currency order by revenue desc) t)
  ) into v;
  return v;
end;
$$;
revoke execute on function public.admin_analytics_report(date, date, text, text) from public, anon;
grant execute on function public.admin_analytics_report(date, date, text, text) to authenticated;

-- Feedback summary for one period. Staff (admin + staff) only.
create or replace function public.admin_feedback_report(p_from date, p_to date, p_tz text default 'Africa/Lagos', p_bucket text default 'day')
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  r record;
  v jsonb;
begin
  if not public.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_bucket not in ('day', 'week', 'month') then
    raise exception 'invalid_bucket' using errcode = '22023';
  end if;
  select * into r from public.report_range(p_from, p_to, p_tz);

  with fb as (
    select * from public.feedback f where f.created_at >= r.ts_from and f.created_at < r.ts_to
  ),
  buckets as (
    select b from generate_series(date_trunc(p_bucket, p_from::timestamp), date_trunc(p_bucket, p_to::timestamp), ('1 ' || p_bucket)::interval) as b
  )
  select jsonb_build_object(
    'total', (select count(*) from fb),
    'average', (select round(avg(rating)::numeric, 2) from fb),
    'positive', (select count(*) from fb where sentiment = 'positive'),
    'neutral', (select count(*) from fb where sentiment = 'neutral'),
    'negative', (select count(*) from fb where sentiment = 'negative'),
    'unreviewed', (select count(*) from fb where status = 'new'),
    'flagged', (select count(*) from fb where flag is not null),
    'distribution', (select jsonb_agg(jsonb_build_object('rating', n, 'count', (select count(*) from fb where rating = n)) order by n)
                       from generate_series(1, 5) n),
    'series', (select coalesce(jsonb_agg(x order by x.bucket), '[]'::jsonb) from (
        select to_char(b.b, 'YYYY-MM-DD') as bucket,
               count(f.id) as total,
               count(f.id) filter (where f.sentiment = 'positive') as positive,
               count(f.id) filter (where f.sentiment = 'neutral') as neutral,
               count(f.id) filter (where f.sentiment = 'negative') as negative,
               round(avg(f.rating)::numeric, 2) as average
          from buckets b left join fb f on date_trunc(p_bucket, f.created_at at time zone p_tz) = b.b
         group by b.b) x),
    'complaints', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select coalesce(reason, 'unspecified') as reason, count(*) as count, round(avg(rating)::numeric, 2) as average
          from fb where sentiment = 'negative' or rating <= 2
         group by 1 order by count desc, reason) t),
    'suggestions', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select id, suggestion, rating, created_at from fb
         where nullif(trim(suggestion), '') is not null and flag is null
         order by created_at desc limit 8) t)
  ) into v;
  return v;
end;
$$;
revoke execute on function public.admin_feedback_report(date, date, text, text) from public, anon;
grant execute on function public.admin_feedback_report(date, date, text, text) to authenticated;

-- Customers: registered accounts and guest checkouts, keyed by email. Staff only.
create or replace function public.admin_customers(p_query text default null, p_limit int default 50, p_offset int default 0)
returns table (email text, full_name text, phone text, user_id uuid, registered_at timestamptz,
               orders bigint, paid_orders bigint, total_spent bigint, currency text, last_order_at timestamptz, total_count bigint)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not public.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  with o as (
    select lower(x.email) as key, max(x.customer_name) as name, max(x.phone) as phone, max(x.user_id::text)::uuid as user_id,
           count(*) as orders,
           count(*) filter (where x.payment_status = 'paid' and x.status not in ('cancelled', 'refunded')) as paid_orders,
           coalesce(sum(x.total) filter (where x.payment_status = 'paid' and x.status not in ('cancelled', 'refunded')), 0)::bigint as spent,
           max(x.currency) as currency, max(x.created_at) as last_order_at
      from public.orders x group by lower(x.email)
  ),
  merged as (
    select coalesce(lower(p.email), o.key) as email, coalesce(p.full_name, o.name) as full_name,
           coalesce(p.phone, o.phone) as phone, coalesce(p.id, o.user_id) as user_id, p.created_at as registered_at,
           coalesce(o.orders, 0)::bigint as orders, coalesce(o.paid_orders, 0)::bigint as paid_orders,
           coalesce(o.spent, 0)::bigint as total_spent, coalesce(o.currency, 'NGN')::text as currency, o.last_order_at
      from public.profiles p full outer join o on o.key = lower(p.email)
  ),
  filtered as (
    select * from merged m
     where m.email is not null
       and (p_query is null or p_query = '' or m.email ilike '%' || p_query || '%' or m.full_name ilike '%' || p_query || '%')
  )
  select f.*, count(*) over () as total_count from filtered f
   order by f.last_order_at desc nulls last, f.registered_at desc nulls last
   limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0);
end;
$$;
revoke execute on function public.admin_customers(text, int, int) from public, anon;
grant execute on function public.admin_customers(text, int, int) to authenticated;
