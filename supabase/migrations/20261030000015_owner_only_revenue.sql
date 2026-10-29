-- =====================================================================
-- Sales revenue is for the store owner only.
--
-- is_store_owner(): the signed-in person has the owner (admin) role AND is
-- the store's owner address. admin_dashboard_stats() now leaves revenue
-- out (null) for everyone else, so staff can't read it even by calling the
-- function directly.
-- =====================================================================

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
