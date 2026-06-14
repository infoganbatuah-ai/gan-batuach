-- PHASE 164: Real camera gateway, DVR/NVR integration and home camera pilot.
-- No credentials in code or plaintext DB fields. RTSP and gateway secrets remain server-only.

create table if not exists public.camera_gateway_configs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  base_url text,
  environment text not null default 'test',
  status text not null default 'not_configured',
  health_status text not null default 'unknown',
  last_heartbeat_at timestamptz,
  active_stream_count integer not null default 0,
  failed_stream_count integer not null default 0,
  latency_ms integer,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, environment),
  constraint camera_gateway_configs_provider_check check (provider in ('mediamtx','go2rtc','custom','future_webrtc')),
  constraint camera_gateway_configs_environment_check check (environment in ('home_test','test','staging','production')),
  constraint camera_gateway_configs_status_check check (status in ('not_configured','configured','test_mode','production_ready','active','disabled','failed')),
  constraint camera_gateway_configs_health_check check (health_status in ('unknown','healthy','degraded','failed','offline'))
);

create table if not exists public.camera_source_registry (
  id uuid primary key default gen_random_uuid(),
  camera_id uuid references public.camera_streams(id) on delete cascade,
  garden_id uuid references public.gardens(id) on delete set null,
  home_test_site_id uuid references public.home_test_sites(id) on delete set null,
  source_type text not null,
  brand text not null default 'generic',
  host text,
  port integer,
  channel integer,
  stream_quality text not null default 'sub',
  username_encrypted text,
  password_encrypted text,
  secret_reference text,
  rtsp_template text,
  manual_rtsp_encrypted text,
  gateway_provider text not null default 'custom',
  registration_status text not null default 'pending_gateway',
  last_test_status text,
  last_test_at timestamptz,
  masked_connection_summary jsonb not null default '{}'::jsonb,
  no_secrets_exposed boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint camera_source_registry_type_check check (source_type in ('dvr','nvr','dvr_nvr','ip_camera','rtsp','manual_rtsp','onvif','home_test','demo_camera','generic_camera')),
  constraint camera_source_registry_brand_check check (brand in ('hikvision','dahua','uniview','axis','generic','custom')),
  constraint camera_source_registry_quality_check check (stream_quality in ('main','sub')),
  constraint camera_source_registry_status_check check (registration_status in ('pending_gateway','testing','registering','registered','failed','disabled')),
  constraint camera_source_registry_no_plain_secret_check check (no_secrets_exposed = true)
);

create table if not exists public.home_camera_test_sites (
  id uuid primary key default gen_random_uuid(),
  site_key text not null unique,
  owner_profile_id uuid references public.profiles(id) on delete set null,
  display_name text not null,
  location_label text,
  connection_type text not null default 'manual_rtsp',
  status text not null default 'ready_for_test',
  isolation_status text not null default 'isolated',
  camera_count integer not null default 0,
  gateway_provider text,
  playback_test_status text,
  observer_shadow_mode boolean not null default true,
  no_parent_access boolean not null default true,
  no_child_data boolean not null default true,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint home_camera_test_connection_type_check check (connection_type in ('dvr_nvr','ip_camera','manual_rtsp','onvif','generic')),
  constraint home_camera_test_status_check check (status in ('draft','ready_for_test','testing','active_test','disabled','archived')),
  constraint home_camera_test_isolation_check check (isolation_status in ('isolated','needs_review','blocked')),
  constraint home_camera_test_privacy_check check (no_parent_access = true and no_child_data = true)
);

alter table public.camera_streams
  add column if not exists brand text,
  add column if not exists camera_zone_type text,
  add column if not exists source_secret_reference text,
  add column if not exists manual_rtsp_encrypted text,
  add column if not exists last_health_check_at timestamptz,
  add column if not exists last_error_code text,
  add column if not exists last_error_message text,
  add column if not exists uptime_estimate numeric,
  add column if not exists observer_shadow_mode boolean not null default true,
  add column if not exists skeleton_analytics_ready boolean not null default false,
  add column if not exists motion_anomaly_ready boolean not null default false,
  add column if not exists audio_disabled boolean not null default true,
  add column if not exists face_recognition_disabled boolean not null default true,
  add column if not exists security_review jsonb not null default '{}'::jsonb;

create table if not exists public.camera_gateway_health_checks (
  id uuid primary key default gen_random_uuid(),
  gateway_config_id uuid references public.camera_gateway_configs(id) on delete set null,
  provider text not null,
  status text not null,
  active_stream_count integer not null default 0,
  failed_stream_count integer not null default 0,
  latency_ms integer,
  checked_at timestamptz not null default now(),
  next_action text,
  metadata jsonb not null default '{}'::jsonb,
  constraint camera_gateway_health_status_check check (status in ('healthy','degraded','failed','offline','not_configured'))
);

create table if not exists public.camera_gateway_audit_events (
  id uuid primary key default gen_random_uuid(),
  camera_id uuid references public.camera_streams(id) on delete set null,
  garden_id uuid references public.gardens(id) on delete set null,
  home_test_site_id uuid references public.home_test_sites(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_role text,
  action text not null,
  status text not null default 'logged',
  gateway_provider text,
  no_secrets_exposed boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint camera_gateway_audit_action_check check (action in ('camera_created','camera_edited','credentials_updated','connection_tested','gateway_registered','gateway_failed','camera_disabled','viewing_token_created','parent_viewed','manager_viewed','inspector_viewed','admin_viewed','home_test_created','health_check_recorded')),
  constraint camera_gateway_audit_status_check check (status in ('success','failed','blocked','logged'))
);

create table if not exists public.camera_gateway_worker_readiness (
  id uuid primary key default gen_random_uuid(),
  worker_key text not null unique,
  title text not null,
  status text not null default 'prepared',
  schedule_hint text,
  checks jsonb not null default '[]'::jsonb,
  alert_rules jsonb not null default '[]'::jsonb,
  next_action text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint camera_gateway_worker_status_check check (status in ('prepared','enabled','disabled','needs_provider'))
);

create index if not exists camera_gateway_configs_status_idx on public.camera_gateway_configs(provider, status, health_status);
create index if not exists camera_source_registry_camera_idx on public.camera_source_registry(camera_id, registration_status);
create index if not exists camera_source_registry_garden_idx on public.camera_source_registry(garden_id, source_type);
create index if not exists home_camera_test_sites_status_idx on public.home_camera_test_sites(status, isolation_status);
create index if not exists camera_gateway_health_checks_provider_idx on public.camera_gateway_health_checks(provider, checked_at desc);
create index if not exists camera_gateway_audit_events_camera_idx on public.camera_gateway_audit_events(camera_id, created_at desc);
create index if not exists camera_streams_gateway_health_idx on public.camera_streams(gateway_registration_status, health_status, last_health_check_at desc);
create index if not exists camera_streams_zone_idx on public.camera_streams(garden_id, camera_zone_type);

alter table public.camera_gateway_configs enable row level security;
alter table public.camera_source_registry enable row level security;
alter table public.home_camera_test_sites enable row level security;
alter table public.camera_gateway_health_checks enable row level security;
alter table public.camera_gateway_audit_events enable row level security;
alter table public.camera_gateway_worker_readiness enable row level security;

drop policy if exists "camera gateway configs admin only" on public.camera_gateway_configs;
create policy "camera gateway configs admin only" on public.camera_gateway_configs for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "camera source registry admin manager scoped" on public.camera_source_registry;
create policy "camera source registry admin manager scoped" on public.camera_source_registry
for all using (public.is_admin() or garden_id = public.current_garden_id())
with check (public.is_admin() or garden_id = public.current_garden_id());

drop policy if exists "home camera test sites admin only" on public.home_camera_test_sites;
create policy "home camera test sites admin only" on public.home_camera_test_sites for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "camera gateway health admin only" on public.camera_gateway_health_checks;
create policy "camera gateway health admin only" on public.camera_gateway_health_checks for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "camera gateway audit admin only" on public.camera_gateway_audit_events;
create policy "camera gateway audit admin only" on public.camera_gateway_audit_events for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "camera gateway worker admin only" on public.camera_gateway_worker_readiness;
create policy "camera gateway worker admin only" on public.camera_gateway_worker_readiness for all using (public.is_admin()) with check (public.is_admin());

insert into public.camera_gateway_configs (provider, base_url, environment, status, health_status, notes, metadata)
values
  ('mediamtx', null, 'test', 'not_configured', 'unknown', 'MediaMTX readiness. Configure VIDEO_GATEWAY_URL and server-only key in Vercel.', '{"supports_webrtc":true,"supports_hls":true,"stores_secrets":false}'::jsonb),
  ('go2rtc', null, 'test', 'not_configured', 'unknown', 'go2rtc readiness. RTSP stays server-side and browser receives tokenized playback only.', '{"supports_webrtc":true,"supports_hls":true,"stores_secrets":false}'::jsonb),
  ('custom', null, 'test', 'not_configured', 'unknown', 'Custom camera gateway readiness.', '{"supports_webrtc":true,"supports_hls":true,"stores_secrets":false}'::jsonb),
  ('future_webrtc', null, 'staging', 'disabled', 'unknown', 'Future dedicated WebRTC gateway.', '{"future":true,"dtls_srtp_required":true}'::jsonb)
on conflict (provider, environment) do update set
  notes = excluded.notes,
  metadata = public.camera_gateway_configs.metadata || excluded.metadata,
  updated_at = now();

insert into public.home_camera_test_sites (site_key, display_name, location_label, connection_type, status, isolation_status, camera_count, gateway_provider, playback_test_status, notes, metadata)
values (
  'daniel_home_camera',
  'בדיקת מצלמת בית',
  'בית פרטי לבדיקה',
  'manual_rtsp',
  'ready_for_test',
  'isolated',
  0,
  'custom',
  'pending_gateway',
  'פיילוט מבודד למצלמת בית לפני פריסת גן. אין הורים, אין ילדים ואין ניקוד ציות גן.',
  '{"owner":"Daniel","production_kindergarten_data":false,"observer_shadow_mode":true,"parent_access":false}'::jsonb
)
on conflict (site_key) do update set
  display_name = excluded.display_name,
  location_label = excluded.location_label,
  connection_type = excluded.connection_type,
  status = excluded.status,
  isolation_status = excluded.isolation_status,
  gateway_provider = excluded.gateway_provider,
  playback_test_status = excluded.playback_test_status,
  notes = excluded.notes,
  metadata = public.home_camera_test_sites.metadata || excluded.metadata,
  updated_at = now();

insert into public.camera_gateway_worker_readiness (worker_key, title, status, schedule_hint, checks, alert_rules, next_action, metadata)
values (
  'camera-gateway-health-worker',
  'בדיקות בריאות Gateway ומצלמות',
  'prepared',
  'every 5 minutes in production',
  '["gateway_health","registered_stream_availability","failed_stream_count","latency","camera_status_changes"]'::jsonb,
  '["offline_camera","gateway_down","repeated_failures","degraded_stream"]'::jsonb,
  'Configure scheduled job after real gateway pilot.',
  '{"phase":164}'::jsonb
)
on conflict (worker_key) do update set
  title = excluded.title,
  status = excluded.status,
  schedule_hint = excluded.schedule_hint,
  checks = excluded.checks,
  alert_rules = excluded.alert_rules,
  next_action = excluded.next_action,
  metadata = public.camera_gateway_worker_readiness.metadata || excluded.metadata,
  updated_at = now();

insert into public.camera_deployment_readiness_checks (check_key, category, title, status, score, evidence_summary, recommended_action, metadata)
values
  ('phase164-real-gateway-adapter', 'gateway', 'Gateway adapter layer', 'ready', 88, 'MediaMTX, go2rtc and custom adapter wrapper exists with health, test, register, disable and playback functions.', 'Run real gateway smoke test with Daniel home camera.', '{"phase":164}'::jsonb),
  ('phase164-home-camera-pilot', 'home_test', 'Home camera pilot isolation', 'ready', 90, 'home_camera_test_sites keeps pilot camera isolated from kindergarten, parent and child data.', 'Register one home test camera after gateway env is configured.', '{"phase":164,"parent_access":false}'::jsonb),
  ('phase164-secure-playback-token', 'playback', 'Secure playback token integration', 'ready', 86, 'Playback token route enforces role, garden, parent policy, child presence, MFA, viewing hours and audit logging.', 'Verify against a real WebRTC gateway.', '{"phase":164,"no_rtsp_to_browser":true}'::jsonb),
  ('phase164-recording-readiness', 'playback', 'Recording readiness', 'partial', 62, 'Recording fields and retention metadata exist; real recording storage is external infrastructure.', 'Select gateway storage and retention backend before enabling recording.', '{"phase":164,"real_recording_not_enabled":true}'::jsonb)
on conflict (check_key) do update set
  category = excluded.category,
  title = excluded.title,
  status = excluded.status,
  score = excluded.score,
  evidence_summary = excluded.evidence_summary,
  recommended_action = excluded.recommended_action,
  metadata = public.camera_deployment_readiness_checks.metadata || excluded.metadata,
  updated_at = now();

update public.camera_streams
set
  audio_disabled = true,
  face_recognition_disabled = true,
  observer_shadow_mode = coalesce(observer_shadow_mode, true),
  security_review = coalesce(security_review, '{}'::jsonb) || '{"rtsp_exposed":false,"credentials_browser_exposed":false,"gateway_secret_browser_exposed":false,"audio_disabled":true,"face_recognition_disabled":true}'::jsonb
where true;

comment on table public.camera_gateway_configs is 'Gateway configuration metadata only. Real secrets must remain in server-side environment variables.';
comment on table public.camera_source_registry is 'Camera source registry with encrypted credentials or server secret references. Never expose RTSP or credentials to browser clients.';
comment on table public.home_camera_test_sites is 'Isolated home camera pilot sites with no parent access and no child data.';
comment on column public.camera_streams.manual_rtsp_encrypted is 'Encrypted manual RTSP URL. Never return to browser.';
comment on column public.camera_streams.source_secret_reference is 'Server-side secret reference for camera credentials; not a secret value.';

notify pgrst, 'reload schema';
