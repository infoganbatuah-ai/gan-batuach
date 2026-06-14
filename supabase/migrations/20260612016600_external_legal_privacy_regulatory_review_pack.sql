-- PHASE 166: External Legal, Privacy & Regulatory Review Pack
-- Readiness package only. This is not legal approval, ISO certification or regulatory sign-off.

create extension if not exists "pgcrypto";

alter table if exists public.legal_review_items
  add column if not exists external_reviewer text,
  add column if not exists next_review_date date,
  add column if not exists attached_documents jsonb not null default '[]'::jsonb,
  add column if not exists review_pack_key text,
  add column if not exists decision_notes text,
  add column if not exists implementation_owner text;

alter table if exists public.legal_review_items drop constraint if exists legal_review_status_check;
alter table if exists public.legal_review_items add constraint legal_review_status_check
  check (current_status in (
    'open','in_progress','requires_external_review','under_review','approved','rejected',
    'needs_changes','blocked','approved_with_conditions','accepted_risk','closed'
  ));

alter table if exists public.legal_review_items drop constraint if exists legal_review_external_review_check;
alter table if exists public.legal_review_items add constraint legal_review_external_review_check
  check (required_external_review in (
    'legal_counsel','privacy_lawyer','iso_consultant','penetration_tester','cloud_security_reviewer',
    'accounting_payment_reviewer','camera_compliance_expert','external_auditor','regulator','none'
  ));

create table if not exists public.legal_review_documents (
  id uuid primary key default gen_random_uuid(),
  document_key text not null unique,
  title text not null,
  document_category text not null,
  document_path text not null,
  status text not null default 'draft_for_legal_review',
  risk_level text not null default 'medium',
  external_reviewer_type text not null default 'legal_counsel',
  owner_role text not null default 'admin',
  missing_items jsonb not null default '[]'::jsonb,
  summary text,
  review_notes text,
  last_reviewed_at timestamptz,
  next_review_date date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint legal_review_documents_category_check check (document_category in (
    'architecture','data_flow','camera','parent_viewing','ai','skeleton_motion','dpia',
    'privacy_notice','terms','dpa','subprocessor','consent_notice','database_registration',
    'retention_deletion','incident_response','website_copy','commercial_terms','payment','master_pack'
  )),
  constraint legal_review_documents_status_check check (status in (
    'draft_for_legal_review','ready_for_external_review','under_review','needs_changes',
    'approved','approved_with_conditions','blocked','missing'
  )),
  constraint legal_review_documents_risk_check check (risk_level in ('critical','high','medium','low')),
  constraint legal_review_documents_reviewer_check check (external_reviewer_type in (
    'legal_counsel','privacy_lawyer','iso_consultant','camera_compliance_expert',
    'external_auditor','accounting_payment_reviewer','regulator'
  ))
);

create table if not exists public.subprocessor_register (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null unique,
  provider_name text not null,
  service_purpose text not null,
  data_processed jsonb not null default '[]'::jsonb,
  country text not null default 'review_required',
  privacy_review_status text not null default 'needs_review',
  dpa_status text not null default 'not_started',
  security_review_status text not null default 'needs_review',
  risk_rating text not null default 'medium',
  contract_status text not null default 'not_started',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subprocessor_review_status_check check (privacy_review_status in ('not_started','needs_review','under_review','approved','approved_with_conditions','rejected')),
  constraint subprocessor_dpa_status_check check (dpa_status in ('not_started','requested','under_review','signed','not_required','blocked')),
  constraint subprocessor_security_status_check check (security_review_status in ('not_started','needs_review','under_review','approved','approved_with_conditions','rejected')),
  constraint subprocessor_risk_rating_check check (risk_rating in ('critical','high','medium','low')),
  constraint subprocessor_contract_status_check check (contract_status in ('not_started','under_review','signed','expired','blocked'))
);

create table if not exists public.legal_public_copy_review_items (
  id uuid primary key default gen_random_uuid(),
  item_key text not null unique,
  page_path text not null,
  risky_claim text not null,
  safer_wording text not null,
  risk_level text not null default 'medium',
  status text not null default 'needs_review',
  owner_role text not null default 'marketing',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint legal_copy_review_risk_check check (risk_level in ('critical','high','medium','low')),
  constraint legal_copy_review_status_check check (status in ('needs_review','approved_wording','needs_changes','blocked','resolved'))
);

create table if not exists public.external_reviewer_access_modes (
  id uuid primary key default gen_random_uuid(),
  mode_key text not null unique,
  reviewer_type text not null,
  status text not null default 'planned',
  allowed_resources jsonb not null default '[]'::jsonb,
  blocked_resources jsonb not null default '[]'::jsonb,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_reviewer_type_check check (reviewer_type in ('privacy_lawyer','regulatory_lawyer','iso_consultant','camera_compliance_expert','external_auditor')),
  constraint external_reviewer_access_status_check check (status in ('planned','ready','under_review','disabled'))
);

create table if not exists public.legal_readiness_scores (
  id uuid primary key default gen_random_uuid(),
  snapshot_key text not null unique,
  legal_readiness_score integer not null default 0,
  privacy_review_readiness integer not null default 0,
  camera_review_readiness integer not null default 0,
  ai_governance_readiness integer not null default 0,
  data_processing_readiness integer not null default 0,
  documents_completed integer not null default 0,
  documents_missing integer not null default 0,
  open_legal_questions integer not null default 0,
  high_risk_unresolved integer not null default 0,
  external_review_status text not null default 'not_started',
  generated_from jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint legal_readiness_score_range_check check (
    legal_readiness_score between 0 and 100
    and privacy_review_readiness between 0 and 100
    and camera_review_readiness between 0 and 100
    and ai_governance_readiness between 0 and 100
    and data_processing_readiness between 0 and 100
  ),
  constraint legal_readiness_external_status_check check (external_review_status in ('not_started','ready_for_review','under_review','needs_changes','approved_with_conditions','approved','blocked'))
);

create index if not exists legal_review_documents_status_idx on public.legal_review_documents(document_category, status, risk_level);
create index if not exists subprocessor_register_status_idx on public.subprocessor_register(privacy_review_status, dpa_status, risk_rating);
create index if not exists legal_public_copy_status_idx on public.legal_public_copy_review_items(status, risk_level, page_path);
create index if not exists legal_readiness_scores_created_idx on public.legal_readiness_scores(created_at desc);

alter table public.legal_review_documents enable row level security;
alter table public.subprocessor_register enable row level security;
alter table public.legal_public_copy_review_items enable row level security;
alter table public.external_reviewer_access_modes enable row level security;
alter table public.legal_readiness_scores enable row level security;

drop policy if exists "legal review documents admin only" on public.legal_review_documents;
create policy "legal review documents admin only" on public.legal_review_documents for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "subprocessor register admin only" on public.subprocessor_register;
create policy "subprocessor register admin only" on public.subprocessor_register for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "legal public copy review admin only" on public.legal_public_copy_review_items;
create policy "legal public copy review admin only" on public.legal_public_copy_review_items for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "external reviewer access modes admin only" on public.external_reviewer_access_modes;
create policy "external reviewer access modes admin only" on public.external_reviewer_access_modes for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "legal readiness scores admin only" on public.legal_readiness_scores;
create policy "legal readiness scores admin only" on public.legal_readiness_scores for all using (public.is_admin()) with check (public.is_admin());

insert into public.legal_review_documents (document_key, title, document_category, document_path, status, risk_level, external_reviewer_type, summary, missing_items, next_review_date, metadata)
values
  ('gan-batuach-legal-architecture-pack', 'Gan Batuach Legal Architecture Pack', 'architecture', 'GAN_BATUACH_LEGAL_ARCHITECTURE_PACK.md', 'ready_for_external_review', 'high', 'privacy_lawyer', 'Roles, data categories, camera, AI, audit and retention architecture for external review.', '[]'::jsonb, current_date + 30, '{"phase":166}'::jsonb),
  ('data-flow-and-privacy-mapping', 'Data Flow and Privacy Mapping', 'data_flow', 'DATA_FLOW_AND_PRIVACY_MAPPING.md', 'ready_for_external_review', 'high', 'privacy_lawyer', 'Parent/API/Supabase/storage/payment/camera/observer/audit flows.', '[]'::jsonb, current_date + 30, '{"phase":166}'::jsonb),
  ('camera-compliance-external-review', 'Camera Compliance External Review Pack', 'camera', 'CAMERA_COMPLIANCE_EXTERNAL_REVIEW_PACK.md', 'ready_for_external_review', 'high', 'camera_compliance_expert', 'Parent viewing controls, no direct RTSP, tokens, checked-in rule and watermark readiness.', '[]'::jsonb, current_date + 30, '{"phase":166}'::jsonb),
  ('ai-legal-privacy-review', 'AI Legal and Privacy Review Pack', 'ai', 'AI_LEGAL_AND_PRIVACY_REVIEW_PACK.md', 'ready_for_external_review', 'high', 'privacy_lawyer', 'Capability matrix, no automatic decisions, human review and parent visibility boundaries.', '[]'::jsonb, current_date + 30, '{"phase":166}'::jsonb),
  ('skeleton-motion-legal-review', 'Skeleton Motion Analytics Legal Review Pack', 'skeleton_motion', 'SKELETON_MOTION_ANALYTICS_LEGAL_REVIEW_PACK.md', 'ready_for_external_review', 'high', 'privacy_lawyer', 'Anonymous motion analytics versus legal-review-only identity association.', '[]'::jsonb, current_date + 30, '{"phase":166}'::jsonb),
  ('dpia-external-review', 'DPIA External Review Pack', 'dpia', 'DPIA_EXTERNAL_REVIEW_PACK.md', 'ready_for_external_review', 'high', 'privacy_lawyer', 'DPIA scope, risks, mitigations, human review and minimization.', '[]'::jsonb, current_date + 30, '{"phase":166}'::jsonb),
  ('privacy-policy-drafts', 'Privacy Policy Drafts For Legal Review', 'privacy_notice', 'PRIVACY_POLICY_DRAFTS_FOR_LEGAL_REVIEW.md', 'ready_for_external_review', 'high', 'privacy_lawyer', 'Privacy policy, parent/staff/manager/inspector/camera/AI and rights notices for legal drafting.', '[]'::jsonb, current_date + 30, '{"phase":166}'::jsonb),
  ('terms-of-use-drafts', 'Terms Of Use Drafts For Legal Review', 'terms', 'TERMS_OF_USE_DRAFTS_FOR_LEGAL_REVIEW.md', 'ready_for_external_review', 'medium', 'legal_counsel', 'General, kindergarten, parent, staff, inspector and Digital Observer terms readiness.', '[]'::jsonb, current_date + 30, '{"phase":166}'::jsonb),
  ('dpa-readiness', 'Data Processing Agreement Readiness', 'dpa', 'DATA_PROCESSING_AGREEMENT_READINESS.md', 'ready_for_external_review', 'high', 'legal_counsel', 'Controller/processor roles, sub-processors, security and deletion/return clauses.', '[]'::jsonb, current_date + 30, '{"phase":166}'::jsonb),
  ('consent-notice-matrix', 'Consent and Notice Matrix', 'consent_notice', 'CONSENT_AND_NOTICE_MATRIX.md', 'ready_for_external_review', 'medium', 'legal_counsel', 'Parent/staff/camera/AI/marketing/WhatsApp/SMS notice readiness.', '[]'::jsonb, current_date + 45, '{"phase":166}'::jsonb),
  ('database-registration-controller-support', 'Database Registration and Controller Support Pack', 'database_registration', 'DATABASE_REGISTRATION_AND_CONTROLLER_SUPPORT_PACK.md', 'ready_for_external_review', 'high', 'privacy_lawyer', 'Database purpose, subjects, categories, access roles, retention and processors.', '[]'::jsonb, current_date + 45, '{"phase":166}'::jsonb),
  ('retention-deletion-legal-hold-review', 'Retention, Deletion and Legal Hold Review Pack', 'retention_deletion', 'RETENTION_DELETION_AND_LEGAL_HOLD_REVIEW_PACK.md', 'ready_for_external_review', 'high', 'privacy_lawyer', 'Deletion, anonymization, legal hold and retention rules for sensitive data.', '[]'::jsonb, current_date + 45, '{"phase":166}'::jsonb),
  ('incident-breach-review', 'Incident Response and Breach Notification Review Pack', 'incident_response', 'INCIDENT_RESPONSE_AND_BREACH_NOTIFICATION_REVIEW_PACK.md', 'ready_for_external_review', 'high', 'legal_counsel', 'Security/privacy/camera/medical incident escalation and notification readiness.', '[]'::jsonb, current_date + 45, '{"phase":166}'::jsonb),
  ('public-website-copy-review', 'Public Website Legal Copy Review', 'website_copy', 'PUBLIC_WEBSITE_LEGAL_COPY_REVIEW.md', 'ready_for_external_review', 'medium', 'legal_counsel', 'Risky claims and safer wording for marketing and parent-facing copy.', '[]'::jsonb, current_date + 45, '{"phase":166}'::jsonb),
  ('kindergarten-commercial-terms-review', 'Kindergarten Commercial Terms Review Pack', 'commercial_terms', 'KINDERGARTEN_COMMERCIAL_TERMS_REVIEW_PACK.md', 'ready_for_external_review', 'medium', 'legal_counsel', 'Subscription, renewal, suspension, refund, service and camera responsibility review.', '[]'::jsonb, current_date + 45, '{"phase":166}'::jsonb),
  ('parent-kindergarten-payment-review', 'Parent-to-Kindergarten Payment Legal Review Pack', 'payment', 'PARENT_TO_KINDERGARTEN_PAYMENT_LEGAL_REVIEW_PACK.md', 'ready_for_external_review', 'high', 'accounting_payment_reviewer', 'Tuition routing separation and invoice/receipt responsibility review.', '[]'::jsonb, current_date + 45, '{"phase":166}'::jsonb),
  ('external-legal-master-pack', 'External Legal Privacy and Regulatory Review Pack', 'master_pack', 'EXTERNAL_LEGAL_PRIVACY_AND_REGULATORY_REVIEW_PACK.md', 'ready_for_external_review', 'high', 'external_auditor', 'Master index and reviewer checklist for external professionals.', '[]'::jsonb, current_date + 30, '{"phase":166}'::jsonb)
on conflict (document_key) do update set
  title = excluded.title,
  document_category = excluded.document_category,
  document_path = excluded.document_path,
  status = excluded.status,
  risk_level = excluded.risk_level,
  external_reviewer_type = excluded.external_reviewer_type,
  summary = excluded.summary,
  missing_items = excluded.missing_items,
  next_review_date = excluded.next_review_date,
  metadata = public.legal_review_documents.metadata || excluded.metadata,
  updated_at = now();

insert into public.subprocessor_register (provider_key, provider_name, service_purpose, data_processed, country, privacy_review_status, dpa_status, security_review_status, risk_rating, contract_status, notes, metadata)
values
  ('supabase', 'Supabase', 'Database, auth, realtime and storage infrastructure.', '["profiles","children","parents","staff","documents","audit_metadata"]'::jsonb, 'review_required', 'needs_review', 'requested', 'needs_review', 'high', 'under_review', 'Review DPA, hosting region, storage controls and backups.', '{"phase":166}'::jsonb),
  ('vercel', 'Vercel', 'Hosting, edge functions and deployment runtime.', '["api_metadata","logs","environment_configuration"]'::jsonb, 'review_required', 'requested', 'needs_review', 'needs_review', 'medium', 'under_review', 'Review deployment security and data processing terms.', '{"phase":166}'::jsonb),
  ('github', 'GitHub', 'Version control and CI/CD security gates.', '["source_code","workflow_logs","issue_metadata"]'::jsonb, 'review_required', 'needs_review', 'not_started', 'needs_review', 'medium', 'not_started', 'No child production data should be stored in GitHub.', '{"phase":166}'::jsonb),
  ('email-provider', 'Email provider', 'Transactional email delivery.', '["email","message_metadata","delivery_logs"]'::jsonb, 'review_required', 'needs_review', 'not_started', 'needs_review', 'medium', 'not_started', 'Provider depends on production configuration.', '{"phase":166}'::jsonb),
  ('sms-whatsapp-provider', 'SMS / WhatsApp provider', 'Invites, MFA readiness, alerts and operational notices.', '["phone","message_metadata","delivery_logs"]'::jsonb, 'review_required', 'needs_review', 'not_started', 'needs_review', 'high', 'not_started', 'Template, opt-in and data processing review required.', '{"phase":166}'::jsonb),
  ('push-provider', 'Push provider', 'Mobile push delivery.', '["device_tokens","notification_metadata"]'::jsonb, 'review_required', 'needs_review', 'not_started', 'needs_review', 'medium', 'not_started', 'FCM/APNs terms and token lifecycle review required.', '{"phase":166}'::jsonb),
  ('payment-provider', 'Payment provider', 'Kindergarten subscriptions and parent-to-kindergarten payment routing.', '["transaction_reference","invoice_metadata","tokenized_payment_method"]'::jsonb, 'review_required', 'needs_review', 'not_started', 'needs_review', 'high', 'not_started', 'No raw card storage. Revenue separation must be reviewed.', '{"phase":166}'::jsonb),
  ('invoice-provider', 'Invoice provider', 'Invoice/receipt generation and archive.', '["billing_identity","invoice_metadata","pdf_archive"]'::jsonb, 'review_required', 'needs_review', 'not_started', 'needs_review', 'medium', 'not_started', 'Tax/accounting responsibilities require review.', '{"phase":166}'::jsonb),
  ('camera-gateway-provider', 'Camera gateway provider', 'Secure stream relay, playback and gateway diagnostics.', '["camera_metadata","stream_session_metadata","ip_metadata"]'::jsonb, 'review_required', 'needs_review', 'not_started', 'needs_review', 'high', 'not_started', 'No RTSP in browser; gateway terms and security review required.', '{"phase":166}'::jsonb),
  ('ai-provider', 'AI provider', 'Future pose/skeleton and assistant processing where approved.', '["skeleton_metadata","review_metadata","deidentified_signals"]'::jsonb, 'review_required', 'needs_review', 'not_started', 'needs_review', 'high', 'not_started', 'No raw child identity or video export without legal/DPIA approval.', '{"phase":166}'::jsonb)
on conflict (provider_key) do update set
  provider_name = excluded.provider_name,
  service_purpose = excluded.service_purpose,
  data_processed = excluded.data_processed,
  country = excluded.country,
  privacy_review_status = excluded.privacy_review_status,
  dpa_status = excluded.dpa_status,
  security_review_status = excluded.security_review_status,
  risk_rating = excluded.risk_rating,
  contract_status = excluded.contract_status,
  notes = excluded.notes,
  metadata = public.subprocessor_register.metadata || excluded.metadata,
  updated_at = now();

insert into public.legal_public_copy_review_items (item_key, page_path, risky_claim, safer_wording, risk_level, status, notes, metadata)
values
  ('copy-ai-prevents-violence', '/', 'AI prevents violence', 'AI supports safety monitoring and helps identify situations requiring human attention.', 'high', 'approved_wording', 'Avoid prevention guarantee.', '{"phase":166}'::jsonb),
  ('copy-ai-identifies-children', '/', 'AI identifies children', 'The observer uses privacy-preserving motion signals where legally allowed.', 'critical', 'approved_wording', 'No child identity inference claim for Gan Batuach.', '{"phase":166}'::jsonb),
  ('copy-ai-detects-abuse', '/parents', 'AI detects abuse', 'The system can assist reviewed safety workflows and surface signals for human review.', 'high', 'approved_wording', 'No certainty or accusation claim.', '{"phase":166}'::jsonb),
  ('copy-iso-certified', '/', 'ISO certified', 'ISO readiness and evidence preparation.', 'critical', 'approved_wording', 'Do not claim certification before external certification.', '{"phase":166}'::jsonb),
  ('copy-fully-legal-compliant', '/', 'Fully legally compliant', 'Built with privacy, safety and regulatory readiness controls for external review.', 'critical', 'approved_wording', 'Legal approval must come from external counsel.', '{"phase":166}'::jsonb),
  ('copy-unrestricted-camera-access', '/parents', 'Parents can always watch cameras', 'Camera viewing, where enabled and legally permitted, is controlled by permissions, viewing hours and child presence rules.', 'high', 'approved_wording', 'No unrestricted viewing promise.', '{"phase":166}'::jsonb)
on conflict (item_key) do update set
  page_path = excluded.page_path,
  risky_claim = excluded.risky_claim,
  safer_wording = excluded.safer_wording,
  risk_level = excluded.risk_level,
  status = excluded.status,
  notes = excluded.notes,
  metadata = public.legal_public_copy_review_items.metadata || excluded.metadata,
  updated_at = now();

insert into public.external_reviewer_access_modes (mode_key, reviewer_type, status, allowed_resources, blocked_resources, notes, metadata)
values
  ('privacy-lawyer-review-mode', 'privacy_lawyer', 'planned', '["legal_review_documents","capability_matrix","privacy_evidence","dpia_metadata","retention_policies"]'::jsonb, '["child_data","medical_data","camera_streams","raw_ai_events","payment_details","secrets"]'::jsonb, 'Future limited access mode for privacy lawyer review.', '{"phase":166}'::jsonb),
  ('camera-compliance-review-mode', 'camera_compliance_expert', 'planned', '["camera_policy","viewing_rules","session_logs_metadata","watermark_readiness","gateway_architecture"]'::jsonb, '["live_camera_streams","camera_credentials","rtsp_urls","child_data","secrets"]'::jsonb, 'Future limited access mode for camera compliance expert.', '{"phase":166}'::jsonb),
  ('iso-consultant-review-mode', 'iso_consultant', 'planned', '["iso_evidence_metadata","policies","procedures","risk_register","audit_binder_metadata"]'::jsonb, '["secrets","raw_child_data","medical_records","payment_details","live_streams"]'::jsonb, 'Future ISO auditor/consultant evidence access.', '{"phase":166}'::jsonb)
on conflict (mode_key) do update set
  reviewer_type = excluded.reviewer_type,
  status = excluded.status,
  allowed_resources = excluded.allowed_resources,
  blocked_resources = excluded.blocked_resources,
  notes = excluded.notes,
  metadata = public.external_reviewer_access_modes.metadata || excluded.metadata,
  updated_at = now();

insert into public.legal_review_items (item_key, item_title, risk_level, affected_module, legal_question, current_status, owner_role, required_external_review, external_reviewer, target_review_date, next_review_date, review_pack_key, attached_documents, metadata)
values
  ('phase166-parent-live-viewing-review', 'Parent live camera viewing external review', 'high', 'camera', 'Which viewing hours, notices, anti-leak controls and consent/notice model are required for parent live viewing?', 'open', 'admin', 'camera_compliance_expert', 'External camera compliance expert', current_date + 30, current_date + 180, 'camera-compliance-external-review', '["CAMERA_COMPLIANCE_EXTERNAL_REVIEW_PACK.md"]'::jsonb, '{"phase":166}'::jsonb),
  ('phase166-web-anti-capture-limitations', 'Web anti-capture limitation review', 'high', 'camera', 'How should Gan Batuach disclose web screenshot limitations while using watermark and audit controls?', 'open', 'admin', 'privacy_lawyer', 'External privacy lawyer', current_date + 30, current_date + 180, 'camera-compliance-external-review', '["CAMERA_COMPLIANCE_EXTERNAL_REVIEW_PACK.md"]'::jsonb, '{"phase":166}'::jsonb),
  ('phase166-dpia-production-observer', 'DPIA approval before production observer mode', 'high', 'ai_governance', 'What DPIA conditions are required before observer shadow mode can move toward production?', 'open', 'admin', 'privacy_lawyer', 'External privacy lawyer', current_date + 30, current_date + 180, 'dpia-external-review', '["DPIA_EXTERNAL_REVIEW_PACK.md","AI_LEGAL_AND_PRIVACY_REVIEW_PACK.md"]'::jsonb, '{"phase":166}'::jsonb),
  ('phase166-controller-processor-roles', 'Controller and processor role review', 'high', 'privacy', 'Confirm Gan Batuach/kindergarten controller and processor roles across app, payments, camera and observer flows.', 'open', 'admin', 'legal_counsel', 'External legal counsel', current_date + 30, current_date + 180, 'dpa-readiness', '["DATA_PROCESSING_AGREEMENT_READINESS.md"]'::jsonb, '{"phase":166}'::jsonb),
  ('phase166-database-registration-readiness', 'Database registration / controller filing readiness', 'medium', 'privacy', 'Which database registration or notification materials are required before launch?', 'open', 'admin', 'privacy_lawyer', 'External privacy lawyer', current_date + 45, current_date + 180, 'database-registration-controller-support', '["DATABASE_REGISTRATION_AND_CONTROLLER_SUPPORT_PACK.md"]'::jsonb, '{"phase":166}'::jsonb)
on conflict (item_key) do update set
  item_title = excluded.item_title,
  risk_level = excluded.risk_level,
  affected_module = excluded.affected_module,
  legal_question = excluded.legal_question,
  current_status = excluded.current_status,
  owner_role = excluded.owner_role,
  required_external_review = excluded.required_external_review,
  external_reviewer = excluded.external_reviewer,
  target_review_date = excluded.target_review_date,
  next_review_date = excluded.next_review_date,
  review_pack_key = excluded.review_pack_key,
  attached_documents = excluded.attached_documents,
  metadata = public.legal_review_items.metadata || excluded.metadata,
  updated_at = now();

insert into public.legal_readiness_scores (
  snapshot_key,
  legal_readiness_score,
  privacy_review_readiness,
  camera_review_readiness,
  ai_governance_readiness,
  data_processing_readiness,
  documents_completed,
  documents_missing,
  open_legal_questions,
  high_risk_unresolved,
  external_review_status,
  generated_from,
  metadata
)
values (
  'phase166-external-review-pack-baseline',
  76,
  78,
  74,
  80,
  72,
  17,
  0,
  11,
  8,
  'ready_for_review',
  '{"source":"seeded_external_review_pack","phase":166}'::jsonb,
  '{"not_legal_approval":true,"external_professional_required":true}'::jsonb
)
on conflict (snapshot_key) do update set
  legal_readiness_score = excluded.legal_readiness_score,
  privacy_review_readiness = excluded.privacy_review_readiness,
  camera_review_readiness = excluded.camera_review_readiness,
  ai_governance_readiness = excluded.ai_governance_readiness,
  data_processing_readiness = excluded.data_processing_readiness,
  documents_completed = excluded.documents_completed,
  documents_missing = excluded.documents_missing,
  open_legal_questions = excluded.open_legal_questions,
  high_risk_unresolved = excluded.high_risk_unresolved,
  external_review_status = excluded.external_review_status,
  generated_from = excluded.generated_from,
  metadata = excluded.metadata;

comment on table public.legal_review_documents is 'External legal, privacy, camera, DPIA, DPA and regulatory review package document register. Readiness only.';
comment on table public.subprocessor_register is 'Subprocessor register for external privacy and DPA review.';
comment on table public.legal_public_copy_review_items is 'Public and parent-facing wording risk review. Avoid certification, prevention, unrestricted camera or AI certainty claims.';
comment on table public.external_reviewer_access_modes is 'Future limited access modes for external reviewers. No child, medical, raw AI, live camera, payment detail or secret access.';
comment on table public.legal_readiness_scores is 'Internal external-review readiness score. Not legal approval.';

notify pgrst, 'reload schema';
