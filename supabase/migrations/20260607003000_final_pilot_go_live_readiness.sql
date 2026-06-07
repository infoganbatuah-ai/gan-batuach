-- PHASE 100-8: final pilot readiness and go-live checklist alignment.
-- Idempotent readiness foundation and seeds. No product permissions or runtime logic changes.

create table if not exists public.pilot_programs (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid references public.gardens(id) on delete cascade,
  pilot_name text not null,
  pilot_status text not null default 'planned',
  onboarding_status text not null default 'not_started',
  observer_status text not null default 'not_started',
  satisfaction_score numeric(5, 2),
  start_date date,
  target_end_date date,
  completed_at timestamptz,
  owner_profile_id uuid references public.profiles(id) on delete set null,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pilot_programs_status_check check (pilot_status in ('planned','inviting','active','paused','completed','cancelled')),
  constraint pilot_programs_onboarding_check check (onboarding_status in ('not_started','invited','in_progress','completed','blocked')),
  constraint pilot_programs_observer_check check (observer_status in ('not_started','configured','shadow_active','review_active','blocked'))
);

create table if not exists public.pilot_participants (
  id uuid primary key default gen_random_uuid(),
  pilot_id uuid references public.pilot_programs(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  garden_id uuid references public.gardens(id) on delete set null,
  participant_role text not null,
  participant_status text not null default 'invited',
  invited_at timestamptz,
  activated_at timestamptz,
  completed_at timestamptz,
  suspended_at timestamptz,
  last_seen_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pilot_participant_role_check check (participant_role in ('kindergarten','manager','owner','parent','staff','inspector','admin')),
  constraint pilot_participant_status_check check (participant_status in ('invited','active','completed','suspended'))
);

create table if not exists public.production_configuration_readiness (
  id uuid primary key default gen_random_uuid(),
  config_key text not null unique,
  category text not null,
  title text not null,
  readiness_status text not null default 'not_ready',
  required_for_launch boolean not null default false,
  evidence_summary text,
  recommended_action text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint production_config_category_check check (category in ('whatsapp','sms','push','email','cameras','ai','security','backups')),
  constraint production_config_status_check check (readiness_status in ('ready','partial','not_ready','blocked','not_required'))
);

create table if not exists public.launch_readiness_scores (
  id uuid primary key default gen_random_uuid(),
  category text not null unique,
  score integer not null default 0,
  status text not null default 'not_ready',
  evidence_summary text,
  recommended_action text,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint launch_readiness_category_check check (category in ('infrastructure','onboarding','notifications','observer','cameras','security','performance','support')),
  constraint launch_readiness_score_check check (score >= 0 and score <= 100),
  constraint launch_readiness_status_check check (status in ('ready','partial','not_ready','blocked'))
);

create table if not exists public.launch_issues (
  id uuid primary key default gen_random_uuid(),
  issue_key text not null unique,
  title text not null,
  severity text not null default 'medium',
  status text not null default 'open',
  category text not null default 'pilot',
  garden_id uuid references public.gardens(id) on delete set null,
  owner_profile_id uuid references public.profiles(id) on delete set null,
  impact text,
  resolution text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint launch_issues_severity_check check (severity in ('critical','high','medium','low')),
  constraint launch_issues_status_check check (status in ('open','investigating','fixed','verified','accepted_risk'))
);

create table if not exists public.launch_blockers (
  id uuid primary key default gen_random_uuid(),
  blocker_key text not null unique,
  blocker_type text not null,
  title text not null,
  severity text not null default 'high',
  owner_profile_id uuid references public.profiles(id) on delete set null,
  status text not null default 'open',
  resolution text,
  due_date date,
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint launch_blockers_type_check check (blocker_type in ('security','data','payments','cameras','observer','notifications','support','performance','legal','operations')),
  constraint launch_blockers_severity_check check (severity in ('critical','high','medium','low')),
  constraint launch_blockers_status_check check (status in ('open','investigating','fixed','verified','accepted_risk'))
);

create table if not exists public.launch_checklist (
  id uuid primary key default gen_random_uuid(),
  checklist_key text not null unique,
  title text not null,
  category text not null,
  required boolean not null default true,
  status text not null default 'pending',
  evidence_url text,
  owner_profile_id uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  verified_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint launch_checklist_category_check check (category in ('security','backup','notifications','pilot','observer','cameras','support','performance','deployment')),
  constraint launch_checklist_status_check check (status in ('pending','in_progress','completed','verified','blocked','not_required'))
);

create table if not exists public.customer_success_readiness (
  id uuid primary key default gen_random_uuid(),
  readiness_key text not null unique,
  material_type text not null,
  title text not null,
  status text not null default 'draft',
  owner_profile_id uuid references public.profiles(id) on delete set null,
  document_path text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_success_material_check check (material_type in ('onboarding_guide','support_guide','training_material','faq','runbook')),
  constraint customer_success_status_check check (status in ('draft','ready','needs_update','missing'))
);

create table if not exists public.performance_readiness_checks (
  id uuid primary key default gen_random_uuid(),
  check_key text not null unique,
  health_area text not null,
  status text not null default 'unknown',
  latest_value numeric,
  threshold_value numeric,
  checked_at timestamptz,
  recommended_action text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint performance_readiness_area_check check (health_area in ('database','api','observer','notifications','camera')),
  constraint performance_readiness_status_check check (status in ('healthy','degraded','offline','unknown','not_configured'))
);

create index if not exists idx_pilot_programs_status on public.pilot_programs(pilot_status, onboarding_status, created_at desc);
create index if not exists idx_pilot_programs_garden on public.pilot_programs(garden_id, pilot_status);
create index if not exists idx_pilot_participants_pilot on public.pilot_participants(pilot_id, participant_role, participant_status);
create index if not exists idx_launch_issues_status on public.launch_issues(status, severity, created_at desc);
create index if not exists idx_launch_blockers_status on public.launch_blockers(status, severity, created_at desc);
create index if not exists idx_launch_checklist_status on public.launch_checklist(category, status, required);
create index if not exists idx_production_config_status on public.production_configuration_readiness(category, readiness_status);
create index if not exists idx_performance_readiness_area on public.performance_readiness_checks(health_area, status);

alter table public.pilot_programs enable row level security;
alter table public.pilot_participants enable row level security;
alter table public.production_configuration_readiness enable row level security;
alter table public.launch_readiness_scores enable row level security;
alter table public.launch_issues enable row level security;
alter table public.launch_blockers enable row level security;
alter table public.launch_checklist enable row level security;
alter table public.customer_success_readiness enable row level security;
alter table public.performance_readiness_checks enable row level security;

drop policy if exists "pilot programs admin only" on public.pilot_programs;
create policy "pilot programs admin only" on public.pilot_programs for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "pilot participants admin only" on public.pilot_participants;
create policy "pilot participants admin only" on public.pilot_participants for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "production config admin only" on public.production_configuration_readiness;
create policy "production config admin only" on public.production_configuration_readiness for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "launch readiness admin only" on public.launch_readiness_scores;
create policy "launch readiness admin only" on public.launch_readiness_scores for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "launch issues admin only" on public.launch_issues;
create policy "launch issues admin only" on public.launch_issues for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "launch blockers admin only" on public.launch_blockers;
create policy "launch blockers admin only" on public.launch_blockers for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "launch checklist admin only" on public.launch_checklist;
create policy "launch checklist admin only" on public.launch_checklist for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "customer success readiness admin only" on public.customer_success_readiness;
create policy "customer success readiness admin only" on public.customer_success_readiness for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "performance readiness admin only" on public.performance_readiness_checks;
create policy "performance readiness admin only" on public.performance_readiness_checks for all using (public.is_admin()) with check (public.is_admin());

insert into public.launch_readiness_scores (category, score, status, evidence_summary, recommended_action)
values
  ('infrastructure', 78, 'partial', 'Build, health routes, Docker docs and deployment docs exist.', 'Validate production env and Supabase migrations.'),
  ('onboarding', 72, 'partial', 'First-time onboarding and progress tracking exist.', 'Run real manager/parent/staff onboarding pilot.'),
  ('notifications', 64, 'partial', 'WhatsApp/SMS/Push/Email are production-ready in mock mode.', 'Connect real providers only after opt-in and legal review.'),
  ('observer', 68, 'partial', 'Digital Observer pipeline is shadow/review mode.', 'Validate camera gateway and human review workflow.'),
  ('cameras', 62, 'partial', 'Camera wizard and gateway readiness exist.', 'Run real DVR/NVR connection validation.'),
  ('security', 70, 'partial', 'Security readiness center exists.', 'Complete RLS, backup and restore validation.'),
  ('performance', 58, 'not_ready', 'Performance readiness tracking exists.', 'Run load and route performance smoke tests.'),
  ('support', 74, 'partial', 'Support playbook and onboarding docs exist.', 'Prepare pilot training session and FAQ.')
on conflict (category) do update set
  score = excluded.score,
  status = excluded.status,
  evidence_summary = excluded.evidence_summary,
  recommended_action = excluded.recommended_action,
  updated_at = now();

insert into public.production_configuration_readiness (config_key, category, title, readiness_status, required_for_launch, evidence_summary, recommended_action)
values
  ('supabase-project', 'security', 'Supabase project, Auth and RLS', 'partial', true, 'Project readiness is tracked; live role-matrix validation is still required.', 'Run seeded-user RLS tests for admin, manager, parent, staff and inspector.'),
  ('vercel-deployment', 'security', 'Vercel deployment', 'partial', true, 'Build succeeds locally; production env and preview/prod separation need validation.', 'Validate Vercel production environment variables and deployment smoke test.'),
  ('production-domain', 'security', 'Production domain', 'not_ready', true, 'Domain readiness is not yet verified in-app.', 'Point the production domain and confirm redirects, auth callback and canonical URL.'),
  ('ssl-certificate', 'security', 'SSL certificate', 'not_ready', true, 'SSL readiness is not yet verified in-app.', 'Verify HTTPS certificate, HSTS posture and Supabase allowed redirects before pilot.'),
  ('pilot-support-coverage', 'security', 'Pilot support coverage', 'partial', true, 'Support playbooks are prepared; named live support ownership still needs confirmation.', 'Assign pilot support owner, escalation owner and response windows.')
on conflict (config_key) do update set
  category = excluded.category,
  title = excluded.title,
  readiness_status = excluded.readiness_status,
  required_for_launch = excluded.required_for_launch,
  evidence_summary = excluded.evidence_summary,
  recommended_action = excluded.recommended_action,
  updated_at = now();

insert into public.launch_checklist (checklist_key, title, category, required, status, evidence_url, notes)
values
  ('role-journey-validation', 'End-to-end role journey validation', 'pilot', true, 'in_progress', 'GO_LIVE_READINESS_REPORT.md', 'Admin, manager, parent, staff and inspector journeys reviewed; live browser QA still requires an accessible dev server.'),
  ('kindergarten-pilot-journey', 'Kindergarten lead-to-active journey validated', 'pilot', true, 'in_progress', 'GO_LIVE_READINESS_REPORT.md', 'Lead, approval, credentials, onboarding, final approval and active state documented.'),
  ('parent-pilot-journey', 'Parent invitation-to-dashboard journey validated', 'pilot', true, 'in_progress', 'GO_LIVE_READINESS_REPORT.md', 'Invitation, onboarding, child access, documents, messages, cameras and pickup documented.'),
  ('staff-pilot-journey', 'Staff invitation-to-active journey validated', 'pilot', true, 'in_progress', 'GO_LIVE_READINESS_REPORT.md', 'Invitation, onboarding, manager verification and dashboard readiness documented.'),
  ('go-live-report-created', 'Go-live readiness report created', 'deployment', true, 'completed', 'GO_LIVE_READINESS_REPORT.md', 'Final report created for pilot decision.'),
  ('support-checklists-created', 'Support checklists created', 'support', true, 'completed', 'PILOT_SUPPORT_CHECKLISTS.md', 'Admin, kindergarten and parent support checklists prepared.')
on conflict (checklist_key) do update set
  title = excluded.title,
  category = excluded.category,
  required = excluded.required,
  status = excluded.status,
  evidence_url = excluded.evidence_url,
  notes = excluded.notes,
  completed_at = case when excluded.status in ('completed','verified') then coalesce(launch_checklist.completed_at, now()) else launch_checklist.completed_at end,
  updated_at = now();

insert into public.performance_readiness_checks (check_key, health_area, status, threshold_value, latest_value, recommended_action)
values
  ('dashboard-load-review', 'api', 'unknown', null, null, 'Measure dashboard load times in production preview with realistic data.'),
  ('mobile-responsiveness-review', 'api', 'unknown', null, null, 'Run browser QA at 414px, 390px and 360px once local/preview browser access is available.'),
  ('large-table-review', 'database', 'unknown', null, null, 'Review admin users, gardens, cameras and logs pages with large datasets.')
on conflict (check_key) do update set
  health_area = excluded.health_area,
  status = excluded.status,
  threshold_value = excluded.threshold_value,
  latest_value = excluded.latest_value,
  recommended_action = excluded.recommended_action,
  updated_at = now();
