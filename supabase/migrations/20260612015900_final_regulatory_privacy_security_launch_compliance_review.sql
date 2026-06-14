-- PHASE 159: Final Regulatory, Privacy, Security & Launch Compliance Review

create extension if not exists "pgcrypto";

create table if not exists public.legal_review_items (
  id uuid primary key default gen_random_uuid(),
  item_key text not null unique,
  item_title text not null,
  risk_level text not null default 'medium',
  affected_module text not null,
  legal_question text not null,
  current_status text not null default 'requires_external_review',
  owner_role text not null default 'admin',
  owner_profile_id uuid references public.profiles(id) on delete set null,
  required_external_review text not null default 'legal_counsel',
  target_review_date date,
  resolution_summary text,
  evidence_item_id uuid references public.iso_evidence_items(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint legal_review_risk_level_check check (risk_level in ('critical','high','medium','low')),
  constraint legal_review_status_check check (current_status in ('open','in_progress','requires_external_review','approved','rejected','accepted_risk','closed')),
  constraint legal_review_external_review_check check (required_external_review in ('legal_counsel','privacy_lawyer','iso_consultant','penetration_tester','cloud_security_reviewer','accounting_payment_reviewer','regulator','none'))
);

create table if not exists public.final_compliance_gaps (
  id uuid primary key default gen_random_uuid(),
  gap_key text not null unique,
  gap_area text not null,
  gap_title text not null,
  gap_description text not null,
  severity text not null default 'medium',
  status text not null default 'open',
  blocks_pilot boolean not null default false,
  blocks_production boolean not null default true,
  owner_role text not null default 'admin',
  owner_profile_id uuid references public.profiles(id) on delete set null,
  remediation_plan text,
  required_evidence text,
  due_date date,
  verified_at timestamptz,
  accepted_risk_reason text,
  legal_review_item_id uuid references public.legal_review_items(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint final_compliance_gap_area_check check (gap_area in (
    'regulatory','privacy','security','camera','ai_governance','attendance_pickup','medical_data',
    'mfa_identity','audit','retention','iso','ci_cd','headers','rls','storage','billing','digital_observer','launch'
  )),
  constraint final_compliance_gap_severity_check check (severity in ('critical','high','medium','low')),
  constraint final_compliance_gap_status_check check (status in ('open','in_progress','fixed','accepted_risk','requires_external_review','verified')),
  constraint final_compliance_accepted_risk_check check (
    status <> 'accepted_risk' or accepted_risk_reason is not null
  )
);

create table if not exists public.final_regulatory_readiness_score (
  id uuid primary key default gen_random_uuid(),
  snapshot_key text not null unique,
  regulatory_readiness_score integer not null default 0,
  privacy_readiness_score integer not null default 0,
  security_readiness_score integer not null default 0,
  camera_compliance_score integer not null default 0,
  ai_governance_score integer not null default 0,
  iso_readiness_score integer not null default 0,
  launch_readiness_score integer not null default 0,
  final_readiness_score integer not null default 0,
  launch_recommendation text not null default 'not_ready',
  critical_blockers integer not null default 0,
  legal_review_items_count integer not null default 0,
  open_gaps_count integer not null default 0,
  generated_from jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint final_regulatory_score_range_check check (
    regulatory_readiness_score between 0 and 100
    and privacy_readiness_score between 0 and 100
    and security_readiness_score between 0 and 100
    and camera_compliance_score between 0 and 100
    and ai_governance_score between 0 and 100
    and iso_readiness_score between 0 and 100
    and launch_readiness_score between 0 and 100
    and final_readiness_score between 0 and 100
  ),
  constraint final_launch_recommendation_check check (launch_recommendation in ('not_ready','pilot_ready_with_blockers','pilot_ready','production_ready_after_external_review'))
);

create index if not exists legal_review_items_status_idx on public.legal_review_items(current_status, risk_level, target_review_date);
create index if not exists final_compliance_gaps_status_idx on public.final_compliance_gaps(status, severity, due_date);
create index if not exists final_compliance_gaps_area_idx on public.final_compliance_gaps(gap_area, status);
create index if not exists final_regulatory_score_created_idx on public.final_regulatory_readiness_score(created_at desc);

alter table public.legal_review_items enable row level security;
alter table public.final_compliance_gaps enable row level security;
alter table public.final_regulatory_readiness_score enable row level security;

drop policy if exists "legal review items admin only" on public.legal_review_items;
create policy "legal review items admin only" on public.legal_review_items for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "final compliance gaps admin only" on public.final_compliance_gaps;
create policy "final compliance gaps admin only" on public.final_compliance_gaps for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "final regulatory score admin only" on public.final_regulatory_readiness_score;
create policy "final regulatory score admin only" on public.final_regulatory_readiness_score for all using (public.is_admin()) with check (public.is_admin());

insert into public.legal_review_items (item_key, item_title, risk_level, affected_module, legal_question, current_status, owner_role, required_external_review, target_review_date, metadata)
values
  ('contextual-child-association-skeleton', 'Contextual child association via skeleton context', 'high', 'AI Observer', 'Can temporary skeleton/context association be used in Gan Batuach without becoming biometric profiling?', 'requires_external_review', 'admin', 'privacy_lawyer', current_date + 45, '{"phase":159,"default_status":"disabled_or_legal_review_required"}'::jsonb),
  ('soft-biometric-matching', 'Soft biometric matching and gait-related signals', 'high', 'Digital Observer Core', 'Which advanced observer capabilities may remain future-only and what approvals are required before activation?', 'requires_external_review', 'admin', 'privacy_lawyer', current_date + 60, '{"phase":159,"gan_batuach":"disabled"}'::jsonb),
  ('parent-camera-streaming-policy', 'Parent camera streaming policy', 'high', 'Camera Platform', 'What legal notices, consent, viewing windows and anti-leak controls are required before parent viewing?', 'requires_external_review', 'admin', 'legal_counsel', current_date + 45, '{"phase":159,"requires_policy_review":true}'::jsonb),
  ('retention-periods-child-medical-camera', 'Retention periods for child, medical, camera and evidence data', 'high', 'Privacy and Retention', 'Which retention periods are legally required and which deletion/anonymization exceptions apply?', 'requires_external_review', 'admin', 'privacy_lawyer', current_date + 60, '{"phase":159}'::jsonb),
  ('public-safety-score-exposure', 'Public or parent-facing safety score exposure', 'medium', 'Trust and Transparency', 'Which scores may be visible to parents or public pages without implying certification or legal conclusion?', 'requires_external_review', 'admin', 'legal_counsel', current_date + 75, '{"phase":159,"no_certification_claim":true}'::jsonb),
  ('payment-routing-accounting-review', 'Payment routing and accounting separation', 'medium', 'Billing', 'Confirm Gan Batuach subscription revenue and parent tuition routing remain legally and accounting-wise separated.', 'requires_external_review', 'admin', 'accounting_payment_reviewer', current_date + 60, '{"phase":159,"separate_revenue_streams":true}'::jsonb)
on conflict (item_key) do update set
  item_title = excluded.item_title,
  risk_level = excluded.risk_level,
  affected_module = excluded.affected_module,
  legal_question = excluded.legal_question,
  current_status = excluded.current_status,
  owner_role = excluded.owner_role,
  required_external_review = excluded.required_external_review,
  target_review_date = excluded.target_review_date,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.final_compliance_gaps (gap_key, gap_area, gap_title, gap_description, severity, status, blocks_pilot, blocks_production, owner_role, remediation_plan, required_evidence, due_date, metadata)
values
  ('final-admin-mfa-provider-verification', 'mfa_identity', 'MFA provider verification before pilot', 'MFA policies exist, but real provider challenge success and sensitive-action enforcement must be verified end to end.', 'critical', 'open', true, true, 'admin', 'Connect Supabase MFA verification, test admin sensitive actions and attach evidence.', 'MFA test evidence for admin, manager, inspector and parent camera gate.', current_date + 21, '{"phase":159}'::jsonb),
  ('final-rls-sensitive-table-review', 'rls', 'Sensitive table RLS final review', 'RLS exists on many sensitive tables, but a final schema scan must verify no sensitive table is exposed without scoped policies.', 'critical', 'open', true, true, 'admin', 'Run schema-level RLS/policy review for parent, garden, inspector and admin scopes.', 'RLS scan report with no public child/medical/camera/document exposure.', current_date + 21, '{"phase":159}'::jsonb),
  ('final-storage-private-bucket-proof', 'storage', 'Private sensitive storage proof', 'ID documents, medical documents, staff certificates, signatures, inspection evidence and incident evidence require private bucket proof and audited signed URL access.', 'high', 'in_progress', false, true, 'admin', 'Inventory storage buckets, verify private access and signed URL audit flow.', 'Storage bucket access report and signed URL audit evidence.', current_date + 30, '{"phase":159}'::jsonb),
  ('final-camera-streaming-legal-review', 'camera', 'Parent camera streaming legal review', 'Camera token, schedule, child checked-in gate and watermark readiness exist, but parent streaming policy needs external legal approval.', 'high', 'requires_external_review', false, true, 'admin', 'Complete external legal review and document approved viewing policy.', 'Legal sign-off and camera compliance evidence.', current_date + 45, '{"phase":159}'::jsonb),
  ('final-medical-encryption-backfill', 'medical_data', 'Medical encryption backfill evidence', 'Encryption utility and registry exist, but plaintext-to-encrypted backfill must be executed and verified before production.', 'high', 'in_progress', false, true, 'admin', 'Run backfill in controlled environment, verify no plaintext medical logging and audit decrypt events.', 'Backfill report and medical access audit sample.', current_date + 35, '{"phase":159}'::jsonb),
  ('final-ci-cd-green-run', 'ci_cd', 'CI/CD security gates must pass', 'Typecheck/build/security workflows must produce a clean run before launch readiness can be production-approved.', 'high', 'open', false, true, 'admin', 'Fix existing TypeScript/build dependency failures and require security checks in branch protection.', 'Passing GitHub workflow run and branch protection screenshot.', current_date + 30, '{"phase":159}'::jsonb),
  ('final-external-penetration-test', 'security', 'External penetration test required', 'Internal readiness does not replace an external penetration test for auth, API, camera, documents and payment paths.', 'medium', 'requires_external_review', false, true, 'admin', 'Schedule penetration test and track findings through final_compliance_gaps.', 'Penetration test report and remediation evidence.', current_date + 90, '{"phase":159}'::jsonb),
  ('final-iso-consultant-review', 'iso', 'External ISO consultant review', 'ISO evidence pack is organized, but an external consultant must validate SoA, policies, evidence and gaps.', 'medium', 'requires_external_review', false, true, 'admin', 'Run ISO consultant review against evidence pack and close findings.', 'Consultant review summary and updated gap register.', current_date + 90, '{"phase":159}'::jsonb)
on conflict (gap_key) do update set
  gap_area = excluded.gap_area,
  gap_title = excluded.gap_title,
  gap_description = excluded.gap_description,
  severity = excluded.severity,
  status = excluded.status,
  blocks_pilot = excluded.blocks_pilot,
  blocks_production = excluded.blocks_production,
  owner_role = excluded.owner_role,
  remediation_plan = excluded.remediation_plan,
  required_evidence = excluded.required_evidence,
  due_date = excluded.due_date,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.final_regulatory_readiness_score (
  snapshot_key,
  regulatory_readiness_score,
  privacy_readiness_score,
  security_readiness_score,
  camera_compliance_score,
  ai_governance_score,
  iso_readiness_score,
  launch_readiness_score,
  final_readiness_score,
  launch_recommendation,
  critical_blockers,
  legal_review_items_count,
  open_gaps_count,
  generated_from,
  metadata
)
values (
  'phase159-initial-internal-review',
  78,
  72,
  68,
  74,
  76,
  70,
  66,
  72,
  'pilot_ready_with_blockers',
  2,
  6,
  8,
  '{"source":"seeded_internal_review","phase":159}'::jsonb,
  '{"no_certification_claim":true,"external_review_required":true}'::jsonb
)
on conflict (snapshot_key) do update set
  regulatory_readiness_score = excluded.regulatory_readiness_score,
  privacy_readiness_score = excluded.privacy_readiness_score,
  security_readiness_score = excluded.security_readiness_score,
  camera_compliance_score = excluded.camera_compliance_score,
  ai_governance_score = excluded.ai_governance_score,
  iso_readiness_score = excluded.iso_readiness_score,
  launch_readiness_score = excluded.launch_readiness_score,
  final_readiness_score = excluded.final_readiness_score,
  launch_recommendation = excluded.launch_recommendation,
  critical_blockers = excluded.critical_blockers,
  legal_review_items_count = excluded.legal_review_items_count,
  open_gaps_count = excluded.open_gaps_count,
  generated_from = excluded.generated_from,
  metadata = excluded.metadata;

comment on table public.legal_review_items is 'Final legal review register for Gan Batuach regulatory, privacy, AI, camera, retention and payment questions before pilot or production.';
comment on table public.final_compliance_gaps is 'Final internal compliance gap register. Critical blockers prevent pilot; production blockers require closure or accepted risk with external review.';
comment on table public.final_regulatory_readiness_score is 'Final internal readiness score snapshots. Readiness only; not legal advice, ISO certification or penetration-test approval.';
