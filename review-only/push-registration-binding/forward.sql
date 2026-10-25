-- REVIEW ONLY / NOT A MIGRATION / NEVER RUN AS A FILE.
-- A future authorized reviewer must extract, qualify and version the candidate.
begin;
do $$ begin raise exception 'REVIEW_ONLY_PUSH_BINDING_MUST_NOT_RUN'; end $$;

-- Source-grounded candidate. Do not remove the guard until actual deployed
-- catalog, legacy rows, service_role behavior and isolated PG/RLS tests pass.
-- The table and current policy originate in 20260602005000; revoked_at and
-- disabled_reason originate in 20260606009000; the session function is in
-- 20261023161928. None of those files proves application in a live database.

-- Blocking preflight: abort without changing, deleting or transferring rows.
do $$
begin
  if to_regclass('public.push_device_tokens') is null
     or to_regclass('public.observer_sites') is null
     or to_regclass('public.observer_site_memberships') is null
     or to_regprocedure('public.digital_observer_current_session_active()') is null then
    raise exception 'PUSH_BINDING_SCHEMA_NOT_VERIFIED';
  end if;

  if exists (
    select 1 from public.push_device_tokens t
    where t.is_active and (
      t.metadata ? 'observer_site_id'
      or t.metadata->>'source' in ('digital_observer_native','digital_observer_fcm')
    ) and (
      (t.metadata->>'source') is null
      or t.metadata->>'source' not in ('digital_observer_native','digital_observer_fcm')
      or t.metadata->>'observer_site_id' is null
      or t.metadata->>'observer_site_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or t.device_id is null or btrim(t.device_id) = ''
      or not exists (
        select 1 from public.observer_sites s
        where s.id = case
          when t.metadata->>'observer_site_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then (t.metadata->>'observer_site_id')::uuid else null end
          and s.active and s.site_type <> 'kindergarten' and s.garden_id is null
      )
    )
  ) then
    raise exception 'PUSH_BINDING_LEGACY_ROWS_REQUIRE_OWNER_REVIEW';
  end if;

  if exists (
    select 1 from public.push_device_tokens t
    where t.is_active and t.metadata->>'source' in
      ('digital_observer_native','digital_observer_fcm')
    group by t.profile_id, t.device_id having count(*) > 1
  ) then
    raise exception 'PUSH_BINDING_ACTIVE_INSTALLATION_CONFLICT';
  end if;
end $$;

-- The predicate is deliberately Observer-only. Shared Management rows are
-- unchanged. Existing global uniqueness of device_token still applies.
create unique index push_tokens_observer_active_installation_uq
  on public.push_device_tokens (profile_id, device_id)
  where is_active and device_id is not null
    and metadata->>'source' in ('digital_observer_native','digital_observer_fcm');

-- A trigger is needed because current authenticated/admin RLS is permissive
-- for UPDATE; an index alone does not stop same-token ownership mutation.
-- SECURITY DEFINER reads only the precise site/profile relationships. It is
-- not an application RPC and grants no public Data API mutation privilege.
create function public.guard_observer_push_token_binding()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  old_observer boolean := false;
  new_observer boolean := false;
  actor uuid := auth.uid();
  requested_site uuid;
  actor_owns_site boolean;
begin
  if tg_op <> 'INSERT' then
    old_observer := old.metadata ? 'observer_site_id'
      or old.metadata->>'source' in ('digital_observer_native','digital_observer_fcm');
  end if;
  if tg_op <> 'DELETE' then
    new_observer := new.metadata ? 'observer_site_id'
      or new.metadata->>'source' in ('digital_observer_native','digital_observer_fcm');
  end if;

  if tg_op = 'DELETE' then
    if old_observer then raise exception 'OBSERVER_PUSH_DELETE_DENIED'; end if;
    return old;
  end if;
  if not old_observer and not new_observer then return new; end if;

  -- A generic token cannot be relabeled as Observer, or vice versa.
  if tg_op = 'UPDATE' and old_observer <> new_observer then
    raise exception 'OBSERVER_PUSH_SOURCE_IMMUTABLE';
  end if;
  if new_observer and (
    (new.metadata->>'source') is null
    or new.metadata->>'source' not in ('digital_observer_native','digital_observer_fcm')
    or new.metadata->>'observer_site_id' is null
    or new.metadata->>'observer_site_id' !~*
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or new.device_id is null or btrim(new.device_id) = ''
    or length(new.device_id) > 200
  ) then
    raise exception 'OBSERVER_PUSH_BINDING_INVALID';
  end if;

  -- Service-role delivery may disable an invalid provider token, but may not
  -- insert, reactivate, transfer, or alter binding/liveness. Confirm this
  -- signed role provenance in future isolated Data API tests before applying.
  if tg_op = 'UPDATE' and old_observer and old.is_active and not new.is_active
     and auth.role() = 'service_role'
     and new.disabled_reason = 'provider_invalid_token'
     and new.revoked_at is not null
     and (to_jsonb(new) - array['is_active','disabled_reason','revoked_at','updated_at','last_error'])
       = (to_jsonb(old) - array['is_active','disabled_reason','revoked_at','updated_at','last_error']) then
    return new;
  end if;

  if auth.role() is distinct from 'authenticated'
     or actor is null or not public.digital_observer_current_session_active()
     or not exists (select 1 from public.profiles p
                    where p.id = actor and p.active) then
    raise exception 'OBSERVER_PUSH_SESSION_DENIED';
  end if;
  if tg_op = 'INSERT' then
    if actor <> new.profile_id or not new.is_active
       or new.revoked_at is not null or new.disabled_reason is not null
       or not exists (select 1 from public.profiles p
                      where p.id = actor and p.role::text = new.role) then
      raise exception 'OBSERVER_PUSH_INSERT_DENIED';
    end if;
  else
    if actor <> old.profile_id then raise exception 'OBSERVER_PUSH_OWNER_DENIED'; end if;
    if not old.is_active or new.is_active and not old.is_active then
      raise exception 'OBSERVER_PUSH_REACTIVATION_DENIED';
    end if;
    if old.is_active and not new.is_active then
      -- Own exact row may be revoked after Site authorization is lost.
      if new.disabled_reason is distinct from 'unregistered_by_user' or new.revoked_at is null
         or (to_jsonb(new) - array['is_active','disabled_reason','revoked_at','updated_at'])
           <> (to_jsonb(old) - array['is_active','disabled_reason','revoked_at','updated_at']) then
        raise exception 'OBSERVER_PUSH_REVOKE_SCOPE_DENIED';
      end if;
      return new;
    end if;
    if (to_jsonb(new) - array['app_version','last_seen_at','updated_at'])
       <> (to_jsonb(old) - array['app_version','last_seen_at','updated_at']) then
      raise exception 'OBSERVER_PUSH_REPLAY_BINDING_DENIED';
    end if;
  end if;

  -- A client-supplied metadata label is not authority. Only an exact active
  -- site owner or active owner/admin membership qualifies; global is_admin()
  -- and Gan Batuach roles are intentionally not accepted. Organization-only
  -- grants require a later verified permission contract; they fail closed.
  requested_site := (new.metadata->>'observer_site_id')::uuid;
  select exists (
    select 1 from public.observer_sites s
    where s.id = requested_site and s.active
      and s.site_type <> 'kindergarten' and s.garden_id is null and (
      s.owner_profile_id = actor or exists (
        select 1 from public.observer_site_memberships m
        where m.observer_site_id = s.id and m.profile_id = actor
          and m.active and m.member_role in ('owner','admin','operator')
      )
    )
  ) into actor_owns_site;
  if not actor_owns_site then raise exception 'OBSERVER_PUSH_SITE_DENIED'; end if;
  return new;
end $$;

revoke all on function public.guard_observer_push_token_binding()
  from public, anon, authenticated, service_role;
create trigger observer_push_binding_guard
  before insert or update or delete on public.push_device_tokens
  for each row execute function public.guard_observer_push_token_binding();

-- No RLS, role, default privilege, or shared Management contract is changed.
commit;
