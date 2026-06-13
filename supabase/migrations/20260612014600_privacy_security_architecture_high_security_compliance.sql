-- PHASE 146: Privacy, Security Architecture & High Security Compliance Platform

alter table if exists public.security_readiness_checks
  drop constraint if exists security_readiness_category_check;

alter table if exists public.security_readiness_checks
  add constraint security_readiness_category_check
  check (category in (
    'authentication','mfa','authorization','access_control','rls','api_protection','secrets',
    'encryption','audit_logging','backup','disaster_recovery','rate_limiting','monitoring',
    'privacy','provider_security','compliance','training','session_security','device_trust'
  ));

alter table if exists public.security_monitoring_events
  drop constraint if exists security_monitoring_event_type_check;

alter table if exists public.security_monitoring_events
  add constraint security_monitoring_event_type_check
  check (event_type in (
    'login','logout','failed_login','mfa_failure','suspicious_login','permission_change',
    'permission_violation','camera_change','camera_viewing','medical_record_access',
    'observer_change','user_management','subscription_change','api_rate_limit',
    'unusual_activity','account_lockout','admin_alert','session_forced_logout',
    'new_device','suspicious_device'
  ));

alter table if exists public.audit_event_catalog
  add column if not exists data_classification text not null default 'internal';

alter table if exists public.children
  add column if not exists allergies_encrypted text,
  add column if not exists medical_notes_encrypted text,
  add column if not exists regular_medications_encrypted text,
  add column if not exists medical_encryption_status text not null default 'pending_migration',
  add column if not exists medical_encrypted_at timestamptz;

alter table if exists public.child_health_records
  add column if not exists allergies_encrypted text,
  add column if not exists sensitivities_encrypted text,
  add column if not exists regular_medications_encrypted text,
  add column if not exists medical_notes_encrypted text,
  add column if not exists encryption_status text not null default 'pending_migration',
  add column if not exists encrypted_at timestamptz;

alter table if exists public.medicine_given_logs
  add column if not exists medicine_name_encrypted text,
  add column if not exists dosage_encrypted text,
  add column if not exists notes_encrypted text,
  add column if not exists encryption_status text not null default 'pending_migration',
  add column if not exists encrypted_at timestamptz;

create table if not exists public.mfa_enrollment_status (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  role text not null,
  mfa_required boolean not null default true,
  authenticator_app_enabled boolean not null default false,
  sms_otp_enabled boolean not null default false,
  backup_codes_generated boolean not null default false,
  enrollment_status text not null default 'not_enrolled',
  last_verified_at timestamptz,
  enforcement_deadline timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(profile_id),
  constraint mfa_enrollment_role_check check (role in ('admin','owner','manager','parent','staff','inspector','network_manager')),
  constraint mfa_enrollment_status_check check (enrollment_status in ('not_enrolled','partial','enrolled','exempted','blocked'))
);

create table if not exists public.security_data_classifications (
  id uuid primary key default gen_random_uuid(),
  classification_key text not null unique,
  table_name text not null,
  field_name text,
  data_classification text not null,
  data_domain text not null,
  contains_child_data boolean not null default false,
  contains_medical_data boolean not null default false,
  encryption_required boolean not null default false,
  audit_required boolean not null default true,
  retention_policy_key text,
  access_rule_summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint data_classification_level_check check (data_classification in ('public','internal','confidential','sensitive','medical','regulated'))
);

create table if not exists public.encrypted_field_registry (
  id uuid primary key default gen_random_uuid(),
  registry_key text not null unique,
  table_name text not null,
  plaintext_field text,
  encrypted_field text not null,
  data_classification text not null,
  encryption_algorithm text not null default 'aes-256-gcm',
  encryption_status text not null default 'planned',
  key_reference text not null default 'FIELD_ENCRYPTION_KEY',
  key_rotation_status text not null default 'unknown',
  coverage_percent integer not null default 0,
  last_rotation_at timestamptz,
  next_rotation_due_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint encrypted_field_classification_check check (data_classification in ('sensitive','medical','regulated','confidential')),
  constraint encrypted_field_status_check check (encryption_status in ('planned','partial','active','blocked','not_required')),
  constraint encrypted_field_coverage_check check (coverage_percent between 0 and 100)
);

create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  severity text not null default 'medium',
  status text not null default 'open',
  profile_id uuid references public.profiles(id) on delete set null,
  role text,
  garden_id uuid references public.gardens(id) on delete set null,
  ip inet,
  user_agent text,
  device_id uuid,
  session_id uuid,
  source text,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  constraint security_events_type_check check (event_type in ('failed_login','mfa_failure','permission_violation','suspicious_access','account_lockout','new_device','suspicious_device','forced_logout','medical_record_access','camera_viewing','data_export_request','data_deletion_request')),
  constraint security_events_severity_check check (severity in ('critical','high','medium','low')),
  constraint security_events_status_check check (status in ('open','reviewing','resolved','false_positive'))
);

create table if not exists public.trusted_devices (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  device_fingerprint_hash text not null,
  device_label text,
  platform text,
  trust_status text not null default 'new',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz,
  trusted_at timestamptz,
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(profile_id, device_fingerprint_hash),
  constraint trusted_devices_status_check check (trust_status in ('new','trusted','suspicious','revoked'))
);

create table if not exists public.security_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  device_id uuid references public.trusted_devices(id) on delete set null,
  session_hash text not null unique,
  role text,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  forced_logout_at timestamptz,
  forced_logout_reason text,
  risk_level text not null default 'low',
  concurrent_session_count integer not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint security_sessions_risk_check check (risk_level in ('low','medium','high','critical'))
);

create table if not exists public.privacy_rights_requests (
  id uuid primary key default gen_random_uuid(),
  request_key text not null unique,
  requester_profile_id uuid references public.profiles(id) on delete set null,
  garden_id uuid references public.gardens(id) on delete set null,
  request_type text not null,
  data_subject_type text not null,
  data_subject_id uuid,
  status text not null default 'received',
  due_at timestamptz,
  completed_at timestamptz,
  response_summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint privacy_rights_request_type_check check (request_type in ('access','correction','deletion','export','restriction','objection')),
  constraint privacy_rights_subject_type_check check (data_subject_type in ('child','parent','staff','manager','inspector','garden')),
  constraint privacy_rights_status_check check (status in ('received','validating','in_progress','waiting_approval','completed','rejected','cancelled'))
);

create table if not exists public.security_risk_register (
  id uuid primary key default gen_random_uuid(),
  risk_key text not null unique,
  title text not null,
  severity text not null,
  status text not null default 'open',
  risk_domain text not null,
  owner_role text not null default 'admin',
  mitigation_plan text,
  due_at timestamptz,
  verified_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint security_risk_severity_check check (severity in ('critical','high','medium','low')),
  constraint security_risk_status_check check (status in ('open','mitigating','mitigated','verified','accepted_risk'))
);

create table if not exists public.security_policies_repository (
  id uuid primary key default gen_random_uuid(),
  policy_key text not null unique,
  policy_type text not null,
  title text not null,
  version text not null default '1.0',
  status text not null default 'draft',
  owner_role text not null default 'admin',
  review_due_at timestamptz,
  document_path text,
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint security_policy_type_check check (policy_type in ('access','privacy','retention','incident_response','mfa','encryption','backup','camera','ai')),
  constraint security_policy_status_check check (status in ('draft','approved','needs_review','retired'))
);

create table if not exists public.security_training_readiness (
  id uuid primary key default gen_random_uuid(),
  training_key text not null unique,
  role text not null,
  training_name text not null,
  required boolean not null default true,
  status text not null default 'planned',
  completion_rate integer not null default 0,
  last_completed_at timestamptz,
  next_due_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint security_training_role_check check (role in ('admin','manager','staff','inspector','parent','network_manager')),
  constraint security_training_status_check check (status in ('planned','in_progress','ready','overdue')),
  constraint security_training_completion_check check (completion_rate between 0 and 100)
);

create index if not exists mfa_enrollment_status_role_idx on public.mfa_enrollment_status(role, enrollment_status);
create index if not exists security_data_classifications_table_idx on public.security_data_classifications(table_name, data_classification);
create index if not exists encrypted_field_registry_status_idx on public.encrypted_field_registry(encryption_status, data_classification);
create index if not exists security_events_type_idx on public.security_events(event_type, status, created_at desc);
create index if not exists trusted_devices_profile_idx on public.trusted_devices(profile_id, trust_status, last_seen_at desc);
create index if not exists security_sessions_profile_idx on public.security_sessions(profile_id, expires_at desc);
create index if not exists privacy_rights_requests_status_idx on public.privacy_rights_requests(status, due_at);
create index if not exists security_risk_register_status_idx on public.security_risk_register(status, severity, due_at);
create index if not exists security_policies_repository_type_idx on public.security_policies_repository(policy_type, status);
create index if not exists security_training_readiness_role_idx on public.security_training_readiness(role, status);

alter table public.mfa_enrollment_status enable row level security;
alter table public.security_data_classifications enable row level security;
alter table public.encrypted_field_registry enable row level security;
alter table public.security_events enable row level security;
alter table public.trusted_devices enable row level security;
alter table public.security_sessions enable row level security;
alter table public.privacy_rights_requests enable row level security;
alter table public.security_risk_register enable row level security;
alter table public.security_policies_repository enable row level security;
alter table public.security_training_readiness enable row level security;

drop policy if exists "mfa enrollment admin only" on public.mfa_enrollment_status;
create policy "mfa enrollment admin only" on public.mfa_enrollment_status for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "data classifications admin only" on public.security_data_classifications;
create policy "data classifications admin only" on public.security_data_classifications for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "encrypted field registry admin only" on public.encrypted_field_registry;
create policy "encrypted field registry admin only" on public.encrypted_field_registry for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "security events admin only" on public.security_events;
create policy "security events admin only" on public.security_events for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "trusted devices admin only" on public.trusted_devices;
create policy "trusted devices admin only" on public.trusted_devices for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "security sessions admin only" on public.security_sessions;
create policy "security sessions admin only" on public.security_sessions for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "privacy rights requests admin only" on public.privacy_rights_requests;
create policy "privacy rights requests admin only" on public.privacy_rights_requests for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "security risk register admin only" on public.security_risk_register;
create policy "security risk register admin only" on public.security_risk_register for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "security policies repository admin only" on public.security_policies_repository;
create policy "security policies repository admin only" on public.security_policies_repository for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "security training readiness admin only" on public.security_training_readiness;
create policy "security training readiness admin only" on public.security_training_readiness for all using (public.is_admin()) with check (public.is_admin());

insert into public.security_readiness_checks (category, check_key, title, status, severity, evidence_summary, recommended_action, metadata)
values
  ('mfa', 'mandatory-mfa-all-roles', 'Mandatory MFA for all roles', 'partial', 'critical', 'MFA enrollment registry exists for parents, staff, managers, inspectors and admins.', 'Connect Supabase MFA factors, SMS OTP and backup-code issuance before production.', '{"required_roles":["parent","staff","manager","inspector","admin"]}'::jsonb),
  ('encryption', 'medical-data-application-encryption', 'Medical data application encryption', 'partial', 'critical', 'Encrypted columns and field registry exist for allergies, medical notes, medications and medicine logs.', 'Migrate plaintext medical data through application-level AES-GCM encryption before real customer data.', '{"key_reference":"FIELD_ENCRYPTION_KEY"}'::jsonb),
  ('audit_logging', 'immutable-audit-trail', 'Immutable audit trail coverage', 'partial', 'critical', 'Security events and audit catalog track login, logout, data access, medical access and camera viewing.', 'Wire login/logout and sensitive read events into append-only audit writes.', '{}'::jsonb),
  ('privacy', 'privacy-rights-framework', 'Privacy rights framework', 'partial', 'high', 'Access, correction, deletion and export request table exists.', 'Define approval workflow and legal response SLA before launch.', '{}'::jsonb),
  ('access_control', 'least-privilege-rbac-hardening', 'Least privilege RBAC hardening', 'partial', 'critical', 'Role checks, RLS and security classifications are mapped.', 'Complete route-by-route and table-by-table access review.', '{}'::jsonb),
  ('device_trust', 'device-trust-layer', 'Device trust layer', 'partial', 'high', 'Trusted device and suspicious device tables exist.', 'Connect device fingerprint hashing and new-device alerts.', '{}'::jsonb),
  ('session_security', 'secure-session-controls', 'Session expiration and forced logout', 'partial', 'high', 'Security session registry supports expiration, concurrent session count and forced logout.', 'Wire auth session lifecycle to security_sessions.', '{}'::jsonb),
  ('provider_security', 'provider-security-readiness', 'Provider security readiness', 'partial', 'high', 'Secrets inventory tracks provider tokens and server-only usage.', 'Validate Supabase, Vercel, communications, push, payment and camera gateway security posture.', '{}'::jsonb),
  ('training', 'security-training-readiness', 'Security training readiness', 'pending', 'medium', 'Training readiness table exists for admins, managers and staff.', 'Publish role-based training before production launch.', '{}'::jsonb)
on conflict (check_key) do update set
  category = excluded.category,
  title = excluded.title,
  status = excluded.status,
  severity = excluded.severity,
  evidence_summary = excluded.evidence_summary,
  recommended_action = excluded.recommended_action,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.security_secret_inventory (secret_key, secret_type, location, required, server_only, rotation_status, readiness_status, notes, metadata)
values
  ('FIELD_ENCRYPTION_KEY', 'encryption_key', 'server env only', true, true, 'unknown', 'pending', 'Required for application-level encryption of medical and regulated fields.', '{"phase":146}'::jsonb),
  ('MFA_SMS_PROVIDER_SECRET', 'provider_token', 'server env only', false, true, 'unknown', 'partial', 'Required only when SMS OTP MFA is enabled.', '{"phase":146}'::jsonb)
on conflict (secret_key) do update set
  secret_type = excluded.secret_type,
  location = excluded.location,
  required = excluded.required,
  server_only = excluded.server_only,
  rotation_status = excluded.rotation_status,
  readiness_status = excluded.readiness_status,
  notes = excluded.notes,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.security_data_classifications (classification_key, table_name, field_name, data_classification, data_domain, contains_child_data, contains_medical_data, encryption_required, audit_required, retention_policy_key, access_rule_summary, metadata)
values
  ('children-allergies-medical', 'children', 'allergies', 'medical', 'child_medical', true, true, true, true, 'medical-records-retention', 'Parents see own child; staff/manager scoped to garden; access should be audited.', '{"encrypted_field":"allergies_encrypted"}'::jsonb),
  ('children-medical-notes', 'children', 'medical_notes', 'medical', 'child_medical', true, true, true, true, 'medical-records-retention', 'Parents see own child; staff/manager scoped to garden; access should be audited.', '{"encrypted_field":"medical_notes_encrypted"}'::jsonb),
  ('children-regular-medications', 'children', 'regular_medications', 'medical', 'child_medical', true, true, true, true, 'medical-records-retention', 'Parents see own child; staff/manager scoped to garden; access should be audited.', '{"encrypted_field":"regular_medications_encrypted"}'::jsonb),
  ('child-health-records', 'child_health_records', null, 'medical', 'child_medical', true, true, true, true, 'medical-records-retention', 'Sensitive health table; encrypted-field migration required.', '{}'::jsonb),
  ('medicine-given-logs', 'medicine_given_logs', null, 'medical', 'child_medical', true, true, true, true, 'medical-records-retention', 'Medication administration logs require encryption and audit on access.', '{}'::jsonb),
  ('camera-streams', 'camera_streams', null, 'regulated', 'camera', true, false, false, true, 'camera-session-retention', 'Camera configuration is regulated; credentials must remain encrypted/server-only.', '{}'::jsonb),
  ('ai-camera-events', 'ai_camera_events', null, 'regulated', 'ai_observer', true, false, false, true, 'ai-event-retention', 'Raw AI events are internal only and require human review before visibility.', '{}'::jsonb),
  ('audit-logs', 'audit_logs', null, 'regulated', 'audit', false, false, false, true, 'audit-logs-retention', 'Append-only audit evidence; admin read only.', '{}'::jsonb)
on conflict (classification_key) do update set
  table_name = excluded.table_name,
  field_name = excluded.field_name,
  data_classification = excluded.data_classification,
  data_domain = excluded.data_domain,
  contains_child_data = excluded.contains_child_data,
  contains_medical_data = excluded.contains_medical_data,
  encryption_required = excluded.encryption_required,
  audit_required = excluded.audit_required,
  retention_policy_key = excluded.retention_policy_key,
  access_rule_summary = excluded.access_rule_summary,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.encrypted_field_registry (registry_key, table_name, plaintext_field, encrypted_field, data_classification, encryption_status, coverage_percent, notes, metadata)
values
  ('children-allergies-encryption', 'children', 'allergies', 'allergies_encrypted', 'medical', 'partial', 0, 'Encrypted column exists; plaintext migration must run before real customer data.', '{"phase":146}'::jsonb),
  ('children-medical-notes-encryption', 'children', 'medical_notes', 'medical_notes_encrypted', 'medical', 'partial', 0, 'Encrypted column exists; plaintext migration must run before real customer data.', '{"phase":146}'::jsonb),
  ('children-regular-medications-encryption', 'children', 'regular_medications', 'regular_medications_encrypted', 'medical', 'partial', 0, 'Encrypted column exists; plaintext migration must run before real customer data.', '{"phase":146}'::jsonb),
  ('child-health-allergies-encryption', 'child_health_records', 'allergies', 'allergies_encrypted', 'medical', 'partial', 0, 'Encrypted column exists; application write path must use encrypted field.', '{"phase":146}'::jsonb),
  ('child-health-medical-notes-encryption', 'child_health_records', 'medical_notes', 'medical_notes_encrypted', 'medical', 'partial', 0, 'Encrypted column exists; application write path must use encrypted field.', '{"phase":146}'::jsonb),
  ('medicine-name-encryption', 'medicine_given_logs', 'medicine_name', 'medicine_name_encrypted', 'medical', 'partial', 0, 'Encrypted column exists; application write path must use encrypted field.', '{"phase":146}'::jsonb),
  ('medicine-dosage-encryption', 'medicine_given_logs', 'dosage', 'dosage_encrypted', 'medical', 'partial', 0, 'Encrypted column exists; application write path must use encrypted field.', '{"phase":146}'::jsonb)
on conflict (registry_key) do update set
  table_name = excluded.table_name,
  plaintext_field = excluded.plaintext_field,
  encrypted_field = excluded.encrypted_field,
  data_classification = excluded.data_classification,
  encryption_status = excluded.encryption_status,
  coverage_percent = excluded.coverage_percent,
  notes = excluded.notes,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.security_risk_register (risk_key, title, severity, status, risk_domain, owner_role, mitigation_plan, metadata)
values
  ('mfa-not-yet-enforced-all-roles', 'MFA is not yet enforced for every role', 'critical', 'mitigating', 'authentication', 'admin', 'Connect MFA provider, require enrollment and block password-only access before production.', '{"phase":146}'::jsonb),
  ('medical-plaintext-migration-required', 'Medical plaintext migration still required', 'critical', 'mitigating', 'encryption', 'admin', 'Encrypt existing medical fields and switch write paths to encrypted fields before real data.', '{"phase":146}'::jsonb),
  ('sensitive-read-audit-not-fully-wired', 'Sensitive read audit is not fully wired', 'high', 'mitigating', 'audit', 'admin', 'Log data access for medical records, camera viewing, AI event review and inspection records.', '{"phase":146}'::jsonb),
  ('privacy-rights-sla-needs-legal-signoff', 'Privacy rights SLA needs legal sign-off', 'medium', 'open', 'privacy', 'admin', 'Finalize access, correction, deletion and export request procedure with legal counsel.', '{"phase":146}'::jsonb)
on conflict (risk_key) do update set
  title = excluded.title,
  severity = excluded.severity,
  status = excluded.status,
  risk_domain = excluded.risk_domain,
  owner_role = excluded.owner_role,
  mitigation_plan = excluded.mitigation_plan,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.security_policies_repository (policy_key, policy_type, title, version, status, owner_role, document_path, summary, metadata)
values
  ('mfa-policy', 'mfa', 'Mandatory MFA Policy', '1.0', 'draft', 'admin', 'PRIVACY_SECURITY_ARCHITECTURE_AND_HIGH_SECURITY_COMPLIANCE_PLATFORM.md', 'All roles require MFA; supported factors are authenticator app, SMS OTP and backup codes.', '{"phase":146}'::jsonb),
  ('medical-encryption-policy', 'encryption', 'Medical Data Encryption Policy', '1.0', 'draft', 'admin', 'PRIVACY_SECURITY_ARCHITECTURE_AND_HIGH_SECURITY_COMPLIANCE_PLATFORM.md', 'Medical fields require application-level encryption and server-only keys.', '{"phase":146}'::jsonb),
  ('privacy-rights-policy', 'privacy', 'Privacy Rights Request Policy', '1.0', 'draft', 'admin', 'PRIVACY_SECURITY_ARCHITECTURE_AND_HIGH_SECURITY_COMPLIANCE_PLATFORM.md', 'Access, correction, deletion and export requests are tracked and auditable.', '{"phase":146}'::jsonb),
  ('incident-response-policy', 'incident_response', 'Security Incident Response Policy', '1.0', 'needs_review', 'admin', 'PRIVACY_SECURITY_ARCHITECTURE_AND_HIGH_SECURITY_COMPLIANCE_PLATFORM.md', 'Security incidents require severity, owner, mitigation and review.', '{"phase":146}'::jsonb),
  ('retention-policy', 'retention', 'Retention and Legal Hold Policy', '1.0', 'needs_review', 'admin', 'PRIVACY_SECURITY_ARCHITECTURE_AND_HIGH_SECURITY_COMPLIANCE_PLATFORM.md', 'Retention must respect minors, medical data, audit logs and legal holds.', '{"phase":146}'::jsonb)
on conflict (policy_key) do update set
  policy_type = excluded.policy_type,
  title = excluded.title,
  version = excluded.version,
  status = excluded.status,
  owner_role = excluded.owner_role,
  document_path = excluded.document_path,
  summary = excluded.summary,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.security_training_readiness (training_key, role, training_name, required, status, completion_rate, metadata)
values
  ('admin-security-training', 'admin', 'Admin high security operations', true, 'planned', 0, '{"phase":146}'::jsonb),
  ('manager-privacy-training', 'manager', 'Manager privacy and child data handling', true, 'planned', 0, '{"phase":146}'::jsonb),
  ('staff-medical-data-training', 'staff', 'Staff medical data and child safety privacy', true, 'planned', 0, '{"phase":146}'::jsonb),
  ('inspector-sensitive-records-training', 'inspector', 'Inspector sensitive records and audit handling', true, 'planned', 0, '{"phase":146}'::jsonb)
on conflict (training_key) do update set
  role = excluded.role,
  training_name = excluded.training_name,
  required = excluded.required,
  status = excluded.status,
  completion_rate = excluded.completion_rate,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.audit_event_catalog (event_key, category, title, required, implemented, source_table, notes, data_classification, metadata)
values
  ('logout', 'authentication', 'Logout', true, false, 'security_events', 'Logout should be tracked for security sessions.', 'internal', '{"phase":146}'::jsonb),
  ('mfa-failure', 'authentication', 'MFA failure', true, false, 'security_events', 'MFA failures must be logged and reviewed.', 'sensitive', '{"phase":146}'::jsonb),
  ('data-access', 'data_access', 'Sensitive data access', true, false, 'security_events', 'Medical, child, camera and inspection sensitive reads must be auditable.', 'regulated', '{"phase":146}'::jsonb),
  ('medical-record-access', 'medical', 'Medical record access', true, false, 'security_events', 'Medical record access requires append-only audit evidence.', 'medical', '{"phase":146}'::jsonb),
  ('camera-viewing', 'camera', 'Camera viewing', true, true, 'camera_playback_sessions', 'Camera viewing sessions are tracked.', 'regulated', '{"phase":146}'::jsonb),
  ('inspection-action', 'inspection', 'Inspection action', true, true, 'regulatory_audit_events', 'Inspection actions are tracked in regulatory audit logs.', 'regulated', '{"phase":146}'::jsonb)
on conflict (event_key) do update set
  category = excluded.category,
  title = excluded.title,
  required = excluded.required,
  implemented = excluded.implemented,
  source_table = excluded.source_table,
  notes = excluded.notes,
  data_classification = excluded.data_classification,
  metadata = excluded.metadata,
  updated_at = now();

comment on table public.mfa_enrollment_status is 'Mandatory MFA enrollment readiness by role and profile.';
comment on table public.security_data_classifications is 'Sensitive data classification registry for public, internal, confidential, sensitive, medical and regulated data.';
comment on table public.encrypted_field_registry is 'Application-level encrypted field registry for medical and regulated data.';
comment on table public.security_events is 'Append-only security event stream for MFA failures, suspicious access, permission violations, medical access and camera viewing.';
comment on table public.trusted_devices is 'Device trust registry using hashed fingerprints only.';
comment on table public.security_sessions is 'Session security registry for expiration, forced logout and concurrent-session monitoring.';
comment on table public.privacy_rights_requests is 'Privacy rights request workflow for access, correction, deletion and export readiness.';
comment on table public.security_risk_register is 'Security risk register with mitigation ownership and verification state.';
comment on table public.security_policies_repository is 'Security policy repository for access, privacy, retention, incident response, MFA and encryption.';
comment on table public.security_training_readiness is 'Security training readiness for admins, managers, staff and inspectors.';
