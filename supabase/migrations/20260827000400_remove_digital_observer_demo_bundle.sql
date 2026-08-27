-- Removes one synthetic Digital Observer camera bundle atomically. The function
-- refuses DVR/Gateway sources and any demo clip that points at stored media.

create or replace function public.remove_digital_observer_demo_camera_bundle(
  requested_camera_source_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  source_row public.digital_observer_camera_sources;
  signal_ids uuid[] := '{}';
  deleted_signals integer := 0;
  deleted_clips integer := 0;
  deleted_rules integer := 0;
  deleted_candidates integer := 0;
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  select * into source_row
  from public.digital_observer_camera_sources
  where id = requested_camera_source_id
  for update;

  if source_row.id is null then
    raise exception 'CAMERA_SOURCE_NOT_FOUND';
  end if;
  if not public.can_manage_observer_site(source_row.observer_site_id) then
    raise exception 'OBSERVER_SITE_ACCESS_DENIED';
  end if;
  if source_row.connector_type <> 'demo'
    or source_row.source_mode <> 'demo'
    or source_row.camera_stream_id is not null
    or source_row.secret_reference is not null
    or coalesce(source_row.metadata ->> 'gateway_stream_id', '') <> ''
    or coalesce(source_row.metadata ->> 'video_gateway_stream_id', '') <> ''
    or source_row.capabilities @> '{"live_view":true}'::jsonb then
    raise exception 'ONLY_SYNTHETIC_DEMO_CAMERA_CAN_BE_REMOVED';
  end if;

  if exists (
    select 1 from public.digital_observer_event_clips
    where camera_source_id = source_row.id
      and (storage_path is not null or snapshot_storage_path is not null)
  ) then
    raise exception 'DEMO_CAMERA_HAS_STORED_MEDIA';
  end if;

  select coalesce(array_agg(id), '{}') into signal_ids
  from public.observer_intelligence_signals
  where observer_site_id = source_row.observer_site_id
    and (
      metadata ->> 'camera_source_id' = source_row.id::text
      or (source_row.camera_stream_id is not null and camera_id = source_row.camera_stream_id)
    )
    and (
      metadata @> '{"qa_demo":true}'::jsonb
      or metadata @> '{"synthetic":true}'::jsonb
    );

  delete from public.digital_observer_notification_deliveries
  where signal_id = any(signal_ids)
    and metadata @> '{"qa_demo":true}'::jsonb;

  delete from public.digital_observer_event_clips
  where camera_source_id = source_row.id
    or signal_id = any(signal_ids);
  get diagnostics deleted_clips = row_count;

  delete from public.digital_observer_identity_candidates
  where camera_source_id = source_row.id
    and (
      metadata @> '{"qa_demo":true}'::jsonb
      or metadata @> '{"synthetic":true}'::jsonb
    );
  get diagnostics deleted_candidates = row_count;

  delete from public.observer_watch_requests
  where camera_source_id = source_row.id
    and (
      metadata @> '{"qa_demo":true}'::jsonb
      or metadata @> '{"synthetic":true}'::jsonb
    );
  get diagnostics deleted_rules = row_count;

  delete from public.observer_intelligence_signals
  where id = any(signal_ids);
  get diagnostics deleted_signals = row_count;

  delete from public.digital_observer_camera_sources
  where id = source_row.id;

  return jsonb_build_object(
    'camera_removed', true,
    'signals_removed', deleted_signals,
    'clips_removed', deleted_clips,
    'rules_removed', deleted_rules,
    'identity_candidates_removed', deleted_candidates
  );
end;
$$;

revoke all on function public.remove_digital_observer_demo_camera_bundle(uuid) from public;
grant execute on function public.remove_digital_observer_demo_camera_bundle(uuid) to authenticated;

comment on function public.remove_digital_observer_demo_camera_bundle(uuid) is
  'Atomically removes one explicitly synthetic demo camera and only its synthetic dependent rows. Refuses Gateway/DVR sources and stored media.';

notify pgrst, 'reload schema';
