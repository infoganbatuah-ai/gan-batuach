-- PHASE 131: Staff Workforce, GPS Attendance & Operational Execution Platform.
-- Automatic attendance uses location samples and a 30 minute continuous presence/absence threshold.

alter table if exists public.gardens
  add column if not exists attendance_radius_meters integer not null default 120,
  add column if not exists workforce_gps_required boolean not null default true,
  add column if not exists workforce_auto_attendance_enabled boolean not null default true;

create table if not exists public.garden_work_zones (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  zone_name text not null default 'אזור הגן',
  zone_type text not null default 'kindergarten',
  center_lat numeric(10, 7),
  center_lng numeric(10, 7),
  radius_meters integer not null default 120,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint garden_work_zones_type_check check (zone_type in ('kindergarten','classroom','yard','office','custom'))
);

create table if not exists public.staff_location_samples (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  garden_id uuid not null references public.gardens(id) on delete cascade,
  work_zone_id uuid references public.garden_work_zones(id) on delete set null,
  gps_lat numeric(10, 7) not null,
  gps_lng numeric(10, 7) not null,
  gps_accuracy_meters numeric(10, 2),
  distance_meters numeric(10, 2),
  inside_geofence boolean not null default false,
  network_reliable boolean not null default true,
  sample_source text not null default 'mobile_browser',
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint staff_location_samples_source_check check (sample_source in ('mobile_browser','web_browser','offline_sync','manager_review','system'))
);

alter table if exists public.staff_shifts
  add column if not exists auto_attendance_enabled boolean not null default true,
  add column if not exists auto_started boolean not null default false,
  add column if not exists auto_closed boolean not null default false,
  add column if not exists auto_start_detected_at timestamptz,
  add column if not exists auto_end_detected_at timestamptz,
  add column if not exists attendance_confidence text not null default 'requires_review',
  add column if not exists confidence_score integer not null default 0,
  add column if not exists total_minutes integer not null default 0,
  add column if not exists weekly_minutes integer not null default 0,
  add column if not exists monthly_minutes integer not null default 0,
  add column if not exists overtime_minutes integer not null default 0,
  add column if not exists review_reason text;

alter table if exists public.staff_shifts
  drop constraint if exists staff_shifts_attendance_confidence_check;

alter table if exists public.staff_shifts
  add constraint staff_shifts_attendance_confidence_check check (attendance_confidence in ('verified','probable','requires_review'));

create table if not exists public.staff_work_schedules (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  garden_id uuid not null references public.gardens(id) on delete cascade,
  weekday integer not null,
  planned_start time not null,
  planned_end time not null,
  recurring boolean not null default true,
  temporary_replacement_staff_id uuid references public.staff(id) on delete set null,
  active_from date not null default current_date,
  active_until date,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_work_schedules_weekday_check check (weekday between 0 and 6),
  constraint staff_work_schedules_status_check check (status in ('active','paused','replaced','archived'))
);

create table if not exists public.staff_absence_requests (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  garden_id uuid not null references public.gardens(id) on delete cascade,
  absence_type text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'pending',
  reason text,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_absence_type_check check (absence_type in ('vacation','sickness','emergency','approved_leave')),
  constraint staff_absence_status_check check (status in ('pending','approved','rejected','cancelled'))
);

create table if not exists public.staff_workforce_anomalies (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid references public.staff(id) on delete cascade,
  garden_id uuid not null references public.gardens(id) on delete cascade,
  shift_id uuid references public.staff_shifts(id) on delete set null,
  anomaly_type text not null,
  severity text not null default 'medium',
  status text not null default 'requires_review',
  details text,
  evidence jsonb not null default '{}'::jsonb,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint staff_workforce_anomaly_type_check check (anomaly_type in ('impossible_movement','gps_failure','outside_garden','suspicious_pattern','missing_shift','late_arrival','early_departure')),
  constraint staff_workforce_anomaly_status_check check (status in ('requires_review','reviewing','confirmed','dismissed','resolved')),
  constraint staff_workforce_anomaly_severity_check check (severity in ('low','medium','high','critical'))
);

create table if not exists public.staff_workforce_scores (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  garden_id uuid not null references public.gardens(id) on delete cascade,
  score_date date not null default current_date,
  readiness_score integer not null default 0,
  attendance_score integer not null default 0,
  document_score integer not null default 0,
  training_score integer not null default 0,
  compliance_score integer not null default 0,
  inspection_score integer not null default 0,
  explanation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(staff_id, score_date),
  constraint staff_workforce_scores_range_check check (
    readiness_score between 0 and 100
    and attendance_score between 0 and 100
    and document_score between 0 and 100
    and training_score between 0 and 100
    and compliance_score between 0 and 100
    and inspection_score between 0 and 100
  )
);

create table if not exists public.staff_workforce_audit_events (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid references public.staff(id) on delete set null,
  garden_id uuid references public.gardens(id) on delete cascade,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  entity_type text,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint staff_workforce_audit_type_check check (event_type in (
    'location_sample',
    'auto_shift_started',
    'auto_shift_closed',
    'attendance_requires_review',
    'schedule_changed',
    'task_completed',
    'compliance_action',
    'manager_intervention',
    'absence_requested',
    'absence_reviewed'
  ))
);

create unique index if not exists garden_work_zones_unique_name_idx
  on public.garden_work_zones(garden_id, zone_name);

insert into public.garden_work_zones (garden_id, zone_name, center_lat, center_lng, radius_meters)
select g.id, 'אזור הגן', g.gps_lat, g.gps_lng, coalesce(g.attendance_radius_meters, 120)
from public.gardens g
where g.gps_lat is not null
  and g.gps_lng is not null
on conflict (garden_id, zone_name) do update
set center_lat = excluded.center_lat,
    center_lng = excluded.center_lng,
    radius_meters = excluded.radius_meters,
    updated_at = now();

create index if not exists garden_work_zones_garden_idx on public.garden_work_zones(garden_id, active);
create index if not exists staff_location_samples_staff_time_idx on public.staff_location_samples(staff_id, captured_at desc);
create index if not exists staff_location_samples_garden_time_idx on public.staff_location_samples(garden_id, captured_at desc);
create index if not exists staff_location_samples_inside_idx on public.staff_location_samples(staff_id, inside_geofence, captured_at desc);
create index if not exists staff_work_schedules_staff_idx on public.staff_work_schedules(staff_id, active_from, active_until);
create index if not exists staff_absence_requests_garden_status_idx on public.staff_absence_requests(garden_id, status, starts_at);
create index if not exists staff_workforce_anomalies_garden_status_idx on public.staff_workforce_anomalies(garden_id, status, created_at desc);
create index if not exists staff_workforce_scores_garden_date_idx on public.staff_workforce_scores(garden_id, score_date desc);
create index if not exists staff_workforce_audit_garden_time_idx on public.staff_workforce_audit_events(garden_id, created_at desc);

alter table public.garden_work_zones enable row level security;
alter table public.staff_location_samples enable row level security;
alter table public.staff_work_schedules enable row level security;
alter table public.staff_absence_requests enable row level security;
alter table public.staff_workforce_anomalies enable row level security;
alter table public.staff_workforce_scores enable row level security;
alter table public.staff_workforce_audit_events enable row level security;

drop policy if exists "garden work zones scoped" on public.garden_work_zones;
create policy "garden work zones scoped" on public.garden_work_zones
for all using (public.is_admin() or public.can_access_garden(garden_id))
with check (public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "staff location samples scoped" on public.staff_location_samples;
create policy "staff location samples scoped" on public.staff_location_samples
for all using (public.is_admin() or public.can_access_garden(garden_id) or profile_id = auth.uid())
with check (public.is_admin() or public.can_access_garden(garden_id) or profile_id = auth.uid());

drop policy if exists "staff schedules scoped" on public.staff_work_schedules;
create policy "staff schedules scoped" on public.staff_work_schedules
for all using (public.is_admin() or public.can_access_garden(garden_id))
with check (public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "staff absence scoped" on public.staff_absence_requests;
create policy "staff absence scoped" on public.staff_absence_requests
for all using (public.is_admin() or public.can_access_garden(garden_id))
with check (public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "staff workforce anomalies scoped" on public.staff_workforce_anomalies;
create policy "staff workforce anomalies scoped" on public.staff_workforce_anomalies
for all using (public.is_admin() or public.can_access_garden(garden_id))
with check (public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "staff workforce scores scoped" on public.staff_workforce_scores;
create policy "staff workforce scores scoped" on public.staff_workforce_scores
for select using (public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "staff workforce audit scoped" on public.staff_workforce_audit_events;
create policy "staff workforce audit scoped" on public.staff_workforce_audit_events
for all using (public.is_admin() or public.can_access_garden(garden_id) or actor_profile_id = auth.uid())
with check (public.is_admin() or public.can_access_garden(garden_id) or actor_profile_id = auth.uid());

comment on table public.staff_location_samples is 'GPS location samples for automatic staff attendance. Samples are used to start/close shifts after 30 minutes of continuous presence or absence.';
comment on column public.staff_shifts.attendance_confidence is 'verified, probable or requires_review based on GPS accuracy, duration and repeated confirmations.';
