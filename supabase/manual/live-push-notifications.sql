-- =====================================================================
-- Web Push: notifications on the owner's (and staff's) phone or laptop
-- even when the site is closed.
--
-- * push_subscriptions: one row per device that tapped "Enable Push
--   Notifications" (the browser's endpoint + keys). People manage only
--   their own; the server reads them with the service role to send.
-- * staff_notifications.pushed_at: set when a notification has been sent as
--   a push, so each one is pushed once (claimed atomically by the sender).
-- =====================================================================

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 2000),
  subscription jsonb not null,
  user_agent text check (user_agent is null or char_length(user_agent) <= 400),
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
drop policy if exists "push_subscriptions: own read" on public.push_subscriptions;
create policy "push_subscriptions: own read" on public.push_subscriptions for select using (user_id = auth.uid());
drop policy if exists "push_subscriptions: own insert" on public.push_subscriptions;
create policy "push_subscriptions: own insert" on public.push_subscriptions for insert with check (user_id = auth.uid());
drop policy if exists "push_subscriptions: own update" on public.push_subscriptions;
create policy "push_subscriptions: own update" on public.push_subscriptions for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "push_subscriptions: own delete" on public.push_subscriptions;
create policy "push_subscriptions: own delete" on public.push_subscriptions for delete using (user_id = auth.uid());

alter table public.staff_notifications add column if not exists pushed_at timestamptz;
create index if not exists staff_notifications_unpushed_idx on public.staff_notifications (created_at) where pushed_at is null;
