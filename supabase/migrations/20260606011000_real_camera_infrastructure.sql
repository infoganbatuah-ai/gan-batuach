alter table public.camera_streams
  add column if not exists provider_key text,
  add column if not exists provider_capabilities jsonb not null default '{}'::jsonb,
  add column if not exists validation_status text,
  add column if not exists validation_message text,
  add column if not exists validation_latency_ms integer,
  add column if not exists last_validation_at timestamptz,
  add column if not exists recording_status text not null default 'disabled',
  add column if not exists recording_retention_days integer,
  add column if not exists recording_storage_location text,
  add column if not exists recording_storage_used_mb numeric not null default 0,
  add column if not exists storage_provider text,
  add column if not exists storage_mode text not null default 'not_configured',
  add column if not exists estimated_daily_storage_mb numeric not null default 0,
  add column if not exists playback_hls_ready boolean not null default false,
  add column if not exists playback_webrtc_ready boolean not null default false,
  add column if not exists production_readiness jsonb not null default '{}'::jsonb;

create table if not exists public.camera_provider_registry (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null unique,
  provider_name text not null,
  provider_type text not null,
  capabilities jsonb not null default '{}'::jsonb,
  rtsp_templates jsonb not null default '[]'::jsonb,
  default_ports jsonb not null default '{}'::jsonb,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint camera_provider_registry_type_check check (provider_type in ('hikvision','dahua','uniview','axis','generic_rtsp','nvr','dvr','custom'))
);

create table if not exists public.camera_stream_validations (
  id uuid primary key default gen_random_uuid(),
  camera_id uuid references public.camera_streams(id) on delete cascade,
  garden_id uuid references public.gardens(id) on delete cascade,
  provider_key text,
  validation_type text not null default 'mock_readiness',
  status text not null default 'pending',
  rtsp_valid boolean,
  connection_valid boolean,
  credentials_valid boolean,
  stream_available boolean,
  latency_ms integer,
  candidates_tried_count integer not null default 0,
  message text,
  failure_reason text,
  gateway_required boolean not null default true,
  no_secrets_exposed boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint camera_stream_validations_status_check check (status in ('pending','success','failed','gateway_required','skipped'))
);

create table if not exists public.camera_health_history (
  id uuid primary key default gen_random_uuid(),
  camera_id uuid not null references public.camera_streams(id) on delete cascade,
  garden_id uuid references public.gardens(id) on delete cascade,
  health_status text not null,
  stream_status text,
  latency_ms integer,
  uptime_seconds bigint,
  failure_count integer,
  reconnect_attempts integer,
  gateway_registration_status text,
  message text,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now(),
  constraint camera_health_history_status_check check (health_status in ('online','offline','degraded','reconnecting','disabled','pending','unknown'))
);

create table if not exists public.camera_recording_readiness (
  id uuid primary key default gen_random_uuid(),
  camera_id uuid not null references public.camera_streams(id) on delete cascade,
  garden_id uuid references public.gardens(id) on delete cascade,
  recording_enabled boolean not null default false,
  recording_status text not null default 'disabled',
  retention_days integer,
  storage_location text,
  storage_provider text,
  estimated_daily_storage_mb numeric not null default 0,
  storage_used_mb numeric not null default 0,
  readiness_status text not null default 'not_configured',
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(camera_id),
  constraint camera_recording_readiness_status_check check (recording_status in ('enabled','disabled','pending_storage','not_implemented')),
  constraint camera_recording_readiness_readiness_check check (readiness_status in ('ready','not_configured','needs_gateway','needs_storage','disabled'))
);

create table if not exists public.camera_storage_readiness (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid references public.gardens(id) on delete cascade,
  storage_mode text not null default 'not_configured',
  storage_provider text,
  storage_location text,
  total_estimated_daily_mb numeric not null default 0,
  current_usage_mb numeric not null default 0,
  retention_days integer,
  readiness_status text not null default 'not_configured',
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(garden_id),
  constraint camera_storage_readiness_mode_check check (storage_mode in ('local','cloud','hybrid','not_configured')),
  constraint camera_storage_readiness_status_check check (readiness_status in ('ready','not_configured','needs_retention_policy','disabled'))
);

create index if not exists idx_camera_streams_provider_key on public.camera_streams(provider_key);
create index if not exists idx_camera_streams_validation_status on public.camera_streams(validation_status, last_validation_at desc);
create index if not exists idx_camera_streams_recording_status on public.camera_streams(recording_status);
create index if not exists idx_camera_validations_camera on public.camera_stream_validations(camera_id, created_at desc);
create index if not exists idx_camera_validations_garden on public.camera_stream_validations(garden_id, status, created_at desc);
create index if not exists idx_camera_health_history_camera on public.camera_health_history(camera_id, checked_at desc);
create index if not exists idx_camera_health_history_garden on public.camera_health_history(garden_id, health_status, checked_at desc);
create index if not exists idx_camera_recording_readiness_garden on public.camera_recording_readiness(garden_id, readiness_status);
create index if not exists idx_camera_storage_readiness_garden on public.camera_storage_readiness(garden_id, readiness_status);

alter table public.camera_provider_registry enable row level security;
alter table public.camera_stream_validations enable row level security;
alter table public.camera_health_history enable row level security;
alter table public.camera_recording_readiness enable row level security;
alter table public.camera_storage_readiness enable row level security;

drop policy if exists "camera provider registry readable" on public.camera_provider_registry;
create policy "camera provider registry readable" on public.camera_provider_registry
for select using (active = true or public.is_admin());

drop policy if exists "camera provider registry admin write" on public.camera_provider_registry;
create policy "camera provider registry admin write" on public.camera_provider_registry
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "camera stream validations scoped read" on public.camera_stream_validations;
create policy "camera stream validations scoped read" on public.camera_stream_validations
for select using (public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "camera stream validations scoped insert" on public.camera_stream_validations;
create policy "camera stream validations scoped insert" on public.camera_stream_validations
for insert with check (public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "camera health history scoped read" on public.camera_health_history;
create policy "camera health history scoped read" on public.camera_health_history
for select using (public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "camera health history scoped insert" on public.camera_health_history;
create policy "camera health history scoped insert" on public.camera_health_history
for insert with check (public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "camera recording readiness scoped read" on public.camera_recording_readiness;
create policy "camera recording readiness scoped read" on public.camera_recording_readiness
for select using (public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "camera recording readiness scoped write" on public.camera_recording_readiness;
create policy "camera recording readiness scoped write" on public.camera_recording_readiness
for all using (public.is_admin() or public.can_access_garden(garden_id))
with check (public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "camera storage readiness scoped read" on public.camera_storage_readiness;
create policy "camera storage readiness scoped read" on public.camera_storage_readiness
for select using (public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "camera storage readiness scoped write" on public.camera_storage_readiness;
create policy "camera storage readiness scoped write" on public.camera_storage_readiness
for all using (public.is_admin() or public.can_access_garden(garden_id))
with check (public.is_admin() or public.can_access_garden(garden_id));

insert into public.camera_provider_registry (provider_key, provider_name, provider_type, capabilities, rtsp_templates, default_ports, notes)
values
  ('hikvision', 'Hikvision', 'hikvision', '{"rtsp":true,"onvif":true,"dvr":true,"nvr":true,"hls":false,"webrtc":false,"recording_ready":true}'::jsonb, '["/Streaming/Channels/{channel}{quality_code}"]'::jsonb, '{"rtsp":554,"http":80,"https":443}'::jsonb, 'Common Hikvision DVR/NVR/IP camera RTSP readiness.'),
  ('dahua', 'Dahua', 'dahua', '{"rtsp":true,"onvif":true,"dvr":true,"nvr":true,"hls":false,"webrtc":false,"recording_ready":true}'::jsonb, '["/cam/realmonitor?channel={channel}&subtype={subtype}"]'::jsonb, '{"rtsp":554,"http":80,"https":443}'::jsonb, 'Common Dahua DVR/NVR/IP camera RTSP readiness.'),
  ('uniview', 'Uniview', 'uniview', '{"rtsp":true,"onvif":true,"dvr":true,"nvr":true,"hls":false,"webrtc":false,"recording_ready":true}'::jsonb, '["/unicast/c{channel}/s{stream}"]'::jsonb, '{"rtsp":554,"http":80,"https":443}'::jsonb, 'Uniview readiness profile.'),
  ('axis', 'Axis', 'axis', '{"rtsp":true,"onvif":true,"ip_camera":true,"hls":false,"webrtc":false,"recording_ready":true}'::jsonb, '["/axis-media/media.amp"]'::jsonb, '{"rtsp":554,"http":80,"https":443}'::jsonb, 'Axis IP camera readiness profile.'),
  ('generic_rtsp', 'Generic RTSP', 'generic_rtsp', '{"rtsp":true,"manual_rtsp":true,"hls":false,"webrtc":false,"recording_ready":true}'::jsonb, '["/ch{channel}/{quality}"]'::jsonb, '{"rtsp":554}'::jsonb, 'Generic RTSP fallback profile.'),
  ('nvr', 'Generic NVR', 'nvr', '{"rtsp":true,"nvr":true,"multi_channel":true,"recording_ready":true}'::jsonb, '["/Streaming/Channels/{channel}{quality_code}","/cam/realmonitor?channel={channel}&subtype={subtype}"]'::jsonb, '{"rtsp":554,"http":80}'::jsonb, 'Generic network video recorder profile.'),
  ('dvr', 'Generic DVR', 'dvr', '{"rtsp":true,"dvr":true,"multi_channel":true,"recording_ready":true}'::jsonb, '["/cam/realmonitor?channel={channel}&subtype={subtype}","/ch{channel}/{quality}"]'::jsonb, '{"rtsp":554,"http":80}'::jsonb, 'Generic digital video recorder profile.')
on conflict (provider_key) do update set
  provider_name = excluded.provider_name,
  provider_type = excluded.provider_type,
  capabilities = excluded.capabilities,
  rtsp_templates = excluded.rtsp_templates,
  default_ports = excluded.default_ports,
  notes = excluded.notes,
  updated_at = now();

comment on table public.camera_provider_registry is 'Readiness registry for camera vendors and DVR/NVR/IP capabilities. No credentials are stored here.';
comment on table public.camera_stream_validations is 'Mock/production-readiness stream validation log. Does not expose RTSP URLs or credentials.';
comment on table public.camera_health_history is 'Camera health timeline for online/offline/degraded/reconnecting/disabled states.';
comment on table public.camera_recording_readiness is 'Future recording readiness only. This migration does not implement recording.';
comment on table public.camera_storage_readiness is 'Future local/cloud/hybrid storage readiness and estimates only.';
