-- Explicit owner authorization recorded on 2026-09-02.
-- Lighting is authorized for channel 1 at night and remains disabled until
-- the bounded-pulse Gateway upgrade is installed and restarted. Siren policies
-- for channels 2/6/8/11 remain disabled until each camera has a valid,
-- user-positioned crossing line. No geometry is invented by this migration.
begin;

create or replace function public.camera_physical_payload_valid(action_name text, value jsonb)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog, pg_temp
as $$
declare
  item text;
  allowed text[];
begin
  if jsonb_typeof(value) <> 'object' then return false; end if;
  if action_name = 'lighting' then
    allowed := array['enabled','level','duration_ms'];
    if jsonb_typeof(value -> 'enabled') <> 'boolean' then return false; end if;
    if value ? 'level' and (jsonb_typeof(value -> 'level') <> 'number' or (value ->> 'level')::integer not between 0 and 100) then return false; end if;
    if value ? 'duration_ms' and (value ->> 'enabled')::boolean is not true then return false; end if;
    if value ? 'duration_ms' and (jsonb_typeof(value -> 'duration_ms') <> 'number'
      or (value ->> 'duration_ms')::integer not between 1000 and 30000) then return false; end if;
  elsif action_name = 'siren' then
    allowed := array['enabled','duration_ms','volume'];
    if jsonb_typeof(value -> 'enabled') <> 'boolean' or jsonb_typeof(value -> 'duration_ms') <> 'number'
      or (value ->> 'duration_ms')::integer not between 250 and 5000 then return false; end if;
    if value ? 'volume' and (jsonb_typeof(value -> 'volume') <> 'number' or (value ->> 'volume')::integer not between 0 and 100) then return false; end if;
  elsif action_name = 'ptz' then
    allowed := array['command','duration_ms','speed'];
    if value ->> 'command' not in ('Ptz_Cmd_Up','Ptz_Cmd_Down','Ptz_Cmd_Left','Ptz_Cmd_Right',
      'Ptz_Cmd_UpLeft','Ptz_Cmd_UpRight','Ptz_Cmd_DownLeft','Ptz_Cmd_DownRight',
      'Ptz_Cmd_ZoomMinus','Ptz_Cmd_ZoomAdd','Ptz_Cmd_FocusMinus','Ptz_Cmd_FocusAdd')
      or jsonb_typeof(value -> 'duration_ms') <> 'number' or (value ->> 'duration_ms')::integer not between 50 and 500
      or jsonb_typeof(value -> 'speed') <> 'number' or (value ->> 'speed')::integer not between 0 and 100 then return false; end if;
  else return false;
  end if;
  for item in select jsonb_object_keys(value) loop
    if not item = any(allowed) then return false; end if;
  end loop;
  return true;
exception when others then return false;
end;
$$;

create or replace function public.digital_guard_crossing_line_valid(value jsonb)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when jsonb_typeof(value) = 'object'
      and value ->> 'axis' in ('x','y')
      and value ->> 'inside' in ('positive','negative')
      and jsonb_typeof(value -> 'position') = 'number'
    then (value ->> 'position')::numeric between 0.05 and 0.95
    else false
  end;
$$;

revoke all on function public.digital_guard_crossing_line_valid(jsonb) from public, anon, authenticated;
grant execute on function public.digital_guard_crossing_line_valid(jsonb) to service_role;

create or replace function public.enforce_digital_guard_siren_crossing_line()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  crossing_line jsonb;
begin
  if new.enabled and 'siren' = any(new.allowed_actions) then
    select metadata -> 'crossing_line' into crossing_line
    from public.digital_observer_camera_sources
    where id = new.camera_source_id and observer_site_id = new.observer_site_id;
    if not public.digital_guard_crossing_line_valid(crossing_line) then
      raise exception 'Siren automation requires a valid crossing line'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_digital_guard_siren_crossing_line() from public, anon, authenticated;
drop trigger if exists enforce_digital_guard_siren_crossing_line on public.digital_observer_camera_automation_policies;
create trigger enforce_digital_guard_siren_crossing_line
before insert or update of enabled, allowed_actions, camera_source_id, observer_site_id
on public.digital_observer_camera_automation_policies
for each row execute function public.enforce_digital_guard_siren_crossing_line();

create or replace function public.sync_authorized_siren_policy_to_crossing_line()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.observer_site_id = 'cc1673b8-3eb0-4785-a12c-1fb88f425a41'::uuid
    and new.id in (
      '1de04a0a-d616-4072-ab53-a93d6d0366e2'::uuid,
      '3cf274ef-7b90-40c4-8cf9-b425ca04e035'::uuid,
      'd260f549-a14d-47f6-a8a2-969c0fff92fe'::uuid,
      'e9f8abf3-5895-494e-b1cf-ea8818602851'::uuid
    ) then
    update public.digital_observer_camera_automation_policies
    set enabled = public.digital_guard_crossing_line_valid(new.metadata -> 'crossing_line'),
        updated_at = clock_timestamp(),
        metadata = metadata || jsonb_build_object(
          'activation_state', case when public.digital_guard_crossing_line_valid(new.metadata -> 'crossing_line')
            then 'active' else 'authorized_waiting_for_crossing_line' end,
          'crossing_line_checked_at', clock_timestamp()
        )
    where observer_site_id = new.observer_site_id
      and camera_source_id = new.id
      and allowed_actions = array['siren']::text[]
      and metadata ->> 'approval_scope' = 'explicit_user_authorization_2026_09_02';
  end if;
  return new;
end;
$$;

revoke all on function public.sync_authorized_siren_policy_to_crossing_line() from public, anon, authenticated;
drop trigger if exists sync_authorized_siren_policy_to_crossing_line on public.digital_observer_camera_sources;
create trigger sync_authorized_siren_policy_to_crossing_line
after update of metadata on public.digital_observer_camera_sources
for each row execute function public.sync_authorized_siren_policy_to_crossing_line();

do $$
declare
  expected integer;
begin
  select count(*) into expected
  from public.digital_observer_camera_sources
  where observer_site_id = 'cc1673b8-3eb0-4785-a12c-1fb88f425a41'
    and id in (
      '6fddc732-13df-4268-9f32-3357262ea997',
      '1de04a0a-d616-4072-ab53-a93d6d0366e2',
      '3cf274ef-7b90-40c4-8cf9-b425ca04e035',
      'd260f549-a14d-47f6-a8a2-969c0fff92fe',
      'e9f8abf3-5895-494e-b1cf-ea8818602851'
    )
    and status in ('connected','online','active','ready')
    and health_status in ('healthy','online','connected','ok');
  if expected <> 5 then
    raise exception 'Authorized camera scope is incomplete or unhealthy';
  end if;
  if not exists (
    select 1 from public.observer_sites
    where id = 'cc1673b8-3eb0-4785-a12c-1fb88f425a41' and owner_profile_id is not null
  ) then
    raise exception 'Authorized observer site owner is unavailable';
  end if;
end;
$$;

update public.digital_observer_camera_sources
set metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{zone_type}', '"INDOOR"'::jsonb, true),
    updated_at = clock_timestamp()
where observer_site_id = 'cc1673b8-3eb0-4785-a12c-1fb88f425a41'
  and id = '6fddc732-13df-4268-9f32-3357262ea997';

with mapping(camera_id, display_name, location_label, zone_type) as (
  values
    ('1de04a0a-d616-4072-ab53-a93d6d0366e2'::uuid, 'חנייה — ערוץ 2', 'חנייה', 'PARKING'),
    ('3cf274ef-7b90-40c4-8cf9-b425ca04e035'::uuid, 'כניסה למשרד — ערוץ 6', 'כניסה למשרד', 'ENTRANCE'),
    ('d260f549-a14d-47f6-a8a2-969c0fff92fe'::uuid, 'מחסן — ערוץ 8', 'מחסן', 'INDOOR'),
    ('e9f8abf3-5895-494e-b1cf-ea8818602851'::uuid, 'כניסה לבית — ערוץ 11', 'כניסה לבית', 'ENTRANCE')
)
update public.digital_observer_camera_sources source
set display_name = mapping.display_name,
    location_label = mapping.location_label,
    metadata = jsonb_set(coalesce(source.metadata, '{}'::jsonb), '{zone_type}', to_jsonb(mapping.zone_type), true),
    updated_at = clock_timestamp()
from mapping
where source.id = mapping.camera_id
  and source.observer_site_id = 'cc1673b8-3eb0-4785-a12c-1fb88f425a41';

insert into public.digital_observer_camera_automation_policies (
  observer_site_id,camera_source_id,enabled,allowed_actions,lighting_event_types,siren_event_types,
  minimum_confidence,siren_minimum_confidence,siren_duration_ms,active_from,active_until,
  lighting_cooldown_seconds,siren_cooldown_seconds,siren_hourly_limit,approved_by,approved_at,metadata
)
select
  site.id,'6fddc732-13df-4268-9f32-3357262ea997',false,array['lighting']::text[],
  array['person_detected']::text[],array['person_entered']::text[],
  0.9000,0.9500,1000,'22:00','06:00',30,300,3,site.owner_profile_id,clock_timestamp(),
  jsonb_build_object(
    'approval_scope','explicit_user_authorization_2026_09_02',
    'activation_state','authorized_waiting_for_gateway_upgrade_and_restart','authorized_action','twenty_second_lighting_pulse_on_verified_person_at_night',
    'authorized_channel',1,'ptz_allowed',false,'talkback_allowed',false
  )
from public.observer_sites site
where site.id = 'cc1673b8-3eb0-4785-a12c-1fb88f425a41'
on conflict (observer_site_id,camera_source_id) do update set
  enabled = false,
  allowed_actions = array['lighting']::text[],
  lighting_event_types = array['person_detected']::text[],
  siren_event_types = array['person_entered']::text[],
  minimum_confidence = 0.9000,
  siren_minimum_confidence = 0.9500,
  siren_duration_ms = 1000,
  active_from = '22:00', active_until = '06:00',
  approved_by = excluded.approved_by, approved_at = clock_timestamp(),
  metadata = excluded.metadata, updated_at = clock_timestamp();

with authorized(camera_id, channel, siren_events) as (
  values
    ('1de04a0a-d616-4072-ab53-a93d6d0366e2'::uuid, 2, array['vehicle_entered']::text[]),
    ('3cf274ef-7b90-40c4-8cf9-b425ca04e035'::uuid, 6, array['person_entered']::text[]),
    ('d260f549-a14d-47f6-a8a2-969c0fff92fe'::uuid, 8, array['person_entered']::text[]),
    ('e9f8abf3-5895-494e-b1cf-ea8818602851'::uuid, 11, array['person_entered']::text[])
)
insert into public.digital_observer_camera_automation_policies (
  observer_site_id,camera_source_id,enabled,allowed_actions,lighting_event_types,siren_event_types,
  minimum_confidence,siren_minimum_confidence,siren_duration_ms,active_from,active_until,
  lighting_cooldown_seconds,siren_cooldown_seconds,siren_hourly_limit,approved_by,approved_at,metadata
)
select
  site.id,authorized.camera_id,
  public.digital_guard_crossing_line_valid(source.metadata -> 'crossing_line'),
  array['siren']::text[],array['person_detected']::text[],authorized.siren_events,
  0.9500,0.9500,1000,'00:00','00:00',30,300,3,site.owner_profile_id,clock_timestamp(),
  jsonb_build_object(
    'approval_scope','explicit_user_authorization_2026_09_02',
    'activation_state',case when public.digital_guard_crossing_line_valid(source.metadata -> 'crossing_line')
      then 'active' else 'authorized_waiting_for_crossing_line' end,
    'authorized_action','one_second_siren_on_critical_verified_line_crossing',
    'authorized_channel',authorized.channel,'ptz_allowed',false,'talkback_allowed',false
  )
from authorized
join public.digital_observer_camera_sources source on source.id = authorized.camera_id
join public.observer_sites site on site.id = source.observer_site_id
where site.id = 'cc1673b8-3eb0-4785-a12c-1fb88f425a41'
on conflict (observer_site_id,camera_source_id) do update set
  enabled = excluded.enabled,
  allowed_actions = array['siren']::text[],
  lighting_event_types = excluded.lighting_event_types,
  siren_event_types = excluded.siren_event_types,
  minimum_confidence = 0.9500,
  siren_minimum_confidence = 0.9500,
  siren_duration_ms = 1000,
  active_from = '00:00', active_until = '00:00',
  approved_by = excluded.approved_by, approved_at = clock_timestamp(),
  metadata = excluded.metadata, updated_at = clock_timestamp();

insert into public.immutable_audit_events (
  event_type,event_category,actor_profile_id,actor_role,target_type,target_id,metadata,risk_level
)
select
  'digital_guard_physical_automation_authorized_v1','camera',site.owner_profile_id,'observer_site_owner',
  'observer_site',site.id,
  jsonb_build_object(
    'schema','digital_guard_physical_automation_authorization_v1',
    'authorized_at',clock_timestamp(),
    'lighting',jsonb_build_object('channel',1,'schedule','22:00-06:00','event','verified_person','automatic',true,'duration_ms',20000),
    'siren',jsonb_build_object('channels',jsonb_build_array(2,6,8,11),'duration_ms',1000,
      'event','critical_verified_line_crossing','automatic',true,'requires_configured_crossing_line',true),
    'ptz_allowed',false,'talkback_allowed',false
  ),'critical'
from public.observer_sites site
where site.id = 'cc1673b8-3eb0-4785-a12c-1fb88f425a41';

-- Replace the autonomous enqueue RPC so an authorized lighting event is a
-- bounded 20-second pulse. The local executor verifies both ON and OFF state.
create or replace function public.enqueue_digital_guard_camera_command_v1(
  signal_id uuid, requested_action text, requested_payload jsonb, requested_payload_digest text
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
  snapshot public.digital_observer_camera_action_requests%rowtype;
  existing public.digital_observer_camera_action_requests%rowtype;
  request_id uuid := gen_random_uuid();
  authorization_id uuid := gen_random_uuid();
  requested_at timestamptz := clock_timestamp();
  expires_at timestamptz := requested_at + interval '30 seconds';
  observed_at timestamptz;
  local_time time;
  event_type text;
  evidence_kind text;
  expected_digest text;
  intent_digest text;
  capability jsonb;
  recent_count integer;
begin
  if requested_action not in ('lighting','siren') or not public.camera_physical_payload_valid(requested_action, requested_payload) then
    return jsonb_build_object('status','blocked','reason','invalid_action_payload','action',requested_action);
  end if;
  if requested_action = 'lighting' and requested_payload <> '{"duration_ms":20000,"enabled":true}'::jsonb then
    return jsonb_build_object('status','blocked','reason','lighting_requires_twenty_second_pulse','action',requested_action);
  end if;
  if requested_action = 'siren' and requested_payload <> '{"enabled":true,"duration_ms":1000}'::jsonb then
    return jsonb_build_object('status','blocked','reason','siren_must_be_one_second','action',requested_action);
  end if;
  expected_digest := encode(extensions.digest(case when requested_action = 'lighting'
    then '{"duration_ms":20000,"enabled":true}' else '{"duration_ms":1000,"enabled":true}' end, 'sha256'::text), 'hex');
  if requested_payload_digest is distinct from expected_digest then
    return jsonb_build_object('status','blocked','reason','payload_digest_mismatch','action',requested_action);
  end if;

  select * into signal from public.observer_intelligence_signals where id = signal_id;
  if not found then return jsonb_build_object('status','blocked','reason','event_not_found','action',requested_action); end if;
  event_type := signal.metadata ->> 'event_type';
  evidence_kind := signal.metadata ->> 'evidence_kind';
  begin observed_at := (signal.metadata ->> 'first_seen')::timestamptz;
  exception when others then return jsonb_build_object('status','blocked','reason','event_time_invalid','action',requested_action); end;
  if signal.metadata ->> 'validated_event' <> 'true' or observed_at > requested_at + interval '5 seconds'
    or observed_at < requested_at - interval '20 seconds' then
    return jsonb_build_object('status','blocked','reason','event_not_fresh_and_verified','action',requested_action);
  end if;

  select * into policy from public.digital_observer_camera_automation_policies
  where observer_site_id = signal.observer_site_id
    and camera_source_id = (signal.metadata ->> 'camera_source_id')::uuid
    and enabled = true for update;
  if not found then return jsonb_build_object('status','blocked','reason','policy_disabled','action',requested_action); end if;
  if not requested_action = any(policy.allowed_actions) then
    return jsonb_build_object('status','blocked','reason','action_not_allowed','action',requested_action);
  end if;
  if signal.confidence < (case when requested_action = 'siren' then policy.siren_minimum_confidence else policy.minimum_confidence end) then
    return jsonb_build_object('status','blocked','reason','confidence_too_low','action',requested_action);
  end if;
  if requested_action = 'lighting' and not event_type = any(policy.lighting_event_types) then
    return jsonb_build_object('status','blocked','reason','event_not_allowed','action',requested_action);
  end if;
  if requested_action = 'siren' and (not event_type = any(policy.siren_event_types)
    or evidence_kind <> 'line_crossing' or signal.severity <> 'critical') then
    return jsonb_build_object('status','blocked','reason','siren_requires_critical_line_crossing','action',requested_action);
  end if;

  select * into site from public.observer_sites where id = policy.observer_site_id;
  select * into source from public.digital_observer_camera_sources
  where id = policy.camera_source_id and observer_site_id = policy.observer_site_id;
  if site.id is null or source.id is null or site.monitoring_enabled is not true
    or site.metadata ->> 'observer_monitoring_consent' <> 'true'
    or source.status not in ('connected','online','active','ready')
    or source.health_status not in ('healthy','online','connected','ok')
    or source.metadata ->> 'monitoring_enabled' = 'false' then
    return jsonb_build_object('status','blocked','reason','camera_or_monitoring_offline','action',requested_action);
  end if;
  local_time := (requested_at at time zone coalesce(site.timezone, 'Asia/Jerusalem'))::time;
  if policy.active_from < policy.active_until then
    if local_time < policy.active_from or local_time >= policy.active_until then
      return jsonb_build_object('status','blocked','reason','outside_active_schedule','action',requested_action);
    end if;
  elsif local_time < policy.active_from and local_time >= policy.active_until then
    return jsonb_build_object('status','blocked','reason','outside_active_schedule','action',requested_action);
  end if;

  select * into existing from public.digital_observer_camera_action_requests
  where automation_event_id = signal_id and action_type = requested_action
    and authorization_kind = 'digital_guard_policy' limit 1;
  if found then
    return jsonb_build_object('status','duplicate','request_id',existing.id,'action',requested_action,'action_status',existing.action_status);
  end if;
  if exists (
    select 1 from public.digital_observer_camera_action_requests
    where camera_source_id = source.id and task_kind = 'physical_command'
      and action_status in ('reconciliation_required','unknown')
  ) then return jsonb_build_object('status','blocked','reason','operator_reconciliation_required','action',requested_action); end if;

  select * into snapshot from public.digital_observer_camera_action_requests
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
  if not found then return jsonb_build_object('status','blocked','reason','fresh_capability_evidence_required','action',requested_action); end if;

  if requested_action = 'lighting' then
    if exists (
      select 1 from public.digital_observer_camera_action_requests
      where camera_source_id = source.id and action_type = 'lighting'
        and authorization_kind = 'digital_guard_policy'
        and created_at >= requested_at - make_interval(secs => policy.lighting_cooldown_seconds)
    ) then return jsonb_build_object('status','blocked','reason','lighting_cooldown','action',requested_action); end if;
  else
    if exists (
      select 1 from public.digital_observer_camera_action_requests
      where camera_source_id = source.id and action_type = 'siren'
        and authorization_kind = 'digital_guard_policy'
        and created_at >= requested_at - make_interval(secs => policy.siren_cooldown_seconds)
    ) then return jsonb_build_object('status','blocked','reason','siren_cooldown','action',requested_action); end if;
    select count(*) into recent_count from public.digital_observer_camera_action_requests
    where camera_source_id = source.id and action_type = 'siren'
      and authorization_kind = 'digital_guard_policy' and created_at >= requested_at - interval '1 hour';
    if recent_count >= policy.siren_hourly_limit then
      return jsonb_build_object('status','blocked','reason','siren_hourly_limit','action',requested_action);
    end if;
  end if;

  capability := jsonb_build_object(
    'adapter', snapshot.result #>> '{outcome_payload,driver}', 'action', requested_action,
    'supported', true, 'executor_installed', true,
    'evidence_id', snapshot.result #>> '{outcome_payload,evidence_id}',
    'verified_at', snapshot.result #>> '{outcome_payload,verified_at}',
    'site_id', site.id, 'camera_id', source.id,
    'gateway_id', snapshot.result #>> '{outcome_payload,gateway_id}',
    'stream_id', snapshot.result #>> '{outcome_payload,stream_id}',
    'channel', snapshot.result #> '{outcome_payload,channel}',
    'source_generation', snapshot.result #>> '{outcome_payload,source_generation}',
    'binding_generation', snapshot.result #>> '{outcome_payload,binding_generation}',
    'live', snapshot.result #> '{outcome_payload,live}'
  );
  intent_digest := encode(extensions.digest(concat_ws('|', request_id::text, authorization_id::text,
    site.id::text, source.id::text, capability ->> 'gateway_id', capability ->> 'stream_id',
    capability ->> 'channel', capability ->> 'source_generation', capability ->> 'binding_generation',
    requested_action, requested_payload_digest, policy.id::text, signal.id::text, policy.approved_by::text,
    expires_at::text), 'sha256'::text), 'hex');

  insert into public.digital_observer_camera_action_requests (
    id,observer_site_id,camera_source_id,requested_by,confirmed_by,action_type,request_origin,action_status,
    parameters,capability_evidence,idempotency_key,expires_at,confirmed_at,task_kind,gateway_id,stream_id,channel,
    requested_at,payload_digest,confirmation_id,confirmation_expires_at,dispatch_intent_digest,
    source_generation,binding_generation,authorization_kind,automation_policy_id,automation_event_id
  ) values (
    request_id,site.id,source.id,policy.approved_by,policy.approved_by,requested_action,'digital_guard','approved',
    requested_payload,capability,concat('digital_guard:',signal.id,':',requested_action),expires_at,requested_at,
    'physical_command',capability ->> 'gateway_id',capability ->> 'stream_id',(capability ->> 'channel')::integer,
    requested_at,requested_payload_digest,authorization_id,expires_at,intent_digest,
    capability ->> 'source_generation',capability ->> 'binding_generation','digital_guard_policy',policy.id,signal.id
  );
  insert into public.immutable_audit_events (
    event_type,event_category,actor_profile_id,actor_role,target_type,target_id,camera_id,request_id,metadata,risk_level
  ) values (
    'digital_guard_autonomous_dispatch_intent_v1','camera',policy.approved_by,'digital_guard_policy',
    'digital_observer_camera_source',source.id,source.id,request_id::text,
    jsonb_build_object('schema','digital_guard_autonomous_dispatch_v1','site_id',site.id,'camera_id',source.id,
      'policy_id',policy.id,'event_id',signal.id,'event_type',event_type,'evidence_kind',evidence_kind,
      'action',requested_action,'payload_digest',requested_payload_digest,'authorization_id',authorization_id,
      'authorization_kind','digital_guard_policy','dispatch_intent_digest',intent_digest,
      'expires_at',expires_at,'siren_duration_ms',case when requested_action = 'siren' then 1000 else null end,
      'lighting_duration_ms',case when requested_action = 'lighting' then 20000 else null end),
    'critical'
  );
  return jsonb_build_object('status','queued','request_id',request_id,'action',requested_action,'action_status','approved');
end;
$$;

revoke all on function public.enqueue_digital_guard_camera_command_v1(uuid,text,jsonb,text) from public, anon, authenticated;
grant execute on function public.enqueue_digital_guard_camera_command_v1(uuid,text,jsonb,text) to service_role;

notify pgrst, 'reload schema';
commit;
