-- =====================================================================
-- Web Push: notifications on the owner's (and staff's) phone or laptop
-- even when the site is closed — with device control.
--
-- * push_subscriptions: one row per device that tapped "Enable Push
--   Notifications" (the browser's endpoint + keys, a readable device name).
--   People see and revoke only their own devices ("My Devices Receiving
--   Push"); the server reads them with the service role to send.
-- * At most 3 devices per person (enforced here, not just in the app).
-- * last_active_at: the last time that device was used on the site while
--   signed in. Devices not active for 30 days get no pushes and are removed.
-- * Logging out removes the push for that device; "Log out of all devices"
--   removes them all.
-- * staff_notifications.pushed_at: set when a notification has been pushed,
--   so each one is pushed once (claimed atomically by the sender).
-- =====================================================================

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 2000),
  subscription_json jsonb not null,
  device_name text not null default 'Unknown device' check (char_length(device_name) between 1 and 80),
  browser text check (browser is null or char_length(browser) <= 40),
  user_agent text check (user_agent is null or char_length(user_agent) <= 400),
  created_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
drop policy if exists "push_subscriptions: own read" on public.push_subscriptions;
create policy "push_subscriptions: own read" on public.push_subscriptions for select using (user_id = auth.uid());
drop policy if exists "push_subscriptions: own insert" on public.push_subscriptions;
create policy "push_subscriptions: own insert" on public.push_subscriptions for insert with check (user_id = auth.uid());
drop policy if exists "push_subscriptions: own delete" on public.push_subscriptions;
create policy "push_subscriptions: own delete" on public.push_subscriptions for delete using (user_id = auth.uid());
-- No update policy: activity is recorded by the server.

-- Max 3 devices per person.
create or replace function public.push_device_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext('push:' || new.user_id::text));
  if (select count(*) from public.push_subscriptions where user_id = new.user_id) >= 3 then
    raise exception 'too_many_devices' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists push_device_limit on public.push_subscriptions;
create trigger push_device_limit before insert on public.push_subscriptions for each row execute function public.push_device_limit();

alter table public.staff_notifications add column if not exists pushed_at timestamptz;
create index if not exists staff_notifications_unpushed_idx on public.staff_notifications (created_at) where pushed_at is null;
