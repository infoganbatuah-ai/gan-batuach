create table if not exists public.security_readiness_checks (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  check_key text not null unique,
  title text not null,
  status text not null default 'pending',
  severity text not null default 'medium',
  owner_role text not null default 'admin',
  evidence_summary text,
  recommended_action text,
  last_checked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint security_readiness_category_check check (category in ('authentication','authorization','rls','api_protection','secrets','audit_logging','backup','disaster_recovery','rate_limiting','monitoring','compliance')),
  constraint security_readiness_status_check check (status in ('ready','partial','pending','blocked','needs_review')),
  constraint security_readiness_severity_check check (severity in ('critical','high','medium','low'))
);

create table if not exists public.security_findings (
  id uuid primary key default gen_random_uuid(),
  finding_key text not null unique,
  title text not null,
  severity text not null,
  status text not null default 'open',
  category text not null,
  affected_area text,
  impact text,
  remediation text,
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  owner_profile_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint security_findings_severity_check check (severity in ('critical','high','medium','low')),
  constraint security_findings_status_check check (status in ('open','in_progress','resolved','accepted_risk','false_positive'))
);

create table if not exists public.security_secret_inventory (
  id uuid primary key default gen_random_uuid(),
  secret_key text not null unique,
  secret_type text not null,
  location text not null,
  required boolean not null default false,
  server_only boolean not null default true,
  rotation_status text not null default 'unknown',
  last_rotated_at timestamptz,
  next_rotation_due_at timestamptz,
  readiness_status text not null default 'pending',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint security_secret_type_check check (secret_type in ('api_key','gateway_secret','environment_variable','encryption_key','webhook_secret','service_role','provider_token')),
  constraint security_secret_rotation_check check (rotation_status in ('current','due','overdue','unknown','not_applicable')),
  constraint security_secret_readiness_check check (readiness_status in ('ready','partial','pending','blocked','not_required'))
);

create table if not exists public.backup_readiness_checks (
  id uuid primary key default gen_random_uuid(),
  backup_key text not null unique,
  backup_type text not null,
  status text not null default 'pending',
  last_backup_at timestamptz,
  last_restore_test_at timestamptz,
  retention_days integer,
  recovery_point_objective_minutes integer,
  recovery_time_objective_minutes integer,
  storage_location text,
  validation_status text not null default 'not_tested',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint backup_readiness_type_check check (backup_type in ('database','file_storage','recordings','configuration','secrets')),
  constraint backup_readiness_status_check check (status in ('ready','partial','pending','blocked','not_required')),
  constraint backup_readiness_validation_check check (validation_status in ('passed','failed','not_tested','scheduled'))
);

create table if not exists public.disaster_recovery_checkpoints (
  id uuid primary key default gen_random_uuid(),
  checkpoint_key text not null unique,
  title text not null,
  status text not null default 'pending',
  recovery_area text not null,
  procedure_url text,
  last_validated_at timestamptz,
  next_validation_due_at timestamptz,
  validation_notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint disaster_recovery_status_check check (status in ('ready','partial','pending','blocked','needs_review')),
  constraint disaster_recovery_area_check check (recovery_area in ('database','storage','auth','video_gateway','communications','mobile','observer','full_platform'))
);

create table if not exists public.security_monitoring_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  severity text not null default 'medium',
  status text not null default 'open',
  profile_id uuid references public.profiles(id) on delete set null,
  garden_id uuid references public.gardens(id) on delete set null,
  source text,
  ip inet,
  user_agent text,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  constraint security_monitoring_event_type_check check (event_type in ('login','failed_login','suspicious_login','permission_change','camera_change','observer_change','user_management','subscription_change','api_rate_limit','unusual_activity','admin_alert')),
  constraint security_monitoring_severity_check check (severity in ('critical','high','medium','low')),
  constraint security_monitoring_status_check check (status in ('open','reviewing','resolved','false_positive'))
);

create table if not exists public.audit_event_catalog (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  category text not null,
  title text not null,
  required boolean not null default true,
  implemented boolean not null default false,
  source_table text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_security_readiness_category on public.security_readiness_checks(category, status, severity);
create index if not exists idx_security_findings_status on public.security_findings(status, severity, detected_at desc);
create index if not exists idx_security_secret_inventory_status on public.security_secret_inventory(readiness_status, rotation_status);
create index if not exists idx_backup_readiness_status on public.backup_readiness_checks(status, backup_type);
create index if not exists idx_disaster_recovery_status on public.disaster_recovery_checkpoints(status, recovery_area);
create index if not exists idx_security_monitoring_events_type on public.security_monitoring_events(event_type, status, created_at desc);
create index if not exists idx_security_monitoring_events_profile on public.security_monitoring_events(profile_id, created_at desc);
create index if not exists idx_audit_event_catalog_category on public.audit_event_catalog(category, implemented);

alter table public.security_readiness_checks enable row level security;
alter table public.security_findings enable row level security;
alter table public.security_secret_inventory enable row level security;
alter table public.backup_readiness_checks enable row level security;
alter table public.disaster_recovery_checkpoints enable row level security;
alter table public.security_monitoring_events enable row level security;
alter table public.audit_event_catalog enable row level security;

drop policy if exists "security readiness admin only" on public.security_readiness_checks;
create policy "security readiness admin only" on public.security_readiness_checks
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "security findings admin only" on public.security_findings;
create policy "security findings admin only" on public.security_findings
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "security secret inventory admin only" on public.security_secret_inventory;
create policy "security secret inventory admin only" on public.security_secret_inventory
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "backup readiness admin only" on public.backup_readiness_checks;
create policy "backup readiness admin only" on public.backup_readiness_checks
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "disaster recovery admin only" on public.disaster_recovery_checkpoints;
create policy "disaster recovery admin only" on public.disaster_recovery_checkpoints
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "security monitoring admin only" on public.security_monitoring_events;
create policy "security monitoring admin only" on public.security_monitoring_events
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "audit event catalog admin only" on public.audit_event_catalog;
create policy "audit event catalog admin only" on public.audit_event_catalog
for all using (public.is_admin()) with check (public.is_admin());

insert into public.security_readiness_checks (category, check_key, title, status, severity, evidence_summary, recommended_action, metadata)
values
  ('authentication', 'auth-session-consistency', 'Authentication session consistency', 'partial', 'high', 'Supabase SSR auth helper is used by dashboard routes.', 'Keep login/logout/password reset smoke tests in every deployment.', '{"routes":["/login","/auth/callback","/dashboard"]}'::jsonb),
  ('authorization', 'role-based-access-control', 'Role based access control', 'partial', 'critical', 'Dashboard route guards and RLS helper functions exist.', 'Run direct URL access tests for every role before pilot.', '{"roles":["admin","manager","owner","staff","inspector","parent"]}'::jsonb),
  ('rls', 'rls-coverage', 'RLS coverage tracking', 'partial', 'critical', 'Core new readiness tables are RLS protected.', 'Continue schema-wide RLS audit before enterprise launch.', '{}'::jsonb),
  ('api_protection', 'api-auth-ownership-checks', 'API authentication and ownership checks', 'partial', 'critical', 'Most operational APIs use role/session helpers.', 'Track endpoints that accept IDs from clients and verify ownership server-side.', '{}'::jsonb),
  ('secrets', 'secrets-server-only', 'Secrets server-only handling', 'partial', 'critical', 'Env example separates public and server-only values.', 'Verify no service role key or provider token is exposed to client bundles.', '{}'::jsonb),
  ('audit_logging', 'audit-event-coverage', 'Audit logging coverage', 'partial', 'high', 'audit_logs exists and provisioning writes audit records.', 'Expand audit writes for login, permission, camera, observer, user and subscription changes.', '{}'::jsonb),
  ('backup', 'backup-readiness', 'Backup readiness', 'pending', 'high', 'Backup documentation exists; operational checks need validation.', 'Schedule database/storage restore test before production pilot.', '{}'::jsonb),
  ('disaster_recovery', 'dr-runbook-validation', 'Disaster recovery validation', 'pending', 'high', 'Recovery documentation exists; validation checkpoints are now tracked.', 'Run a dry recovery exercise with Supabase and storage.', '{}'::jsonb),
  ('rate_limiting', 'rate-limit-coverage', 'Rate limiting coverage', 'partial', 'high', 'rate_limit_events table and helper exist.', 'Apply rate limiting to login, observer, notification and upload endpoints.', '{}'::jsonb),
  ('monitoring', 'security-monitoring-events', 'Security monitoring events', 'partial', 'medium', 'Security monitoring event table added.', 'Wire failed login and suspicious admin actions into monitoring events.', '{}'::jsonb),
  ('compliance', 'privacy-consent-retention', 'Privacy, consent and retention readiness', 'partial', 'high', 'Policies and consent foundations exist.', 'Validate retention, consent and audit evidence for minors before enterprise rollout.', '{}'::jsonb)
on conflict (check_key) do update set category = excluded.category, title = excluded.title, status = excluded.status, severity = excluded.severity, evidence_summary = excluded.evidence_summary, recommended_action = excluded.recommended_action, metadata = excluded.metadata, updated_at = now();

insert into public.security_secret_inventory (secret_key, secret_type, location, required, server_only, rotation_status, readiness_status, notes, metadata)
values
  ('NEXT_PUBLIC_SUPABASE_URL', 'environment_variable', '.env / hosting env', true, false, 'not_applicable', 'ready', 'Public project URL, no secret value.', '{}'::jsonb),
  ('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'environment_variable', '.env / hosting env', true, false, 'not_applicable', 'ready', 'Publishable Supabase key only.', '{}'::jsonb),
  ('SUPABASE_SERVICE_ROLE_KEY', 'service_role', 'server env only', true, true, 'unknown', 'pending', 'Must never be bundled or exposed to browser.', '{}'::jsonb),
  ('VIDEO_GATEWAY_API_KEY', 'gateway_secret', 'server env only', false, true, 'unknown', 'partial', 'Required only when real gateway is enabled.', '{}'::jsonb),
  ('VIDEO_GATEWAY_SIGNING_SECRET', 'gateway_secret', 'server env only', false, true, 'unknown', 'partial', 'Protects gateway callbacks and health checks.', '{}'::jsonb),
  ('WHATSAPP_ACCESS_TOKEN', 'provider_token', 'server env only', false, true, 'unknown', 'partial', 'Real send remains disabled unless explicitly configured.', '{}'::jsonb),
  ('SMS_API_KEY', 'api_key', 'server env only', false, true, 'unknown', 'partial', 'Real SMS remains disabled unless explicitly configured.', '{}'::jsonb),
  ('EMAIL_API_KEY', 'api_key', 'server env only', false, true, 'unknown', 'partial', 'Real email remains disabled unless explicitly configured.', '{}'::jsonb),
  ('FCM_SERVER_KEY', 'api_key', 'server env only', false, true, 'unknown', 'partial', 'Real push remains disabled unless explicitly configured.', '{}'::jsonb),
  ('LOCAL_VISION_ENDPOINT', 'environment_variable', 'server env only', false, true, 'not_applicable', 'partial', 'Local AI endpoint only; no external child video by default.', '{}'::jsonb)
on conflict (secret_key) do update set secret_type = excluded.secret_type, location = excluded.location, required = excluded.required, server_only = excluded.server_only, rotation_status = excluded.rotation_status, readiness_status = excluded.readiness_status, notes = excluded.notes, metadata = excluded.metadata, updated_at = now();

insert into public.backup_readiness_checks (backup_key, backup_type, status, retention_days, recovery_point_objective_minutes, recovery_time_objective_minutes, validation_status, notes, metadata)
values
  ('supabase-database-backup', 'database', 'partial', 30, 1440, 240, 'not_tested', 'Supabase backup strategy documented; restore test required.', '{}'::jsonb),
  ('supabase-storage-backup', 'file_storage', 'partial', 30, 1440, 240, 'not_tested', 'Private storage buckets need backup/export validation.', '{}'::jsonb),
  ('camera-recording-backup', 'recordings', 'not_required', null, null, null, 'not_tested', 'Recording is readiness-only; enable when real recording exists.', '{}'::jsonb),
  ('configuration-backup', 'configuration', 'pending', 30, 1440, 240, 'not_tested', 'Env and deployment configuration checklist required.', '{}'::jsonb),
  ('secrets-recovery', 'secrets', 'pending', null, 1440, 240, 'not_tested', 'Secrets should be recoverable through secure provider vault, not stored in repo.', '{}'::jsonb)
on conflict (backup_key) do update set backup_type = excluded.backup_type, status = excluded.status, retention_days = excluded.retention_days, recovery_point_objective_minutes = excluded.recovery_point_objective_minutes, recovery_time_objective_minutes = excluded.recovery_time_objective_minutes, validation_status = excluded.validation_status, notes = excluded.notes, metadata = excluded.metadata, updated_at = now();

insert into public.disaster_recovery_checkpoints (checkpoint_key, title, status, recovery_area, procedure_url, validation_notes, metadata)
values
  ('restore-database', 'Restore database from backup', 'pending', 'database', 'BACKUP_AND_RESTORE.md', 'Needs dry-run restore validation.', '{}'::jsonb),
  ('restore-storage', 'Restore private storage buckets', 'pending', 'storage', 'BACKUP_AND_RESTORE.md', 'Needs bucket export/import validation.', '{}'::jsonb),
  ('recover-auth', 'Recover authentication configuration', 'partial', 'auth', 'DEPLOYMENT_CHECKLIST.md', 'Verify redirect URLs and admin recovery account.', '{}'::jsonb),
  ('recover-video-gateway', 'Recover video gateway service', 'partial', 'video_gateway', 'VIDEO_GATEWAY_DEPLOYMENT_GUIDE.md', 'Gateway is readiness-only until deployed.', '{}'::jsonb),
  ('recover-communications', 'Recover communications providers', 'partial', 'communications', 'WHATSAPP_PRODUCTION_READINESS.md', 'Mock mode is safe; real provider recovery needs runbook.', '{}'::jsonb),
  ('recover-observer', 'Recover Digital Observer worker', 'partial', 'observer', 'AI_OBSERVER_WORKER_ARCHITECTURE.md', 'Worker is mock/readiness only.', '{}'::jsonb),
  ('full-platform-dr', 'Full platform recovery exercise', 'pending', 'full_platform', 'SECURITY_HARDENING_AND_ENTERPRISE_READINESS.md', 'Run before enterprise launch.', '{}'::jsonb)
on conflict (checkpoint_key) do update set title = excluded.title, status = excluded.status, recovery_area = excluded.recovery_area, procedure_url = excluded.procedure_url, validation_notes = excluded.validation_notes, metadata = excluded.metadata, updated_at = now();

insert into public.audit_event_catalog (event_key, category, title, required, implemented, source_table, notes, metadata)
values
  ('login-success', 'authentication', 'Login success', true, false, 'security_monitoring_events', 'Ready to track login events.', '{}'::jsonb),
  ('login-failed', 'authentication', 'Failed login', true, false, 'security_monitoring_events', 'Ready to track failed login events.', '{}'::jsonb),
  ('permission-change', 'authorization', 'Permission or role changed', true, false, 'audit_logs', 'Should be written whenever role/profile access changes.', '{}'::jsonb),
  ('camera-change', 'camera', 'Camera configuration changed', true, false, 'audit_logs', 'Should be written when camera credentials/status/settings change.', '{}'::jsonb),
  ('observer-change', 'observer', 'Observer configuration changed', true, false, 'audit_logs', 'Should be written for AI/observer rules, zones and watch requests.', '{}'::jsonb),
  ('user-management', 'users', 'User created or updated', true, true, 'audit_logs', 'Provisioning writes user creation audit events.', '{}'::jsonb),
  ('subscription-change', 'billing', 'Subscription changed', true, false, 'audit_logs', 'Should be written for plan/status/payment state changes.', '{}'::jsonb)
on conflict (event_key) do update set category = excluded.category, title = excluded.title, required = excluded.required, implemented = excluded.implemented, source_table = excluded.source_table, notes = excluded.notes, metadata = excluded.metadata, updated_at = now();

comment on table public.security_readiness_checks is 'Admin-only security readiness framework for auth, RLS, API protection, secrets, audit, backup and compliance.';
comment on table public.security_findings is 'Admin-only security findings queue. No secret values are stored.';
comment on table public.security_secret_inventory is 'Admin-only secret readiness inventory. Stores names/status only, never secret values.';
comment on table public.backup_readiness_checks is 'Admin-only backup readiness and restore validation tracking.';
comment on table public.disaster_recovery_checkpoints is 'Admin-only disaster recovery procedure and validation checkpoints.';
comment on table public.security_monitoring_events is 'Admin-only suspicious login, failed login, rate-limit and unusual activity monitoring readiness.';
comment on table public.audit_event_catalog is 'Admin-only required audit event coverage catalog for enterprise readiness.';
