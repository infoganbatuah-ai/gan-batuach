-- Disposable QA database only. These IDs model migration guard inputs; no
-- Home camera, network endpoint, credential, or real footage is contacted.
\set ON_ERROR_STOP on
begin;
do $$ begin
  if exists (select 1 from public.observer_sites where id='cc1673b8-3eb0-4785-a12c-1fb88f425a41')
    then raise exception 'synthetic fixture requires an empty disposable database'; end if;
end $$;
insert into auth.users(id) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
update public.profiles set role='owner', full_name='Synthetic QA Owner'
where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
insert into public.observer_sites(id,name,site_type,owner_profile_id,monitoring_enabled,metadata)
values ('cc1673b8-3eb0-4785-a12c-1fb88f425a41','Synthetic QA Home','home',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true,'{"observer_monitoring_consent":"true","synthetic_fixture":true}');
insert into public.digital_observer_camera_sources
  (id,observer_site_id,display_name,status,health_status,metadata,created_at)
values
  ('6fddc732-13df-4268-9f32-3357262ea997','cc1673b8-3eb0-4785-a12c-1fb88f425a41','Synthetic CH1','connected','healthy','{"gateway_id":"synthetic-gateway","gateway_stream_id":"synthetic-1","dvr_channel":1,"monitoring_enabled":true}',now()-interval '5 minutes'),
  ('1de04a0a-d616-4072-ab53-a93d6d0366e2','cc1673b8-3eb0-4785-a12c-1fb88f425a41','Synthetic CH2','connected','healthy','{}',now()-interval '4 minutes'),
  ('3cf274ef-7b90-40c4-8cf9-b425ca04e035','cc1673b8-3eb0-4785-a12c-1fb88f425a41','Synthetic CH6','connected','healthy','{}',now()-interval '3 minutes'),
  ('d260f549-a14d-47f6-a8a2-969c0fff92fe','cc1673b8-3eb0-4785-a12c-1fb88f425a41','Synthetic CH8','connected','healthy','{}',now()-interval '2 minutes'),
  ('e9f8abf3-5895-494e-b1cf-ea8818602851','cc1673b8-3eb0-4785-a12c-1fb88f425a41','Synthetic CH11','connected','healthy','{}',now()-interval '1 minute');
insert into public.digital_observer_camera_automation_policies
  (observer_site_id,camera_source_id,enabled,allowed_actions,approved_by,metadata)
values ('cc1673b8-3eb0-4785-a12c-1fb88f425a41',
  '6fddc732-13df-4268-9f32-3357262ea997',false,array['lighting']::text[],
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','{"synthetic_fixture":true}');
insert into public.digital_observer_camera_action_requests
  (id,observer_site_id,camera_source_id,requested_by,action_type,action_status,
   idempotency_key,task_kind,gateway_id,stream_id,channel,requested_at,expires_at)
values ('cc1673b8-3eb0-4785-a12c-1fb88f425a42',
  'cc1673b8-3eb0-4785-a12c-1fb88f425a41',
  '6fddc732-13df-4268-9f32-3357262ea997',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','capability_snapshot','approved',
  'synthetic-capability-snapshot','capability_snapshot',
  'synthetic-gateway','synthetic-1',1,now(),now()+interval '2 minutes');
update public.digital_observer_camera_action_requests
set action_status='delivered', delivered_at=now()
where id='cc1673b8-3eb0-4785-a12c-1fb88f425a42';
update public.digital_observer_camera_action_requests
set action_status='completed',completed_at=now(),result_digest=repeat('a',64),
    result=jsonb_build_object('request_id',id,'outcome','capability_snapshot',
      'reported_by_gateway','true','outcome_payload',jsonb_build_object(
        'camera_id',camera_source_id,'site_id',observer_site_id,'stream_id',stream_id,
        'channel',channel,'executed',false,'executor_installed','true',
        'capabilities',jsonb_build_object('lighting','true'),
        'gateway_id',gateway_id))
where id='cc1673b8-3eb0-4785-a12c-1fb88f425a42';
insert into public.observer_intelligence_signals
  (id,signal_type,source_type,observer_site_id,metadata)
values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','pattern','system',
  'cc1673b8-3eb0-4785-a12c-1fb88f425a41',
  '{"event_type":"home_learning_started","synthetic_fixture":true}');
insert into public.digital_observer_event_clips(observer_site_id,title,clip_status,metadata)
values ('cc1673b8-3eb0-4785-a12c-1fb88f425a41','Synthetic missing media','readiness',
  '{"synthetic_fixture":true}');
commit;
