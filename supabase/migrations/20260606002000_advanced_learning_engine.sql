alter table public.kindergarten_learning_profiles
  add column if not exists learning_maturity text not null default 'new',
  add column if not exists anomaly_readiness_score numeric(5, 4) not null default 0,
  add column if not exists routine_confidence jsonb not null default '{}'::jsonb,
  add column if not exists confidence_trends jsonb not null default '{}'::jsonb;

alter table public.kindergarten_learning_profiles
  drop constraint if exists kindergarten_learning_maturity_check;

alter table public.kindergarten_learning_profiles
  add constraint kindergarten_learning_maturity_check check (learning_maturity in ('new','learning','calibrated','mature'));

create table if not exists public.observer_site_learning_profiles (
  observer_site_id uuid primary key references public.observer_sites(id) on delete cascade,
  learning_status text not null default 'collecting_baseline',
  learning_maturity text not null default 'new',
  baseline_version text not null default 'v0_mock',
  confidence_level numeric(5, 4) not null default 0,
  anomaly_readiness_score numeric(5, 4) not null default 0,
  routine_confidence jsonb not null default '{}'::jsonb,
  confidence_trends jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint observer_site_learning_status_check check (learning_status in ('not_started','collecting_baseline','baseline_ready','paused','disabled')),
  constraint observer_site_learning_maturity_check check (learning_maturity in ('new','learning','calibrated','mature')),
  constraint observer_site_learning_confidence_check check (
    confidence_level between 0 and 1
    and anomaly_readiness_score between 0 and 1
  )
);

create table if not exists public.site_behavior_baselines (
  id uuid primary key default gen_random_uuid(),
  observer_site_id uuid references public.observer_sites(id) on delete cascade,
  kindergarten_id uuid references public.gardens(id) on delete cascade,
  baseline_type text not null,
  baseline_value jsonb not null default '{}'::jsonb,
  confidence_level numeric(5, 4) not null default 0,
  learning_maturity text not null default 'new',
  anomaly_readiness_score numeric(5, 4) not null default 0,
  source_summary jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  last_calibrated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_behavior_baselines_scope_check check (observer_site_id is not null or kindergarten_id is not null),
  constraint site_behavior_baselines_type_check check (baseline_type in (
    'normal_occupancy_patterns',
    'normal_movement_patterns',
    'normal_activity_levels',
    'normal_active_hours',
    'normal_pickup_patterns',
    'normal_staff_presence',
    'normal_camera_activity',
    'normal_zone_usage'
  )),
  constraint site_behavior_baselines_maturity_check check (learning_maturity in ('new','learning','calibrated','mature')),
  constraint site_behavior_baselines_confidence_check check (
    confidence_level between 0 and 1
    and anomaly_readiness_score between 0 and 1
  )
);

create unique index if not exists site_behavior_baselines_garden_unique
  on public.site_behavior_baselines(kindergarten_id, baseline_type)
  where kindergarten_id is not null;

create unique index if not exists site_behavior_baselines_site_unique
  on public.site_behavior_baselines(observer_site_id, baseline_type)
  where observer_site_id is not null;

create table if not exists public.camera_learning_profiles (
  camera_id uuid primary key references public.camera_streams(id) on delete cascade,
  observer_site_id uuid references public.observer_sites(id) on delete cascade,
  kindergarten_id uuid references public.gardens(id) on delete cascade,
  activity_frequency jsonb not null default '{}'::jsonb,
  motion_frequency jsonb not null default '{}'::jsonb,
  occupancy_frequency jsonb not null default '{}'::jsonb,
  offline_history jsonb not null default '[]'::jsonb,
  obstruction_history jsonb not null default '[]'::jsonb,
  anomaly_history jsonb not null default '[]'::jsonb,
  confidence_adjustments jsonb not null default '{}'::jsonb,
  learning_maturity text not null default 'new',
  anomaly_readiness_score numeric(5, 4) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  last_calibrated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint camera_learning_profiles_maturity_check check (learning_maturity in ('new','learning','calibrated','mature')),
  constraint camera_learning_profiles_readiness_check check (anomaly_readiness_score between 0 and 1)
);

create index if not exists camera_learning_profiles_kindergarten_idx
  on public.camera_learning_profiles(kindergarten_id, learning_maturity, updated_at desc);

create index if not exists camera_learning_profiles_site_idx
  on public.camera_learning_profiles(observer_site_id, learning_maturity, updated_at desc);

create table if not exists public.zone_learning_profiles (
  zone_id uuid primary key references public.camera_zones(id) on delete cascade,
  observer_site_id uuid references public.observer_sites(id) on delete cascade,
  kindergarten_id uuid references public.gardens(id) on delete cascade,
  camera_id uuid references public.camera_streams(id) on delete set null,
  expected_occupancy jsonb not null default '{}'::jsonb,
  expected_activity jsonb not null default '{}'::jsonb,
  expected_schedules jsonb not null default '{}'::jsonb,
  expected_movement_frequency jsonb not null default '{}'::jsonb,
  restricted_area_behavior jsonb not null default '{}'::jsonb,
  confidence_adjustments jsonb not null default '{}'::jsonb,
  learning_maturity text not null default 'new',
  anomaly_readiness_score numeric(5, 4) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  last_calibrated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint zone_learning_profiles_maturity_check check (learning_maturity in ('new','learning','calibrated','mature')),
  constraint zone_learning_profiles_readiness_check check (anomaly_readiness_score between 0 and 1)
);

create index if not exists zone_learning_profiles_kindergarten_idx
  on public.zone_learning_profiles(kindergarten_id, learning_maturity, updated_at desc);

create index if not exists zone_learning_profiles_camera_idx
  on public.zone_learning_profiles(camera_id, updated_at desc);

create table if not exists public.learning_feedback_signals (
  id uuid primary key default gen_random_uuid(),
  observer_site_id uuid references public.observer_sites(id) on delete cascade,
  kindergarten_id uuid references public.gardens(id) on delete cascade,
  camera_id uuid references public.camera_streams(id) on delete set null,
  zone_id uuid references public.camera_zones(id) on delete set null,
  source_type text not null,
  source_id uuid,
  event_type text not null,
  review_outcome text not null,
  confidence_delta numeric(5, 4) not null default 0,
  confidence_after numeric(5, 4) not null default 0,
  maturity_after text not null default 'new',
  anomaly_readiness_after numeric(5, 4) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint learning_feedback_scope_check check (observer_site_id is not null or kindergarten_id is not null),
  constraint learning_feedback_source_check check (source_type in ('ai_camera_event','audio_observer_event','pickup_event','watch_request','safety_incident','camera_health','mock')),
  constraint learning_feedback_outcome_check check (review_outcome in ('confirmed','dismissed','false_positive','escalated','valid_detection','needs_more_data')),
  constraint learning_feedback_maturity_check check (maturity_after in ('new','learning','calibrated','mature')),
  constraint learning_feedback_confidence_check check (
    confidence_after between 0 and 1
    and anomaly_readiness_after between 0 and 1
  )
);

create index if not exists learning_feedback_kindergarten_idx
  on public.learning_feedback_signals(kindergarten_id, source_type, created_at desc);

create index if not exists learning_feedback_site_idx
  on public.learning_feedback_signals(observer_site_id, source_type, created_at desc);

create index if not exists learning_feedback_camera_zone_idx
  on public.learning_feedback_signals(camera_id, zone_id, created_at desc);

insert into public.site_behavior_baselines (kindergarten_id, baseline_type, baseline_value, confidence_level, learning_maturity, anomaly_readiness_score, source_summary, metadata)
select
  g.id,
  baseline.baseline_type,
  baseline.baseline_value,
  0.12,
  'new',
  0.08,
  '{"source":"mock_seed","human_review_required":true}'::jsonb,
  '{"site_level_only":true,"no_child_profiling":true,"no_staff_scoring":true}'::jsonb
from public.gardens g
cross join (
  values
    ('normal_occupancy_patterns', '{"status":"not_learned_yet"}'::jsonb),
    ('normal_movement_patterns', '{"status":"not_learned_yet"}'::jsonb),
    ('normal_activity_levels', '{"status":"not_learned_yet"}'::jsonb),
    ('normal_active_hours', '{"status":"routine_config_needed"}'::jsonb),
    ('normal_pickup_patterns', '{"status":"reviewed_pickups_needed"}'::jsonb),
    ('normal_staff_presence', '{"status":"site_level_only"}'::jsonb),
    ('normal_camera_activity', '{"status":"camera_health_needed"}'::jsonb),
    ('normal_zone_usage', '{"status":"zones_needed"}'::jsonb)
) as baseline(baseline_type, baseline_value)
where not exists (
  select 1
  from public.site_behavior_baselines existing
  where existing.kindergarten_id = g.id
    and existing.baseline_type = baseline.baseline_type
);

insert into public.camera_learning_profiles (camera_id, kindergarten_id, observer_site_id, activity_frequency, motion_frequency, occupancy_frequency, metadata)
select
  c.id,
  c.garden_id,
  c.observer_site_id,
  '{"status":"not_calibrated"}'::jsonb,
  '{"status":"not_calibrated"}'::jsonb,
  '{"status":"not_calibrated"}'::jsonb,
  '{"mock":true,"no_raw_video":true}'::jsonb
from public.camera_streams c
where not exists (
  select 1 from public.camera_learning_profiles p where p.camera_id = c.id
);

insert into public.zone_learning_profiles (zone_id, kindergarten_id, camera_id, observer_site_id, expected_occupancy, expected_activity, expected_schedules, expected_movement_frequency, restricted_area_behavior, metadata)
select
  z.id,
  z.kindergarten_id,
  z.camera_id,
  z.observer_site_id,
  '{"status":"not_calibrated"}'::jsonb,
  '{"status":"not_calibrated"}'::jsonb,
  '{"status":"routine_config_needed"}'::jsonb,
  '{"status":"not_calibrated"}'::jsonb,
  case when z.is_restricted then '{"expected":"no_activity_without_review"}'::jsonb else '{"expected":"routine_activity"}'::jsonb end,
  '{"mock":true,"zone_level_only":true}'::jsonb
from public.camera_zones z
where not exists (
  select 1 from public.zone_learning_profiles p where p.zone_id = z.id
);

alter table public.observer_site_learning_profiles enable row level security;
alter table public.site_behavior_baselines enable row level security;
alter table public.camera_learning_profiles enable row level security;
alter table public.zone_learning_profiles enable row level security;
alter table public.learning_feedback_signals enable row level security;

drop policy if exists "observer site learning scoped read" on public.observer_site_learning_profiles;
create policy "observer site learning scoped read" on public.observer_site_learning_profiles
for select using (
  public.is_admin()
  or exists (
    select 1 from public.observer_site_memberships m
    where m.observer_site_id = observer_site_learning_profiles.observer_site_id
      and m.profile_id = auth.uid()
      and m.active = true
      and m.member_role in ('owner','admin','operator')
  )
);

drop policy if exists "observer site learning admin write" on public.observer_site_learning_profiles;
create policy "observer site learning admin write" on public.observer_site_learning_profiles
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "site behavior baselines scoped read" on public.site_behavior_baselines;
create policy "site behavior baselines scoped read" on public.site_behavior_baselines
for select using (
  public.is_admin()
  or (kindergarten_id is not null and public.can_access_garden(kindergarten_id))
  or exists (
    select 1 from public.observer_site_memberships m
    where m.observer_site_id = site_behavior_baselines.observer_site_id
      and m.profile_id = auth.uid()
      and m.active = true
      and m.member_role in ('owner','admin','operator')
  )
);

drop policy if exists "site behavior baselines admin write" on public.site_behavior_baselines;
create policy "site behavior baselines admin write" on public.site_behavior_baselines
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "camera learning profiles scoped read" on public.camera_learning_profiles;
create policy "camera learning profiles scoped read" on public.camera_learning_profiles
for select using (
  public.is_admin()
  or (kindergarten_id is not null and public.can_access_garden(kindergarten_id))
  or exists (
    select 1 from public.observer_site_memberships m
    where m.observer_site_id = camera_learning_profiles.observer_site_id
      and m.profile_id = auth.uid()
      and m.active = true
      and m.member_role in ('owner','admin','operator')
  )
);

drop policy if exists "camera learning profiles admin write" on public.camera_learning_profiles;
create policy "camera learning profiles admin write" on public.camera_learning_profiles
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "zone learning profiles scoped read" on public.zone_learning_profiles;
create policy "zone learning profiles scoped read" on public.zone_learning_profiles
for select using (
  public.is_admin()
  or (kindergarten_id is not null and public.can_access_garden(kindergarten_id))
  or exists (
    select 1 from public.observer_site_memberships m
    where m.observer_site_id = zone_learning_profiles.observer_site_id
      and m.profile_id = auth.uid()
      and m.active = true
      and m.member_role in ('owner','admin','operator')
  )
);

drop policy if exists "zone learning profiles admin write" on public.zone_learning_profiles;
create policy "zone learning profiles admin write" on public.zone_learning_profiles
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "learning feedback scoped read" on public.learning_feedback_signals;
create policy "learning feedback scoped read" on public.learning_feedback_signals
for select using (
  public.is_admin()
  or (kindergarten_id is not null and public.can_access_garden(kindergarten_id))
  or exists (
    select 1 from public.observer_site_memberships m
    where m.observer_site_id = learning_feedback_signals.observer_site_id
      and m.profile_id = auth.uid()
      and m.active = true
      and m.member_role in ('owner','admin','operator')
  )
);

drop policy if exists "learning feedback admin write" on public.learning_feedback_signals;
create policy "learning feedback admin write" on public.learning_feedback_signals
for all using (public.is_admin()) with check (public.is_admin());

comment on table public.site_behavior_baselines is 'Advanced site-level baseline readiness for normal routines, occupancy, activity, pickup and camera behavior. No autonomous decisions.';
comment on table public.camera_learning_profiles is 'Camera-level learning profile for activity/offline/obstruction/anomaly history. Does not store raw frames or identify people.';
comment on table public.zone_learning_profiles is 'Zone-level expected behavior profile. Site/zone level only; no child profiling.';
comment on table public.learning_feedback_signals is 'Reviewed outcomes used to adjust confidence in mock/readiness mode. Human review remains required.';
comment on column public.kindergarten_learning_profiles.learning_maturity is 'Site-level maturity only: new, learning, calibrated, mature. Not a child or staff score.';

notify pgrst, 'reload schema';
