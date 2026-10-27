-- =====================================================================
-- DEMO CATALOGUE — sample products for development and previews only.
-- Names, prices, stock and imagery are placeholders (images are remote
-- Unsplash URLs). Replace with your real supplier products before launch.
-- Remove everything in one go with:
--   delete from public.products where 'demo' = any(tags);
-- =====================================================================

with p as (
  insert into public.products (slug, name, description, details, category_id, price, sale_price, weight_grams, status, is_featured, tags)
  select 'essential-heavyweight-tee', 'Essential Heavyweight Tee', 'A structured heavyweight cotton tee with a relaxed fit and clean neckline. The foundation of every confident wardrobe.', E'Composition and care: [confirm with supplier].\nSizing: [add size guide].', c.id, 1850000, NULL, 300, 'published', false, array['cotton', 'basics', 'demo']
  from public.categories c join public.categories parent on parent.id = c.parent_id
  where parent.slug = 'men' and c.slug = 't-shirts'
  returning id
)
, imgs as (insert into public.product_images (product_id, url, alt, sort_order) select p.id, x.url, x.alt, x.s from p, (values ('https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=80', 'Essential Heavyweight Tee — view 1', 0), ('https://images.unsplash.com/photo-1503341504253-dff4815485f1?auto=format&fit=crop&w=1200&q=80', 'Essential Heavyweight Tee — view 2', 1)) as x(url, alt, s))
, v as (insert into public.product_variants (product_id, sku, size, color, color_hex, sort_order) select p.id, x.sku, x.size, x.color, x.hex, x.s from p, (values ('ESSENTIALHEAVYWEI-BLA-S', 'S', 'Black', '#1C1A1B', 0, 3), ('ESSENTIALHEAVYWEI-BLA-M', 'M', 'Black', '#1C1A1B', 1, 3), ('ESSENTIALHEAVYWEI-BLA-L', 'L', 'Black', '#1C1A1B', 2, 3), ('ESSENTIALHEAVYWEI-BLA-XL', 'XL', 'Black', '#1C1A1B', 3, 1), ('ESSENTIALHEAVYWEI-BLA-XXL', 'XXL', 'Black', '#1C1A1B', 4, 0), ('ESSENTIALHEAVYWEI-WHI-S', 'S', 'White', '#F7F5F2', 5, 7), ('ESSENTIALHEAVYWEI-WHI-M', 'M', 'White', '#F7F5F2', 6, 5), ('ESSENTIALHEAVYWEI-WHI-L', 'L', 'White', '#F7F5F2', 7, 0), ('ESSENTIALHEAVYWEI-WHI-XL', 'XL', 'White', '#F7F5F2', 8, 4), ('ESSENTIALHEAVYWEI-WHI-XXL', 'XXL', 'White', '#F7F5F2', 9, 4), ('ESSENTIALHEAVYWEI-GRE-S', 'S', 'Grey', '#8E8C8F', 10, 0), ('ESSENTIALHEAVYWEI-GRE-M', 'M', 'Grey', '#8E8C8F', 11, 2), ('ESSENTIALHEAVYWEI-GRE-L', 'L', 'Grey', '#8E8C8F', 12, 5), ('ESSENTIALHEAVYWEI-GRE-XL', 'XL', 'Grey', '#8E8C8F', 13, 1), ('ESSENTIALHEAVYWEI-GRE-XXL', 'XXL', 'Grey', '#8E8C8F', 14, 7)) as x(sku, size, color, hex, s, stock) returning id, sku)
insert into public.inventory (variant_id, on_hand) select v.id, x.stock from v join (values ('ESSENTIALHEAVYWEI-BLA-S', 3), ('ESSENTIALHEAVYWEI-BLA-M', 3), ('ESSENTIALHEAVYWEI-BLA-L', 3), ('ESSENTIALHEAVYWEI-BLA-XL', 1), ('ESSENTIALHEAVYWEI-BLA-XXL', 0), ('ESSENTIALHEAVYWEI-WHI-S', 7), ('ESSENTIALHEAVYWEI-WHI-M', 5), ('ESSENTIALHEAVYWEI-WHI-L', 0), ('ESSENTIALHEAVYWEI-WHI-XL', 4), ('ESSENTIALHEAVYWEI-WHI-XXL', 4), ('ESSENTIALHEAVYWEI-GRE-S', 0), ('ESSENTIALHEAVYWEI-GRE-M', 2), ('ESSENTIALHEAVYWEI-GRE-L', 5), ('ESSENTIALHEAVYWEI-GRE-XL', 1), ('ESSENTIALHEAVYWEI-GRE-XXL', 7)) as x(sku, stock) on x.sku = v.sku;

with p as (
  insert into public.products (slug, name, description, details, category_id, price, sale_price, weight_grams, status, is_featured, tags)
  select 'attitude-logo-tee', 'Attitude Signature Tee', 'Soft-touch cotton tee finished with a tonal signature print.', E'Composition and care: [confirm with supplier].\nSizing: [add size guide].', c.id, 2100000, 1650000, 300, 'published', true, array['print', 'cotton', 'demo']
  from public.categories c join public.categories parent on parent.id = c.parent_id
  where parent.slug = 'men' and c.slug = 't-shirts'
  returning id
)
, imgs as (insert into public.product_images (product_id, url, alt, sort_order) select p.id, x.url, x.alt, x.s from p, (values ('https://images.unsplash.com/photo-1503341504253-dff4815485f1?auto=format&fit=crop&w=1200&q=80', 'Attitude Signature Tee — view 1', 0), ('https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=80', 'Attitude Signature Tee — view 2', 1)) as x(url, alt, s))
, v as (insert into public.product_variants (product_id, sku, size, color, color_hex, sort_order) select p.id, x.sku, x.size, x.color, x.hex, x.s from p, (values ('ATTITUDELOGOTEE-BLA-S', 'S', 'Black', '#1C1A1B', 0, 3), ('ATTITUDELOGOTEE-BLA-M', 'M', 'Black', '#1C1A1B', 1, 1), ('ATTITUDELOGOTEE-BLA-L', 'L', 'Black', '#1C1A1B', 2, 1), ('ATTITUDELOGOTEE-BLA-XL', 'XL', 'Black', '#1C1A1B', 3, 8), ('ATTITUDELOGOTEE-BLA-XXL', 'XXL', 'Black', '#1C1A1B', 4, 4), ('ATTITUDELOGOTEE-ROS-S', 'S', 'Rose', '#D94F91', 5, 3), ('ATTITUDELOGOTEE-ROS-M', 'M', 'Rose', '#D94F91', 6, 3), ('ATTITUDELOGOTEE-ROS-L', 'L', 'Rose', '#D94F91', 7, 4), ('ATTITUDELOGOTEE-ROS-XL', 'XL', 'Rose', '#D94F91', 8, 7), ('ATTITUDELOGOTEE-ROS-XXL', 'XXL', 'Rose', '#D94F91', 9, 7)) as x(sku, size, color, hex, s, stock) returning id, sku)
insert into public.inventory (variant_id, on_hand) select v.id, x.stock from v join (values ('ATTITUDELOGOTEE-BLA-S', 3), ('ATTITUDELOGOTEE-BLA-M', 1), ('ATTITUDELOGOTEE-BLA-L', 1), ('ATTITUDELOGOTEE-BLA-XL', 8), ('ATTITUDELOGOTEE-BLA-XXL', 4), ('ATTITUDELOGOTEE-ROS-S', 3), ('ATTITUDELOGOTEE-ROS-M', 3), ('ATTITUDELOGOTEE-ROS-L', 4), ('ATTITUDELOGOTEE-ROS-XL', 7), ('ATTITUDELOGOTEE-ROS-XXL', 7)) as x(sku, stock) on x.sku = v.sku;

with p as (
  insert into public.products (slug, name, description, details, category_id, price, sale_price, weight_grams, status, is_featured, tags)
  select 'linen-resort-shirt', 'Linen Resort Shirt', 'Breathable linen-blend shirt with a camp collar — made for warm evenings.', E'Composition and care: [confirm with supplier].\nSizing: [add size guide].', c.id, 3200000, NULL, 350, 'published', true, array['linen', 'summer', 'demo']
  from public.categories c join public.categories parent on parent.id = c.parent_id
  where parent.slug = 'men' and c.slug = 'shirts'
  returning id
)
, imgs as (insert into public.product_images (product_id, url, alt, sort_order) select p.id, x.url, x.alt, x.s from p, (values ('https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=1200&q=80', 'Linen Resort Shirt — view 1', 0), ('https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=1200&q=80', 'Linen Resort Shirt — view 2', 1)) as x(url, alt, s))
, v as (insert into public.product_variants (product_id, sku, size, color, color_hex, sort_order) select p.id, x.sku, x.size, x.color, x.hex, x.s from p, (values ('LINENRESORTSHIRT-CRE-S', 'S', 'Cream', '#EFE6D8', 0, 7), ('LINENRESORTSHIRT-CRE-M', 'M', 'Cream', '#EFE6D8', 1, 6), ('LINENRESORTSHIRT-CRE-L', 'L', 'Cream', '#EFE6D8', 2, 1), ('LINENRESORTSHIRT-CRE-XL', 'XL', 'Cream', '#EFE6D8', 3, 3), ('LINENRESORTSHIRT-CRE-XXL', 'XXL', 'Cream', '#EFE6D8', 4, 2), ('LINENRESORTSHIRT-NAV-S', 'S', 'Navy', '#1F2A44', 5, 0), ('LINENRESORTSHIRT-NAV-M', 'M', 'Navy', '#1F2A44', 6, 1), ('LINENRESORTSHIRT-NAV-L', 'L', 'Navy', '#1F2A44', 7, 6), ('LINENRESORTSHIRT-NAV-XL', 'XL', 'Navy', '#1F2A44', 8, 3), ('LINENRESORTSHIRT-NAV-XXL', 'XXL', 'Navy', '#1F2A44', 9, 7)) as x(sku, size, color, hex, s, stock) returning id, sku)
insert into public.inventory (variant_id, on_hand) select v.id, x.stock from v join (values ('LINENRESORTSHIRT-CRE-S', 7), ('LINENRESORTSHIRT-CRE-M', 6), ('LINENRESORTSHIRT-CRE-L', 1), ('LINENRESORTSHIRT-CRE-XL', 3), ('LINENRESORTSHIRT-CRE-XXL', 2), ('LINENRESORTSHIRT-NAV-S', 0), ('LINENRESORTSHIRT-NAV-M', 1), ('LINENRESORTSHIRT-NAV-L', 6), ('LINENRESORTSHIRT-NAV-XL', 3), ('LINENRESORTSHIRT-NAV-XXL', 7)) as x(sku, stock) on x.sku = v.sku;

with p as (
  insert into public.products (slug, name, description, details, category_id, price, sale_price, weight_grams, status, is_featured, tags)
  select 'oxford-button-down', 'Oxford Button-Down', 'A crisp oxford-cotton shirt that moves from office to evening.', E'Composition and care: [confirm with supplier].\nSizing: [add size guide].', c.id, 2850000, NULL, 350, 'published', false, array['cotton', 'smart', 'demo']
  from public.categories c join public.categories parent on parent.id = c.parent_id
  where parent.slug = 'men' and c.slug = 'shirts'
  returning id
)
, imgs as (insert into public.product_images (product_id, url, alt, sort_order) select p.id, x.url, x.alt, x.s from p, (values ('https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=1200&q=80', 'Oxford Button-Down — view 1', 0), ('https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=1200&q=80', 'Oxford Button-Down — view 2', 1)) as x(url, alt, s))
, v as (insert into public.product_variants (product_id, sku, size, color, color_hex, sort_order) select p.id, x.sku, x.size, x.color, x.hex, x.s from p, (values ('OXFORDBUTTONDOWN-WHI-S', 'S', 'White', '#F7F5F2', 0, 7), ('OXFORDBUTTONDOWN-WHI-M', 'M', 'White', '#F7F5F2', 1, 4), ('OXFORDBUTTONDOWN-WHI-L', 'L', 'White', '#F7F5F2', 2, 0), ('OXFORDBUTTONDOWN-WHI-XL', 'XL', 'White', '#F7F5F2', 3, 1), ('OXFORDBUTTONDOWN-WHI-XXL', 'XXL', 'White', '#F7F5F2', 4, 7), ('OXFORDBUTTONDOWN-SKY-S', 'S', 'Sky', '#A9C4E4', 5, 4), ('OXFORDBUTTONDOWN-SKY-M', 'M', 'Sky', '#A9C4E4', 6, 4), ('OXFORDBUTTONDOWN-SKY-L', 'L', 'Sky', '#A9C4E4', 7, 1), ('OXFORDBUTTONDOWN-SKY-XL', 'XL', 'Sky', '#A9C4E4', 8, 0), ('OXFORDBUTTONDOWN-SKY-XXL', 'XXL', 'Sky', '#A9C4E4', 9, 3)) as x(sku, size, color, hex, s, stock) returning id, sku)
insert into public.inventory (variant_id, on_hand) select v.id, x.stock from v join (values ('OXFORDBUTTONDOWN-WHI-S', 7), ('OXFORDBUTTONDOWN-WHI-M', 4), ('OXFORDBUTTONDOWN-WHI-L', 0), ('OXFORDBUTTONDOWN-WHI-XL', 1), ('OXFORDBUTTONDOWN-WHI-XXL', 7), ('OXFORDBUTTONDOWN-SKY-S', 4), ('OXFORDBUTTONDOWN-SKY-M', 4), ('OXFORDBUTTONDOWN-SKY-L', 1), ('OXFORDBUTTONDOWN-SKY-XL', 0), ('OXFORDBUTTONDOWN-SKY-XXL', 3)) as x(sku, stock) on x.sku = v.sku;

with p as (
  insert into public.products (slug, name, description, details, category_id, price, sale_price, weight_grams, status, is_featured, tags)
  select 'tailored-pleat-trousers', 'Tailored Pleat Trousers', 'Front-pleated trousers with a tapered leg and sharp crease.', E'Composition and care: [confirm with supplier].\nSizing: [add size guide].', c.id, 3800000, NULL, 600, 'published', false, array['tailoring', 'demo']
  from public.categories c join public.categories parent on parent.id = c.parent_id
  where parent.slug = 'men' and c.slug = 'trousers'
  returning id
)
, imgs as (insert into public.product_images (product_id, url, alt, sort_order) select p.id, x.url, x.alt, x.s from p, (values ('https://images.unsplash.com/photo-1473966968600-fa801b869a1a?auto=format&fit=crop&w=1200&q=80', 'Tailored Pleat Trousers — view 1', 0)) as x(url, alt, s))
, v as (insert into public.product_variants (product_id, sku, size, color, color_hex, sort_order) select p.id, x.sku, x.size, x.color, x.hex, x.s from p, (values ('TAILOREDPLEATTRO-BLA-30', '30', 'Black', '#1C1A1B', 0, 1), ('TAILOREDPLEATTRO-BLA-32', '32', 'Black', '#1C1A1B', 1, 1), ('TAILOREDPLEATTRO-BLA-34', '34', 'Black', '#1C1A1B', 2, 0), ('TAILOREDPLEATTRO-BLA-36', '36', 'Black', '#1C1A1B', 3, 0), ('TAILOREDPLEATTRO-CAM-30', '30', 'Camel', '#B98A5E', 4, 1), ('TAILOREDPLEATTRO-CAM-32', '32', 'Camel', '#B98A5E', 5, 7), ('TAILOREDPLEATTRO-CAM-34', '34', 'Camel', '#B98A5E', 6, 5), ('TAILOREDPLEATTRO-CAM-36', '36', 'Camel', '#B98A5E', 7, 2)) as x(sku, size, color, hex, s, stock) returning id, sku)
insert into public.inventory (variant_id, on_hand) select v.id, x.stock from v join (values ('TAILOREDPLEATTRO-BLA-30', 1), ('TAILOREDPLEATTRO-BLA-32', 1), ('TAILOREDPLEATTRO-BLA-34', 0), ('TAILOREDPLEATTRO-BLA-36', 0), ('TAILOREDPLEATTRO-CAM-30', 1), ('TAILOREDPLEATTRO-CAM-32', 7), ('TAILOREDPLEATTRO-CAM-34', 5), ('TAILOREDPLEATTRO-CAM-36', 2)) as x(sku, stock) on x.sku = v.sku;

with p as (
  insert into public.products (slug, name, description, details, category_id, price, sale_price, weight_grams, status, is_featured, tags)
  select 'straight-leg-raw-denim', 'Straight-Leg Raw Denim', 'Rigid straight-leg jeans in deep indigo denim.', E'Composition and care: [confirm with supplier].\nSizing: [add size guide].', c.id, 4200000, 3550000, 750, 'published', false, array['denim', 'demo']
  from public.categories c join public.categories parent on parent.id = c.parent_id
  where parent.slug = 'men' and c.slug = 'jeans'
  returning id
)
, imgs as (insert into public.product_images (product_id, url, alt, sort_order) select p.id, x.url, x.alt, x.s from p, (values ('https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=1200&q=80', 'Straight-Leg Raw Denim — view 1', 0)) as x(url, alt, s))
, v as (insert into public.product_variants (product_id, sku, size, color, color_hex, sort_order) select p.id, x.sku, x.size, x.color, x.hex, x.s from p, (values ('STRAIGHTLEGRAWD-IND-30', '30', 'Indigo', '#2E3F66', 0, 7), ('STRAIGHTLEGRAWD-IND-32', '32', 'Indigo', '#2E3F66', 1, 4), ('STRAIGHTLEGRAWD-IND-34', '34', 'Indigo', '#2E3F66', 2, 7), ('STRAIGHTLEGRAWD-IND-36', '36', 'Indigo', '#2E3F66', 3, 5), ('STRAIGHTLEGRAWD-BLA-30', '30', 'Black', '#1C1A1B', 4, 2), ('STRAIGHTLEGRAWD-BLA-32', '32', 'Black', '#1C1A1B', 5, 0), ('STRAIGHTLEGRAWD-BLA-34', '34', 'Black', '#1C1A1B', 6, 4), ('STRAIGHTLEGRAWD-BLA-36', '36', 'Black', '#1C1A1B', 7, 4)) as x(sku, size, color, hex, s, stock) returning id, sku)
insert into public.inventory (variant_id, on_hand) select v.id, x.stock from v join (values ('STRAIGHTLEGRAWD-IND-30', 7), ('STRAIGHTLEGRAWD-IND-32', 4), ('STRAIGHTLEGRAWD-IND-34', 7), ('STRAIGHTLEGRAWD-IND-36', 5), ('STRAIGHTLEGRAWD-BLA-30', 2), ('STRAIGHTLEGRAWD-BLA-32', 0), ('STRAIGHTLEGRAWD-BLA-34', 4), ('STRAIGHTLEGRAWD-BLA-36', 4)) as x(sku, stock) on x.sku = v.sku;

with p as (
  insert into public.products (slug, name, description, details, category_id, price, sale_price, weight_grams, status, is_featured, tags)
  select 'studio-fleece-hoodie', 'Studio Fleece Hoodie', 'Brushed-back fleece hoodie with a dropped shoulder and kangaroo pocket.', E'Composition and care: [confirm with supplier].\nSizing: [add size guide].', c.id, 3600000, NULL, 700, 'published', true, array['fleece', 'loungewear', 'demo']
  from public.categories c join public.categories parent on parent.id = c.parent_id
  where parent.slug = 'men' and c.slug = 'hoodies-sweatshirts'
  returning id
)
, imgs as (insert into public.product_images (product_id, url, alt, sort_order) select p.id, x.url, x.alt, x.s from p, (values ('https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=1200&q=80', 'Studio Fleece Hoodie — view 1', 0)) as x(url, alt, s))
, v as (insert into public.product_variants (product_id, sku, size, color, color_hex, sort_order) select p.id, x.sku, x.size, x.color, x.hex, x.s from p, (values ('STUDIOFLEECEHOOD-GRE-S', 'S', 'Grey', '#8E8C8F', 0, 1), ('STUDIOFLEECEHOOD-GRE-M', 'M', 'Grey', '#8E8C8F', 1, 1), ('STUDIOFLEECEHOOD-GRE-L', 'L', 'Grey', '#8E8C8F', 2, 2), ('STUDIOFLEECEHOOD-GRE-XL', 'XL', 'Grey', '#8E8C8F', 3, 0), ('STUDIOFLEECEHOOD-GRE-XXL', 'XXL', 'Grey', '#8E8C8F', 4, 1), ('STUDIOFLEECEHOOD-BLA-S', 'S', 'Black', '#1C1A1B', 5, 2), ('STUDIOFLEECEHOOD-BLA-M', 'M', 'Black', '#1C1A1B', 6, 3), ('STUDIOFLEECEHOOD-BLA-L', 'L', 'Black', '#1C1A1B', 7, 5), ('STUDIOFLEECEHOOD-BLA-XL', 'XL', 'Black', '#1C1A1B', 8, 7), ('STUDIOFLEECEHOOD-BLA-XXL', 'XXL', 'Black', '#1C1A1B', 9, 1)) as x(sku, size, color, hex, s, stock) returning id, sku)
insert into public.inventory (variant_id, on_hand) select v.id, x.stock from v join (values ('STUDIOFLEECEHOOD-GRE-S', 1), ('STUDIOFLEECEHOOD-GRE-M', 1), ('STUDIOFLEECEHOOD-GRE-L', 2), ('STUDIOFLEECEHOOD-GRE-XL', 0), ('STUDIOFLEECEHOOD-GRE-XXL', 1), ('STUDIOFLEECEHOOD-BLA-S', 2), ('STUDIOFLEECEHOOD-BLA-M', 3), ('STUDIOFLEECEHOOD-BLA-L', 5), ('STUDIOFLEECEHOOD-BLA-XL', 7), ('STUDIOFLEECEHOOD-BLA-XXL', 1)) as x(sku, stock) on x.sku = v.sku;

with p as (
  insert into public.products (slug, name, description, details, category_id, price, sale_price, weight_grams, status, is_featured, tags)
  select 'moto-leather-jacket', 'Moto Faux-Leather Jacket', 'An edgy biker silhouette in supple faux leather with silver-tone hardware.', E'Composition and care: [confirm with supplier].\nSizing: [add size guide].', c.id, 6800000, NULL, 1400, 'published', true, array['outerwear', 'demo']
  from public.categories c join public.categories parent on parent.id = c.parent_id
  where parent.slug = 'men' and c.slug = 'jackets-outerwear'
  returning id
)
, imgs as (insert into public.product_images (product_id, url, alt, sort_order) select p.id, x.url, x.alt, x.s from p, (values ('https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=1200&q=80', 'Moto Faux-Leather Jacket — view 1', 0)) as x(url, alt, s))
, v as (insert into public.product_variants (product_id, sku, size, color, color_hex, sort_order) select p.id, x.sku, x.size, x.color, x.hex, x.s from p, (values ('MOTOLEATHERJACKE-BLA-S', 'S', 'Black', '#1C1A1B', 0, 8), ('MOTOLEATHERJACKE-BLA-M', 'M', 'Black', '#1C1A1B', 1, 0), ('MOTOLEATHERJACKE-BLA-L', 'L', 'Black', '#1C1A1B', 2, 6), ('MOTOLEATHERJACKE-BLA-XL', 'XL', 'Black', '#1C1A1B', 3, 8), ('MOTOLEATHERJACKE-BLA-XXL', 'XXL', 'Black', '#1C1A1B', 4, 6)) as x(sku, size, color, hex, s, stock) returning id, sku)
insert into public.inventory (variant_id, on_hand) select v.id, x.stock from v join (values ('MOTOLEATHERJACKE-BLA-S', 8), ('MOTOLEATHERJACKE-BLA-M', 0), ('MOTOLEATHERJACKE-BLA-L', 6), ('MOTOLEATHERJACKE-BLA-XL', 8), ('MOTOLEATHERJACKE-BLA-XXL', 6)) as x(sku, stock) on x.sku = v.sku;

with p as (
  insert into public.products (slug, name, description, details, category_id, price, sale_price, weight_grams, status, is_featured, tags)
  select 'weekend-chino-shorts', 'Weekend Chino Shorts', 'Garment-washed chino shorts with a 7-inch inseam.', E'Composition and care: [confirm with supplier].\nSizing: [add size guide].', c.id, 1950000, NULL, 350, 'published', false, array['summer', 'demo']
  from public.categories c join public.categories parent on parent.id = c.parent_id
  where parent.slug = 'men' and c.slug = 'shorts'
  returning id
)
, imgs as (insert into public.product_images (product_id, url, alt, sort_order) select p.id, x.url, x.alt, x.s from p, (values ('https://images.unsplash.com/photo-1591195853828-11db59a44f6b?auto=format&fit=crop&w=1200&q=80', 'Weekend Chino Shorts — view 1', 0)) as x(url, alt, s))
, v as (insert into public.product_variants (product_id, sku, size, color, color_hex, sort_order) select p.id, x.sku, x.size, x.color, x.hex, x.s from p, (values ('WEEKENDCHINOSHOR-CAM-30', '30', 'Camel', '#B98A5E', 0, 1), ('WEEKENDCHINOSHOR-CAM-32', '32', 'Camel', '#B98A5E', 1, 7), ('WEEKENDCHINOSHOR-CAM-34', '34', 'Camel', '#B98A5E', 2, 4), ('WEEKENDCHINOSHOR-CAM-36', '36', 'Camel', '#B98A5E', 3, 2), ('WEEKENDCHINOSHOR-NAV-30', '30', 'Navy', '#1F2A44', 4, 2), ('WEEKENDCHINOSHOR-NAV-32', '32', 'Navy', '#1F2A44', 5, 6), ('WEEKENDCHINOSHOR-NAV-34', '34', 'Navy', '#1F2A44', 6, 1), ('WEEKENDCHINOSHOR-NAV-36', '36', 'Navy', '#1F2A44', 7, 6), ('WEEKENDCHINOSHOR-OLI-30', '30', 'Olive', '#6B6B3A', 8, 7), ('WEEKENDCHINOSHOR-OLI-32', '32', 'Olive', '#6B6B3A', 9, 2), ('WEEKENDCHINOSHOR-OLI-34', '34', 'Olive', '#6B6B3A', 10, 7), ('WEEKENDCHINOSHOR-OLI-36', '36', 'Olive', '#6B6B3A', 11, 4)) as x(sku, size, color, hex, s, stock) returning id, sku)
insert into public.inventory (variant_id, on_hand) select v.id, x.stock from v join (values ('WEEKENDCHINOSHOR-CAM-30', 1), ('WEEKENDCHINOSHOR-CAM-32', 7), ('WEEKENDCHINOSHOR-CAM-34', 4), ('WEEKENDCHINOSHOR-CAM-36', 2), ('WEEKENDCHINOSHOR-NAV-30', 2), ('WEEKENDCHINOSHOR-NAV-32', 6), ('WEEKENDCHINOSHOR-NAV-34', 1), ('WEEKENDCHINOSHOR-NAV-36', 6), ('WEEKENDCHINOSHOR-OLI-30', 7), ('WEEKENDCHINOSHOR-OLI-32', 2), ('WEEKENDCHINOSHOR-OLI-34', 7), ('WEEKENDCHINOSHOR-OLI-36', 4)) as x(sku, stock) on x.sku = v.sku;

with p as (
  insert into public.products (slug, name, description, details, category_id, price, sale_price, weight_grams, status, is_featured, tags)
  select 'satin-slip-midi-dress', 'Satin Slip Midi Dress', 'Bias-cut satin slip dress with delicate straps and a fluid midi hem.', E'Composition and care: [confirm with supplier].\nSizing: [add size guide].', c.id, 4500000, NULL, 400, 'published', true, array['evening', 'satin', 'demo']
  from public.categories c join public.categories parent on parent.id = c.parent_id
  where parent.slug = 'women' and c.slug = 'dresses'
  returning id
)
, imgs as (insert into public.product_images (product_id, url, alt, sort_order) select p.id, x.url, x.alt, x.s from p, (values ('https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=1200&q=80', 'Satin Slip Midi Dress — view 1', 0), ('https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1200&q=80', 'Satin Slip Midi Dress — view 2', 1)) as x(url, alt, s))
, v as (insert into public.product_variants (product_id, sku, size, color, color_hex, sort_order) select p.id, x.sku, x.size, x.color, x.hex, x.s from p, (values ('SATINSLIPMIDIDR-ROS-XS', 'XS', 'Rose', '#D94F91', 0, 5), ('SATINSLIPMIDIDR-ROS-S', 'S', 'Rose', '#D94F91', 1, 4), ('SATINSLIPMIDIDR-ROS-M', 'M', 'Rose', '#D94F91', 2, 5), ('SATINSLIPMIDIDR-ROS-L', 'L', 'Rose', '#D94F91', 3, 1), ('SATINSLIPMIDIDR-ROS-XL', 'XL', 'Rose', '#D94F91', 4, 2), ('SATINSLIPMIDIDR-BLA-XS', 'XS', 'Black', '#1C1A1B', 5, 6), ('SATINSLIPMIDIDR-BLA-S', 'S', 'Black', '#1C1A1B', 6, 8), ('SATINSLIPMIDIDR-BLA-M', 'M', 'Black', '#1C1A1B', 7, 7), ('SATINSLIPMIDIDR-BLA-L', 'L', 'Black', '#1C1A1B', 8, 6), ('SATINSLIPMIDIDR-BLA-XL', 'XL', 'Black', '#1C1A1B', 9, 1), ('SATINSLIPMIDIDR-CHA-XS', 'XS', 'Champagne', '#E8D3B9', 10, 3), ('SATINSLIPMIDIDR-CHA-S', 'S', 'Champagne', '#E8D3B9', 11, 1), ('SATINSLIPMIDIDR-CHA-M', 'M', 'Champagne', '#E8D3B9', 12, 8), ('SATINSLIPMIDIDR-CHA-L', 'L', 'Champagne', '#E8D3B9', 13, 7), ('SATINSLIPMIDIDR-CHA-XL', 'XL', 'Champagne', '#E8D3B9', 14, 6)) as x(sku, size, color, hex, s, stock) returning id, sku)
insert into public.inventory (variant_id, on_hand) select v.id, x.stock from v join (values ('SATINSLIPMIDIDR-ROS-XS', 5), ('SATINSLIPMIDIDR-ROS-S', 4), ('SATINSLIPMIDIDR-ROS-M', 5), ('SATINSLIPMIDIDR-ROS-L', 1), ('SATINSLIPMIDIDR-ROS-XL', 2), ('SATINSLIPMIDIDR-BLA-XS', 6), ('SATINSLIPMIDIDR-BLA-S', 8), ('SATINSLIPMIDIDR-BLA-M', 7), ('SATINSLIPMIDIDR-BLA-L', 6), ('SATINSLIPMIDIDR-BLA-XL', 1), ('SATINSLIPMIDIDR-CHA-XS', 3), ('SATINSLIPMIDIDR-CHA-S', 1), ('SATINSLIPMIDIDR-CHA-M', 8), ('SATINSLIPMIDIDR-CHA-L', 7), ('SATINSLIPMIDIDR-CHA-XL', 6)) as x(sku, stock) on x.sku = v.sku;

with p as (
  insert into public.products (slug, name, description, details, category_id, price, sale_price, weight_grams, status, is_featured, tags)
  select 'wrap-front-mini-dress', 'Wrap-Front Mini Dress', 'A flattering wrap mini with puff sleeves and a tie waist.', E'Composition and care: [confirm with supplier].\nSizing: [add size guide].', c.id, 3850000, 2990000, 350, 'published', true, array['day-to-night', 'demo']
  from public.categories c join public.categories parent on parent.id = c.parent_id
  where parent.slug = 'women' and c.slug = 'dresses'
  returning id
)
, imgs as (insert into public.product_images (product_id, url, alt, sort_order) select p.id, x.url, x.alt, x.s from p, (values ('https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1200&q=80', 'Wrap-Front Mini Dress — view 1', 0), ('https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=1200&q=80', 'Wrap-Front Mini Dress — view 2', 1)) as x(url, alt, s))
, v as (insert into public.product_variants (product_id, sku, size, color, color_hex, sort_order) select p.id, x.sku, x.size, x.color, x.hex, x.s from p, (values ('WRAPFRONTMINIDR-BLU-XS', 'XS', 'Blush', '#F4C9D9', 0, 6), ('WRAPFRONTMINIDR-BLU-S', 'S', 'Blush', '#F4C9D9', 1, 0), ('WRAPFRONTMINIDR-BLU-M', 'M', 'Blush', '#F4C9D9', 2, 8), ('WRAPFRONTMINIDR-BLU-L', 'L', 'Blush', '#F4C9D9', 3, 3), ('WRAPFRONTMINIDR-BLU-XL', 'XL', 'Blush', '#F4C9D9', 4, 2), ('WRAPFRONTMINIDR-BLA-XS', 'XS', 'Black', '#1C1A1B', 5, 2), ('WRAPFRONTMINIDR-BLA-S', 'S', 'Black', '#1C1A1B', 6, 4), ('WRAPFRONTMINIDR-BLA-M', 'M', 'Black', '#1C1A1B', 7, 7), ('WRAPFRONTMINIDR-BLA-L', 'L', 'Black', '#1C1A1B', 8, 5), ('WRAPFRONTMINIDR-BLA-XL', 'XL', 'Black', '#1C1A1B', 9, 6)) as x(sku, size, color, hex, s, stock) returning id, sku)
insert into public.inventory (variant_id, on_hand) select v.id, x.stock from v join (values ('WRAPFRONTMINIDR-BLU-XS', 6), ('WRAPFRONTMINIDR-BLU-S', 0), ('WRAPFRONTMINIDR-BLU-M', 8), ('WRAPFRONTMINIDR-BLU-L', 3), ('WRAPFRONTMINIDR-BLU-XL', 2), ('WRAPFRONTMINIDR-BLA-XS', 2), ('WRAPFRONTMINIDR-BLA-S', 4), ('WRAPFRONTMINIDR-BLA-M', 7), ('WRAPFRONTMINIDR-BLA-L', 5), ('WRAPFRONTMINIDR-BLA-XL', 6)) as x(sku, stock) on x.sku = v.sku;

with p as (
  insert into public.products (slug, name, description, details, category_id, price, sale_price, weight_grams, status, is_featured, tags)
  select 'sculpted-corset-top', 'Sculpted Corset Top', 'Structured corset-style top with boning and a sweetheart neckline.', E'Composition and care: [confirm with supplier].\nSizing: [add size guide].', c.id, 2750000, NULL, 250, 'published', false, array['going-out', 'demo']
  from public.categories c join public.categories parent on parent.id = c.parent_id
  where parent.slug = 'women' and c.slug = 'tops-blouses'
  returning id
)
, imgs as (insert into public.product_images (product_id, url, alt, sort_order) select p.id, x.url, x.alt, x.s from p, (values ('https://images.unsplash.com/photo-1564257631407-4deb1f99d992?auto=format&fit=crop&w=1200&q=80', 'Sculpted Corset Top — view 1', 0)) as x(url, alt, s))
, v as (insert into public.product_variants (product_id, sku, size, color, color_hex, sort_order) select p.id, x.sku, x.size, x.color, x.hex, x.s from p, (values ('SCULPTEDCORSETTO-BLA-XS', 'XS', 'Black', '#1C1A1B', 0, 1), ('SCULPTEDCORSETTO-BLA-S', 'S', 'Black', '#1C1A1B', 1, 8), ('SCULPTEDCORSETTO-BLA-M', 'M', 'Black', '#1C1A1B', 2, 4), ('SCULPTEDCORSETTO-BLA-L', 'L', 'Black', '#1C1A1B', 3, 5), ('SCULPTEDCORSETTO-BLA-XL', 'XL', 'Black', '#1C1A1B', 4, 8), ('SCULPTEDCORSETTO-WHI-XS', 'XS', 'White', '#F7F5F2', 5, 2), ('SCULPTEDCORSETTO-WHI-S', 'S', 'White', '#F7F5F2', 6, 4), ('SCULPTEDCORSETTO-WHI-M', 'M', 'White', '#F7F5F2', 7, 3), ('SCULPTEDCORSETTO-WHI-L', 'L', 'White', '#F7F5F2', 8, 5), ('SCULPTEDCORSETTO-WHI-XL', 'XL', 'White', '#F7F5F2', 9, 0), ('SCULPTEDCORSETTO-ROS-XS', 'XS', 'Rose', '#D94F91', 10, 2), ('SCULPTEDCORSETTO-ROS-S', 'S', 'Rose', '#D94F91', 11, 5), ('SCULPTEDCORSETTO-ROS-M', 'M', 'Rose', '#D94F91', 12, 0), ('SCULPTEDCORSETTO-ROS-L', 'L', 'Rose', '#D94F91', 13, 0), ('SCULPTEDCORSETTO-ROS-XL', 'XL', 'Rose', '#D94F91', 14, 4)) as x(sku, size, color, hex, s, stock) returning id, sku)
insert into public.inventory (variant_id, on_hand) select v.id, x.stock from v join (values ('SCULPTEDCORSETTO-BLA-XS', 1), ('SCULPTEDCORSETTO-BLA-S', 8), ('SCULPTEDCORSETTO-BLA-M', 4), ('SCULPTEDCORSETTO-BLA-L', 5), ('SCULPTEDCORSETTO-BLA-XL', 8), ('SCULPTEDCORSETTO-WHI-XS', 2), ('SCULPTEDCORSETTO-WHI-S', 4), ('SCULPTEDCORSETTO-WHI-M', 3), ('SCULPTEDCORSETTO-WHI-L', 5), ('SCULPTEDCORSETTO-WHI-XL', 0), ('SCULPTEDCORSETTO-ROS-XS', 2), ('SCULPTEDCORSETTO-ROS-S', 5), ('SCULPTEDCORSETTO-ROS-M', 0), ('SCULPTEDCORSETTO-ROS-L', 0), ('SCULPTEDCORSETTO-ROS-XL', 4)) as x(sku, stock) on x.sku = v.sku;

with p as (
  insert into public.products (slug, name, description, details, category_id, price, sale_price, weight_grams, status, is_featured, tags)
  select 'silk-touch-blouse', 'Silk-Touch Blouse', 'Fluid silk-touch blouse with a soft bow neck.', E'Composition and care: [confirm with supplier].\nSizing: [add size guide].', c.id, 2900000, NULL, 250, 'published', false, array['workwear', 'demo']
  from public.categories c join public.categories parent on parent.id = c.parent_id
  where parent.slug = 'women' and c.slug = 'tops-blouses'
  returning id
)
, imgs as (insert into public.product_images (product_id, url, alt, sort_order) select p.id, x.url, x.alt, x.s from p, (values ('https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=1200&q=80', 'Silk-Touch Blouse — view 1', 0)) as x(url, alt, s))
, v as (insert into public.product_variants (product_id, sku, size, color, color_hex, sort_order) select p.id, x.sku, x.size, x.color, x.hex, x.s from p, (values ('SILKTOUCHBLOUSE-CRE-XS', 'XS', 'Cream', '#EFE6D8', 0, 8), ('SILKTOUCHBLOUSE-CRE-S', 'S', 'Cream', '#EFE6D8', 1, 8), ('SILKTOUCHBLOUSE-CRE-M', 'M', 'Cream', '#EFE6D8', 2, 7), ('SILKTOUCHBLOUSE-CRE-L', 'L', 'Cream', '#EFE6D8', 3, 0), ('SILKTOUCHBLOUSE-CRE-XL', 'XL', 'Cream', '#EFE6D8', 4, 1), ('SILKTOUCHBLOUSE-BLU-XS', 'XS', 'Blush', '#F4C9D9', 5, 6), ('SILKTOUCHBLOUSE-BLU-S', 'S', 'Blush', '#F4C9D9', 6, 5), ('SILKTOUCHBLOUSE-BLU-M', 'M', 'Blush', '#F4C9D9', 7, 4), ('SILKTOUCHBLOUSE-BLU-L', 'L', 'Blush', '#F4C9D9', 8, 4), ('SILKTOUCHBLOUSE-BLU-XL', 'XL', 'Blush', '#F4C9D9', 9, 5)) as x(sku, size, color, hex, s, stock) returning id, sku)
insert into public.inventory (variant_id, on_hand) select v.id, x.stock from v join (values ('SILKTOUCHBLOUSE-CRE-XS', 8), ('SILKTOUCHBLOUSE-CRE-S', 8), ('SILKTOUCHBLOUSE-CRE-M', 7), ('SILKTOUCHBLOUSE-CRE-L', 0), ('SILKTOUCHBLOUSE-CRE-XL', 1), ('SILKTOUCHBLOUSE-BLU-XS', 6), ('SILKTOUCHBLOUSE-BLU-S', 5), ('SILKTOUCHBLOUSE-BLU-M', 4), ('SILKTOUCHBLOUSE-BLU-L', 4), ('SILKTOUCHBLOUSE-BLU-XL', 5)) as x(sku, stock) on x.sku = v.sku;

with p as (
  insert into public.products (slug, name, description, details, category_id, price, sale_price, weight_grams, status, is_featured, tags)
  select 'pleated-satin-midi-skirt', 'Pleated Satin Midi Skirt', 'Knife-pleated satin skirt that catches the light with every step.', E'Composition and care: [confirm with supplier].\nSizing: [add size guide].', c.id, 3300000, NULL, 350, 'published', false, array['satin', 'demo']
  from public.categories c join public.categories parent on parent.id = c.parent_id
  where parent.slug = 'women' and c.slug = 'skirts'
  returning id
)
, imgs as (insert into public.product_images (product_id, url, alt, sort_order) select p.id, x.url, x.alt, x.s from p, (values ('https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?auto=format&fit=crop&w=1200&q=80', 'Pleated Satin Midi Skirt — view 1', 0)) as x(url, alt, s))
, v as (insert into public.product_variants (product_id, sku, size, color, color_hex, sort_order) select p.id, x.sku, x.size, x.color, x.hex, x.s from p, (values ('PLEATEDSATINMIDI-CHA-XS', 'XS', 'Champagne', '#E8D3B9', 0, 8), ('PLEATEDSATINMIDI-CHA-S', 'S', 'Champagne', '#E8D3B9', 1, 5), ('PLEATEDSATINMIDI-CHA-M', 'M', 'Champagne', '#E8D3B9', 2, 1), ('PLEATEDSATINMIDI-CHA-L', 'L', 'Champagne', '#E8D3B9', 3, 0), ('PLEATEDSATINMIDI-CHA-XL', 'XL', 'Champagne', '#E8D3B9', 4, 3), ('PLEATEDSATINMIDI-BLA-XS', 'XS', 'Black', '#1C1A1B', 5, 1), ('PLEATEDSATINMIDI-BLA-S', 'S', 'Black', '#1C1A1B', 6, 5), ('PLEATEDSATINMIDI-BLA-M', 'M', 'Black', '#1C1A1B', 7, 5), ('PLEATEDSATINMIDI-BLA-L', 'L', 'Black', '#1C1A1B', 8, 2), ('PLEATEDSATINMIDI-BLA-XL', 'XL', 'Black', '#1C1A1B', 9, 8)) as x(sku, size, color, hex, s, stock) returning id, sku)
insert into public.inventory (variant_id, on_hand) select v.id, x.stock from v join (values ('PLEATEDSATINMIDI-CHA-XS', 8), ('PLEATEDSATINMIDI-CHA-S', 5), ('PLEATEDSATINMIDI-CHA-M', 1), ('PLEATEDSATINMIDI-CHA-L', 0), ('PLEATEDSATINMIDI-CHA-XL', 3), ('PLEATEDSATINMIDI-BLA-XS', 1), ('PLEATEDSATINMIDI-BLA-S', 5), ('PLEATEDSATINMIDI-BLA-M', 5), ('PLEATEDSATINMIDI-BLA-L', 2), ('PLEATEDSATINMIDI-BLA-XL', 8)) as x(sku, stock) on x.sku = v.sku;

with p as (
  insert into public.products (slug, name, description, details, category_id, price, sale_price, weight_grams, status, is_featured, tags)
  select 'high-rise-wide-leg-jeans', 'High-Rise Wide-Leg Jeans', 'Ultra high-rise jeans with a sweeping wide leg.', E'Composition and care: [confirm with supplier].\nSizing: [add size guide].', c.id, 3950000, NULL, 700, 'published', false, array['denim', 'demo']
  from public.categories c join public.categories parent on parent.id = c.parent_id
  where parent.slug = 'women' and c.slug = 'trousers-jeans'
  returning id
)
, imgs as (insert into public.product_images (product_id, url, alt, sort_order) select p.id, x.url, x.alt, x.s from p, (values ('https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&w=1200&q=80', 'High-Rise Wide-Leg Jeans — view 1', 0)) as x(url, alt, s))
, v as (insert into public.product_variants (product_id, sku, size, color, color_hex, sort_order) select p.id, x.sku, x.size, x.color, x.hex, x.s from p, (values ('HIGHRISEWIDELEG-IND-24', '24', 'Indigo', '#2E3F66', 0, 5), ('HIGHRISEWIDELEG-IND-26', '26', 'Indigo', '#2E3F66', 1, 6), ('HIGHRISEWIDELEG-IND-28', '28', 'Indigo', '#2E3F66', 2, 6), ('HIGHRISEWIDELEG-IND-30', '30', 'Indigo', '#2E3F66', 3, 0), ('HIGHRISEWIDELEG-IND-32', '32', 'Indigo', '#2E3F66', 4, 3), ('HIGHRISEWIDELEG-WHI-24', '24', 'White', '#F7F5F2', 5, 7), ('HIGHRISEWIDELEG-WHI-26', '26', 'White', '#F7F5F2', 6, 8), ('HIGHRISEWIDELEG-WHI-28', '28', 'White', '#F7F5F2', 7, 6), ('HIGHRISEWIDELEG-WHI-30', '30', 'White', '#F7F5F2', 8, 6), ('HIGHRISEWIDELEG-WHI-32', '32', 'White', '#F7F5F2', 9, 3)) as x(sku, size, color, hex, s, stock) returning id, sku)
insert into public.inventory (variant_id, on_hand) select v.id, x.stock from v join (values ('HIGHRISEWIDELEG-IND-24', 5), ('HIGHRISEWIDELEG-IND-26', 6), ('HIGHRISEWIDELEG-IND-28', 6), ('HIGHRISEWIDELEG-IND-30', 0), ('HIGHRISEWIDELEG-IND-32', 3), ('HIGHRISEWIDELEG-WHI-24', 7), ('HIGHRISEWIDELEG-WHI-26', 8), ('HIGHRISEWIDELEG-WHI-28', 6), ('HIGHRISEWIDELEG-WHI-30', 6), ('HIGHRISEWIDELEG-WHI-32', 3)) as x(sku, stock) on x.sku = v.sku;

with p as (
  insert into public.products (slug, name, description, details, category_id, price, sale_price, weight_grams, status, is_featured, tags)
  select 'two-piece-blazer-set', 'Two-Piece Blazer Set', 'An oversized single-breasted blazer with matching straight trousers. Power dressing, softened.', E'Composition and care: [confirm with supplier].\nSizing: [add size guide].', c.id, 7800000, NULL, 1100, 'published', true, array['tailoring', 'sets', 'demo']
  from public.categories c join public.categories parent on parent.id = c.parent_id
  where parent.slug = 'women' and c.slug = 'matching-sets'
  returning id
)
, imgs as (insert into public.product_images (product_id, url, alt, sort_order) select p.id, x.url, x.alt, x.s from p, (values ('https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=1200&q=80', 'Two-Piece Blazer Set — view 1', 0), ('https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=1200&q=80', 'Two-Piece Blazer Set — view 2', 1)) as x(url, alt, s))
, v as (insert into public.product_variants (product_id, sku, size, color, color_hex, sort_order) select p.id, x.sku, x.size, x.color, x.hex, x.s from p, (values ('TWOPIECEBLAZERS-ROS-XS', 'XS', 'Rose', '#D94F91', 0, 7), ('TWOPIECEBLAZERS-ROS-S', 'S', 'Rose', '#D94F91', 1, 2), ('TWOPIECEBLAZERS-ROS-M', 'M', 'Rose', '#D94F91', 2, 8), ('TWOPIECEBLAZERS-ROS-L', 'L', 'Rose', '#D94F91', 3, 3), ('TWOPIECEBLAZERS-ROS-XL', 'XL', 'Rose', '#D94F91', 4, 5), ('TWOPIECEBLAZERS-BLA-XS', 'XS', 'Black', '#1C1A1B', 5, 6), ('TWOPIECEBLAZERS-BLA-S', 'S', 'Black', '#1C1A1B', 6, 4), ('TWOPIECEBLAZERS-BLA-M', 'M', 'Black', '#1C1A1B', 7, 1), ('TWOPIECEBLAZERS-BLA-L', 'L', 'Black', '#1C1A1B', 8, 4), ('TWOPIECEBLAZERS-BLA-XL', 'XL', 'Black', '#1C1A1B', 9, 5)) as x(sku, size, color, hex, s, stock) returning id, sku)
insert into public.inventory (variant_id, on_hand) select v.id, x.stock from v join (values ('TWOPIECEBLAZERS-ROS-XS', 7), ('TWOPIECEBLAZERS-ROS-S', 2), ('TWOPIECEBLAZERS-ROS-M', 8), ('TWOPIECEBLAZERS-ROS-L', 3), ('TWOPIECEBLAZERS-ROS-XL', 5), ('TWOPIECEBLAZERS-BLA-XS', 6), ('TWOPIECEBLAZERS-BLA-S', 4), ('TWOPIECEBLAZERS-BLA-M', 1), ('TWOPIECEBLAZERS-BLA-L', 4), ('TWOPIECEBLAZERS-BLA-XL', 5)) as x(sku, stock) on x.sku = v.sku;

with p as (
  insert into public.products (slug, name, description, details, category_id, price, sale_price, weight_grams, status, is_featured, tags)
  select 'ribbed-lounge-set', 'Ribbed Lounge Set', 'A cropped ribbed top and wide-leg pant in buttery-soft knit.', E'Composition and care: [confirm with supplier].\nSizing: [add size guide].', c.id, 4100000, 3490000, 600, 'published', false, array['loungewear', 'sets', 'demo']
  from public.categories c join public.categories parent on parent.id = c.parent_id
  where parent.slug = 'women' and c.slug = 'matching-sets'
  returning id
)
, imgs as (insert into public.product_images (product_id, url, alt, sort_order) select p.id, x.url, x.alt, x.s from p, (values ('https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=1200&q=80', 'Ribbed Lounge Set — view 1', 0), ('https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=1200&q=80', 'Ribbed Lounge Set — view 2', 1)) as x(url, alt, s))
, v as (insert into public.product_variants (product_id, sku, size, color, color_hex, sort_order) select p.id, x.sku, x.size, x.color, x.hex, x.s from p, (values ('RIBBEDLOUNGESET-BLU-XS', 'XS', 'Blush', '#F4C9D9', 0, 1), ('RIBBEDLOUNGESET-BLU-S', 'S', 'Blush', '#F4C9D9', 1, 4), ('RIBBEDLOUNGESET-BLU-M', 'M', 'Blush', '#F4C9D9', 2, 0), ('RIBBEDLOUNGESET-BLU-L', 'L', 'Blush', '#F4C9D9', 3, 2), ('RIBBEDLOUNGESET-BLU-XL', 'XL', 'Blush', '#F4C9D9', 4, 5), ('RIBBEDLOUNGESET-GRE-XS', 'XS', 'Grey', '#8E8C8F', 5, 8), ('RIBBEDLOUNGESET-GRE-S', 'S', 'Grey', '#8E8C8F', 6, 3), ('RIBBEDLOUNGESET-GRE-M', 'M', 'Grey', '#8E8C8F', 7, 3), ('RIBBEDLOUNGESET-GRE-L', 'L', 'Grey', '#8E8C8F', 8, 8), ('RIBBEDLOUNGESET-GRE-XL', 'XL', 'Grey', '#8E8C8F', 9, 2)) as x(sku, size, color, hex, s, stock) returning id, sku)
insert into public.inventory (variant_id, on_hand) select v.id, x.stock from v join (values ('RIBBEDLOUNGESET-BLU-XS', 1), ('RIBBEDLOUNGESET-BLU-S', 4), ('RIBBEDLOUNGESET-BLU-M', 0), ('RIBBEDLOUNGESET-BLU-L', 2), ('RIBBEDLOUNGESET-BLU-XL', 5), ('RIBBEDLOUNGESET-GRE-XS', 8), ('RIBBEDLOUNGESET-GRE-S', 3), ('RIBBEDLOUNGESET-GRE-M', 3), ('RIBBEDLOUNGESET-GRE-L', 8), ('RIBBEDLOUNGESET-GRE-XL', 2)) as x(sku, stock) on x.sku = v.sku;

with p as (
  insert into public.products (slug, name, description, details, category_id, price, sale_price, weight_grams, status, is_featured, tags)
  select 'cropped-zip-hoodie', 'Cropped Zip Hoodie', 'Cropped zip-through hoodie in soft brushed fleece.', E'Composition and care: [confirm with supplier].\nSizing: [add size guide].', c.id, 3100000, NULL, 500, 'published', false, array['fleece', 'demo']
  from public.categories c join public.categories parent on parent.id = c.parent_id
  where parent.slug = 'women' and c.slug = 'hoodies-sweatshirts'
  returning id
)
, imgs as (insert into public.product_images (product_id, url, alt, sort_order) select p.id, x.url, x.alt, x.s from p, (values ('https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=1200&q=80', 'Cropped Zip Hoodie — view 1', 0)) as x(url, alt, s))
, v as (insert into public.product_variants (product_id, sku, size, color, color_hex, sort_order) select p.id, x.sku, x.size, x.color, x.hex, x.s from p, (values ('CROPPEDZIPHOODIE-ROS-XS', 'XS', 'Rose', '#D94F91', 0, 4), ('CROPPEDZIPHOODIE-ROS-S', 'S', 'Rose', '#D94F91', 1, 0), ('CROPPEDZIPHOODIE-ROS-M', 'M', 'Rose', '#D94F91', 2, 0), ('CROPPEDZIPHOODIE-ROS-L', 'L', 'Rose', '#D94F91', 3, 1), ('CROPPEDZIPHOODIE-ROS-XL', 'XL', 'Rose', '#D94F91', 4, 2), ('CROPPEDZIPHOODIE-GRE-XS', 'XS', 'Grey', '#8E8C8F', 5, 7), ('CROPPEDZIPHOODIE-GRE-S', 'S', 'Grey', '#8E8C8F', 6, 7), ('CROPPEDZIPHOODIE-GRE-M', 'M', 'Grey', '#8E8C8F', 7, 2), ('CROPPEDZIPHOODIE-GRE-L', 'L', 'Grey', '#8E8C8F', 8, 4), ('CROPPEDZIPHOODIE-GRE-XL', 'XL', 'Grey', '#8E8C8F', 9, 1)) as x(sku, size, color, hex, s, stock) returning id, sku)
insert into public.inventory (variant_id, on_hand) select v.id, x.stock from v join (values ('CROPPEDZIPHOODIE-ROS-XS', 4), ('CROPPEDZIPHOODIE-ROS-S', 0), ('CROPPEDZIPHOODIE-ROS-M', 0), ('CROPPEDZIPHOODIE-ROS-L', 1), ('CROPPEDZIPHOODIE-ROS-XL', 2), ('CROPPEDZIPHOODIE-GRE-XS', 7), ('CROPPEDZIPHOODIE-GRE-S', 7), ('CROPPEDZIPHOODIE-GRE-M', 2), ('CROPPEDZIPHOODIE-GRE-L', 4), ('CROPPEDZIPHOODIE-GRE-XL', 1)) as x(sku, stock) on x.sku = v.sku;

with p as (
  insert into public.products (slug, name, description, details, category_id, price, sale_price, weight_grams, status, is_featured, tags)
  select 'belted-trench-coat', 'Belted Trench Coat', 'A modern trench with storm flaps, a tie belt and a sweeping hem.', E'Composition and care: [confirm with supplier].\nSizing: [add size guide].', c.id, 8500000, NULL, 1300, 'published', true, array['outerwear', 'demo']
  from public.categories c join public.categories parent on parent.id = c.parent_id
  where parent.slug = 'women' and c.slug = 'jackets-outerwear'
  returning id
)
, imgs as (insert into public.product_images (product_id, url, alt, sort_order) select p.id, x.url, x.alt, x.s from p, (values ('https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&w=1200&q=80', 'Belted Trench Coat — view 1', 0), ('https://images.unsplash.com/photo-1485968579580-b6d095142e6e?auto=format&fit=crop&w=1200&q=80', 'Belted Trench Coat — view 2', 1)) as x(url, alt, s))
, v as (insert into public.product_variants (product_id, sku, size, color, color_hex, sort_order) select p.id, x.sku, x.size, x.color, x.hex, x.s from p, (values ('BELTEDTRENCHCOAT-CAM-XS', 'XS', 'Camel', '#B98A5E', 0, 5), ('BELTEDTRENCHCOAT-CAM-S', 'S', 'Camel', '#B98A5E', 1, 1), ('BELTEDTRENCHCOAT-CAM-M', 'M', 'Camel', '#B98A5E', 2, 1), ('BELTEDTRENCHCOAT-CAM-L', 'L', 'Camel', '#B98A5E', 3, 3), ('BELTEDTRENCHCOAT-CAM-XL', 'XL', 'Camel', '#B98A5E', 4, 3), ('BELTEDTRENCHCOAT-BLA-XS', 'XS', 'Black', '#1C1A1B', 5, 1), ('BELTEDTRENCHCOAT-BLA-S', 'S', 'Black', '#1C1A1B', 6, 2), ('BELTEDTRENCHCOAT-BLA-M', 'M', 'Black', '#1C1A1B', 7, 7), ('BELTEDTRENCHCOAT-BLA-L', 'L', 'Black', '#1C1A1B', 8, 3), ('BELTEDTRENCHCOAT-BLA-XL', 'XL', 'Black', '#1C1A1B', 9, 5)) as x(sku, size, color, hex, s, stock) returning id, sku)
insert into public.inventory (variant_id, on_hand) select v.id, x.stock from v join (values ('BELTEDTRENCHCOAT-CAM-XS', 5), ('BELTEDTRENCHCOAT-CAM-S', 1), ('BELTEDTRENCHCOAT-CAM-M', 1), ('BELTEDTRENCHCOAT-CAM-L', 3), ('BELTEDTRENCHCOAT-CAM-XL', 3), ('BELTEDTRENCHCOAT-BLA-XS', 1), ('BELTEDTRENCHCOAT-BLA-S', 2), ('BELTEDTRENCHCOAT-BLA-M', 7), ('BELTEDTRENCHCOAT-BLA-L', 3), ('BELTEDTRENCHCOAT-BLA-XL', 5)) as x(sku, stock) on x.sku = v.sku;

with p as (
  insert into public.products (slug, name, description, details, category_id, price, sale_price, weight_grams, status, is_featured, tags)
  select 'structured-top-handle-bag', 'Structured Top-Handle Bag', 'A sculpted top-handle bag with a detachable strap and gold-tone hardware.', E'Composition and care: [confirm with supplier].\nSizing: [add size guide].', c.id, 6400000, NULL, 800, 'published', true, array['leather-look', 'demo']
  from public.categories c join public.categories parent on parent.id = c.parent_id
  where parent.slug = 'bags' and c.slug = 'handbags'
  returning id
)
, imgs as (insert into public.product_images (product_id, url, alt, sort_order) select p.id, x.url, x.alt, x.s from p, (values ('https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1200&q=80', 'Structured Top-Handle Bag — view 1', 0), ('https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1200&q=80', 'Structured Top-Handle Bag — view 2', 1)) as x(url, alt, s))
, v as (insert into public.product_variants (product_id, sku, size, color, color_hex, sort_order) select p.id, x.sku, x.size, x.color, x.hex, x.s from p, (values ('STRUCTUREDTOPHAN-BLA', NULL, 'Black', '#1C1A1B', 0, 2), ('STRUCTUREDTOPHAN-ROS', NULL, 'Rose', '#D94F91', 1, 6), ('STRUCTUREDTOPHAN-CRE', NULL, 'Cream', '#EFE6D8', 2, 3)) as x(sku, size, color, hex, s, stock) returning id, sku)
insert into public.inventory (variant_id, on_hand) select v.id, x.stock from v join (values ('STRUCTUREDTOPHAN-BLA', 2), ('STRUCTUREDTOPHAN-ROS', 6), ('STRUCTUREDTOPHAN-CRE', 3)) as x(sku, stock) on x.sku = v.sku;

with p as (
  insert into public.products (slug, name, description, details, category_id, price, sale_price, weight_grams, status, is_featured, tags)
  select 'quilted-chain-shoulder-bag', 'Quilted Chain Shoulder Bag', 'Diamond-quilted shoulder bag on a woven chain strap.', E'Composition and care: [confirm with supplier].\nSizing: [add size guide].', c.id, 5200000, 4500000, 600, 'published', true, array['evening', 'demo']
  from public.categories c join public.categories parent on parent.id = c.parent_id
  where parent.slug = 'bags' and c.slug = 'shoulder-bags'
  returning id
)
, imgs as (insert into public.product_images (product_id, url, alt, sort_order) select p.id, x.url, x.alt, x.s from p, (values ('https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1200&q=80', 'Quilted Chain Shoulder Bag — view 1', 0), ('https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1200&q=80', 'Quilted Chain Shoulder Bag — view 2', 1)) as x(url, alt, s))
, v as (insert into public.product_variants (product_id, sku, size, color, color_hex, sort_order) select p.id, x.sku, x.size, x.color, x.hex, x.s from p, (values ('QUILTEDCHAINSHOU-BLA', NULL, 'Black', '#1C1A1B', 0, 2), ('QUILTEDCHAINSHOU-BLU', NULL, 'Blush', '#F4C9D9', 1, 1)) as x(sku, size, color, hex, s, stock) returning id, sku)
insert into public.inventory (variant_id, on_hand) select v.id, x.stock from v join (values ('QUILTEDCHAINSHOU-BLA', 2), ('QUILTEDCHAINSHOU-BLU', 1)) as x(sku, stock) on x.sku = v.sku;

with p as (
  insert into public.products (slug, name, description, details, category_id, price, sale_price, weight_grams, status, is_featured, tags)
  select 'mini-crossbody-bag', 'Mini Crossbody Bag', 'Compact crossbody with an adjustable strap — fits phone, cards and keys.', E'Composition and care: [confirm with supplier].\nSizing: [add size guide].', c.id, 3450000, NULL, 400, 'published', false, array['everyday', 'demo']
  from public.categories c join public.categories parent on parent.id = c.parent_id
  where parent.slug = 'bags' and c.slug = 'crossbody-bags'
  returning id
)
, imgs as (insert into public.product_images (product_id, url, alt, sort_order) select p.id, x.url, x.alt, x.s from p, (values ('https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=1200&q=80', 'Mini Crossbody Bag — view 1', 0)) as x(url, alt, s))
, v as (insert into public.product_variants (product_id, sku, size, color, color_hex, sort_order) select p.id, x.sku, x.size, x.color, x.hex, x.s from p, (values ('MINICROSSBODYBAG-TAN', NULL, 'Tan', '#A9774E', 0, 1), ('MINICROSSBODYBAG-BLA', NULL, 'Black', '#1C1A1B', 1, 1)) as x(sku, size, color, hex, s, stock) returning id, sku)
insert into public.inventory (variant_id, on_hand) select v.id, x.stock from v join (values ('MINICROSSBODYBAG-TAN', 1), ('MINICROSSBODYBAG-BLA', 1)) as x(sku, stock) on x.sku = v.sku;

with p as (
  insert into public.products (slug, name, description, details, category_id, price, sale_price, weight_grams, status, is_featured, tags)
  select 'oversized-canvas-tote', 'Oversized Canvas Tote', 'Heavy canvas tote with an internal zip pocket and leather-look handles.', E'Composition and care: [confirm with supplier].\nSizing: [add size guide].', c.id, 2600000, NULL, 500, 'published', false, array['everyday', 'demo']
  from public.categories c join public.categories parent on parent.id = c.parent_id
  where parent.slug = 'bags' and c.slug = 'tote-bags'
  returning id
)
, imgs as (insert into public.product_images (product_id, url, alt, sort_order) select p.id, x.url, x.alt, x.s from p, (values ('https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?auto=format&fit=crop&w=1200&q=80', 'Oversized Canvas Tote — view 1', 0)) as x(url, alt, s))
, v as (insert into public.product_variants (product_id, sku, size, color, color_hex, sort_order) select p.id, x.sku, x.size, x.color, x.hex, x.s from p, (values ('OVERSIZEDCANVAST-CRE', NULL, 'Cream', '#EFE6D8', 0, 2), ('OVERSIZEDCANVAST-BLA', NULL, 'Black', '#1C1A1B', 1, 7)) as x(sku, size, color, hex, s, stock) returning id, sku)
insert into public.inventory (variant_id, on_hand) select v.id, x.stock from v join (values ('OVERSIZEDCANVAST-CRE', 2), ('OVERSIZEDCANVAST-BLA', 7)) as x(sku, stock) on x.sku = v.sku;

with p as (
  insert into public.products (slug, name, description, details, category_id, price, sale_price, weight_grams, status, is_featured, tags)
  select 'city-commuter-backpack', 'City Commuter Backpack', 'Water-resistant backpack with a padded laptop sleeve.', E'Composition and care: [confirm with supplier].\nSizing: [add size guide].', c.id, 4700000, NULL, 900, 'published', false, array['travel', 'demo']
  from public.categories c join public.categories parent on parent.id = c.parent_id
  where parent.slug = 'bags' and c.slug = 'backpacks'
  returning id
)
, imgs as (insert into public.product_images (product_id, url, alt, sort_order) select p.id, x.url, x.alt, x.s from p, (values ('https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1200&q=80', 'City Commuter Backpack — view 1', 0)) as x(url, alt, s))
, v as (insert into public.product_variants (product_id, sku, size, color, color_hex, sort_order) select p.id, x.sku, x.size, x.color, x.hex, x.s from p, (values ('CITYCOMMUTERBACK-BLA', NULL, 'Black', '#1C1A1B', 0, 1), ('CITYCOMMUTERBACK-GRE', NULL, 'Grey', '#8E8C8F', 1, 1)) as x(sku, size, color, hex, s, stock) returning id, sku)
insert into public.inventory (variant_id, on_hand) select v.id, x.stock from v join (values ('CITYCOMMUTERBACK-BLA', 1), ('CITYCOMMUTERBACK-GRE', 1)) as x(sku, stock) on x.sku = v.sku;

with p as (
  insert into public.products (slug, name, description, details, category_id, price, sale_price, weight_grams, status, is_featured, tags)
  select 'crystal-evening-clutch', 'Crystal Evening Clutch', 'A sparkling box clutch with a removable chain.', E'Composition and care: [confirm with supplier].\nSizing: [add size guide].', c.id, 3900000, NULL, 300, 'published', false, array['evening', 'demo']
  from public.categories c join public.categories parent on parent.id = c.parent_id
  where parent.slug = 'bags' and c.slug = 'evening-bags'
  returning id
)
, imgs as (insert into public.product_images (product_id, url, alt, sort_order) select p.id, x.url, x.alt, x.s from p, (values ('https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?auto=format&fit=crop&w=1200&q=80', 'Crystal Evening Clutch — view 1', 0)) as x(url, alt, s))
, v as (insert into public.product_variants (product_id, sku, size, color, color_hex, sort_order) select p.id, x.sku, x.size, x.color, x.hex, x.s from p, (values ('CRYSTALEVENINGCL-SIL', NULL, 'Silver', '#C9C9CF', 0, 4), ('CRYSTALEVENINGCL-GOL', NULL, 'Gold', '#C9A45C', 1, 3)) as x(sku, size, color, hex, s, stock) returning id, sku)
insert into public.inventory (variant_id, on_hand) select v.id, x.stock from v join (values ('CRYSTALEVENINGCL-SIL', 4), ('CRYSTALEVENINGCL-GOL', 3)) as x(sku, stock) on x.sku = v.sku;

with p as (
  insert into public.products (slug, name, description, details, category_id, price, sale_price, weight_grams, status, is_featured, tags)
  select 'pointed-stiletto-pumps', 'Pointed Stiletto Pumps', 'Classic 100mm stilettos with a pointed toe and cushioned insole.', E'Composition and care: [confirm with supplier].\nSizing: [add size guide].', c.id, 4800000, NULL, 800, 'published', true, array['heels', 'demo']
  from public.categories c join public.categories parent on parent.id = c.parent_id
  where parent.slug = 'womens-shoes' and c.slug = 'heels'
  returning id
)
, imgs as (insert into public.product_images (product_id, url, alt, sort_order) select p.id, x.url, x.alt, x.s from p, (values ('https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=1200&q=80', 'Pointed Stiletto Pumps — view 1', 0), ('https://images.unsplash.com/photo-1515347619252-60a4bf4fff4f?auto=format&fit=crop&w=1200&q=80', 'Pointed Stiletto Pumps — view 2', 1)) as x(url, alt, s))
, v as (insert into public.product_variants (product_id, sku, size, color, color_hex, sort_order) select p.id, x.sku, x.size, x.color, x.hex, x.s from p, (values ('POINTEDSTILETTOP-BLA-37', '37', 'Black', '#1C1A1B', 0, 7), ('POINTEDSTILETTOP-BLA-38', '38', 'Black', '#1C1A1B', 1, 2), ('POINTEDSTILETTOP-BLA-39', '39', 'Black', '#1C1A1B', 2, 8), ('POINTEDSTILETTOP-BLA-40', '40', 'Black', '#1C1A1B', 3, 0), ('POINTEDSTILETTOP-BLA-41', '41', 'Black', '#1C1A1B', 4, 4), ('POINTEDSTILETTOP-ROS-37', '37', 'Rose', '#D94F91', 5, 6), ('POINTEDSTILETTOP-ROS-38', '38', 'Rose', '#D94F91', 6, 2), ('POINTEDSTILETTOP-ROS-39', '39', 'Rose', '#D94F91', 7, 8), ('POINTEDSTILETTOP-ROS-40', '40', 'Rose', '#D94F91', 8, 6), ('POINTEDSTILETTOP-ROS-41', '41', 'Rose', '#D94F91', 9, 6), ('POINTEDSTILETTOP-NUD-37', '37', 'Nude', '#D8B49A', 10, 8), ('POINTEDSTILETTOP-NUD-38', '38', 'Nude', '#D8B49A', 11, 0), ('POINTEDSTILETTOP-NUD-39', '39', 'Nude', '#D8B49A', 12, 5), ('POINTEDSTILETTOP-NUD-40', '40', 'Nude', '#D8B49A', 13, 8), ('POINTEDSTILETTOP-NUD-41', '41', 'Nude', '#D8B49A', 14, 7)) as x(sku, size, color, hex, s, stock) returning id, sku)
insert into public.inventory (variant_id, on_hand) select v.id, x.stock from v join (values ('POINTEDSTILETTOP-BLA-37', 7), ('POINTEDSTILETTOP-BLA-38', 2), ('POINTEDSTILETTOP-BLA-39', 8), ('POINTEDSTILETTOP-BLA-40', 0), ('POINTEDSTILETTOP-BLA-41', 4), ('POINTEDSTILETTOP-ROS-37', 6), ('POINTEDSTILETTOP-ROS-38', 2), ('POINTEDSTILETTOP-ROS-39', 8), ('POINTEDSTILETTOP-ROS-40', 6), ('POINTEDSTILETTOP-ROS-41', 6), ('POINTEDSTILETTOP-NUD-37', 8), ('POINTEDSTILETTOP-NUD-38', 0), ('POINTEDSTILETTOP-NUD-39', 5), ('POINTEDSTILETTOP-NUD-40', 8), ('POINTEDSTILETTOP-NUD-41', 7)) as x(sku, stock) on x.sku = v.sku;

with p as (
  insert into public.products (slug, name, description, details, category_id, price, sale_price, weight_grams, status, is_featured, tags)
  select 'strappy-block-heel-sandals', 'Strappy Block-Heel Sandals', 'Barely-there straps on a comfortable mid block heel.', E'Composition and care: [confirm with supplier].\nSizing: [add size guide].', c.id, 3600000, 2950000, 700, 'published', false, array['sandals', 'demo']
  from public.categories c join public.categories parent on parent.id = c.parent_id
  where parent.slug = 'womens-shoes' and c.slug = 'sandals'
  returning id
)
, imgs as (insert into public.product_images (product_id, url, alt, sort_order) select p.id, x.url, x.alt, x.s from p, (values ('https://images.unsplash.com/photo-1515347619252-60a4bf4fff4f?auto=format&fit=crop&w=1200&q=80', 'Strappy Block-Heel Sandals — view 1', 0), ('https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=1200&q=80', 'Strappy Block-Heel Sandals — view 2', 1)) as x(url, alt, s))
, v as (insert into public.product_variants (product_id, sku, size, color, color_hex, sort_order) select p.id, x.sku, x.size, x.color, x.hex, x.s from p, (values ('STRAPPYBLOCKHEEL-BLA-37', '37', 'Black', '#1C1A1B', 0, 0), ('STRAPPYBLOCKHEEL-BLA-38', '38', 'Black', '#1C1A1B', 1, 8), ('STRAPPYBLOCKHEEL-BLA-39', '39', 'Black', '#1C1A1B', 2, 0), ('STRAPPYBLOCKHEEL-BLA-40', '40', 'Black', '#1C1A1B', 3, 5), ('STRAPPYBLOCKHEEL-BLA-41', '41', 'Black', '#1C1A1B', 4, 7), ('STRAPPYBLOCKHEEL-GOL-37', '37', 'Gold', '#C9A45C', 5, 2), ('STRAPPYBLOCKHEEL-GOL-38', '38', 'Gold', '#C9A45C', 6, 5), ('STRAPPYBLOCKHEEL-GOL-39', '39', 'Gold', '#C9A45C', 7, 4), ('STRAPPYBLOCKHEEL-GOL-40', '40', 'Gold', '#C9A45C', 8, 4), ('STRAPPYBLOCKHEEL-GOL-41', '41', 'Gold', '#C9A45C', 9, 2)) as x(sku, size, color, hex, s, stock) returning id, sku)
insert into public.inventory (variant_id, on_hand) select v.id, x.stock from v join (values ('STRAPPYBLOCKHEEL-BLA-37', 0), ('STRAPPYBLOCKHEEL-BLA-38', 8), ('STRAPPYBLOCKHEEL-BLA-39', 0), ('STRAPPYBLOCKHEEL-BLA-40', 5), ('STRAPPYBLOCKHEEL-BLA-41', 7), ('STRAPPYBLOCKHEEL-GOL-37', 2), ('STRAPPYBLOCKHEEL-GOL-38', 5), ('STRAPPYBLOCKHEEL-GOL-39', 4), ('STRAPPYBLOCKHEEL-GOL-40', 4), ('STRAPPYBLOCKHEEL-GOL-41', 2)) as x(sku, stock) on x.sku = v.sku;

with p as (
  insert into public.products (slug, name, description, details, category_id, price, sale_price, weight_grams, status, is_featured, tags)
  select 'soft-ballet-flats', 'Soft Ballet Flats', 'Glove-soft ballet flats with an elasticated topline.', E'Composition and care: [confirm with supplier].\nSizing: [add size guide].', c.id, 2700000, NULL, 500, 'published', false, array['flats', 'demo']
  from public.categories c join public.categories parent on parent.id = c.parent_id
  where parent.slug = 'womens-shoes' and c.slug = 'flats'
  returning id
)
, imgs as (insert into public.product_images (product_id, url, alt, sort_order) select p.id, x.url, x.alt, x.s from p, (values ('https://images.unsplash.com/photo-1603487742131-4160ec999306?auto=format&fit=crop&w=1200&q=80', 'Soft Ballet Flats — view 1', 0)) as x(url, alt, s))
, v as (insert into public.product_variants (product_id, sku, size, color, color_hex, sort_order) select p.id, x.sku, x.size, x.color, x.hex, x.s from p, (values ('SOFTBALLETFLATS-BLA-37', '37', 'Black', '#1C1A1B', 0, 4), ('SOFTBALLETFLATS-BLA-38', '38', 'Black', '#1C1A1B', 1, 6), ('SOFTBALLETFLATS-BLA-39', '39', 'Black', '#1C1A1B', 2, 8), ('SOFTBALLETFLATS-BLA-40', '40', 'Black', '#1C1A1B', 3, 2), ('SOFTBALLETFLATS-BLA-41', '41', 'Black', '#1C1A1B', 4, 6), ('SOFTBALLETFLATS-BLU-37', '37', 'Blush', '#F4C9D9', 5, 5), ('SOFTBALLETFLATS-BLU-38', '38', 'Blush', '#F4C9D9', 6, 7), ('SOFTBALLETFLATS-BLU-39', '39', 'Blush', '#F4C9D9', 7, 1), ('SOFTBALLETFLATS-BLU-40', '40', 'Blush', '#F4C9D9', 8, 0), ('SOFTBALLETFLATS-BLU-41', '41', 'Blush', '#F4C9D9', 9, 8)) as x(sku, size, color, hex, s, stock) returning id, sku)
insert into public.inventory (variant_id, on_hand) select v.id, x.stock from v join (values ('SOFTBALLETFLATS-BLA-37', 4), ('SOFTBALLETFLATS-BLA-38', 6), ('SOFTBALLETFLATS-BLA-39', 8), ('SOFTBALLETFLATS-BLA-40', 2), ('SOFTBALLETFLATS-BLA-41', 6), ('SOFTBALLETFLATS-BLU-37', 5), ('SOFTBALLETFLATS-BLU-38', 7), ('SOFTBALLETFLATS-BLU-39', 1), ('SOFTBALLETFLATS-BLU-40', 0), ('SOFTBALLETFLATS-BLU-41', 8)) as x(sku, stock) on x.sku = v.sku;

with p as (
  insert into public.products (slug, name, description, details, category_id, price, sale_price, weight_grams, status, is_featured, tags)
  select 'knee-high-heeled-boots', 'Knee-High Heeled Boots', 'Sleek knee-high boots with an inside zip and sculpted heel.', E'Composition and care: [confirm with supplier].\nSizing: [add size guide].', c.id, 7200000, NULL, 1500, 'published', false, array['boots', 'demo']
  from public.categories c join public.categories parent on parent.id = c.parent_id
  where parent.slug = 'womens-shoes' and c.slug = 'boots'
  returning id
)
, imgs as (insert into public.product_images (product_id, url, alt, sort_order) select p.id, x.url, x.alt, x.s from p, (values ('https://images.unsplash.com/photo-1608256246200-53e635b5b65f?auto=format&fit=crop&w=1200&q=80', 'Knee-High Heeled Boots — view 1', 0)) as x(url, alt, s))
, v as (insert into public.product_variants (product_id, sku, size, color, color_hex, sort_order) select p.id, x.sku, x.size, x.color, x.hex, x.s from p, (values ('KNEEHIGHHEELEDB-BLA-37', '37', 'Black', '#1C1A1B', 0, 0), ('KNEEHIGHHEELEDB-BLA-38', '38', 'Black', '#1C1A1B', 1, 0), ('KNEEHIGHHEELEDB-BLA-39', '39', 'Black', '#1C1A1B', 2, 4), ('KNEEHIGHHEELEDB-BLA-40', '40', 'Black', '#1C1A1B', 3, 1), ('KNEEHIGHHEELEDB-BLA-41', '41', 'Black', '#1C1A1B', 4, 1), ('KNEEHIGHHEELEDB-BUR-37', '37', 'Burgundy', '#6D1F33', 5, 1), ('KNEEHIGHHEELEDB-BUR-38', '38', 'Burgundy', '#6D1F33', 6, 4), ('KNEEHIGHHEELEDB-BUR-39', '39', 'Burgundy', '#6D1F33', 7, 6), ('KNEEHIGHHEELEDB-BUR-40', '40', 'Burgundy', '#6D1F33', 8, 3), ('KNEEHIGHHEELEDB-BUR-41', '41', 'Burgundy', '#6D1F33', 9, 0)) as x(sku, size, color, hex, s, stock) returning id, sku)
insert into public.inventory (variant_id, on_hand) select v.id, x.stock from v join (values ('KNEEHIGHHEELEDB-BLA-37', 0), ('KNEEHIGHHEELEDB-BLA-38', 0), ('KNEEHIGHHEELEDB-BLA-39', 4), ('KNEEHIGHHEELEDB-BLA-40', 1), ('KNEEHIGHHEELEDB-BLA-41', 1), ('KNEEHIGHHEELEDB-BUR-37', 1), ('KNEEHIGHHEELEDB-BUR-38', 4), ('KNEEHIGHHEELEDB-BUR-39', 6), ('KNEEHIGHHEELEDB-BUR-40', 3), ('KNEEHIGHHEELEDB-BUR-41', 0)) as x(sku, stock) on x.sku = v.sku;

with p as (
  insert into public.products (slug, name, description, details, category_id, price, sale_price, weight_grams, status, is_featured, tags)
  select 'everyday-loafers', 'Everyday Loafers', 'Polished loafers with a chunky sole.', E'Composition and care: [confirm with supplier].\nSizing: [add size guide].', c.id, 3350000, NULL, 700, 'published', false, array['casual', 'demo']
  from public.categories c join public.categories parent on parent.id = c.parent_id
  where parent.slug = 'womens-shoes' and c.slug = 'casual-shoes'
  returning id
)
, imgs as (insert into public.product_images (product_id, url, alt, sort_order) select p.id, x.url, x.alt, x.s from p, (values ('https://images.unsplash.com/photo-1603487742131-4160ec999306?auto=format&fit=crop&w=1200&q=80', 'Everyday Loafers — view 1', 0)) as x(url, alt, s))
, v as (insert into public.product_variants (product_id, sku, size, color, color_hex, sort_order) select p.id, x.sku, x.size, x.color, x.hex, x.s from p, (values ('EVERYDAYLOAFERS-BLA-37', '37', 'Black', '#1C1A1B', 0, 1), ('EVERYDAYLOAFERS-BLA-38', '38', 'Black', '#1C1A1B', 1, 8), ('EVERYDAYLOAFERS-BLA-39', '39', 'Black', '#1C1A1B', 2, 1), ('EVERYDAYLOAFERS-BLA-40', '40', 'Black', '#1C1A1B', 3, 5), ('EVERYDAYLOAFERS-BLA-41', '41', 'Black', '#1C1A1B', 4, 7), ('EVERYDAYLOAFERS-TAN-37', '37', 'Tan', '#A9774E', 5, 4), ('EVERYDAYLOAFERS-TAN-38', '38', 'Tan', '#A9774E', 6, 3), ('EVERYDAYLOAFERS-TAN-39', '39', 'Tan', '#A9774E', 7, 5), ('EVERYDAYLOAFERS-TAN-40', '40', 'Tan', '#A9774E', 8, 4), ('EVERYDAYLOAFERS-TAN-41', '41', 'Tan', '#A9774E', 9, 4)) as x(sku, size, color, hex, s, stock) returning id, sku)
insert into public.inventory (variant_id, on_hand) select v.id, x.stock from v join (values ('EVERYDAYLOAFERS-BLA-37', 1), ('EVERYDAYLOAFERS-BLA-38', 8), ('EVERYDAYLOAFERS-BLA-39', 1), ('EVERYDAYLOAFERS-BLA-40', 5), ('EVERYDAYLOAFERS-BLA-41', 7), ('EVERYDAYLOAFERS-TAN-37', 4), ('EVERYDAYLOAFERS-TAN-38', 3), ('EVERYDAYLOAFERS-TAN-39', 5), ('EVERYDAYLOAFERS-TAN-40', 4), ('EVERYDAYLOAFERS-TAN-41', 4)) as x(sku, stock) on x.sku = v.sku;

with p as (
  insert into public.products (slug, name, description, details, category_id, price, sale_price, weight_grams, status, is_featured, tags)
  select 'court-classic-sneakers-men', 'Court Classic Sneakers', 'Minimal low-top court sneakers with a cushioned footbed.', E'Composition and care: [confirm with supplier].\nSizing: [add size guide].', c.id, 4500000, NULL, 1000, 'published', true, array['sneakers', 'demo']
  from public.categories c join public.categories parent on parent.id = c.parent_id
  where parent.slug = 'sneakers' and c.slug = 'mens-sneakers'
  returning id
)
, imgs as (insert into public.product_images (product_id, url, alt, sort_order) select p.id, x.url, x.alt, x.s from p, (values ('https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=1200&q=80', 'Court Classic Sneakers — view 1', 0), ('https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=1200&q=80', 'Court Classic Sneakers — view 2', 1)) as x(url, alt, s))
, v as (insert into public.product_variants (product_id, sku, size, color, color_hex, sort_order) select p.id, x.sku, x.size, x.color, x.hex, x.s from p, (values ('COURTCLASSICSNEA-WHI-41', '41', 'White', '#F7F5F2', 0, 1), ('COURTCLASSICSNEA-WHI-42', '42', 'White', '#F7F5F2', 1, 4), ('COURTCLASSICSNEA-WHI-43', '43', 'White', '#F7F5F2', 2, 3), ('COURTCLASSICSNEA-WHI-44', '44', 'White', '#F7F5F2', 3, 6), ('COURTCLASSICSNEA-WHI-45', '45', 'White', '#F7F5F2', 4, 5), ('COURTCLASSICSNEA-BLA-41', '41', 'Black', '#1C1A1B', 5, 5), ('COURTCLASSICSNEA-BLA-42', '42', 'Black', '#1C1A1B', 6, 0), ('COURTCLASSICSNEA-BLA-43', '43', 'Black', '#1C1A1B', 7, 8), ('COURTCLASSICSNEA-BLA-44', '44', 'Black', '#1C1A1B', 8, 4), ('COURTCLASSICSNEA-BLA-45', '45', 'Black', '#1C1A1B', 9, 2)) as x(sku, size, color, hex, s, stock) returning id, sku)
insert into public.inventory (variant_id, on_hand) select v.id, x.stock from v join (values ('COURTCLASSICSNEA-WHI-41', 1), ('COURTCLASSICSNEA-WHI-42', 4), ('COURTCLASSICSNEA-WHI-43', 3), ('COURTCLASSICSNEA-WHI-44', 6), ('COURTCLASSICSNEA-WHI-45', 5), ('COURTCLASSICSNEA-BLA-41', 5), ('COURTCLASSICSNEA-BLA-42', 0), ('COURTCLASSICSNEA-BLA-43', 8), ('COURTCLASSICSNEA-BLA-44', 4), ('COURTCLASSICSNEA-BLA-45', 2)) as x(sku, stock) on x.sku = v.sku;

with p as (
  insert into public.products (slug, name, description, details, category_id, price, sale_price, weight_grams, status, is_featured, tags)
  select 'platform-sneakers-women', 'Platform Sneakers', 'Clean platform sneakers that add height without compromise.', E'Composition and care: [confirm with supplier].\nSizing: [add size guide].', c.id, 4300000, 3750000, 900, 'published', true, array['sneakers', 'demo']
  from public.categories c join public.categories parent on parent.id = c.parent_id
  where parent.slug = 'sneakers' and c.slug = 'womens-sneakers'
  returning id
)
, imgs as (insert into public.product_images (product_id, url, alt, sort_order) select p.id, x.url, x.alt, x.s from p, (values ('https://images.unsplash.com/photo-1560769629-975ec94e6a86?auto=format&fit=crop&w=1200&q=80', 'Platform Sneakers — view 1', 0), ('https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=1200&q=80', 'Platform Sneakers — view 2', 1)) as x(url, alt, s))
, v as (insert into public.product_variants (product_id, sku, size, color, color_hex, sort_order) select p.id, x.sku, x.size, x.color, x.hex, x.s from p, (values ('PLATFORMSNEAKERS-WHI-37', '37', 'White', '#F7F5F2', 0, 6), ('PLATFORMSNEAKERS-WHI-38', '38', 'White', '#F7F5F2', 1, 3), ('PLATFORMSNEAKERS-WHI-39', '39', 'White', '#F7F5F2', 2, 6), ('PLATFORMSNEAKERS-WHI-40', '40', 'White', '#F7F5F2', 3, 2), ('PLATFORMSNEAKERS-WHI-41', '41', 'White', '#F7F5F2', 4, 4), ('PLATFORMSNEAKERS-BLU-37', '37', 'Blush', '#F4C9D9', 5, 5), ('PLATFORMSNEAKERS-BLU-38', '38', 'Blush', '#F4C9D9', 6, 2), ('PLATFORMSNEAKERS-BLU-39', '39', 'Blush', '#F4C9D9', 7, 3), ('PLATFORMSNEAKERS-BLU-40', '40', 'Blush', '#F4C9D9', 8, 6), ('PLATFORMSNEAKERS-BLU-41', '41', 'Blush', '#F4C9D9', 9, 7)) as x(sku, size, color, hex, s, stock) returning id, sku)
insert into public.inventory (variant_id, on_hand) select v.id, x.stock from v join (values ('PLATFORMSNEAKERS-WHI-37', 6), ('PLATFORMSNEAKERS-WHI-38', 3), ('PLATFORMSNEAKERS-WHI-39', 6), ('PLATFORMSNEAKERS-WHI-40', 2), ('PLATFORMSNEAKERS-WHI-41', 4), ('PLATFORMSNEAKERS-BLU-37', 5), ('PLATFORMSNEAKERS-BLU-38', 2), ('PLATFORMSNEAKERS-BLU-39', 3), ('PLATFORMSNEAKERS-BLU-40', 6), ('PLATFORMSNEAKERS-BLU-41', 7)) as x(sku, stock) on x.sku = v.sku;

with p as (
  insert into public.products (slug, name, description, details, category_id, price, sale_price, weight_grams, status, is_featured, tags)
  select 'retro-runner-unisex', 'Retro Runner', 'A retro-inspired runner with suede overlays and a responsive sole.', E'Composition and care: [confirm with supplier].\nSizing: [add size guide].', c.id, 5200000, NULL, 950, 'published', true, array['sneakers', 'demo']
  from public.categories c join public.categories parent on parent.id = c.parent_id
  where parent.slug = 'sneakers' and c.slug = 'unisex-sneakers'
  returning id
)
, imgs as (insert into public.product_images (product_id, url, alt, sort_order) select p.id, x.url, x.alt, x.s from p, (values ('https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80', 'Retro Runner — view 1', 0), ('https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=1200&q=80', 'Retro Runner — view 2', 1)) as x(url, alt, s))
, v as (insert into public.product_variants (product_id, sku, size, color, color_hex, sort_order) select p.id, x.sku, x.size, x.color, x.hex, x.s from p, (values ('RETRORUNNERUNISE-RED-38', '38', 'Red', '#C0392B', 0, 5), ('RETRORUNNERUNISE-RED-39', '39', 'Red', '#C0392B', 1, 8), ('RETRORUNNERUNISE-RED-40', '40', 'Red', '#C0392B', 2, 4), ('RETRORUNNERUNISE-RED-41', '41', 'Red', '#C0392B', 3, 8), ('RETRORUNNERUNISE-RED-42', '42', 'Red', '#C0392B', 4, 4), ('RETRORUNNERUNISE-RED-43', '43', 'Red', '#C0392B', 5, 1), ('RETRORUNNERUNISE-RED-44', '44', 'Red', '#C0392B', 6, 4), ('RETRORUNNERUNISE-WHI-38', '38', 'White', '#F7F5F2', 7, 0), ('RETRORUNNERUNISE-WHI-39', '39', 'White', '#F7F5F2', 8, 3), ('RETRORUNNERUNISE-WHI-40', '40', 'White', '#F7F5F2', 9, 6), ('RETRORUNNERUNISE-WHI-41', '41', 'White', '#F7F5F2', 10, 6), ('RETRORUNNERUNISE-WHI-42', '42', 'White', '#F7F5F2', 11, 8), ('RETRORUNNERUNISE-WHI-43', '43', 'White', '#F7F5F2', 12, 6), ('RETRORUNNERUNISE-WHI-44', '44', 'White', '#F7F5F2', 13, 2)) as x(sku, size, color, hex, s, stock) returning id, sku)
insert into public.inventory (variant_id, on_hand) select v.id, x.stock from v join (values ('RETRORUNNERUNISE-RED-38', 5), ('RETRORUNNERUNISE-RED-39', 8), ('RETRORUNNERUNISE-RED-40', 4), ('RETRORUNNERUNISE-RED-41', 8), ('RETRORUNNERUNISE-RED-42', 4), ('RETRORUNNERUNISE-RED-43', 1), ('RETRORUNNERUNISE-RED-44', 4), ('RETRORUNNERUNISE-WHI-38', 0), ('RETRORUNNERUNISE-WHI-39', 3), ('RETRORUNNERUNISE-WHI-40', 6), ('RETRORUNNERUNISE-WHI-41', 6), ('RETRORUNNERUNISE-WHI-42', 8), ('RETRORUNNERUNISE-WHI-43', 6), ('RETRORUNNERUNISE-WHI-44', 2)) as x(sku, stock) on x.sku = v.sku;

with p as (
  insert into public.products (slug, name, description, details, category_id, price, sale_price, weight_grams, status, is_featured, tags)
  select 'canvas-low-tops', 'Canvas Low-Tops', 'Easy canvas low-tops for everyday wear.', E'Composition and care: [confirm with supplier].\nSizing: [add size guide].', c.id, 2400000, NULL, 800, 'published', false, array['sneakers', 'demo']
  from public.categories c join public.categories parent on parent.id = c.parent_id
  where parent.slug = 'sneakers' and c.slug = 'casual-sneakers'
  returning id
)
, imgs as (insert into public.product_images (product_id, url, alt, sort_order) select p.id, x.url, x.alt, x.s from p, (values ('https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=1200&q=80', 'Canvas Low-Tops — view 1', 0)) as x(url, alt, s))
, v as (insert into public.product_variants (product_id, sku, size, color, color_hex, sort_order) select p.id, x.sku, x.size, x.color, x.hex, x.s from p, (values ('CANVASLOWTOPS-BLA-38', '38', 'Black', '#1C1A1B', 0, 8), ('CANVASLOWTOPS-BLA-39', '39', 'Black', '#1C1A1B', 1, 5), ('CANVASLOWTOPS-BLA-40', '40', 'Black', '#1C1A1B', 2, 5), ('CANVASLOWTOPS-BLA-41', '41', 'Black', '#1C1A1B', 3, 6), ('CANVASLOWTOPS-BLA-42', '42', 'Black', '#1C1A1B', 4, 1), ('CANVASLOWTOPS-BLA-43', '43', 'Black', '#1C1A1B', 5, 1), ('CANVASLOWTOPS-BLA-44', '44', 'Black', '#1C1A1B', 6, 8), ('CANVASLOWTOPS-WHI-38', '38', 'White', '#F7F5F2', 7, 2), ('CANVASLOWTOPS-WHI-39', '39', 'White', '#F7F5F2', 8, 5), ('CANVASLOWTOPS-WHI-40', '40', 'White', '#F7F5F2', 9, 4), ('CANVASLOWTOPS-WHI-41', '41', 'White', '#F7F5F2', 10, 0), ('CANVASLOWTOPS-WHI-42', '42', 'White', '#F7F5F2', 11, 1), ('CANVASLOWTOPS-WHI-43', '43', 'White', '#F7F5F2', 12, 8), ('CANVASLOWTOPS-WHI-44', '44', 'White', '#F7F5F2', 13, 4), ('CANVASLOWTOPS-ROS-38', '38', 'Rose', '#D94F91', 14, 1), ('CANVASLOWTOPS-ROS-39', '39', 'Rose', '#D94F91', 15, 4), ('CANVASLOWTOPS-ROS-40', '40', 'Rose', '#D94F91', 16, 7), ('CANVASLOWTOPS-ROS-41', '41', 'Rose', '#D94F91', 17, 5), ('CANVASLOWTOPS-ROS-42', '42', 'Rose', '#D94F91', 18, 8), ('CANVASLOWTOPS-ROS-43', '43', 'Rose', '#D94F91', 19, 6), ('CANVASLOWTOPS-ROS-44', '44', 'Rose', '#D94F91', 20, 6)) as x(sku, size, color, hex, s, stock) returning id, sku)
insert into public.inventory (variant_id, on_hand) select v.id, x.stock from v join (values ('CANVASLOWTOPS-BLA-38', 8), ('CANVASLOWTOPS-BLA-39', 5), ('CANVASLOWTOPS-BLA-40', 5), ('CANVASLOWTOPS-BLA-41', 6), ('CANVASLOWTOPS-BLA-42', 1), ('CANVASLOWTOPS-BLA-43', 1), ('CANVASLOWTOPS-BLA-44', 8), ('CANVASLOWTOPS-WHI-38', 2), ('CANVASLOWTOPS-WHI-39', 5), ('CANVASLOWTOPS-WHI-40', 4), ('CANVASLOWTOPS-WHI-41', 0), ('CANVASLOWTOPS-WHI-42', 1), ('CANVASLOWTOPS-WHI-43', 8), ('CANVASLOWTOPS-WHI-44', 4), ('CANVASLOWTOPS-ROS-38', 1), ('CANVASLOWTOPS-ROS-39', 4), ('CANVASLOWTOPS-ROS-40', 7), ('CANVASLOWTOPS-ROS-41', 5), ('CANVASLOWTOPS-ROS-42', 8), ('CANVASLOWTOPS-ROS-43', 6), ('CANVASLOWTOPS-ROS-44', 6)) as x(sku, stock) on x.sku = v.sku;

with p as (
  insert into public.products (slug, name, description, details, category_id, price, sale_price, weight_grams, status, is_featured, tags)
  select 'performance-knit-trainers', 'Performance Knit Trainers', 'Lightweight knit trainers built for movement.', E'Composition and care: [confirm with supplier].\nSizing: [add size guide].', c.id, 4900000, NULL, 850, 'published', false, array['sneakers', 'sport', 'demo']
  from public.categories c join public.categories parent on parent.id = c.parent_id
  where parent.slug = 'sneakers' and c.slug = 'sport-inspired-sneakers'
  returning id
)
, imgs as (insert into public.product_images (product_id, url, alt, sort_order) select p.id, x.url, x.alt, x.s from p, (values ('https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=1200&q=80', 'Performance Knit Trainers — view 1', 0), ('https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80', 'Performance Knit Trainers — view 2', 1)) as x(url, alt, s))
, v as (insert into public.product_variants (product_id, sku, size, color, color_hex, sort_order) select p.id, x.sku, x.size, x.color, x.hex, x.s from p, (values ('PERFORMANCEKNITT-BLA-38', '38', 'Black', '#1C1A1B', 0, 8), ('PERFORMANCEKNITT-BLA-39', '39', 'Black', '#1C1A1B', 1, 8), ('PERFORMANCEKNITT-BLA-40', '40', 'Black', '#1C1A1B', 2, 8), ('PERFORMANCEKNITT-BLA-41', '41', 'Black', '#1C1A1B', 3, 0), ('PERFORMANCEKNITT-BLA-42', '42', 'Black', '#1C1A1B', 4, 8), ('PERFORMANCEKNITT-BLA-43', '43', 'Black', '#1C1A1B', 5, 7), ('PERFORMANCEKNITT-BLA-44', '44', 'Black', '#1C1A1B', 6, 6), ('PERFORMANCEKNITT-GRE-38', '38', 'Grey', '#8E8C8F', 7, 6), ('PERFORMANCEKNITT-GRE-39', '39', 'Grey', '#8E8C8F', 8, 8), ('PERFORMANCEKNITT-GRE-40', '40', 'Grey', '#8E8C8F', 9, 1), ('PERFORMANCEKNITT-GRE-41', '41', 'Grey', '#8E8C8F', 10, 1), ('PERFORMANCEKNITT-GRE-42', '42', 'Grey', '#8E8C8F', 11, 2), ('PERFORMANCEKNITT-GRE-43', '43', 'Grey', '#8E8C8F', 12, 7), ('PERFORMANCEKNITT-GRE-44', '44', 'Grey', '#8E8C8F', 13, 1)) as x(sku, size, color, hex, s, stock) returning id, sku)
insert into public.inventory (variant_id, on_hand) select v.id, x.stock from v join (values ('PERFORMANCEKNITT-BLA-38', 8), ('PERFORMANCEKNITT-BLA-39', 8), ('PERFORMANCEKNITT-BLA-40', 8), ('PERFORMANCEKNITT-BLA-41', 0), ('PERFORMANCEKNITT-BLA-42', 8), ('PERFORMANCEKNITT-BLA-43', 7), ('PERFORMANCEKNITT-BLA-44', 6), ('PERFORMANCEKNITT-GRE-38', 6), ('PERFORMANCEKNITT-GRE-39', 8), ('PERFORMANCEKNITT-GRE-40', 1), ('PERFORMANCEKNITT-GRE-41', 1), ('PERFORMANCEKNITT-GRE-42', 2), ('PERFORMANCEKNITT-GRE-43', 7), ('PERFORMANCEKNITT-GRE-44', 1)) as x(sku, stock) on x.sku = v.sku;

-- Featured collections (demo)
insert into public.collections (slug, name, description, image_url, is_featured, sort_order) values
  ('the-evening-edit', 'The Evening Edit', 'Satin, sparkle and sharp heels for nights that matter.', 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=1400&q=80', true, 1),
  ('off-duty-attitude', 'Off-Duty Attitude', 'Relaxed layers and clean sneakers for every day.', 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=1400&q=80', true, 2);
insert into public.collection_products (collection_id, product_id, sort_order)
select c.id, p.id, row_number() over (partition by c.id order by p.name)
from public.collections c join public.products p on (
  (c.slug = 'the-evening-edit' and p.slug in ('satin-slip-midi-dress','pleated-satin-midi-skirt','quilted-chain-shoulder-bag','crystal-evening-clutch','pointed-stiletto-pumps','strappy-block-heel-sandals','two-piece-blazer-set'))
  or (c.slug = 'off-duty-attitude' and p.slug in ('essential-heavyweight-tee','studio-fleece-hoodie','ribbed-lounge-set','oversized-canvas-tote','court-classic-sneakers-men','platform-sneakers-women','retro-runner-unisex','weekend-chino-shorts'))
);

-- Category imagery (demo)
update public.categories set image_url = x.url from (values
  ('men', 'https://images.unsplash.com/photo-1490114538077-0a7f8cb49891?auto=format&fit=crop&w=1200&q=80'),
  ('women', 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=80'),
  ('bags', 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1200&q=80'),
  ('womens-shoes', 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=1200&q=80'),
  ('sneakers', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80')
) as x(slug, url) where categories.slug = x.slug and categories.parent_id is null;

