-- PHASE 144: Launch readiness, production validation and go-live platform.
-- Final readiness layer for operational, commercial, technical and organizational launch approval.

create table if not exists public.launch_readiness_scores (
  id uuid primary key default gen_random_uuid(),
  category text not null unique,
  score integer not null default 0,
  status text not null default 'not_ready',
  evidence_summary text,
  recommended_action text,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
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
  updated_at timestamptz not null default now()
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
  updated_at timestamptz not null default now()
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
  updated_at timestamptz not null default now()
);

alter table public.launch_readiness_scores drop constraint if exists launch_readiness_category_check;
alter table public.launch_readiness_scores
  add constraint launch_readiness_category_check check (category in (
    'infrastructure',
    'platform',
    'compliance',
    'security',
    'onboarding',
    'support',
    'payments',
    'notifications',
    'communication',
    'cameras',
    'observer',
    'ai',
    'performance',
    'mobile',
    'operations',
    'pilot'
  ));

alter table public.production_configuration_readiness drop constraint if exists production_config_category_check;
alter table public.production_configuration_readiness
  add constraint production_config_category_check check (category in (
    'environment',
    'api_keys',
    'domain',
    'ssl',
    'email',
    'sms',
    'whatsapp',
    'push',
    'payments',
    'cameras',
    'ai',
    'security',
    'backups',
    'monitoring',
    'support'
  ));

alter table public.launch_checklist drop constraint if exists launch_checklist_category_check;
alter table public.launch_checklist
  add constraint launch_checklist_category_check check (category in (
    'security',
    'backup',
    'notifications',
    'pilot',
    'observer',
    'cameras',
    'support',
    'performance',
    'deployment',
    'onboarding',
    'compliance',
    'payments',
    'mobile',
    'operations',
    'reports'
  ));

alter table public.performance_readiness_checks drop constraint if exists performance_readiness_area_check;
alter table public.performance_readiness_checks
  add constraint performance_readiness_area_check check (health_area in (
    'database',
    'api',
    'frontend',
    'observer',
    'notifications',
    'camera',
    'payments',
    'mobile',
    'provider',
    'backup'
  ));

create table if not exists public.production_readiness_score (
  id uuid primary key default gen_random_uuid(),
  score_key text not null unique,
  readiness_area text not null,
  score integer not null default 0,
  status text not null default 'not_ready',
  weight numeric(5, 2) not null default 1,
  evidence_summary text,
  recommended_action text,
  validated_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint production_readiness_area_check check (readiness_area in ('platform','compliance','security','onboarding','support','payments','cameras','ai','mobile','operations','pilot')),
  constraint production_readiness_score_range_check check (score between 0 and 100),
  constraint production_readiness_status_check check (status in ('ready','partial','not_ready','blocked'))
);

create table if not exists public.launch_validation_reviews (
  id uuid primary key default gen_random_uuid(),
  validation_key text not null unique,
  validation_type text not null,
  validation_area text not null,
  title text not null,
  role_scope text,
  status text not null default 'pending',
  result_summary text,
  evidence_url text,
  owner_profile_id uuid references public.profiles(id) on delete set null,
  validated_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint launch_validation_type_check check (validation_type in ('user_journey','feature','configuration','security','compliance','camera','ai','billing','support','mobile','operations','pilot')),
  constraint launch_validation_area_check check (validation_area in ('manager','staff','parent','inspector','admin','onboarding','inspections','compliance','ai','observer','cameras','payments','notifications','communications','reports','security','support','mobile','backup','pilot')),
  constraint launch_validation_status_check check (status in ('pending','in_progress','passed','failed','blocked','not_required'))
);

create table if not exists public.launch_risk_register (
  id uuid primary key default gen_random_uuid(),
  risk_key text not null unique,
  risk_type text not null,
  title text not null,
  severity text not null default 'medium',
  likelihood text not null default 'medium',
  status text not null default 'open',
  mitigation text,
  owner_profile_id uuid references public.profiles(id) on delete set null,
  due_date date,
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint launch_risk_type_check check (risk_type in ('technical','operational','legal','security','business','commercial','support','data')),
  constraint launch_risk_severity_check check (severity in ('critical','high','medium','low')),
  constraint launch_risk_likelihood_check check (likelihood in ('high','medium','low')),
  constraint launch_risk_status_check check (status in ('open','mitigating','accepted','resolved','closed'))
);

create table if not exists public.go_live_decisions (
  id uuid primary key default gen_random_uuid(),
  decision_key text not null unique,
  decision_status text not null default 'not_ready',
  readiness_score integer not null default 0,
  decided_by uuid references public.profiles(id) on delete set null,
  decision_summary text,
  required_conditions jsonb not null default '[]'::jsonb,
  next_review_at timestamptz,
  decided_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint go_live_decision_status_check check (decision_status in ('not_ready','pilot_ready','launch_ready','production_approved')),
  constraint go_live_decision_score_check check (readiness_score between 0 and 100)
);

create table if not exists public.launch_executive_reports (
  id uuid primary key default gen_random_uuid(),
  report_key text not null unique,
  report_type text not null,
  title text not null,
  status text not null default 'draft',
  summary text,
  report_path text,
  generated_by uuid references public.profiles(id) on delete set null,
  generated_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint launch_report_type_check check (report_type in ('readiness','risk','launch_summary','deployment_summary','pilot_summary')),
  constraint launch_report_status_check check (status in ('draft','ready','approved','archived'))
);

create index if not exists production_readiness_score_area_idx on public.production_readiness_score(readiness_area, status, score desc);
create index if not exists launch_validation_reviews_status_idx on public.launch_validation_reviews(validation_type, validation_area, status);
create index if not exists launch_risk_register_status_idx on public.launch_risk_register(status, severity, risk_type);
create index if not exists go_live_decisions_status_idx on public.go_live_decisions(decision_status, created_at desc);
create index if not exists launch_executive_reports_type_idx on public.launch_executive_reports(report_type, status, created_at desc);

alter table public.production_readiness_score enable row level security;
alter table public.launch_validation_reviews enable row level security;
alter table public.launch_risk_register enable row level security;
alter table public.go_live_decisions enable row level security;
alter table public.launch_executive_reports enable row level security;

drop policy if exists "production readiness score admin only" on public.production_readiness_score;
create policy "production readiness score admin only" on public.production_readiness_score for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "launch validation reviews admin only" on public.launch_validation_reviews;
create policy "launch validation reviews admin only" on public.launch_validation_reviews for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "launch risk register admin only" on public.launch_risk_register;
create policy "launch risk register admin only" on public.launch_risk_register for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "go live decisions admin only" on public.go_live_decisions;
create policy "go live decisions admin only" on public.go_live_decisions for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "launch executive reports admin only" on public.launch_executive_reports;
create policy "launch executive reports admin only" on public.launch_executive_reports for all using (public.is_admin()) with check (public.is_admin());

insert into public.production_readiness_score (score_key, readiness_area, score, status, weight, evidence_summary, recommended_action)
values
  ('platform-readiness', 'platform', 82, 'partial', 1.2, 'Core dashboards, routes and build validation are in place.', 'Run production preview smoke test with realistic seed data.'),
  ('compliance-readiness', 'compliance', 78, 'partial', 1.1, 'Compliance, inspections, documents and audit trails exist.', 'Complete legal document review and retention policy approval.'),
  ('security-readiness', 'security', 76, 'partial', 1.2, 'Security center, audit logs and access models exist.', 'Complete external security review and seeded role-boundary QA.'),
  ('onboarding-readiness', 'onboarding', 80, 'partial', 1.0, 'Kindergarten onboarding flow is modeled end to end.', 'Run first real kindergarten registration through payment activation.'),
  ('support-readiness', 'support', 74, 'partial', 0.9, 'Customer success, training and tickets are modeled.', 'Assign named pilot support owners and response windows.'),
  ('payment-readiness', 'payments', 68, 'partial', 1.0, 'Billing models and separation rules are ready.', 'Connect payment provider sandbox and verify invoice generation.'),
  ('camera-readiness', 'cameras', 64, 'partial', 1.0, 'Camera setup, permissions and gateway registry are modeled.', 'Validate first real DVR/NVR/RTSP connection in pilot mode.'),
  ('ai-readiness', 'ai', 70, 'partial', 0.9, 'AI review workflows remain human-gated.', 'Validate model registry, calibration and human review workflows before live use.'),
  ('mobile-readiness', 'mobile', 66, 'partial', 0.8, 'Mobile platform and push readiness are tracked.', 'Complete device QA for iOS, Android and push deep links.'),
  ('operations-readiness', 'operations', 72, 'partial', 1.0, 'Backup, DR and provider monitoring readiness exist.', 'Perform restore test and provider failover tabletop.'),
  ('pilot-readiness', 'pilot', 84, 'partial', 1.1, 'Pilot dashboards and reports exist.', 'Approve first kindergarten pilot checklist and support cadence.')
on conflict (score_key) do update set
  readiness_area = excluded.readiness_area,
  score = excluded.score,
  status = excluded.status,
  weight = excluded.weight,
  evidence_summary = excluded.evidence_summary,
  recommended_action = excluded.recommended_action,
  updated_at = now();

insert into public.launch_validation_reviews (validation_key, validation_type, validation_area, title, role_scope, status, result_summary, evidence_url)
values
  ('manager-journey-validation', 'user_journey', 'manager', 'Manager end-to-end journey', 'manager', 'in_progress', 'Login, command center, children, staff, documents, cameras, payments and compliance require final pilot walkthrough.', 'LAUNCH_READINESS_PRODUCTION_VALIDATION_AND_GO_LIVE_PLATFORM.md'),
  ('staff-journey-validation', 'user_journey', 'staff', 'Staff end-to-end journey', 'staff', 'in_progress', 'Invitation, GPS attendance, shift tasks and child updates require mobile pilot walkthrough.', 'LAUNCH_READINESS_PRODUCTION_VALIDATION_AND_GO_LIVE_PLATFORM.md'),
  ('parent-journey-validation', 'user_journey', 'parent', 'Parent end-to-end journey', 'parent', 'in_progress', 'Invitation, child timeline, documents, payments, messages and camera access require real parent QA.', 'LAUNCH_READINESS_PRODUCTION_VALIDATION_AND_GO_LIVE_PLATFORM.md'),
  ('inspector-journey-validation', 'user_journey', 'inspector', 'Inspector end-to-end journey', 'inspector', 'in_progress', 'Inspection scheduling, GPS, findings, complaints and reports require field QA.', 'LAUNCH_READINESS_PRODUCTION_VALIDATION_AND_GO_LIVE_PLATFORM.md'),
  ('admin-journey-validation', 'user_journey', 'admin', 'Admin end-to-end journey', 'admin', 'in_progress', 'Leads, activation, billing, growth, security and launch readiness require final operations QA.', 'LAUNCH_READINESS_PRODUCTION_VALIDATION_AND_GO_LIVE_PLATFORM.md'),
  ('feature-onboarding-validation', 'feature', 'onboarding', 'Onboarding readiness validation', null, 'in_progress', 'Kindergarten onboarding and activation modeled; payment-provider validation remains.', null),
  ('feature-camera-validation', 'camera', 'cameras', 'Camera readiness validation', null, 'pending', 'Gateway and parent visibility rules modeled; real camera test pending.', null),
  ('feature-ai-validation', 'ai', 'ai', 'AI readiness validation', null, 'in_progress', 'Human review boundary is modeled; production model activation remains gated.', null),
  ('feature-billing-validation', 'billing', 'payments', 'Billing readiness validation', null, 'pending', 'Subscription and parent payment models exist; provider sandbox test pending.', null),
  ('feature-support-validation', 'support', 'support', 'Support readiness validation', null, 'in_progress', 'Customer success and support ticket platform exists; staffing SLA approval remains.', null),
  ('mobile-readiness-validation', 'mobile', 'mobile', 'Mobile and push readiness validation', null, 'pending', 'Mobile center exists; device QA and store readiness need review.', null),
  ('operations-readiness-validation', 'operations', 'backup', 'Backup and disaster recovery validation', null, 'pending', 'Continuity center exists; restore test must be performed.', null)
on conflict (validation_key) do update set
  validation_type = excluded.validation_type,
  validation_area = excluded.validation_area,
  title = excluded.title,
  role_scope = excluded.role_scope,
  status = excluded.status,
  result_summary = excluded.result_summary,
  evidence_url = excluded.evidence_url,
  updated_at = now();

insert into public.launch_risk_register (risk_key, risk_type, title, severity, likelihood, status, mitigation, due_date)
values
  ('payment-provider-not-connected', 'commercial', 'Payment provider is not connected to production', 'high', 'medium', 'open', 'Run sandbox validation, choose provider, then enable production only after admin approval.', current_date + 14),
  ('real-camera-validation-pending', 'technical', 'Real camera connection is not yet validated', 'high', 'medium', 'open', 'Use first pilot site or isolated home test camera before parent access.', current_date + 14),
  ('external-security-review-pending', 'security', 'External security review is pending', 'high', 'medium', 'mitigating', 'Complete RLS/API/secrets review before production approval.', current_date + 21),
  ('support-coverage-not-finalized', 'operational', 'Pilot support coverage is not finalized', 'medium', 'medium', 'open', 'Assign support owners, escalation contacts and SLA windows.', current_date + 7),
  ('app-store-readiness-pending', 'business', 'Native app store readiness is pending', 'medium', 'medium', 'open', 'Launch pilot with responsive web/PWA while store materials are finalized.', current_date + 30)
on conflict (risk_key) do update set
  risk_type = excluded.risk_type,
  title = excluded.title,
  severity = excluded.severity,
  likelihood = excluded.likelihood,
  status = excluded.status,
  mitigation = excluded.mitigation,
  due_date = excluded.due_date,
  updated_at = now();

insert into public.go_live_decisions (decision_key, decision_status, readiness_score, decision_summary, required_conditions, next_review_at)
values (
  'phase-144-final-decision',
  'pilot_ready',
  74,
  'Platform is ready for controlled first-kindergarten pilot, not broad production launch.',
  '["Complete payment provider sandbox validation","Run real camera connection test","Complete external security review","Assign pilot support owners","Complete role journey QA"]'::jsonb,
  now() + interval '7 days'
)
on conflict (decision_key) do update set
  decision_status = excluded.decision_status,
  readiness_score = excluded.readiness_score,
  decision_summary = excluded.decision_summary,
  required_conditions = excluded.required_conditions,
  next_review_at = excluded.next_review_at,
  updated_at = now();

insert into public.launch_executive_reports (report_key, report_type, title, status, summary, report_path)
values
  ('phase-144-readiness-report', 'readiness', 'Phase 144 readiness report', 'ready', 'Final roadmap readiness model, validation checks and go-live decision framework.', 'LAUNCH_READINESS_PRODUCTION_VALIDATION_AND_GO_LIVE_PLATFORM.md'),
  ('phase-144-risk-report', 'risk', 'Phase 144 risk report', 'ready', 'Launch risk register with technical, operational, commercial and security risks.', 'LAUNCH_READINESS_PRODUCTION_VALIDATION_AND_GO_LIVE_PLATFORM.md'),
  ('phase-144-launch-summary', 'launch_summary', 'Phase 144 launch summary', 'ready', 'Controlled pilot recommended before broad production deployment.', 'LAUNCH_READINESS_PRODUCTION_VALIDATION_AND_GO_LIVE_PLATFORM.md')
on conflict (report_key) do update set
  report_type = excluded.report_type,
  title = excluded.title,
  status = excluded.status,
  summary = excluded.summary,
  report_path = excluded.report_path,
  updated_at = now();

insert into public.launch_readiness_scores (category, score, status, evidence_summary, recommended_action)
select readiness_area, score, status, evidence_summary, recommended_action
from public.production_readiness_score
on conflict (category) do update set
  score = excluded.score,
  status = excluded.status,
  evidence_summary = excluded.evidence_summary,
  recommended_action = excluded.recommended_action,
  updated_at = now();

insert into public.launch_checklist (checklist_key, title, category, required, status, evidence_url, notes)
values
  ('phase-144-role-journey-validation', 'Validate all role journeys end to end', 'onboarding', true, 'in_progress', 'LAUNCH_READINESS_PRODUCTION_VALIDATION_AND_GO_LIVE_PLATFORM.md', 'Manager, staff, parent, inspector and admin journeys tracked in launch_validation_reviews.'),
  ('phase-144-production-config-review', 'Review production configuration', 'deployment', true, 'in_progress', 'LAUNCH_READINESS_PRODUCTION_VALIDATION_AND_GO_LIVE_PLATFORM.md', 'Environment variables, API keys, domain, SSL and providers must be approved.'),
  ('phase-144-security-review', 'Complete security readiness review', 'security', true, 'in_progress', 'LAUNCH_READINESS_PRODUCTION_VALIDATION_AND_GO_LIVE_PLATFORM.md', 'MFA, RBAC, encryption, audit logs and access controls require final review.'),
  ('phase-144-billing-provider-validation', 'Validate billing providers and invoices', 'payments', true, 'pending', 'LAUNCH_READINESS_PRODUCTION_VALIDATION_AND_GO_LIVE_PLATFORM.md', 'Subscription, invoice, renewal and provider sandbox flow must be validated.'),
  ('phase-144-camera-pilot-validation', 'Validate real camera pilot readiness', 'cameras', true, 'pending', 'LAUNCH_READINESS_PRODUCTION_VALIDATION_AND_GO_LIVE_PLATFORM.md', 'Camera setup, streaming, permissions and observer binding require real-world test.'),
  ('phase-144-go-live-decision', 'Record go-live decision', 'deployment', true, 'completed', 'LAUNCH_READINESS_PRODUCTION_VALIDATION_AND_GO_LIVE_PLATFORM.md', 'Initial decision: pilot ready, production approval still gated.')
on conflict (checklist_key) do update set
  title = excluded.title,
  category = excluded.category,
  required = excluded.required,
  status = excluded.status,
  evidence_url = excluded.evidence_url,
  notes = excluded.notes,
  completed_at = case when excluded.status in ('completed','verified') then coalesce(launch_checklist.completed_at, now()) else launch_checklist.completed_at end,
  updated_at = now();

comment on table public.production_readiness_score is 'Weighted 0-100 production readiness model for platform, compliance, security, onboarding, support, payments, cameras, AI, mobile, operations and pilot readiness.';
comment on table public.launch_validation_reviews is 'Launch validation register for role journeys, feature readiness and operational go-live checks.';
comment on table public.launch_risk_register is 'Launch risk register for technical, operational, legal, security and business risks.';
comment on table public.go_live_decisions is 'Formal go-live decision dashboard with status, score, conditions and next review date.';
comment on table public.launch_executive_reports is 'Executive launch reporting registry for readiness, risk, launch summary and deployment summary reports.';

notify pgrst, 'reload schema';
