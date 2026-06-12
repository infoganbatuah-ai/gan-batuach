-- PHASE 130: Manager Operating System & Kindergarten Command Center.
-- Adds manager operating analytics and daily command-center readiness without duplicating task systems.

create table if not exists public.manager_operating_metrics (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  metric_date date not null default current_date,
  response_time_minutes numeric,
  child_update_completion integer not null default 0,
  parent_engagement_rate integer not null default 0,
  inspection_readiness integer not null default 0,
  staff_readiness integer not null default 0,
  health_score integer not null default 0,
  source_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(garden_id, metric_date),
  constraint manager_operating_metrics_percent_check check (
    child_update_completion between 0 and 100
    and parent_engagement_rate between 0 and 100
    and inspection_readiness between 0 and 100
    and staff_readiness between 0 and 100
    and health_score between 0 and 100
  )
);

create table if not exists public.manager_command_center_events (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  surface text not null default 'command_center',
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint manager_command_center_event_type_check check (event_type in (
    'command_center_view',
    'focus_item_open',
    'one_tap_action',
    'assistant_question',
    'checklist_review',
    'timeline_open',
    'widget_open'
  ))
);

create index if not exists manager_operating_metrics_garden_date_idx
  on public.manager_operating_metrics(garden_id, metric_date desc);

create index if not exists manager_command_center_events_garden_time_idx
  on public.manager_command_center_events(garden_id, occurred_at desc);

create index if not exists manager_command_center_events_profile_time_idx
  on public.manager_command_center_events(profile_id, occurred_at desc)
  where profile_id is not null;

alter table public.manager_operating_metrics enable row level security;
alter table public.manager_command_center_events enable row level security;

drop policy if exists "manager operating metrics scoped read" on public.manager_operating_metrics;
create policy "manager operating metrics scoped read" on public.manager_operating_metrics
for select using (public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "manager operating metrics scoped write" on public.manager_operating_metrics;
create policy "manager operating metrics scoped write" on public.manager_operating_metrics
for all using (public.is_admin() or public.can_access_garden(garden_id))
with check (public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "manager command center events scoped read" on public.manager_command_center_events;
create policy "manager command center events scoped read" on public.manager_command_center_events
for select using (public.is_admin() or public.can_access_garden(garden_id) or profile_id = auth.uid());

drop policy if exists "manager command center events scoped insert" on public.manager_command_center_events;
create policy "manager command center events scoped insert" on public.manager_command_center_events
for insert with check (public.is_admin() or public.can_access_garden(garden_id) or profile_id = auth.uid());

comment on table public.manager_operating_metrics is 'Daily manager operating metrics for response time, update frequency, parent engagement, inspection readiness and staff readiness.';
comment on table public.manager_command_center_events is 'Command center usage analytics. Tracks manager interactions without changing business logic.';
