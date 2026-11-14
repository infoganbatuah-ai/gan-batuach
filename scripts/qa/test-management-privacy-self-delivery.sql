-- Run only against a disposable restore with the synthetic QA personas.
-- The outer transaction rolls back every request, grant, and audit event.
begin;
set local statement_timeout = '30s';

create function pg_temp.expect_sqlstate(label text, statement text, expected text)
returns void language plpgsql as $$
declare actual text;
begin
  begin
    execute statement;
  exception when others then
    get stacked diagnostics actual = returned_sqlstate;
    if actual = expected then return; end if;
    raise exception '%: expected SQLSTATE %, got %', label, expected, actual;
  end;
  raise exception '%: expected refusal % but statement succeeded', label, expected;
end;
$$;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000501',true);

insert into public.privacy_rights_requests
  (id,request_key,requester_profile_id,requested_by,subject_user_id,data_subject_id,
   data_subject_type,subject_type,request_type,request_reason,stated_purpose)
values
  ('11111111-1111-4111-8111-111111111111','qa-self-access-1111',
   '00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000101',
   '00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000101',
   'parent','self','access','Synthetic bounded access QA','Synthetic bounded access QA'),
  ('22222222-2222-4222-8222-222222222222','qa-self-export-2222',
   '00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000101',
   '00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000101',
   'parent','self','export','Synthetic bounded export QA','Synthetic bounded export QA'),
  ('33333333-3333-4333-8333-333333333333','qa-self-expired-3333',
   '00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000101',
   '00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000101',
   'parent','self','access','Synthetic expiry QA','Synthetic expiry QA'),
  ('44444444-4444-4444-8444-444444444444','qa-self-hold-4444',
   '00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000101',
   '00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000101',
   'parent','self','access','Synthetic hold QA','Synthetic hold QA');

insert into public.privacy_request_scope_items
  (privacy_request_id,data_category,table_name,estimated_record_count,action_recommendation,parent_export_allowed)
select id,'account','profiles',1,'export',true from public.privacy_rights_requests
where id in ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444');

update public.privacy_rights_requests
set status='approved',reviewer_id='00000000-0000-4000-8000-000000000501',
  decision_reason='Approved for synthetic bounded QA',scope_calculated_at=now(),legal_hold_checked_at=now()
where id in ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
select pg_temp.expect_sqlstate('requester cannot issue grant',
  $$select public.management_issue_privacy_self_delivery('11111111-1111-4111-8111-111111111111')$$,'42501');
select pg_temp.expect_sqlstate('requester cannot directly write grant',
  $$update public.privacy_self_delivery_grants set access_count=3
    where privacy_request_id='11111111-1111-4111-8111-111111111111'$$,'42501');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000501',true);
select public.management_issue_privacy_self_delivery('11111111-1111-4111-8111-111111111111');
select public.management_issue_privacy_self_delivery('11111111-1111-4111-8111-111111111111');
select public.management_issue_privacy_self_delivery('22222222-2222-4222-8222-222222222222');
select public.management_issue_privacy_self_delivery('33333333-3333-4333-8333-333333333333');
select public.management_issue_privacy_self_delivery('44444444-4444-4444-8444-444444444444');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000102',true);
select pg_temp.expect_sqlstate('other parent cannot read',
  $$select public.management_read_privacy_self_delivery('11111111-1111-4111-8111-111111111111')$$,'42501');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000201',true);
select pg_temp.expect_sqlstate('manager cannot read',
  $$select public.management_read_privacy_self_delivery('11111111-1111-4111-8111-111111111111')$$,'42501');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000501',true);
select pg_temp.expect_sqlstate('admin cannot read another requester',
  $$select public.management_read_privacy_self_delivery('11111111-1111-4111-8111-111111111111')$$,'42501');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
do $$
declare result jsonb;
begin
  for i in 1..3 loop
    result := public.management_read_privacy_self_delivery('11111111-1111-4111-8111-111111111111');
    if result->>'coverage' <> 'self_profile_only' or result->>'request_type' <> 'access'
       or (result->>'remaining_reads')::int <> 3-i
       or result ? 'child' or result ? 'garden' or result ? 'document'
       or (result->'profile') ? 'email' or (result->'profile') ? 'identity_number' then
      raise exception 'Unexpected access payload or read counter';
    end if;
  end loop;
end;
$$;
select pg_temp.expect_sqlstate('fourth read refused',
  $$select public.management_read_privacy_self_delivery('11111111-1111-4111-8111-111111111111')$$,'42501');
do $$
declare result jsonb;
begin
  result := public.management_read_privacy_self_delivery('22222222-2222-4222-8222-222222222222');
  if result->>'request_type' <> 'export' or result->>'coverage' <> 'self_profile_only'
     or (result->>'remaining_reads')::int <> 2 or result ? 'child' or result ? 'garden' then
    raise exception 'Unexpected bounded export payload';
  end if;
end;
$$;

set local role postgres;
update public.privacy_self_delivery_grants
set issued_at=now()-interval '2 days',expires_at=now()-interval '1 day'
where privacy_request_id='33333333-3333-4333-8333-333333333333';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
select pg_temp.expect_sqlstate('expired read refused',
  $$select public.management_read_privacy_self_delivery('33333333-3333-4333-8333-333333333333')$$,'42501');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000501',true);
select public.management_revoke_privacy_self_delivery('22222222-2222-4222-8222-222222222222');
select public.management_revoke_privacy_self_delivery('22222222-2222-4222-8222-222222222222');
select pg_temp.expect_sqlstate('revoked grant cannot be reissued',
  $$select public.management_issue_privacy_self_delivery('22222222-2222-4222-8222-222222222222')$$,'23514');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
select pg_temp.expect_sqlstate('revoked read refused',
  $$select public.management_read_privacy_self_delivery('22222222-2222-4222-8222-222222222222')$$,'42501');

set local role postgres;
update public.privacy_request_scope_items set blocked_by_retention=true
where privacy_request_id='44444444-4444-4444-8444-444444444444';
set local role authenticated;
select pg_temp.expect_sqlstate('retention-blocked scope stops read',
  $$select public.management_read_privacy_self_delivery('44444444-4444-4444-8444-444444444444')$$,'42501');
set local role postgres;
update public.privacy_request_scope_items set blocked_by_retention=false
where privacy_request_id='44444444-4444-4444-8444-444444444444';
update public.privacy_request_scope_items set blocked_by_legal_hold=true
where privacy_request_id='44444444-4444-4444-8444-444444444444';
set local role authenticated;
select pg_temp.expect_sqlstate('hold-blocked scope stops read',
  $$select public.management_read_privacy_self_delivery('44444444-4444-4444-8444-444444444444')$$,'42501');
set local role postgres;
update public.privacy_request_scope_items set blocked_by_legal_hold=false
where privacy_request_id='44444444-4444-4444-8444-444444444444';
create function pg_temp.fail_delivery_audit()
returns trigger language plpgsql as $$
begin
  raise exception 'synthetic audit outage' using errcode='P0001';
end;
$$;
create trigger qa_fail_delivery_audit before insert on public.immutable_audit_events
for each row when (new.event_type='privacy_self_delivery_accessed')
execute function pg_temp.fail_delivery_audit();
set local role authenticated;
select pg_temp.expect_sqlstate('audit failure rolls back read',
  $$select public.management_read_privacy_self_delivery('44444444-4444-4444-8444-444444444444')$$,'P0001');
set local role postgres;
do $$
begin
  if (select access_count from public.privacy_self_delivery_grants
      where privacy_request_id='44444444-4444-4444-8444-444444444444') <> 0 then
    raise exception 'Audit failure left a consumed grant';
  end if;
end;
$$;
drop trigger qa_fail_delivery_audit on public.immutable_audit_events;
insert into public.legal_holds
  (hold_key,hold_reason,hold_type,status,subject_user_id,created_by)
values ('qa-self-delivery-hold','Synthetic privacy hold QA','regulatory_review','active',
  '00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000501');
set local role authenticated;
select pg_temp.expect_sqlstate('active hold blocks read',
  $$select public.management_read_privacy_self_delivery('44444444-4444-4444-8444-444444444444')$$,'42501');

set local role postgres;
do $$
begin
  if (select access_count from public.privacy_self_delivery_grants
      where privacy_request_id='11111111-1111-4111-8111-111111111111') <> 3
    or (select count(*) from public.immutable_audit_events
        where target_id='11111111-1111-4111-8111-111111111111'
          and event_type='privacy_self_delivery_granted') <> 1
    or (select count(*) from public.immutable_audit_events
        where target_id='11111111-1111-4111-8111-111111111111'
          and event_type='privacy_self_delivery_accessed') <> 3 then
    raise exception 'Grant counter or immutable audit count mismatch';
  end if;
end;
$$;
rollback;
