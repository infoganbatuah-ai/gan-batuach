-- PHASE 104: external security audit and hardening program.
-- Audit-grade tracking only. Does not weaken permissions or remove functionality.

alter table public.security_findings
  add column if not exists assigned_to uuid references public.profiles(id) on delete set null,
  add column if not exists fixed_at timestamptz,
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references public.profiles(id) on delete set null,
  add column if not exists verification_status text not null default 'not_verified',
  add column if not exists external_audit_status text not null default 'discovered',
  add column if not exists evidence_summary text,
  add column if not exists tester_notes text;

do $$
begin
  alter table public.security_findings
    add constraint security_findings_verification_status_check
    check (verification_status in ('not_verified','verified','failed','accepted_risk'));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.security_findings
    add constraint security_findings_external_audit_status_check
    check (external_audit_status in ('discovered','assigned','fixed','verified','accepted_risk'));
exception
  when duplicate_object then null;
end $$;

create table if not exists public.external_security_audit_reviews (
  id uuid primary key default gen_random_uuid(),
  audit_key text not null unique,
  category text not null,
  title text not null,
  status text not null default 'needs_review',
  severity text not null default 'medium',
  readiness_score integer not null default 0,
  evidence_summary text,
  recommended_action text,
  last_reviewed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_security_audit_category_check check (category in ('authentication','authorization','rls','api','camera','observer','communications','secrets','audit_logging','backup_recovery','compliance','penetration_testing')),
  constraint external_security_audit_status_check check (status in ('ready','partial','needs_review','blocked','resolved')),
  constraint external_security_audit_severity_check check (severity in ('critical','high','medium','low')),
  constraint external_security_audit_score_check check (readiness_score between 0 and 100)
);

create table if not exists public.rls_audit_report (
  id uuid primary key default gen_random_uuid(),
  report_key text not null unique,
  table_name text not null,
  rls_status text not null default 'needs_review',
  policy_count integer not null default 0,
  scope_status text not null default 'needs_review',
  risk_level text not null default 'medium',
  reviewed_roles text[] not null default '{}'::text[],
  evidence_summary text,
  recommended_action text,
  metadata jsonb not null default '{}'::jsonb,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rls_audit_status_check check (rls_status in ('enabled','disabled','needs_review','not_applicable')),
  constraint rls_audit_scope_status_check check (scope_status in ('scoped','admin_only','public_insert_only','needs_review','blocked')),
  constraint rls_audit_risk_level_check check (risk_level in ('critical','high','medium','low'))
);

create table if not exists public.api_security_audit_report (
  id uuid primary key default gen_random_uuid(),
  route_key text not null unique,
  route_path text not null,
  method_scope text not null default 'mixed',
  auth_status text not null default 'needs_review',
  authorization_status text not null default 'needs_review',
  validation_status text not null default 'needs_review',
  client_role_trust_status text not null default 'not_trusted',
  secrets_exposure_status text not null default 'not_exposed',
  risk_level text not null default 'medium',
  evidence_summary text,
  recommended_action text,
  metadata jsonb not null default '{}'::jsonb,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint api_security_auth_status_check check (auth_status in ('required','public_safe','webhook_secret','needs_review','blocked')),
  constraint api_security_authorization_status_check check (authorization_status in ('role_checked','scope_checked','admin_only','public_safe','needs_review','blocked')),
  constraint api_security_validation_status_check check (validation_status in ('zod','server_validated','needs_review','blocked')),
  constraint api_security_client_role_trust_check check (client_role_trust_status in ('not_trusted','needs_review','blocked')),
  constraint api_security_secrets_exposure_check check (secrets_exposure_status in ('not_exposed','redacted','needs_review','blocked')),
  constraint api_security_risk_level_check check (risk_level in ('critical','high','medium','low'))
);

create table if not exists public.penetration_test_checklist (
  id uuid primary key default gen_random_uuid(),
  checklist_key text not null unique,
  test_area text not null,
  title text not null,
  severity text not null default 'medium',
  status text not null default 'not_started',
  instructions text,
  expected_result text,
  evidence_required text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint penetration_test_area_check check (test_area in ('auth','api','permissions','rls','camera','observer','storage','communications','secrets','backup')),
  constraint penetration_test_severity_check check (severity in ('critical','high','medium','low')),
  constraint penetration_test_status_check check (status in ('not_started','in_progress','passed','failed','blocked','accepted_risk'))
);

create table if not exists public.security_recovery_procedures (
  id uuid primary key default gen_random_uuid(),
  procedure_key text not null unique,
  recovery_area text not null,
  title text not null,
  status text not null default 'draft',
  owner_role text not null default 'admin',
  recovery_steps jsonb not null default '[]'::jsonb,
  last_tested_at timestamptz,
  next_test_due_at timestamptz,
  evidence_summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint security_recovery_area_check check (recovery_area in ('database','storage','auth','secrets','communications','video_gateway','observer','full_platform')),
  constraint security_recovery_status_check check (status in ('draft','ready','tested','needs_review','blocked'))
);

create index if not exists external_security_audit_category_idx on public.external_security_audit_reviews(category, status, severity);
create index if not exists rls_audit_report_table_idx on public.rls_audit_report(table_name, risk_level);
create index if not exists api_security_audit_route_idx on public.api_security_audit_report(risk_level, auth_status, authorization_status);
create index if not exists penetration_test_checklist_area_idx on public.penetration_test_checklist(test_area, status, severity);
create index if not exists security_recovery_procedures_area_idx on public.security_recovery_procedures(recovery_area, status);
create index if not exists security_findings_external_status_idx on public.security_findings(external_audit_status, verification_status, severity);

alter table public.external_security_audit_reviews enable row level security;
alter table public.rls_audit_report enable row level security;
alter table public.api_security_audit_report enable row level security;
alter table public.penetration_test_checklist enable row level security;
alter table public.security_recovery_procedures enable row level security;

drop policy if exists "external security audit reviews admin only" on public.external_security_audit_reviews;
create policy "external security audit reviews admin only" on public.external_security_audit_reviews
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "rls audit report admin only" on public.rls_audit_report;
create policy "rls audit report admin only" on public.rls_audit_report
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "api security audit report admin only" on public.api_security_audit_report;
create policy "api security audit report admin only" on public.api_security_audit_report
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "penetration test checklist admin only" on public.penetration_test_checklist;
create policy "penetration test checklist admin only" on public.penetration_test_checklist
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "security recovery procedures admin only" on public.security_recovery_procedures;
create policy "security recovery procedures admin only" on public.security_recovery_procedures
for all using (public.is_admin())
with check (public.is_admin());

insert into public.external_security_audit_reviews (audit_key, category, title, status, severity, readiness_score, evidence_summary, recommended_action, metadata)
values
  ('auth-login-session-reset', 'authentication', 'Login, reset and session handling', 'partial', 'high', 72, 'Dashboard and API code use Supabase session helpers. Password reset and activation need external smoke tests.', 'Run login/reset/session-expiration tests for every role before real deployment.', '{"reviewed":["login","password_reset","session","account_activation"]}'::jsonb),
  ('authorization-role-isolation', 'authorization', 'Role isolation and least privilege', 'partial', 'critical', 70, 'Route guards and RLS helpers exist for admin, owner, manager, parent, staff, inspector and observer owners.', 'Run direct-route and API access tests with every role and cross-garden IDs.', '{"roles":["admin","owner","manager","parent","staff","inspector","observer_site_owner"]}'::jsonb),
  ('rls-cross-scope', 'rls', 'RLS cross-scope protection', 'partial', 'critical', 68, 'Core tables use RLS and scoped helper functions. Full schema-wide policy review remains required.', 'External tester should attempt cross-garden, cross-parent, document and camera access.', '{}'::jsonb),
  ('api-route-hardening', 'api', 'API route hardening', 'partial', 'critical', 74, 'Most API routes use requireRole and server-side checks. ID ownership tests remain required.', 'Audit all routes that accept garden_id, child_id, camera_id or user_id from the client.', '{}'::jsonb),
  ('camera-secret-playback', 'camera', 'Camera privacy and playback security', 'partial', 'critical', 78, 'Camera pages query safe columns. RTSP and passwords are handled server-side and playback tokens are required.', 'Verify no RTSP/credentials appear in browser payloads during real gateway tests.', '{}'::jsonb),
  ('observer-human-review', 'observer', 'Observer safety and human validation', 'ready', 'high', 86, 'Observer calibration keeps no autonomous actions, no accusations and human review required.', 'Keep legal/privacy review before pilot activation.', '{}'::jsonb),
  ('communications-delivery-security', 'communications', 'Communication provider security', 'partial', 'high', 70, 'Provider readiness exists and mock mode is default. Logs track delivery without requiring production sends.', 'Verify no temporary passwords or provider secrets are stored in production logs.', '{}'::jsonb),
  ('secrets-management', 'secrets', 'Secrets management', 'blocked', 'critical', 45, 'Local .env contains real-looking server secrets. Values are not printed here.', 'Rotate local service/gateway/provider secrets before customer deployment and move secrets to managed hosting vault.', '{"local_env_secret_seen":true,"secret_values_stored":false}'::jsonb),
  ('audit-log-coverage', 'audit_logging', 'Audit logging coverage', 'partial', 'high', 66, 'Audit tables and catalog exist. Some required events are still marked unimplemented.', 'Add audit writes for role changes, camera playback, observer settings and security actions.', '{}'::jsonb),
  ('backup-recovery-readiness', 'backup_recovery', 'Backup and recovery readiness', 'partial', 'high', 58, 'Backup and DR checklists exist but restore tests are not yet validated.', 'Run database, storage, auth and full-platform recovery dry runs.', '{}'::jsonb),
  ('privacy-compliance-readiness', 'compliance', 'Privacy, minors and camera compliance', 'partial', 'critical', 62, 'Privacy/compliance readiness is tracked; legal review is still required.', 'Finalize privacy policy, terms, camera consent, retention and child-data protection review.', '{}'::jsonb),
  ('external-pentest-plan', 'penetration_testing', 'External penetration testing plan', 'partial', 'high', 65, 'Checklist is generated for external testers.', 'Schedule external tester and require evidence for all critical/high tests.', '{}'::jsonb)
on conflict (audit_key) do update set
  category = excluded.category,
  title = excluded.title,
  status = excluded.status,
  severity = excluded.severity,
  readiness_score = excluded.readiness_score,
  evidence_summary = excluded.evidence_summary,
  recommended_action = excluded.recommended_action,
  metadata = public.external_security_audit_reviews.metadata || excluded.metadata,
  updated_at = now();

insert into public.security_findings (finding_key, title, severity, status, category, affected_area, impact, remediation, external_audit_status, verification_status, evidence_summary, metadata)
values
  ('rotate-local-env-secrets-before-pilot', 'Rotate secrets found in local environment file', 'critical', 'open', 'secrets', '.env.local / hosting secrets', 'Real-looking local service credentials increase blast radius if copied or shared.', 'Rotate Supabase service role and provider/gateway secrets before customer deployment. Store only in managed hosting/provider vaults.', 'discovered', 'not_verified', 'Local secret values were detected but not printed or stored in this finding.', '{"secret_values_logged":false,"customer_data_assumed":true}'::jsonb),
  ('temporary-password-visibility-review', 'Review temporary password visibility in manager/admin UI', 'high', 'open', 'authentication', 'Credential delivery and onboarding', 'Temporary passwords may be visible to privileged users for delivery; production should shorten exposure and force reset.', 'Ensure temp passwords are one-time, expire quickly, are redacted from production logs, and are hidden after first delivery/reset.', 'discovered', 'not_verified', 'Temporary credential surfaces exist for provisioning workflows.', '{}'::jsonb),
  ('full-api-id-ownership-test-required', 'Complete API ID ownership testing', 'high', 'open', 'api', 'API routes accepting IDs', 'Routes with client-provided IDs can create cross-scope risk if ownership checks are incomplete.', 'Run automated and manual tests for garden_id, child_id, camera_id, document_id and user_id ownership.', 'discovered', 'not_verified', '149 API route files detected; most use role guards, but external ID-scope testing remains required.', '{"api_route_count":149}'::jsonb),
  ('backup-restore-dry-run-required', 'Backup restore dry run required before pilot', 'high', 'open', 'backup_recovery', 'Supabase database, auth and storage', 'Backups are not production-ready until restore is proven.', 'Run database, auth and storage restore dry runs and record evidence.', 'discovered', 'not_verified', 'Existing backup checks are partial/pending.', '{}'::jsonb),
  ('legal-camera-minor-data-review-required', 'Legal review required for camera and child data protection', 'critical', 'open', 'compliance', 'Privacy, camera, child data', 'Real kindergartens require formal privacy, consent, retention and camera policy review.', 'Complete legal/privacy review before onboarding real families or cameras.', 'discovered', 'not_verified', 'Compliance readiness exists but remains partial.', '{}'::jsonb)
on conflict (finding_key) do update set
  title = excluded.title,
  severity = excluded.severity,
  status = excluded.status,
  category = excluded.category,
  affected_area = excluded.affected_area,
  impact = excluded.impact,
  remediation = excluded.remediation,
  external_audit_status = excluded.external_audit_status,
  verification_status = excluded.verification_status,
  evidence_summary = excluded.evidence_summary,
  metadata = public.security_findings.metadata || excluded.metadata,
  updated_at = now();

insert into public.rls_audit_report (report_key, table_name, rls_status, policy_count, scope_status, risk_level, reviewed_roles, evidence_summary, recommended_action, metadata)
values
  ('rls-profiles', 'profiles', 'enabled', 2, 'scoped', 'medium', array['admin','self'], 'Profiles are self-read/admin-managed in base policies.', 'Verify no role switch endpoint can mutate role without admin.', '{}'::jsonb),
  ('rls-gardens', 'gardens', 'enabled', 3, 'scoped', 'high', array['admin','owner','manager','parent','inspector'], 'Garden access relies on can_access_garden/current_garden_id.', 'Test cross-garden URL and API attempts.', '{}'::jsonb),
  ('rls-children', 'children', 'enabled', 3, 'scoped', 'critical', array['admin','owner','manager','staff','parent','inspector'], 'Children are garden-scoped through RLS.', 'Run parent-only child access tests for unrelated child IDs.', '{}'::jsonb),
  ('rls-documents', 'documents', 'enabled', 2, 'scoped', 'critical', array['admin','owner','manager','parent','staff'], 'Documents are scoped by garden_id and can include null garden documents.', 'Review null-garden document behavior before production.', '{}'::jsonb),
  ('rls-camera-streams', 'camera_streams', 'enabled', 2, 'scoped', 'critical', array['admin','owner','manager','parent','inspector'], 'Camera streams are scoped; browser-facing pages use safe columns.', 'Verify parent cannot access unauthorized camera stream records.', '{}'::jsonb),
  ('rls-parent-camera-permissions', 'parent_camera_permissions', 'enabled', 2, 'scoped', 'critical', array['admin','owner','manager','parent'], 'Parent camera permissions are garden scoped.', 'Test parent playback with denied and expired permissions.', '{}'::jsonb),
  ('rls-observer-sites', 'observer_sites', 'enabled', 2, 'scoped', 'high', array['admin','observer_site_owner'], 'Observer site membership read policy exists.', 'Verify standalone observer owner cannot access Gan Batuach garden data.', '{}'::jsonb),
  ('rls-communication-logs', 'communication_logs', 'enabled', 3, 'scoped', 'high', array['admin','owner','manager'], 'Communication logs scoped to profile/garden/admin.', 'Verify recipients cannot read unrelated delivery logs.', '{}'::jsonb),
  ('rls-audit-logs', 'audit_logs', 'enabled', 2, 'admin_only', 'high', array['admin'], 'Audit log select is admin-only; inserts allowed for authenticated actor/admin.', 'Ensure client cannot forge actor_id for privileged audit entries.', '{}'::jsonb)
on conflict (report_key) do update set
  table_name = excluded.table_name,
  rls_status = excluded.rls_status,
  policy_count = excluded.policy_count,
  scope_status = excluded.scope_status,
  risk_level = excluded.risk_level,
  reviewed_roles = excluded.reviewed_roles,
  evidence_summary = excluded.evidence_summary,
  recommended_action = excluded.recommended_action,
  metadata = public.rls_audit_report.metadata || excluded.metadata,
  updated_at = now();

insert into public.api_security_audit_report (route_key, route_path, method_scope, auth_status, authorization_status, validation_status, client_role_trust_status, secrets_exposure_status, risk_level, evidence_summary, recommended_action, metadata)
values
  ('api-admin-prefix', '/api/admin/*', 'mixed', 'required', 'admin_only', 'server_validated', 'not_trusted', 'not_exposed', 'high', 'Admin routes generally require admin role.', 'External tester should attempt all admin APIs as parent/staff/manager.', '{}'::jsonb),
  ('api-camera-streams', '/api/camera-streams/*', 'mixed', 'required', 'scope_checked', 'zod', 'not_trusted', 'redacted', 'critical', 'Camera routes use role guards and remove raw secrets from responses.', 'Verify RTSP, usernames, passwords and gateway secrets never appear in browser payloads.', '{}'::jsonb),
  ('api-parent-prefix', '/api/parent/*', 'mixed', 'required', 'scope_checked', 'server_validated', 'not_trusted', 'not_exposed', 'critical', 'Parent APIs require parent role and should scope to profile/children.', 'Attempt cross-parent child_id and garden_id access.', '{}'::jsonb),
  ('api-garden-prefix', '/api/garden/*', 'mixed', 'required', 'scope_checked', 'server_validated', 'not_trusted', 'not_exposed', 'critical', 'Garden APIs require manager/owner/staff where relevant.', 'Attempt cross-garden writes using another garden_id.', '{}'::jsonb),
  ('api-observer-prefix', '/api/observer-*', 'mixed', 'required', 'scope_checked', 'server_validated', 'not_trusted', 'not_exposed', 'high', 'Observer routes require admin/manager/owner in current implementation.', 'Verify no parent raw observer access and no automatic accusation path.', '{}'::jsonb),
  ('api-video-gateway-webhooks', '/api/video-gateway/*', 'mixed', 'webhook_secret', 'scope_checked', 'server_validated', 'not_trusted', 'not_exposed', 'critical', 'Gateway health route checks signing secret where applicable.', 'Test missing/invalid gateway secret and ensure rejection.', '{}'::jsonb),
  ('api-public-validation', '/api/public/*', 'mixed', 'public_safe', 'public_safe', 'server_validated', 'not_trusted', 'not_exposed', 'medium', 'Public validation routes are intended for safe pre-auth flows.', 'Rate-limit and verify no private data leaks.', '{}'::jsonb),
  ('api-cron', '/api/cron/*', 'mixed', 'needs_review', 'needs_review', 'server_validated', 'not_trusted', 'not_exposed', 'high', 'Cron routes need deployment secret verification before production.', 'Require CRON_SECRET or hosting scheduler protection.', '{}'::jsonb)
on conflict (route_key) do update set
  route_path = excluded.route_path,
  method_scope = excluded.method_scope,
  auth_status = excluded.auth_status,
  authorization_status = excluded.authorization_status,
  validation_status = excluded.validation_status,
  client_role_trust_status = excluded.client_role_trust_status,
  secrets_exposure_status = excluded.secrets_exposure_status,
  risk_level = excluded.risk_level,
  evidence_summary = excluded.evidence_summary,
  recommended_action = excluded.recommended_action,
  metadata = public.api_security_audit_report.metadata || excluded.metadata,
  updated_at = now();

insert into public.penetration_test_checklist (checklist_key, test_area, title, severity, status, instructions, expected_result, evidence_required, metadata)
values
  ('auth-password-reset-session', 'auth', 'Password reset and session expiration tests', 'high', 'not_started', 'Test reset links, expired sessions, logout and protected-route redirects.', 'No stale session can access protected pages.', 'Screenshots and HTTP traces.', '{}'::jsonb),
  ('auth-role-escalation', 'auth', 'Role escalation attempts', 'critical', 'not_started', 'Attempt to edit role, garden_id, owner_id or profile role client-side and via API.', 'Server ignores client role and blocks escalation.', 'Request/response samples.', '{}'::jsonb),
  ('permission-cross-garden', 'permissions', 'Cross-garden access attempts', 'critical', 'not_started', 'Use manager/staff tokens from one garden against another garden_id.', 'All access denied.', 'Route/API matrix.', '{}'::jsonb),
  ('permission-cross-parent', 'permissions', 'Cross-parent child data attempts', 'critical', 'not_started', 'Use parent token against unrelated child_id, document_id, pickup and camera permissions.', 'All access denied.', 'Route/API matrix.', '{}'::jsonb),
  ('rls-direct-supabase', 'rls', 'Direct Supabase RLS tests', 'critical', 'not_started', 'Call Supabase tables directly with each role token.', 'RLS returns only scoped rows.', 'SQL/API evidence.', '{}'::jsonb),
  ('api-mass-assignment', 'api', 'API mass assignment and ID ownership', 'high', 'not_started', 'Send extra role/garden/user fields in request bodies.', 'Server validates and ignores unsafe fields.', 'Payload corpus.', '{}'::jsonb),
  ('camera-secret-exposure', 'camera', 'Camera secret exposure tests', 'critical', 'not_started', 'Inspect camera pages/API payloads for RTSP, username, password, gateway keys.', 'No secrets exposed.', 'Browser network capture.', '{}'::jsonb),
  ('camera-playback-permission', 'camera', 'Playback permission tests', 'critical', 'not_started', 'Attempt playback without permission, expired token and wrong role.', 'Playback denied and audited.', 'Token/API evidence.', '{}'::jsonb),
  ('observer-raw-access', 'observer', 'Observer raw event access tests', 'high', 'not_started', 'Attempt parent/staff access to raw observer events, summaries and replay.', 'Unauthorized access denied.', 'Route/API evidence.', '{}'::jsonb),
  ('observer-autonomous-actions', 'observer', 'Observer autonomous action guardrail tests', 'critical', 'not_started', 'Try to trigger accusation, discipline, parent contact or authority contact from observer output.', 'No autonomous path exists.', 'Workflow evidence.', '{}'::jsonb),
  ('storage-private-buckets', 'storage', 'Private storage access tests', 'critical', 'not_started', 'Attempt unauthorized document/photo access and signed URL replay.', 'Unauthorized access denied.', 'Storage request evidence.', '{}'::jsonb),
  ('communications-secret-logs', 'communications', 'Communication logs and provider secret tests', 'high', 'not_started', 'Inspect delivery logs and test sends for provider tokens/password leakage.', 'No secrets or production temp passwords in logs.', 'Log samples with redaction.', '{}'::jsonb),
  ('secrets-client-bundle', 'secrets', 'Client bundle secret scan', 'critical', 'not_started', 'Scan built client bundles for service role, gateway, communication and AI secrets.', 'No server-only secret appears in client bundle.', 'Scan output.', '{}'::jsonb),
  ('backup-restore', 'backup', 'Backup and restore drill', 'high', 'not_started', 'Restore database/storage/auth configuration in test environment.', 'Recovery meets RPO/RTO targets.', 'Runbook and restore evidence.', '{}'::jsonb)
on conflict (checklist_key) do update set
  test_area = excluded.test_area,
  title = excluded.title,
  severity = excluded.severity,
  status = excluded.status,
  instructions = excluded.instructions,
  expected_result = excluded.expected_result,
  evidence_required = excluded.evidence_required,
  metadata = public.penetration_test_checklist.metadata || excluded.metadata,
  updated_at = now();

insert into public.security_recovery_procedures (procedure_key, recovery_area, title, status, recovery_steps, evidence_summary, metadata)
values
  ('database-restore-runbook', 'database', 'Restore Supabase database', 'needs_review', '["Export latest backup metadata","Create isolated restore project","Restore backup","Run migrations","Validate admin/manager/parent queries"]'::jsonb, 'Restore procedure exists as checklist; dry run still required.', '{}'::jsonb),
  ('storage-restore-runbook', 'storage', 'Restore Supabase storage', 'needs_review', '["Export private buckets","Restore into isolated bucket","Validate signed URL policies","Verify document access by role"]'::jsonb, 'Storage restore dry run still required.', '{}'::jsonb),
  ('auth-recovery-runbook', 'auth', 'Recover authentication configuration', 'needs_review', '["Verify redirect URLs","Verify admin recovery account","Recreate provider config","Test login/reset/logout"]'::jsonb, 'Auth restore dry run still required.', '{}'::jsonb),
  ('secret-rotation-runbook', 'secrets', 'Rotate production secrets', 'needs_review', '["Rotate Supabase service role","Rotate gateway secret","Rotate communication provider keys","Redeploy","Run smoke tests"]'::jsonb, 'Required before customer deployment because local env contains real-looking secrets.', '{}'::jsonb),
  ('full-platform-recovery-runbook', 'full_platform', 'Full platform recovery', 'draft', '["Restore DB","Restore storage","Restore auth config","Restore env vars","Verify dashboards","Verify APIs","Verify camera/observer mock mode"]'::jsonb, 'Full recovery exercise not yet complete.', '{}'::jsonb)
on conflict (procedure_key) do update set
  recovery_area = excluded.recovery_area,
  title = excluded.title,
  status = excluded.status,
  recovery_steps = excluded.recovery_steps,
  evidence_summary = excluded.evidence_summary,
  metadata = public.security_recovery_procedures.metadata || excluded.metadata,
  updated_at = now();

comment on table public.external_security_audit_reviews is 'Admin-only external-audit readiness checks across auth, authorization, RLS, APIs, cameras, observer, communications, secrets, recovery and compliance.';
comment on table public.rls_audit_report is 'Admin-only RLS audit report for external security review.';
comment on table public.api_security_audit_report is 'Admin-only API route security audit report.';
comment on table public.penetration_test_checklist is 'Admin-only penetration testing checklist for future external tester.';
comment on table public.security_recovery_procedures is 'Admin-only recovery procedure register for security and disaster recovery.';
comment on column public.security_findings.evidence_summary is 'Finding evidence summary only. Do not store passwords, tokens, keys, RTSP URLs or raw secrets.';

notify pgrst, 'reload schema';
