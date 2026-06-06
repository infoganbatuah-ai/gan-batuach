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
on conflict (category) do update set score = excluded.score, status = excluded.status, evidence_summary = excluded.evidence_summary, recommended_action = excluded.recommended_action, updated_at = now();

insert into public.production_configuration_readiness (config_key, category, title, readiness_status, required_for_launch, evidence_summary, recommended_action)
values
  ('whatsapp-provider', 'whatsapp', 'WhatsApp Business provider', 'partial', false, 'Mock and template readiness exist.', 'Enable real provider only after opt-in and template approval.'),
  ('sms-provider', 'sms', 'SMS provider', 'partial', false, 'Mock and delivery tracking readiness exist.', 'Choose provider and configure real send flag.'),
  ('push-provider', 'push', 'Push notifications', 'partial', false, 'Device token and delivery readiness exist.', 'Configure FCM/APNs/Web Push after app release plan.'),
  ('email-provider', 'email', 'Email provider', 'partial', false, 'Template and queue readiness exist.', 'Configure provider and domain verification.'),
  ('camera-gateway', 'cameras', 'Video gateway and camera validation', 'partial', true, 'Gateway readiness exists.', 'Deploy MediaMTX/go2rtc and validate pilot cameras.'),
  ('ai-observer', 'ai', 'Digital Observer shadow mode', 'partial', false, 'Shadow/review pipeline exists.', 'Keep parent-hidden until human review workflow is proven.'),
  ('security-center', 'security', 'Security readiness', 'partial', true, 'Security center and admin-only checks exist.', 'Complete RLS and backup validation.'),
  ('backup-restore', 'backups', 'Backup and restore', 'not_ready', true, 'Backup docs exist.', 'Perform restore test before launch.')
on conflict (config_key) do update set category = excluded.category, title = excluded.title, readiness_status = excluded.readiness_status, required_for_launch = excluded.required_for_launch, evidence_summary = excluded.evidence_summary, recommended_action = excluded.recommended_action, updated_at = now();

insert into public.launch_checklist (checklist_key, title, category, required, status, evidence_url, notes)
values
  ('security-audit-completed', 'Security audit completed', 'security', true, 'in_progress', 'SECURITY_HARDENING_AND_ENTERPRISE_READINESS.md', 'Complete RLS/API/storage review.'),
  ('backup-verified', 'Backup and restore verified', 'backup', true, 'pending', 'BACKUP_AND_RESTORE.md', 'Run real restore validation.'),
  ('notifications-verified', 'Notifications verified', 'notifications', false, 'in_progress', 'WHATSAPP_PRODUCTION_READINESS.md', 'Mock mode ready; real providers optional for pilot.'),
  ('pilot-completed', 'Pilot completed', 'pilot', true, 'pending', 'PILOT_AND_LAUNCH_READINESS.md', 'Complete at least one real kindergarten pilot.'),
  ('observer-verified', 'Digital Observer verified', 'observer', false, 'in_progress', 'REAL_AI_VISION_INTEGRATION.md', 'Shadow/human review only.'),
  ('camera-validation-completed', 'Camera validation completed', 'cameras', true, 'pending', 'REAL_CAMERA_INFRASTRUCTURE.md', 'Validate real DVR/NVR/IP camera connection.'),
  ('support-ready', 'Support and onboarding ready', 'support', true, 'in_progress', 'SUPPORT_PLAYBOOK.md', 'Prepare pilot support owner and escalation path.'),
  ('performance-smoke-completed', 'Performance smoke completed', 'performance', true, 'pending', 'DEPLOYMENT_CHECKLIST.md', 'Run main route and API smoke tests.')
on conflict (checklist_key) do update set title = excluded.title, category = excluded.category, required = excluded.required, status = excluded.status, evidence_url = excluded.evidence_url, notes = excluded.notes, updated_at = now();

insert into public.customer_success_readiness (readiness_key, material_type, title, status, document_path, notes)
values
  ('first-kindergarten-onboarding', 'onboarding_guide', 'First kindergarten onboarding guide', 'ready', 'FIRST_KINDERGARTEN_ONBOARDING.md', 'Pilot onboarding flow documented.'),
  ('support-playbook', 'support_guide', 'Support playbook', 'ready', 'SUPPORT_PLAYBOOK.md', 'Common pilot issues documented.'),
  ('pilot-success-metrics', 'runbook', 'Pilot success metrics', 'ready', 'PILOT_SUCCESS_METRICS.md', 'Pilot KPIs defined.'),
  ('manager-training', 'training_material', 'Manager training material', 'draft', null, 'Prepare short live training before pilot.'),
  ('pilot-faq', 'faq', 'Pilot FAQ', 'draft', null, 'Prepare FAQ from first pilot feedback.')
on conflict (readiness_key) do update set material_type = excluded.material_type, title = excluded.title, status = excluded.status, document_path = excluded.document_path, notes = excluded.notes, updated_at = now();

insert into public.performance_readiness_checks (check_key, health_area, status, threshold_value, recommended_action)
values
  ('database-health', 'database', 'unknown', null, 'Validate slow queries and indexes before launch.'),
  ('api-health', 'api', 'healthy', null, 'Keep /api/health and /api/health/deep checks in deployment smoke test.'),
  ('observer-health', 'observer', 'not_configured', null, 'Observer worker remains mock/shadow until pilot camera validation.'),
  ('notification-health', 'notifications', 'not_configured', null, 'Real providers not enabled; mock logs are ready.'),
  ('camera-health', 'camera', 'degraded', null, 'Validate real gateway and camera health before launch.')
on conflict (check_key) do update set health_area = excluded.health_area, status = excluded.status, threshold_value = excluded.threshold_value, recommended_action = excluded.recommended_action, updated_at = now();

comment on table public.pilot_programs is 'Admin-only pilot kindergarten tracking for real-world deployment.';
comment on table public.pilot_participants is 'Admin-only pilot participant status tracking across roles.';
comment on table public.production_configuration_readiness is 'Admin-only production configuration readiness for WhatsApp, SMS, Push, Email, Cameras, AI, Security and Backups.';
comment on table public.launch_readiness_scores is 'Admin-only launch readiness score by category.';
comment on table public.launch_issues is 'Admin-only pilot and launch issue tracking.';
comment on table public.launch_blockers is 'Admin-only launch blocker tracking.';
comment on table public.launch_checklist is 'Admin-only go-live checklist.';
comment on table public.customer_success_readiness is 'Admin-only onboarding, support, training and FAQ readiness.';
comment on table public.performance_readiness_checks is 'Admin-only performance readiness tracking.';
