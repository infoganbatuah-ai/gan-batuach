-- Disposable restored QA database only. Every synthetic request, name update,
-- execution record and immutable audit event is rolled back.
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
create temporary table qa_parent_correction(id uuid primary key, old_name text);
grant select, insert on qa_parent_correction to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
insert into qa_parent_correction
select public.management_submit_parent_name_correction(
  'QA Parent Name Corrected','Synthetic self name correction verification'),
  (select full_name from public.profiles where id='00000000-0000-4000-8000-000000000101');
do $$ begin
  if (select count(*) from qa_parent_correction)<>1
     or (select count(*) from public.privacy_parent_name_correction_proposals p
         join qa_parent_correction q on q.id=p.privacy_request_id)<>1
     or (select count(*) from public.privacy_rights_requests r
         join qa_parent_correction q on q.id=r.id
         where r.status='submitted' and r.request_type='correction'
           and r.subject_user_id='00000000-0000-4000-8000-000000000101'
           and r.child_id is null and r.garden_id is null)<>1 then
    raise exception 'Parent self-name request missing or mis-scoped';
  end if;
end $$;
select pg_temp.expect_sqlstate('Parent cannot apply',
  'select public.management_apply_parent_name_correction((select id from qa_parent_correction))',
  '42501');
select pg_temp.expect_sqlstate('Duplicate pending request',
  $$select public.management_submit_parent_name_correction('Another Parent Name','Another synthetic name request')$$,
  '23505');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000102',true);
do $$ begin
  if (select count(*) from public.privacy_parent_name_correction_proposals p
      join qa_parent_correction q on q.id=p.privacy_request_id)<>0 then
    raise exception 'Other Parent can see name proposal';
  end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000501',true);
select pg_temp.expect_sqlstate('Admin cannot apply before scope/approval',
  'select public.management_apply_parent_name_correction((select id from qa_parent_correction))',
  '23514');
select public.management_replace_privacy_scope(
  (select id from qa_parent_correction),
  '[{"data_category":"profile_data","table_name":"profiles","estimated_record_count":1,"action_recommendation":"review","parent_export_allowed":true,"notes":"Synthetic own profile only"}]'::jsonb);
update public.privacy_rights_requests set status='approved',
  reviewer_id='00000000-0000-4000-8000-000000000501',
  decision_reason='Verified synthetic Parent self-name correction',
  response_summary='Approved for bounded profile name correction'
where id=(select id from qa_parent_correction);
update public.profiles set full_name='QA Changed After Request'
  where id='00000000-0000-4000-8000-000000000101';
select pg_temp.expect_sqlstate('Changed source name blocks apply',
  'select public.management_apply_parent_name_correction((select id from qa_parent_correction))',
  '23514');
do $$ begin
  if (select status from public.privacy_rights_requests
      where id=(select id from qa_parent_correction))<>'approved' then
    raise exception 'Failed correction changed request status';
  end if;
end $$;
update public.profiles set full_name=(select old_name from qa_parent_correction)
  where id='00000000-0000-4000-8000-000000000101';
select public.management_apply_parent_name_correction((select id from qa_parent_correction));
do $$ begin
  if (select full_name from public.profiles
      where id='00000000-0000-4000-8000-000000000101')<>'QA Parent Name Corrected'
     or (select count(*) from public.privacy_rights_requests r
         join qa_parent_correction q on q.id=r.id
         where r.status='completed' and r.execution_status='completed')<>1
     or (select count(*) from public.privacy_execution_actions a
         join qa_parent_correction q on q.id=a.privacy_request_id
         join public.immutable_audit_events e on e.id=a.audit_event_id
         where a.action_type='correct' and a.target_table='profiles'
           and a.status='completed' and e.event_type='privacy_execution_completed'
           and e.event_hash is not null)<>1 then
    raise exception 'Parent correction not atomically applied and audited';
  end if;
end $$;
select pg_temp.expect_sqlstate('Cannot apply correction twice',
  'select public.management_apply_parent_name_correction((select id from qa_parent_correction))',
  '23514');
rollback;
