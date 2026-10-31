-- =====================================================================
-- LIVE: show the exact design (photo) each customer picked on orders.
-- Paste ALL of this into Supabase → SQL Editor and click Run (safe to run twice).
-- = migration 20261031000020_exact_design_images.sql
-- =====================================================================

-- =====================================================================
-- The exact design (photo) a customer picked, from bag to order.
--
-- Many products are sold in several designs that are only told apart by
-- their photos (variants differ only by size). The photo the shopper was
-- looking at when they tapped "Add to bag" is now saved on the bag line and
-- copied to the order item, so the team packs exactly that design.
--
-- * cart_items.selected_image_url / selected_design: the picked photo and a
--   label for it ("Photo 3 of 12" or the photo's description). Two designs
--   in the same size are now separate bag lines.
-- * order_items.selected_image / selected_variant_name: the same, on the
--   order. NULL means it wasn't recorded (older orders): the team can set it
--   from the order page after checking with the customer.
-- =====================================================================

alter table public.cart_items
  add column if not exists selected_image_url text check (selected_image_url is null or char_length(selected_image_url) <= 2000),
  add column if not exists selected_design text check (selected_design is null or char_length(selected_design) <= 200);

-- One bag line per size AND design (it used to be one line per size).
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.cart_items'::regclass and contype = 'u'
      and pg_get_constraintdef(oid) ilike 'UNIQUE (cart_id, variant_id)'
  loop
    execute format('alter table public.cart_items drop constraint %I', c.conname);
  end loop;
end;
$$;
create unique index if not exists cart_items_line_unique on public.cart_items (cart_id, variant_id, coalesce(selected_image_url, ''));

alter table public.order_items
  add column if not exists selected_image text check (selected_image is null or char_length(selected_image) <= 2000),
  add column if not exists selected_variant_name text check (selected_variant_name is null or char_length(selected_variant_name) <= 200),
  add column if not exists selected_set_by uuid references auth.users (id) on delete set null,
  add column if not exists selected_set_at timestamptz;

-- Record the migration as applied (keeps the Supabase migration list in step).
do $$
begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    insert into supabase_migrations.schema_migrations (version, name)
    values ('20261031000020', 'exact_design_images')
    on conflict (version) do nothing;
  end if;
end;
$$;
