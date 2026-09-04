-- SOURCE-ONLY V12 proposal. This migration is not applied by this package.
-- It extends the existing diagnostic queue without reclassifying legacy rows.
begin;

create extension if not exists pgcrypto with schema extensions;

alter table public.digital_observer_camera_action_requests
  add column if not exists confirmation_id uuid,
  add column if not exists confirmation_nonce_hash text,
  add column if not exists confirmation_expires_at timestamptz,
  add column if not exists dispatch_intent_digest text,
  add column if not exists source_generation text,
  add column if not exists binding_generation text,
  add column if not exists non_retryable boolean not null default false,
  add column if not exists result_phase jsonb;

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
    allowed := array['enabled','level'];
    if jsonb_typeof(value -> 'enabled') <> 'boolean' then return false; end if;
    if value ? 'level' and (jsonb_typeof(value -> 'level') <> 'number' or (value ->> 'level')::integer not between 0 and 100) then return false; end if;
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

alter table public.digital_observer_camera_action_requests
  drop constraint if exists digital_observer_camera_action_type_check,
  drop constraint if exists digital_observer_camera_action_origin_check,
  drop constraint if exists digital_observer_camera_action_status_check,
  drop constraint if exists digital_observer_camera_action_confirmation_check,
  drop constraint if exists camera_queue_task_kind_check,
  drop constraint if exists camera_queue_ttl_check,
  drop constraint if exists camera_queue_payload_check,
  drop constraint if exists camera_queue_no_physical_success_check,
  drop constraint if exists camera_queue_result_check,
  drop constraint if exists camera_queue_physical_confirmation_check,
  drop constraint if exists camera_queue_physical_evidence_check,
  drop constraint if exists camera_queue_terminal_facts_check;

alter table public.digital_observer_camera_action_requests
  add constraint camera_queue_task_kind_check check (
    task_kind in ('legacy_command','capability_snapshot','command_preflight','physical_command')
  ),
  add constraint digital_observer_camera_action_type_check check (
    (task_kind = 'legacy_command' and action_type in
      ('talkback','ptz_pan','ptz_tilt','ptz_zoom','light_on','light_off','siren_on','siren_off','relay_on','relay_off'))
    or (task_kind = 'capability_snapshot' and action_type = 'capability_snapshot')
    or (task_kind = 'command_preflight' and action_type in ('ptz','talk','siren','lighting'))
    or (task_kind = 'physical_command' and action_type in ('ptz','siren','lighting'))
  ),
  add constraint digital_observer_camera_action_origin_check check (
    request_origin in ('dashboard','observer_chat') and (task_kind <> 'physical_command' or request_origin = 'dashboard')
  ),
  add constraint digital_observer_camera_action_status_check check (
    action_status in ('awaiting_confirmation','approved','delivered','succeeded','failed','completed','reconciliation_required','unknown','blocked','expired','cancelled')
  ),
  add constraint digital_observer_camera_action_confirmation_check check (
    task_kind not in ('legacy_command','physical_command') or action_status in ('awaiting_confirmation','blocked','expired','cancelled')
    or (confirmed_by is not null and confirmed_at is not null)
  ),
  add constraint camera_queue_ttl_check check (
    task_kind = 'legacy_command' or (
      requested_at is not null and expires_at > requested_at
      and expires_at <= requested_at + case when task_kind = 'physical_command' then interval '30 seconds' else interval '2 minutes' end
    ) is true
  ),
  add constraint camera_queue_payload_check check (
    task_kind = 'legacy_command' or (
      (task_kind = 'capability_snapshot' and parameters = '{}'::jsonb and payload_digest is null)
      or (task_kind = 'command_preflight' and parameters = '{}'::jsonb and payload_digest ~ '^[a-f0-9]{64}$')
      or (task_kind = 'physical_command' and public.camera_physical_payload_valid(action_type, parameters)
        and payload_digest ~ '^[a-f0-9]{64}$')
    ) is true
  ),
  add constraint camera_queue_physical_confirmation_check check (
    task_kind <> 'physical_command' or (
      confirmation_nonce_hash ~ '^[a-f0-9]{64}$' and confirmation_expires_at = expires_at
      and (
        (action_status = 'awaiting_confirmation' and confirmation_id is null and confirmed_by is null and confirmed_at is null and dispatch_intent_digest is null)
        or (action_status in ('approved','delivered','completed','failed','reconciliation_required','unknown') and confirmation_id is not null and confirmed_by is not null
          and confirmed_at is not null and confirmed_at <= confirmation_expires_at and dispatch_intent_digest ~ '^[a-f0-9]{64}$')
        or action_status in ('blocked','expired','cancelled')
      )
    ) is true
  ),
  add constraint camera_queue_physical_evidence_check check (
    task_kind <> 'physical_command' or (
      capability_evidence ->> 'adapter' = 'private_nvr_http_api_v1'
      and capability_evidence ->> 'executor_installed' = 'true'
      and capability_evidence ->> 'supported' = 'true'
      and capability_evidence ->> 'action' = action_type
      and capability_evidence ->> 'evidence_id' ~ '^[0-9a-f-]{36}$'
      and capability_evidence ->> 'site_id' = observer_site_id::text
      and capability_evidence ->> 'camera_id' = camera_source_id::text
      and capability_evidence ->> 'gateway_id' = gateway_id
      and capability_evidence ->> 'stream_id' = stream_id
      and capability_evidence -> 'channel' = to_jsonb(channel)
      and capability_evidence ->> 'source_generation' = source_generation
      and capability_evidence ->> 'binding_generation' = binding_generation
      and source_generation ~ '^[A-Za-z0-9._:-]{1,128}$'
      and binding_generation ~ '^[A-Za-z0-9._:-]{1,128}$'
      and capability_evidence #>> '{live,tested}' = 'true'
      and capability_evidence #>> '{live,media_progressing}' = 'true'
      and coalesce(capability_evidence #>> '{live,verified_at}', '') <> ''
    ) is true
  ),
  add constraint camera_queue_no_physical_success_check check (
    (task_kind = 'legacy_command' and action_status <> 'completed') or task_kind <> 'legacy_command'
  ),
  add constraint camera_queue_result_check check (
    task_kind = 'legacy_command' or action_status not in ('completed','reconciliation_required','unknown') or (
      completed_at is not null and delivered_at is not null and result_digest ~ '^[a-f0-9]{64}$'
      and result ->> 'request_id' = id::text and (
        (action_status = 'completed' and task_kind in ('capability_snapshot','command_preflight')
          and result ->> 'outcome' = task_kind
          and result #>> '{outcome_payload,camera_id}' = camera_source_id::text
          and result #>> '{outcome_payload,site_id}' = observer_site_id::text
          and result #>> '{outcome_payload,stream_id}' = stream_id
          and result #> '{outcome_payload,channel}' = to_jsonb(channel)
          and result #> '{outcome_payload,executed}' = 'false'::jsonb)
        or (action_status = 'completed' and task_kind = 'physical_command'
          and result ->> 'outcome' = 'physical_command'
          and result #>> '{outcome_payload,request_id}' = id::text
          and result #>> '{outcome_payload,camera_id}' = camera_source_id::text
          and result #>> '{outcome_payload,site_id}' = observer_site_id::text
          and result #>> '{outcome_payload,stream_id}' = stream_id
          and result #> '{outcome_payload,channel}' = to_jsonb(channel)
          and result #>> '{outcome_payload,gateway_id}' = gateway_id
          and result #>> '{outcome_payload,source_generation}' = source_generation
          and result #>> '{outcome_payload,binding_generation}' = binding_generation
          and result #>> '{outcome_payload,action}' = action_type
          and result #> '{outcome_payload,executor_installed}' = 'true'::jsonb
          and result #> '{outcome_payload,executed}' = 'true'::jsonb
          and result #>> '{outcome_payload,audit_digest}' ~ '^[a-f0-9]{64}$')
        or (action_status in ('reconciliation_required','unknown') and task_kind = 'physical_command'
          and result ->> 'outcome' = case when action_status = 'reconciliation_required'
            then 'acknowledged_needs_reconciliation' else 'unknown_non_retryable' end
          and result ->> 'result_code' = result ->> 'outcome'
          and result #>> '{outcome_payload,request_id}' = id::text
          and result #>> '{outcome_payload,camera_id}' = camera_source_id::text
          and result #>> '{outcome_payload,site_id}' = observer_site_id::text
          and result #>> '{outcome_payload,gateway_id}' = gateway_id
          and result #>> '{outcome_payload,stream_id}' = stream_id
          and result #> '{outcome_payload,channel}' = to_jsonb(channel)
          and result #>> '{outcome_payload,source_generation}' = source_generation
          and result #>> '{outcome_payload,binding_generation}' = binding_generation
          and result #>> '{outcome_payload,action}' = action_type
          and result #> '{outcome_payload,executor_installed}' = 'true'::jsonb
          and result #> '{outcome_payload,executed}' = 'null'::jsonb
          and result #> '{outcome_payload,non_retryable}' = 'true'::jsonb
          and result #> '{outcome_payload,phase,write_attempted}' = 'true'::jsonb
          and result #>> '{outcome_payload,audit_digest}' ~ '^[a-f0-9]{64}$'
          and result #>> '{outcome_payload,reported_at}' <> '')
      )
    ) is true
  ),
  add constraint camera_queue_terminal_facts_check check (
    (task_kind <> 'physical_command' and non_retryable = false and result_phase is null)
    or (task_kind = 'physical_command' and (
      (action_status in ('awaiting_confirmation','approved','delivered','failed','blocked','expired','cancelled')
        and non_retryable = false and result_phase is null)
      or (action_status = 'completed' and non_retryable = true and result_phase is null)
      or (action_status = 'reconciliation_required' and non_retryable = true
        and result_phase = result #> '{outcome_payload,phase}'
        and result_phase -> 'write_attempted' = 'true'::jsonb
        and result_phase -> 'ack_observed' = 'true'::jsonb)
      or (action_status = 'unknown' and non_retryable = true
        and result_phase = result #> '{outcome_payload,phase}'
        and result_phase = '{"write_attempted":true,"ack_observed":false,"state_verified":false}'::jsonb)
    ))
  );

create unique index if not exists camera_physical_confirmation_unique_idx
  on public.digital_observer_camera_action_requests(confirmation_id)
  where confirmation_id is not null;
create index if not exists camera_physical_gateway_delivery_idx
  on public.digital_observer_camera_action_requests(gateway_id, observer_site_id, created_at, id)
  where action_status = 'approved' and task_kind = 'physical_command';
create unique index if not exists immutable_camera_dispatch_intent_idx
  on public.immutable_audit_events(request_id, event_type)
  where request_id is not null and event_type = 'digital_guard_command_dispatch_intent_v12';

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
             old.payload_digest,old.idempotency_key,old.request_origin,old.confirmation_nonce_hash,old.confirmation_expires_at)
         is distinct from
         row(new.id,new.observer_site_id,new.camera_source_id,new.gateway_id,new.stream_id,new.channel,new.source_generation,new.binding_generation,
             new.requested_by,new.action_type,new.requested_at,new.expires_at,new.parameters,new.capability_evidence,
             new.payload_digest,new.idempotency_key,new.request_origin,new.confirmation_nonce_hash,new.confirmation_expires_at) then
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
    if (new.task_kind = 'physical_command' and new.action_status <> 'awaiting_confirmation')
      or (new.task_kind <> 'physical_command' and new.action_status not in ('approved','awaiting_confirmation')) then
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
    or queued.requested_by <> confirming_actor_id or queued.request_origin <> 'dashboard' then
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
    queued.channel::text, queued.source_generation, queued.binding_generation, queued.action_type, queued.payload_digest, confirming_actor_id::text,
    queued.confirmation_expires_at::text), 'sha256'::text), 'hex');
  update public.digital_observer_camera_action_requests set
    confirmation_id = confirmation_value, confirmed_by = confirming_actor_id, confirmed_at = clock_timestamp(),
    dispatch_intent_digest = intent_digest, action_status = 'approved', updated_at = clock_timestamp()
  where id = queued.id returning * into queued;
  insert into public.immutable_audit_events (
    id,event_type,event_category,actor_profile_id,actor_role,target_type,target_id,camera_id,request_id,metadata,risk_level
  ) values (
    queued.id,'digital_guard_command_dispatch_intent_v12','camera',confirming_actor_id,'observer_user',
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

revoke all on function public.confirm_camera_physical_command(uuid,uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.confirm_camera_physical_command(uuid,uuid,uuid,text) to service_role;
comment on function public.confirm_camera_physical_command(uuid,uuid,uuid,text) is
  'Atomically consumes one 30-second dashboard confirmation, approves one exact camera command, and appends immutable dispatch intent.';

notify pgrst, 'reload schema';
commit;
