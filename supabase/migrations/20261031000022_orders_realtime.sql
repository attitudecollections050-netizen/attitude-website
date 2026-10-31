-- Live order alerts in the admin: broadcast new orders over Supabase Realtime.
-- Realtime follows the orders read policy, so only the owner/order staff (and each
-- customer for their own order) receive them. Product Staff never do.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders') then
    alter publication supabase_realtime add table public.orders;
  end if;
end;
$$;
