-- PHASE 189: External certification, legal approval and security validation execution.
-- Execution framework only. Does not issue legal approval, ISO certification or penetration test results.

alter table if exists public.legal_review_items drop constraint if exists legal_review_status_check;
alter table if exists public.legal_review_items add constraint legal_review_status_check
  check (current_status in (
    'open','in_progress','requires_external_review','not_started','sent_to_reviewer','under_review',
    'changes_requested','needs_changes','needs_review','requested','draft_for_legal_review',
    'fixed','re_review','approved','approved_with_conditions','rejected','blocked','closed','accepted_risk'
  ));

alter table if exists public.external_security_findings
  add column if not exists retest_result text,
  add column if not exists external_retest_at timestamptz;

alter table if exists public.external_security_findings drop constraint if exists external_security_finding_status_check;
alter table if exists public.external_security_findings add constraint external_security_finding_status_check
  check (status in ('open','triaged','assigned','fixed','under_retest','accepted_risk','verified','closed'));

create table if not exists public.external_reviewers (
  id uuid primary key default gen_random_uuid(),
  reviewer_key text not null unique,
  reviewer_name text not null,
  organization text,
  contact_details jsonb not null default '{}'::jsonb,
  reviewer_type text not null check (reviewer_type in (
    'privacy_lawyer','regulatory_lawyer','cybersecurity_company','penetration_tester',
    'iso_consultant','iso_certification_body','cloud_security_reviewer','payment_compliance_reviewer',
    'app_store_reviewer','camera_compliance_reviewer','ai_governance_reviewer'
  )),
  assigned_scope text,
  status text not null default 'planned' check (status in ('planned','contacted','engaged','active','waiting_feedback','completed','paused','cancelled')),
  engagement_start_date date,
  engagement_end_date date,
  documents_shared jsonb not null default '[]'::jsonb,
  findings_count integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.external_review_scopes (
  id uuid primary key default gen_random_uuid(),
  scope_key text not null unique,
  scope_name text not null,
  scope_type text not null check (scope_type in (
    'privacy_data_protection','camera_compliance','ai_governance','skeleton_motion_analytics',
    'parent_viewing','medical_data_protection','deletion_retention','payment_flows',
    'mobile_app_store_privacy','penetration_test','iso_27001','iso_27017','iso_27701'
  )),
  included_modules jsonb not null default '[]'::jsonb,
  excluded_modules jsonb not null default '[]'::jsonb,
  reviewer_key text,
  evidence_package text,
  status text not null default 'not_started' check (status in ('not_started','sent_to_reviewer','under_review','changes_requested','fixed','re_review','approved','approved_with_conditions','rejected','blocked')),
  blockers jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.penetration_test_execution (
  id uuid primary key default gen_random_uuid(),
  execution_key text not null unique,
  testing_company text,
  scope text not null,
  environment text not null default 'staging' check (environment in ('staging','test','sandbox','production_approved')),
  start_date date,
  end_date date,
  rules_of_engagement text,
  findings_submitted integer not null default 0,
  retest_required boolean not null default true,
  final_report_received boolean not null default false,
  remediation_status text not null default 'not_started' check (remediation_status in ('not_started','triage','in_progress','internal_verification','external_retest','verified','closed','blocked')),
  status text not null default 'planned' check (status in ('planned','scheduled','in_progress','report_received','retest_pending','completed','blocked','cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.iso_consultant_execution (
  id uuid primary key default gen_random_uuid(),
  execution_key text not null unique,
  iso_consultant text,
  scope text not null,
  standards_reviewed jsonb not null default '["ISO 27001","ISO 27017","ISO 27701"]'::jsonb,
  gap_analysis_status text not null default 'not_started' check (gap_analysis_status in ('not_started','scheduled','in_progress','report_received','remediation','completed','blocked')),
  documents_reviewed integer not null default 0,
  controls_reviewed integer not null default 0,
  policies_reviewed integer not null default 0,
  evidence_reviewed integer not null default 0,
  gaps_found integer not null default 0,
  remediation_status text not null default 'not_started' check (remediation_status in ('not_started','in_progress','verified','blocked','completed')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.iso_certification_execution (
  id uuid primary key default gen_random_uuid(),
  execution_key text not null unique,
  certification_body text,
  certification_scope text not null,
  stage_1_audit_readiness text not null default 'not_ready' check (stage_1_audit_readiness in ('not_ready','preparing','ready','completed','blocked')),
  stage_2_audit_readiness text not null default 'not_ready' check (stage_2_audit_readiness in ('not_ready','preparing','ready','completed','blocked')),
  audit_dates jsonb not null default '{}'::jsonb,
  audit_findings integer not null default 0,
  corrective_actions integer not null default 0,
  certification_decision text not null default 'not_started' check (certification_decision in ('not_started','pending','certified','rejected','deferred','surveillance_required')),
  certificate_status text not null default 'not_issued' check (certificate_status in ('not_issued','issued','expired','suspended','revoked')),
  surveillance_audit_readiness text not null default 'not_started',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint iso_cert_not_claimed_without_certificate check (certification_decision <> 'certified' or certificate_status = 'issued')
);

create table if not exists public.provider_compliance_evidence (
  id uuid primary key default gen_random_uuid(),
  evidence_key text not null unique,
  provider_name text not null,
  provider_type text not null check (provider_type in ('email','sms','whatsapp','push','payment','invoice','camera_gateway','ai_provider','supabase','vercel','github')),
  security_review_status text not null default 'not_started',
  privacy_review_status text not null default 'not_started',
  dpa_status text not null default 'not_started',
  subprocessor_status text not null default 'not_started',
  integration_risk text not null default 'medium' check (integration_risk in ('critical','high','medium','low')),
  evidence_reference text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.external_validation_findings (
  id uuid primary key default gen_random_uuid(),
  finding_key text not null unique,
  finding_source text not null check (finding_source in ('legal','privacy','camera_compliance','ai_governance','penetration_test','iso_consultant','iso_auditor','app_store','payment_provider','cloud_security_review')),
  finding_title text not null,
  severity text not null default 'medium' check (severity in ('critical','high','medium','low','informational')),
  affected_module text,
  description text not null,
  recommendation text,
  owner text,
  due_date date,
  status text not null default 'open' check (status in ('open','assigned','fixed','under_retest','verified','accepted_risk','deferred','closed')),
  accepted_risk_reason text,
  accepted_risk_owner text,
  accepted_risk_expiration date,
  mitigation text,
  management_approval text,
  external_reviewer_note text,
  blocks_launch boolean not null default false,
  evidence_reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_validation_accepted_risk_check check (
    status <> 'accepted_risk' or (accepted_risk_reason is not null and accepted_risk_owner is not null and accepted_risk_expiration is not null and management_approval is not null)
  )
);

create table if not exists public.external_evidence_vault (
  id uuid primary key default gen_random_uuid(),
  evidence_key text not null unique,
  evidence_type text not null check (evidence_type in ('reviewer_report','pt_report','iso_consultant_report','legal_review_notes','approval_letter','certification_document','app_store_review_notes','provider_compliance_document')),
  title text not null,
  storage_bucket text,
  storage_path text,
  external_reference text,
  sensitivity text not null default 'confidential' check (sensitivity in ('internal','confidential','restricted')),
  access_control_status text not null default 'private' check (access_control_status in ('private','restricted_reviewer','admin_only','archived')),
  reviewer_key text,
  status text not null default 'pending' check (status in ('pending','received','reviewed','approved','superseded','archived')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.external_validation_audit_trail (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  event_type text not null check (event_type in ('reviewer_added','document_shared','finding_created','finding_fixed','finding_accepted','evidence_uploaded','approval_recorded','certificate_uploaded','launch_blocker_changed')),
  actor text,
  target_type text,
  target_key text,
  event_summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.external_validation_scores (
  id uuid primary key default gen_random_uuid(),
  snapshot_key text not null unique,
  legal_review_progress integer not null default 0 check (legal_review_progress between 0 and 100),
  privacy_review_progress integer not null default 0 check (privacy_review_progress between 0 and 100),
  penetration_test_progress integer not null default 0 check (penetration_test_progress between 0 and 100),
  critical_findings_closed integer not null default 0 check (critical_findings_closed between 0 and 100),
  iso_readiness integer not null default 0 check (iso_readiness between 0 and 100),
  camera_compliance_review integer not null default 0 check (camera_compliance_review between 0 and 100),
  ai_governance_review integer not null default 0 check (ai_governance_review between 0 and 100),
  app_store_readiness integer not null default 0 check (app_store_readiness between 0 and 100),
  payment_review integer not null default 0 check (payment_review between 0 and 100),
  external_validation_score integer not null default 0 check (external_validation_score between 0 and 100),
  launch_recommendation text not null default 'not_ready' check (launch_recommendation in ('not_ready','continue_external_review','ready_after_conditions','ready_for_controlled_launch','blocked')),
  blockers jsonb not null default '[]'::jsonb,
  calculated_at timestamptz not null default now()
);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'external_reviewers','external_review_scopes','penetration_test_execution',
    'iso_consultant_execution','iso_certification_execution','provider_compliance_evidence',
    'external_validation_findings','external_evidence_vault','external_validation_audit_trail',
    'external_validation_scores'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists "%I admin manage" on public.%I', table_name, table_name);
    execute format('create policy "%I admin manage" on public.%I for all using (public.is_admin()) with check (public.is_admin())', table_name, table_name);
  end loop;
end $$;

create index if not exists idx_external_reviewers_type_status on public.external_reviewers(reviewer_type, status);
create index if not exists idx_external_review_scopes_status on public.external_review_scopes(scope_type, status);
create index if not exists idx_pt_execution_status on public.penetration_test_execution(status, remediation_status);
create index if not exists idx_iso_consultant_execution_status on public.iso_consultant_execution(gap_analysis_status, remediation_status);
create index if not exists idx_iso_certification_execution_status on public.iso_certification_execution(certification_decision, certificate_status);
create index if not exists idx_provider_compliance_evidence_risk on public.provider_compliance_evidence(provider_type, integration_risk);
create index if not exists idx_external_validation_findings_status on public.external_validation_findings(status, severity, blocks_launch);
create index if not exists idx_external_evidence_vault_status on public.external_evidence_vault(evidence_type, status, sensitivity);
create index if not exists idx_external_validation_audit_created on public.external_validation_audit_trail(created_at desc);
create index if not exists idx_external_validation_scores_calculated on public.external_validation_scores(calculated_at desc);

insert into public.external_reviewers (reviewer_key, reviewer_name, organization, reviewer_type, assigned_scope, status, documents_shared, findings_count, notes)
values
  ('privacy-lawyer-tbd','Privacy lawyer TBD','External counsel TBD','privacy_lawyer','Privacy, DPIA, DPA, child data, deletion and retention','planned','["PRIVACY_LAWYER_EXTERNAL_REVIEW_PACKAGE.md"]'::jsonb,0,'External privacy approval is not yet received.'),
  ('regulatory-lawyer-tbd','Regulatory lawyer TBD','External counsel TBD','regulatory_lawyer','Israeli kindergarten regulatory review and legal claims','planned','["EXTERNAL_CERTIFICATION_LEGAL_APPROVAL_AND_SECURITY_VALIDATION_EXECUTION.md"]'::jsonb,0,'Regulatory approval is not yet received.'),
  ('camera-compliance-tbd','Camera compliance reviewer TBD','Camera compliance expert TBD','camera_compliance_reviewer','Camera viewing, RTSP, tokens, watermark and parent boundaries','planned','["CAMERA_COMPLIANCE_EXTERNAL_EXECUTION_PACKAGE.md"]'::jsonb,0,'Camera compliance approval is not yet received.'),
  ('ai-governance-tbd','AI governance reviewer TBD','AI governance expert TBD','ai_governance_reviewer','AI capability matrix, observer workflow and human review','planned','["AI_GOVERNANCE_EXTERNAL_REVIEW_PACKAGE.md"]'::jsonb,0,'AI governance approval is not yet received.'),
  ('pt-company-tbd','Penetration testing company TBD','Cybersecurity company TBD','cybersecurity_company','Authorized external penetration test','planned','["PENETRATION_TEST_RULES_OF_ENGAGEMENT.md","SECURITY_ARCHITECTURE_EXTERNAL_REVIEW_PACK.md"]'::jsonb,0,'No real PT executed by Codex.'),
  ('iso-consultant-tbd','ISO consultant TBD','ISO consultancy TBD','iso_consultant','ISO 27001, 27017 and 27701 gap analysis','planned','["ISO_CONSULTANT_HANDOFF_PACKAGE.md"]'::jsonb,0,'No ISO consultant decision yet.'),
  ('iso-body-tbd','ISO certification body TBD','Certification body TBD','iso_certification_body','Certification scope, Stage 1 and Stage 2 audits','planned','["ISO_CERTIFICATION_BODY_HANDOFF_PACKAGE.md"]'::jsonb,0,'Do not claim certification.'),
  ('payment-reviewer-tbd','Payment compliance reviewer TBD','Payment/provider reviewer TBD','payment_compliance_reviewer','Gan Batuach, parent tuition and Digital Observer payment separation','planned','["PARENT_TO_KINDERGARTEN_PAYMENT_LEGAL_REVIEW_PACK.md"]'::jsonb,0,'Payment review pending.'),
  ('app-store-reviewers','Apple and Google reviewers','Apple / Google','app_store_reviewer','App Store, TestFlight, Google Play and internal testing','planned','["APP_REVIEW_NOTES_PACKAGE.md"]'::jsonb,0,'Actual store review depends on manual submission.')
on conflict (reviewer_key) do update set documents_shared = excluded.documents_shared, notes = excluded.notes, updated_at = now();

insert into public.external_review_scopes (scope_key, scope_name, scope_type, included_modules, excluded_modules, reviewer_key, evidence_package, status, blockers, notes)
values
  ('scope-privacy-data-protection','Privacy and data protection','privacy_data_protection','["privacy policy","DPIA","DPA","data flow","rights requests","retention","child data","medical data"]'::jsonb,'["secrets","raw camera streams"]'::jsonb,'privacy-lawyer-tbd','PRIVACY_LAWYER_EXTERNAL_REVIEW_PACKAGE.md','not_started','["external privacy lawyer not engaged"]'::jsonb,'Core privacy approval scope.'),
  ('scope-camera-compliance','Camera compliance','camera_compliance','["camera gateway","parent viewing","tokens","watermark","audit logs","Gan Batuach Israel Mode"]'::jsonb,'["raw RTSP exposure","camera credentials in browser"]'::jsonb,'camera-compliance-tbd','CAMERA_COMPLIANCE_EXTERNAL_EXECUTION_PACKAGE.md','not_started','["camera compliance reviewer not engaged"]'::jsonb,'Camera law and parent viewing scope.'),
  ('scope-ai-governance','AI governance and Digital Observer','ai_governance','["capability matrix","observer signals","human review","explainability","audit logs"]'::jsonb,'["automatic accusations","raw AI parent visibility"]'::jsonb,'ai-governance-tbd','AI_GOVERNANCE_EXTERNAL_REVIEW_PACKAGE.md','not_started','["AI governance reviewer not engaged"]'::jsonb,'AI capabilities cannot be promoted without review.'),
  ('scope-skeleton-contextual','Skeleton and contextual matching','skeleton_motion_analytics','["pose estimation","skeleton keypoints","motion anomaly","contextual association review"]'::jsonb,'["gait recognition","persistent identity","cross-day tracking"]'::jsonb,'privacy-lawyer-tbd','AI_GOVERNANCE_EXTERNAL_REVIEW_PACKAGE.md','blocked','["legal approval required before enablement"]'::jsonb,'Default legal_review_required for Gan Batuach.'),
  ('scope-parent-viewing','Parent viewing','parent_viewing','["viewing hours","checked-in validation","automatic disconnect","audit logs","watermark"]'::jsonb,'["unrestricted camera access"]'::jsonb,'camera-compliance-tbd','CAMERA_COMPLIANCE_EXTERNAL_EXECUTION_PACKAGE.md','not_started','["parent viewing legal conditions pending"]'::jsonb,'Parent camera rules scope.'),
  ('scope-payment-flows','Payment flows','payment_flows','["Gan Batuach subscription","parent tuition","Digital Observer subscription","webhooks","invoices"]'::jsonb,'["raw card storage"]'::jsonb,'payment-reviewer-tbd','PARENT_TO_KINDERGARTEN_PAYMENT_LEGAL_REVIEW_PACK.md','not_started','["provider compliance review pending"]'::jsonb,'Payment stream separation.'),
  ('scope-pt','Penetration test','penetration_test','["auth","authorization","RLS","storage","camera","AI","payments","webhooks","mobile"]'::jsonb,'["destructive production testing","real child data"]'::jsonb,'pt-company-tbd','PENETRATION_TEST_RULES_OF_ENGAGEMENT.md','not_started','["authorized PT company not selected"]'::jsonb,'External PT only.'),
  ('scope-iso-27001','ISO 27001','iso_27001','["ISMS","access control","risk","incident","supplier","BCP","audit"]'::jsonb,'["external provider internal systems"]'::jsonb,'iso-consultant-tbd','ISO_CONSULTANT_HANDOFF_PACKAGE.md','not_started','["consultant and certification body not selected"]'::jsonb,'ISO readiness only.'),
  ('scope-iso-27017','ISO 27017','iso_27017','["cloud shared responsibility","tenant isolation","cloud backup","monitoring"]'::jsonb,'["cloud provider internal controls"]'::jsonb,'iso-consultant-tbd','ISO_CONSULTANT_HANDOFF_PACKAGE.md','not_started','["cloud evidence still needed"]'::jsonb,'Cloud/SaaS review.'),
  ('scope-iso-27701','ISO 27701','iso_27701','["privacy management","data subject rights","DPIA","consent/notice","subprocessors"]'::jsonb,'["legal approval claims"]'::jsonb,'iso-consultant-tbd','ISO_CONSULTANT_HANDOFF_PACKAGE.md','not_started','["privacy consultant review pending"]'::jsonb,'Privacy management review.'),
  ('scope-mobile-store','Mobile app store privacy','mobile_app_store_privacy','["Apple privacy labels","Google Data Safety","permissions","review notes"]'::jsonb,'["real reviewer passwords in files"]'::jsonb,'app-store-reviewers','APP_REVIEW_NOTES_PACKAGE.md','not_started','["manual app submission not performed"]'::jsonb,'Connects to Phase 188.')
on conflict (scope_key) do update set status = excluded.status, blockers = excluded.blockers, updated_at = now();

insert into public.penetration_test_execution (execution_key, testing_company, scope, environment, rules_of_engagement, status, remediation_status, notes)
values ('pt-external-baseline','TBD authorized cybersecurity company','Approved staging/sandbox PT scope','staging','PENETRATION_TEST_RULES_OF_ENGAGEMENT.md','planned','not_started','Do not run destructive tests or production tests without explicit approval.')
on conflict (execution_key) do update set notes = excluded.notes, updated_at = now();

insert into public.iso_consultant_execution (execution_key, iso_consultant, scope, gap_analysis_status, notes)
values ('iso-consultant-baseline','TBD ISO consultant','Gan Batuach SaaS, Digital Observer readiness, cloud/security/privacy controls','not_started','No ISO consultant review has been completed.')
on conflict (execution_key) do update set notes = excluded.notes, updated_at = now();

insert into public.iso_certification_execution (execution_key, certification_body, certification_scope, notes)
values ('iso-certification-body-baseline','TBD certification body','ISO 27001 / 27017 / 27701 scope to be approved externally','Do not mark certified unless official certificate exists.')
on conflict (execution_key) do update set notes = excluded.notes, updated_at = now();

insert into public.provider_compliance_evidence (evidence_key, provider_name, provider_type, security_review_status, privacy_review_status, dpa_status, subprocessor_status, integration_risk, evidence_reference, notes)
values
  ('provider-supabase','Supabase','supabase','under_review','under_review','needs_review','listed','high','subprocessor_register','Database, auth, storage and RLS evidence.'),
  ('provider-vercel','Vercel','vercel','under_review','under_review','needs_review','listed','medium','subprocessor_register','Hosting and deployment evidence.'),
  ('provider-github','GitHub','github','under_review','under_review','needs_review','listed','medium','subprocessor_register','Source control and CI evidence.'),
  ('provider-email','Email provider','email','not_started','not_started','not_started','pending','medium','PROVIDER_PRODUCTION_ACTIVATION_FINAL.md','Provider selected during production activation.'),
  ('provider-sms','SMS provider','sms','not_started','not_started','not_started','pending','medium','PROVIDER_PRODUCTION_ACTIVATION_FINAL.md','SMS delivery and opt-in review.'),
  ('provider-whatsapp','WhatsApp provider','whatsapp','not_started','not_started','not_started','pending','medium','PROVIDER_PRODUCTION_ACTIVATION_FINAL.md','WhatsApp templates and opt-in review.'),
  ('provider-push','Push provider','push','not_started','not_started','not_started','pending','medium','APP_REVIEW_NOTES_PACKAGE.md','FCM/APNs/Web Push review.'),
  ('provider-payment','Payment provider','payment','not_started','not_started','not_started','pending','high','PARENT_TO_KINDERGARTEN_PAYMENT_LEGAL_REVIEW_PACK.md','No raw card storage and payment stream separation.'),
  ('provider-invoice','Invoice provider','invoice','not_started','not_started','not_started','pending','medium','PROVIDER_PRODUCTION_ACTIVATION_FINAL.md','Invoice stream separation.'),
  ('provider-camera-gateway','Camera gateway provider','camera_gateway','not_started','not_started','not_started','pending','high','CAMERA_COMPLIANCE_EXTERNAL_EXECUTION_PACKAGE.md','No RTSP/credential exposure.'),
  ('provider-ai','AI provider','ai_provider','not_started','not_started','not_started','pending','high','AI_GOVERNANCE_EXTERNAL_REVIEW_PACKAGE.md','Human review and capability matrix.')
on conflict (evidence_key) do update set notes = excluded.notes, updated_at = now();

insert into public.external_validation_findings (finding_key, finding_source, finding_title, severity, affected_module, description, recommendation, owner, due_date, status, blocks_launch, evidence_reference, metadata)
values
  ('finding-privacy-lawyer-pending','privacy','Privacy lawyer review not completed','high','privacy','Privacy lawyer has not approved privacy policy, DPIA, DPA, rights, retention and child data model.','Engage external privacy lawyer and track comments to closure.','Legal / Privacy',current_date + 30,'open',true,'PRIVACY_LAWYER_EXTERNAL_REVIEW_PACKAGE.md','{"phase":189}'::jsonb),
  ('finding-camera-compliance-pending','camera_compliance','Camera compliance review not completed','high','camera','Parent viewing, camera notices, short-lived tokens and anti-leak limitations need external review.','Engage camera compliance reviewer before enabling real parent camera visibility.','Camera / Legal',current_date + 30,'open',true,'CAMERA_COMPLIANCE_EXTERNAL_EXECUTION_PACKAGE.md','{"phase":189}'::jsonb),
  ('finding-ai-governance-pending','ai_governance','AI governance external review not completed','high','ai_observer','AI capability matrix and observer workflows need external review before production use.','Keep Gan Batuach AI in shadow/human-review mode.','AI Governance',current_date + 45,'open',true,'AI_GOVERNANCE_EXTERNAL_REVIEW_PACKAGE.md','{"phase":189}'::jsonb),
  ('finding-pt-pending','penetration_test','External penetration test not executed','critical','security','Authorized external penetration test final report is not attached.','Engage PT company, import findings and close critical/high issues before launch.','Security',current_date + 60,'open',true,'PENETRATION_TEST_RULES_OF_ENGAGEMENT.md','{"phase":189}'::jsonb),
  ('finding-iso-consultant-pending','iso_consultant','ISO consultant gap analysis pending','medium','iso','ISO consultant has not reviewed SoA, evidence, policies and risk treatment plan.','Run consultant gap analysis before claiming readiness for audit.','Security / ISO',current_date + 60,'open',false,'ISO_CONSULTANT_HANDOFF_PACKAGE.md','{"phase":189}'::jsonb),
  ('finding-app-store-review-pending','app_store','App store external review not completed','medium','mobile','Apple/Google review has not been submitted or approved.','Complete Phase 188 manual submission steps when approved.','Mobile Release',current_date + 45,'open',false,'APP_REVIEW_NOTES_PACKAGE.md','{"phase":189}'::jsonb),
  ('finding-payment-compliance-pending','payment_provider','Payment provider compliance review pending','high','payments','Payment provider and invoice separation review is pending.','Confirm tokenization, webhook validation and stream separation.','Finance / Compliance',current_date + 45,'open',true,'PARENT_TO_KINDERGARTEN_PAYMENT_LEGAL_REVIEW_PACK.md','{"phase":189}'::jsonb),
  ('finding-skeleton-contextual-legal-review','legal','Skeleton/contextual matching requires external legal approval','critical','skeleton_motion','Skeleton tracking, contextual child association, soft biometrics, gait recognition, persistent identity and cross-day tracking are legal_review_required.','Do not enable these capabilities for Gan Batuach unless external approval is recorded.','Legal / AI Governance',current_date + 30,'open',true,'AI_GOVERNANCE_EXTERNAL_REVIEW_PACKAGE.md','{"phase":189,"default_status":"legal_review_required"}'::jsonb)
on conflict (finding_key) do update set recommendation = excluded.recommendation, blocks_launch = excluded.blocks_launch, updated_at = now();

insert into public.external_evidence_vault (evidence_key, evidence_type, title, external_reference, sensitivity, access_control_status, reviewer_key, status, notes)
values
  ('vault-privacy-lawyer-package','legal_review_notes','Privacy lawyer execution package','PRIVACY_LAWYER_EXTERNAL_REVIEW_PACKAGE.md','confidential','admin_only','privacy-lawyer-tbd','pending','Package prepared, external report pending.'),
  ('vault-camera-compliance-package','legal_review_notes','Camera compliance execution package','CAMERA_COMPLIANCE_EXTERNAL_EXECUTION_PACKAGE.md','confidential','admin_only','camera-compliance-tbd','pending','Package prepared, external approval pending.'),
  ('vault-ai-governance-package','legal_review_notes','AI governance external review package','AI_GOVERNANCE_EXTERNAL_REVIEW_PACKAGE.md','confidential','admin_only','ai-governance-tbd','pending','Package prepared, external review pending.'),
  ('vault-pt-report-placeholder','pt_report','External penetration test report placeholder',null,'restricted','admin_only','pt-company-tbd','pending','No PT report received.'),
  ('vault-iso-consultant-report-placeholder','iso_consultant_report','ISO consultant report placeholder',null,'restricted','admin_only','iso-consultant-tbd','pending','No ISO consultant report received.'),
  ('vault-certification-placeholder','certification_document','ISO certificate placeholder',null,'restricted','admin_only','iso-body-tbd','pending','No certificate issued.')
on conflict (evidence_key) do update set notes = excluded.notes, updated_at = now();

insert into public.external_validation_audit_trail (event_key, event_type, actor, target_type, target_key, event_summary, metadata)
values ('phase189-validation-framework-created','reviewer_added','system','external_validation','phase189','External validation execution framework created. No external approval or certificate issued.','{"phase":189,"not_approval":true}'::jsonb)
on conflict (event_key) do nothing;

insert into public.external_validation_scores (snapshot_key, legal_review_progress, privacy_review_progress, penetration_test_progress, critical_findings_closed, iso_readiness, camera_compliance_review, ai_governance_review, app_store_readiness, payment_review, external_validation_score, launch_recommendation, blockers)
values (
  'external-validation-baseline',
  35, 30, 10, 0, 52, 28, 32, 45, 35, 31,
  'blocked',
  '["privacy lawyer approval pending","camera compliance approval pending","external PT not executed","AI governance review pending","payment compliance review pending","no ISO certificate issued"]'::jsonb
) on conflict (snapshot_key) do update set
  legal_review_progress = excluded.legal_review_progress,
  privacy_review_progress = excluded.privacy_review_progress,
  penetration_test_progress = excluded.penetration_test_progress,
  critical_findings_closed = excluded.critical_findings_closed,
  iso_readiness = excluded.iso_readiness,
  camera_compliance_review = excluded.camera_compliance_review,
  ai_governance_review = excluded.ai_governance_review,
  app_store_readiness = excluded.app_store_readiness,
  payment_review = excluded.payment_review,
  external_validation_score = excluded.external_validation_score,
  launch_recommendation = excluded.launch_recommendation,
  blockers = excluded.blockers,
  calculated_at = now();

insert into public.launch_blockers (blocker_key, blocker_type, title, severity, status, resolution, metadata)
values
  ('external-privacy-approval-required','legal','External privacy lawyer approval required before full production launch','critical','open','Privacy lawyer package is prepared but no external approval is recorded. Engage privacy lawyer and close required changes.','{"phase":189}'::jsonb),
  ('external-pt-report-required','security','External penetration test final report required before full production launch','critical','open','PT readiness exists but no authorized external final report is attached. Run authorized external PT and close critical/high findings.','{"phase":189}'::jsonb),
  ('external-camera-compliance-required','cameras','Camera compliance approval required before real parent camera visibility','high','open','Camera execution package is prepared but approval is pending. Obtain camera compliance review before enabling real camera parent visibility.','{"phase":189}'::jsonb)
on conflict (blocker_key) do update set resolution = excluded.resolution, updated_at = now();

comment on table public.external_reviewers is 'External reviewer registry for legal, privacy, security, ISO, app store, payment, camera and AI reviews.';
comment on table public.external_review_scopes is 'External review scope management with included/excluded modules, reviewer and evidence package.';
comment on table public.penetration_test_execution is 'Authorized external penetration test execution tracker. No destructive tests are run by this migration.';
comment on table public.iso_consultant_execution is 'ISO consultant execution tracker for ISO 27001, 27017 and 27701 gap analysis.';
comment on table public.iso_certification_execution is 'Certification body execution tracker. Certified must not be marked without official certificate.';
comment on table public.external_validation_findings is 'Unified external validation finding register across legal, privacy, camera, AI, PT, ISO, app store, payment and cloud reviews.';
comment on table public.external_evidence_vault is 'Secure evidence vault metadata for external reports, approvals and certificates. Sensitive documents remain private.';
comment on table public.external_validation_scores is 'External validation score. Not legal approval, ISO certification or security certification.';

notify pgrst, 'reload schema';
