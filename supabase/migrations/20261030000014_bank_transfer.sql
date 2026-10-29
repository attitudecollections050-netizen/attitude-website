-- =====================================================================
-- Manual bank transfer payments.
--
-- * The customer pays into the store's bank account, then submits the
--   transfer details (name, amount, reference, WhatsApp, optional receipt
--   screenshot). Each submission is a payment_claims row: pending until the
--   owner checks the bank app and confirms or declines it.
-- * Confirming runs the same finalize_payment() as card payments: the order
--   becomes Paid, stock is committed and fulfilment starts. The amount
--   recorded is always the order total from the database.
-- * Only the owner can see or review claims. Customers submit through the
--   server (which checks the order's private access token), never directly.
-- =====================================================================

alter table public.orders
  add column payment_method text not null default 'paystack' check (payment_method in ('paystack', 'bank_transfer'));

create table public.payment_claims (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  payment_id uuid not null references public.payments (id) on delete cascade,
  customer_name text not null check (char_length(customer_name) between 2 and 120),
  amount_paid int not null check (amount_paid > 0),
  transfer_reference text not null check (char_length(transfer_reference) between 4 and 64),
  whatsapp text not null check (char_length(whatsapp) between 7 and 32),
  proof_path text,
  status text not null default 'pending' check (status in ('pending', 'verified', 'declined')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 500),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index payment_claims_order_idx on public.payment_claims (order_id);
create index payment_claims_status_idx on public.payment_claims (status, created_at desc);
-- One bank reference can only back one live claim (stops the same receipt being reused).
create unique index payment_claims_reference_live_idx
  on public.payment_claims (upper(regexp_replace(transfer_reference, '\s', '', 'g')))
  where status <> 'declined';

alter table public.payment_claims enable row level security;
create policy "payment_claims: owner read" on public.payment_claims for select using (public.is_admin());

-- Owner confirms or declines a claim.
create or replace function public.admin_review_payment_claim(p_claim_id uuid, p_decision text, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_claim public.payment_claims;
  v_payment public.payments;
  v_order public.orders;
  v_result jsonb := '{}'::jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_decision not in ('verified', 'declined') then
    raise exception 'invalid_decision' using errcode = 'P0001';
  end if;
  select * into v_claim from public.payment_claims where id = p_claim_id for update;
  if not found then
    raise exception 'claim_not_found' using errcode = 'P0001';
  end if;
  if v_claim.status <> 'pending' then
    raise exception 'already_reviewed' using errcode = 'P0001';
  end if;
  select * into v_payment from public.payments where id = v_claim.payment_id;
  select * into v_order from public.orders where id = v_claim.order_id;

  if p_decision = 'verified' then
    v_result := public.finalize_payment(
      v_payment.reference, v_order.total, v_order.currency, v_claim.transfer_reference, 'bank_transfer', now(),
      jsonb_build_object('claim_id', v_claim.id, 'amount_paid', v_claim.amount_paid, 'reviewed_by', auth.uid())
    );
    if not coalesce((v_result ->> 'ok')::boolean, false) then
      raise exception 'finalize_failed: %', v_result ->> 'code' using errcode = 'P0001';
    end if;
  else
    -- Back to "not paid" (unless another submission is still waiting) so the customer can try again.
    if not exists (select 1 from public.payment_claims where order_id = v_order.id and status = 'pending' and id <> v_claim.id) then
      update public.orders set payment_status = 'unpaid' where id = v_order.id and payment_status = 'pending';
    end if;
    insert into public.order_status_history (order_id, status, public_note)
    values (v_order.id, v_order.status, 'We couldn''t confirm your bank transfer yet. Please check the reference and submit it again.');
  end if;

  update public.payment_claims
     set status = p_decision, admin_note = nullif(trim(coalesce(p_note, '')), ''), reviewed_by = auth.uid(), reviewed_at = now()
   where id = v_claim.id;

  return v_result || jsonb_build_object('ok', true, 'decision', p_decision, 'order_id', v_order.id, 'order_number', v_order.order_number);
end;
$$;
revoke execute on function public.admin_review_payment_claim(uuid, text, text) from public, anon;
grant execute on function public.admin_review_payment_claim(uuid, text, text) to authenticated;

-- Receipt screenshots: private bucket, server access only (no policies = no API access).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Bank details shown at checkout (public by design: customers need them to pay).
insert into public.store_settings (key, value, is_public)
values ('bank_transfer', '{"enabled": true, "bank_name": "First Bank", "account_name": "OKONYE JUSTICE JESSICA NKEM", "account_number": "3043027979", "note": ""}', true)
on conflict (key) do nothing;
