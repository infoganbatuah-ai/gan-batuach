-- Synthetic QA only: run against a uniquely restored disposable database.
-- All requests, grants, changes to guardian scope and audit rows roll back.
begin;
set local statement_timeout='30s';

create function pg_temp.expect_sqlstate(label text, statement text, expected text)
returns void language plpgsql as $$
declare actual text;
begin
  begin execute statement;
  exception when others then
    get stacked diagnostics actual=returned_sqlstate;
    if actual=expected then return; end if;
    raise exception '% expected %, got %',label,expected,actual;
  end;
  raise exception '% unexpectedly succeeded',label;
end;
$$;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000501',true);
insert into public.privacy_rights_requests
  (id,request_key,requester_profile_id,requested_by,subject_user_id,data_subject_id,
   data_subject_type,subject_type,child_id,garden_id,request_type,request_reason,stated_purpose)
select id,'qa-child-delivery-'||id,
  '00000000-0000-4000-8000-000000000101'::uuid,
  '00000000-0000-4000-8000-000000000101'::uuid,null,
  '00000000-0000-4000-8000-000000000901'::uuid,
  'child','child','00000000-0000-4000-8000-000000000901'::uuid,
  '00000000-0000-4000-8000-000000000601'::uuid,kind,
  'Synthetic bounded child Garden QA','Synthetic bounded child Garden QA'
from (values
  ('11111111-1111-4111-8111-111111111111'::uuid,'access'),
  ('22222222-2222-4222-8222-222222222222'::uuid,'export'),
  ('33333333-3333-4333-8333-333333333333'::uuid,'access'),
  ('44444444-4444-4444-8444-444444444444'::uuid,'access'),
  ('55555555-5555-4555-8555-555555555555'::uuid,'access')) fixture(id,kind);

insert into public.privacy_request_scope_items
  (privacy_request_id,data_category,table_name,estimated_record_count,
   action_recommendation,parent_export_allowed)
select r.id,t.category,t.table_name,1,'review',true
from public.privacy_rights_requests r
cross join (values ('child_records','children'),('garden_identity','gardens')) t(category,table_name)
where r.id in ('11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444',
  '55555555-5555-4555-8555-555555555555');
update public.privacy_rights_requests set status='approved',
  reviewer_id='00000000-0000-4000-8000-000000000501',
  decision_reason='Approved for synthetic bounded QA',
  scope_calculated_at=now(),legal_hold_checked_at=now()
where id in ('11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444',
  '55555555-5555-4555-8555-555555555555');

-- The Admin decision alone cannot authorize a mismatched Garden or an
-- incomplete explicit scope, even when both rows were marked approved.
insert into public.privacy_rights_requests
  (id,request_key,requester_profile_id,requested_by,subject_user_id,data_subject_id,
   data_subject_type,subject_type,child_id,garden_id,request_type,request_reason,stated_purpose)
values
  ('66666666-6666-4666-8666-666666666666','qa-wrong-garden',
   '00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000101',
   null,'00000000-0000-4000-8000-000000000901','child','child',
   '00000000-0000-4000-8000-000000000901','00000000-0000-4000-8000-000000000602',
   'access','Synthetic wrong Garden QA','Synthetic wrong Garden QA'),
  ('77777777-7777-4777-8777-777777777777','qa-missing-garden-scope',
   '00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000101',
   null,'00000000-0000-4000-8000-000000000901','child','child',
   '00000000-0000-4000-8000-000000000901','00000000-0000-4000-8000-000000000601',
   'access','Synthetic missing Garden scope QA','Synthetic missing Garden scope QA');
insert into public.privacy_request_scope_items
  (privacy_request_id,data_category,table_name,estimated_record_count,
   action_recommendation,parent_export_allowed)
values
  ('66666666-6666-4666-8666-666666666666','child_records','children',1,'review',true),
  ('66666666-6666-4666-8666-666666666666','garden_identity','gardens',1,'review',true),
  ('77777777-7777-4777-8777-777777777777','child_records','children',1,'review',true);
update public.privacy_rights_requests set status='approved',
  reviewer_id='00000000-0000-4000-8000-000000000501',
  decision_reason='Approved for synthetic bounded QA',
  scope_calculated_at=now(),legal_hold_checked_at=now()
where id in ('66666666-6666-4666-8666-666666666666',
  '77777777-7777-4777-8777-777777777777');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
select pg_temp.expect_sqlstate('Parent cannot issue',
  $$select public.management_issue_privacy_child_garden_delivery('11111111-1111-4111-8111-111111111111')$$,'42501');
select pg_temp.expect_sqlstate('Parent cannot write grant',
  $$insert into public.privacy_child_garden_delivery_grants
    (privacy_request_id,requester_profile_id,child_id,garden_id,issued_by,expires_at)
    values ('11111111-1111-4111-8111-111111111111',
      '00000000-0000-4000-8000-000000000101',
      '00000000-0000-4000-8000-000000000901',
      '00000000-0000-4000-8000-000000000601',
      '00000000-0000-4000-8000-000000000101',now()+interval '1 hour')$$,'42501');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000501',true);
select pg_temp.expect_sqlstate('Wrong Garden binding denied',
  $$select public.management_issue_privacy_child_garden_delivery('66666666-6666-4666-8666-666666666666')$$,'23514');
select pg_temp.expect_sqlstate('Missing Garden scope denied',
  $$select public.management_issue_privacy_child_garden_delivery('77777777-7777-4777-8777-777777777777')$$,'23514');
select public.management_issue_privacy_child_garden_delivery('11111111-1111-4111-8111-111111111111');
select public.management_issue_privacy_child_garden_delivery('11111111-1111-4111-8111-111111111111');
select public.management_issue_privacy_child_garden_delivery('22222222-2222-4222-8222-222222222222');
select public.management_issue_privacy_child_garden_delivery('33333333-3333-4333-8333-333333333333');
select public.management_issue_privacy_child_garden_delivery('44444444-4444-4444-8444-444444444444');
select public.management_issue_privacy_child_garden_delivery('55555555-5555-4555-8555-555555555555');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000102',true);
select pg_temp.expect_sqlstate('Other Garden Parent denied',
  $$select public.management_read_privacy_child_garden_delivery('11111111-1111-4111-8111-111111111111')$$,'42501');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000201',true);
select pg_temp.expect_sqlstate('Manager denied',
  $$select public.management_read_privacy_child_garden_delivery('11111111-1111-4111-8111-111111111111')$$,'42501');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000501',true);
select pg_temp.expect_sqlstate('Admin cannot read as requester',
  $$select public.management_read_privacy_child_garden_delivery('11111111-1111-4111-8111-111111111111')$$,'42501');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
do $$
declare result jsonb;
begin
  for i in 1..3 loop
    result:=public.management_read_privacy_child_garden_delivery('11111111-1111-4111-8111-111111111111');
    if result->>'coverage'<>'child_garden_identity_only'
       or result->>'request_type'<>'access'
       or (result->>'remaining_reads')::int<>3-i
       or (select count(*) from jsonb_object_keys(result->'child'))<>2
       or (select count(*) from jsonb_object_keys(result->'garden'))<>2
       or length(coalesce((result->'child')->>'full_name',''))<1
       or length(coalesce((result->'garden')->>'name',''))<1
       or result ? 'document' or result ? 'camera' or result ? 'medical'
       or (result->'child') ? 'identity_number'
       or (result->'garden') ? 'address' then
      raise exception 'Unexpected child/Garden identity payload';
    end if;
  end loop;
end;
$$;
select pg_temp.expect_sqlstate('Fourth read denied',
  $$select public.management_read_privacy_child_garden_delivery('11111111-1111-4111-8111-111111111111')$$,'42501');
do $$
declare result jsonb;
begin
  result:=public.management_read_privacy_child_garden_delivery('22222222-2222-4222-8222-222222222222');
  if result->>'request_type'<>'export' or result->>'coverage'<>'child_garden_identity_only'
     or (result->>'remaining_reads')::int<>2 then
    raise exception 'Bounded export failed';
  end if;
end;
$$;

set local role postgres;
update public.privacy_child_garden_delivery_grants
  set issued_at=now()-interval '2 days',expires_at=now()-interval '1 day'
  where privacy_request_id='33333333-3333-4333-8333-333333333333';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
select pg_temp.expect_sqlstate('Expired read denied',
  $$select public.management_read_privacy_child_garden_delivery('33333333-3333-4333-8333-333333333333')$$,'42501');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000501',true);
select public.management_revoke_privacy_child_garden_delivery('22222222-2222-4222-8222-222222222222');
select public.management_revoke_privacy_child_garden_delivery('22222222-2222-4222-8222-222222222222');
select pg_temp.expect_sqlstate('Revoked grant cannot reissue',
  $$select public.management_issue_privacy_child_garden_delivery('22222222-2222-4222-8222-222222222222')$$,'23514');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
select pg_temp.expect_sqlstate('Revoked read denied',
  $$select public.management_read_privacy_child_garden_delivery('22222222-2222-4222-8222-222222222222')$$,'42501');

set local role postgres;
update public.child_guardian_links set status='revoked'
  where permanent_child_file_id='00000000-0000-4000-8000-000000000801'
    and guardian_profile_id='00000000-0000-4000-8000-000000000101';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
select pg_temp.expect_sqlstate('Guardian revocation blocks read',
  $$select public.management_read_privacy_child_garden_delivery('44444444-4444-4444-8444-444444444444')$$,'42501');
set local role postgres;
update public.child_guardian_links set status='active'
  where permanent_child_file_id='00000000-0000-4000-8000-000000000801'
    and guardian_profile_id='00000000-0000-4000-8000-000000000101';
update public.privacy_request_scope_items set blocked_by_retention=true
  where privacy_request_id='44444444-4444-4444-8444-444444444444'
    and table_name='children';
set local role authenticated;
select pg_temp.expect_sqlstate('Retention blocks read',
  $$select public.management_read_privacy_child_garden_delivery('44444444-4444-4444-8444-444444444444')$$,'42501');
set local role postgres;
update public.privacy_request_scope_items set blocked_by_retention=false
  where privacy_request_id='44444444-4444-4444-8444-444444444444'
    and table_name='children';
insert into public.legal_holds
  (hold_key,hold_reason,hold_type,status,child_id,created_by)
values ('qa-child-garden-delivery-hold','Synthetic QA','regulatory_review','active',
  '00000000-0000-4000-8000-000000000901','00000000-0000-4000-8000-000000000501');
set local role authenticated;
select pg_temp.expect_sqlstate('Active hold blocks read',
  $$select public.management_read_privacy_child_garden_delivery('44444444-4444-4444-8444-444444444444')$$,'42501');

set local role postgres;
delete from public.legal_holds where hold_key='qa-child-garden-delivery-hold';
create function pg_temp.fail_child_delivery_audit()
returns trigger language plpgsql as $$
begin
  if new.event_type='privacy_child_garden_delivery_accessed'
     and new.target_id='55555555-5555-4555-8555-555555555555' then
    raise exception 'Synthetic audit failure';
  end if;
  return new;
end;
$$;
create trigger qa_fail_child_delivery_audit
before insert on public.immutable_audit_events
for each row execute function pg_temp.fail_child_delivery_audit();
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
select pg_temp.expect_sqlstate('Audit failure rolls back read',
  $$select public.management_read_privacy_child_garden_delivery('55555555-5555-4555-8555-555555555555')$$,'P0001');
set local role postgres;
drop trigger qa_fail_child_delivery_audit on public.immutable_audit_events;
do $$
begin
  if (select access_count from public.privacy_child_garden_delivery_grants
      where privacy_request_id='55555555-5555-4555-8555-555555555555')<>0
     or (select count(*) from public.immutable_audit_events
         where target_id='11111111-1111-4111-8111-111111111111'
           and event_type='privacy_child_garden_delivery_granted')<>1
     or (select count(*) from public.immutable_audit_events
         where target_id='11111111-1111-4111-8111-111111111111'
           and event_type='privacy_child_garden_delivery_accessed')<>3 then
    raise exception 'Audit or counter atomicity failed';
  end if;
end;
$$;
rollback;
