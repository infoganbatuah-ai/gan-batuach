-- Review only. Requires separately qualified roles, table policies and server credential.
begin;
do $$ begin raise exception 'REVIEW ONLY: scoped writer must be qualified before use'; end $$;
-- BEGIN WRITER CANDIDATE
do $role_checks$
begin
  if (select count(*) from pg_catalog.pg_roles where rolname in ('observer_site_save_executor','observer_site_save_caller')
    and not (rolsuper or rolbypassrls or rolcanlogin or rolcreaterole or rolcreatedb or rolreplication)) <> 2
    or exists(select 1 from pg_catalog.pg_auth_members m join pg_catalog.pg_roles r on r.oid=m.member
      where r.rolname in ('observer_site_save_executor','observer_site_save_caller'))
    or exists(select 1 from pg_catalog.pg_roles r where r.rolname in ('anon','authenticated','service_role') and
      (pg_catalog.pg_has_role(r.oid,'observer_site_save_executor','MEMBER') or pg_catalog.pg_has_role(r.oid,'observer_site_save_caller','MEMBER')))
  then raise exception 'UNSAFE_WRITER_ROLE_CONFIGURATION'; end if;
end;
$role_checks$;
create schema observer_site_save_private;
revoke all on schema observer_site_save_private from public,anon,authenticated,service_role;
create table observer_site_save_private.receipts (
  actor uuid not null, submission uuid not null, request_digest text not null,
  site_id uuid not null references public.observer_sites(id), result jsonb not null,
  primary key(actor,submission)
);
revoke all on observer_site_save_private.receipts from public,anon,authenticated,service_role;
grant usage on schema observer_site_save_private to observer_site_save_executor;
grant select,insert on observer_site_save_private.receipts to observer_site_save_executor;
grant execute on function public.save_observer_onboarding_atomic(uuid,uuid,jsonb,text,jsonb) to observer_site_save_executor;

-- Caller is a server-only credential with exactly this RPC. Owner is a distinct
-- non-login, non-superuser, non-BYPASSRLS role and never a Supabase API role.
create function public.submit_observer_site_save(
  verified_actor uuid, verified_session uuid, token_exp bigint, submission uuid, request_digest text,
  target_site uuid, target_package uuid, site_patch jsonb, schedule_mode_input text, monitoring_targets jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  previous_claims text := current_setting('request.jwt.claims',true);
  receipt observer_site_save_private.receipts%rowtype;
  saved jsonb;
begin
  if current_setting('role',true) is distinct from 'observer_site_save_caller'
    or previous_claims::jsonb->>'role' is distinct from 'observer_site_save_caller'
    or verified_actor is null or verified_session is null or token_exp is null
    or token_exp<=extract(epoch from clock_timestamp()) then raise insufficient_privilege; end if;
  if submission is null or request_digest is null or request_digest !~ '^[0-9a-f]{64}$' then
    raise check_violation using message='INVALID_SUBMISSION'; end if;
  -- Only the restricted backend supplies Auth-verified claims. The canonical
  -- session check independently binds user, session id and revocation in the DB.
  perform set_config('request.jwt.claims',jsonb_build_object('sub',verified_actor,'session_id',verified_session,
    'role','authenticated','exp',token_exp)::text,true);
  perform 1 from public.digital_observer_accounts a join public.profiles p on p.id=a.profile_id
    where a.profile_id=verified_actor and p.active and a.status in ('onboarding','trial','active') for update of a;
  if not found or auth.uid() is distinct from verified_actor
    or public.digital_observer_current_session_active() is not true
    or token_exp<=extract(epoch from clock_timestamp()) then raise insufficient_privilege; end if;
  -- Serialize with the underlying save and check an existing receipt BEFORE quotas or trial eligibility.
  select r.* into receipt from observer_site_save_private.receipts r
    where r.actor=verified_actor and r.submission=submit_observer_site_save.submission;
  if found then
    if receipt.request_digest<>request_digest or (target_site is not null and target_site<>receipt.site_id) then
      raise exception using errcode='P0440',message='SUBMISSION_CONFLICT'; end if;
    perform 1 from public.observer_sites where id=receipt.site_id and owner_profile_id=verified_actor
      and garden_id is null and site_type<>'kindergarten' for share;
    if not found then raise insufficient_privilege; end if;
    saved := receipt.result;
  else
    saved := public.save_observer_onboarding_atomic(target_site,target_package,site_patch,schedule_mode_input,monitoring_targets);
    insert into observer_site_save_private.receipts values
      (verified_actor,submission,request_digest,(saved#>>'{site,id}')::uuid,saved);
  end if;
  perform set_config('request.jwt.claims',previous_claims,true);
  return saved;
end;
$$;
alter function public.submit_observer_site_save(uuid,uuid,bigint,uuid,text,uuid,uuid,jsonb,text,jsonb) owner to observer_site_save_executor;
revoke all on function public.submit_observer_site_save(uuid,uuid,bigint,uuid,text,uuid,uuid,jsonb,text,jsonb)
  from public,anon,authenticated,service_role;
grant execute on function public.submit_observer_site_save(uuid,uuid,bigint,uuid,text,uuid,uuid,jsonb,text,jsonb)
  to observer_site_save_caller;
commit;
