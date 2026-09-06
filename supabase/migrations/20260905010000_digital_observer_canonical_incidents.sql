-- PUSH 6: adapt the existing correlation tables into the canonical Digital
-- Observer Incident layer. This is additive; legacy correlated rows remain.

alter table public.observer_correlated_events
  add column if not exists title text,
  add column if not exists summary text,
  add column if not exists opened_at timestamptz,
  add column if not exists last_activity_at timestamptz,
  add column if not exists closed_at timestamptz,
  add column if not exists primary_camera_source_id uuid references public.digital_observer_camera_sources(id) on delete set null,
  add column if not exists involved_track_ids text[] not null default '{}'::text[],
  add column if not exists related_event_ids uuid[] not null default '{}'::uuid[],
  add column if not exists provenance text,
  add column if not exists correlation_version text,
  add column if not exists created_by_origin text;

alter table public.observer_correlated_events drop constraint if exists observer_correlated_events_status_check;
alter table public.observer_correlated_events add constraint observer_correlated_events_status_check check (status in (
  'open','acknowledged','resolved','closed',
  'reviewing','confirmed','dismissed','escalated','false_positive','needs_more_data'
));

alter table public.observer_correlated_event_links drop constraint if exists observer_correlated_event_links_source_check;
alter table public.observer_correlated_event_links add constraint observer_correlated_event_links_source_check check (source_type in (
  'observer_intelligence_signal','ai_camera_event','audio_observer_event','safety_incident',
  'pickup_event','watch_request_event','camera_health','mock'
));

create unique index if not exists observer_incident_signal_one_timeline_idx
  on public.observer_correlated_event_links(source_type, source_id)
  where source_type = 'observer_intelligence_signal';
create index if not exists observer_incidents_track_lookup_idx
  on public.observer_correlated_events(observer_site_id, primary_camera_source_id, status, last_activity_at desc)
  where correlation_version = 'do-track-v1';

create or replace function public.correlate_digital_observer_signal(p_signal_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  signal_row public.observer_intelligence_signals%rowtype;
  incident_id uuid;
  event_type text;
  camera_source_id uuid;
  track_id text;
  camera_name text;
  timeline_item jsonb;
  incident_status text;
  incident_title text;
  incident_summary text;
begin
  select * into signal_row from public.observer_intelligence_signals where id = p_signal_id for update;
  if not found then return null; end if;

  event_type := signal_row.metadata->>'event_type';
  camera_source_id := nullif(signal_row.metadata->>'camera_source_id','')::uuid;
  track_id := nullif(signal_row.metadata->>'track_id','');
  camera_name := nullif(signal_row.metadata->>'camera_name','');
  if signal_row.observer_site_id is null
    or signal_row.signal_type <> 'ai_camera'
    or signal_row.source_type <> 'system'
    or signal_row.metadata->>'observation_provenance' <> 'REAL_CAMERA_AI'
    or signal_row.metadata->>'validated_event' <> 'true'
    or event_type not in ('person_entered','person_exited')
    or camera_source_id is null or track_id is null then
    return null;
  end if;

  -- Serialise only this site/camera/track tuple. No cross-camera identity is inferred.
  perform pg_advisory_xact_lock(hashtextextended(signal_row.observer_site_id::text || ':' || camera_source_id::text || ':' || track_id, 0));

  select correlated_event_id into incident_id
  from public.observer_correlated_event_links
  where source_type = 'observer_intelligence_signal' and source_id = signal_row.id;
  if incident_id is not null then return incident_id; end if;

  select id into incident_id
  from public.observer_correlated_events
  where observer_site_id = signal_row.observer_site_id
    and primary_camera_source_id = camera_source_id
    and correlation_version = 'do-track-v1'
    and involved_track_ids @> array[track_id]
    and status in ('open','acknowledged')
    and opened_at <= signal_row.created_at
    and last_activity_at >= signal_row.created_at - interval '10 minutes'
  order by last_activity_at desc limit 1 for update;

  -- An exit cannot create an incident without a prior correlated entry state.
  if incident_id is null and event_type = 'person_exited' then return null; end if;

  if incident_id is null then
    insert into public.observer_correlated_events (
      observer_site_id, correlation_type, severity, confidence, status, start_time,
      title, summary, opened_at, last_activity_at, primary_camera_source_id,
      involved_camera_ids, involved_track_ids, related_event_ids, provenance,
      correlation_version, created_by_origin, timeline_summary, confidence_factors, metadata
    ) values (
      signal_row.observer_site_id, 'safety_event_correlation', signal_row.severity,
      coalesce(signal_row.confidence, 0), 'open', signal_row.created_at,
      'תנועה באזור הכניסה', 'אדם נכנס לאזור המצולם; האירוע עדיין פתוח לבדיקה.',
      signal_row.created_at, signal_row.created_at, camera_source_id,
      array[camera_source_id], array[track_id], '{}'::uuid[], 'REAL_CAMERA_AI',
      'do-track-v1', 'system', '[]'::jsonb,
      jsonb_build_object('rule','same_site_camera_track','version','do-track-v1'),
      jsonb_build_object('canonical_incident',true,'correlation_reason','same site + camera + track ID + compatible entry/exit sequence')
    ) returning id into incident_id;
  end if;

  timeline_item := jsonb_build_object(
    'event_id', signal_row.id, 'event_type', event_type, 'timestamp', signal_row.created_at,
    'camera_source_id', camera_source_id, 'camera_name', camera_name, 'track_id', track_id,
    'provenance', 'REAL_CAMERA_AI', 'confidence', signal_row.confidence,
    'evidence_kind', signal_row.metadata->>'evidence_kind'
  );
  incident_status := case when event_type = 'person_exited' then 'closed' else 'open' end;
  incident_title := 'תנועה באזור הכניסה';
  incident_summary := case when event_type = 'person_exited'
    then 'אדם נכנס לאזור המצולם ולאחר מכן יצא.'
    else 'אדם נכנס לאזור המצולם; האירוע עדיין פתוח לבדיקה.' end;

  insert into public.observer_correlated_event_links (
    correlated_event_id, source_type, source_id, observer_site_id, event_time,
    confidence, sequence_order, metadata
  ) values (
    incident_id, 'observer_intelligence_signal', signal_row.id, signal_row.observer_site_id,
    signal_row.created_at, signal_row.confidence,
    coalesce((select max(sequence_order) + 1 from public.observer_correlated_event_links where correlated_event_id = incident_id), 0),
    jsonb_build_object('event_type',event_type,'camera_source_id',camera_source_id,'track_id',track_id,
      'provenance','REAL_CAMERA_AI','evidence_reference',signal_row.id)
  ) on conflict do nothing;

  update public.observer_correlated_events set
    status = incident_status,
    severity = case
      when severity in ('critical','urgent') then severity
      when signal_row.severity in ('critical','urgent') then signal_row.severity
      when severity = 'high' or signal_row.severity = 'high' then 'high'
      when severity = 'medium' or signal_row.severity = 'medium' then 'medium'
      else severity end,
    confidence = greatest(confidence, coalesce(signal_row.confidence, 0)),
    title = incident_title,
    summary = incident_summary,
    last_activity_at = greatest(last_activity_at, signal_row.created_at),
    end_time = case when event_type = 'person_exited' then signal_row.created_at else end_time end,
    closed_at = case when event_type = 'person_exited' then signal_row.created_at else closed_at end,
    involved_camera_ids = (select array_agg(distinct value) from unnest(involved_camera_ids || camera_source_id) value),
    involved_track_ids = (select array_agg(distinct value) from unnest(involved_track_ids || track_id) value),
    related_event_ids = (select array_agg(distinct value) from unnest(related_event_ids || signal_row.id) value),
    timeline_summary = coalesce(timeline_summary,'[]'::jsonb) || timeline_item,
    updated_at = now()
  where id = incident_id
    and not (related_event_ids @> array[signal_row.id]);

  return incident_id;
end;
$$;

create or replace function public.enforce_digital_observer_incident_transition()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.correlation_version = 'do-track-v1' and new.status is distinct from old.status
    and not (
      (old.status = 'open' and new.status in ('acknowledged','resolved','closed'))
      or (old.status = 'acknowledged' and new.status in ('resolved','closed'))
      or (old.status = 'resolved' and new.status = 'closed')
    ) then
    raise exception 'INVALID_INCIDENT_STATE_TRANSITION';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_digital_observer_incident_transition on public.observer_correlated_events;
create trigger enforce_digital_observer_incident_transition
before update of status on public.observer_correlated_events
for each row execute function public.enforce_digital_observer_incident_transition();

revoke all on function public.correlate_digital_observer_signal(uuid) from public, anon, authenticated;
grant execute on function public.correlate_digital_observer_signal(uuid) to service_role;

create or replace function public.correlate_digital_observer_signal_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.correlate_digital_observer_signal(new.id);
  return new;
end;
$$;

drop trigger if exists observer_signal_incident_correlation on public.observer_intelligence_signals;
create trigger observer_signal_incident_correlation
after insert on public.observer_intelligence_signals
for each row execute function public.correlate_digital_observer_signal_trigger();

comment on table public.observer_correlated_events is 'Canonical Digital Observer Incident storage for do-track-v1 rows; legacy correlation rows remain compatible.';
comment on function public.correlate_digital_observer_signal(uuid) is 'Deterministically correlates validated REAL_CAMERA_AI entry/exit Events into one same-site/camera/track Incident.';

notify pgrst, 'reload schema';
