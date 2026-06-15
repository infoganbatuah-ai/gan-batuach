-- PHASE 190: Final Production Launch & Company Operating System
-- Final go-live controls and ongoing operating system. No public launch is performed by this migration.

create table if not exists public.final_launch_status (
  id uuid primary key default gen_random_uuid(),
  product_type text not null unique check (product_type in ('gan_batuach','digital_observer')),
  status text not null default 'not_ready' check (status in ('not_ready','internal_ready','pilot_ready','commercial_ready','external_review_required','approved_for_launch','launched','paused')),
  launch_owner text,
  launch_date date,
  readiness_score integer not null default 0 check (readiness_score between 0 and 100),
  blockers jsonb not null default '[]'::jsonb,
  final_decision text,
  notes text,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.final_launch_checklists (
  id uuid primary key default gen_random_uuid(),
  checklist_key text not null unique,
  product_type text not null check (product_type in ('gan_batuach','digital_observer','company')),
  checklist_area text not null,
  checklist_item text not null,
  status text not null default 'not_started' check (status in ('not_started','in_progress','ready','blocked','not_required','approved')),
  critical boolean not null default false,
  evidence_reference text,
  owner text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.final_launch_blockers (
  id uuid primary key default gen_random_uuid(),
  blocker_key text not null unique,
  product_type text not null check (product_type in ('gan_batuach','digital_observer','company')),
  severity text not null check (severity in ('critical','high','medium','low')),
  status text not null default 'open' check (status in ('open','in_progress','fixed','verified','accepted_risk','closed')),
  title text not null,
  description text,
  owner text,
  launch_impact text,
  mitigation text,
  due_date date,
  evidence_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.final_production_risks (
  id uuid primary key default gen_random_uuid(),
  risk_key text not null unique,
  category text not null check (category in ('product','technical','privacy','security','legal','commercial','operational','support','payments','cameras','ai','mobile','reputation')),
  product_type text not null default 'company' check (product_type in ('gan_batuach','digital_observer','company')),
  risk text not null,
  severity text not null check (severity in ('critical','high','medium','low')),
  mitigation text,
  owner text,
  status text not null default 'open' check (status in ('open','in_progress','mitigated','accepted_risk','closed')),
  launch_impact text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.final_production_readiness_scores (
  id uuid primary key default gen_random_uuid(),
  snapshot_key text not null unique,
  qa_score integer not null default 0 check (qa_score between 0 and 100),
  database_integrity_score integer not null default 0 check (database_integrity_score between 0 and 100),
  provider_activation_score integer not null default 0 check (provider_activation_score between 0 and 100),
  camera_readiness_score integer not null default 0 check (camera_readiness_score between 0 and 100),
  ai_readiness_score integer not null default 0 check (ai_readiness_score between 0 and 100),
  legal_review_score integer not null default 0 check (legal_review_score between 0 and 100),
  security_review_score integer not null default 0 check (security_review_score between 0 and 100),
  mobile_readiness_score integer not null default 0 check (mobile_readiness_score between 0 and 100),
  support_readiness_score integer not null default 0 check (support_readiness_score between 0 and 100),
  commercial_readiness_score integer not null default 0 check (commercial_readiness_score between 0 and 100),
  external_validation_score integer not null default 0 check (external_validation_score between 0 and 100),
  gan_batuach_score integer not null default 0 check (gan_batuach_score between 0 and 100),
  digital_observer_score integer not null default 0 check (digital_observer_score between 0 and 100),
  company_readiness_score integer not null default 0 check (company_readiness_score between 0 and 100),
  launch_recommendation text not null default 'not_ready' check (launch_recommendation in ('not_ready','pilot_only','soft_launch_ready','commercial_launch_ready','production_launched')),
  blockers jsonb not null default '[]'::jsonb,
  calculated_at timestamptz not null default now()
);

create table if not exists public.final_go_live_decisions (
  id uuid primary key default gen_random_uuid(),
  decision_key text not null unique,
  decision text not null check (decision in ('do_not_launch','launch_pilot_only','launch_soft_commercial','launch_gan_batuach_only','launch_digital_observer_beta_only','launch_both','pause_launch')),
  decision_reason text not null,
  approver uuid references public.profiles(id) on delete set null,
  approver_name text,
  blockers_reviewed boolean not null default false,
  accepted_risks_reviewed boolean not null default false,
  audited_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.company_customer_lifecycle (
  id uuid primary key default gen_random_uuid(),
  lifecycle_key text not null unique,
  product_type text not null check (product_type in ('gan_batuach','digital_observer')),
  customer_name text not null,
  lifecycle_stage text not null check (lifecycle_stage in ('lead','demo','onboarding','active','at_risk','renewal','suspended','churned')),
  owner text,
  health_score integer not null default 0 check (health_score between 0 and 100),
  revenue_readiness text,
  next_action text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_releases (
  id uuid primary key default gen_random_uuid(),
  release_key text not null unique,
  release_name text not null,
  release_type text not null check (release_type in ('bugfix','security','ux_improvement','provider_update','mobile_update','ai_calibration','camera_improvement','compliance_update','feature_release')),
  status text not null default 'planned' check (status in ('planned','in_progress','qa','approved','released','rolled_back')),
  planned_date date,
  released_at timestamptz,
  owner text,
  release_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_roadmap_items (
  id uuid primary key default gen_random_uuid(),
  roadmap_key text not null unique,
  category text not null check (category in ('gan_batuach','digital_observer','shared_core','security','compliance','mobile','ai','cameras','billing','ux','customer_success')),
  priority text not null check (priority in ('critical','high','medium','low')),
  status text not null default 'backlog' check (status in ('backlog','planned','in_progress','qa','released','deferred','cancelled')),
  title text not null,
  description text,
  source text,
  target_release text,
  owner text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_feedback_loop (
  id uuid primary key default gen_random_uuid(),
  feedback_key text not null unique,
  product_type text not null check (product_type in ('gan_batuach','digital_observer','shared')),
  feedback_source text not null check (feedback_source in ('manager','parent','staff','inspector','support','sales','digital_observer_customer')),
  feedback_type text not null,
  feedback_summary text not null,
  status text not null default 'new' check (status in ('new','triaged','roadmap_linked','planned','implemented','released','customer_updated','closed')),
  roadmap_item_key text references public.product_roadmap_items(roadmap_key) on delete set null,
  release_key text references public.product_releases(release_key) on delete set null,
  owner text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.production_incident_response (
  id uuid primary key default gen_random_uuid(),
  incident_key text not null unique,
  incident_category text not null check (incident_category in ('security','privacy','payment','provider','camera','ai','app_outage','data_issue','support_escalation')),
  severity text not null check (severity in ('critical','high','medium','low')),
  status text not null default 'detected' check (status in ('detected','assigned','mitigating','customer_comm_required','resolved','postmortem','preventive_action','closed')),
  title text not null,
  owner text,
  mitigation text,
  customer_communication_required boolean not null default false,
  postmortem_required boolean not null default true,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.post_launch_monitoring (
  id uuid primary key default gen_random_uuid(),
  monitor_key text not null unique,
  monitor_area text not null check (monitor_area in ('uptime','errors','failed_jobs','provider_failures','payment_failures','notification_failures','login_failures','app_crashes_readiness','slow_routes','database_issues','support_spikes')),
  status text not null default 'watching' check (status in ('healthy','degraded','failed','disabled','watching')),
  metric_value numeric(12,2),
  threshold_value numeric(12,2),
  owner text,
  next_action text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.launch_communication_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null unique,
  audience text not null check (audience in ('customers','parents','staff','inspectors','internal_team','support_team','external_partners')),
  template_type text not null check (template_type in ('launch_announcement','maintenance_notice','incident_notice','new_feature_notice','security_update','mobile_app_release')),
  status text not null default 'draft' check (status in ('draft','ready_for_review','approved','sent','archived')),
  subject text not null,
  body text not null,
  owner text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'final_launch_status',
    'final_launch_checklists',
    'final_launch_blockers',
    'final_production_risks',
    'final_production_readiness_scores',
    'final_go_live_decisions',
    'company_customer_lifecycle',
    'product_releases',
    'product_roadmap_items',
    'customer_feedback_loop',
    'production_incident_response',
    'post_launch_monitoring',
    'launch_communication_templates'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists "%s admin manage" on public.%I', table_name, table_name);
    execute format('create policy "%s admin manage" on public.%I for all using (public.is_admin()) with check (public.is_admin())', table_name, table_name);
  end loop;
end $$;

insert into public.final_launch_status (product_type, status, launch_owner, readiness_score, blockers, final_decision, notes)
values
  ('gan_batuach', 'external_review_required', 'operations', 78, '["External legal/privacy approval required","Final provider activation approval required","Critical PT findings must be closed"]'::jsonb, 'launch_pilot_only', 'Gan Batuach remains gated by external validation and human go/no-go approval.'),
  ('digital_observer', 'commercial_ready', 'product', 72, '["Live payment mode disabled by default","Domain separation remains manual","Restricted AI capabilities require approval"]'::jsonb, 'launch_digital_observer_beta_only', 'Digital Observer is ready for controlled beta/soft commercial launch, not unrestricted public scale.')
on conflict (product_type) do update set
  status = excluded.status,
  launch_owner = excluded.launch_owner,
  readiness_score = excluded.readiness_score,
  blockers = excluded.blockers,
  final_decision = excluded.final_decision,
  notes = excluded.notes,
  updated_at = now();

insert into public.final_launch_checklists (checklist_key, product_type, checklist_area, checklist_item, status, critical, evidence_reference, owner, notes)
values
  ('gb-public-website', 'gan_batuach', 'public_website', 'Public website, kindergarten registration, parent demand and demo funnels are reviewed before launch.', 'ready', true, '/dashboard/admin/growth', 'growth', 'Website and lead funnels remain monitored.'),
  ('gb-onboarding', 'gan_batuach', 'onboarding', 'Manager, staff, parent and inspector onboarding flows are ready for controlled launch.', 'ready', true, '/dashboard/admin/kindergarten-activation', 'operations', 'Activation should stay cohort-based.'),
  ('gb-payments-invoices', 'gan_batuach', 'payments', 'Gan Batuach subscription, parent-to-kindergarten payments and invoices are separated.', 'in_progress', true, '/dashboard/admin/provider-production', 'finance', 'Live mode requires provider approval.'),
  ('gb-cameras-ai', 'gan_batuach', 'cameras_ai', 'Camera readiness and AI observer shadow mode are enforced with no raw AI parent visibility.', 'in_progress', true, '/dashboard/admin/camera-compliance', 'safety', 'External camera and AI review still required.'),
  ('gb-external-review', 'gan_batuach', 'external_validation', 'Legal, privacy, PT, ISO and provider external review blockers are tracked.', 'blocked', true, '/dashboard/admin/external-validation', 'security', 'Cannot claim approval before external evidence.'),
  ('do-public-website', 'digital_observer', 'public_site', 'Digital Observer public website, use-case pages, demo funnel and start monitoring flow are ready.', 'ready', true, '/digital-observer', 'growth', 'Messaging must avoid unsupported safety claims.'),
  ('do-dashboard-onboarding', 'digital_observer', 'product_journey', 'Standalone dashboard, site onboarding, package selection and trial flow are ready.', 'ready', true, '/digital-observer/dashboard', 'product', 'No kindergarten terminology in Digital Observer shell.'),
  ('do-billing-separation', 'digital_observer', 'billing', 'Digital Observer billing is separate from Gan Batuach and parent tuition payments.', 'in_progress', true, '/digital-observer/billing', 'finance', 'Live payments remain env-gated.'),
  ('do-camera-alerts', 'digital_observer', 'camera_alerts', 'Camera setup, generic observer alerts and capability guardrails are launch-reviewed.', 'in_progress', true, '/dashboard/admin/digital-observer-launch', 'product', 'Restricted capabilities require explicit approval.'),
  ('company-support', 'company', 'support', 'Support operations, incident response, provider health and customer success loops are operational.', 'ready', true, '/dashboard/admin/company-operations', 'support', 'Move from phase work into monthly operations.')
on conflict (checklist_key) do update set
  product_type = excluded.product_type,
  checklist_area = excluded.checklist_area,
  checklist_item = excluded.checklist_item,
  status = excluded.status,
  critical = excluded.critical,
  evidence_reference = excluded.evidence_reference,
  owner = excluded.owner,
  notes = excluded.notes,
  updated_at = now();

insert into public.final_launch_blockers (blocker_key, product_type, severity, status, title, description, owner, launch_impact, mitigation, evidence_reference)
values
  ('critical-external-validation-open', 'company', 'critical', 'open', 'External validation not fully approved', 'Legal/privacy/security/ISO/app-store external processes still require human/external evidence.', 'executive', 'Blocks unrestricted production launch.', 'Complete external review workflow and close critical findings.', '/dashboard/admin/external-validation'),
  ('live-provider-approval-required', 'company', 'high', 'open', 'Live providers require final approval', 'Email, SMS, WhatsApp, payments, invoices, camera gateway and AI providers must pass production tests before broad launch.', 'operations', 'Blocks mass sending and live billing.', 'Run controlled provider tests and record owner approval.', '/dashboard/admin/provider-production'),
  ('mobile-store-manual-submission', 'gan_batuach', 'medium', 'open', 'Mobile store submission remains manual', 'App Store and Google Play uploads require developer accounts, signing assets and human approval.', 'mobile', 'Does not block web launch but blocks official app release.', 'Complete store package and submit manually when approved.', '/dashboard/admin/mobile-submission'),
  ('digital-observer-domain-separation', 'digital_observer', 'medium', 'open', 'Standalone domain requires manual setup', 'Digital Observer custom domain and production routing are prepared but not externally configured.', 'platform', 'Soft launch can use current route; standalone launch waits for DNS/Vercel work.', 'Configure domain, env flags and rollback plan.', '/dashboard/admin/digital-observer-production-setup')
on conflict (blocker_key) do update set
  product_type = excluded.product_type,
  severity = excluded.severity,
  status = excluded.status,
  title = excluded.title,
  description = excluded.description,
  owner = excluded.owner,
  launch_impact = excluded.launch_impact,
  mitigation = excluded.mitigation,
  evidence_reference = excluded.evidence_reference,
  updated_at = now();

insert into public.final_production_risks (risk_key, category, product_type, risk, severity, mitigation, owner, status, launch_impact)
values
  ('risk-privacy-external-approval', 'privacy', 'gan_batuach', 'Privacy lawyer rejects or conditions child/camera/medical-data flows.', 'critical', 'Keep launch gated until external privacy approval is recorded.', 'legal', 'open', 'Blocks launch.'),
  ('risk-provider-misconfiguration', 'technical', 'company', 'Production provider credentials or webhooks are incomplete.', 'high', 'Use env flags, test center, rollback controls and provider health monitoring.', 'platform', 'in_progress', 'Blocks broad sending/live billing.'),
  ('risk-support-scale', 'support', 'company', 'Support load grows faster than staffing after launch.', 'medium', 'Track SLA breaches, repeated issues and hiring triggers in company operations.', 'support', 'open', 'May limit commercial scale.'),
  ('risk-ai-overclaim', 'ai', 'company', 'Marketing or product copy overstates AI certainty or safety guarantees.', 'high', 'Keep claim guardrails and human review requirements active.', 'product', 'in_progress', 'Blocks unrestricted AI launch.'),
  ('risk-mobile-rejection', 'mobile', 'gan_batuach', 'Store review rejects privacy labels, permissions or reviewer access.', 'medium', 'Use submission checklist, synthetic demo accounts and rejection workflow.', 'mobile', 'open', 'Blocks mobile app release.')
on conflict (risk_key) do update set
  category = excluded.category,
  product_type = excluded.product_type,
  risk = excluded.risk,
  severity = excluded.severity,
  mitigation = excluded.mitigation,
  owner = excluded.owner,
  status = excluded.status,
  launch_impact = excluded.launch_impact,
  updated_at = now();

insert into public.final_production_readiness_scores (
  snapshot_key,
  qa_score,
  database_integrity_score,
  provider_activation_score,
  camera_readiness_score,
  ai_readiness_score,
  legal_review_score,
  security_review_score,
  mobile_readiness_score,
  support_readiness_score,
  commercial_readiness_score,
  external_validation_score,
  gan_batuach_score,
  digital_observer_score,
  company_readiness_score,
  launch_recommendation,
  blockers
)
values (
  'phase-190-final-baseline',
  78,
  82,
  70,
  72,
  68,
  55,
  64,
  66,
  80,
  78,
  58,
  74,
  72,
  71,
  'pilot_only',
  '["External legal/privacy/security validation is still required","Live provider activation must be approved","No public launch without human go/no-go"]'::jsonb
)
on conflict (snapshot_key) do update set
  qa_score = excluded.qa_score,
  database_integrity_score = excluded.database_integrity_score,
  provider_activation_score = excluded.provider_activation_score,
  camera_readiness_score = excluded.camera_readiness_score,
  ai_readiness_score = excluded.ai_readiness_score,
  legal_review_score = excluded.legal_review_score,
  security_review_score = excluded.security_review_score,
  mobile_readiness_score = excluded.mobile_readiness_score,
  support_readiness_score = excluded.support_readiness_score,
  commercial_readiness_score = excluded.commercial_readiness_score,
  external_validation_score = excluded.external_validation_score,
  gan_batuach_score = excluded.gan_batuach_score,
  digital_observer_score = excluded.digital_observer_score,
  company_readiness_score = excluded.company_readiness_score,
  launch_recommendation = excluded.launch_recommendation,
  blockers = excluded.blockers,
  calculated_at = now();

insert into public.final_go_live_decisions (decision_key, decision, decision_reason, approver_name, blockers_reviewed, accepted_risks_reviewed)
values
  ('phase-190-baseline-decision', 'do_not_launch', 'Baseline decision keeps public launch paused until external approvals, provider production tests and human go/no-go are complete.', 'pending executive approval', false, false)
on conflict (decision_key) do update set
  decision = excluded.decision,
  decision_reason = excluded.decision_reason,
  approver_name = excluded.approver_name,
  blockers_reviewed = excluded.blockers_reviewed,
  accepted_risks_reviewed = excluded.accepted_risks_reviewed,
  audited_at = now();

insert into public.company_customer_lifecycle (lifecycle_key, product_type, customer_name, lifecycle_stage, owner, health_score, revenue_readiness, next_action, notes)
values
  ('gb-scale-program', 'gan_batuach', 'Gan Batuach scale cohort', 'onboarding', 'customer_success', 76, 'subscription readiness', 'Continue controlled cohort onboarding.', 'Use support, inspector and parent activation dashboards.'),
  ('do-paid-beta-program', 'digital_observer', 'Digital Observer paid beta cohort', 'demo', 'product', 70, 'sandbox/live gated', 'Convert qualified beta leads into observer sites.', 'Keep billing separated from Gan Batuach.')
on conflict (lifecycle_key) do update set
  product_type = excluded.product_type,
  customer_name = excluded.customer_name,
  lifecycle_stage = excluded.lifecycle_stage,
  owner = excluded.owner,
  health_score = excluded.health_score,
  revenue_readiness = excluded.revenue_readiness,
  next_action = excluded.next_action,
  notes = excluded.notes,
  updated_at = now();

insert into public.product_releases (release_key, release_name, release_type, status, planned_date, owner, release_notes)
values
  ('monthly-ops-2026-07', 'July monthly operations release', 'bugfix', 'planned', '2026-07-15', 'product', 'First monthly release after numbered roadmap phase completion.'),
  ('security-patch-cycle-2026-07', 'July security patch cycle', 'security', 'planned', '2026-07-08', 'security', 'Dependency, PT remediation and audit-log review cycle.'),
  ('mobile-release-cycle-2026-07', 'July mobile release cycle', 'mobile_update', 'planned', '2026-07-22', 'mobile', 'App Store and Google Play controlled submission follow-up.'),
  ('ai-calibration-cycle-2026-07', 'July AI calibration cycle', 'ai_calibration', 'planned', '2026-07-29', 'safety', 'Shadow mode review, false positive review and capability guardrails.')
on conflict (release_key) do update set
  release_name = excluded.release_name,
  release_type = excluded.release_type,
  status = excluded.status,
  planned_date = excluded.planned_date,
  owner = excluded.owner,
  release_notes = excluded.release_notes,
  updated_at = now();

insert into public.product_roadmap_items (roadmap_key, category, priority, status, title, description, source, target_release, owner)
values
  ('roadmap-provider-final-tests', 'security', 'critical', 'planned', 'Complete production provider test matrix', 'Run safe internal tests for communications, payments, invoices, gateway, AI and webhooks.', 'phase_187', 'security-patch-cycle-2026-07', 'platform'),
  ('roadmap-external-validation-closeout', 'compliance', 'critical', 'planned', 'Close external validation launch blockers', 'Collect legal/privacy/PT/ISO/app-store/payment evidence and close critical blockers.', 'phase_189', 'security-patch-cycle-2026-07', 'executive'),
  ('roadmap-customer-feedback-cycle', 'customer_success', 'high', 'planned', 'Create monthly customer feedback review', 'Convert manager, parent, staff, inspector and Digital Observer feedback into release planning.', 'phase_190', 'monthly-ops-2026-07', 'customer_success'),
  ('roadmap-do-domain-followup', 'digital_observer', 'medium', 'backlog', 'Prepare Digital Observer custom domain activation', 'Finish DNS/Vercel/domain rollback checklist when business approval is ready.', 'phase_183', 'monthly-ops-2026-07', 'platform')
on conflict (roadmap_key) do update set
  category = excluded.category,
  priority = excluded.priority,
  status = excluded.status,
  title = excluded.title,
  description = excluded.description,
  source = excluded.source,
  target_release = excluded.target_release,
  owner = excluded.owner,
  updated_at = now();

insert into public.customer_feedback_loop (feedback_key, product_type, feedback_source, feedback_type, feedback_summary, status, roadmap_item_key, release_key, owner)
values
  ('feedback-manager-onboarding-monthly', 'gan_batuach', 'manager', 'onboarding', 'Managers need fast follow-up on incomplete onboarding and payment setup.', 'triaged', 'roadmap-customer-feedback-cycle', 'monthly-ops-2026-07', 'customer_success'),
  ('feedback-parent-activation-monthly', 'gan_batuach', 'parent', 'activation', 'Parent activation and notification opt-in remain core scale indicators.', 'triaged', 'roadmap-customer-feedback-cycle', 'monthly-ops-2026-07', 'customer_success'),
  ('feedback-do-camera-setup-monthly', 'digital_observer', 'digital_observer_customer', 'camera_setup', 'Digital Observer customers need clearer camera setup and gateway support.', 'triaged', 'roadmap-customer-feedback-cycle', 'monthly-ops-2026-07', 'support')
on conflict (feedback_key) do update set
  product_type = excluded.product_type,
  feedback_source = excluded.feedback_source,
  feedback_type = excluded.feedback_type,
  feedback_summary = excluded.feedback_summary,
  status = excluded.status,
  roadmap_item_key = excluded.roadmap_item_key,
  release_key = excluded.release_key,
  owner = excluded.owner,
  updated_at = now();

insert into public.production_incident_response (incident_key, incident_category, severity, status, title, owner, mitigation, customer_communication_required, postmortem_required)
values
  ('incident-runbook-provider-failure', 'provider', 'high', 'assigned', 'Provider failure response runbook', 'platform', 'Switch to fallback/rollback mode and notify support leadership.', true, true),
  ('incident-runbook-privacy-security', 'privacy', 'critical', 'assigned', 'Privacy or security incident response runbook', 'security', 'Contain access, preserve audit evidence, notify required owners and prepare legal review.', true, true),
  ('incident-runbook-payment-duplicate', 'payment', 'critical', 'assigned', 'Duplicate payment prevention runbook', 'finance', 'Pause retry jobs, verify idempotency, reconcile provider state and communicate if needed.', true, true)
on conflict (incident_key) do update set
  incident_category = excluded.incident_category,
  severity = excluded.severity,
  status = excluded.status,
  title = excluded.title,
  owner = excluded.owner,
  mitigation = excluded.mitigation,
  customer_communication_required = excluded.customer_communication_required,
  postmortem_required = excluded.postmortem_required,
  updated_at = now();

insert into public.post_launch_monitoring (monitor_key, monitor_area, status, metric_value, threshold_value, owner, next_action)
values
  ('monitor-uptime', 'uptime', 'watching', 0, 99.5, 'platform', 'Connect real uptime provider before broad launch.'),
  ('monitor-provider-failures', 'provider_failures', 'watching', 0, 1, 'platform', 'Review provider-production dashboard daily during launch.'),
  ('monitor-payment-failures', 'payment_failures', 'watching', 0, 1, 'finance', 'Keep live charging disabled until provider approval.'),
  ('monitor-support-spikes', 'support_spikes', 'watching', 0, 10, 'support', 'Review daily support volume during launch cohorts.'),
  ('monitor-app-crashes', 'app_crashes_readiness', 'watching', 0, 1, 'mobile', 'Activate crash diagnostics provider after approval.')
on conflict (monitor_key) do update set
  monitor_area = excluded.monitor_area,
  status = excluded.status,
  metric_value = excluded.metric_value,
  threshold_value = excluded.threshold_value,
  owner = excluded.owner,
  next_action = excluded.next_action,
  updated_at = now();

insert into public.launch_communication_templates (template_key, audience, template_type, status, subject, body, owner)
values
  ('template-customer-launch-announcement', 'customers', 'launch_announcement', 'ready_for_review', 'Gan Batuach launch update', 'We are opening controlled access with support, privacy and safety guardrails. Public activation requires final approval.', 'growth'),
  ('template-parent-security-update', 'parents', 'security_update', 'draft', 'Privacy and safety update', 'Your child data remains protected by role-based access, audit logs and approved kindergarten workflows.', 'privacy'),
  ('template-support-incident-notice', 'support_team', 'incident_notice', 'ready_for_review', 'Incident response notice', 'Use the incident response workflow, assign severity and preserve evidence before customer communication.', 'support'),
  ('template-mobile-release', 'customers', 'mobile_app_release', 'draft', 'Mobile app release update', 'The mobile app release is prepared for store review and will be announced after approval.', 'mobile')
on conflict (template_key) do update set
  audience = excluded.audience,
  template_type = excluded.template_type,
  status = excluded.status,
  subject = excluded.subject,
  body = excluded.body,
  owner = excluded.owner,
  updated_at = now();

insert into public.launch_blockers (blocker_key, blocker_type, title, severity, status, resolution, metadata)
values
  ('phase-190-external-validation-required', 'legal', 'External legal/security validation required before public launch', 'critical', 'open', 'Complete Phase 189 external validation workflow and record approvals before public launch.', '{"phase":"190","source":"final_production_launch"}'::jsonb),
  ('phase-190-provider-production-approval', 'operations', 'Production providers require final owner approval', 'high', 'open', 'Complete provider test center and rollback controls before broad sending/live billing.', '{"phase":"190","source":"final_production_launch"}'::jsonb),
  ('phase-190-mobile-store-manual-submit', 'operations', 'Mobile store submission remains a manual external step', 'medium', 'open', 'Developer accounts, signing assets and store review submission remain manual.', '{"phase":"190","source":"final_production_launch"}'::jsonb)
on conflict (blocker_key) do update set
  blocker_type = excluded.blocker_type,
  title = excluded.title,
  severity = excluded.severity,
  status = excluded.status,
  resolution = excluded.resolution,
  metadata = excluded.metadata,
  updated_at = now();

comment on table public.final_launch_status is 'PHASE 190: Separate final go-live status for Gan Batuach and Digital Observer. Does not imply public launch.';
comment on table public.final_go_live_decisions is 'PHASE 190: Audited go/no-go decisions. Public launch requires human approval.';
comment on table public.product_releases is 'PHASE 190: Monthly release operating model after numbered roadmap phases end.';
comment on table public.customer_feedback_loop is 'PHASE 190: Customer feedback to roadmap to release workflow.';

notify pgrst, 'reload schema';
