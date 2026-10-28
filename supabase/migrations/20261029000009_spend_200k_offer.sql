-- Store offer: 10% off + free delivery on orders of ₦200,000 or more (item total, before discounts).
-- The percentage lives in a real discount code so create_order re-validates it and usage is counted;
-- the "promotion" setting makes the storefront apply it automatically and waive delivery.
-- Edit or switch off in Admin → Discounts → Automatic offer.
insert into public.discounts (code, description, type, value, min_subtotal, is_active)
values ('SPEND200K', 'Automatic offer: 10% off orders of ₦200,000+ (with free delivery)', 'percentage', 10, 20000000, true)
on conflict (code) do nothing;

insert into public.store_settings (key, value, is_public)
values ('promotion', '{"enabled": true, "code": "SPEND200K", "min_subtotal": 20000000, "free_delivery": true, "label": "10% off + free delivery (orders ₦200,000+)"}'::jsonb, true)
on conflict (key) do nothing;

insert into public.store_settings (key, value, is_public)
values ('announcement', '{"enabled": true, "text": "10% OFF ORDERS OF ₦200,000+ | FREE DELIVERY ON ORDERS OF ₦200,000+", "href": "/shop"}'::jsonb, true)
on conflict (key) do update set value = excluded.value;
