alter table public.camera_streams
  add column if not exists gateway_provider text,
  add column if not exists gateway_source_id text,
  add column if not exists gateway_playback_id text,
  add column if not exists gateway_registered_at timestamptz,
  add column if not exists gateway_health_status text,
  add column if not exists gateway_latency_ms integer,
  add column if not exists gateway_stream_count integer not null default 0,
  add column if not exists gateway_failed_stream_count integer not null default 0,
  add column if not exists storage_location text;

alter table public.camera_streams
  drop constraint if exists camera_streams_gateway_registration_status_check;

alter table public.camera_streams
  add constraint camera_streams_gateway_registration_status_check check (
    gateway_registration_status is null
    or gateway_registration_status in ('pending_gateway', 'registering', 'registered', 'failed', 'offline', 'disabled')
  );

create table if not exists public.camera_playback_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  camera_id uuid not null references public.camera_streams(id) on delete cascade,
  kindergarten_id uuid not null references public.gardens(id) on delete cascade,
  playback_protocol text not null default 'HLS',
  gateway_provider text,
  token_hash text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  ip text,
  user_agent text,
  duration_seconds integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint camera_playback_sessions_protocol_check check (playback_protocol in ('HLS', 'WebRTC'))
);

create index if not exists idx_camera_playback_sessions_profile
  on public.camera_playback_sessions(profile_id, started_at desc);

create index if not exists idx_camera_playback_sessions_camera
  on public.camera_playback_sessions(camera_id, started_at desc);

create index if not exists idx_camera_streams_gateway_provider
  on public.camera_streams(gateway_provider, gateway_registration_status);

alter table public.camera_playback_sessions enable row level security;

drop policy if exists "camera playback sessions scoped read" on public.camera_playback_sessions;
create policy "camera playback sessions scoped read" on public.camera_playback_sessions
for select using (
  public.is_admin()
  or profile_id = auth.uid()
  or public.can_access_garden(kindergarten_id)
);

drop policy if exists "camera playback sessions insert self" on public.camera_playback_sessions;
create policy "camera playback sessions insert self" on public.camera_playback_sessions
for insert with check (
  profile_id = auth.uid()
  or public.is_admin()
);

drop policy if exists "camera playback sessions update self" on public.camera_playback_sessions;
create policy "camera playback sessions update self" on public.camera_playback_sessions
for update using (
  profile_id = auth.uid()
  or public.is_admin()
)
with check (
  profile_id = auth.uid()
  or public.is_admin()
);

comment on table public.camera_playback_sessions is 'Audits every secure camera playback session. Never stores RTSP URLs, camera passwords or gateway secrets.';
comment on column public.camera_streams.gateway_source_id is 'Gateway source identifier only. Not an RTSP URL and not a credential.';
comment on column public.camera_streams.storage_location is 'Readiness field for future recording storage location. Recording is not implemented yet.';

notify pgrst, 'reload schema';
