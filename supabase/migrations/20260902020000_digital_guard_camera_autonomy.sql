-- Scoped Digital Guard camera automation. Dashboard commands retain their
-- immediate human-confirmation path; automation has a separate durable policy.
begin;

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.digital_observer_camera_automation_policies (
  id uuid primary key default gen_random_uuid(),
  observer_site_id uuid not null references public.observer_sites(id) on delete cascade,
  camera_source_id uuid not null references public.digital_observer_camera_sources(id) on delete cascade,
  enabled boolean not null default false,
  allowed_actions text[] not null default '{}'::text[],
  lighting_event_types text[] not null default array['person_detected','person_entered','vehicle_entered']::text[],
  siren_event_types text[] not null default array['person_entered','vehicle_entered']::text[],
  minimum_confidence numeric(5,4) not null default 0.9000,
  siren_minimum_confidence numeric(5,4) not null default 0.9500,
  siren_duration_ms integer not null default 1000,
  active_from time not null default '22:00',
  active_until time not null default '06:00',
  lighting_cooldown_seconds integer not null default 30,
  siren_cooldown_seconds integer not null default 300,
  siren_hourly_limit integer not null default 3,
  approved_by uuid not null references public.profiles(id) on delete restrict,
  approved_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_guard_camera_policy_scope_unique unique (observer_site_id, camera_source_id),
  constraint digital_guard_camera_policy_actions_check check (
    allowed_actions <@ array['lighting','siren']::text[]
    and array_length(allowed_actions, 1) between 1 and 2
  ),
  constraint digital_guard_camera_policy_events_check check (
    lighting_event_types <@ array['person_detected','person_entered','vehicle_entered']::text[]
    and siren_event_types <@ array['person_entered','vehicle_entered']::text[]
  ),
  constraint digital_guard_camera_policy_threshold_check check (
    minimum_confidence between 0.5 and 1 and siren_minimum_confidence between 0.9 and 1
    and siren_minimum_confidence >= minimum_confidence
  ),
  constraint digital_guard_camera_policy_siren_check check (siren_duration_ms = 1000),
  constraint digital_guard_camera_policy_limits_check check (
    lighting_cooldown_seconds between 10 and 3600
    and siren_cooldown_seconds between 60 and 3600
    and siren_hourly_limit between 1 and 6
  )
);

alter table public.digital_observer_camera_action_requests
  add column if not exists authorization_kind text not null default 'human_confirmation',
  add column if not exists automation_policy_id uuid references public.digital_observer_camera_automation_policies(id) on delete restrict,
  add column if not exists automation_event_id uuid references public.observer_intelligence_signals(id) on delete restrict;

alter table public.digital_observer_camera_action_requests
  drop constraint if exists digital_observer_camera_action_origin_check,
  drop constraint if exists digital_observer_camera_action_confirmation_check,
  drop constraint if exists camera_queue_physical_confirmation_check,
  drop constraint if exists camera_queue_automation_scope_check;

alter table public.digital_observer_camera_action_requests
  add constraint digital_observer_camera_action_origin_check check (
    request_origin in ('dashboard','observer_chat','digital_guard')
    and (
      task_kind <> 'physical_command'
      or (request_origin = 'dashboard' and authorization_kind = 'human_confirmation')
      or (request_origin = 'digital_guard' and authorization_kind = 'digital_guard_policy')
    )
  ),
  add constraint digital_observer_camera_action_confirmation_check check (
    task_kind not in ('legacy_command','physical_command')
    or action_status in ('awaiting_confirmation','blocked','expired','cancelled')
    or (confirmed_by is not null and confirmed_at is not null)
  ),
  add constraint camera_queue_physical_confirmation_check check (
    task_kind <> 'physical_command' or confirmation_expires_at = expires_at and (
      (
        authorization_kind = 'human_confirmation'
        and confirmation_nonce_hash ~ '^[a-f0-9]{64}$'
        and automation_policy_id is null and automation_event_id is null
        and (
          (action_status = 'awaiting_confirmation' and confirmation_id is null and confirmed_by is null and confirmed_at is null and dispatch_intent_digest is null)
          or (action_status in ('approved','delivered','completed','failed','reconciliation_required','unknown')
            and confirmation_id is not null and confirmed_by is not null and confirmed_at is not null
            and confirmed_at <= confirmation_expires_at and dispatch_intent_digest ~ '^[a-f0-9]{64}$')
          or action_status in ('blocked','expired','cancelled')
        )
      )
      or (
        authorization_kind = 'digital_guard_policy'
        and request_origin = 'digital_guard'
        and confirmation_nonce_hash is null
        and automation_policy_id is not null and automation_event_id is not null
        and confirmation_id is not null and confirmed_by is not null and confirmed_at is not null
        and confirmed_at <= confirmation_expires_at and dispatch_intent_digest ~ '^[a-f0-9]{64}$'
        and action_status in ('approved','delivered','completed','failed','reconciliation_required','unknown','blocked','expired','cancelled')
      )
    )
  ),
  add constraint camera_queue_automation_scope_check check (
    authorization_kind in ('human_confirmation','digital_guard_policy')
    and (
      (authorization_kind = 'human_confirmation' and automation_policy_id is null and automation_event_id is null)
      or (authorization_kind = 'digital_guard_policy' and task_kind = 'physical_command'
        and request_origin = 'digital_guard' and action_type in ('lighting','siren')
        and automation_policy_id is not null and automation_event_id is not null)
    )
  );

create unique index if not exists camera_guard_event_action_unique_idx
  on public.digital_observer_camera_action_requests(automation_event_id, action_type)
  where authorization_kind = 'digital_guard_policy';
create index if not exists camera_guard_rate_limit_idx
  on public.digital_observer_camera_action_requests(camera_source_id, action_type, created_at desc)
  where authorization_kind = 'digital_guard_policy';
create unique index if not exists immutable_camera_guard_dispatch_intent_idx
  on public.immutable_audit_events(request_id, event_type)
  where request_id is not null and event_type = 'digital_guard_autonomous_dispatch_intent_v1';

create or replace function public.guard_camera_diagnostic_queue()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' then
    if old.task_kind <> new.task_kind then raise exception 'camera_queue_kind_immutable' using errcode = '23514'; end if;
    if old.task_kind <> 'legacy_command' then
      if row(old.id,old.observer_site_id,old.camera_source_id,old.gateway_id,old.stream_id,old.channel,old.source_generation,old.binding_generation,
             old.requested_by,old.action_type,old.requested_at,old.expires_at,old.parameters,old.capability_evidence,
             old.payload_digest,old.idempotency_key,old.request_origin,old.confirmation_nonce_hash,old.confirmation_expires_at,
             old.authorization_kind,old.automation_policy_id,old.automation_event_id)
         is distinct from
         row(new.id,new.observer_site_id,new.camera_source_id,new.gateway_id,new.stream_id,new.channel,new.source_generation,new.binding_generation,
             new.requested_by,new.action_type,new.requested_at,new.expires_at,new.parameters,new.capability_evidence,
             new.payload_digest,new.idempotency_key,new.request_origin,new.confirmation_nonce_hash,new.confirmation_expires_at,
             new.authorization_kind,new.automation_policy_id,new.automation_event_id) then
        raise exception 'camera_queue_request_immutable' using errcode = '23514';
      end if;
      if old.action_status <> 'awaiting_confirmation' and row(old.confirmation_id,old.confirmed_by,old.confirmed_at,old.dispatch_intent_digest)
        is distinct from row(new.confirmation_id,new.confirmed_by,new.confirmed_at,new.dispatch_intent_digest) then
        raise exception 'camera_queue_confirmation_immutable' using errcode = '23514';
      end if;
      if old.action_status in ('completed','reconciliation_required','unknown','failed','blocked','expired','cancelled') and old is distinct from new then
        raise exception 'camera_queue_result_immutable' using errcode = '23514';
      end if;
      if old.action_status is distinct from new.action_status and not (
        (old.action_status = 'awaiting_confirmation' and new.action_status in ('approved','blocked','expired','cancelled'))
        or (old.action_status = 'approved' and new.action_status in ('delivered','blocked','expired','cancelled'))
        or (old.action_status = 'delivered' and new.action_status in ('completed','reconciliation_required','unknown','failed','blocked','expired'))
      ) then raise exception 'camera_queue_transition_invalid' using errcode = '23514'; end if;
    end if;
  elsif new.task_kind <> 'legacy_command' then
    if new.result is not null or new.result_digest is not null then raise exception 'camera_queue_initial_state_invalid' using errcode = '23514'; end if;
    if new.task_kind = 'physical_command' and not (
      (new.authorization_kind = 'human_confirmation' and new.action_status = 'awaiting_confirmation')
      or (new.authorization_kind = 'digital_guard_policy' and new.action_status = 'approved')
    ) then raise exception 'camera_queue_initial_state_invalid' using errcode = '23514'; end if;
    if new.task_kind <> 'physical_command' and new.action_status not in ('approved','awaiting_confirmation') then
      raise exception 'camera_queue_initial_state_invalid' using errcode = '23514';
    end if;
    if new.requested_at > clock_timestamp() + interval '5 seconds' or new.expires_at <= clock_timestamp() then
      raise exception 'camera_queue_request_expired' using errcode = '23514';
    end if;
  end if;
  if new.task_kind <> 'legacy_command' and
     (tg_op = 'INSERT' or (new.action_status in ('approved','delivered','completed','reconciliation_required','unknown') and old.action_status is distinct from new.action_status)) then
    if (new.action_status not in ('completed','reconciliation_required','unknown') and new.expires_at <= clock_timestamp())
      or (new.action_status in ('completed','reconciliation_required','unknown')
        and new.expires_at + case when new.task_kind = 'physical_command' then interval '1 minute' else interval '0 seconds' end <= clock_timestamp()) then
      raise exception 'camera_queue_request_expired' using errcode = '23514';
    end if;
    if not exists (
      select 1 from public.digital_observer_camera_sources s
      where s.id = new.camera_source_id and s.observer_site_id = new.observer_site_id
        and s.metadata ->> 'gateway_id' = new.gateway_id
        and s.metadata ->> 'gateway_stream_id' = new.stream_id
        and s.metadata -> 'dvr_channel' = to_jsonb(new.channel)
    ) then raise exception 'camera_queue_binding_invalid' using errcode = '23514'; end if;
  end if;
  return new;
end;
$$;

create or replace function public.confirm_camera_physical_command(
  requested_action_id uuid, confirming_actor_id uuid, confirmation_value uuid, confirmation_nonce text
)
returns public.digital_observer_camera_action_requests
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  queued public.digital_observer_camera_action_requests%rowtype;
  intent_digest text;
begin
  select * into strict queued from public.digital_observer_camera_action_requests
  where id = requested_action_id for update;
  if queued.task_kind <> 'physical_command' or queued.action_status <> 'awaiting_confirmation'
    or queued.requested_by <> confirming_actor_id or queued.request_origin <> 'dashboard'
    or queued.authorization_kind <> 'human_confirmation' then
    raise exception 'camera_physical_confirmation_scope_invalid' using errcode = '23514';
  end if;
  if queued.expires_at <= clock_timestamp() or queued.confirmation_expires_at <= clock_timestamp()
    or queued.confirmation_nonce_hash <> encode(extensions.digest(confirmation_nonce, 'sha256'::text), 'hex') then
    raise exception 'camera_physical_confirmation_expired_or_invalid' using errcode = '23514';
  end if;
  if exists (select 1 from public.digital_observer_camera_action_requests where confirmation_id = confirmation_value) then
    raise exception 'camera_physical_confirmation_replayed' using errcode = '23505';
  end if;
  intent_digest := encode(extensions.digest(concat_ws('|', queued.id::text, confirmation_value::text,
    queued.observer_site_id::text, queued.camera_source_id::text, queued.gateway_id, queued.stream_id,
    queued.channel::text, queued.source_generation, queued.binding_generation, queued.action_type, queued.payload_digest,
    confirming_actor_id::text, queued.confirmation_expires_at::text), 'sha256'::text), 'hex');
  update public.digital_observer_camera_action_requests set
    confirmation_id = confirmation_value, confirmed_by = confirming_actor_id, confirmed_at = clock_timestamp(),
    dispatch_intent_digest = intent_digest, action_status = 'approved', updated_at = clock_timestamp()
  where id = queued.id returning * into queued;
  insert into public.immutable_audit_events (
    event_type,event_category,actor_profile_id,actor_role,target_type,target_id,camera_id,request_id,metadata,risk_level
  ) values (
    'digital_guard_command_dispatch_intent_v12','camera',confirming_actor_id,'observer_user',
    'digital_observer_camera_source',queued.camera_source_id,queued.camera_source_id,queued.id::text,
    jsonb_build_object('schema','camera_dispatch_intent_v12','site_id',queued.observer_site_id,
      'camera_id',queued.camera_source_id,'stream_id',queued.stream_id,'channel',queued.channel,'action',queued.action_type,
      'gateway_id',queued.gateway_id,'source_generation',queued.source_generation,'binding_generation',queued.binding_generation,
      'payload_digest',queued.payload_digest,'confirmation_id',queued.confirmation_id,
      'confirmation_expires_at',queued.confirmation_expires_at,'dispatch_intent_digest',intent_digest),'critical'
  );
  return queued;
exception when no_data_found then
  raise exception 'camera_physical_request_not_found' using errcode = 'P0002';
end;
$$;

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
  if requested_action = 'lighting' and requested_payload <> '{"enabled":true}'::jsonb then
    return jsonb_build_object('status','blocked','reason','lighting_on_only','action',requested_action);
  end if;
  if requested_action = 'siren' and requested_payload <> '{"enabled":true,"duration_ms":1000}'::jsonb then
    return jsonb_build_object('status','blocked','reason','siren_must_be_one_second','action',requested_action);
  end if;
  expected_digest := encode(extensions.digest(case when requested_action = 'lighting'
    then '{"enabled":true}' else '{"duration_ms":1000,"enabled":true}' end, 'sha256'::text), 'hex');
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
      'expires_at',expires_at,'siren_duration_ms',case when requested_action = 'siren' then 1000 else null end),
    'critical'
  );
  return jsonb_build_object('status','queued','request_id',request_id,'action',requested_action,'action_status','approved');
end;
$$;

revoke all on function public.enqueue_digital_guard_camera_command_v1(uuid,text,jsonb,text) from public, anon, authenticated;
grant execute on function public.enqueue_digital_guard_camera_command_v1(uuid,text,jsonb,text) to service_role;
revoke all on table public.digital_observer_camera_automation_policies from anon, authenticated;
grant select on table public.digital_observer_camera_automation_policies to authenticated;
grant all on table public.digital_observer_camera_automation_policies to service_role;
alter table public.digital_observer_camera_automation_policies enable row level security;
drop policy if exists "camera automation policy scoped read" on public.digital_observer_camera_automation_policies;
create policy "camera automation policy scoped read" on public.digital_observer_camera_automation_policies
  for select using (public.can_manage_observer_site(observer_site_id));

insert into public.digital_observer_camera_automation_policies (
  id,observer_site_id,camera_source_id,enabled,allowed_actions,lighting_event_types,siren_event_types,
  minimum_confidence,siren_minimum_confidence,siren_duration_ms,active_from,active_until,
  lighting_cooldown_seconds,siren_cooldown_seconds,siren_hourly_limit,approved_by,metadata
)
select
  '9d9f5fd1-a56f-4d9c-9e07-0997c98f8a33',
  s.id,
  '6fddc732-13df-4268-9f32-3357262ea997',
  false,
  array['lighting','siren']::text[],
  array['person_detected','person_entered','vehicle_entered']::text[],
  array['person_entered','vehicle_entered']::text[],
  0.9000,0.9500,1000,'22:00','06:00',30,300,3,s.owner_profile_id,
  jsonb_build_object('approval_scope','pending_explicit_physical_automation_risk_confirmation',
    'prepared_at','2026-09-02','ptz_allowed',false,'talkback_allowed',false,
    'siren_guard','critical_verified_line_crossing_only','lighting_guard','verified_person_or_entry_event')
from public.observer_sites s
where s.id = 'cc1673b8-3eb0-4785-a12c-1fb88f425a41' and s.owner_profile_id is not null
on conflict (observer_site_id,camera_source_id) do update set
  enabled = excluded.enabled,
  allowed_actions = excluded.allowed_actions,
  lighting_event_types = excluded.lighting_event_types,
  siren_event_types = excluded.siren_event_types,
  minimum_confidence = excluded.minimum_confidence,
  siren_minimum_confidence = excluded.siren_minimum_confidence,
  siren_duration_ms = excluded.siren_duration_ms,
  approved_by = excluded.approved_by,
  approved_at = now(),
  metadata = excluded.metadata,
  updated_at = now();

notify pgrst, 'reload schema';
commit;
