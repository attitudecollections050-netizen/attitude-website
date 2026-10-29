-- New role for staff who manage products only (see migration 12 for its rules).
-- Kept in its own migration: Postgres must commit a new enum value before it can be used.
alter type public.app_role add value if not exists 'product_staff';
