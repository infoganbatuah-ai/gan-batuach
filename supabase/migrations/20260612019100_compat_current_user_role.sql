-- Compatibility helper for migrations that still reference current_user_role().
create or replace function public.current_user_role()
returns text
language sql
stable
set search_path = public
as $$
  select coalesce(public.current_role()::text, 'public');
$$;

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.current_user_role() to service_role;

