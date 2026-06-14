-- PHASE 157: CI/CD Security Gates, SAST, DAST, Dependency & Secret Scanning Platform

alter table if exists public.security_readiness_checks
  drop constraint if exists security_readiness_category_check;

alter table if exists public.security_readiness_checks
  add constraint security_readiness_category_check
  check (category in (
    'authentication','mfa','authorization','access_control','rls','api_protection','secrets',
    'encryption','audit_logging','backup','disaster_recovery','rate_limiting','monitoring',
    'privacy','provider_security','compliance','training','session_security','device_trust',
    'iso_27001','iso_27017','iso_27701','asset_inventory','risk_management','internal_audit',
    'ci_cd','sast','dast','dependency_scanning','secret_scanning','migration_safety','branch_protection'
  ));

create table if not exists public.security_pipeline_runs (
  id uuid primary key default gen_random_uuid(),
  run_key text not null unique,
  provider text not null default 'github_actions',
  workflow_name text not null,
  branch_name text,
  commit_sha text,
  trigger_event text,
  status text not null default 'pending',
  typecheck_status text not null default 'pending',
  build_status text not null default 'pending',
  diff_check_status text not null default 'pending',
  dependency_scan_status text not null default 'pending',
  secret_scan_status text not null default 'pending',
  codeql_status text not null default 'pending',
  migration_safety_status text not null default 'pending',
  critical_findings integer not null default 0,
  high_findings integer not null default 0,
  production_readiness_status text not null default 'not_ready',
  started_at timestamptz,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint security_pipeline_run_status_check check (status in ('pending','running','passed','failed','cancelled','manual_review')),
  constraint security_pipeline_gate_status_check check (
    typecheck_status in ('pending','passed','failed','skipped') and
    build_status in ('pending','passed','failed','skipped') and
    diff_check_status in ('pending','passed','failed','skipped') and
    dependency_scan_status in ('pending','passed','failed','skipped','provider_required') and
    secret_scan_status in ('pending','passed','failed','skipped','provider_required') and
    codeql_status in ('pending','passed','failed','skipped','provider_required') and
    migration_safety_status in ('pending','passed','failed','skipped')
  ),
  constraint security_pipeline_prod_status_check check (production_readiness_status in ('ready','not_ready','blocked','accepted_risk','manual_review'))
);

create table if not exists public.security_pipeline_findings (
  id uuid primary key default gen_random_uuid(),
  finding_key text not null unique,
  pipeline_run_id uuid references public.security_pipeline_runs(id) on delete set null,
  finding_type text not null,
  severity text not null,
  source text not null,
  status text not null default 'open',
  owner_role text not null default 'admin',
  owner_profile_id uuid references public.profiles(id) on delete set null,
  remediation text,
  affected_path text,
  affected_dependency text,
  cve_id text,
  accepted_risk_reason text,
  accepted_risk_expires_at timestamptz,
  accepted_by uuid references public.profiles(id) on delete set null,
  mitigation_plan text,
  resolved_at timestamptz,
  verified_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint security_pipeline_finding_type_check check (finding_type in ('sast','dast','dependency','secret','migration','rls','storage','headers','branch_protection','build','typecheck','policy')),
  constraint security_pipeline_finding_severity_check check (severity in ('critical','high','medium','low','info')),
  constraint security_pipeline_finding_status_check check (status in ('open','triaged','accepted_risk','fixed','verified')),
  constraint security_pipeline_accepted_risk_check check (
    status <> 'accepted_risk' or (accepted_risk_reason is not null and accepted_risk_expires_at is not null and mitigation_plan is not null)
  )
);

create table if not exists public.security_pipeline_controls (
  id uuid primary key default gen_random_uuid(),
  control_key text not null unique,
  control_area text not null,
  title text not null,
  status text not null default 'partial',
  required boolean not null default true,
  blocking boolean not null default true,
  tool_name text,
  workflow_file text,
  evidence_summary text,
  next_step text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint security_pipeline_control_status_check check (status in ('ready','partial','missing','blocked','provider_required')),
  constraint security_pipeline_control_area_check check (control_area in ('typecheck','build','dependency','secret','sast','dast','migration','branch_protection','vercel','supabase','policy'))
);

create index if not exists security_pipeline_runs_status_idx on public.security_pipeline_runs(status, created_at desc);
create index if not exists security_pipeline_findings_status_idx on public.security_pipeline_findings(status, severity, created_at desc);
create index if not exists security_pipeline_findings_source_idx on public.security_pipeline_findings(source, finding_type);
create index if not exists security_pipeline_controls_area_idx on public.security_pipeline_controls(control_area, status);

alter table public.security_pipeline_runs enable row level security;
alter table public.security_pipeline_findings enable row level security;
alter table public.security_pipeline_controls enable row level security;

drop policy if exists "security pipeline runs admin only" on public.security_pipeline_runs;
create policy "security pipeline runs admin only" on public.security_pipeline_runs for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "security pipeline findings admin only" on public.security_pipeline_findings;
create policy "security pipeline findings admin only" on public.security_pipeline_findings for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "security pipeline controls admin only" on public.security_pipeline_controls;
create policy "security pipeline controls admin only" on public.security_pipeline_controls for all using (public.is_admin()) with check (public.is_admin());

-- Seed rows are optional operational readiness data. They are wrapped so a broken
-- pre-existing trigger/function in a live database cannot abort the structural migration.
do $$
begin
  insert into public.security_pipeline_controls (control_key, control_area, title, status, required, blocking, tool_name, workflow_file, evidence_summary, next_step, metadata)
  values
    ('typecheck-gate', 'typecheck', 'TypeScript typecheck gate', 'ready', true, true, 'npm run typecheck', '.github/workflows/security-checks.yml', 'Security workflow runs npm run typecheck and blocks readiness if it fails.', 'Fix existing TypeScript errors before production branch protection is enforced.', '{"phase":157}'::jsonb),
    ('build-gate', 'build', 'Next.js build gate', 'ready', true, true, 'npm run build', '.github/workflows/security-checks.yml', 'Security workflow runs npm run build and blocks readiness if it fails.', 'Repair local/CI dependency installation and require build check before merge.', '{"phase":157}'::jsonb),
    ('diff-cleanliness-gate', 'policy', 'Whitespace and diff cleanliness gate', 'ready', true, true, 'git diff --check', '.github/workflows/security-checks.yml', 'Security workflow runs git diff --check.', 'Keep check required in branch protection.', '{"phase":157}'::jsonb),
    ('dependency-audit-high', 'dependency', 'Dependency audit high/critical gate', 'ready', true, true, 'npm audit --audit-level=high', '.github/workflows/security-checks.yml', 'High and critical npm audit findings block production readiness.', 'Add Dependabot alerts and patch workflow.', '{"phase":157}'::jsonb),
    ('codeql-js-ts', 'sast', 'CodeQL JavaScript/TypeScript readiness', 'ready', true, true, 'GitHub CodeQL', '.github/workflows/security-checks.yml', 'CodeQL security-and-quality queries are configured for JavaScript/TypeScript.', 'Enable repository code scanning alerts and branch protection.', '{"phase":157}'::jsonb),
    ('secret-scan-basic', 'secret', 'Secret scanning readiness gate', 'partial', true, true, 'git grep secret markers', '.github/workflows/security-checks.yml', 'Workflow blocks obvious committed secret markers and private camera URLs.', 'Enable GitHub Secret Scanning or Gitleaks/Semgrep for stronger pattern coverage.', '{"phase":157}'::jsonb),
    ('migration-safety-basic', 'migration', 'Supabase migration safety readiness', 'partial', true, false, 'shell checks', '.github/workflows/security-checks.yml', 'Workflow checks create-table idempotency and warns on destructive migration patterns.', 'Add schema-aware migration linter for enum values, RLS and storage policies.', '{"phase":157}'::jsonb),
    ('dast-readiness', 'dast', 'DAST readiness checklist', 'provider_required', false, false, 'Future OWASP ZAP/Semgrep/Snyk', null, 'DAST targets are documented but destructive tests are not automated.', 'Run non-destructive DAST against staging only after seed data and rate limits are ready.', '{"phase":157}'::jsonb),
    ('branch-protection-policy', 'branch_protection', 'GitHub branch protection', 'partial', true, true, 'GitHub settings', null, 'Required checks are documented.', 'Require PR, reviews, typecheck, build, security checks and prevent force push in GitHub settings.', '{"phase":157}'::jsonb),
    ('vercel-deployment-gate', 'vercel', 'Vercel deployment gate readiness', 'partial', true, true, 'Vercel GitHub integration', 'vercel.json', 'Security headers exist and deployment should require GitHub checks.', 'Configure Vercel protected production environment to deploy only after required checks pass.', '{"phase":157}'::jsonb),
    ('supabase-rls-checklist', 'supabase', 'Supabase RLS and storage safety checklist', 'partial', true, true, 'manual/schema review', null, 'Migration checklist documents RLS, policies and private storage requirements.', 'Add automated Supabase schema scanner for tables without RLS and public sensitive buckets.', '{"phase":157}'::jsonb)
  on conflict (control_key) do update set
    control_area = excluded.control_area,
    title = excluded.title,
    status = excluded.status,
    required = excluded.required,
    blocking = excluded.blocking,
    tool_name = excluded.tool_name,
    workflow_file = excluded.workflow_file,
    evidence_summary = excluded.evidence_summary,
    next_step = excluded.next_step,
    metadata = excluded.metadata,
    updated_at = now();
exception
  when undefined_table then
    raise notice 'Skipped Phase 157 security_pipeline_controls seed because a dependent relation is missing: %', sqlerrm;
end;
$$;

do $$
begin
  insert into public.security_pipeline_findings (finding_key, finding_type, severity, source, status, owner_role, remediation, affected_path, mitigation_plan, metadata)
  values
    ('phase157-typecheck-currently-failing', 'typecheck', 'high', 'local_verification', 'open', 'admin', 'Resolve existing TypeScript errors before enabling production branch protection.', 'npm run typecheck', 'Track and fix existing type errors; no Phase 157 files are currently implicated.', '{"phase":157,"blocks_production":true}'::jsonb),
    ('phase157-build-next-env-missing', 'build', 'high', 'local_verification', 'open', 'admin', 'Repair node_modules / lockfile installation so next build can resolve @next/env.', 'node_modules/@next/env', 'Run clean install and verify package lock consistency before production.', '{"phase":157,"blocks_production":true}'::jsonb),
    ('phase157-secret-scanning-provider', 'secret', 'medium', 'provider_readiness', 'triaged', 'admin', 'Enable GitHub Secret Scanning or a Gitleaks/Semgrep provider for broad detection.', '.github/workflows/security-checks.yml', 'Basic local pattern gate is present; provider integration remains future-ready.', '{"phase":157}'::jsonb),
    ('phase157-dast-provider-readiness', 'dast', 'medium', 'provider_readiness', 'triaged', 'admin', 'Add non-destructive staging DAST after launch environment and seed data exist.', 'staging', 'Document target routes and avoid destructive tests in CI.', '{"phase":157}'::jsonb)
  on conflict (finding_key) do update set
    finding_type = excluded.finding_type,
    severity = excluded.severity,
    source = excluded.source,
    status = excluded.status,
    owner_role = excluded.owner_role,
    remediation = excluded.remediation,
    affected_path = excluded.affected_path,
    mitigation_plan = excluded.mitigation_plan,
    metadata = excluded.metadata,
    updated_at = now();
exception
  when undefined_table then
    raise notice 'Skipped Phase 157 security_pipeline_findings seed because a dependent relation is missing: %', sqlerrm;
end;
$$;

do $$
begin
  insert into public.security_readiness_checks (category, check_key, title, status, severity, evidence_summary, recommended_action, metadata)
  values
    ('ci_cd', 'phase157-security-workflow', 'Security checks workflow', 'partial', 'critical', 'security-checks.yml runs typecheck, build, diff check, npm audit, CodeQL and secret marker scanning.', 'Make the workflow a required branch protection check after existing type/build failures are resolved.', '{"phase":157}'::jsonb),
    ('dependency_scanning', 'phase157-npm-audit-high', 'Dependency high/critical gate', 'partial', 'critical', 'npm audit --audit-level=high is configured as a blocking gate.', 'Enable Dependabot alerts and patch workflow.', '{"phase":157}'::jsonb),
    ('secret_scanning', 'phase157-secret-scan-readiness', 'Secret scanning readiness', 'partial', 'critical', 'Workflow blocks obvious server-only secrets, gateway secrets and RTSP URLs outside allowed readiness files.', 'Enable GitHub Secret Scanning or a dedicated provider for stronger detection.', '{"phase":157}'::jsonb),
    ('sast', 'phase157-codeql-readiness', 'CodeQL readiness', 'partial', 'high', 'CodeQL JavaScript/TypeScript security-and-quality scan is configured.', 'Enable code scanning alerts and require this workflow for protected branches.', '{"phase":157}'::jsonb),
    ('dast', 'phase157-dast-readiness', 'DAST readiness', 'needs_review', 'medium', 'DAST targets are documented and not run destructively in CI.', 'Add staging-only OWASP ZAP/Semgrep/Snyk workflow after a stable staging environment exists.', '{"phase":157}'::jsonb),
    ('migration_safety', 'phase157-migration-safety', 'Supabase migration safety checklist', 'partial', 'high', 'Basic workflow checks idempotent create table usage and warns on destructive migration patterns.', 'Add schema-aware checks for RLS, policies, enum values and storage bucket exposure.', '{"phase":157}'::jsonb),
    ('branch_protection', 'phase157-branch-protection', 'Branch protection readiness', 'needs_review', 'critical', 'Required GitHub branch protection policy is documented.', 'Require PR, review, typecheck, build, security checks, CodeQL and no force push.', '{"phase":157}'::jsonb)
  on conflict (check_key) do update set
    status = excluded.status,
    severity = excluded.severity,
    evidence_summary = excluded.evidence_summary,
    recommended_action = excluded.recommended_action,
    metadata = excluded.metadata,
    updated_at = now();
exception
  when undefined_table then
    raise notice 'Skipped Phase 157 security_readiness_checks seed because a dependent relation is missing: %', sqlerrm;
end;
$$;

do $$
begin
  insert into public.audit_event_catalog (event_key, category, title, required, implemented, source_table, notes, data_classification, metadata)
  values
    ('security-scan-completed', 'security', 'Security scan completed', true, false, 'security_pipeline_runs', 'CI completion event should be written by future GitHub webhook/import job.', 'internal', '{"phase":157}'::jsonb),
    ('security-scan-failed', 'security', 'Security scan failed', true, false, 'security_pipeline_runs', 'Failed typecheck/build/audit/secret scan should block production readiness.', 'internal', '{"phase":157}'::jsonb),
    ('security-finding-created', 'security', 'Security pipeline finding created', true, true, 'security_pipeline_findings', 'Findings track source, severity, owner and remediation.', 'internal', '{"phase":157}'::jsonb),
    ('security-finding-accepted', 'security', 'Security finding accepted as risk', true, false, 'security_pipeline_findings', 'Accepted risk requires reason, expiration, reviewer and mitigation plan.', 'internal', '{"phase":157}'::jsonb),
    ('production-readiness-changed', 'security', 'Production readiness changed', true, false, 'security_pipeline_runs', 'Production readiness status changes must be immutable-audited.', 'internal', '{"phase":157}'::jsonb)
  on conflict (event_key) do update set
    implemented = excluded.implemented,
    source_table = excluded.source_table,
    notes = excluded.notes,
    data_classification = excluded.data_classification,
    metadata = excluded.metadata;
exception
  when undefined_table then
    raise notice 'Skipped Phase 157 audit_event_catalog seed because a dependent relation is missing: %', sqlerrm;
end;
$$;

comment on table public.security_pipeline_runs is 'GitHub/Vercel security gate run tracking for typecheck, build, dependency, secret, CodeQL and migration safety checks.';
comment on table public.security_pipeline_findings is 'Security pipeline findings and controlled accepted-risk process. No secret values should be stored.';
comment on table public.security_pipeline_controls is 'Security gate controls, required tools and provider readiness status.';
