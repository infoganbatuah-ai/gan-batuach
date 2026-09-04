-- Activate only the explicitly authorized channel-1 lighting policy after the
-- production event refresh path and physical Gateway executor were verified.
begin;

do $$
declare
  site_id constant uuid := 'cc1673b8-3eb0-4785-a12c-1fb88f425a41';
  camera_id constant uuid := '6fddc732-13df-4268-9f32-3357262ea997';
begin
  if to_regprocedure('public.enqueue_digital_guard_capability_refresh_v1(uuid,text,text)') is null then
    raise exception 'Digital Guard capability refresh RPC is unavailable';
  end if;
  if not exists (
    select 1 from public.observer_sites
    where id = site_id and owner_profile_id is not null and monitoring_enabled is true
      and metadata ->> 'observer_monitoring_consent' = 'true'
  ) then raise exception 'Observer site monitoring consent is unavailable'; end if;
  if not exists (
    select 1 from public.digital_observer_camera_sources
    where id = camera_id and observer_site_id = site_id
      and status in ('connected','online','active','ready')
      and health_status in ('healthy','online','connected','ok')
      and coalesce(metadata ->> 'monitoring_enabled','true') <> 'false'
      and metadata ->> 'gateway_id' is not null
      and metadata ->> 'gateway_stream_id' is not null
      and jsonb_typeof(metadata -> 'dvr_channel') = 'number'
      and (metadata ->> 'dvr_channel')::integer = 1
  ) then raise exception 'Authorized channel 1 source is not live or correctly bound'; end if;
  if not exists (
    select 1 from public.digital_observer_camera_action_requests
    where observer_site_id = site_id and camera_source_id = camera_id
      and task_kind = 'capability_snapshot' and action_status = 'completed'
      and result ->> 'reported_by_gateway' = 'true'
      and result #>> '{outcome_payload,executor_installed}' = 'true'
      and result #>> '{outcome_payload,capabilities,lighting}' = 'true'
      and result #>> '{outcome_payload,gateway_id}' = (
        select metadata ->> 'gateway_id' from public.digital_observer_camera_sources where id = camera_id
      )
  ) then raise exception 'Verified Gateway lighting capability is unavailable'; end if;
  if exists (
    select 1 from public.digital_observer_camera_action_requests
    where camera_source_id = camera_id and task_kind = 'physical_command'
      and action_status in ('reconciliation_required','unknown')
  ) then raise exception 'A physical command requires operator reconciliation'; end if;
  if not exists (
    select 1 from public.digital_observer_camera_automation_policies
    where observer_site_id = site_id and camera_source_id = camera_id
      and allowed_actions = array['lighting']::text[]
      and lighting_event_types = array['person_detected']::text[]
      and minimum_confidence = 0.9000
      and active_from = '22:00' and active_until = '06:00'
      and metadata ->> 'approval_scope' = 'explicit_user_authorization_2026_09_02'
  ) then raise exception 'Authorized channel 1 policy shape is unavailable'; end if;

  update public.digital_observer_camera_automation_policies
  set enabled = true,
      metadata = metadata || jsonb_build_object(
        'activation_state','active',
        'activated_at',clock_timestamp(),
        'activation_release','digital_guard_event_capability_refresh_v1',
        'gateway_executor_verified',true
      ),
      updated_at = clock_timestamp()
  where observer_site_id = site_id and camera_source_id = camera_id;

  update public.digital_observer_camera_automation_policies
  set enabled = false, updated_at = clock_timestamp()
  where observer_site_id = site_id
    and camera_source_id in (
      '1de04a0a-d616-4072-ab53-a93d6d0366e2'::uuid,
      '3cf274ef-7b90-40c4-8cf9-b425ca04e035'::uuid,
      'd260f549-a14d-47f6-a8a2-969c0fff92fe'::uuid,
      'e9f8abf3-5895-494e-b1cf-ea8818602851'::uuid
    );

  insert into public.immutable_audit_events (
    event_type,event_category,actor_profile_id,actor_role,target_type,target_id,
    camera_id,metadata,risk_level
  )
  select 'digital_guard_channel_1_lighting_activated_v1','camera',site.owner_profile_id,
    'observer_site_owner','digital_observer_camera_source',camera_id,camera_id,
    jsonb_build_object('schema','digital_guard_channel_1_lighting_activation_v1',
      'observer_site_id',site_id,'channel',1,'allowed_actions',jsonb_build_array('lighting'),
      'event_types',jsonb_build_array('person_detected'),'minimum_confidence',0.9,
      'schedule','22:00-06:00 Asia/Jerusalem','automatic',true,'duration_ms',20000,
      'physical_test_performed',false,'siren_enabled',false,'ptz_enabled',false,'talkback_enabled',false,
      'activated_at',clock_timestamp()),
    'critical'
  from public.observer_sites site where site.id = site_id;
end;
$$;

notify pgrst, 'reload schema';
commit;
