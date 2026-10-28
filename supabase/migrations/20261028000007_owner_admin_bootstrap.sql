-- Grant the store owner admin automatically once their email address is CONFIRMED.
-- Confirmation proves inbox ownership, so registering with this address is not enough.
create or replace function public.bootstrap_owner_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if lower(new.email) = 'attitudecollections050@gmail.com' and new.email_confirmed_at is not null then
    insert into public.user_roles (user_id, role) values (new.id, 'admin') on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke execute on function public.bootstrap_owner_admin() from public, anon, authenticated;

create trigger on_auth_user_owner_admin
  after insert or update of email_confirmed_at on auth.users
  for each row execute function public.bootstrap_owner_admin();
