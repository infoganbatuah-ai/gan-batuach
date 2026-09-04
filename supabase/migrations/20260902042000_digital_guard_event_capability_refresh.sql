-- A verified Gateway event may need a fresh read-only capability snapshot
-- before an autonomous policy can be evaluated. This RPC can enqueue only
-- that diagnostic; it cannot enqueue or execute a physical command.
begin;

create or replace function public.enqueue_digital_guard_capability_refresh_v1(
  signal_id uuid,
  requested_action text,
  requested_gateway_id text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  policy public.digital_observer_camera_automation_policies%rowtype;
  signal public.observer_intelligence_signals%rowtype;
  source public.digital_observer_camera_sources%rowtype;
  site public.observer_sites%rowtype;
  existing public.digital_observer_camera_action_requests%rowtype;
  request_id uuid := gen_random_uuid();
  requested_at timestamptz := clock_timestamp();
  expires_at timestamptz := requested_at + interval '119 seconds';
  observed_at timestamptz;
  local_time time;
  event_type text;
  evidence_kind text;
begin
  if requested_action not in ('lighting','siren')
    or requested_gateway_id !~ '^[A-Za-z0-9_-]{1,160}$' then
    return jsonb_build_object('status','blocked','reason','invalid_refresh_scope');
  end if;

  select * into signal from public.observer_intelligence_signals where id = signal_id;
  if not found then return jsonb_build_object('status','blocked','reason','event_not_found'); end if;
  event_type := signal.metadata ->> 'event_type';
  evidence_kind := signal.metadata ->> 'evidence_kind';
  begin observed_at := (signal.metadata ->> 'first_seen')::timestamptz;
  exception when others then return jsonb_build_object('status','blocked','reason','event_time_invalid'); end;
  if signal.metadata ->> 'validated_event' <> 'true'
    or observed_at > requested_at + interval '5 seconds'
    or observed_at < requested_at - interval '20 seconds' then
    return jsonb_build_object('status','blocked','reason','event_not_fresh_and_verified');
  end if;

  select * into policy from public.digital_observer_camera_automation_policies
  where observer_site_id = signal.observer_site_id
    and camera_source_id = (signal.metadata ->> 'camera_source_id')::uuid
    and enabled = true
  for update;
  if not found then return jsonb_build_object('status','blocked','reason','policy_disabled'); end if;
  if not requested_action = any(policy.allowed_actions) then
    return jsonb_build_object('status','blocked','reason','action_not_allowed');
  end if;
  if signal.confidence < (case when requested_action = 'siren'
      then policy.siren_minimum_confidence else policy.minimum_confidence end) then
    return jsonb_build_object('status','blocked','reason','confidence_too_low');
  end if;
  if requested_action = 'lighting' and not event_type = any(policy.lighting_event_types) then
    return jsonb_build_object('status','blocked','reason','event_not_allowed');
  end if;
  if requested_action = 'siren' and (not event_type = any(policy.siren_event_types)
      or evidence_kind <> 'line_crossing' or signal.severity <> 'critical') then
    return jsonb_build_object('status','blocked','reason','siren_requires_critical_line_crossing');
  end if;

  select * into site from public.observer_sites where id = policy.observer_site_id;
  select * into source from public.digital_observer_camera_sources
  where id = policy.camera_source_id and observer_site_id = policy.observer_site_id;
  if site.id is null or source.id is null or site.monitoring_enabled is not true
    or site.metadata ->> 'observer_monitoring_consent' <> 'true'
    or source.status not in ('connected','online','active','ready')
    or source.health_status not in ('healthy','online','connected','ok')
    or source.metadata ->> 'monitoring_enabled' = 'false'
    or source.metadata ->> 'gateway_id' <> requested_gateway_id
    or source.metadata ->> 'gateway_stream_id' is null
    or jsonb_typeof(source.metadata -> 'dvr_channel') <> 'number' then
    return jsonb_build_object('status','blocked','reason','camera_or_monitoring_offline');
  end if;
  local_time := (requested_at at time zone coalesce(site.timezone, 'Asia/Jerusalem'))::time;
  if policy.active_from < policy.active_until then
    if local_time < policy.active_from or local_time >= policy.active_until then
      return jsonb_build_object('status','blocked','reason','outside_active_schedule');
    end if;
  elsif local_time < policy.active_from and local_time >= policy.active_until then
    return jsonb_build_object('status','blocked','reason','outside_active_schedule');
  end if;

  select * into existing from public.digital_observer_camera_action_requests
  where observer_site_id = site.id and camera_source_id = source.id
    and task_kind = 'capability_snapshot' and action_status = 'completed'
    and result ->> 'reported_by_gateway' = 'true'
    and result #>> '{outcome_payload,executor_installed}' = 'true'
    and result #>> array['outcome_payload','capabilities',requested_action] = 'true'
    and (result #>> '{outcome_payload,verified_at}')::timestamptz >= requested_at - interval '5 minutes'
    and (result #>> '{outcome_payload,live,verified_at}')::timestamptz >= requested_at - interval '30 seconds'
    and result #>> '{outcome_payload,gateway_id}' = source.metadata ->> 'gateway_id'
    and result #>> '{outcome_payload,stream_id}' = source.metadata ->> 'gateway_stream_id'
    and result #> '{outcome_payload,channel}' = source.metadata -> 'dvr_channel'
  order by completed_at desc limit 1;
  if found then
    return jsonb_build_object('status','fresh','request_id',existing.id,'action',requested_action);
  end if;

  select * into existing from public.digital_observer_camera_action_requests
  where observer_site_id = site.id and camera_source_id = source.id
    and task_kind = 'capability_snapshot' and request_origin = 'digital_guard'
    and action_status in ('approved','delivered') and expires_at > requested_at
  order by created_at desc limit 1;
  if found then
    return jsonb_build_object('status','pending','request_id',existing.id,'action',requested_action);
  end if;

  insert into public.immutable_audit_events (
    id,event_type,event_category,actor_profile_id,actor_role,target_type,target_id,
    camera_id,request_id,metadata,risk_level
  ) values (
    request_id,'digital_guard_capability_refresh_request_v1','camera',policy.approved_by,
    'digital_guard_policy','digital_observer_camera_source',source.id,source.id,request_id::text,
    jsonb_build_object('schema','digital_guard_capability_refresh_v1','observer_site_id',site.id,
      'camera_id',source.id,'gateway_id',requested_gateway_id,'event_id',signal.id,
      'action',requested_action,'requested_at',requested_at,'expires_at',expires_at,
      'executed',false,'physical_confirmation',false),
    'low'
  );

  insert into public.digital_observer_camera_action_requests (
    id,observer_site_id,camera_source_id,requested_by,action_type,request_origin,action_status,
    parameters,capability_evidence,idempotency_key,expires_at,task_kind,gateway_id,stream_id,
    channel,requested_at,payload_digest,authorization_kind
  ) values (
    request_id,site.id,source.id,policy.approved_by,'capability_snapshot','digital_guard','approved',
    '{}'::jsonb,'{}'::jsonb,concat('digital_guard-capability:',signal.id),expires_at,
    'capability_snapshot',requested_gateway_id,source.metadata ->> 'gateway_stream_id',
    (source.metadata ->> 'dvr_channel')::integer,requested_at,null,'human_confirmation'
  );
  return jsonb_build_object('status','queued','request_id',request_id,'action',requested_action);
exception
  when unique_violation then
    select * into existing from public.digital_observer_camera_action_requests
    where idempotency_key = concat('digital_guard-capability:',signal_id)
    order by created_at desc limit 1;
    if found then return jsonb_build_object('status','pending','request_id',existing.id,'action',requested_action); end if;
    raise;
end;
$$;

revoke all on function public.enqueue_digital_guard_capability_refresh_v1(uuid,text,text)
  from public, anon, authenticated;
grant execute on function public.enqueue_digital_guard_capability_refresh_v1(uuid,text,text)
  to service_role;

notify pgrst, 'reload schema';
commit;
