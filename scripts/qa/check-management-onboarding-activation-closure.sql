-- Synthetic, rollback-only GB-M10 activation matrix. Run only in a disposable
-- database restored from isolated Development/QA, never against Production.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000201',true) \gset
select started->>'garden_id' as probe_garden_id, started->>'activation_key' as probe_activation_key
from (select public.start_garden_onboarding('{"name":"QA Atomic Activation Closure","city":"QA City","address":"QA Street 1","phone":"0500000000"}'::jsonb,'teacher_operator') as started) s \gset
reset role;
select set_config('qa.garden_id', :'probe_garden_id', true) \gset
select set_config('qa.activation_key', :'probe_activation_key', true) \gset

do $$ declare gid uuid := current_setting('qa.garden_id')::uuid; key uuid := current_setting('qa.activation_key')::uuid;
begin
  if not exists(select 1 from public.gardens where id=gid and status::text='pending')
    or not exists(select 1 from public.garden_management_memberships where garden_id=gid and status='pending')
    then raise exception 'draft_granted_operational_access'; end if;
  perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000201',true);
  execute 'set local role authenticated';
  begin
    perform public.activate_garden_onboarding(gid,key,true);
    raise exception 'incomplete_draft_activated';
  exception when check_violation then null;
  end;
  execute 'reset role';
  if exists(select 1 from public.kindergarten_legal_acceptances where garden_id=gid)
    or exists(select 1 from public.gardens where id=gid and status::text='active')
    then raise exception 'failed_activation_committed_partial_state'; end if;
end $$;

update public.kindergarten_onboarding_records
  set profile_data=profile_data||'{"selected_age_groups":["INFANT"],"documents_summary":"QA synthetic document summary"}'::jsonb
  where garden_id=:'probe_garden_id'::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000201',true) \gset
select (public.activate_garden_onboarding(:'probe_garden_id'::uuid,:'probe_activation_key'::uuid,true)->>'already_active') as first_activation_retry;
select (public.activate_garden_onboarding(:'probe_garden_id'::uuid,:'probe_activation_key'::uuid,true)->>'already_active') as second_activation_retry;
reset role;

do $$ declare gid uuid := current_setting('qa.garden_id')::uuid;
begin
  if not exists(select 1 from public.gardens where id=gid and status::text='active' and onboarding_status='active')
    or not exists(select 1 from public.kindergarten_onboarding_records where garden_id=gid and lifecycle_status='active')
    or not exists(select 1 from public.garden_management_memberships where garden_id=gid and profile_id='00000000-0000-4000-8000-000000000201' and status='active')
    then raise exception 'atomic_activation_incomplete'; end if;
  if (select count(*) from public.kindergarten_subscriptions where garden_id=gid and status::text='trial')<>1
    or (select count(*) from public.kindergarten_legal_acceptances where garden_id=gid and accepted and acceptance_type in ('platform_terms','privacy_terms'))<>2
    or (select count(*) from public.kindergarten_activation_events where garden_id=gid and event_type='activation_completed')<>1
    then raise exception 'activation_retry_duplicated_state'; end if;
  if exists(select 1 from public.kindergarten_subscriptions where garden_id=gid and provider<>'manual')
    then raise exception 'unverified_payment_provider_activated'; end if;
  begin
    update public.gardens set status='pending',approval_flow_status='onboarding_in_progress',onboarding_status='onboarding_in_progress' where id=gid;
    raise exception 'stale_garden_downgrade_allowed';
  exception when check_violation then null; end;
  begin
    update public.kindergarten_onboarding_records set lifecycle_status='onboarding_in_progress' where garden_id=gid;
    raise exception 'stale_record_downgrade_allowed';
  exception when check_violation then null; end;
  update public.gardens set public_description='QA allowed active edit' where id=gid;
  if not exists(select 1 from public.gardens where id=gid and status::text='active' and onboarding_status='active')
    or not exists(select 1 from public.kindergarten_onboarding_records where garden_id=gid and lifecycle_status='active')
    then raise exception 'stale_patch_left_split_state'; end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000202',true) \gset
do $$ declare gid uuid := current_setting('qa.garden_id')::uuid; key uuid := current_setting('qa.activation_key')::uuid;
begin
  begin
    perform public.activate_garden_onboarding(gid,key,true);
    raise exception 'foreign_manager_activated_garden';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'GB-M10 atomic activation closure PASS';
rollback;
