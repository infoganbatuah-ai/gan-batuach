-- Rollback-only synthetic Development load test. Never run against Production.
begin;
create temp table gb_m30_fanout_users(id uuid primary key) on commit drop;
with created as (
  insert into auth.users(id,email,raw_user_meta_data)
  select gen_random_uuid(), 'qa-gbm30-fanout-' || n || '@integration.qa.invalid',
         '{"full_name":"QA Broadcast Parent","environment":"DEVELOPMENT"}'::jsonb
  from generate_series(1,50) n returning id
)
insert into gb_m30_fanout_users select id from created;
insert into public.child_guardian_links(permanent_child_file_id,guardian_profile_id)
select c.permanent_child_file_id,u.id from gb_m30_fanout_users u
cross join public.children c where c.id='00000000-0000-4000-8000-000000000901';

select set_config('gb_m30.expected_recipients',
  (select count(distinct l.guardian_profile_id)::text
   from public.child_guardian_links l
   join public.children c on c.permanent_child_file_id=l.permanent_child_file_id
   join public.child_kindergarten_enrollments e on e.child_id=c.id
   join public.child_classroom_assignments a on a.child_id=c.id and a.garden_id=e.garden_id and a.is_current
   where e.garden_id='00000000-0000-4000-8000-000000000601' and e.status='active'
     and a.classroom_id='00000000-0000-4000-8000-000000000701'
     and l.status='active' and l.legal_authority),true);
select set_config('gb_m30.broadcast_key',gen_random_uuid()::text,true);
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000201',true);
select set_config('gb_m30.thread',
  (public.create_management_communication_broadcast(
    '00000000-0000-4000-8000-000000000601',
    '00000000-0000-4000-8000-000000000701',
    'parents','QA broadcast','QA private broadcast body',
    current_setting('gb_m30.broadcast_key')::uuid)->>'thread_id'),true);
do $$ begin
  if (public.create_management_communication_broadcast(
    '00000000-0000-4000-8000-000000000601',
    '00000000-0000-4000-8000-000000000701',
    'parents','QA broadcast','QA private broadcast body',
    current_setting('gb_m30.broadcast_key')::uuid)->>'idempotent')::boolean is distinct from true
  then raise exception 'broadcast_replay_not_idempotent'; end if;
end $$;
reset role;
do $$ declare expected integer := current_setting('gb_m30.expected_recipients')::integer;
  thread uuid := current_setting('gb_m30.thread')::uuid;
begin
  if expected < 50 then raise exception 'synthetic_audience_too_small'; end if;
  if (select count(*) from public.communication_thread_participants where thread_id=thread) <> expected+1
  then raise exception 'broadcast_participant_snapshot_mismatch'; end if;
  if (select count(*) from public.notifications where entity_type='communication_thread' and entity_id=thread) <> expected
  then raise exception 'broadcast_notification_fanout_mismatch'; end if;
  if (select count(distinct recipient_id) from public.notifications where entity_type='communication_thread' and entity_id=thread) <> expected
  then raise exception 'broadcast_recipient_duplicate'; end if;
  if exists (select 1 from public.notifications where entity_id=thread
             and (recipient_id='00000000-0000-4000-8000-000000000102'
               or body='QA private broadcast body' or garden_id<>'00000000-0000-4000-8000-000000000601'))
  then raise exception 'broadcast_cross_garden_or_private_content'; end if;
end $$;
select 'GB-M30 50-parent classroom broadcast fan-out PASS';
rollback;
