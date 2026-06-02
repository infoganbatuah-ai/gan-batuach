create table if not exists public.observer_workers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  worker_type text not null default 'mock',
  status text not null default 'idle',
  last_seen_at timestamptz,
  last_run_at timestamptz,
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint observer_workers_status_check check (status in ('idle', 'running', 'paused', 'offline', 'error', 'disabled'))
);

create table if not exists public.camera_zones (
  id uuid primary key default gen_random_uuid(),
  kindergarten_id uuid not null references public.gardens(id) on delete cascade,
  camera_id uuid references public.camera_streams(id) on delete cascade,
  name text not null,
  zone_type text not null,
  is_active boolean not null default true,
  is_restricted boolean not null default false,
  polygon jsonb not null default '[]'::jsonb,
  cooldown_seconds integer not null default 300,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint camera_zones_type_check check (zone_type in ('classroom','playground','entrance','exit','sleeping_area','restricted_area','bathroom_entrance','kitchen','yard'))
);

create table if not exists public.observer_rules (
  id uuid primary key default gen_random_uuid(),
  kindergarten_id uuid references public.gardens(id) on delete cascade,
  camera_id uuid references public.camera_streams(id) on delete cascade,
  zone_id uuid references public.camera_zones(id) on delete set null,
  rule_key text not null,
  event_type text not null,
  enabled boolean not null default true,
  severity text not null default 'medium',
  threshold numeric(5, 4) not null default 0.75,
  cooldown_seconds integer not null default 300,
  priority integer not null default 5,
  last_triggered_at timestamptz,
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint observer_rules_key_check check (rule_key in ('camera_offline','person_in_restricted_area','child_missing_from_area','fall_suspected','crowding_suspected','door_open','pickup_mismatch','audio_anomaly','keyword_detected')),
  constraint observer_rules_severity_check check (severity in ('info', 'low', 'medium', 'high', 'urgent', 'critical'))
);

create table if not exists public.observer_jobs (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid references public.observer_workers(id) on delete set null,
  kindergarten_id uuid references public.gardens(id) on delete cascade,
  camera_id uuid references public.camera_streams(id) on delete set null,
  zone_id uuid references public.camera_zones(id) on delete set null,
  rule_id uuid references public.observer_rules(id) on delete set null,
  job_type text not null default 'mock_detection',
  status text not null default 'queued',
  priority integer not null default 5,
  retry_count integer not null default 0,
  max_retries integer not null default 3,
  cooldown_until timestamptz,
  scheduled_for timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  last_run_at timestamptz,
  failure_reason text,
  result_event_id uuid references public.ai_camera_events(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint observer_jobs_status_check check (status in ('queued', 'running', 'completed', 'failed', 'retrying', 'cancelled')),
  constraint observer_jobs_type_check check (job_type in ('mock_detection', 'camera_health_check', 'frame_sample', 'rule_evaluation'))
);

create table if not exists public.observer_job_logs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.observer_jobs(id) on delete cascade,
  worker_id uuid references public.observer_workers(id) on delete set null,
  kindergarten_id uuid references public.gardens(id) on delete cascade,
  camera_id uuid references public.camera_streams(id) on delete set null,
  level text not null default 'info',
  message text not null,
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint observer_job_logs_level_check check (level in ('info', 'warning', 'error', 'success'))
);

create index if not exists idx_observer_workers_status on public.observer_workers(status, last_seen_at desc);
create index if not exists idx_camera_zones_kindergarten on public.camera_zones(kindergarten_id, camera_id, zone_type);
create index if not exists idx_observer_rules_scope on public.observer_rules(kindergarten_id, camera_id, rule_key, enabled);
create unique index if not exists idx_observer_rules_global_rule on public.observer_rules(rule_key) where kindergarten_id is null and camera_id is null and zone_id is null;
create index if not exists idx_observer_jobs_status_priority on public.observer_jobs(status, priority desc, scheduled_for);
create index if not exists idx_observer_jobs_kindergarten on public.observer_jobs(kindergarten_id, camera_id, created_at desc);
create index if not exists idx_observer_job_logs_job on public.observer_job_logs(job_id, created_at desc);

insert into public.observer_workers (name, worker_type, status, metadata)
select 'Mock Observer Worker', 'mock', 'idle', '{"phase":"2D","real_video_processing":false}'::jsonb
where not exists (select 1 from public.observer_workers where name = 'Mock Observer Worker');

insert into public.observer_rules (rule_key, event_type, severity, threshold, cooldown_seconds, priority, metadata)
values
  ('camera_offline', 'camera_offline', 'urgent', 0.8, 1800, 9, '{"mock":true}'::jsonb),
  ('person_in_restricted_area', 'restricted_area_entry', 'urgent', 0.78, 600, 8, '{"mock":true}'::jsonb),
  ('child_missing_from_area', 'child_missing_from_area', 'urgent', 0.82, 600, 9, '{"mock":true}'::jsonb),
  ('fall_suspected', 'fall_suspected', 'urgent', 0.76, 300, 9, '{"mock":true}'::jsonb),
  ('crowding_suspected', 'crowding_suspected', 'medium', 0.72, 900, 6, '{"mock":true}'::jsonb),
  ('door_open', 'gate_or_door_open', 'medium', 0.7, 600, 7, '{"mock":true}'::jsonb),
  ('pickup_mismatch', 'pickup_mismatch', 'urgent', 0.84, 900, 9, '{"mock":true}'::jsonb),
  ('audio_anomaly', 'audio_anomaly', 'medium', 0.74, 600, 6, '{"mock":true}'::jsonb),
  ('keyword_detected', 'keyword_detected', 'medium', 0.8, 600, 6, '{"mock":true}'::jsonb)
on conflict do nothing;

insert into public.camera_zones (kindergarten_id, camera_id, name, zone_type, is_restricted, metadata)
select c.garden_id, c.id, coalesce(c.area, c.name, 'אזור מצלמה'), 'classroom', false, '{"created_by":"migration_default"}'::jsonb
from public.camera_streams c
where not exists (
  select 1 from public.camera_zones z
  where z.camera_id = c.id
);

alter table public.observer_workers enable row level security;
alter table public.observer_jobs enable row level security;
alter table public.observer_job_logs enable row level security;
alter table public.camera_zones enable row level security;
alter table public.observer_rules enable row level security;

drop policy if exists "observer workers admin" on public.observer_workers;
create policy "observer workers admin" on public.observer_workers
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "observer jobs admin" on public.observer_jobs;
create policy "observer jobs admin" on public.observer_jobs
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "observer job logs admin" on public.observer_job_logs;
create policy "observer job logs admin" on public.observer_job_logs
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "camera zones scoped read" on public.camera_zones;
create policy "camera zones scoped read" on public.camera_zones
for select using (
  public.is_admin()
  or (public.current_role() in ('manager', 'owner', 'inspector') and public.can_access_garden(kindergarten_id))
);

drop policy if exists "camera zones admin garden write" on public.camera_zones;
create policy "camera zones admin garden write" on public.camera_zones
for all using (
  public.is_admin()
  or (public.current_role() in ('manager', 'owner') and public.can_access_garden(kindergarten_id))
) with check (
  public.is_admin()
  or (public.current_role() in ('manager', 'owner') and public.can_access_garden(kindergarten_id))
);

drop policy if exists "observer rules scoped read" on public.observer_rules;
create policy "observer rules scoped read" on public.observer_rules
for select using (
  public.is_admin()
  or kindergarten_id is null
  or (public.current_role() in ('manager', 'owner', 'inspector') and public.can_access_garden(kindergarten_id))
);

drop policy if exists "observer rules admin write" on public.observer_rules;
create policy "observer rules admin write" on public.observer_rules
for all using (public.is_admin()) with check (public.is_admin());

comment on table public.observer_jobs is 'AI Observer job queue foundation. Phase 2D uses mock detections only; no real child video processing.';
comment on table public.observer_rules is 'Rule engine readiness table with thresholds, confidence and cooldown for mock/future detections.';
comment on table public.camera_zones is 'Camera zone foundation. No drawing UI yet; polygon is future readiness metadata.';

notify pgrst, 'reload schema';
