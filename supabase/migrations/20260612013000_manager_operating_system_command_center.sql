-- PHASE 130: Manager Operating System & Kindergarten Command Center.
-- Additive readiness tables for manager analytics and daily checklist state.

create table if not exists public.manager_command_center_events (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  manager_profile_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  surface text not null default 'command_center',
  target_type text,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint manager_command_center_event_type_check check (event_type in (
    'command_center_view',
    'daily_focus_open',
    'one_tap_action',
    'checklist_view',
    'timeline_view',
    'widget_open',
    'ai_suggestion_open',
    'alert_reviewed'
  ))
);

create table if not exists public.manager_daily_checklist_status (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  checklist_date date not null default current_date,
  checklist_type text not null,
  checklist_key text not null,
  label text not null,
  status text not null default 'pending',
  source_count integer not null default 0,
  completed_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(garden_id, checklist_date, checklist_type, checklist_key),
  constraint manager_daily_checklist_type_check check (checklist_type in ('opening','closing')),
  constraint manager_daily_checklist_status_check check (status in ('pending','ready','done','blocked'))
);

create index if not exists manager_command_center_events_garden_time_idx
  on public.manager_command_center_events(garden_id, occurred_at desc);

create index if not exists manager_command_center_events_manager_idx
  on public.manager_command_center_events(manager_profile_id, occurred_at desc)
  where manager_profile_id is not null;

create index if not exists manager_daily_checklist_status_garden_date_idx
  on public.manager_daily_checklist_status(garden_id, checklist_date desc, checklist_type);

alter table public.manager_command_center_events enable row level security;
alter table public.manager_daily_checklist_status enable row level security;

drop policy if exists "manager command events scoped read" on public.manager_command_center_events;
create policy "manager command events scoped read" on public.manager_command_center_events
for select using (public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "manager command events scoped insert" on public.manager_command_center_events;
create policy "manager command events scoped insert" on public.manager_command_center_events
for insert with check (public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "manager daily checklist scoped read" on public.manager_daily_checklist_status;
create policy "manager daily checklist scoped read" on public.manager_daily_checklist_status
for select using (public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "manager daily checklist scoped write" on public.manager_daily_checklist_status;
create policy "manager daily checklist scoped write" on public.manager_daily_checklist_status
for all using (public.is_admin() or public.can_access_garden(garden_id))
with check (public.is_admin() or public.can_access_garden(garden_id));

comment on table public.manager_command_center_events is 'Manager operating analytics: response, focus, widget and action usage signals for the kindergarten command center.';
comment on table public.manager_daily_checklist_status is 'Daily opening and closing checklist readiness for managers. Complements daily_operations without replacing it.';
