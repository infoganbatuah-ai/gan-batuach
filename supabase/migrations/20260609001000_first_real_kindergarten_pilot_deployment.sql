-- PHASE 105: first real kindergarten pilot deployment.
-- Operational validation only. No large architectural changes and no permission weakening.

do $$
begin
  alter type public.pilot_feedback_category add value if not exists 'ux';
  alter type public.pilot_feedback_category add value if not exists 'reliability';
  alter type public.pilot_feedback_category add value if not exists 'confusion';
  alter type public.pilot_feedback_category add value if not exists 'missing_feature';
exception
  when undefined_object then null;
end $$;

alter table public.pilot_programs
  add column if not exists kindergarten_name text,
  add column if not exists manager_name text,
  add column if not exists contact_person_name text,
  add column if not exists contact_phone text,
  add column if not exists contact_email text,
  add column if not exists number_of_children integer,
  add column if not exists number_of_staff integer,
  add column if not exists number_of_classrooms integer,
  add column if not exists camera_availability text not null default 'unknown',
  add column if not exists observer_participation boolean not null default false,
  add column if not exists onboarding_date date,
  add column if not exists activation_date date,
  add column if not exists real_customer_pilot boolean not null default false,
  add column if not exists pilot_health_score integer not null default 0;

do $$
begin
  alter table public.pilot_programs
    add constraint pilot_programs_camera_availability_check
    check (camera_availability in ('unknown','none','test_mode','available','connected','blocked'));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.pilot_programs
    add constraint pilot_programs_health_score_check
    check (pilot_health_score >= 0 and pilot_health_score <= 100);
exception
  when duplicate_object then null;
end $$;

create table if not exists public.pilot_deployment_checklist (
  id uuid primary key default gen_random_uuid(),
  pilot_id uuid references public.pilot_programs(id) on delete cascade,
  garden_id uuid references public.gardens(id) on delete set null,
  checklist_key text not null,
  title text not null,
  category text not null,
  status text not null default 'pending',
  required boolean not null default true,
  evidence_summary text,
  owner_role text,
  completed_at timestamptz,
  verified_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(pilot_id, checklist_key),
  constraint pilot_deployment_checklist_category_check check (category in ('accounts','onboarding','permissions','communications','manager','parent','staff','camera','observer','support')),
  constraint pilot_deployment_checklist_status_check check (status in ('pending','in_progress','completed','verified','blocked','not_required'))
);

create table if not exists public.pilot_journey_validations (
  id uuid primary key default gen_random_uuid(),
  pilot_id uuid references public.pilot_programs(id) on delete cascade,
  garden_id uuid references public.gardens(id) on delete set null,
  role_key text not null,
  journey_step text not null,
  status text not null default 'not_tested',
  confusion_points text,
  ux_issues text,
  validated_by uuid references public.profiles(id) on delete set null,
  validated_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(pilot_id, role_key, journey_step),
  constraint pilot_journey_role_check check (role_key in ('manager','parent','staff','inspector','admin')),
  constraint pilot_journey_status_check check (status in ('not_tested','passed','friction','blocked','not_applicable'))
);

create table if not exists public.pilot_issues (
  id uuid primary key default gen_random_uuid(),
  pilot_id uuid references public.pilot_programs(id) on delete cascade,
  garden_id uuid references public.gardens(id) on delete set null,
  issue_key text not null unique,
  title text not null,
  description text,
  severity text not null default 'medium',
  affected_role text not null default 'admin',
  reported_by uuid references public.profiles(id) on delete set null,
  status text not null default 'open',
  resolution text,
  resolved_at timestamptz,
  verified_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pilot_issues_severity_check check (severity in ('critical','high','medium','low')),
  constraint pilot_issues_role_check check (affected_role in ('admin','manager','parent','staff','inspector','all')),
  constraint pilot_issues_status_check check (status in ('open','investigating','fixed','verified','accepted_risk'))
);

create table if not exists public.pilot_usage_analytics (
  id uuid primary key default gen_random_uuid(),
  pilot_id uuid references public.pilot_programs(id) on delete cascade,
  garden_id uuid references public.gardens(id) on delete set null,
  usage_date date not null default current_date,
  role_key text not null,
  daily_active_users integer not null default 0,
  login_count integer not null default 0,
  feature_key text not null default 'dashboard',
  feature_usage_count integer not null default 0,
  onboarding_completion_percent numeric(5,2) not null default 0,
  screen_views integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(pilot_id, usage_date, role_key, feature_key),
  constraint pilot_usage_role_check check (role_key in ('admin','manager','parent','staff','inspector','all')),
  constraint pilot_usage_onboarding_check check (onboarding_completion_percent >= 0 and onboarding_completion_percent <= 100)
);

create table if not exists public.pilot_success_criteria (
  id uuid primary key default gen_random_uuid(),
  pilot_id uuid references public.pilot_programs(id) on delete cascade,
  garden_id uuid references public.gardens(id) on delete set null,
  criteria_key text not null,
  title text not null,
  target_value numeric,
  current_value numeric not null default 0,
  status text not null default 'tracking',
  evidence_summary text,
  recommended_action text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(pilot_id, criteria_key),
  constraint pilot_success_status_check check (status in ('tracking','met','at_risk','missed','not_applicable'))
);

create index if not exists idx_pilot_deployment_checklist_pilot on public.pilot_deployment_checklist(pilot_id, category, status);
create index if not exists idx_pilot_journey_validations_pilot on public.pilot_journey_validations(pilot_id, role_key, status);
create index if not exists idx_pilot_issues_status on public.pilot_issues(pilot_id, status, severity, created_at desc);
create index if not exists idx_pilot_usage_analytics_date on public.pilot_usage_analytics(pilot_id, usage_date desc, role_key);
create index if not exists idx_pilot_success_criteria_status on public.pilot_success_criteria(pilot_id, status);

alter table public.pilot_deployment_checklist enable row level security;
alter table public.pilot_journey_validations enable row level security;
alter table public.pilot_issues enable row level security;
alter table public.pilot_usage_analytics enable row level security;
alter table public.pilot_success_criteria enable row level security;

drop policy if exists "pilot deployment checklist admin only" on public.pilot_deployment_checklist;
create policy "pilot deployment checklist admin only"
on public.pilot_deployment_checklist for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "pilot journey validations admin only" on public.pilot_journey_validations;
create policy "pilot journey validations admin only"
on public.pilot_journey_validations for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "pilot issues admin only" on public.pilot_issues;
create policy "pilot issues admin only"
on public.pilot_issues for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "pilot usage analytics admin only" on public.pilot_usage_analytics;
create policy "pilot usage analytics admin only"
on public.pilot_usage_analytics for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "pilot success criteria admin only" on public.pilot_success_criteria;
create policy "pilot success criteria admin only"
on public.pilot_success_criteria for all using (public.is_admin()) with check (public.is_admin());

insert into public.pilot_programs (
  pilot_name,
  kindergarten_name,
  manager_name,
  contact_person_name,
  pilot_status,
  onboarding_status,
  observer_status,
  camera_availability,
  observer_participation,
  real_customer_pilot,
  number_of_children,
  number_of_staff,
  number_of_classrooms,
  onboarding_date,
  notes,
  metadata
)
values (
  'First real kindergarten pilot',
  'גן פיילוט ראשון',
  'מנהלת הגן',
  'איש קשר לפיילוט',
  'planned',
  'not_started',
  'not_started',
  'test_mode',
  true,
  true,
  0,
  0,
  0,
  current_date,
  'Profile placeholder for the first real customer pilot. Replace with the selected kindergarten details before activation.',
  '{"phase":"105","real_customer_environment":true,"camera_mode":"test_until_real_cameras_available"}'::jsonb
)
on conflict do nothing;

with first_pilot as (
  select id, garden_id from public.pilot_programs where pilot_name = 'First real kindergarten pilot' order by created_at desc limit 1
)
insert into public.pilot_deployment_checklist (pilot_id, garden_id, checklist_key, title, category, status, required, owner_role)
select first_pilot.id, first_pilot.garden_id, item.checklist_key, item.title, item.category, 'pending', true, item.owner_role
from first_pilot
cross join (values
  ('manager-account-active','Manager account active','accounts','admin'),
  ('staff-accounts-active','Staff accounts active','accounts','admin'),
  ('parent-accounts-active','Parent accounts active','accounts','admin'),
  ('onboarding-completed','Onboarding completed','onboarding','manager'),
  ('permissions-validated','Permissions validated','permissions','admin'),
  ('communication-tested','Communication channels tested','communications','admin'),
  ('camera-health-checked','Camera health checked or test mode enabled','camera','admin'),
  ('observer-shadow-ready','Observer review workflow ready','observer','admin'),
  ('support-owner-assigned','Pilot support owner assigned','support','admin')
) as item(checklist_key, title, category, owner_role)
on conflict (pilot_id, checklist_key) do update set
  title = excluded.title,
  category = excluded.category,
  owner_role = excluded.owner_role,
  updated_at = now();

with first_pilot as (
  select id, garden_id from public.pilot_programs where pilot_name = 'First real kindergarten pilot' order by created_at desc limit 1
)
insert into public.pilot_journey_validations (pilot_id, garden_id, role_key, journey_step, status, metadata)
select first_pilot.id, first_pilot.garden_id, item.role_key, item.journey_step, 'not_tested', '{}'::jsonb
from first_pilot
cross join (values
  ('manager','login'),
  ('manager','onboarding'),
  ('manager','children_management'),
  ('manager','parent_management'),
  ('manager','staff_management'),
  ('manager','documents'),
  ('manager','cameras'),
  ('manager','observer'),
  ('parent','registration'),
  ('parent','child_access'),
  ('parent','attendance_visibility'),
  ('parent','messages'),
  ('parent','documents'),
  ('parent','pickup'),
  ('parent','cameras_if_enabled'),
  ('staff','invitation'),
  ('staff','onboarding'),
  ('staff','permissions'),
  ('staff','attendance'),
  ('staff','tasks'),
  ('staff','communication'),
  ('inspector','pilot_review')
) as item(role_key, journey_step)
on conflict (pilot_id, role_key, journey_step) do nothing;

with first_pilot as (
  select id, garden_id from public.pilot_programs where pilot_name = 'First real kindergarten pilot' order by created_at desc limit 1
)
insert into public.pilot_success_criteria (pilot_id, garden_id, criteria_key, title, target_value, current_value, status, recommended_action)
select first_pilot.id, first_pilot.garden_id, item.criteria_key, item.title, item.target_value, 0, 'tracking', item.recommended_action
from first_pilot
cross join (values
  ('manager-satisfaction','Manager satisfaction',80,'Collect manager feedback after first week.'),
  ('parent-satisfaction','Parent satisfaction',75,'Collect parent feedback from active families.'),
  ('onboarding-completion','Onboarding completion',90,'Complete manager, staff and parent onboarding.'),
  ('issue-resolution','Issue resolution',85,'Resolve or verify critical/high pilot issues.'),
  ('observer-readiness','Observer readiness',70,'Keep observer in shadow mode and review feedback.'),
  ('camera-readiness','Camera readiness',70,'Use test mode if real cameras are unavailable.')
) as item(criteria_key, title, target_value, recommended_action)
on conflict (pilot_id, criteria_key) do update set
  title = excluded.title,
  target_value = excluded.target_value,
  recommended_action = excluded.recommended_action,
  updated_at = now();

with first_pilot as (
  select id, garden_id from public.pilot_programs where pilot_name = 'First real kindergarten pilot' order by created_at desc limit 1
)
insert into public.pilot_issues (pilot_id, garden_id, issue_key, title, description, severity, affected_role, status)
select first_pilot.id, first_pilot.garden_id, 'first-pilot-real-browser-qa-required', 'Real pilot browser QA required', 'Run admin, manager, parent, staff and inspector dashboard review in an accessible browser environment.', 'high', 'all', 'open'
from first_pilot
on conflict (issue_key) do update set
  title = excluded.title,
  description = excluded.description,
  severity = excluded.severity,
  affected_role = excluded.affected_role,
  status = excluded.status,
  updated_at = now();

comment on table public.pilot_deployment_checklist is 'First real kindergarten pilot deployment checklist.';
comment on table public.pilot_journey_validations is 'Real role journey validation for manager, parent, staff, inspector and admin pilot workflows.';
comment on table public.pilot_issues is 'First real pilot issue tracking with critical/high/medium/low severities.';
comment on table public.pilot_usage_analytics is 'Internal pilot usage analytics readiness: DAU, logins, feature usage, onboarding and screen usage.';
comment on table public.pilot_success_criteria is 'First real kindergarten pilot success criteria and readiness targets.';

notify pgrst, 'reload schema';
