-- PHASE 134: Business continuity, backup and disaster recovery platform.
-- Adds continuity command center data, restore tests, provider health,
-- operational incidents, failover guidance, offline mode readiness and audit.

alter table public.backup_readiness_checks
  drop constraint if exists backup_readiness_type_check;

alter table public.backup_readiness_checks
  add constraint backup_readiness_type_check check (backup_type in (
    'database',
    'file_storage',
    'recordings',
    'configuration',
    'secrets',
    'auth_users',
    'documents',
    'medical_records',
    'inspection_reports',
    'signatures',
    'parent_communications',
    'compliance_records',
    'observer_metadata',
    'ai_telemetry',
    'configuration_settings'
  ));

alter table public.backup_readiness_checks
  add column if not exists backup_frequency text not null default 'daily',
  add column if not exists next_backup_at timestamptz,
  add column if not exists restore_status text not null default 'not_tested',
  add column if not exists readiness_score integer not null default 0 check (readiness_score between 0 and 100),
  add column if not exists coverage_scope text,
  add column if not exists legal_hold_supported boolean not null default false,
  add column if not exists deletion_request_handling text not null default 'manual_review';

alter table public.backup_readiness_checks
  drop constraint if exists backup_readiness_frequency_check;

alter table public.backup_readiness_checks
  add constraint backup_readiness_frequency_check check (backup_frequency in ('continuous','hourly','daily','weekly','manual','not_required'));

alter table public.backup_readiness_checks
  drop constraint if exists backup_readiness_restore_status_check;

alter table public.backup_readiness_checks
  add constraint backup_readiness_restore_status_check check (restore_status in ('not_tested','scheduled','passed','failed','partial'));

create table if not exists public.restore_test_runs (
  id uuid primary key default gen_random_uuid(),
  test_key text not null unique,
  backup_check_id uuid references public.backup_readiness_checks(id) on delete set null,
  test_type text not null,
  target_system text not null,
  status text not null default 'scheduled',
  started_at timestamptz,
  completed_at timestamptz,
  duration_minutes integer,
  rto_target_minutes integer,
  rpo_target_minutes integer,
  rto_met boolean,
  rpo_met boolean,
  evidence_url text,
  result_summary text,
  next_test_due_at timestamptz,
  executed_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restore_test_type_check check (test_type in ('database_restore','storage_restore','document_restore','user_restore','inspection_restore','full_platform_restore')),
  constraint restore_test_status_check check (status in ('scheduled','running','passed','failed','partial','cancelled'))
);

create table if not exists public.disaster_recovery_plans (
  id uuid primary key default gen_random_uuid(),
  plan_key text not null unique,
  incident_type text not null,
  title text not null,
  status text not null default 'draft',
  owner_role text not null default 'admin',
  rto_minutes integer,
  rpo_minutes integer,
  detection_signals jsonb not null default '[]'::jsonb,
  recovery_steps jsonb not null default '[]'::jsonb,
  failover_strategy jsonb not null default '{}'::jsonb,
  communication_plan jsonb not null default '{}'::jsonb,
  last_tested_at timestamptz,
  next_test_due_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint disaster_plan_type_check check (incident_type in ('database_outage','storage_outage','auth_outage','supabase_outage','vercel_outage','camera_outage','observer_outage','email_outage','sms_outage','whatsapp_outage','payment_outage')),
  constraint disaster_plan_status_check check (status in ('draft','ready','tested','needs_review','blocked'))
);

create table if not exists public.provider_health_checks (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null unique,
  provider_name text not null,
  provider_type text not null,
  status text not null default 'healthy',
  last_checked_at timestamptz,
  latency_ms integer,
  failure_count integer not null default 0,
  last_failure_at timestamptz,
  fallback_provider_key text,
  recovery_recommendation text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_health_type_check check (provider_type in ('supabase','vercel','email','sms','whatsapp','push','camera_gateway','observer','payment','ai')),
  constraint provider_health_status_check check (status in ('healthy','degraded','failed'))
);

create table if not exists public.operational_incidents (
  id uuid primary key default gen_random_uuid(),
  incident_key text not null unique,
  title text not null,
  severity text not null default 'medium',
  status text not null default 'open',
  impact_summary text,
  affected_systems text[] not null default '{}',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  root_cause text,
  mitigation text,
  postmortem text,
  assigned_to uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint operational_incident_severity_check check (severity in ('low','medium','high','critical')),
  constraint operational_incident_status_check check (status in ('open','investigating','mitigating','resolved','postmortem','closed'))
);

create table if not exists public.recovery_recommendations (
  id uuid primary key default gen_random_uuid(),
  recommendation_key text not null unique,
  source_type text not null,
  source_id uuid,
  severity text not null default 'medium',
  status text not null default 'open',
  title text not null,
  recommendation text not null,
  suggested_owner_role text not null default 'admin',
  due_at timestamptz,
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recovery_recommendation_source_check check (source_type in ('provider_health','backup_readiness','restore_test','incident','gateway','manual')),
  constraint recovery_recommendation_severity_check check (severity in ('low','medium','high','critical')),
  constraint recovery_recommendation_status_check check (status in ('open','accepted','in_progress','resolved','dismissed'))
);

create table if not exists public.failover_rules (
  id uuid primary key default gen_random_uuid(),
  rule_key text not null unique,
  service_type text not null,
  primary_condition text not null,
  fallback_action text not null,
  status text not null default 'ready',
  automation_mode text not null default 'manual_approval',
  last_tested_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint failover_service_type_check check (service_type in ('email','sms','whatsapp','ai','camera_gateway','push','payments')),
  constraint failover_rule_status_check check (status in ('ready','needs_review','disabled','blocked')),
  constraint failover_automation_mode_check check (automation_mode in ('manual_approval','queue_only','automatic_safe_fallback'))
);

create table if not exists public.offline_operations_modes (
  id uuid primary key default gen_random_uuid(),
  mode_key text not null unique,
  role_key text not null,
  capability text not null,
  status text not null default 'prepared',
  sync_strategy text not null default 'queue_then_sync',
  max_offline_hours integer,
  conflict_policy text not null default 'manual_review',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint offline_role_check check (role_key in ('manager','inspector','staff','parent','admin')),
  constraint offline_status_check check (status in ('prepared','needs_review','tested','blocked')),
  constraint offline_sync_strategy_check check (sync_strategy in ('queue_then_sync','read_only_cache','manual_export','not_supported'))
);

create table if not exists public.business_continuity_audit_events (
  id uuid primary key default gen_random_uuid(),
  event_key text,
  event_type text not null,
  severity text not null default 'medium',
  actor_profile_id uuid references public.profiles(id) on delete set null,
  source_table text,
  source_id uuid,
  title text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint continuity_audit_type_check check (event_type in ('backup_created','backup_failed','restore_executed','restore_failed','retention_changed','provider_failed','incident_opened','incident_resolved')),
  constraint continuity_audit_severity_check check (severity in ('low','medium','high','critical'))
);

create table if not exists public.recovery_objectives (
  id uuid primary key default gen_random_uuid(),
  objective_key text not null unique,
  system_area text not null,
  rto_minutes integer not null,
  rpo_minutes integer not null,
  priority text not null default 'high',
  status text not null default 'defined',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recovery_objective_area_check check (system_area in ('database','storage','documents','inspections','compliance','observer','auth','communications','camera_gateway','configuration')),
  constraint recovery_objective_priority_check check (priority in ('low','medium','high','critical')),
  constraint recovery_objective_status_check check (status in ('defined','tested','needs_review','blocked'))
);

create table if not exists public.retention_alignment_checks (
  id uuid primary key default gen_random_uuid(),
  check_key text not null unique,
  data_domain text not null,
  retention_policy_status text not null default 'needs_review',
  deletion_request_supported boolean not null default false,
  legal_hold_supported boolean not null default false,
  backup_erasure_notes text,
  last_reviewed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint retention_domain_check check (data_domain in ('documents','medical_records','communications','camera_sessions','ai_events','audio_events','observer_events','audit_logs','configuration')),
  constraint retention_policy_status_check check (retention_policy_status in ('ready','needs_review','blocked','not_required'))
);

create index if not exists backup_readiness_score_idx on public.backup_readiness_checks(status, readiness_score desc);
create index if not exists restore_test_runs_status_idx on public.restore_test_runs(status, test_type, created_at desc);
create index if not exists disaster_recovery_plans_status_idx on public.disaster_recovery_plans(status, incident_type);
create index if not exists provider_health_checks_status_idx on public.provider_health_checks(status, provider_type);
create index if not exists operational_incidents_status_idx on public.operational_incidents(status, severity, started_at desc);
create index if not exists recovery_recommendations_status_idx on public.recovery_recommendations(status, severity, created_at desc);
create index if not exists continuity_audit_events_type_idx on public.business_continuity_audit_events(event_type, created_at desc);
create index if not exists recovery_objectives_area_idx on public.recovery_objectives(system_area, priority);
create index if not exists retention_alignment_domain_idx on public.retention_alignment_checks(data_domain, retention_policy_status);

alter table public.restore_test_runs enable row level security;
alter table public.disaster_recovery_plans enable row level security;
alter table public.provider_health_checks enable row level security;
alter table public.operational_incidents enable row level security;
alter table public.recovery_recommendations enable row level security;
alter table public.failover_rules enable row level security;
alter table public.offline_operations_modes enable row level security;
alter table public.business_continuity_audit_events enable row level security;
alter table public.recovery_objectives enable row level security;
alter table public.retention_alignment_checks enable row level security;

drop policy if exists "restore tests admin only" on public.restore_test_runs;
create policy "restore tests admin only" on public.restore_test_runs for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "disaster recovery plans admin only" on public.disaster_recovery_plans;
create policy "disaster recovery plans admin only" on public.disaster_recovery_plans for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "provider health admin only" on public.provider_health_checks;
create policy "provider health admin only" on public.provider_health_checks for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "operational incidents admin only" on public.operational_incidents;
create policy "operational incidents admin only" on public.operational_incidents for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "recovery recommendations admin only" on public.recovery_recommendations;
create policy "recovery recommendations admin only" on public.recovery_recommendations for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "failover rules admin only" on public.failover_rules;
create policy "failover rules admin only" on public.failover_rules for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "offline operations modes admin only" on public.offline_operations_modes;
create policy "offline operations modes admin only" on public.offline_operations_modes for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "continuity audit events admin read" on public.business_continuity_audit_events;
create policy "continuity audit events admin read" on public.business_continuity_audit_events for select using (public.is_admin());

drop policy if exists "continuity audit events append only" on public.business_continuity_audit_events;
create policy "continuity audit events append only" on public.business_continuity_audit_events for insert with check (public.is_admin());

drop policy if exists "recovery objectives admin only" on public.recovery_objectives;
create policy "recovery objectives admin only" on public.recovery_objectives for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "retention alignment admin only" on public.retention_alignment_checks;
create policy "retention alignment admin only" on public.retention_alignment_checks for all using (public.is_admin()) with check (public.is_admin());

insert into public.backup_readiness_checks (
  backup_key,
  backup_type,
  status,
  backup_frequency,
  retention_days,
  recovery_point_objective_minutes,
  recovery_time_objective_minutes,
  validation_status,
  restore_status,
  readiness_score,
  coverage_scope,
  legal_hold_supported,
  deletion_request_handling,
  notes,
  metadata
)
values
  ('supabase-database-backup', 'database', 'partial', 'daily', 30, 1440, 240, 'not_tested', 'scheduled', 58, 'Supabase database and relational data', true, 'manual_review', 'Automated backup readiness exists; restore drill required.', '{}'::jsonb),
  ('supabase-auth-users-backup', 'auth_users', 'partial', 'daily', 30, 1440, 240, 'not_tested', 'scheduled', 52, 'Auth users and auth configuration', false, 'manual_review', 'Auth export/recovery procedure needs dry run.', '{}'::jsonb),
  ('supabase-storage-buckets-backup', 'file_storage', 'partial', 'daily', 30, 1440, 240, 'not_tested', 'scheduled', 55, 'Storage buckets and signed access policies', true, 'manual_review', 'Storage restore validation required.', '{}'::jsonb),
  ('documents-backup', 'documents', 'partial', 'daily', 365, 1440, 240, 'not_tested', 'scheduled', 60, 'Documents, contracts, certificates and evidence files', true, 'manual_review', 'Document restore test required.', '{}'::jsonb),
  ('medical-records-backup', 'medical_records', 'partial', 'daily', 365, 1440, 240, 'not_tested', 'scheduled', 54, 'Child health, allergies and medication records', true, 'manual_review', 'Sensitive medical data needs legal retention review.', '{}'::jsonb),
  ('inspection-reports-backup', 'inspection_reports', 'partial', 'daily', 365, 1440, 240, 'not_tested', 'scheduled', 60, 'Inspection reports, answers, findings and signatures', true, 'manual_review', 'Inspection restore drill required.', '{}'::jsonb),
  ('signature-records-backup', 'signatures', 'partial', 'daily', 365, 1440, 240, 'not_tested', 'scheduled', 57, 'Digital signatures and GPS validation evidence', true, 'manual_review', 'Signature image storage restore needs validation.', '{}'::jsonb),
  ('parent-communications-backup', 'parent_communications', 'partial', 'daily', 180, 1440, 240, 'not_tested', 'scheduled', 53, 'Messages, notifications and delivery logs', false, 'manual_review', 'Communications retention and erasure workflow must be reviewed.', '{}'::jsonb),
  ('compliance-records-backup', 'compliance_records', 'partial', 'daily', 365, 1440, 240, 'not_tested', 'scheduled', 60, 'Compliance alerts, actions, findings and reports', true, 'manual_review', 'Compliance restore test required.', '{}'::jsonb),
  ('observer-metadata-backup', 'observer_metadata', 'partial', 'daily', 90, 1440, 240, 'not_tested', 'scheduled', 50, 'Observer sites, signals, reviews and calibration metadata', false, 'manual_review', 'Observer metadata restore needs test mode validation.', '{}'::jsonb),
  ('ai-telemetry-backup', 'ai_telemetry', 'partial', 'daily', 90, 1440, 240, 'not_tested', 'scheduled', 48, 'AI usage, shadow mode telemetry and quality metrics', false, 'manual_review', 'AI telemetry retention should be reviewed before production.', '{}'::jsonb),
  ('configuration-settings-backup', 'configuration_settings', 'pending', 'manual', 30, 1440, 240, 'not_tested', 'not_tested', 42, 'Environment, provider and operational configuration', false, 'manual_review', 'Configuration runbook required; secrets stay outside database.', '{}'::jsonb)
on conflict (backup_key)
do update set
  backup_type = excluded.backup_type,
  status = excluded.status,
  backup_frequency = excluded.backup_frequency,
  retention_days = excluded.retention_days,
  recovery_point_objective_minutes = excluded.recovery_point_objective_minutes,
  recovery_time_objective_minutes = excluded.recovery_time_objective_minutes,
  validation_status = excluded.validation_status,
  restore_status = excluded.restore_status,
  readiness_score = excluded.readiness_score,
  coverage_scope = excluded.coverage_scope,
  legal_hold_supported = excluded.legal_hold_supported,
  deletion_request_handling = excluded.deletion_request_handling,
  notes = excluded.notes,
  metadata = public.backup_readiness_checks.metadata || excluded.metadata,
  updated_at = now();

insert into public.restore_test_runs (test_key, test_type, target_system, status, rto_target_minutes, rpo_target_minutes, result_summary, next_test_due_at, metadata)
values
  ('database-restore-quarterly', 'database_restore', 'Supabase database', 'scheduled', 240, 1440, 'Create isolated restore project and verify role dashboards.', now() + interval '30 days', '{}'::jsonb),
  ('storage-restore-quarterly', 'storage_restore', 'Supabase Storage', 'scheduled', 240, 1440, 'Restore private buckets and validate signed URL policies.', now() + interval '30 days', '{}'::jsonb),
  ('document-restore-quarterly', 'document_restore', 'Documents and evidence', 'scheduled', 240, 1440, 'Restore document sample and verify scoped access.', now() + interval '30 days', '{}'::jsonb),
  ('auth-user-restore-quarterly', 'user_restore', 'Supabase Auth', 'scheduled', 240, 1440, 'Validate auth config, admin recovery and reset flow.', now() + interval '30 days', '{}'::jsonb),
  ('inspection-restore-quarterly', 'inspection_restore', 'Inspection reports', 'scheduled', 240, 1440, 'Restore inspection report, answers, signature and GPS evidence.', now() + interval '30 days', '{}'::jsonb)
on conflict (test_key)
do update set
  test_type = excluded.test_type,
  target_system = excluded.target_system,
  status = excluded.status,
  rto_target_minutes = excluded.rto_target_minutes,
  rpo_target_minutes = excluded.rpo_target_minutes,
  result_summary = excluded.result_summary,
  next_test_due_at = excluded.next_test_due_at,
  updated_at = now();

insert into public.disaster_recovery_plans (plan_key, incident_type, title, status, rto_minutes, rpo_minutes, detection_signals, recovery_steps, failover_strategy, communication_plan)
values
  ('database-outage-plan', 'database_outage', 'Database outage recovery', 'needs_review', 240, 1440, '["Supabase DB unavailable","API database errors","health check failed"]'::jsonb, '["Switch to incident mode","Pause writes if needed","Contact Supabase","Restore from latest backup if required","Validate dashboards"]'::jsonb, '{"mode":"manual","fallback":"read_only_mode"}'::jsonb, '{"notify":["admin","managers"],"channel":"email_sms"}'::jsonb),
  ('storage-outage-plan', 'storage_outage', 'Storage outage recovery', 'needs_review', 240, 1440, '["file uploads fail","signed URLs fail"]'::jsonb, '["Queue uploads","Disable noncritical downloads","Contact provider","Run storage restore test"]'::jsonb, '{"mode":"queue_uploads"}'::jsonb, '{"notify":["admin"]}'::jsonb),
  ('auth-outage-plan', 'auth_outage', 'Auth outage recovery', 'needs_review', 240, 1440, '["login fails","reset fails","session errors"]'::jsonb, '["Freeze privileged actions","Verify auth provider","Use admin recovery account","Post incident notice"]'::jsonb, '{"mode":"existing_sessions_only"}'::jsonb, '{"notify":["admin","support"]}'::jsonb),
  ('vercel-outage-plan', 'vercel_outage', 'Application hosting outage recovery', 'needs_review', 120, 1440, '["Vercel unavailable","edge errors"]'::jsonb, '["Check deployment status","Rollback deployment","Use maintenance notice","Escalate to provider"]'::jsonb, '{"mode":"rollback_deployment"}'::jsonb, '{"notify":["admin"]}'::jsonb),
  ('camera-outage-plan', 'camera_outage', 'Camera gateway outage recovery', 'needs_review', 240, 1440, '["gateway failed","streams offline"]'::jsonb, '["Switch to offline camera mode","Log access attempts","Notify managers","Reconnect gateway"]'::jsonb, '{"mode":"offline_camera_mode"}'::jsonb, '{"notify":["admin","managers"]}'::jsonb),
  ('observer-outage-plan', 'observer_outage', 'Digital Observer outage recovery', 'needs_review', 240, 1440, '["observer queue stopped","AI provider unavailable"]'::jsonb, '["Switch to manual review mode","Queue observer events","Disable autonomous processing","Resume after health check"]'::jsonb, '{"mode":"manual_review"}'::jsonb, '{"notify":["admin","inspectors"]}'::jsonb),
  ('email-outage-plan', 'email_outage', 'Email outage recovery', 'needs_review', 120, 1440, '["email delivery failed"]'::jsonb, '["Queue email","Fallback to SMS for critical notices","Retry provider"]'::jsonb, '{"fallback":"queue_then_sms"}'::jsonb, '{"notify":["admin"]}'::jsonb),
  ('sms-outage-plan', 'sms_outage', 'SMS outage recovery', 'needs_review', 120, 1440, '["SMS delivery failed"]'::jsonb, '["Queue SMS","Fallback to email/WhatsApp if allowed","Retry provider"]'::jsonb, '{"fallback":"email_or_whatsapp"}'::jsonb, '{"notify":["admin"]}'::jsonb),
  ('whatsapp-outage-plan', 'whatsapp_outage', 'WhatsApp outage recovery', 'needs_review', 120, 1440, '["WhatsApp delivery failed"]'::jsonb, '["Queue WhatsApp","Fallback to SMS if allowed","Retry provider"]'::jsonb, '{"fallback":"sms"}'::jsonb, '{"notify":["admin"]}'::jsonb),
  ('payment-outage-plan', 'payment_outage', 'Payment outage recovery', 'needs_review', 240, 1440, '["payment provider failed"]'::jsonb, '["Pause payment attempts","Show payment unavailable","Retry provider","Reconcile later"]'::jsonb, '{"mode":"defer_payments"}'::jsonb, '{"notify":["admin","managers"]}'::jsonb)
on conflict (plan_key)
do update set
  incident_type = excluded.incident_type,
  title = excluded.title,
  status = excluded.status,
  rto_minutes = excluded.rto_minutes,
  rpo_minutes = excluded.rpo_minutes,
  detection_signals = excluded.detection_signals,
  recovery_steps = excluded.recovery_steps,
  failover_strategy = excluded.failover_strategy,
  communication_plan = excluded.communication_plan,
  updated_at = now();

insert into public.provider_health_checks (provider_key, provider_name, provider_type, status, fallback_provider_key, recovery_recommendation, metadata)
values
  ('supabase', 'Supabase', 'supabase', 'healthy', null, 'Verify database, auth and storage health.', '{}'::jsonb),
  ('vercel', 'Vercel', 'vercel', 'healthy', null, 'Verify deployment and edge status.', '{}'::jsonb),
  ('resend', 'Resend', 'email', 'healthy', 'sendgrid', 'Queue messages and fallback to secondary provider when configured.', '{}'::jsonb),
  ('twilio-sms', 'Twilio SMS', 'sms', 'healthy', 'email', 'Fallback critical messages to email where allowed.', '{}'::jsonb),
  ('meta-whatsapp', 'Meta WhatsApp', 'whatsapp', 'healthy', 'sms', 'Fallback urgent messages to SMS where allowed.', '{}'::jsonb),
  ('push-provider', 'Push Provider', 'push', 'healthy', 'email', 'Fallback important notices to email.', '{}'::jsonb),
  ('camera-gateway', 'Camera Gateway', 'camera_gateway', 'degraded', null, 'Use offline camera mode until gateway health is restored.', '{}'::jsonb),
  ('observer-worker', 'Observer Services', 'observer', 'healthy', null, 'Switch to manual review mode if AI/observer is unavailable.', '{}'::jsonb),
  ('payment-provider', 'Payment Provider', 'payment', 'healthy', null, 'Defer payments and reconcile after recovery.', '{}'::jsonb)
on conflict (provider_key)
do update set
  provider_name = excluded.provider_name,
  provider_type = excluded.provider_type,
  fallback_provider_key = excluded.fallback_provider_key,
  recovery_recommendation = excluded.recovery_recommendation,
  updated_at = now();

insert into public.failover_rules (rule_key, service_type, primary_condition, fallback_action, status, automation_mode, metadata)
values
  ('email-fails-queue', 'email', 'Email provider unavailable', 'Queue messages and retry; critical messages may fall back to SMS.', 'ready', 'queue_only', '{}'::jsonb),
  ('sms-fails-email', 'sms', 'SMS provider unavailable', 'Fallback to email for allowed critical messages.', 'ready', 'manual_approval', '{}'::jsonb),
  ('whatsapp-fails-sms', 'whatsapp', 'WhatsApp provider unavailable', 'Fallback to SMS when user preference allows.', 'ready', 'manual_approval', '{}'::jsonb),
  ('ai-unavailable-manual-review', 'ai', 'AI provider unavailable', 'Switch to manual review mode and queue AI work.', 'ready', 'automatic_safe_fallback', '{}'::jsonb),
  ('camera-gateway-offline', 'camera_gateway', 'Gateway disconnected', 'Show offline camera mode and log access attempts.', 'ready', 'automatic_safe_fallback', '{}'::jsonb)
on conflict (rule_key)
do update set
  service_type = excluded.service_type,
  primary_condition = excluded.primary_condition,
  fallback_action = excluded.fallback_action,
  status = excluded.status,
  automation_mode = excluded.automation_mode,
  updated_at = now();

insert into public.offline_operations_modes (mode_key, role_key, capability, status, sync_strategy, max_offline_hours, conflict_policy, metadata)
values
  ('manager-offline-operations', 'manager', 'Continue core kindergarten operations and queue changes.', 'prepared', 'queue_then_sync', 12, 'manual_review', '{}'::jsonb),
  ('inspector-offline-inspections', 'inspector', 'Continue inspection forms, photos and signatures offline.', 'needs_review', 'queue_then_sync', 8, 'manual_review', '{}'::jsonb),
  ('staff-offline-updates', 'staff', 'Queue attendance and child updates until connection returns.', 'prepared', 'queue_then_sync', 8, 'manual_review', '{}'::jsonb),
  ('parent-read-only-mode', 'parent', 'Read latest cached child updates and safety notices.', 'prepared', 'read_only_cache', 24, 'manual_review', '{}'::jsonb),
  ('admin-manual-export', 'admin', 'Export incident state and recovery checklist manually.', 'needs_review', 'manual_export', 24, 'manual_review', '{}'::jsonb)
on conflict (mode_key)
do update set
  role_key = excluded.role_key,
  capability = excluded.capability,
  status = excluded.status,
  sync_strategy = excluded.sync_strategy,
  max_offline_hours = excluded.max_offline_hours,
  conflict_policy = excluded.conflict_policy,
  updated_at = now();

insert into public.recovery_objectives (objective_key, system_area, rto_minutes, rpo_minutes, priority, status, notes)
values
  ('database-rto-rpo', 'database', 240, 1440, 'critical', 'defined', 'Database must be restored within pilot-day operating window.'),
  ('storage-rto-rpo', 'storage', 240, 1440, 'critical', 'defined', 'Storage access for documents and evidence must be recoverable.'),
  ('documents-rto-rpo', 'documents', 240, 1440, 'critical', 'defined', 'Documents and evidence are official records.'),
  ('inspections-rto-rpo', 'inspections', 240, 1440, 'critical', 'defined', 'Inspection reports, signatures and findings require strict recovery.'),
  ('compliance-rto-rpo', 'compliance', 240, 1440, 'high', 'defined', 'Compliance records and alerts should recover within one business day.'),
  ('observer-rto-rpo', 'observer', 240, 1440, 'high', 'defined', 'Observer metadata can queue while production is in manual review mode.'),
  ('communications-rto-rpo', 'communications', 120, 1440, 'high', 'defined', 'Critical communications use fallback channels.'),
  ('camera-rto-rpo', 'camera_gateway', 240, 1440, 'high', 'defined', 'Camera outage uses offline mode and audit trail.')
on conflict (objective_key)
do update set
  system_area = excluded.system_area,
  rto_minutes = excluded.rto_minutes,
  rpo_minutes = excluded.rpo_minutes,
  priority = excluded.priority,
  status = excluded.status,
  notes = excluded.notes,
  updated_at = now();

insert into public.retention_alignment_checks (check_key, data_domain, retention_policy_status, deletion_request_supported, legal_hold_supported, backup_erasure_notes)
values
  ('documents-retention-alignment', 'documents', 'needs_review', true, true, 'Deletion requests need backup erasure review and legal hold exception handling.'),
  ('medical-retention-alignment', 'medical_records', 'needs_review', true, true, 'Medical records require legal retention guidance before automated deletion.'),
  ('communications-retention-alignment', 'communications', 'needs_review', true, false, 'Communication logs should exclude secrets and honor opt-out/deletion workflows.'),
  ('camera-session-retention-alignment', 'camera_sessions', 'needs_review', true, true, 'Playback audit is retained; raw RTSP and secrets are not stored.'),
  ('ai-events-retention-alignment', 'ai_events', 'needs_review', true, false, 'AI telemetry must avoid profiling and support erasure where legally required.'),
  ('observer-events-retention-alignment', 'observer_events', 'needs_review', true, false, 'Observer raw signals remain internal and retention-limited.'),
  ('audit-logs-retention-alignment', 'audit_logs', 'needs_review', false, true, 'Audit logs may require legal hold and cannot be blindly deleted.'),
  ('configuration-retention-alignment', 'configuration', 'needs_review', false, false, 'Secrets are outside database; config restore uses provider vault/runbook.')
on conflict (check_key)
do update set
  data_domain = excluded.data_domain,
  retention_policy_status = excluded.retention_policy_status,
  deletion_request_supported = excluded.deletion_request_supported,
  legal_hold_supported = excluded.legal_hold_supported,
  backup_erasure_notes = excluded.backup_erasure_notes,
  updated_at = now();

insert into public.recovery_recommendations (recommendation_key, source_type, severity, status, title, recommendation, suggested_owner_role, due_at, metadata)
values
  ('restore-test-required', 'restore_test', 'high', 'open', 'Restore test required', 'Run database, storage, auth, document and inspection restore tests before real pilot expansion.', 'admin', now() + interval '30 days', '{}'::jsonb),
  ('camera-gateway-degraded', 'provider_health', 'medium', 'open', 'Camera gateway needs validation', 'Validate gateway health and offline camera mode before enabling parent live viewing.', 'admin', now() + interval '14 days', '{}'::jsonb),
  ('retention-review-required', 'manual', 'high', 'open', 'Retention and deletion review required', 'Review backup retention against deletion requests, privacy rules and legal hold requirements.', 'admin', now() + interval '30 days', '{}'::jsonb)
on conflict (recommendation_key)
do update set
  source_type = excluded.source_type,
  severity = excluded.severity,
  status = excluded.status,
  title = excluded.title,
  recommendation = excluded.recommendation,
  suggested_owner_role = excluded.suggested_owner_role,
  due_at = excluded.due_at,
  updated_at = now();

comment on table public.restore_test_runs is 'Restore validation evidence for database, storage, documents, users, inspections and full platform recovery.';
comment on table public.disaster_recovery_plans is 'Disaster recovery plans for provider and platform outage scenarios.';
comment on table public.provider_health_checks is 'Operational provider health registry for Supabase, Vercel, communications, cameras, observer and payments.';
comment on table public.operational_incidents is 'Operational incident lifecycle with severity, impact, mitigation, root cause and postmortem.';
comment on table public.business_continuity_audit_events is 'Append-only business continuity audit trail for backup, restore, retention and incident events.';
