-- PHASE 150: ISO 27001, ISO 27017 & ISO 27701 Certification Readiness Platform

create extension if not exists "pgcrypto";

alter table if exists public.security_readiness_checks
  drop constraint if exists security_readiness_category_check;

alter table if exists public.security_readiness_checks
  add constraint security_readiness_category_check
  check (category in (
    'authentication','mfa','authorization','access_control','rls','api_protection','secrets',
    'encryption','audit_logging','backup','disaster_recovery','rate_limiting','monitoring',
    'privacy','provider_security','compliance','training','session_security','device_trust',
    'iso_27001','iso_27017','iso_27701','asset_inventory','risk_management','internal_audit'
  ));

alter table if exists public.staff
  add column if not exists police_sex_offender_clearance_status text not null default 'missing',
  add column if not exists police_sex_offender_clearance_expires_at date,
  add column if not exists first_aid_certification_status text not null default 'missing',
  add column if not exists first_aid_certification_expires_at date,
  add column if not exists safe_conduct_training_status text not null default 'missing',
  add column if not exists safe_conduct_training_expires_at date,
  add column if not exists mandatory_permit_metadata jsonb not null default '{}'::jsonb;

alter table if exists public.gardens
  add column if not exists fire_safety_permit_status text not null default 'missing',
  add column if not exists fire_safety_permit_expires_at date,
  add column if not exists home_front_command_readiness_status text not null default 'missing',
  add column if not exists home_front_command_readiness_expires_at date,
  add column if not exists operating_permit_status text not null default 'missing',
  add column if not exists operating_permit_expires_at date,
  add column if not exists camera_law_declaration_status text not null default 'missing',
  add column if not exists camera_law_declaration_expires_at date,
  add column if not exists iso_certification_notes text;

alter table if exists public.audit_logs
  add column if not exists user_uuid uuid references public.profiles(id) on delete set null,
  add column if not exists user_role text,
  add column if not exists http_method text,
  add column if not exists api_endpoint text,
  add column if not exists client_source_ip inet,
  add column if not exists http_status_code integer,
  add column if not exists request_id text,
  add column if not exists compliance_context jsonb not null default '{}'::jsonb;

create table if not exists public.iso_controls (
  id uuid primary key default gen_random_uuid(),
  control_key text not null unique,
  control_id text not null,
  standard text not null,
  category text not null,
  title text not null,
  description text,
  implementation_status text not null default 'planned',
  evidence_status text not null default 'missing',
  policy_status text not null default 'missing',
  owner_role text not null default 'admin',
  owner_profile_id uuid references public.profiles(id) on delete set null,
  evidence_links jsonb not null default '[]'::jsonb,
  coverage_items jsonb not null default '[]'::jsonb,
  gap_summary text,
  remediation_plan text,
  due_at timestamptz,
  reviewed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint iso_controls_standard_check check (standard in ('iso_27001','iso_27017','iso_27701')),
  constraint iso_controls_implementation_status_check check (implementation_status in ('implemented','partial','planned','not_applicable','blocked')),
  constraint iso_controls_evidence_status_check check (evidence_status in ('approved','collected','partial','missing','expired')),
  constraint iso_controls_policy_status_check check (policy_status in ('approved','draft','missing','needs_review','not_required'))
);

create table if not exists public.asset_inventory (
  id uuid primary key default gen_random_uuid(),
  asset_key text not null unique,
  asset_type text not null,
  asset_name text not null,
  provider text not null,
  environment text not null default 'production',
  data_classification text not null default 'internal',
  owner_role text not null default 'admin',
  garden_id uuid references public.gardens(id) on delete set null,
  region text,
  contains_child_data boolean not null default false,
  contains_medical_data boolean not null default false,
  contains_camera_data boolean not null default false,
  encryption_required boolean not null default false,
  backup_required boolean not null default true,
  rls_required boolean not null default true,
  security_status text not null default 'needs_review',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint asset_inventory_type_check check (asset_type in ('database','serverless_function','api','storage_bucket','camera_configuration','ai_pipeline','ci_cd','edge_hosting','mobile_app','integration','secret')),
  constraint asset_inventory_classification_check check (data_classification in ('public','internal','confidential','sensitive','medical','regulated')),
  constraint asset_inventory_security_status_check check (security_status in ('ready','partial','needs_review','blocked','retired'))
);

create table if not exists public.risk_register (
  id uuid primary key default gen_random_uuid(),
  risk_key text not null unique,
  standard text,
  risk_domain text not null,
  risk_description text not null,
  severity text not null,
  likelihood text not null,
  impact_summary text,
  mitigation_strategy text,
  remediation_status text not null default 'open',
  owner_role text not null default 'admin',
  owner_profile_id uuid references public.profiles(id) on delete set null,
  due_at timestamptz,
  closed_at timestamptz,
  accepted_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint risk_register_standard_check check (standard is null or standard in ('iso_27001','iso_27017','iso_27701','israeli_privacy','kindergarten_regulation')),
  constraint risk_register_severity_check check (severity in ('critical','high','medium','low')),
  constraint risk_register_likelihood_check check (likelihood in ('very_likely','likely','possible','unlikely','rare')),
  constraint risk_register_status_check check (remediation_status in ('open','mitigating','mitigated','verified','accepted_risk','closed'))
);

create table if not exists public.internal_audits (
  id uuid primary key default gen_random_uuid(),
  audit_key text not null unique,
  standard text not null,
  audit_scope text not null,
  audit_status text not null default 'planned',
  auditor_name text,
  auditor_profile_id uuid references public.profiles(id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  findings jsonb not null default '[]'::jsonb,
  corrective_actions jsonb not null default '[]'::jsonb,
  closure_status text not null default 'open',
  closure_summary text,
  next_audit_due_at timestamptz,
  evidence_links jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint internal_audits_standard_check check (standard in ('iso_27001','iso_27017','iso_27701','combined')),
  constraint internal_audits_status_check check (audit_status in ('planned','in_progress','completed','cancelled')),
  constraint internal_audits_closure_check check (closure_status in ('open','corrective_actions_open','ready_for_closure','closed'))
);

create table if not exists public.permit_expiry_alerts (
  id uuid primary key default gen_random_uuid(),
  alert_key text not null unique,
  garden_id uuid references public.gardens(id) on delete cascade,
  staff_id uuid references public.staff(id) on delete cascade,
  permit_type text not null,
  permit_label text not null,
  expires_at date not null,
  alert_level text not null default 'six_months',
  status text not null default 'open',
  pushed_to_admin boolean not null default false,
  notification_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint permit_expiry_alert_type_check check (permit_type in ('police_sex_offender_clearance','first_aid_certification','safe_conduct_training','fire_safety','home_front_command','operating_permit','camera_law_declaration')),
  constraint permit_expiry_alert_level_check check (alert_level in ('six_months','three_months','one_month','expired')),
  constraint permit_expiry_alert_status_check check (status in ('open','notified','resolved','dismissed'))
);

create table if not exists public.iso_readiness_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null default current_date,
  iso_27001_readiness integer not null default 0,
  iso_27017_readiness integer not null default 0,
  iso_27701_readiness integer not null default 0,
  iso_readiness_score integer not null default 0,
  open_gaps jsonb not null default '[]'::jsonb,
  evidence_summary jsonb not null default '{}'::jsonb,
  policy_summary jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(snapshot_date),
  constraint iso_readiness_scores_range_check check (
    iso_27001_readiness between 0 and 100
    and iso_27017_readiness between 0 and 100
    and iso_27701_readiness between 0 and 100
    and iso_readiness_score between 0 and 100
  )
);

create table if not exists public.right_to_be_forgotten_runs (
  id uuid primary key default gen_random_uuid(),
  run_key text not null unique,
  garden_id uuid references public.gardens(id) on delete set null,
  parent_profile_id uuid references public.profiles(id) on delete set null,
  parent_id uuid references public.parents(id) on delete set null,
  status text not null default 'planned',
  pii_deleted boolean not null default false,
  signatures_deleted boolean not null default false,
  medical_history_deleted boolean not null default false,
  anonymized_telemetry_preserved boolean not null default true,
  executed_by uuid references public.profiles(id) on delete set null,
  executed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rtbf_status_check check (status in ('planned','running','completed','failed','cancelled'))
);

create index if not exists iso_controls_standard_status_idx on public.iso_controls(standard, implementation_status, evidence_status);
create index if not exists asset_inventory_type_status_idx on public.asset_inventory(asset_type, security_status);
create index if not exists risk_register_status_idx on public.risk_register(remediation_status, severity, due_at);
create index if not exists internal_audits_status_idx on public.internal_audits(standard, audit_status, closure_status);
create index if not exists permit_expiry_alerts_status_idx on public.permit_expiry_alerts(status, expires_at);
create index if not exists iso_readiness_snapshots_date_idx on public.iso_readiness_snapshots(snapshot_date desc);

alter table public.iso_controls enable row level security;
alter table public.asset_inventory enable row level security;
alter table public.risk_register enable row level security;
alter table public.internal_audits enable row level security;
alter table public.permit_expiry_alerts enable row level security;
alter table public.iso_readiness_snapshots enable row level security;
alter table public.right_to_be_forgotten_runs enable row level security;

drop policy if exists "iso controls admin only" on public.iso_controls;
create policy "iso controls admin only" on public.iso_controls for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "asset inventory admin only" on public.asset_inventory;
create policy "asset inventory admin only" on public.asset_inventory for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "risk register admin only" on public.risk_register;
create policy "risk register admin only" on public.risk_register for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "internal audits admin only" on public.internal_audits;
create policy "internal audits admin only" on public.internal_audits for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "permit expiry alerts admin manager read" on public.permit_expiry_alerts;
create policy "permit expiry alerts admin manager read" on public.permit_expiry_alerts
for select using (public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "permit expiry alerts admin write" on public.permit_expiry_alerts;
create policy "permit expiry alerts admin write" on public.permit_expiry_alerts for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "iso readiness snapshots admin only" on public.iso_readiness_snapshots;
create policy "iso readiness snapshots admin only" on public.iso_readiness_snapshots for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "rtbf runs admin only" on public.right_to_be_forgotten_runs;
create policy "rtbf runs admin only" on public.right_to_be_forgotten_runs for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.jwt_garden_id()
returns uuid
language sql
stable
as $$
  select nullif(coalesce(auth.jwt() ->> 'kindergarten_id', auth.jwt() ->> 'garden_id'), '')::uuid
$$;

create or replace function public.jwt_room_uuid()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'room_uuid', '')::uuid
$$;

create or replace function public.iso_control_score(p_implementation text, p_evidence text, p_policy text)
returns integer
language sql
immutable
as $$
  select round((
    case p_implementation when 'implemented' then 100 when 'partial' then 60 when 'not_applicable' then 100 when 'planned' then 25 else 0 end * 0.45
    + case p_evidence when 'approved' then 100 when 'collected' then 80 when 'partial' then 45 when 'expired' then 20 else 0 end * 0.35
    + case p_policy when 'approved' then 100 when 'draft' then 55 when 'needs_review' then 35 when 'not_required' then 100 else 0 end * 0.20
  ))::int
$$;

create or replace function public.block_audit_logs_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'audit_logs is append-only and cannot be updated or deleted';
end;
$$;

drop trigger if exists audit_logs_block_update on public.audit_logs;
create trigger audit_logs_block_update
before update on public.audit_logs
for each row execute function public.block_audit_logs_mutation();

drop trigger if exists audit_logs_block_delete on public.audit_logs;
create trigger audit_logs_block_delete
before delete on public.audit_logs
for each row execute function public.block_audit_logs_mutation();

alter table if exists public.gardens enable row level security;
alter table if exists public.profiles enable row level security;
alter table if exists public.parents enable row level security;
alter table if exists public.children enable row level security;
alter table if exists public.staff enable row level security;
alter table if exists public.attendance enable row level security;
alter table if exists public.camera_streams enable row level security;
alter table if exists public.documents enable row level security;
alter table if exists public.tasks enable row level security;
alter table if exists public.messages enable row level security;
alter table if exists public.notifications enable row level security;
alter table if exists public.audit_logs enable row level security;

drop policy if exists "jwt tenant children read" on public.children;
create policy "jwt tenant children read" on public.children
for select using (
  public.is_admin()
  or public.can_access_garden(garden_id)
  or garden_id = public.jwt_garden_id()
  or exists (select 1 from public.parents p where p.id = primary_parent_id and (p.profile_id = auth.uid() or p.user_id = auth.uid()))
);

drop policy if exists "jwt tenant staff read" on public.staff;
create policy "jwt tenant staff read" on public.staff
for select using (
  public.is_admin()
  or public.can_access_garden(garden_id)
  or garden_id = public.jwt_garden_id()
  or profile_id = auth.uid()
);

drop policy if exists "jwt tenant attendance read" on public.attendance;
create policy "jwt tenant attendance read" on public.attendance
for select using (
  public.is_admin()
  or public.can_access_garden(garden_id)
  or garden_id = public.jwt_garden_id()
  or exists (
    select 1
    from public.children c
    join public.parents p on p.id = c.primary_parent_id
    where c.id = attendance.child_id and (p.profile_id = auth.uid() or p.user_id = auth.uid())
  )
);

drop policy if exists "jwt tenant camera streams read" on public.camera_streams;
create policy "jwt tenant camera streams read" on public.camera_streams
for select using (
  public.is_admin()
  or public.can_access_garden(coalesce(garden_id, kindergarten_id))
  or coalesce(garden_id, kindergarten_id) = public.jwt_garden_id()
);

drop policy if exists "audit logs append scoped" on public.audit_logs;
create policy "audit logs append scoped" on public.audit_logs
for insert with check (public.is_admin() or actor_id = auth.uid() or user_uuid = auth.uid());

drop policy if exists "audit logs admin read" on public.audit_logs;
create policy "audit logs admin read" on public.audit_logs
for select using (public.is_admin());

insert into public.iso_controls (control_key, control_id, standard, category, title, description, implementation_status, evidence_status, policy_status, owner_role, evidence_links, coverage_items, gap_summary, remediation_plan, metadata)
values
  ('iso27001-a5-policy', 'A.5', 'iso_27001', 'Organizational controls', 'Information security policies', 'Security, privacy, retention, camera and AI policies are tracked as evidence.', 'partial', 'collected', 'draft', 'admin', '["security_policies_repository","regulatory_policy_modes"]'::jsonb, '["policy_repository","regulatory_mode"]'::jsonb, 'Policies exist but formal approval cycle is pending.', 'Approve policy versions and attach board/management approval evidence.', '{"phase":150}'::jsonb),
  ('iso27001-a8-encryption', 'A.8.24', 'iso_27001', 'Technological controls', 'Use of cryptography', 'Sensitive child and medical fields are encrypted before Supabase persistence.', 'partial', 'collected', 'approved', 'admin', '["encrypted_field_registry","lib/security/encryption.ts"]'::jsonb, '["medical_fields","camera_credentials"]'::jsonb, 'Historical plaintext migration still needs execution evidence.', 'Run migration job and record coverage after production key activation.', '{"phase":150}'::jsonb),
  ('iso27001-a8-audit', 'A.8.15', 'iso_27001', 'Technological controls', 'Logging and monitoring', 'Audit logs are append-only through database triggers and application middleware.', 'partial', 'partial', 'draft', 'admin', '["audit_logs","security_events"]'::jsonb, '["api_requests","camera_viewing","medical_access"]'::jsonb, 'Full request coverage depends on production environment variables.', 'Enable audit route logging in Vercel and review log volume.', '{"phase":150}'::jsonb),
  ('iso27017-cloud-shared-responsibility', 'CLD.6.3.1', 'iso_27017', 'Cloud controls', 'Cloud shared responsibility model', 'Vercel, Supabase and GitHub responsibilities are mapped in asset inventory.', 'partial', 'collected', 'draft', 'admin', '["asset_inventory"]'::jsonb, '["vercel","supabase","github"]'::jsonb, 'Provider attestation documents are not attached yet.', 'Attach Supabase, Vercel and GitHub security/compliance evidence.', '{"phase":150}'::jsonb),
  ('iso27017-cloud-secrets', 'CLD.9.5.1', 'iso_27017', 'Cloud controls', 'Cloud secrets and environment isolation', 'Secrets are required from Vercel process.env and server-only helpers.', 'partial', 'collected', 'approved', 'admin', '["security_secret_inventory","vercel.json"]'::jsonb, '["supabase_service_role","field_encryption_key","provider_tokens"]'::jsonb, 'Rotation evidence is pending.', 'Define rotation cadence and record last rotation per secret.', '{"phase":150}'::jsonb),
  ('iso27701-pii-minimization', 'PIMS.7.4.1', 'iso_27701', 'PII processing', 'Privacy by design and minimization', 'AI/video processing stores abstract keypoints and approved summaries rather than raw identity data.', 'partial', 'collected', 'approved', 'admin', '["ai_capabilities","vertical_capability_matrix","privacy_by_design_controls"]'::jsonb, '["no_face","no_audio","human_review"]'::jsonb, 'Evidence for runtime memory wipe is architectural, not independently tested.', 'Add integration tests around skeleton-only ingestion before production.', '{"phase":150}'::jsonb),
  ('iso27701-data-subject-rights', 'PIMS.7.3.1', 'iso_27701', 'PII rights', 'Data subject rights and erasure', 'Right-to-be-forgotten run registry and script preserve anonymous telemetry while removing PII.', 'partial', 'partial', 'draft', 'admin', '["privacy_rights_requests","right_to_be_forgotten_runs"]'::jsonb, '["parents","children","medical","signatures"]'::jsonb, 'Needs legal approval and test-run evidence.', 'Run dry-run on demo tenant and attach evidence.', '{"phase":150}'::jsonb)
on conflict (control_key) do update set
  control_id = excluded.control_id,
  standard = excluded.standard,
  category = excluded.category,
  title = excluded.title,
  description = excluded.description,
  implementation_status = excluded.implementation_status,
  evidence_status = excluded.evidence_status,
  policy_status = excluded.policy_status,
  evidence_links = excluded.evidence_links,
  coverage_items = excluded.coverage_items,
  gap_summary = excluded.gap_summary,
  remediation_plan = excluded.remediation_plan,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.asset_inventory (asset_key, asset_type, asset_name, provider, environment, data_classification, contains_child_data, contains_medical_data, contains_camera_data, encryption_required, backup_required, rls_required, security_status, metadata)
values
  ('supabase-postgres-prod', 'database', 'Supabase PostgreSQL production database', 'Supabase', 'production', 'regulated', true, true, true, true, true, true, 'partial', '{"engine":"postgresql","rls_required":true}'::jsonb),
  ('vercel-edge-api', 'serverless_function', 'Vercel Next.js API routes and server actions', 'Vercel', 'production', 'sensitive', true, true, false, true, true, false, 'partial', '{"secrets_source":"process.env"}'::jsonb),
  ('github-ci-cd', 'ci_cd', 'GitHub Actions security gates', 'GitHub', 'production', 'internal', false, false, false, false, true, false, 'partial', '{"codeql":true,"secret_scan":true}'::jsonb),
  ('camera-stream-configs', 'camera_configuration', 'Kindergarten camera connection and permission configuration', 'Supabase', 'production', 'regulated', true, false, true, true, true, true, 'partial', '{"direct_rtsp_exposure_blocked":true}'::jsonb),
  ('observer-skeleton-pipeline', 'ai_pipeline', 'Digital Observer skeleton-only anomaly pipeline', 'Gan Batuach', 'production', 'regulated', true, false, true, false, true, true, 'partial', '{"raw_pixels_stored":false,"face_recognition":false,"audio_processing":false}'::jsonb)
on conflict (asset_key) do update set
  asset_type = excluded.asset_type,
  asset_name = excluded.asset_name,
  provider = excluded.provider,
  environment = excluded.environment,
  data_classification = excluded.data_classification,
  contains_child_data = excluded.contains_child_data,
  contains_medical_data = excluded.contains_medical_data,
  contains_camera_data = excluded.contains_camera_data,
  encryption_required = excluded.encryption_required,
  backup_required = excluded.backup_required,
  rls_required = excluded.rls_required,
  security_status = excluded.security_status,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.risk_register (risk_key, standard, risk_domain, risk_description, severity, likelihood, impact_summary, mitigation_strategy, remediation_status, owner_role, due_at, metadata)
values
  ('iso-risk-formal-policy-approval', 'iso_27001', 'governance', 'Security and privacy policies need formal approval evidence before certification audit.', 'high', 'likely', 'Certification evidence gap.', 'Approve policy versions and attach evidence in the policy repository.', 'mitigating', 'admin', now() + interval '30 days', '{"phase":150}'::jsonb),
  ('iso-risk-provider-attestations', 'iso_27017', 'cloud', 'Cloud provider compliance evidence must be collected for Supabase, Vercel and GitHub.', 'medium', 'likely', 'Cloud control evidence incomplete.', 'Attach SOC/ISO/security documentation per provider.', 'open', 'admin', now() + interval '45 days', '{"phase":150}'::jsonb),
  ('iso-risk-ai-runtime-verification', 'iso_27701', 'ai_privacy', 'Skeleton-only AI runtime memory wipe needs production test evidence.', 'high', 'possible', 'Privacy-by-design claim requires test evidence.', 'Add integration tests and audit evidence for raw frame disposal.', 'mitigating', 'admin', now() + interval '45 days', '{"phase":150}'::jsonb)
on conflict (risk_key) do update set
  standard = excluded.standard,
  risk_domain = excluded.risk_domain,
  risk_description = excluded.risk_description,
  severity = excluded.severity,
  likelihood = excluded.likelihood,
  impact_summary = excluded.impact_summary,
  mitigation_strategy = excluded.mitigation_strategy,
  remediation_status = excluded.remediation_status,
  due_at = excluded.due_at,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.internal_audits (audit_key, standard, audit_scope, audit_status, findings, corrective_actions, closure_status, next_audit_due_at, evidence_links, metadata)
values
  ('phase-150-combined-readiness-audit', 'combined', 'ISO 27001/27017/27701 readiness, cloud controls, privacy controls, AI governance and evidence coverage.', 'in_progress', '[{"severity":"high","title":"Formal evidence collection pending"},{"severity":"medium","title":"Provider attestations pending"}]'::jsonb, '[{"owner":"admin","action":"approve policies"},{"owner":"admin","action":"attach cloud provider evidence"},{"owner":"admin","action":"run DPIA evidence review"}]'::jsonb, 'corrective_actions_open', now() + interval '90 days', '["iso_controls","asset_inventory","risk_register"]'::jsonb, '{"phase":150}'::jsonb)
on conflict (audit_key) do update set
  audit_status = excluded.audit_status,
  findings = excluded.findings,
  corrective_actions = excluded.corrective_actions,
  closure_status = excluded.closure_status,
  next_audit_due_at = excluded.next_audit_due_at,
  evidence_links = excluded.evidence_links,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.security_readiness_checks (category, check_key, title, status, severity, evidence_summary, recommended_action, metadata)
values
  ('iso_27001', 'iso-27001-control-evidence-coverage', 'ISO 27001 control evidence coverage', 'partial', 'high', 'ISO control tracker, risk register and internal audit schemas are available.', 'Approve policies, attach evidence and close high risks.', '{"phase":150}'::jsonb),
  ('iso_27017', 'iso-27017-cloud-provider-coverage', 'ISO 27017 cloud provider coverage', 'partial', 'high', 'Vercel, Supabase and GitHub are represented in the asset inventory.', 'Attach provider security attestations and shared responsibility evidence.', '{"phase":150}'::jsonb),
  ('iso_27701', 'iso-27701-privacy-ai-coverage', 'ISO 27701 privacy and AI coverage', 'partial', 'high', 'DPIA, AI governance and privacy controls exist.', 'Complete DPIA approvals and right-to-be-forgotten dry run.', '{"phase":150}'::jsonb),
  ('rls', 'core-table-tenant-isolation-policies', 'Core table tenant isolation policies', 'partial', 'critical', 'Core tables have RLS enabled and JWT garden metadata helper policies added.', 'Review every table with production JWT claims and Supabase RLS tests.', '{"phase":150}'::jsonb),
  ('audit_logging', 'audit-log-tamper-lockdown', 'Audit log tampering lockdown', 'ready', 'critical', 'Database triggers block UPDATE and DELETE on audit_logs.', 'Validate in staging with service client and document the result.', '{"phase":150}'::jsonb)
on conflict (check_key) do update set
  category = excluded.category,
  title = excluded.title,
  status = excluded.status,
  severity = excluded.severity,
  evidence_summary = excluded.evidence_summary,
  recommended_action = excluded.recommended_action,
  metadata = excluded.metadata,
  updated_at = now();

comment on table public.iso_controls is 'ISO 27001, 27017 and 27701 control tracker with implementation, evidence and policy coverage.';
comment on table public.asset_inventory is 'ISO asset inventory for Supabase, Vercel, GitHub, APIs, storage, cameras and AI pipelines.';
comment on table public.risk_register is 'Certification and privacy risk register with mitigation and remediation lifecycle.';
comment on table public.internal_audits is 'Internal audit scope, findings, corrective actions and closure status.';
comment on table public.permit_expiry_alerts is 'Israeli mandatory staff/kindergarten permit expiry alerts generated 6 months before expiration.';
