-- PHASE 100-5: real camera deployment readiness.
-- No camera credentials are required and no production camera connection is activated.

alter table public.camera_streams
  add column if not exists deployment_scope text not null default 'kindergarten_production',
  add column if not exists test_site_type text,
  add column if not exists camera_provider_key text,
  add column if not exists gateway_provider_preference text,
  add column if not exists live_preview_status text not null default 'pending_gateway',
  add column if not exists clip_readiness_status text not null default 'not_configured',
  add column if not exists snapshot_readiness_status text not null default 'not_configured',
  add column if not exists permission_model text not null default 'scoped_playback_token',
  add column if not exists security_review jsonb not null default '{"rtsp_exposed":false,"credentials_browser_exposed":false,"gateway_secret_browser_exposed":false}'::jsonb;

create table if not exists public.camera_gateway_deployments (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  status text not null default 'not_configured',
  environment text not null default 'sandbox',
  health_status text not null default 'unknown',
  active_streams integer not null default 0,
  failed_streams integer not null default 0,
  public_playback_ready boolean not null default false,
  hls_ready boolean not null default false,
  webrtc_ready boolean not null default false,
  api_configured boolean not null default false,
  secret_configured boolean not null default false,
  last_health_checked_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, environment),
  constraint camera_gateway_deployments_provider_check check (provider in ('mediamtx','go2rtc','custom')),
  constraint camera_gateway_deployments_status_check check (status in ('not_configured','configured','testing','active','disabled')),
  constraint camera_gateway_deployments_health_check check (health_status in ('unknown','healthy','degraded','offline','failed'))
);

create table if not exists public.camera_deployment_test_sites (
  id uuid primary key default gen_random_uuid(),
  site_key text not null unique,
  site_type text not null,
  display_name text not null,
  purpose text not null,
  isolated_from_kindergarten_data boolean not null default true,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint camera_deployment_test_sites_type_check check (site_type in ('home_test','business_test','kindergarten_test'))
);

create table if not exists public.camera_deployment_audit_logs (
  id uuid primary key default gen_random_uuid(),
  camera_id uuid references public.camera_streams(id) on delete set null,
  garden_id uuid references public.gardens(id) on delete set null,
  observer_site_id uuid references public.observer_sites(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_role text,
  action text not null,
  status text not null default 'logged',
  gateway_provider text,
  validation_status text,
  no_secrets_exposed boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint camera_deployment_audit_status_check check (status in ('logged','success','failed','skipped'))
);

create index if not exists idx_camera_streams_deployment_scope on public.camera_streams(deployment_scope, test_site_type);
create index if not exists idx_camera_streams_camera_provider_key on public.camera_streams(camera_provider_key);
create index if not exists idx_camera_gateway_deployments_status on public.camera_gateway_deployments(status, health_status);
create index if not exists idx_camera_deployment_audit_camera on public.camera_deployment_audit_logs(camera_id, created_at desc);
create index if not exists idx_camera_deployment_audit_garden on public.camera_deployment_audit_logs(garden_id, created_at desc);
create index if not exists idx_camera_deployment_audit_site on public.camera_deployment_audit_logs(observer_site_id, created_at desc);

alter table public.camera_gateway_deployments enable row level security;
alter table public.camera_deployment_test_sites enable row level security;
alter table public.camera_deployment_audit_logs enable row level security;

drop policy if exists "camera gateway deployments admin only" on public.camera_gateway_deployments;
create policy "camera gateway deployments admin only"
on public.camera_gateway_deployments
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "camera deployment test sites admin read" on public.camera_deployment_test_sites;
create policy "camera deployment test sites admin read"
on public.camera_deployment_test_sites
for select using (public.is_admin());

drop policy if exists "camera deployment test sites admin write" on public.camera_deployment_test_sites;
create policy "camera deployment test sites admin write"
on public.camera_deployment_test_sites
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "camera deployment audit scoped read" on public.camera_deployment_audit_logs;
create policy "camera deployment audit scoped read"
on public.camera_deployment_audit_logs
for select using (
  public.is_admin()
  or public.can_access_garden(garden_id)
  or exists (
    select 1
    from public.observer_site_memberships m
    where m.observer_site_id = camera_deployment_audit_logs.observer_site_id
      and m.profile_id = auth.uid()
      and m.active = true
  )
);

drop policy if exists "camera deployment audit scoped insert" on public.camera_deployment_audit_logs;
create policy "camera deployment audit scoped insert"
on public.camera_deployment_audit_logs
for insert with check (
  public.is_admin()
  or public.can_access_garden(garden_id)
  or exists (
    select 1
    from public.observer_site_memberships m
    where m.observer_site_id = camera_deployment_audit_logs.observer_site_id
      and m.profile_id = auth.uid()
      and m.active = true
  )
);

insert into public.camera_gateway_deployments (
  provider,
  status,
  environment,
  health_status,
  hls_ready,
  webrtc_ready,
  metadata
)
values
  ('mediamtx','not_configured','sandbox','unknown',true,true,'{"notes":"MediaMTX HLS/WebRTC gateway readiness. Secrets remain server-only."}'::jsonb),
  ('go2rtc','not_configured','sandbox','unknown',true,true,'{"notes":"go2rtc stream gateway readiness. Secrets remain server-only."}'::jsonb),
  ('custom','not_configured','sandbox','unknown',true,true,'{"notes":"Custom video gateway readiness."}'::jsonb)
on conflict (provider, environment) do update set
  metadata = public.camera_gateway_deployments.metadata || excluded.metadata,
  updated_at = now();

insert into public.camera_deployment_test_sites (site_key, site_type, display_name, purpose, metadata)
values
  ('daniel_home_camera','home_test','בדיקת מצלמת בית','בדיקה מבודדת עם מצלמה ביתית לפני חיבור גנים אמיתיים.','{"owner":"Daniel","production_data":false}'::jsonb),
  ('business_camera_lab','business_test','בדיקת עסק','בדיקת תרחיש עסקי מבודד ל-Digital Observer.','{"production_data":false}'::jsonb),
  ('kindergarten_camera_lab','kindergarten_test','בדיקת גן ניסיון','בדיקת תרחיש גן בלי לערבב עם נתוני גן פעיל.','{"production_data":false}'::jsonb)
on conflict (site_key) do update set
  display_name = excluded.display_name,
  purpose = excluded.purpose,
  metadata = public.camera_deployment_test_sites.metadata || excluded.metadata,
  updated_at = now();

insert into public.camera_provider_registry (provider_key, provider_name, provider_type, capabilities, rtsp_templates, default_ports, notes)
values
  ('ip_camera', 'Generic IP Camera', 'custom', '{"rtsp":true,"onvif":true,"ip_camera":true,"recording_ready":true}'::jsonb, '["/stream1","/ch{channel}/{quality}"]'::jsonb, '{"rtsp":554,"http":80,"https":443}'::jsonb, 'Generic IP camera profile.'),
  ('generic_camera', 'Generic Camera', 'custom', '{"rtsp":true,"onvif":true,"manual_rtsp":true,"recording_ready":true}'::jsonb, '["/ch{channel}/{quality}","/stream{channel}"]'::jsonb, '{"rtsp":554,"http":80}'::jsonb, 'Generic fallback camera profile.')
on conflict (provider_key) do update set
  provider_name = excluded.provider_name,
  capabilities = excluded.capabilities,
  rtsp_templates = excluded.rtsp_templates,
  default_ports = excluded.default_ports,
  notes = excluded.notes,
  updated_at = now();

comment on column public.camera_streams.deployment_scope is 'kindergarten_production, home_test, business_test, kindergarten_test, or observer_site. Test scopes must stay isolated from production kindergarten data.';
comment on column public.camera_streams.security_review is 'Security readiness snapshot. RTSP URLs, credentials and gateway secrets must not be exposed to browsers.';
comment on table public.camera_gateway_deployments is 'Gateway deployment readiness for MediaMTX, go2rtc and custom providers. No secrets are stored here.';
comment on table public.camera_deployment_test_sites is 'Isolated test camera/site records for home, business and kindergarten testing.';
comment on table public.camera_deployment_audit_logs is 'Camera deployment and validation audit trail without secrets.';

notify pgrst, 'reload schema';
