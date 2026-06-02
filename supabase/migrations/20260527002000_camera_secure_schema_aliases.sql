alter table public.camera_streams
  add column if not exists kindergarten_id uuid references public.gardens(id) on delete cascade,
  add column if not exists source_type text,
  add column if not exists encrypted_password text,
  add column if not exists secret_ref text,
  add column if not exists sample_hls_url text,
  add column if not exists gateway_stream_id text,
  add column if not exists parent_viewing_allowed boolean not null default false;

update public.camera_streams
set
  kindergarten_id = coalesce(kindergarten_id, garden_id),
  source_type = coalesce(source_type, camera_type),
  sample_hls_url = coalesce(sample_hls_url, hls_playback_url),
  gateway_stream_id = coalesce(gateway_stream_id, video_gateway_stream_id),
  parent_viewing_allowed = coalesce(parent_viewing_allowed, parent_view_allowed)
where garden_id is not null;

create index if not exists idx_camera_streams_kindergarten on public.camera_streams(kindergarten_id);

notify pgrst, 'reload schema';
