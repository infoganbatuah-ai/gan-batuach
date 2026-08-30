begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'digital-observer-event-media',
  'digital-observer-event-media',
  false,
  10485760,
  array['video/mp4', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table if exists public.digital_observer_event_clips
  add column if not exists media_status text not null default 'missing',
  add column if not exists media_missing_reason text,
  add column if not exists retry_count integer not null default 0,
  add column if not exists window_seconds_before integer not null default 0,
  add column if not exists window_seconds_after integer not null default 0,
  add column if not exists last_media_attempt_at timestamptz;

do $$
begin
  alter table public.digital_observer_event_clips
    add constraint digital_observer_event_clips_media_status_check
    check (media_status in ('missing','queued','capturing','available','failed','expired'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.digital_observer_event_clips
    add constraint digital_observer_event_clips_retry_check
    check (retry_count between 0 and 5);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.digital_observer_event_clips
    add constraint digital_observer_event_clips_window_check
    check (window_seconds_before between 0 and 15 and window_seconds_after between 0 and 15);
exception when duplicate_object then null;
end $$;

update public.digital_observer_event_clips
set media_status = case
      when clip_status = 'available' and storage_path is not null and snapshot_storage_path is not null then 'available'
      when clip_status in ('failed','expired') then clip_status
      else 'missing'
    end,
    media_missing_reason = case
      when clip_status = 'available' and storage_path is not null and snapshot_storage_path is not null then null
      when camera_source_id is null then 'missing_camera_source'
      when snapshot_storage_path is null then 'missing_thumbnail'
      when storage_path is null then 'missing_clip'
      else coalesce(media_missing_reason, 'media_not_captured')
    end,
    window_seconds_before = greatest(0, window_seconds_before),
    window_seconds_after = greatest(0, window_seconds_after)
where media_status = 'missing'
   or media_missing_reason is null
   or window_seconds_before < 0
   or window_seconds_after < 0;

create unique index if not exists digital_observer_event_clips_signal_unique
  on public.digital_observer_event_clips(signal_id)
  where signal_id is not null;

create index if not exists digital_observer_event_clips_media_status_idx
  on public.digital_observer_event_clips(observer_site_id, media_status, captured_at desc);

with first_active_camera as (
  select distinct on (cs.observer_site_id)
    cs.observer_site_id,
    cs.id
  from public.digital_observer_camera_sources cs
  where coalesce(cs.status, '') in ('connected','active','ready')
    and coalesce(cs.health_status, '') in ('healthy','unknown')
  order by cs.observer_site_id, cs.created_at asc
)
update public.observer_intelligence_signals s
set metadata = coalesce(s.metadata, '{}'::jsonb) || jsonb_build_object(
  'camera_source_id', c.id,
  'evidence_repair', 'linked_first_active_camera_source'
)
from first_active_camera c
where s.observer_site_id is not null
  and c.observer_site_id = s.observer_site_id
  and s.source_type = 'system'
  and coalesce(s.metadata, '{}'::jsonb) ? 'event_type'
  and coalesce(s.metadata, '{}'::jsonb)->>'event_type' in ('home_learning_started','home_learning_progress','home_activity_change')
  and not (coalesce(s.metadata, '{}'::jsonb) ? 'camera_source_id');

grant select (
  id, observer_site_id, camera_source_id, signal_id, title, clip_status,
  captured_at, duration_seconds, retention_hours, delete_after, downloadable,
  media_status, media_missing_reason, retry_count, window_seconds_before,
  window_seconds_after, last_media_attempt_at, metadata, created_at, updated_at
) on table public.digital_observer_event_clips to authenticated;

comment on column public.digital_observer_event_clips.media_status is 'Event media lifecycle. Review UI treats missing thumbnail/clip/source as a technical fault, not a reviewable event.';
comment on column public.digital_observer_event_clips.media_missing_reason is 'Precise non-secret reason media evidence is unavailable.';
comment on column public.digital_observer_event_clips.window_seconds_before is 'Requested local read-only capture window before the event timestamp.';
comment on column public.digital_observer_event_clips.window_seconds_after is 'Requested local read-only capture window after the event timestamp.';

commit;
