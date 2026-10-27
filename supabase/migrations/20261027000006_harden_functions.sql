-- Trigger-only function: must not be callable through the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Pin search_path on helper functions (Supabase linter 0011).
alter function public.set_updated_at() set search_path = public;
alter function public.tags_to_text(text[]) set search_path = public;
alter function public.products_set_published_at() set search_path = public;
alter function public.order_status_transition_allowed(public.order_status, public.order_status, boolean) set search_path = public;
