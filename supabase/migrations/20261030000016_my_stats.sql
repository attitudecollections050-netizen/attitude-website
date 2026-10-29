-- =====================================================================
-- get_my_stats(): the signed-in person's own product count and earnings
-- (₦1,000 for every 10 products they added; archived products don't count).
-- Also removes a checkout insert policy that let any signed-in user write
-- orders directly (orders are only created by the server's create_order()).
-- =====================================================================

create or replace function public.get_my_stats()
returns table (product_count bigint, earnings integer, remaining integer)
language plpgsql stable security definer set search_path = public as $$
begin
  return query
    select count(*)::bigint,
           (count(*) / 10 * 1000)::int,
           (10 - count(*) % 10)::int
    from public.products
    where added_by = auth.uid() and auth.uid() is not null and status <> 'archived';
end;
$$;
revoke execute on function public.get_my_stats() from public, anon;
grant execute on function public.get_my_stats() to authenticated;

drop policy if exists "allow_checkout_insert" on public.orders;
