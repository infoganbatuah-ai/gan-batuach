-- PHASE 172: ISO certification external process readiness and auditor handoff.
-- Readiness only. This migration does not claim certification and does not expose child,
-- medical, camera, payment, secret or key material to external reviewers.

alter table if exists public.risk_register
  add column if not exists residual_risk text,
  add column if not exists treatment_plan text,
  add column if not exists review_date date,
  add column if not exists residual_risk_accepted_by uuid references public.profiles(id) on delete set null,
  add column if not exists residual_risk_accepted_at timestamptz;

alter table if exists public.internal_audits
  add column if not exists audit_date date,
  add column if not exists evidence_summary text,
  add column if not exists corrective_action_status text not null default 'open';

alter table if exists public.security_policies_repository
  add column if not exists policy_owner text,
  add column if not exists certification_ready boolean not null default false;

alter table if exists public.security_procedures
  add column if not exists procedure_owner text,
  add column if not exists certification_ready boolean not null default false;

do $$
begin
  alter table public.iso_gap_analysis_items
    drop constraint if exists iso_gap_status_check;
  alter table public.iso_gap_analysis_items
    add constraint iso_gap_status_check
    check (status in ('open','in_progress','fixed','verified','accepted_risk','deferred'));
exception
  when undefined_table then null;
end $$;

create table if not exists public.iso_certification_scopes (
  id uuid primary key default gen_random_uuid(),
  scope_key text not null unique,
  title text not null,
  included_items jsonb not null default '[]'::jsonb,
  excluded_items jsonb not null default '[]'::jsonb,
  status text not null default 'draft',
  owner_role text not null default 'admin',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint iso_certification_scope_status_check check (status in ('draft','ready_for_consultant','under_review','approved_for_audit','needs_changes'))
);

create table if not exists public.iso_certification_process_stages (
  id uuid primary key default gen_random_uuid(),
  stage_key text not null unique,
  stage text not null,
  status text not null default 'not_started',
  owner_role text not null default 'admin',
  target_date date,
  actual_date date,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint iso_certification_stage_check check (stage in ('not_started','internal_ready','consultant_review','gap_remediation','pre_audit_ready','stage_1_audit_ready','stage_2_audit_ready','certification_pending','certified','surveillance_audit')),
  constraint iso_certification_stage_status_check check (status in ('not_started','in_progress','ready','blocked','completed','not_applicable'))
);

create table if not exists public.iso_external_handoff_packages (
  id uuid primary key default gen_random_uuid(),
  package_key text not null unique,
  package_type text not null,
  title text not null,
  document_path text not null,
  status text not null default 'draft',
  included_sections jsonb not null default '[]'::jsonb,
  sensitive_data_excluded boolean not null default true,
  owner_role text not null default 'admin',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint iso_external_handoff_package_type_check check (package_type in ('iso_consultant','certification_body','privacy_consultant','cloud_security_reviewer','executive_report','auditor_handoff')),
  constraint iso_external_handoff_status_check check (status in ('draft','ready_for_review','ready_for_external_reviewer','needs_update','blocked')),
  constraint iso_external_handoff_sensitive_check check (sensitive_data_excluded = true)
);

create table if not exists public.iso_evidence_binder_finalization (
  id uuid primary key default gen_random_uuid(),
  binder_key text not null unique,
  evidence_category text not null,
  status text not null default 'in_progress',
  evidence_count integer not null default 0,
  approved_count integer not null default 0,
  missing_count integer not null default 0,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint iso_evidence_binder_category_check check (evidence_category in ('access_control','mfa','rbac','audit_logs','encryption','backups','disaster_recovery','incident_response','supplier_management','cloud_security','privacy_rights','data_retention','ai_governance','camera_compliance','ci_cd_security','penetration_test_readiness')),
  constraint iso_evidence_binder_status_check check (status in ('missing','in_progress','ready_for_review','approved','blocked'))
);

create table if not exists public.risk_treatment_plan (
  id uuid primary key default gen_random_uuid(),
  treatment_key text not null unique,
  risk_id uuid references public.risk_register(id) on delete cascade,
  treatment_type text not null,
  treatment_owner text not null default 'admin',
  target_date date,
  evidence text,
  residual_risk text,
  acceptance_approval text,
  status text not null default 'open',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint risk_treatment_type_check check (treatment_type in ('mitigate','transfer','avoid','accept')),
  constraint risk_treatment_status_check check (status in ('open','in_progress','implemented','verified','accepted','deferred'))
);

create table if not exists public.management_reviews (
  id uuid primary key default gen_random_uuid(),
  review_key text not null unique,
  review_scope text not null,
  review_status text not null default 'planned',
  review_date date,
  reviewer_name text,
  security_risks_summary text,
  privacy_risks_summary text,
  incidents_summary text,
  audit_results_summary text,
  supplier_risks_summary text,
  policy_reviews_summary text,
  improvement_actions jsonb not null default '[]'::jsonb,
  evidence_item_id uuid references public.iso_evidence_items(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint management_review_scope_check check (review_scope in ('security_risks','privacy_risks','incidents','audit_results','supplier_risks','policy_reviews','improvement_actions','combined')),
  constraint management_review_status_check check (review_status in ('planned','scheduled','completed','action_required','blocked'))
);

create table if not exists public.iso_external_reviewer_access_modes (
  id uuid primary key default gen_random_uuid(),
  mode_key text not null unique,
  reviewer_type text not null,
  access_status text not null default 'prepared',
  allowed_resources jsonb not null default '[]'::jsonb,
  blocked_resources jsonb not null default '[]'::jsonb,
  export_allowed boolean not null default false,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint iso_external_reviewer_type_check check (reviewer_type in ('iso_consultant','iso_auditor','certification_body','privacy_consultant','cloud_security_reviewer')),
  constraint iso_external_reviewer_access_status_check check (access_status in ('prepared','ready_for_review','active','disabled','blocked'))
);

create table if not exists public.iso_reviewer_access_audit (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  reviewer_profile_id uuid references public.profiles(id) on delete set null,
  reviewer_type text,
  action text not null,
  resource_type text,
  resource_key text,
  ip_address inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint iso_reviewer_access_action_check check (action in ('reviewer_login','document_viewed','evidence_viewed','export_generated','comment_added','review_status_changed'))
);

create table if not exists public.iso_final_readiness_checklists (
  id uuid primary key default gen_random_uuid(),
  checklist_key text not null unique,
  standard text not null,
  area text not null,
  title text not null,
  status text not null default 'in_progress',
  required boolean not null default true,
  evidence_summary text,
  owner_role text not null default 'admin',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint iso_final_checklist_standard_check check (standard in ('iso_27001','iso_27017','iso_27701')),
  constraint iso_final_checklist_status_check check (status in ('not_started','in_progress','ready_for_consultant','ready_for_audit','blocked','not_applicable'))
);

create table if not exists public.iso_certification_gaps (
  id uuid primary key default gen_random_uuid(),
  gap_key text not null unique,
  standard text not null,
  control_id text,
  gap text not null,
  severity text not null default 'medium',
  owner text,
  remediation_plan text,
  due_date date,
  status text not null default 'open',
  evidence_after_fix text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint iso_certification_gap_standard_check check (standard in ('iso_27001','iso_27017','iso_27701','combined')),
  constraint iso_certification_gap_severity_check check (severity in ('critical','high','medium','low')),
  constraint iso_certification_gap_status_check check (status in ('open','in_progress','fixed','verified','accepted_risk','deferred'))
);

create table if not exists public.iso_certification_timeline (
  id uuid primary key default gen_random_uuid(),
  timeline_key text not null unique,
  stage text not null,
  target_date date,
  actual_date date,
  owner text,
  status text not null default 'planned',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint iso_certification_timeline_stage_check check (stage in ('internal_readiness','consultant_gap_analysis','remediation_sprint','pre_audit','stage_1_audit','stage_2_audit','certification_decision','surveillance_audit_planning')),
  constraint iso_certification_timeline_status_check check (status in ('planned','in_progress','completed','blocked','deferred'))
);

create table if not exists public.iso_external_action_items (
  id uuid primary key default gen_random_uuid(),
  action_key text not null unique,
  action_type text not null,
  title text not null,
  owner text,
  status text not null default 'open',
  due_date date,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint iso_external_action_type_check check (action_type in ('iso_consultant_review','certification_body_selection','legal_privacy_confirmation','penetration_test_provider','cloud_provider_evidence','payment_provider_documents','external_policy_validation')),
  constraint iso_external_action_status_check check (status in ('open','in_progress','completed','blocked','deferred'))
);

create table if not exists public.iso_certification_body_options (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null unique,
  provider_name text not null,
  standards_supported jsonb not null default '[]'::jsonb,
  estimated_cost_nis integer,
  estimated_timeline_weeks integer,
  required_documents jsonb not null default '[]'::jsonb,
  contact_person text,
  status text not null default 'research',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint iso_certification_body_status_check check (status in ('research','contacted','proposal_received','shortlisted','rejected','selected'))
);

create table if not exists public.iso_cost_timeline_estimates (
  id uuid primary key default gen_random_uuid(),
  estimate_key text not null unique,
  consultant_cost_nis integer,
  certification_body_cost_nis integer,
  remediation_cost_nis integer,
  annual_surveillance_cost_nis integer,
  internal_work_days integer,
  expected_timeline_weeks integer,
  confidence_level text not null default 'rough_estimate',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint iso_cost_confidence_check check (confidence_level in ('rough_estimate','vendor_quote','approved_budget'))
);

create table if not exists public.iso_certification_claim_guardrails (
  id uuid primary key default gen_random_uuid(),
  guardrail_key text not null unique,
  prohibited_claim text not null,
  allowed_wording text not null,
  status text not null default 'active',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint iso_claim_guardrail_status_check check (status in ('active','needs_review','retired'))
);

create table if not exists public.iso_public_copy_audit_items (
  id uuid primary key default gen_random_uuid(),
  item_key text not null unique,
  page_path text not null,
  risky_claim text not null,
  risk_type text not null,
  recommendation text not null,
  status text not null default 'open',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint iso_public_copy_risk_type_check check (risk_type in ('false_certification_claim','unsupported_legal_claim','unsupported_ai_claim','unsupported_safety_guarantee')),
  constraint iso_public_copy_status_check check (status in ('open','in_progress','fixed','accepted_risk','verified'))
);

create table if not exists public.iso_external_process_readiness_scores (
  id uuid primary key default gen_random_uuid(),
  snapshot_key text not null unique,
  iso_27001_readiness integer not null default 0,
  iso_27017_readiness integer not null default 0,
  iso_27701_readiness integer not null default 0,
  evidence_completeness integer not null default 0,
  external_reviewer_status_score integer not null default 0,
  certification_process_score integer not null default 0,
  overall_handoff_score integer not null default 0,
  certification_stage text not null default 'not_started',
  remaining_blockers jsonb not null default '[]'::jsonb,
  notes text,
  calculated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint iso_external_process_score_check check (
    iso_27001_readiness between 0 and 100 and iso_27017_readiness between 0 and 100 and iso_27701_readiness between 0 and 100 and
    evidence_completeness between 0 and 100 and external_reviewer_status_score between 0 and 100 and certification_process_score between 0 and 100 and
    overall_handoff_score between 0 and 100
  ),
  constraint iso_external_process_stage_check check (certification_stage in ('not_started','internal_ready','consultant_review','gap_remediation','pre_audit_ready','stage_1_audit_ready','stage_2_audit_ready','certification_pending','certified','surveillance_audit'))
);

create index if not exists idx_iso_certification_stages_status on public.iso_certification_process_stages(stage, status);
create index if not exists idx_iso_certification_gaps_status on public.iso_certification_gaps(standard, severity, status, due_date);
create index if not exists idx_iso_timeline_status on public.iso_certification_timeline(stage, status, target_date);
create index if not exists idx_iso_external_actions_status on public.iso_external_action_items(action_type, status, due_date);
create index if not exists idx_risk_treatment_plan_status on public.risk_treatment_plan(status, target_date);
create index if not exists idx_management_reviews_status on public.management_reviews(review_scope, review_status, review_date);

alter table public.iso_certification_scopes enable row level security;
alter table public.iso_certification_process_stages enable row level security;
alter table public.iso_external_handoff_packages enable row level security;
alter table public.iso_evidence_binder_finalization enable row level security;
alter table public.risk_treatment_plan enable row level security;
alter table public.management_reviews enable row level security;
alter table public.iso_external_reviewer_access_modes enable row level security;
alter table public.iso_reviewer_access_audit enable row level security;
alter table public.iso_final_readiness_checklists enable row level security;
alter table public.iso_certification_gaps enable row level security;
alter table public.iso_certification_timeline enable row level security;
alter table public.iso_external_action_items enable row level security;
alter table public.iso_certification_body_options enable row level security;
alter table public.iso_cost_timeline_estimates enable row level security;
alter table public.iso_certification_claim_guardrails enable row level security;
alter table public.iso_public_copy_audit_items enable row level security;
alter table public.iso_external_process_readiness_scores enable row level security;

drop policy if exists "iso certification scopes admin only" on public.iso_certification_scopes;
create policy "iso certification scopes admin only" on public.iso_certification_scopes for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "iso certification stages admin only" on public.iso_certification_process_stages;
create policy "iso certification stages admin only" on public.iso_certification_process_stages for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "iso external handoff packages admin only" on public.iso_external_handoff_packages;
create policy "iso external handoff packages admin only" on public.iso_external_handoff_packages for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "iso evidence binder finalization admin only" on public.iso_evidence_binder_finalization;
create policy "iso evidence binder finalization admin only" on public.iso_evidence_binder_finalization for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "risk treatment plan admin only" on public.risk_treatment_plan;
create policy "risk treatment plan admin only" on public.risk_treatment_plan for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "management reviews admin only" on public.management_reviews;
create policy "management reviews admin only" on public.management_reviews for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "iso external reviewer access modes admin only" on public.iso_external_reviewer_access_modes;
create policy "iso external reviewer access modes admin only" on public.iso_external_reviewer_access_modes for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "iso reviewer access audit admin only" on public.iso_reviewer_access_audit;
create policy "iso reviewer access audit admin only" on public.iso_reviewer_access_audit for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "iso final readiness checklists admin only" on public.iso_final_readiness_checklists;
create policy "iso final readiness checklists admin only" on public.iso_final_readiness_checklists for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "iso certification gaps admin only" on public.iso_certification_gaps;
create policy "iso certification gaps admin only" on public.iso_certification_gaps for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "iso certification timeline admin only" on public.iso_certification_timeline;
create policy "iso certification timeline admin only" on public.iso_certification_timeline for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "iso external action items admin only" on public.iso_external_action_items;
create policy "iso external action items admin only" on public.iso_external_action_items for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "iso certification body options admin only" on public.iso_certification_body_options;
create policy "iso certification body options admin only" on public.iso_certification_body_options for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "iso cost timeline estimates admin only" on public.iso_cost_timeline_estimates;
create policy "iso cost timeline estimates admin only" on public.iso_cost_timeline_estimates for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "iso claim guardrails admin only" on public.iso_certification_claim_guardrails;
create policy "iso claim guardrails admin only" on public.iso_certification_claim_guardrails for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "iso public copy audit admin only" on public.iso_public_copy_audit_items;
create policy "iso public copy audit admin only" on public.iso_public_copy_audit_items for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "iso external process readiness admin only" on public.iso_external_process_readiness_scores;
create policy "iso external process readiness admin only" on public.iso_external_process_readiness_scores for all using (public.is_admin()) with check (public.is_admin());

insert into public.iso_certification_scopes (scope_key, title, included_items, excluded_items, status, notes)
values (
  'gan-batuach-digital-observer-readiness-scope',
  'Gan Batuach SaaS and Digital Observer Core readiness scope',
  '["Gan Batuach SaaS platform","Digital Observer Core readiness","Supabase / Vercel deployment architecture","GitHub CI/CD process","internal admin dashboards","customer data processing","AI governance","camera access governance","privacy rights workflows"]'::jsonb,
  '["external providers internal systems","customer-owned camera hardware","external payment processors","future Digital Observer verticals not yet launched"]'::jsonb,
  'ready_for_consultant',
  'Scope definition for consultant review only. Certification body may modify final scope.'
)
on conflict (scope_key) do update set included_items = excluded.included_items, excluded_items = excluded.excluded_items, status = excluded.status, updated_at = now();

insert into public.iso_certification_process_stages (stage_key, stage, status, owner_role, target_date, notes)
values
  ('stage-not-started','not_started','completed','admin',current_date,'Initial internal preparation started.'),
  ('stage-internal-ready','internal_ready','in_progress','admin',current_date + interval '30 days','Internal evidence, policies and handoff packages need review.'),
  ('stage-consultant-review','consultant_review','not_started','admin',current_date + interval '45 days','Requires external ISO consultant.'),
  ('stage-gap-remediation','gap_remediation','not_started','admin',current_date + interval '75 days','Depends on consultant findings.'),
  ('stage-pre-audit-ready','pre_audit_ready','not_started','admin',current_date + interval '100 days','Pre-audit readiness after remediation.'),
  ('stage-1-audit','stage_1_audit_ready','not_started','admin',current_date + interval '120 days','Certification body stage 1 readiness only.'),
  ('stage-2-audit','stage_2_audit_ready','not_started','admin',current_date + interval '150 days','Certification body stage 2 readiness only.'),
  ('stage-certification-pending','certification_pending','not_started','admin',current_date + interval '180 days','Do not mark certified without external certificate.'),
  ('stage-certified','certified','not_started','admin',null,'Forbidden until certificate exists.'),
  ('stage-surveillance','surveillance_audit','not_started','admin',null,'Future annual surveillance planning.')
on conflict (stage_key) do update set status = excluded.status, target_date = excluded.target_date, notes = excluded.notes, updated_at = now();

insert into public.iso_external_handoff_packages (package_key, package_type, title, document_path, status, included_sections, notes)
values
  ('iso-consultant-handoff','iso_consultant','ISO consultant handoff package','ISO_CONSULTANT_HANDOFF_PACKAGE.md','ready_for_review','["architecture overview","asset inventory","risk register","control registry","policies","procedures","evidence list","supplier register","incident response","backup restore","audit log model","privacy request model","AI governance","camera compliance","CI/CD security gates"]'::jsonb,'No child/medical/camera/payment/secrets included.'),
  ('certification-body-handoff','certification_body','Certification body handoff package','ISO_CERTIFICATION_BODY_HANDOFF_PACKAGE.md','ready_for_review','["certification scope","Statement of Applicability readiness","control evidence summary","management system overview","security policy index","privacy policy index","audit readiness summary","internal audit summary","risk treatment plan"]'::jsonb,'Future certification body package only.'),
  ('executive-readiness-report','executive_report','Executive ISO readiness report','EXECUTIVE_ISO_CERTIFICATION_READINESS_REPORT.md','ready_for_review','["readiness score","standards covered","evidence readiness","open gaps","estimated process","next steps"]'::jsonb,'Executive summary for leadership and external advisors.'),
  ('auditor-handoff-documentation','auditor_handoff','Auditor handoff documentation','ISO_CERTIFICATION_EXTERNAL_PROCESS_AND_AUDITOR_HANDOFF.md','ready_for_review','["process stages","roles","scope","evidence package","access model","gap remediation","external dependencies","limitations"]'::jsonb,'Main Phase 172 handoff document.')
on conflict (package_key) do update set status = excluded.status, included_sections = excluded.included_sections, updated_at = now();

insert into public.iso_evidence_binder_finalization (binder_key, evidence_category, status, evidence_count, approved_count, missing_count, notes)
values
  ('binder-access-control','access_control','ready_for_review',5,3,2,'Access, roles and RLS evidence require consultant review.'),
  ('binder-mfa','mfa','ready_for_review',4,2,2,'MFA readiness exists; provider proof remains required.'),
  ('binder-rbac','rbac','ready_for_review',4,3,1,'Role boundaries documented.'),
  ('binder-audit-logs','audit_logs','ready_for_review',5,3,2,'Immutable/WORM readiness documented; external validation required.'),
  ('binder-encryption','encryption','in_progress',4,2,2,'Field encryption readiness exists; backfill proof required.'),
  ('binder-backups','backups','in_progress',3,1,2,'Provider evidence and restore test proof needed.'),
  ('binder-disaster-recovery','disaster_recovery','in_progress',3,1,2,'DR runbook and restore evidence required.'),
  ('binder-incident-response','incident_response','ready_for_review',4,2,2,'Incident response docs ready for review.'),
  ('binder-supplier-management','supplier_management','in_progress',6,2,4,'DPA/security reviews needed from providers.'),
  ('binder-cloud-security','cloud_security','in_progress',5,2,3,'Supabase/Vercel/GitHub shared responsibility evidence needed.'),
  ('binder-privacy-rights','privacy_rights','ready_for_review',5,3,2,'Privacy requests and deletion model documented.'),
  ('binder-data-retention','data_retention','ready_for_review',4,2,2,'Retention/legal hold model ready for review.'),
  ('binder-ai-governance','ai_governance','ready_for_review',5,3,2,'Human review and DPIA readiness documented.'),
  ('binder-camera-compliance','camera_compliance','ready_for_review',5,3,2,'Camera controls documented; legal review still required.'),
  ('binder-ci-cd-security','ci_cd_security','ready_for_review',4,2,2,'GitHub security gates readiness documented.'),
  ('binder-penetration-test','penetration_test_readiness','in_progress',3,1,2,'External PT still required.')
on conflict (binder_key) do update set status = excluded.status, evidence_count = excluded.evidence_count, approved_count = excluded.approved_count, missing_count = excluded.missing_count, updated_at = now();

insert into public.management_reviews (review_key, review_scope, review_status, review_date, reviewer_name, security_risks_summary, privacy_risks_summary, incidents_summary, audit_results_summary, supplier_risks_summary, policy_reviews_summary, improvement_actions)
values (
  'initial-iso-management-review',
  'combined',
  'planned',
  current_date + interval '21 days',
  'Executive / Security / Privacy owners',
  'Review high-security platform risks before consultant handoff.',
  'Review child, parent, staff, medical, camera and AI privacy risks.',
  'Review incident response readiness and breach notification workflow.',
  'Review internal audit readiness before external consultant.',
  'Review Supabase, Vercel, GitHub and provider evidence gaps.',
  'Review approval status and next review dates for all policies.',
  '["assign ISO owner","select consultant","complete supplier evidence","schedule internal audit","approve policy set"]'::jsonb
)
on conflict (review_key) do update set review_status = excluded.review_status, review_date = excluded.review_date, updated_at = now();

insert into public.iso_external_reviewer_access_modes (mode_key, reviewer_type, access_status, allowed_resources, blocked_resources, export_allowed, notes)
values
  ('iso-consultant-safe-mode','iso_consultant','prepared','["policies","procedures","evidence metadata","risk register","asset inventory","control mapping","supplier register","readiness scores","gap analysis"]'::jsonb,'["child personal data","parent personal data","staff personal data","medical data","raw camera feeds","raw AI events","payment details","secrets","encryption keys","private signed URLs"]'::jsonb,true,'Metadata-only exports allowed after admin approval.'),
  ('iso-auditor-safe-mode','iso_auditor','prepared','["policies","procedures","evidence metadata","SoA","control mapping","audit binder","gap remediation status"]'::jsonb,'["child data","medical data","camera streams","payment data","secrets"]'::jsonb,true,'Future limited auditor mode.'),
  ('privacy-consultant-safe-mode','privacy_consultant','prepared','["privacy policies","DPIA metadata","privacy request workflow","retention rules","AI/camera privacy packs"]'::jsonb,'["raw personal data","raw AI events","raw camera streams","secrets"]'::jsonb,false,'Review package only unless approved.'),
  ('cloud-security-reviewer-safe-mode','cloud_security_reviewer','prepared','["asset inventory","cloud shared responsibility","CI/CD evidence","security headers","provider evidence metadata"]'::jsonb,'["service role keys","API secrets","private URLs","child data"]'::jsonb,false,'No secret exposure.')
on conflict (mode_key) do update set allowed_resources = excluded.allowed_resources, blocked_resources = excluded.blocked_resources, updated_at = now();

insert into public.iso_final_readiness_checklists (checklist_key, standard, area, title, status, evidence_summary)
values
  ('27001-access-control','iso_27001','access_control','Access control readiness','ready_for_consultant','RBAC, MFA and route/RLS boundaries documented.'),
  ('27001-asset-inventory','iso_27001','asset_inventory','Asset inventory readiness','ready_for_consultant','Supabase, Vercel, GitHub, mobile, camera and AI assets tracked.'),
  ('27001-risk-management','iso_27001','risk_management','Risk management readiness','in_progress','Risk register exists; residual risk baseline needs review.'),
  ('27001-audit-logging','iso_27001','audit_logging','Audit logging readiness','ready_for_consultant','Immutable audit and sensitive access logging readiness documented.'),
  ('27001-incident-management','iso_27001','incident_management','Incident management readiness','ready_for_consultant','Incident response pack ready for review.'),
  ('27001-supplier-management','iso_27001','supplier_management','Supplier management readiness','in_progress','Provider DPAs and external documents still needed.'),
  ('27001-business-continuity','iso_27001','business_continuity','Business continuity readiness','in_progress','Backup/restore evidence required.'),
  ('27017-supabase','iso_27017','supabase_shared_responsibility','Supabase shared responsibility','in_progress','Need provider evidence and configuration proof.'),
  ('27017-vercel','iso_27017','vercel_shared_responsibility','Vercel shared responsibility','in_progress','Need provider evidence and deployment proof.'),
  ('27017-tenant-isolation','iso_27017','tenant_isolation','Tenant isolation readiness','ready_for_consultant','RLS and scoped access model documented.'),
  ('27017-deployment-controls','iso_27017','deployment_controls','Deployment controls readiness','ready_for_consultant','GitHub CI/CD gate readiness documented.'),
  ('27701-child-data','iso_27701','child_data_protection','Child data protection readiness','ready_for_consultant','Privacy-by-design and data minimization documented.'),
  ('27701-medical-data','iso_27701','medical_data_protection','Medical data protection readiness','in_progress','Encryption/backfill evidence still needed.'),
  ('27701-privacy-requests','iso_27701','privacy_request_workflow','Privacy request workflow readiness','ready_for_consultant','Access/correction/export/deletion workflow exists.'),
  ('27701-retention','iso_27701','retention_rules','Retention and deletion readiness','ready_for_consultant','Retention, legal hold and anonymization model documented.'),
  ('27701-ai-camera','iso_27701','ai_camera_privacy','AI and camera privacy readiness','ready_for_consultant','Human review, no raw parent AI and camera policy boundaries documented.')
on conflict (checklist_key) do update set status = excluded.status, evidence_summary = excluded.evidence_summary, updated_at = now();

insert into public.iso_certification_gaps (gap_key, standard, control_id, gap, severity, owner, remediation_plan, due_date, status, evidence_after_fix)
values
  ('external-iso-consultant-required','combined',null,'External ISO consultant has not reviewed the readiness pack.','high','Leadership','Select consultant and run gap analysis.',current_date + interval '45 days','open','Consultant report'),
  ('certification-body-not-selected','combined',null,'Certification body has not been selected.','high','Leadership','Compare certification bodies and request proposals.',current_date + interval '60 days','open','Selected body / proposal'),
  ('supplier-evidence-missing','iso_27017',null,'Cloud/provider evidence pack is incomplete.','high','Security','Collect Supabase, Vercel, GitHub and provider documents.',current_date + interval '45 days','in_progress','Supplier evidence metadata'),
  ('external-pt-not-complete','iso_27001',null,'External penetration test is not complete.','high','Security','Engage authorized PT provider and track findings.',current_date + interval '75 days','open','PT report and remediation evidence'),
  ('policy-approval-pending','iso_27001',null,'Policies and procedures require formal approval workflow evidence.','medium','Admin','Complete approvals, effective dates and next review dates.',current_date + interval '30 days','in_progress','Approved policy index')
on conflict (gap_key) do update set status = excluded.status, remediation_plan = excluded.remediation_plan, updated_at = now();

insert into public.iso_certification_timeline (timeline_key, stage, target_date, owner, status, notes)
values
  ('timeline-internal-readiness','internal_readiness',current_date + interval '30 days','Admin / Security','in_progress','Finish handoff and executive review.'),
  ('timeline-consultant-gap-analysis','consultant_gap_analysis',current_date + interval '45 days','Leadership','planned','External consultant review.'),
  ('timeline-remediation-sprint','remediation_sprint',current_date + interval '75 days','Engineering / Security','planned','Resolve consultant gaps.'),
  ('timeline-pre-audit','pre_audit',current_date + interval '100 days','Security','planned','Pre-audit readiness review.'),
  ('timeline-stage-1','stage_1_audit',current_date + interval '120 days','Certification owner','planned','Certification body stage 1 audit.'),
  ('timeline-stage-2','stage_2_audit',current_date + interval '150 days','Certification owner','planned','Certification body stage 2 audit.'),
  ('timeline-certification-decision','certification_decision',current_date + interval '180 days','Certification body','planned','External body decision only.'),
  ('timeline-surveillance','surveillance_audit_planning',current_date + interval '365 days','Certification owner','planned','Future surveillance planning.')
on conflict (timeline_key) do update set target_date = excluded.target_date, status = excluded.status, updated_at = now();

insert into public.iso_external_action_items (action_key, action_type, title, owner, status, due_date, notes)
values
  ('action-select-iso-consultant','iso_consultant_review','Select ISO consultant','Leadership','open',current_date + interval '30 days','Required before real certification process.'),
  ('action-select-certification-body','certification_body_selection','Compare certification bodies','Leadership','open',current_date + interval '45 days','Do not choose automatically.'),
  ('action-legal-privacy-confirmation','legal_privacy_confirmation','Obtain privacy/legal confirmation','Legal','open',current_date + interval '45 days','Required for ISO 27701 and child data posture.'),
  ('action-pt-provider','penetration_test_provider','Engage penetration test provider','Security','open',current_date + interval '60 days','Authorized external company only.'),
  ('action-cloud-provider-evidence','cloud_provider_evidence','Collect cloud provider evidence','Security','in_progress',current_date + interval '45 days','Supabase, Vercel and GitHub.'),
  ('action-payment-provider-docs','payment_provider_documents','Collect payment provider compliance docs','Billing','open',current_date + interval '60 days','No payment details exposed.'),
  ('action-policy-validation','external_policy_validation','External policy validation','Legal / Security','open',current_date + interval '45 days','Policies remain readiness artifacts until reviewed.')
on conflict (action_key) do update set status = excluded.status, due_date = excluded.due_date, updated_at = now();

insert into public.iso_certification_body_options (provider_key, provider_name, standards_supported, estimated_cost_nis, estimated_timeline_weeks, required_documents, status, notes)
values
  ('sii','SII / מכון התקנים','["ISO 27001","ISO 27017","ISO 27701"]'::jsonb,null,null,'["scope","SoA","policies","risk register","evidence binder"]'::jsonb,'research','Local Israeli option to evaluate.'),
  ('bsi','BSI','["ISO 27001","ISO 27017","ISO 27701"]'::jsonb,null,null,'["scope","SoA","management system evidence"]'::jsonb,'research','International certification body option.'),
  ('dnv','DNV','["ISO 27001","ISO 27017","ISO 27701"]'::jsonb,null,null,'["scope","risk treatment plan","internal audit"]'::jsonb,'research','International option.'),
  ('sgs','SGS','["ISO 27001","ISO 27017","ISO 27701"]'::jsonb,null,null,'["scope","policies","controls","evidence"]'::jsonb,'research','International option.'),
  ('iqc','IQC','["ISO 27001","ISO 27017","ISO 27701"]'::jsonb,null,null,'["scope","audit binder","SoA"]'::jsonb,'research','Evaluate accreditation and fit.')
on conflict (provider_key) do update set standards_supported = excluded.standards_supported, required_documents = excluded.required_documents, updated_at = now();

insert into public.iso_cost_timeline_estimates (estimate_key, consultant_cost_nis, certification_body_cost_nis, remediation_cost_nis, annual_surveillance_cost_nis, internal_work_days, expected_timeline_weeks, confidence_level, notes)
values ('initial-iso-process-estimate', null, null, null, null, 45, 24, 'rough_estimate', 'Costs require consultant and certification body quotes.')
on conflict (estimate_key) do update set internal_work_days = excluded.internal_work_days, expected_timeline_weeks = excluded.expected_timeline_weeks, updated_at = now();

insert into public.iso_certification_claim_guardrails (guardrail_key, prohibited_claim, allowed_wording, status, notes)
values
  ('no-iso-certified','ISO certified','ISO readiness / certification preparation','active','Do not claim ISO certification before certificate exists.'),
  ('no-privacy-certified','privacy certified','privacy-by-design architecture / privacy readiness','active','Avoid unsupported certification claims.'),
  ('no-legally-approved','legally approved','legal review readiness / policy-gated controls','active','Legal approval requires external counsel.'),
  ('no-regulator-approved','regulator approved','regulatory readiness / compliance readiness','active','Regulator approval claim is forbidden without evidence.')
on conflict (guardrail_key) do update set allowed_wording = excluded.allowed_wording, updated_at = now();

insert into public.iso_public_copy_audit_items (item_key, page_path, risky_claim, risk_type, recommendation, status)
values
  ('copy-iso-certified','/*','Any ISO certified claim before certificate','false_certification_claim','Use ISO readiness or certification preparation only.','open'),
  ('copy-legally-approved','/*','Legally approved / regulator approved wording','unsupported_legal_claim','Use legal review readiness only unless external legal approval exists.','open'),
  ('copy-ai-guarantee','/*','AI prevents harm or detects abuse with certainty','unsupported_ai_claim','Use assists human review / detects motion anomalies requiring review.','open'),
  ('copy-safety-guarantee','/*','Guarantees child safety','unsupported_safety_guarantee','Use supports safety workflows and improves transparency.','open')
on conflict (item_key) do update set recommendation = excluded.recommendation, updated_at = now();

insert into public.iso_external_process_readiness_scores (snapshot_key, iso_27001_readiness, iso_27017_readiness, iso_27701_readiness, evidence_completeness, external_reviewer_status_score, certification_process_score, overall_handoff_score, certification_stage, remaining_blockers, notes)
values (
  'iso-external-process-baseline',
  72,
  66,
  68,
  64,
  52,
  45,
  61,
  'internal_ready',
  '["external ISO consultant not selected","certification body not selected","external penetration test not complete","supplier evidence incomplete","policy approvals need formal review"]'::jsonb,
  'Internal handoff package prepared. Certification remains external and not claimed.'
)
on conflict (snapshot_key) do update set
  iso_27001_readiness = excluded.iso_27001_readiness,
  iso_27017_readiness = excluded.iso_27017_readiness,
  iso_27701_readiness = excluded.iso_27701_readiness,
  evidence_completeness = excluded.evidence_completeness,
  external_reviewer_status_score = excluded.external_reviewer_status_score,
  certification_process_score = excluded.certification_process_score,
  overall_handoff_score = excluded.overall_handoff_score,
  certification_stage = excluded.certification_stage,
  remaining_blockers = excluded.remaining_blockers,
  notes = excluded.notes,
  calculated_at = now();

comment on table public.iso_certification_scopes is 'Certification scope definition for external ISO consultant and certification body review.';
comment on table public.iso_certification_process_stages is 'ISO certification process stage tracker. Certified must not be used without external certificate.';
comment on table public.iso_external_handoff_packages is 'External handoff package registry for ISO consultant, certification body and reviewers.';
comment on table public.iso_evidence_binder_finalization is 'Final evidence binder category readiness without sensitive data exposure.';
comment on table public.risk_treatment_plan is 'Risk treatment plan for ISO certification readiness.';
comment on table public.management_reviews is 'Management review readiness for ISO management-system expectations.';
comment on table public.iso_external_reviewer_access_modes is 'Safe external reviewer mode: metadata only, no child/medical/camera/payment/secrets.';
comment on table public.iso_reviewer_access_audit is 'Audit trail for external reviewer actions.';
comment on table public.iso_final_readiness_checklists is 'Final ISO 27001/27017/27701 readiness checklist.';
comment on table public.iso_certification_gaps is 'Certification-specific gap tracker for external process readiness.';
comment on table public.iso_certification_timeline is 'ISO certification timeline planner.';
comment on table public.iso_external_action_items is 'External actions that cannot be completed internally.';
comment on table public.iso_certification_body_options is 'Certification body comparison readiness. No automatic selection.';
comment on table public.iso_cost_timeline_estimates is 'Admin-only ISO cost and timeline estimates.';
comment on table public.iso_certification_claim_guardrails is 'Guardrails preventing unsupported certification/legal claims.';
comment on table public.iso_public_copy_audit_items is 'Public copy audit for ISO/legal/AI/safety claims.';
comment on table public.iso_external_process_readiness_scores is 'External ISO certification process handoff readiness scores.';

notify pgrst, 'reload schema';
