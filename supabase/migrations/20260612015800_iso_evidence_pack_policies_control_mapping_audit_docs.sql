-- PHASE 158: ISO Evidence Pack, Policies, Control Mapping & Audit Documentation Platform

create extension if not exists "pgcrypto";

alter table if exists public.security_readiness_checks
  drop constraint if exists security_readiness_category_check;

alter table if exists public.security_readiness_checks
  add constraint security_readiness_category_check
  check (category in (
    'authentication','mfa','authorization','access_control','rls','api_protection','secrets',
    'encryption','audit_logging','backup','disaster_recovery','rate_limiting','monitoring',
    'privacy','provider_security','compliance','training','session_security','device_trust',
    'iso_27001','iso_27017','iso_27701','asset_inventory','risk_management','internal_audit',
    'ci_cd','sast','dast','dependency_scanning','secret_scanning','migration_safety','branch_protection',
    'iso_evidence','statement_of_applicability','supplier_review','access_review','audit_binder',
    'policy_repository','procedure_repository','cloud_security','privacy_evidence','camera_compliance',
    'ai_governance_evidence'
  ));

alter table if exists public.security_policies_repository
  drop constraint if exists security_policy_type_check;

alter table if exists public.security_policies_repository
  add constraint security_policy_type_check
  check (policy_type in (
    'information_security','access','privacy','retention','incident_response','mfa','encryption',
    'backup','supplier_security','change_management','camera','ai','data_subject_rights',
    'business_continuity','cloud_security'
  ));

alter table if exists public.security_policies_repository
  add column if not exists approval_status text not null default 'draft',
  add column if not exists effective_date date,
  add column if not exists next_review_date date,
  add column if not exists approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists evidence_item_id uuid,
  add column if not exists iso_standards text[] not null default array[]::text[];

alter table if exists public.security_policies_repository
  drop constraint if exists security_policy_approval_status_check;

alter table if exists public.security_policies_repository
  add constraint security_policy_approval_status_check
  check (approval_status in ('draft','under_review','approved','needs_review','retired'));

create table if not exists public.iso_evidence_items (
  id uuid primary key default gen_random_uuid(),
  evidence_key text not null unique,
  standard text not null,
  control_id text,
  evidence_type text not null,
  title text not null,
  description text,
  owner_role text not null default 'admin',
  owner_profile_id uuid references public.profiles(id) on delete set null,
  status text not null default 'missing',
  file_url text,
  source_table text,
  source_record_id uuid,
  last_reviewed_at timestamptz,
  expires_at timestamptz,
  notes text,
  sensitivity text not null default 'internal',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint iso_evidence_standard_check check (standard in ('iso_27001','iso_27017','iso_27701','combined')),
  constraint iso_evidence_type_check check (evidence_type in (
    'policy','procedure','screenshot','system_config','audit_log','report','risk_record',
    'asset_record','supplier_record','access_review','incident_record','backup_test',
    'dpia','camera_privacy','ai_governance','ci_cd','encryption','training','export_package'
  )),
  constraint iso_evidence_status_check check (status in ('missing','draft','uploaded','reviewed','approved','expired')),
  constraint iso_evidence_sensitivity_check check (sensitivity in ('public','internal','confidential','sensitive','regulated'))
);

create table if not exists public.iso_statement_of_applicability (
  id uuid primary key default gen_random_uuid(),
  soa_key text not null unique,
  standard text not null default 'iso_27001',
  control_id text not null,
  control_title text not null,
  applicable boolean not null default true,
  applicability_reason text,
  implementation_status text not null default 'planned',
  evidence_item_id uuid references public.iso_evidence_items(id) on delete set null,
  evidence_link text,
  owner_role text not null default 'admin',
  owner_profile_id uuid references public.profiles(id) on delete set null,
  review_date date,
  next_review_date date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint iso_soa_standard_check check (standard in ('iso_27001')),
  constraint iso_soa_implementation_check check (implementation_status in ('implemented','partial','planned','not_applicable','blocked'))
);

create table if not exists public.security_procedures (
  id uuid primary key default gen_random_uuid(),
  procedure_key text not null unique,
  procedure_type text not null,
  title text not null,
  version text not null default '1.0',
  owner_role text not null default 'admin',
  status text not null default 'draft',
  document_path text,
  summary text,
  related_policy_key text,
  evidence_item_id uuid references public.iso_evidence_items(id) on delete set null,
  effective_date date,
  next_review_date date,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint security_procedure_type_check check (procedure_type in (
    'user_onboarding','user_offboarding','role_review','mfa_enforcement','backup_restore',
    'incident_response','supplier_review','deployment_approval','privacy_request',
    'audit_log_review','evidence_review','access_review'
  )),
  constraint security_procedure_status_check check (status in ('draft','under_review','approved','needs_review','retired'))
);

create table if not exists public.iso_supplier_evidence (
  id uuid primary key default gen_random_uuid(),
  supplier_key text not null unique,
  supplier_name text not null,
  supplier_type text not null,
  purpose text not null,
  data_processed jsonb not null default '[]'::jsonb,
  security_review_status text not null default 'needs_review',
  privacy_review_status text not null default 'needs_review',
  contract_status text not null default 'not_started',
  dpa_status text not null default 'not_started',
  risk_rating text not null default 'medium',
  owner_role text not null default 'admin',
  evidence_item_id uuid references public.iso_evidence_items(id) on delete set null,
  last_reviewed_at timestamptz,
  next_review_due_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint iso_supplier_type_check check (supplier_type in ('hosting','database','ci_cd','email','sms','whatsapp','push','payment','camera_gateway','ai','analytics','support')),
  constraint iso_supplier_review_check check (
    security_review_status in ('not_started','needs_review','reviewed','approved','blocked')
    and privacy_review_status in ('not_started','needs_review','reviewed','approved','blocked')
    and contract_status in ('not_started','draft','signed','expired','not_required')
    and dpa_status in ('not_started','draft','signed','expired','not_required')
  ),
  constraint iso_supplier_risk_rating_check check (risk_rating in ('critical','high','medium','low'))
);

create table if not exists public.iso_access_reviews (
  id uuid primary key default gen_random_uuid(),
  review_key text not null unique,
  scope text not null,
  reviewed_users_count integer not null default 0,
  privileged_users_count integer not null default 0,
  inactive_users_count integer not null default 0,
  revoked_access_count integer not null default 0,
  reviewer_id uuid references public.profiles(id) on delete set null,
  reviewer_role text not null default 'admin',
  review_status text not null default 'planned',
  review_date date,
  next_review_due_at date,
  evidence_item_id uuid references public.iso_evidence_items(id) on delete set null,
  findings jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint iso_access_review_scope_check check (scope in ('all_users','admins','managers','staff','parents','inspectors','supabase','github','vercel','service_accounts')),
  constraint iso_access_review_status_check check (review_status in ('planned','in_progress','completed','overdue','blocked'))
);

create table if not exists public.iso_gap_analysis_items (
  id uuid primary key default gen_random_uuid(),
  gap_key text not null unique,
  standard text not null,
  control_id text,
  gap_description text not null,
  severity text not null default 'medium',
  owner_role text not null default 'admin',
  owner_profile_id uuid references public.profiles(id) on delete set null,
  due_date date,
  status text not null default 'open',
  remediation_plan text,
  evidence_after_fix uuid references public.iso_evidence_items(id) on delete set null,
  accepted_risk_reason text,
  accepted_risk_expires_at date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint iso_gap_standard_check check (standard in ('iso_27001','iso_27017','iso_27701','combined')),
  constraint iso_gap_severity_check check (severity in ('critical','high','medium','low')),
  constraint iso_gap_status_check check (status in ('open','in_progress','fixed','accepted_risk','verified')),
  constraint iso_gap_accepted_risk_check check (
    status <> 'accepted_risk' or (accepted_risk_reason is not null and accepted_risk_expires_at is not null)
  )
);

create table if not exists public.iso_corrective_actions (
  id uuid primary key default gen_random_uuid(),
  action_key text not null unique,
  gap_id uuid references public.iso_gap_analysis_items(id) on delete cascade,
  title text not null,
  owner_role text not null default 'admin',
  owner_profile_id uuid references public.profiles(id) on delete set null,
  status text not null default 'open',
  due_date date,
  evidence_item_id uuid references public.iso_evidence_items(id) on delete set null,
  review_notes text,
  verified_by uuid references public.profiles(id) on delete set null,
  verified_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint iso_corrective_action_status_check check (status in ('open','assigned','in_progress','evidence_uploaded','reviewed','verified','cancelled'))
);

create table if not exists public.iso_audit_binder_exports (
  id uuid primary key default gen_random_uuid(),
  export_key text not null unique,
  export_format text not null,
  scope text not null,
  status text not null default 'planned',
  requested_by uuid references public.profiles(id) on delete set null,
  generated_by uuid references public.profiles(id) on delete set null,
  file_url text,
  included_sections jsonb not null default '[]'::jsonb,
  sensitive_data_excluded boolean not null default true,
  generated_at timestamptz,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint iso_audit_binder_format_check check (export_format in ('pdf','zip','csv','metadata_only')),
  constraint iso_audit_binder_scope_check check (scope in ('iso_27001','iso_27017','iso_27701','combined','external_auditor')),
  constraint iso_audit_binder_status_check check (status in ('planned','generating','ready','failed','expired'))
);

create table if not exists public.iso_review_schedule_items (
  id uuid primary key default gen_random_uuid(),
  schedule_key text not null unique,
  review_area text not null,
  title text not null,
  owner_role text not null default 'admin',
  cadence text not null default 'quarterly',
  last_reviewed_at timestamptz,
  next_review_due_at timestamptz,
  status text not null default 'scheduled',
  related_table text,
  related_record_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint iso_review_area_check check (review_area in ('policy','risk_register','supplier','access_review','incident_response','backup_test','privacy_assessment','ai_governance','camera_compliance')),
  constraint iso_review_cadence_check check (cadence in ('monthly','quarterly','semi_annual','annual','event_based')),
  constraint iso_review_status_check check (status in ('scheduled','due','overdue','completed','blocked'))
);

create index if not exists iso_evidence_standard_status_idx on public.iso_evidence_items(standard, status, expires_at);
create index if not exists iso_evidence_control_idx on public.iso_evidence_items(standard, control_id);
create index if not exists iso_soa_control_idx on public.iso_statement_of_applicability(control_id, implementation_status);
create index if not exists security_procedures_type_idx on public.security_procedures(procedure_type, status);
create index if not exists iso_supplier_review_idx on public.iso_supplier_evidence(risk_rating, security_review_status, privacy_review_status);
create index if not exists iso_access_reviews_status_idx on public.iso_access_reviews(review_status, next_review_due_at);
create index if not exists iso_gap_status_idx on public.iso_gap_analysis_items(status, severity, due_date);
create index if not exists iso_corrective_actions_status_idx on public.iso_corrective_actions(status, due_date);
create index if not exists iso_review_schedule_due_idx on public.iso_review_schedule_items(status, next_review_due_at);

alter table public.iso_evidence_items enable row level security;
alter table public.iso_statement_of_applicability enable row level security;
alter table public.security_procedures enable row level security;
alter table public.iso_supplier_evidence enable row level security;
alter table public.iso_access_reviews enable row level security;
alter table public.iso_gap_analysis_items enable row level security;
alter table public.iso_corrective_actions enable row level security;
alter table public.iso_audit_binder_exports enable row level security;
alter table public.iso_review_schedule_items enable row level security;

drop policy if exists "iso evidence admin only" on public.iso_evidence_items;
create policy "iso evidence admin only" on public.iso_evidence_items for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "iso soa admin only" on public.iso_statement_of_applicability;
create policy "iso soa admin only" on public.iso_statement_of_applicability for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "security procedures admin only" on public.security_procedures;
create policy "security procedures admin only" on public.security_procedures for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "iso suppliers admin only" on public.iso_supplier_evidence;
create policy "iso suppliers admin only" on public.iso_supplier_evidence for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "iso access reviews admin only" on public.iso_access_reviews;
create policy "iso access reviews admin only" on public.iso_access_reviews for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "iso gaps admin only" on public.iso_gap_analysis_items;
create policy "iso gaps admin only" on public.iso_gap_analysis_items for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "iso corrective actions admin only" on public.iso_corrective_actions;
create policy "iso corrective actions admin only" on public.iso_corrective_actions for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "iso audit binder admin only" on public.iso_audit_binder_exports;
create policy "iso audit binder admin only" on public.iso_audit_binder_exports for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "iso review schedule admin only" on public.iso_review_schedule_items;
create policy "iso review schedule admin only" on public.iso_review_schedule_items for all using (public.is_admin()) with check (public.is_admin());

insert into public.iso_evidence_items (evidence_key, standard, control_id, evidence_type, title, description, owner_role, status, source_table, notes, sensitivity, metadata)
values
  ('iso27001-access-control-policy', 'iso_27001', 'A.5/A.8', 'policy', 'Access control policy evidence', 'Role-based permissions, MFA readiness and least-privilege controls.', 'admin', 'draft', 'security_policies_repository', 'Formal approval evidence still required.', 'internal', '{"phase":158}'::jsonb),
  ('iso27001-immutable-audit-evidence', 'iso_27001', 'A.8', 'audit_log', 'Immutable audit trail evidence', 'Append-only audit, medical access logs, camera logs and admin action coverage.', 'admin', 'reviewed', 'immutable_audit_events', 'Export sample without child PII for auditor pack.', 'confidential', '{"phase":158}'::jsonb),
  ('iso27017-cloud-shared-responsibility', 'iso_27017', 'CLD', 'system_config', 'Cloud shared responsibility model', 'Supabase, Vercel and GitHub control boundaries and provider readiness.', 'admin', 'draft', 'asset_inventory', 'Attach provider contracts and security docs before external audit.', 'internal', '{"phase":158}'::jsonb),
  ('iso27701-privacy-rights-workflow', 'iso_27701', 'PIMS', 'procedure', 'Privacy rights workflow evidence', 'Data subject request, deletion, anonymization and legal hold workflows.', 'admin', 'reviewed', 'privacy_rights_requests', 'Needs operational test evidence.', 'confidential', '{"phase":158}'::jsonb),
  ('iso27701-ai-governance-dpia', 'iso_27701', 'PIMS/AI', 'dpia', 'AI DPIA and governance evidence', 'Responsible AI, restricted capabilities, human review and Gan Batuach Israel mode.', 'admin', 'reviewed', 'ai_governance_reviews', 'No raw AI events for parent access.', 'internal', '{"phase":158}'::jsonb),
  ('iso27001-cicd-security-gates', 'iso_27001', 'A.8', 'ci_cd', 'CI/CD security gates evidence', 'Typecheck, build, dependency audit, secret scan and CodeQL readiness.', 'admin', 'uploaded', 'security_pipeline_controls', 'Requires real successful workflow run before audit.', 'internal', '{"phase":158}'::jsonb),
  ('iso27001-backup-dr-evidence', 'iso_27001', 'A.5/A.8', 'backup_test', 'Backup and disaster recovery evidence', 'Backup coverage, restore tests, RTO/RPO and continuity readiness.', 'admin', 'draft', 'backup_readiness_checks', 'Run restore test and attach result.', 'confidential', '{"phase":158}'::jsonb),
  ('iso27701-camera-privacy-evidence', 'iso_27701', 'PIMS/Camera', 'camera_privacy', 'Camera compliance evidence', 'Parent viewing policy, token model, session logs, watermark and no direct RTSP exposure.', 'admin', 'reviewed', 'camera_access_audit_trail', 'Native anti-capture evidence remains future mobile proof.', 'regulated', '{"phase":158}'::jsonb)
on conflict (evidence_key) do update set
  standard = excluded.standard,
  control_id = excluded.control_id,
  evidence_type = excluded.evidence_type,
  title = excluded.title,
  description = excluded.description,
  owner_role = excluded.owner_role,
  status = excluded.status,
  source_table = excluded.source_table,
  notes = excluded.notes,
  sensitivity = excluded.sensitivity,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.iso_statement_of_applicability (soa_key, control_id, control_title, applicable, applicability_reason, implementation_status, evidence_link, owner_role, review_date, next_review_date, metadata)
values
  ('soa-a5-organizational-controls', 'A.5', 'Organizational controls', true, 'Gan Batuach operates sensitive child, parent, staff, camera and medical data.', 'partial', 'iso_evidence_items:iso27001-access-control-policy', 'admin', current_date, current_date + 180, '{"phase":158}'::jsonb),
  ('soa-a6-people-controls', 'A.6', 'People controls', true, 'Staff onboarding, police clearance, first aid and security training readiness are required.', 'partial', 'permit_expiry_alerts', 'admin', current_date, current_date + 180, '{"phase":158}'::jsonb),
  ('soa-a8-technology-controls', 'A.8', 'Technology controls', true, 'MFA, RLS, encryption, audit logs, CI/CD and camera controls are platform-critical.', 'partial', 'security_readiness_checks', 'admin', current_date, current_date + 180, '{"phase":158}'::jsonb),
  ('soa-cloud-shared-responsibility', 'CLD', 'Cloud shared responsibility', true, 'Vercel, Supabase and GitHub are core providers for production operations.', 'partial', 'asset_inventory', 'admin', current_date, current_date + 180, '{"phase":158,"standard":"iso_27017"}'::jsonb),
  ('soa-pims-privacy-governance', 'PIMS', 'Privacy information management', true, 'Children, parents, medical records, attendance, cameras and AI require privacy governance.', 'partial', 'privacy_rights_requests', 'admin', current_date, current_date + 180, '{"phase":158,"standard":"iso_27701"}'::jsonb)
on conflict (soa_key) do update set
  control_title = excluded.control_title,
  applicable = excluded.applicable,
  applicability_reason = excluded.applicability_reason,
  implementation_status = excluded.implementation_status,
  evidence_link = excluded.evidence_link,
  owner_role = excluded.owner_role,
  review_date = excluded.review_date,
  next_review_date = excluded.next_review_date,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.security_policies_repository (policy_key, policy_type, title, version, status, approval_status, owner_role, document_path, summary, iso_standards, metadata)
values
  ('information-security-policy', 'information_security', 'Information Security Policy', '1.0', 'draft', 'under_review', 'admin', 'ISO_EVIDENCE_PACK_POLICIES_CONTROL_MAPPING_AND_AUDIT_DOCUMENTATION_PLATFORM.md', 'Umbrella information security policy for ISO 27001 readiness.', array['iso_27001'], '{"phase":158}'::jsonb),
  ('supplier-security-policy', 'supplier_security', 'Supplier Security Policy', '1.0', 'draft', 'under_review', 'admin', 'ISO_EVIDENCE_PACK_POLICIES_CONTROL_MAPPING_AND_AUDIT_DOCUMENTATION_PLATFORM.md', 'Supplier review, DPA, contract and risk-rating policy.', array['iso_27001','iso_27017','iso_27701'], '{"phase":158}'::jsonb),
  ('change-management-policy', 'change_management', 'Change Management Policy', '1.0', 'draft', 'under_review', 'admin', 'CI_CD_SECURITY_GATES_SAST_DAST_DEPENDENCY_AND_SECRET_SCANNING_PLATFORM.md', 'GitHub/Vercel deployment readiness, branch protection and evidence expectations.', array['iso_27001','iso_27017'], '{"phase":158}'::jsonb),
  ('data-subject-rights-policy', 'data_subject_rights', 'Data Subject Rights Policy', '1.0', 'draft', 'under_review', 'admin', 'DATA_RIGHTS_RETENTION_DELETION_AND_RIGHT_TO_BE_FORGOTTEN_PLATFORM.md', 'Access, correction, export, deletion, anonymization and legal-hold rules.', array['iso_27701'], '{"phase":158}'::jsonb)
on conflict (policy_key) do update set
  policy_type = excluded.policy_type,
  title = excluded.title,
  version = excluded.version,
  status = excluded.status,
  approval_status = excluded.approval_status,
  owner_role = excluded.owner_role,
  document_path = excluded.document_path,
  summary = excluded.summary,
  iso_standards = excluded.iso_standards,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.security_procedures (procedure_key, procedure_type, title, version, owner_role, status, document_path, summary, related_policy_key, metadata)
values
  ('user-onboarding-procedure', 'user_onboarding', 'User onboarding procedure', '1.0', 'admin', 'draft', 'FULL_KINDERGARTEN_ONBOARDING_ACTIVATION_AND_USER_REGISTRATION_FLOW.md', 'Manager, staff, parent and admin onboarding controls.', 'access-control-policy', '{"phase":158}'::jsonb),
  ('user-offboarding-procedure', 'user_offboarding', 'User offboarding procedure', '1.0', 'admin', 'draft', 'MANDATORY_MFA_IDENTITY_HARDENING_AND_TRUSTED_DEVICE_PLATFORM.md', 'Account revocation, device/session cleanup and access removal.', 'access-control-policy', '{"phase":158}'::jsonb),
  ('role-review-procedure', 'role_review', 'Role review procedure', '1.0', 'admin', 'draft', 'PRIVACY_SECURITY_ARCHITECTURE_AND_HIGH_SECURITY_COMPLIANCE_PLATFORM.md', 'Periodic review for privileged, inactive and tenant-scoped users.', 'access-control-policy', '{"phase":158}'::jsonb),
  ('backup-restore-procedure', 'backup_restore', 'Backup restore procedure', '1.0', 'admin', 'draft', 'BUSINESS_CONTINUITY_BACKUP_AND_DISASTER_RECOVERY_PLATFORM.md', 'Restore testing, RTO/RPO and provider failure evidence.', 'backup-policy', '{"phase":158}'::jsonb),
  ('privacy-request-procedure', 'privacy_request', 'Privacy request handling procedure', '1.0', 'admin', 'draft', 'DATA_RIGHTS_RETENTION_DELETION_AND_RIGHT_TO_BE_FORGOTTEN_PLATFORM.md', 'Admin review, legal hold check, export/deletion and audit trail.', 'data-subject-rights-policy', '{"phase":158}'::jsonb),
  ('audit-log-review-procedure', 'audit_log_review', 'Audit log review procedure', '1.0', 'admin', 'draft', 'IMMUTABLE_AUDIT_TRAIL_EVIDENCE_LOGS_AND_WORM_READINESS_PLATFORM.md', 'Immutable log review and evidence export without secrets.', 'information-security-policy', '{"phase":158}'::jsonb)
on conflict (procedure_key) do update set
  procedure_type = excluded.procedure_type,
  title = excluded.title,
  version = excluded.version,
  owner_role = excluded.owner_role,
  status = excluded.status,
  document_path = excluded.document_path,
  summary = excluded.summary,
  related_policy_key = excluded.related_policy_key,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.iso_supplier_evidence (supplier_key, supplier_name, supplier_type, purpose, data_processed, security_review_status, privacy_review_status, contract_status, dpa_status, risk_rating, notes, metadata)
values
  ('supabase', 'Supabase', 'database', 'Database, Auth, Storage and Realtime platform.', '["children","parents","staff","medical","documents","audit_logs"]'::jsonb, 'reviewed', 'needs_review', 'draft', 'draft', 'high', 'Attach DPA, region, backup and RLS evidence.', '{"phase":158}'::jsonb),
  ('vercel', 'Vercel', 'hosting', 'Next.js hosting, serverless functions and environment variables.', '["application_runtime","server_logs","environment_variables"]'::jsonb, 'reviewed', 'needs_review', 'draft', 'draft', 'high', 'Attach security headers, deployment controls and environment access evidence.', '{"phase":158}'::jsonb),
  ('github', 'GitHub', 'ci_cd', 'Version control, CI/CD and code scanning readiness.', '["source_code","issues","workflow_logs"]'::jsonb, 'reviewed', 'needs_review', 'draft', 'draft', 'medium', 'Enable branch protection and scanning evidence before audit.', '{"phase":158}'::jsonb),
  ('email-provider', 'Email provider', 'email', 'Transactional email and notifications.', '["contact_details","message_metadata"]'::jsonb, 'needs_review', 'needs_review', 'not_started', 'not_started', 'medium', 'Provider selection and DPA required.', '{"phase":158}'::jsonb),
  ('sms-provider', 'SMS provider', 'sms', 'OTP, onboarding and operational alerts.', '["phone_numbers","message_metadata"]'::jsonb, 'needs_review', 'needs_review', 'not_started', 'not_started', 'medium', 'Provider selection and DPA required.', '{"phase":158}'::jsonb),
  ('whatsapp-provider', 'WhatsApp provider', 'whatsapp', 'WhatsApp templates and support readiness.', '["phone_numbers","message_metadata"]'::jsonb, 'needs_review', 'needs_review', 'not_started', 'not_started', 'medium', 'Provider approval and data-processing terms required.', '{"phase":158}'::jsonb),
  ('payment-provider', 'Payment provider', 'payment', 'Tokenized subscription and parent payment facilitation.', '["billing_metadata","transaction_references"]'::jsonb, 'needs_review', 'needs_review', 'not_started', 'not_started', 'high', 'No raw card storage; provider contracts required.', '{"phase":158}'::jsonb),
  ('camera-gateway-provider', 'Camera gateway provider', 'camera_gateway', 'WebRTC/streaming gateway for parent and inspector viewing.', '["camera_metadata","session_logs","stream_tokens"]'::jsonb, 'needs_review', 'needs_review', 'not_started', 'not_started', 'high', 'No direct RTSP exposure; gateway security proof required.', '{"phase":158}'::jsonb),
  ('ai-provider', 'AI provider', 'ai', 'Future AI model and assistant provider readiness.', '["deidentified_metadata","skeleton_events","prompts_where_allowed"]'::jsonb, 'needs_review', 'needs_review', 'not_started', 'not_started', 'high', 'No raw child profiling; DPIA and legal approval required.', '{"phase":158}'::jsonb)
on conflict (supplier_key) do update set
  supplier_name = excluded.supplier_name,
  supplier_type = excluded.supplier_type,
  purpose = excluded.purpose,
  data_processed = excluded.data_processed,
  security_review_status = excluded.security_review_status,
  privacy_review_status = excluded.privacy_review_status,
  contract_status = excluded.contract_status,
  dpa_status = excluded.dpa_status,
  risk_rating = excluded.risk_rating,
  notes = excluded.notes,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.iso_gap_analysis_items (gap_key, standard, control_id, gap_description, severity, owner_role, due_date, status, remediation_plan, metadata)
values
  ('iso-gap-policy-approval', 'combined', 'Governance', 'Core policies exist but formal approval and review evidence are not complete.', 'high', 'admin', current_date + 45, 'open', 'Approve policy versions, record approver and attach evidence item.', '{"phase":158}'::jsonb),
  ('iso-gap-supplier-dpa', 'iso_27701', 'Supplier', 'Supplier DPA and privacy review evidence is incomplete for production providers.', 'high', 'admin', current_date + 60, 'open', 'Collect contracts, DPAs and supplier security reviews.', '{"phase":158}'::jsonb),
  ('iso-gap-restore-test-evidence', 'iso_27001', 'Continuity', 'Restore test evidence must be executed and attached before external audit.', 'medium', 'admin', current_date + 60, 'in_progress', 'Run isolated restore test and upload evidence.', '{"phase":158}'::jsonb),
  ('iso-gap-access-review-cycle', 'iso_27001', 'Access', 'Periodic access review record is not yet completed.', 'medium', 'admin', current_date + 30, 'open', 'Run first admin/manager/staff access review and record revoked accounts.', '{"phase":158}'::jsonb),
  ('iso-gap-external-auditor-view', 'combined', 'Audit binder', 'External auditor limited-access mode is not active yet.', 'low', 'admin', current_date + 90, 'open', 'Prepare metadata-only auditor access without child, medical, camera or secret data.', '{"phase":158}'::jsonb)
on conflict (gap_key) do update set
  standard = excluded.standard,
  control_id = excluded.control_id,
  gap_description = excluded.gap_description,
  severity = excluded.severity,
  owner_role = excluded.owner_role,
  due_date = excluded.due_date,
  status = excluded.status,
  remediation_plan = excluded.remediation_plan,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.iso_access_reviews (review_key, scope, reviewed_users_count, privileged_users_count, inactive_users_count, revoked_access_count, reviewer_role, review_status, review_date, next_review_due_at, findings, metadata)
values
  ('initial-admin-access-review', 'admins', 0, 0, 0, 0, 'admin', 'planned', null, current_date + 30, '[]'::jsonb, '{"phase":158}'::jsonb),
  ('initial-platform-access-review', 'all_users', 0, 0, 0, 0, 'admin', 'planned', null, current_date + 30, '[]'::jsonb, '{"phase":158}'::jsonb)
on conflict (review_key) do update set
  scope = excluded.scope,
  review_status = excluded.review_status,
  next_review_due_at = excluded.next_review_due_at,
  findings = excluded.findings,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.iso_review_schedule_items (schedule_key, review_area, title, owner_role, cadence, next_review_due_at, status, related_table, metadata)
values
  ('policy-review-quarterly', 'policy', 'Quarterly policy review', 'admin', 'quarterly', now() + interval '90 days', 'scheduled', 'security_policies_repository', '{"phase":158}'::jsonb),
  ('supplier-review-quarterly', 'supplier', 'Supplier security and privacy review', 'admin', 'quarterly', now() + interval '90 days', 'scheduled', 'iso_supplier_evidence', '{"phase":158}'::jsonb),
  ('access-review-quarterly', 'access_review', 'Privileged access review', 'admin', 'quarterly', now() + interval '90 days', 'scheduled', 'iso_access_reviews', '{"phase":158}'::jsonb),
  ('backup-test-review-semiannual', 'backup_test', 'Backup and restore evidence review', 'admin', 'semi_annual', now() + interval '180 days', 'scheduled', 'backup_readiness_checks', '{"phase":158}'::jsonb),
  ('ai-governance-review-quarterly', 'ai_governance', 'AI governance and DPIA review', 'admin', 'quarterly', now() + interval '90 days', 'scheduled', 'ai_capabilities', '{"phase":158}'::jsonb)
on conflict (schedule_key) do update set
  review_area = excluded.review_area,
  title = excluded.title,
  owner_role = excluded.owner_role,
  cadence = excluded.cadence,
  next_review_due_at = excluded.next_review_due_at,
  status = excluded.status,
  related_table = excluded.related_table,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.security_readiness_checks (category, check_key, title, status, severity, evidence_summary, recommended_action, metadata)
values
  ('iso_evidence', 'phase158-iso-evidence-repository', 'ISO evidence repository', 'partial', 'high', 'Evidence item registry covers policies, audit logs, CI/CD, cloud, privacy, AI and camera controls.', 'Upload formal files and mark reviewed/approved evidence before external audit.', '{"phase":158}'::jsonb),
  ('statement_of_applicability', 'phase158-soa-readiness', 'Statement of Applicability readiness', 'partial', 'high', 'SoA rows identify applicable control groups and implementation status.', 'Complete control-by-control ISO 27001 SoA with justifications and evidence links.', '{"phase":158}'::jsonb),
  ('supplier_review', 'phase158-supplier-pack', 'Supplier evidence pack', 'partial', 'high', 'Supplier records exist for Supabase, Vercel, GitHub, messaging, payment, camera and AI providers.', 'Attach contracts, DPAs, security reviews and privacy reviews.', '{"phase":158}'::jsonb),
  ('audit_binder', 'phase158-audit-binder-readiness', 'Audit binder export readiness', 'needs_review', 'medium', 'Audit binder table and export scope model are ready without sensitive data by default.', 'Implement actual PDF/ZIP/CSV export route after evidence files are uploaded.', '{"phase":158}'::jsonb),
  ('policy_repository', 'phase158-policy-repository', 'Policy repository', 'partial', 'high', 'Security policy repository supports ISO standards, approval status, effective date and review date.', 'Approve policy versions and record management sign-off.', '{"phase":158}'::jsonb)
on conflict (check_key) do update set
  category = excluded.category,
  title = excluded.title,
  status = excluded.status,
  severity = excluded.severity,
  evidence_summary = excluded.evidence_summary,
  recommended_action = excluded.recommended_action,
  metadata = excluded.metadata,
  updated_at = now();

comment on table public.iso_evidence_items is 'ISO evidence repository for ISO 27001, 27017 and 27701 audit preparation. Store metadata only; do not store secrets.';
comment on table public.iso_statement_of_applicability is 'Statement of Applicability readiness records for ISO 27001 controls. Documentation only, not a certification claim.';
comment on table public.security_procedures is 'Procedure repository for operational ISO evidence: onboarding, offboarding, access review, MFA, backup, incident response and privacy requests.';
comment on table public.iso_supplier_evidence is 'Supplier evidence pack covering purpose, processed data, security review, privacy review, contract and DPA status.';
comment on table public.iso_gap_analysis_items is 'ISO gap analysis and remediation lifecycle for external audit readiness.';
comment on table public.iso_audit_binder_exports is 'Audit binder export metadata. Exports must exclude secrets, child personal data, medical data, raw camera feeds and payment details.';
