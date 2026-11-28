-- PUSH44: enforce the existing Auth session lifetime on protected Observer reads.
-- Owner: Product security. No new personal data, table, retention or log volume.
-- Sensitivity: returns one boolean; never exposes Auth rows, tokens or identifiers.
-- Query: one indexed auth.sessions primary-key lookup per protected request.
-- Recovery: revert dependent application code before dropping this function.
-- Production application requires a separately authorized release; no live activation.
create or replace function public.digital_observer_current_session_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from auth.sessions s
    where s.id = case
      when (auth.jwt()->>'session_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      then (auth.jwt()->>'session_id')::uuid
      else null
    end
    and s.user_id = auth.uid()
    and (s.not_after is null or s.not_after > pg_catalog.statement_timestamp())
  );
$$;
revoke all on function public.digital_observer_current_session_active() from public, anon;
grant execute on function public.digital_observer_current_session_active() to authenticated;
comment on function public.digital_observer_current_session_active() is
  'Current authenticated caller only: existing Auth session exists and has not expired. No parameters, no row disclosure, no mutation.';
