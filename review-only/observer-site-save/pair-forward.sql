-- Review only. The isolated harness removes the stop, retaining the transaction.
begin;
do $$ begin raise exception 'REVIEW ONLY: isolated pair qualification required'; end $$;
-- BEGIN PAIR FORWARD
-- Verify the #669 boundary before borrowing its exact, non-grantable EXECUTE.
create function observer_site_save_private.check_pair_acl(installed boolean)
returns void language plpgsql security invoker set search_path='' as $$
declare
  generic regprocedure := 'public.submit_observer_site_save(uuid,uuid,bigint,uuid,text,uuid,uuid,jsonb,text,jsonb)'::regprocedure;
  core regprocedure := 'public.save_observer_onboarding_atomic(uuid,uuid,jsonb,text,jsonb)'::regprocedure;
  src regclass := 'public.digital_observer_camera_sources'::regclass;
  caller_role oid := 'observer_site_save_caller'::regrole;
  executor_role oid := 'observer_site_save_executor'::regrole;
  pair_rpc regprocedure;
  col record;
  priv text;
  expected boolean;
begin
  if exists (select from pg_roles where oid in (caller_role,executor_role) and
      (rolsuper or rolbypassrls or rolcanlogin or rolcreaterole or rolcreatedb or rolreplication))
    or exists (select from pg_auth_members where member in (caller_role,executor_role))
    or exists (select from pg_roles where rolname in ('anon','authenticated','service_role') and
      (pg_has_role(oid,caller_role,'MEMBER') or pg_has_role(oid,executor_role,'MEMBER')
       or has_function_privilege(oid,generic,'EXECUTE') or has_function_privilege(oid,core,'EXECUTE')))
    or exists (select from pg_proc where oid=generic and (proowner<>executor_role or not prosecdef))
    or has_function_privilege(caller_role,core,'EXECUTE')
    or not has_function_privilege(executor_role,core,'EXECUTE')
    or has_function_privilege(caller_role,generic,'EXECUTE') <> (not installed)
    or (select count(*) from pg_proc p, lateral aclexplode(p.proacl) a
      where p.oid=generic and a.grantee=caller_role and a.grantor=executor_role
        and a.privilege_type='EXECUTE' and not a.is_grantable) <> (not installed)::int
    or exists (select from pg_class where oid=src and (not relrowsecurity or relowner in (caller_role,executor_role)))
    or has_table_privilege(caller_role,src,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    or has_table_privilege(executor_role,src,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    or has_any_column_privilege(caller_role,src,'SELECT,INSERT,UPDATE,REFERENCES')
  then raise exception 'UNEXPECTED_PAIR_WRITER_BASELINE'; end if;

  if installed then
    pair_rpc := 'public.submit_qa_site_source_pair(uuid,uuid,bigint,uuid,text)'::regprocedure;
    if not has_function_privilege(caller_role,pair_rpc,'EXECUTE')
      or has_function_privilege(caller_role,pair_rpc,'EXECUTE WITH GRANT OPTION')
      or exists (select from pg_proc where oid=pair_rpc and (proowner<>executor_role or not prosecdef))
      or exists (select from pg_proc p, lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
        where p.oid=pair_rpc and a.grantee not in (executor_role,caller_role))
      or exists (select from pg_roles r where
        r.rolname in ('anon','authenticated','service_role','observer_site_save_caller','observer_site_save_executor')
        and (has_any_column_privilege(r.oid,'observer_site_save_private.pair_pin','SELECT,INSERT,UPDATE,REFERENCES')
          or has_table_privilege(r.oid,'observer_site_save_private.pair_pin','DELETE,TRUNCATE,TRIGGER')))
    then raise exception 'UNEXPECTED_PAIR_ENTRY_OR_PIN_ACL'; end if;
  end if;

  for col in select attname from pg_attribute where attrelid=src and attnum>0 and not attisdropped loop
    foreach priv in array array['SELECT','INSERT','UPDATE','REFERENCES'] loop
      expected := installed and case priv
        when 'SELECT' then col.attname in ('id','observer_site_id')
        when 'UPDATE' then col.attname='id'
        when 'INSERT' then col.attname in ('id','observer_site_id','created_by','display_name','source_mode','status','engine_mode')
        else false end;
      if has_column_privilege(executor_role,src,col.attname,priv) <> expected
        or has_column_privilege(executor_role,src,col.attname,priv || ' WITH GRANT OPTION')
      then raise exception 'UNEXPECTED_PAIR_SOURCE_ACL: % %', col.attname, priv; end if;
    end loop;
  end loop;
end $$;
revoke all on function observer_site_save_private.check_pair_acl(boolean)
  from public,anon,authenticated,service_role,observer_site_save_caller,observer_site_save_executor;
select observer_site_save_private.check_pair_acl(false);
revoke execute on function public.submit_observer_site_save(uuid,uuid,bigint,uuid,text,uuid,uuid,jsonb,text,jsonb)
  from observer_site_save_caller;

-- Only the operator stages, rotates or closes the singleton. A successful RPC
-- holds a shared row lock until commit so replacement cannot race a receipt.
create table observer_site_save_private.pair_pin (
  singleton boolean primary key default true check (singleton),
  actor uuid not null, session_id uuid not null, submission uuid not null,
  source_id uuid not null, package_id uuid not null,
  fixture_label text collate "C" not null check (length(fixture_label) between 2 and 100 and btrim(fixture_label)=fixture_label),
  expires_at timestamptz not null check (isfinite(expires_at) and expires_at<=clock_timestamp()+interval '300 seconds')
);
revoke all on observer_site_save_private.pair_pin
  from public,anon,authenticated,service_role,observer_site_save_caller,observer_site_save_executor;
alter table observer_site_save_private.pair_pin enable row level security;
create function observer_site_save_private.lock_pair_pin(wanted_submission uuid, wanted_label text)
returns setof observer_site_save_private.pair_pin language sql volatile security definer set search_path='' as $$
  select p.* from observer_site_save_private.pair_pin p
  where current_setting('role',true)='observer_site_save_caller'
    and p.singleton and p.actor=auth.uid()
    and p.session_id::text=current_setting('request.jwt.claims',true)::jsonb->>'session_id'
    and p.submission=wanted_submission and p.fixture_label=wanted_label and p.expires_at>clock_timestamp()
    and p.expires_at<=clock_timestamp()+interval '300 seconds'
  for share of p
$$;
revoke all on function observer_site_save_private.lock_pair_pin(uuid,text)
  from public,anon,authenticated,service_role,observer_site_save_caller;
grant execute on function observer_site_save_private.lock_pair_pin(uuid,text) to observer_site_save_executor;

-- Both receipts commit with the Site and source. No cascading source FK:
-- history survives source removal and a missing source makes replay fail.
create table observer_site_save_private.pair_receipts (
  actor uuid not null, submission uuid not null, session_id uuid not null,
  site_id uuid not null unique, source_id uuid not null unique, package_id uuid not null,
  fixture_label text collate "C" not null,
  primary key(actor,submission),
  foreign key(actor,submission) references observer_site_save_private.receipts(actor,submission)
);
revoke all on observer_site_save_private.pair_receipts
  from public,anon,authenticated,service_role,observer_site_save_caller,observer_site_save_executor;
alter table observer_site_save_private.pair_receipts enable row level security;
-- Include prior sessions of this actor in conflict detection. Only the pinned
-- session can create a receipt and the RPC checks the full identity on replay.
create policy pair_history_read on observer_site_save_private.pair_receipts
  for select to observer_site_save_executor using (actor=auth.uid());
create policy pair_history_insert on observer_site_save_private.pair_receipts
  for insert to observer_site_save_executor with check (
    actor=auth.uid() and session_id::text=current_setting('request.jwt.claims',true)::jsonb->>'session_id'
    and source_id::text=current_setting('observer_pair.source_id',true)
    and site_id::text=current_setting('observer_pair.site_id',true));
grant select,insert on observer_site_save_private.pair_receipts to observer_site_save_executor;

-- #669 already owns the Site, subscription and predicate grants. Source SELECT
-- exposes only the two identifiers. UPDATE(id) is for SELECT ... FOR SHARE;
-- the restrictive UPDATE check refuses every replacement row.
grant select(id,observer_site_id),insert(id,observer_site_id,created_by,display_name,source_mode,status,engine_mode),update(id)
  on public.digital_observer_camera_sources to observer_site_save_executor;
create policy pair_source_scope on public.digital_observer_camera_sources
  to observer_site_save_executor using (
    id::text=current_setting('observer_pair.source_id',true)
    and observer_site_id::text=current_setting('observer_pair.site_id',true) and created_by=auth.uid());
-- Restrictive also applies when a pre-existing permissive product policy passes.
-- With no separate WITH CHECK this same predicate checks the proposed INSERT.
create policy pair_source_inert on public.digital_observer_camera_sources as restrictive
  to observer_site_save_executor using (
    id::text=current_setting('observer_pair.source_id',true)
    and observer_site_id::text=current_setting('observer_pair.site_id',true)
    and created_by=auth.uid() and display_name collate "C"=current_setting('observer_pair.label',true)
    and connector_type='demo' and connector_provider='generic' and source_mode='sandbox'
    and status='disabled' and health_status='unknown' and engine_mode='standard_biometric'
    and camera_stream_id is null and location_label is null and stream_protocol is null
    and gateway_provider is null and secret_reference is null and preview_scene is null
    and last_health_check_at is null and last_seen_at is null and last_error_code is null and last_error_message is null
    and capabilities='{}'::jsonb and monitoring_targets='[]'::jsonb and metadata='{}'::jsonb);
create policy pair_source_lock_only on public.digital_observer_camera_sources as restrictive
  for update to observer_site_save_executor using (true) with check (false);

create function public.submit_qa_site_source_pair(
  verified_actor uuid, verified_session uuid, token_exp bigint, submission uuid, fixture_label text
) returns jsonb language plpgsql security definer set search_path=''
set observer_pair.site_id='' set observer_pair.source_id='' set observer_pair.label='' as $pair$
declare
  prior_claims text := current_setting('request.jwt.claims',true);
  pin observer_site_save_private.pair_pin%rowtype;
  history observer_site_save_private.pair_receipts%rowtype;
  generic observer_site_save_private.receipts%rowtype;
  site_kind text;
  site_patch jsonb;
  expected_site jsonb;
  saved_site uuid;
  result_ids jsonb;
  replay boolean;
begin
  if current_setting('role',true) is distinct from 'observer_site_save_caller'
    or prior_claims::jsonb->>'role' is distinct from 'observer_site_save_caller'
    or verified_actor is null or verified_session is null or submission is null or fixture_label is null
    or token_exp is null or token_exp<=extract(epoch from clock_timestamp())
  then raise insufficient_privilege; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',verified_actor,'session_id',verified_session,
    'role','authenticated','exp',token_exp)::text,true);
  select p.* into strict pin from observer_site_save_private.lock_pair_pin(submission,fixture_label) p;
  -- Same account lock as the generic writer and atomic core. Check eligibility
  -- after waiting, before a new Site, under the actor's verified session.
  select case a.account_type when 'home' then 'home' else 'business' end into strict site_kind
    from public.digital_observer_accounts a join public.profiles p on p.id=a.profile_id
    where p.id=verified_actor and p.active and a.account_type in ('home','business')
      and a.status in ('onboarding','trial','active') for update of a;
  if auth.uid() is distinct from verified_actor or public.digital_observer_current_session_active() is not true
    or pin.expires_at<=clock_timestamp() or token_exp<=extract(epoch from clock_timestamp())
  then raise insufficient_privilege; end if;

  site_patch := jsonb_build_object('name',pin.fixture_label,'site_type',site_kind,
    'address','QA Fixture 1, QA City','city','QA City','street','QA Fixture','building_number','1',
    'floor_kind','ground','floor_number',0,'country_code','IL','address_verification_status','unverified',
    'business_handles_children',false,'vision_privacy_mode','standard_consent','camera_limit',1,
    'monitoring_hours','{"mode":"event_only"}'::jsonb,
    'ai_features','{"mode":"readiness","targets":[],"face_recognition_enabled":false,"automatic_emergency_action":false}'::jsonb,
    'metadata','{"synthetic_data_only":true,"live_camera_disabled":true,"live_ai_disabled":true,"emergency_dispatch_enabled":false}'::jsonb);
  expected_site := site_patch || jsonb_build_object('active',true,'monitoring_enabled',false,
    'engine_mode','standard_biometric','observer_runtime_status','setup','learning_started_at',null,
    'event_retention_days',2,'address_provider',null,'address_place_id',null,'address_verified_at',null,
    'latitude',null,'longitude',null);

  select r.* into history from observer_site_save_private.pair_receipts r
    where r.actor=pin.actor and r.submission=pin.submission;
  replay := found;
  select r.* into generic from observer_site_save_private.receipts r
    where r.actor=pin.actor and r.submission=pin.submission;
  if found <> replay then raise exception 'PAIR_RECEIPT_CONFLICT'; end if;
  if replay then
    if (history.session_id,history.source_id,history.package_id,history.fixture_label,history.site_id)
      is distinct from (pin.session_id,pin.source_id,pin.package_id,pin.fixture_label,generic.site_id)
    then raise exception 'PAIR_RECEIPT_CONFLICT'; end if;
    saved_site := history.site_id;
  end if;
  if exists (select from public.observer_sites s where s.owner_profile_id=pin.actor
    and s.garden_id is null and s.site_type<>'kindergarten' and s.id is distinct from saved_site)
  then raise exception 'PAIR_ACTOR_ALREADY_HAS_SITE'; end if;

  if not replay then
    saved_site := (public.save_observer_onboarding_atomic(null,pin.package_id,site_patch,'event_only','[]'::jsonb)
      #>>'{site,id}')::uuid;
  end if;
  perform 1 from public.observer_sites s where s.id=saved_site and s.owner_profile_id=pin.actor
    and s.garden_id is null and not exists (select from jsonb_each(expected_site) e
      where (to_jsonb(s)->e.key) is distinct from e.value) for share of s;
  if not found then raise exception 'PAIR_SITE_DRIFT'; end if;
  perform 1 from public.observer_site_subscriptions s where s.observer_site_id=saved_site
    and s.package_id=pin.package_id and s.payment_provider_mode='disabled' for share of s;
  if not found then raise exception 'PAIR_SUBSCRIPTION_DRIFT'; end if;

  perform set_config('observer_pair.site_id',saved_site::text,true),
    set_config('observer_pair.source_id',pin.source_id::text,true),set_config('observer_pair.label',pin.fixture_label,true);
  if not replay then
    insert into public.digital_observer_camera_sources(id,observer_site_id,created_by,display_name,source_mode,status,engine_mode)
      values(pin.source_id,saved_site,pin.actor,pin.fixture_label,'sandbox','disabled','standard_biometric');
    if not found then raise exception 'PAIR_SOURCE_NOT_SAVED'; end if;
  end if;
  -- The restrictive policy rechecks every inert field even on receipt replay.
  perform 1 from public.digital_observer_camera_sources c
    where c.id=pin.source_id and c.observer_site_id=saved_site for share of c;
  if not found then raise exception 'PAIR_SOURCE_MISSING_OR_CHANGED'; end if;
  result_ids := jsonb_build_object('site_id',saved_site,'source_id',pin.source_id);
  if replay then
    if generic.request_digest<>'qa-site-source-pair:v1' or generic.result is distinct from result_ids
    then raise exception 'PAIR_RECEIPT_CONFLICT'; end if;
  else
    -- The domain marker cannot match a generic RPC's 64-hex request digest.
    insert into observer_site_save_private.receipts(actor,submission,request_digest,site_id,result)
      values(pin.actor,pin.submission,'qa-site-source-pair:v1',saved_site,result_ids);
    if not found then raise exception 'PAIR_WRITER_RECEIPT_NOT_SAVED'; end if;
    insert into observer_site_save_private.pair_receipts(actor,submission,session_id,site_id,source_id,package_id,fixture_label)
      values(pin.actor,pin.submission,pin.session_id,saved_site,pin.source_id,pin.package_id,pin.fixture_label);
    if not found then raise exception 'PAIR_RECEIPT_NOT_SAVED'; end if;
  end if;
  if pin.expires_at<=clock_timestamp() or token_exp<=extract(epoch from clock_timestamp())
    or public.digital_observer_current_session_active() is not true then raise insufficient_privilege; end if;
  perform set_config('request.jwt.claims',prior_claims,true);
  return result_ids;
end
$pair$;
alter function public.submit_qa_site_source_pair(uuid,uuid,bigint,uuid,text) owner to observer_site_save_executor;
revoke all on function public.submit_qa_site_source_pair(uuid,uuid,bigint,uuid,text)
  from public,anon,authenticated,service_role;
grant execute on function public.submit_qa_site_source_pair(uuid,uuid,bigint,uuid,text) to observer_site_save_caller;
select observer_site_save_private.check_pair_acl(true);
commit;
