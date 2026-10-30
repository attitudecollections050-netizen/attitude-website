-- Korean (한국어) joins the store languages. Stores that still have the original seven
-- languages enabled get Korean too; a store that chose its own list is left as it is.
update public.store_settings
   set value = jsonb_set(value, '{enabled_locales}', (value -> 'enabled_locales') || '["ko"]'::jsonb)
 where key = 'intl'
   and not ((value -> 'enabled_locales') ? 'ko')
   and (value -> 'enabled_locales') @> '["en", "fr", "es", "pt", "ar", "de", "zh"]'::jsonb
   and jsonb_array_length(value -> 'enabled_locales') = 7;
