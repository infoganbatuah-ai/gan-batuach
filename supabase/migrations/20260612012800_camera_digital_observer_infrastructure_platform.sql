-- PHASE 128: Camera and Digital Observer Infrastructure Platform.
-- Extends existing camera, gateway, playback and observer tables. No duplicate camera model.

alter table public.camera_streams
  add column if not exists source_category text not null default 'rtsp_direct',
  add column if not exists camera_zone_label text,
  add column if not exists operating_hours jsonb not null default '{"mode":"always"}'::jsonb,
  add column if not exists parent_visibility_status text not null default 'blocked',
  add column if not exists parent_blocked_reason text,
  add column if not exists staff_view_allowed boolean not null default false,
  add column if not exists inspector_view_allowed boolean not null default true,
  add column if not exists inspector_access_policy text not null default 'assigned_garden_with_reason',
  add column if not exists observer_enabled boolean not null default false,
  add column if not exists observer_review_required boolean not null default true,
  add column if not exists observer_confidence_threshold numeric(5, 4) not null default 0.75,
  add column if not exists observer_zone_mapping jsonb not null default '{}'::jsonb,
  add column if not exists safety_indicator_categories text[] not null default '{}',
  add column if not exists privacy_policy jsonb not null default '{"parent_explicit_enable_required":true,"raw_ai_parent_visible":false,"view_logging_required":true}'::jsonb;

do $$
begin
  alter table public.camera_streams
    add constraint camera_streams_source_category_check
    check (source_category in ('dvr_nvr','rtsp_direct','onvif','ip_camera','manual_external_stream','demo_camera','home_test'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.camera_streams
    add constraint camera_streams_parent_visibility_status_check
    check (parent_visibility_status in ('allowed','blocked','outside_hours','pending_gateway','not_configured'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.camera_streams
    add constraint camera_streams_inspector_access_policy_check
    check (inspector_access_policy in ('assigned_garden_with_reason','assigned_garden','admin_only','disabled'));
exception when duplicate_object then null;
end $$;

create table if not exists public.camera_gateway_registry (
  id uuid primary key default gen_random_uuid(),
  registry_key text not null unique,
  provider text not null,
  display_name text not null,
  base_url text,
  public_base_url text,
  deployment_scope text not null default 'shared',
  garden_id uuid references public.gardens(id) on delete cascade,
  status text not null default 'not_configured',
  health_status text not null default 'unknown',
  last_heartbeat_at timestamptz,
  active_streams integer not null default 0,
  failed_streams integer not null default 0,
  latency_ms integer,
  supports_hls boolean not null default true,
  supports_webrtc boolean not null default true,
  supports_rtsp_ingest boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint camera_gateway_registry_provider_check check (provider in ('mediamtx','go2rtc','custom','future_webrtc','rtsp_to_hls','rtsp_to_webrtc')),
  constraint camera_gateway_registry_scope_check check (deployment_scope in ('shared','garden_specific','test_only')),
  constraint camera_gateway_registry_status_check check (status in ('not_configured','configured','testing','active','disabled','failed')),
  constraint camera_gateway_registry_health_check check (health_status in ('unknown','healthy','degraded','offline','failed'))
);

create table if not exists public.camera_infrastructure_audit_logs (
  id uuid primary key default gen_random_uuid(),
  camera_id uuid references public.camera_streams(id) on delete set null,
  gateway_id uuid references public.camera_gateway_registry(id) on delete set null,
  garden_id uuid references public.gardens(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_role public.app_role,
  action text not null,
  status text not null default 'logged',
  no_secrets_exposed boolean not null default true,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint camera_infrastructure_audit_status_check check (status in ('logged','success','warning','failed','blocked'))
);

create table if not exists public.observer_processing_queue (
  id uuid primary key default gen_random_uuid(),
  camera_id uuid references public.camera_streams(id) on delete set null,
  garden_id uuid references public.gardens(id) on delete cascade,
  observer_site_id uuid,
  event_type text not null,
  source_reference text,
  confidence numeric(5, 4),
  status text not null default 'detected',
  assigned_reviewer uuid references public.profiles(id) on delete set null,
  review_deadline_at timestamptz,
  parent_visible boolean not null default false,
  parent_safe_summary text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  closed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint observer_processing_queue_status_check check (status in ('detected','pending_review','dismissed','confirmed','needs_followup','task_created','inspection_requested','closed')),
  constraint observer_processing_queue_parent_safe_check check (parent_visible = false or (reviewed_at is not null and parent_safe_summary is not null))
);

create table if not exists public.parent_safe_camera_summaries (
  id uuid primary key default gen_random_uuid(),
  queue_id uuid references public.observer_processing_queue(id) on delete cascade,
  camera_id uuid references public.camera_streams(id) on delete set null,
  garden_id uuid references public.gardens(id) on delete cascade,
  child_id uuid references public.children(id) on delete cascade,
  summary text not null,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz not null default now(),
  visible_to_parent_id uuid references public.profiles(id) on delete set null,
  visibility_status text not null default 'approved',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint parent_safe_camera_summaries_status_check check (visibility_status in ('draft','approved','hidden','expired'))
);

create index if not exists camera_streams_infra_status_idx on public.camera_streams(garden_id, source_category, status, health_status);
create index if not exists camera_streams_parent_visibility_idx on public.camera_streams(garden_id, parent_visibility_status, parent_viewing_allowed);
create index if not exists camera_gateway_registry_status_idx on public.camera_gateway_registry(provider, status, health_status);
create index if not exists camera_gateway_registry_garden_idx on public.camera_gateway_registry(garden_id, deployment_scope);
create index if not exists camera_infra_audit_camera_idx on public.camera_infrastructure_audit_logs(camera_id, created_at desc);
create index if not exists camera_infra_audit_garden_idx on public.camera_infrastructure_audit_logs(garden_id, action, created_at desc);
create index if not exists observer_processing_queue_review_idx on public.observer_processing_queue(status, review_deadline_at, created_at desc);
create index if not exists observer_processing_queue_camera_idx on public.observer_processing_queue(camera_id, status, created_at desc);
create index if not exists parent_safe_camera_summaries_child_idx on public.parent_safe_camera_summaries(child_id, visibility_status, created_at desc);

alter table public.camera_gateway_registry enable row level security;
alter table public.camera_infrastructure_audit_logs enable row level security;
alter table public.observer_processing_queue enable row level security;
alter table public.parent_safe_camera_summaries enable row level security;

drop policy if exists "camera gateway registry scoped read" on public.camera_gateway_registry;
create policy "camera gateway registry scoped read" on public.camera_gateway_registry
for select using (
  public.is_admin()
  or (garden_id is not null and public.can_access_garden(garden_id))
);

drop policy if exists "camera gateway registry admin write" on public.camera_gateway_registry;
create policy "camera gateway registry admin write" on public.camera_gateway_registry
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "camera infrastructure audit scoped read" on public.camera_infrastructure_audit_logs;
create policy "camera infrastructure audit scoped read" on public.camera_infrastructure_audit_logs
for select using (
  public.is_admin()
  or actor_id = auth.uid()
  or (garden_id is not null and public.can_access_garden(garden_id))
);

drop policy if exists "camera infrastructure audit scoped insert" on public.camera_infrastructure_audit_logs;
create policy "camera infrastructure audit scoped insert" on public.camera_infrastructure_audit_logs
for insert with check (
  public.is_admin()
  or actor_id = auth.uid()
  or (garden_id is not null and public.can_access_garden(garden_id))
);

drop policy if exists "observer processing queue scoped read" on public.observer_processing_queue;
create policy "observer processing queue scoped read" on public.observer_processing_queue
for select using (
  public.is_admin()
  or (garden_id is not null and public.can_access_garden(garden_id))
);

drop policy if exists "observer processing queue scoped write" on public.observer_processing_queue;
create policy "observer processing queue scoped write" on public.observer_processing_queue
for all using (
  public.is_admin()
  or (garden_id is not null and public.can_access_garden(garden_id))
) with check (
  public.is_admin()
  or (garden_id is not null and public.can_access_garden(garden_id))
);

drop policy if exists "parent safe camera summaries scoped read" on public.parent_safe_camera_summaries;
create policy "parent safe camera summaries scoped read" on public.parent_safe_camera_summaries
for select using (
  public.is_admin()
  or (garden_id is not null and public.can_access_garden(garden_id))
  or visible_to_parent_id = auth.uid()
);

drop policy if exists "parent safe camera summaries admin garden write" on public.parent_safe_camera_summaries;
create policy "parent safe camera summaries admin garden write" on public.parent_safe_camera_summaries
for all using (
  public.is_admin()
  or (garden_id is not null and public.can_access_garden(garden_id))
) with check (
  public.is_admin()
  or (garden_id is not null and public.can_access_garden(garden_id))
);

insert into public.camera_gateway_registry (registry_key, provider, display_name, base_url, public_base_url, deployment_scope, status, health_status, supports_hls, supports_webrtc, supports_rtsp_ingest, metadata)
values
  ('platform_mediamtx', 'mediamtx', 'MediaMTX Platform Gateway', null, null, 'shared', 'not_configured', 'unknown', true, true, true, '{"required_env":["VIDEO_GATEWAY_URL","VIDEO_GATEWAY_API_KEY"],"stores_secrets":false}'::jsonb),
  ('platform_go2rtc', 'go2rtc', 'go2rtc Platform Gateway', null, null, 'shared', 'not_configured', 'unknown', true, true, true, '{"required_env":["VIDEO_GATEWAY_URL","VIDEO_GATEWAY_API_KEY"],"stores_secrets":false}'::jsonb),
  ('platform_custom', 'custom', 'Custom Video Gateway', null, null, 'shared', 'not_configured', 'unknown', true, true, true, '{"required_env":["VIDEO_GATEWAY_URL","VIDEO_GATEWAY_SIGNING_SECRET"],"stores_secrets":false}'::jsonb)
on conflict (registry_key) do update set
  provider = excluded.provider,
  display_name = excluded.display_name,
  deployment_scope = excluded.deployment_scope,
  supports_hls = excluded.supports_hls,
  supports_webrtc = excluded.supports_webrtc,
  supports_rtsp_ingest = excluded.supports_rtsp_ingest,
  metadata = public.camera_gateway_registry.metadata || excluded.metadata,
  updated_at = now();

update public.camera_streams
set
  source_category = case
    when coalesce(test_site_type, deployment_scope) = 'home_test' then 'home_test'
    when coalesce(system_type, source_type, camera_type) in ('dvr','nvr','dvr_nvr','hikvision','dahua','uniview') then 'dvr_nvr'
    when coalesce(system_type, source_type, camera_type) = 'onvif' then 'onvif'
    when coalesce(system_type, source_type, camera_type) = 'ip_camera' then 'ip_camera'
    when coalesce(system_type, source_type, camera_type) in ('sample_hls','HLS','Sample HLS') then 'demo_camera'
    when coalesce(system_type, source_type, camera_type) in ('manual_rtsp','rtsp','RTSP') then 'rtsp_direct'
    else source_category
  end,
  camera_zone_label = coalesce(camera_zone_label, area),
  parent_visibility_status = case
    when coalesce(parent_viewing_allowed, parent_view_allowed, false) = false then 'blocked'
    when coalesce(active, true) = false then 'blocked'
    when coalesce(status::text, stream_status::text, health_status::text) in ('pending_gateway','pending') then 'pending_gateway'
    else 'allowed'
  end,
  parent_blocked_reason = case
    when coalesce(parent_viewing_allowed, parent_view_allowed, false) = false then 'הגן לא פתח צפייה להורים'
    when coalesce(active, true) = false then 'המצלמה לא זמינה כרגע'
    when coalesce(status::text, stream_status::text, health_status::text) in ('pending_gateway','pending') then 'נדרש חיבור שרת וידאו'
    else null
  end,
  staff_view_allowed = coalesce(staff_view_allowed, false),
  observer_enabled = coalesce(observer_enabled, ai_enabled, false),
  observer_review_required = true,
  privacy_policy = coalesce(privacy_policy, '{}'::jsonb) || '{"parent_explicit_enable_required":true,"raw_ai_parent_visible":false,"view_logging_required":true,"no_rtsp_browser_exposure":true}'::jsonb
where true;

insert into public.observer_processing_queue (camera_id, garden_id, event_type, source_reference, confidence, status, review_deadline_at, parent_visible, metadata, created_at)
select
  e.camera_id,
  e.kindergarten_id,
  e.event_type,
  coalesce(e.snapshot_url, e.clip_url, 'event_reference'),
  e.confidence_score,
  case
    when e.status = 'dismissed' then 'dismissed'
    when e.status = 'confirmed' then 'confirmed'
    when e.status = 'escalated' then 'needs_followup'
    else 'pending_review'
  end,
  coalesce(e.created_at, now()) + interval '24 hours',
  false,
  jsonb_build_object('source', 'ai_camera_events_backfill', 'ai_camera_event_id', e.id, 'human_review_required', true),
  e.created_at
from public.ai_camera_events e
where not exists (
  select 1 from public.observer_processing_queue q
  where q.metadata->>'ai_camera_event_id' = e.id::text
);

comment on table public.camera_gateway_registry is 'Camera gateway registry for MediaMTX, go2rtc and future gateway providers. No secrets are stored.';
comment on table public.observer_processing_queue is 'Human-review queue for Digital Observer camera signals. Parent visibility is false by default.';
comment on column public.camera_streams.privacy_policy is 'Privacy rules for camera viewing. RTSP URLs and credentials must never be sent to browsers.';
comment on table public.parent_safe_camera_summaries is 'Reviewed, approved, parent-safe summaries only. No raw AI events or panic language.';

notify pgrst, 'reload schema';
