-- Extends the existing approval queue. Does NOT enable physical execution.
-- No legacy request is reclassified, approved or assigned to a Gateway.
begin;

create table if not exists public.digital_observer_camera_action_requests (
  id uuid primary key default gen_random_uuid(),
  observer_site_id uuid not null references public.observer_sites(id) on delete cascade,
  camera_source_id uuid not null references public.digital_observer_camera_sources(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  confirmed_by uuid references public.profiles(id) on delete set null,
  action_type text not null,
  request_origin text not null default 'dashboard',
  action_status text not null default 'awaiting_confirmation',
  parameters jsonb not null default '{}'::jsonb,
  capability_evidence jsonb not null default '{}'::jsonb,
  idempotency_key text not null unique,
  expires_at timestamptz not null default (now() + interval '2 minutes'),
  confirmed_at timestamptz,
  delivered_at timestamptz,
  completed_at timestamptz,
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ADD COLUMN also upgrades installations where the old table already exists.
alter table public.digital_observer_camera_action_requests
  add column if not exists task_kind text not null default 'legacy_command',
  add column if not exists gateway_id text,
  add column if not exists stream_id text,
  add column if not exists channel integer,
  add column if not exists requested_at timestamptz,
  add column if not exists payload_digest text,
  add column if not exists result_digest text;

-- Existing IDs remain the foreign keys; wire camera_id aliases
-- camera_source_id and wire site_id aliases observer_site_id.
alter table public.digital_observer_camera_action_requests
  drop constraint if exists digital_observer_camera_action_type_check,
  drop constraint if exists digital_observer_camera_action_origin_check,
  drop constraint if exists digital_observer_camera_action_status_check,
  drop constraint if exists digital_observer_camera_action_evidence_check,
  drop constraint if exists digital_observer_camera_action_confirmation_check,
  drop constraint if exists camera_queue_task_kind_check,
  drop constraint if exists camera_queue_binding_check,
  drop constraint if exists camera_queue_ttl_check,
  drop constraint if exists camera_queue_payload_check,
  drop constraint if exists camera_queue_no_physical_success_check,
  drop constraint if exists camera_queue_result_check;

alter table public.digital_observer_camera_action_requests
  add constraint camera_queue_task_kind_check check (
    task_kind in ('legacy_command','capability_snapshot','command_preflight')
  ),
  add constraint digital_observer_camera_action_type_check check (
    (task_kind = 'legacy_command' and action_type in
      ('talkback','ptz_pan','ptz_tilt','ptz_zoom','light_on','light_off','siren_on','siren_off','relay_on','relay_off'))
    or (task_kind = 'capability_snapshot' and action_type = 'capability_snapshot')
    or (task_kind = 'command_preflight' and action_type in ('ptz','talk','siren','lighting'))
  ),
  add constraint digital_observer_camera_action_origin_check check (request_origin in ('dashboard','observer_chat')),
  add constraint digital_observer_camera_action_status_check check (
    action_status in ('awaiting_confirmation','approved','delivered','succeeded','failed','completed','blocked','expired','cancelled')
  ),
  add constraint digital_observer_camera_action_evidence_check check (
    task_kind <> 'legacy_command' or (
      capability_evidence ->> 'supported' = 'true'
      and coalesce(capability_evidence ->> 'method', '') <> ''
      and coalesce(capability_evidence ->> 'tested_at', '') <> ''
    )
  ),
  add constraint digital_observer_camera_action_confirmation_check check (
    task_kind <> 'legacy_command' or action_status = 'awaiting_confirmation'
    or action_status in ('blocked','expired','cancelled')
    or (confirmed_by is not null and confirmed_at is not null)
  ),
  add constraint camera_queue_binding_check check (
    task_kind = 'legacy_command' or (
      gateway_id ~ '^[A-Za-z0-9_-]{1,160}$' and stream_id ~ '^[A-Za-z0-9_-]{1,160}$'
      and channel between 1 and 64
    ) is true
  ),
  add constraint camera_queue_ttl_check check (
    task_kind = 'legacy_command' or (
      requested_at is not null and expires_at > requested_at
      and expires_at <= requested_at + interval '2 minutes'
    ) is true
  ),
  add constraint camera_queue_payload_check check (
    task_kind = 'legacy_command' or (
      parameters = '{}'::jsonb and (
        (task_kind = 'capability_snapshot' and payload_digest is null)
        or (task_kind = 'command_preflight' and payload_digest ~ '^[a-f0-9]{64}$')
      )
    ) is true
  ),
  add constraint camera_queue_no_physical_success_check check (
    (task_kind = 'legacy_command' and action_status <> 'completed')
    or (task_kind <> 'legacy_command' and action_status <> 'succeeded')
  ),
  add constraint camera_queue_result_check check (
    task_kind = 'legacy_command' or action_status <> 'completed' or (
      completed_at is not null and delivered_at is not null and result_digest ~ '^[a-f0-9]{64}$'
      and result ->> 'outcome' = task_kind
      and result ->> 'request_id' = id::text
      and result #>> '{outcome_payload,camera_id}' = camera_source_id::text
      and result #>> '{outcome_payload,site_id}' = observer_site_id::text
      and result #>> '{outcome_payload,stream_id}' = stream_id
      and result #> '{outcome_payload,channel}' = to_jsonb(channel)
      and result #> '{outcome_payload,executor_installed}' = 'false'::jsonb
      and result #> '{outcome_payload,executed}' = 'false'::jsonb
      and (task_kind = 'capability_snapshot' or (
        result #>> '{outcome_payload,action}' = action_type
        and result #>> '{outcome_payload,ack_kind}' = 'preflight_only'
        and result #> '{outcome_payload,requires_immediate_confirmation}' = 'true'::jsonb
      ))
    ) is true
  );

create index if not exists camera_queue_gateway_delivery_idx
  on public.digital_observer_camera_action_requests(gateway_id, observer_site_id, created_at, id)
  where action_status = 'approved' and task_kind in ('capability_snapshot','command_preflight');

-- Reject a fabricated source/site/channel binding at insertion and prevent
-- changing the payload, binding or terminal result after the request is stored.
create or replace function public.guard_camera_diagnostic_queue()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'UPDATE' then
    if old.task_kind <> new.task_kind then
      raise exception 'camera_queue_kind_immutable' using errcode = '23514';
    end if;
    if old.task_kind <> 'legacy_command' then
      if row(old.id,old.observer_site_id,old.camera_source_id,old.gateway_id,old.stream_id,old.channel,
             old.requested_by,old.action_type,old.requested_at,old.expires_at,old.parameters,old.payload_digest,old.idempotency_key)
         is distinct from
         row(new.id,new.observer_site_id,new.camera_source_id,new.gateway_id,new.stream_id,new.channel,
             new.requested_by,new.action_type,new.requested_at,new.expires_at,new.parameters,new.payload_digest,new.idempotency_key) then
        raise exception 'camera_queue_request_immutable' using errcode = '23514';
      end if;
      if old.action_status in ('completed','failed','blocked','expired','cancelled') and old is distinct from new then
        raise exception 'camera_queue_result_immutable' using errcode = '23514';
      end if;
      if old.action_status is distinct from new.action_status and not (
        (old.action_status = 'awaiting_confirmation' and new.action_status in ('approved','blocked','expired','cancelled'))
        or (old.action_status = 'approved' and new.action_status in ('delivered','blocked','expired','cancelled'))
        or (old.action_status = 'delivered' and new.action_status in ('completed','failed','blocked','expired'))
      ) then raise exception 'camera_queue_transition_invalid' using errcode = '23514'; end if;
    end if;
  elsif new.task_kind <> 'legacy_command' then
    if new.action_status not in ('approved','awaiting_confirmation') or new.result is not null or new.result_digest is not null then
      raise exception 'camera_queue_initial_state_invalid' using errcode = '23514';
    end if;
    if new.requested_at > clock_timestamp() + interval '5 seconds' or new.expires_at <= clock_timestamp() then
      raise exception 'camera_queue_request_expired' using errcode = '23514';
    end if;
  end if;
  -- Recheck the source binding at claim/completion, not only at insertion;
  -- a concurrent source reassignment must not produce evidence for its old site.
  if new.task_kind <> 'legacy_command' and
     (tg_op = 'INSERT' or (new.action_status in ('delivered','completed') and old.action_status is distinct from new.action_status)) then
    if new.expires_at <= clock_timestamp() then
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
drop trigger if exists guard_camera_diagnostic_queue on public.digital_observer_camera_action_requests;
create trigger guard_camera_diagnostic_queue before insert or update on public.digital_observer_camera_action_requests
  for each row execute function public.guard_camera_diagnostic_queue();

alter table public.digital_observer_camera_action_requests enable row level security;
drop policy if exists "digital observer camera actions scoped read" on public.digital_observer_camera_action_requests;
create policy "digital observer camera actions scoped read" on public.digital_observer_camera_action_requests
  for select using (public.can_manage_observer_site(observer_site_id));
drop policy if exists "digital observer camera actions scoped insert" on public.digital_observer_camera_action_requests;
drop policy if exists "digital observer camera actions scoped update" on public.digital_observer_camera_action_requests;
revoke all on table public.digital_observer_camera_action_requests from anon, authenticated;
grant select on table public.digital_observer_camera_action_requests to authenticated;
grant all on table public.digital_observer_camera_action_requests to service_role;
comment on column public.digital_observer_camera_action_requests.task_kind is
  'Legacy physical approvals are preserved but never reclassified. Snapshot/preflight are read-only diagnostics.';
notify pgrst, 'reload schema';
commit;
