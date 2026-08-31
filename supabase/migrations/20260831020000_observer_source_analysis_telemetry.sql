begin;

-- Bounded operational evidence: one latest report per source, no raw media or identities.
create table public.observer_source_analysis_status (
  camera_source_id uuid primary key references public.digital_observer_camera_sources(id) on delete cascade,
  observer_site_id uuid not null references public.observer_sites(id) on delete cascade,
  gateway_id text not null check (length(gateway_id) between 1 and 128),
  state text not null check (state in ('no_event', 'event_detected', 'no_media', 'processing_failed', 'offline', 'deferred_budget', 'consent_unavailable')),
  last_attempt_at timestamptz,
  last_analyzed_at timestamptz,
  detection_count integer check (detection_count between 0 and 100),
  reported_at timestamptz not null,
  received_at timestamptz not null default now(),
  check (last_attempt_at is null or last_attempt_at <= reported_at),
  check (last_analyzed_at is null or (last_attempt_at is not null and last_analyzed_at between last_attempt_at and reported_at)),
  check (case when state in ('no_event', 'event_detected') then
    last_analyzed_at is not null and detection_count is not null and
    ((state = 'no_event' and detection_count = 0) or (state = 'event_detected' and detection_count > 0))
    else last_analyzed_at is null and detection_count is null end)
);
create index observer_source_analysis_status_site_idx on public.observer_source_analysis_status(observer_site_id);
alter table public.observer_source_analysis_status enable row level security;
revoke all on public.observer_source_analysis_status from public, anon, authenticated;
grant select on public.observer_source_analysis_status to authenticated;
grant all on public.observer_source_analysis_status to service_role;
create policy "analysis status scoped read" on public.observer_source_analysis_status for select to authenticated
using (public.can_access_observer_site(observer_site_id) and exists (
  select 1 from public.digital_observer_camera_sources source
  where source.id = camera_source_id and source.observer_site_id = observer_source_analysis_status.observer_site_id
    and source.metadata->>'gateway_id' = observer_source_analysis_status.gateway_id
));

create function public.record_observer_analysis_telemetry(
  p_observer_site_id uuid, p_gateway_id text, p_receipt_id uuid,
  p_authorization_id uuid, p_completed_at timestamptz, p_reports jsonb
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  policy_row public.provider_webhook_events%rowtype;
  issued_at timestamptz;
  expires_at timestamptz;
  source_row record;
  stored_count integer := 0;
  changed_count integer;
  requested_ids jsonb;
  allowed_ids jsonb;
begin
  if p_gateway_id is null or length(p_gateway_id) not between 1 and 128
    or p_completed_at is null or p_completed_at > clock_timestamp()
    or p_completed_at < clock_timestamp() - interval '5 minutes'
    or jsonb_typeof(p_reports) is distinct from 'array'
    or jsonb_array_length(p_reports) not between 1 and 128 then
    raise exception 'Invalid analysis report';
  end if;

  -- Row locks consume the authorization and receipt atomically with all source updates.
  select * into policy_row from public.provider_webhook_events
    where id = p_authorization_id and webhook_key = 'video_gateway_cloud_learning'
      and event_type = 'analysis_policy' and status = 'processed' and signature_valid is true
      and provider = p_gateway_id and related_entity_type = 'observer_sites'
      and related_entity_id = p_observer_site_id for update;
  if not found or policy_row.metadata->>'telemetry_version' is distinct from '1'
    or policy_row.metadata ? 'telemetry_received_at' then
    raise exception 'Analysis authorization unavailable or consumed';
  end if;
  perform 1 from public.provider_webhook_events
    where id = p_receipt_id and webhook_key = 'video_gateway_cloud_learning'
      and event_type = 'analysis_telemetry' and status = 'verified' and signature_valid is true
      and provider = p_gateway_id and related_entity_type = 'observer_sites'
      and related_entity_id = p_observer_site_id for update;
  if not found then raise exception 'Analysis receipt unavailable'; end if;

  issued_at := (policy_row.metadata->>'issued_at')::timestamptz;
  expires_at := (policy_row.metadata->>'expires_at')::timestamptz;
  requested_ids := policy_row.metadata->'requested_source_ids';
  allowed_ids := policy_row.metadata->'authorized_source_ids';
  if issued_at is null or expires_at is null or expires_at < issued_at
    or expires_at > issued_at + interval '60 seconds'
    or p_completed_at < issued_at or p_completed_at > issued_at + interval '5 minutes'
    or jsonb_typeof(requested_ids) is distinct from 'array' or jsonb_typeof(allowed_ids) is distinct from 'array'
    or jsonb_array_length(p_reports) <> jsonb_array_length(requested_ids)
    or (select count(distinct value->>'source_id') from jsonb_array_elements(p_reports)) <> jsonb_array_length(p_reports)
    or exists (select 1 from jsonb_array_elements(p_reports) item
      where jsonb_typeof(item) <> 'object' or exists (
        select 1 from jsonb_object_keys(item) key where key not in ('source_id', 'state', 'last_attempt_at', 'last_analyzed_at', 'detection_count')
      )) then raise exception 'Invalid analysis scope'; end if;

  for source_row in select * from jsonb_to_recordset(p_reports) as rows(
    source_id uuid, state text, last_attempt_at timestamptz, last_analyzed_at timestamptz, detection_count integer
  ) order by source_id loop
    if source_row.source_id is null or not (requested_ids ? source_row.source_id::text) then
      raise exception 'Source was not requested';
    end if;
    perform 1 from public.digital_observer_camera_sources
      where id = source_row.source_id and observer_site_id = p_observer_site_id
        and metadata->>'gateway_id' = p_gateway_id for share;
    if not found then raise exception 'Analysis source scope unavailable'; end if;
    if source_row.last_attempt_at is not null and
      (not (allowed_ids ? source_row.source_id::text) or source_row.last_attempt_at < issued_at
       or source_row.last_attempt_at >= expires_at or source_row.last_attempt_at > p_completed_at) then
      raise exception 'Analysis attempt was not authorized';
    end if;
    if source_row.state in ('no_event', 'event_detected') and
      (policy_row.metadata->>'consent_verified' is distinct from 'true'
       or source_row.last_analyzed_at is null or source_row.last_analyzed_at >= expires_at) then
      raise exception 'Analysis result was not authorized';
    end if;
    if (source_row.state in ('offline', 'deferred_budget') and source_row.last_attempt_at is not null)
      or (source_row.state in ('no_media', 'processing_failed') and source_row.last_attempt_at is null) then
      raise exception 'Invalid analysis attempt state';
    end if;

    insert into public.observer_source_analysis_status as current_status (
      camera_source_id, observer_site_id, gateway_id, state, last_attempt_at, last_analyzed_at, detection_count, reported_at
    ) values (source_row.source_id, p_observer_site_id, p_gateway_id, source_row.state,
      source_row.last_attempt_at, source_row.last_analyzed_at, source_row.detection_count, p_completed_at)
    on conflict (camera_source_id) do update set
      observer_site_id = excluded.observer_site_id, gateway_id = excluded.gateway_id, state = excluded.state,
      last_attempt_at = excluded.last_attempt_at, last_analyzed_at = excluded.last_analyzed_at,
      detection_count = excluded.detection_count, reported_at = excluded.reported_at, received_at = now()
    where current_status.observer_site_id = excluded.observer_site_id and current_status.reported_at < excluded.reported_at;
    get diagnostics changed_count = row_count;
    stored_count := stored_count + changed_count;
  end loop;
  update public.provider_webhook_events set metadata = metadata || jsonb_build_object('telemetry_received_at', now())
    where id = policy_row.id;
  update public.provider_webhook_events set status = 'processed', processed_at = now(),
    metadata = metadata || jsonb_build_object('source_count', jsonb_array_length(p_reports), 'stored_count', stored_count)
    where id = p_receipt_id;
  return jsonb_build_object('stored', stored_count, 'reported_at', p_completed_at);
end;
$$;
revoke all on function public.record_observer_analysis_telemetry(uuid, text, uuid, uuid, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.record_observer_analysis_telemetry(uuid, text, uuid, uuid, timestamptz, jsonb) to service_role;

commit;
