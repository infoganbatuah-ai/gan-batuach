-- Camera infrastructure readiness for a future Video Gateway.
-- This does not change the current deployment/runtime; it only extends metadata
-- needed for production camera inventory, health and recording policies.

alter table public.camera_streams
  add column if not exists source_url text,
  add column if not exists stream_status text default 'pending',
  add column if not exists health_status text default 'pending',
  add column if not exists last_seen timestamptz,
  add column if not exists connection_method text,
  add column if not exists last_successful_connection_at timestamptz,
  add column if not exists last_stream_activity_at timestamptz,
  add column if not exists uptime_seconds bigint not null default 0,
  add column if not exists failure_count integer not null default 0,
  add column if not exists reconnect_attempts integer not null default 0,
  add column if not exists recording_enabled boolean not null default false,
  add column if not exists retention_days integer,
  add column if not exists archive_policy text,
  add column if not exists disabled_at timestamptz,
  add column if not exists disabled_by uuid,
  add column if not exists health_summary jsonb not null default '{}'::jsonb;

create index if not exists idx_camera_streams_stream_status
  on public.camera_streams(stream_status);

create index if not exists idx_camera_streams_health_status
  on public.camera_streams(health_status);

create index if not exists idx_camera_streams_last_seen
  on public.camera_streams(last_seen desc);

create index if not exists idx_camera_streams_kindergarten_status
  on public.camera_streams(garden_id, status, active);

create index if not exists idx_camera_streams_kindergarten_alias_status
  on public.camera_streams(kindergarten_id, status, active);

comment on column public.camera_streams.source_url is
  'Server-side camera source locator. Do not expose RTSP/ONVIF/DVR credentials to browsers.';

comment on column public.camera_streams.stream_status is
  'Future Video Gateway stream status: connected, connecting, pending, offline, error, disabled.';

comment on column public.camera_streams.health_status is
  'Aggregated health status for camera operations: healthy, warning, offline, error, pending.';

comment on column public.camera_streams.recording_enabled is
  'Readiness flag for future recording/archive service. Recording is not implemented by this migration.';
