alter table public.camera_zones
  drop constraint if exists camera_zones_type_check;

alter table public.camera_zones
  add constraint camera_zones_type_check check (zone_type in ('classroom','playground','entrance','exit','sleeping_area','restricted_area','bathroom_entrance','kitchen','yard','staff_only'));

create table if not exists public.kindergarten_learning_profiles (
  kindergarten_id uuid primary key references public.gardens(id) on delete cascade,
  learning_status text not null default 'not_started',
  learning_started_at timestamptz,
  learning_completed_at timestamptz,
  baseline_version text not null default 'v0_mock',
  confidence_level numeric(5, 4) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kindergarten_learning_status_check check (learning_status in ('not_started','collecting_baseline','baseline_ready','paused','disabled'))
);

create table if not exists public.kindergarten_routine_configs (
  id uuid primary key default gen_random_uuid(),
  kindergarten_id uuid not null references public.gardens(id) on delete cascade,
  opening_hours jsonb not null default '{}'::jsonb,
  pickup_windows jsonb not null default '[]'::jsonb,
  nap_time jsonb not null default '{}'::jsonb,
  outdoor_activity_hours jsonb not null default '[]'::jsonb,
  meal_times jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_kindergarten_routine_configs_kindergarten
  on public.kindergarten_routine_configs(kindergarten_id);

create table if not exists public.kindergarten_learning_signals (
  id uuid primary key default gen_random_uuid(),
  kindergarten_id uuid not null references public.gardens(id) on delete cascade,
  camera_id uuid references public.camera_streams(id) on delete set null,
  zone_id uuid references public.camera_zones(id) on delete set null,
  signal_type text not null,
  baseline_value jsonb not null default '{}'::jsonb,
  confidence_level numeric(5, 4) not null default 0,
  baseline_version text not null default 'v0_mock',
  last_observed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kindergarten_learning_signal_type_check check (signal_type in ('normal_occupancy','normal_movement_patterns','pickup_routine','staff_routine','opening_routine','closing_routine'))
);

create table if not exists public.kindergarten_risk_profiles (
  kindergarten_id uuid primary key references public.gardens(id) on delete cascade,
  attendance_score integer not null default 0,
  pickup_score integer not null default 0,
  safety_score integer not null default 0,
  supervision_score integer not null default 0,
  camera_coverage_score integer not null default 0,
  overall_score integer not null default 0,
  risk_status text not null default 'mock_baseline',
  metadata jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kindergarten_risk_status_check check (risk_status in ('mock_baseline','needs_configuration','baseline_ready','review_required')),
  constraint kindergarten_risk_scores_check check (
    attendance_score between 0 and 100
    and pickup_score between 0 and 100
    and safety_score between 0 and 100
    and supervision_score between 0 and 100
    and camera_coverage_score between 0 and 100
    and overall_score between 0 and 100
  )
);

create index if not exists idx_kindergarten_learning_signals_kindergarten
  on public.kindergarten_learning_signals(kindergarten_id, signal_type, created_at desc);

insert into public.kindergarten_learning_profiles (kindergarten_id, learning_status, learning_started_at, baseline_version, confidence_level, metadata)
select g.id, 'collecting_baseline', now(), 'v0_mock', 0.15, '{"mock":true,"no_child_profiling":true}'::jsonb
from public.gardens g
where not exists (
  select 1 from public.kindergarten_learning_profiles p where p.kindergarten_id = g.id
);

insert into public.kindergarten_routine_configs (kindergarten_id, opening_hours, pickup_windows, nap_time, outdoor_activity_hours, meal_times, metadata)
select
  g.id,
  '{"start":"07:30","end":"16:30","days":["sun","mon","tue","wed","thu"]}'::jsonb,
  '[{"start":"15:30","end":"16:30"}]'::jsonb,
  '{"start":"13:00","end":"14:30"}'::jsonb,
  '[{"start":"10:00","end":"11:00"}]'::jsonb,
  '[{"label":"ארוחת בוקר","time":"09:00"},{"label":"ארוחת צהריים","time":"12:00"}]'::jsonb,
  '{"mock":true,"editable_by_manager":true}'::jsonb
from public.gardens g
where not exists (
  select 1 from public.kindergarten_routine_configs r where r.kindergarten_id = g.id
);

insert into public.kindergarten_learning_signals (kindergarten_id, camera_id, zone_id, signal_type, baseline_value, confidence_level, metadata)
select z.kindergarten_id, z.camera_id, z.id, signal.signal_type, signal.baseline_value, 0.12, '{"mock":true,"baseline_only":true}'::jsonb
from public.camera_zones z
cross join (
  values
    ('normal_occupancy', '{"range":"not_learned_yet"}'::jsonb),
    ('normal_movement_patterns', '{"pattern":"not_learned_yet"}'::jsonb),
    ('pickup_routine', '{"window":"configured_routine"}'::jsonb),
    ('staff_routine', '{"pattern":"not_learned_yet"}'::jsonb),
    ('opening_routine', '{"window":"configured_routine"}'::jsonb),
    ('closing_routine', '{"window":"configured_routine"}'::jsonb)
) as signal(signal_type, baseline_value)
where not exists (
  select 1
  from public.kindergarten_learning_signals existing
  where existing.zone_id = z.id
    and existing.signal_type = signal.signal_type
);

insert into public.kindergarten_risk_profiles (kindergarten_id, attendance_score, pickup_score, safety_score, supervision_score, camera_coverage_score, overall_score, metadata)
select
  g.id,
  12,
  10,
  18,
  14,
  case when exists (select 1 from public.camera_streams c where c.garden_id = g.id) then 20 else 55 end,
  case when exists (select 1 from public.camera_streams c where c.garden_id = g.id) then 15 else 35 end,
  '{"mock":true,"no_automatic_decisions":true}'::jsonb
from public.gardens g
where not exists (
  select 1 from public.kindergarten_risk_profiles r where r.kindergarten_id = g.id
);

alter table public.kindergarten_learning_profiles enable row level security;
alter table public.kindergarten_routine_configs enable row level security;
alter table public.kindergarten_learning_signals enable row level security;
alter table public.kindergarten_risk_profiles enable row level security;

drop policy if exists "learning profiles scoped read" on public.kindergarten_learning_profiles;
create policy "learning profiles scoped read" on public.kindergarten_learning_profiles
for select using (public.is_admin() or (public.current_role() in ('manager','owner','inspector') and public.can_access_garden(kindergarten_id)));

drop policy if exists "learning profiles admin garden write" on public.kindergarten_learning_profiles;
create policy "learning profiles admin garden write" on public.kindergarten_learning_profiles
for all using (public.is_admin() or (public.current_role() in ('manager','owner') and public.can_access_garden(kindergarten_id)))
with check (public.is_admin() or (public.current_role() in ('manager','owner') and public.can_access_garden(kindergarten_id)));

drop policy if exists "routine configs scoped read" on public.kindergarten_routine_configs;
create policy "routine configs scoped read" on public.kindergarten_routine_configs
for select using (public.is_admin() or (public.current_role() in ('manager','owner','inspector') and public.can_access_garden(kindergarten_id)));

drop policy if exists "routine configs admin garden write" on public.kindergarten_routine_configs;
create policy "routine configs admin garden write" on public.kindergarten_routine_configs
for all using (public.is_admin() or (public.current_role() in ('manager','owner') and public.can_access_garden(kindergarten_id)))
with check (public.is_admin() or (public.current_role() in ('manager','owner') and public.can_access_garden(kindergarten_id)));

drop policy if exists "learning signals scoped read" on public.kindergarten_learning_signals;
create policy "learning signals scoped read" on public.kindergarten_learning_signals
for select using (public.is_admin() or (public.current_role() in ('manager','owner','inspector') and public.can_access_garden(kindergarten_id)));

drop policy if exists "learning signals admin write" on public.kindergarten_learning_signals;
create policy "learning signals admin write" on public.kindergarten_learning_signals
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "risk profiles scoped read" on public.kindergarten_risk_profiles;
create policy "risk profiles scoped read" on public.kindergarten_risk_profiles
for select using (public.is_admin() or (public.current_role() in ('manager','owner','inspector') and public.can_access_garden(kindergarten_id)));

drop policy if exists "risk profiles admin write" on public.kindergarten_risk_profiles;
create policy "risk profiles admin write" on public.kindergarten_risk_profiles
for all using (public.is_admin()) with check (public.is_admin());

comment on table public.kindergarten_learning_profiles is 'Digital Observer kindergarten-level learning foundation. No child profiling and no automated decisions.';
comment on table public.kindergarten_learning_signals is 'Baseline-only learning signals for future anomaly detection. Signals belong to the kindergarten, not children.';
comment on table public.kindergarten_risk_profiles is 'Mock risk scoring foundation for review dashboards only.';

notify pgrst, 'reload schema';
