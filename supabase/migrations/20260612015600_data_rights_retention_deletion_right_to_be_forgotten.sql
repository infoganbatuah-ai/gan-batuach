-- PHASE 156: Data Rights, Retention, Deletion & Right-To-Be-Forgotten Platform

alter table if exists public.privacy_rights_requests
  drop constraint if exists privacy_rights_request_type_check;

alter table if exists public.privacy_rights_requests
  add constraint privacy_rights_request_type_check
  check (request_type in ('access','correction','deletion','export','restriction','objection','anonymization'));

alter table if exists public.privacy_rights_requests
  drop constraint if exists privacy_rights_status_check;

alter table if exists public.privacy_rights_requests
  add constraint privacy_rights_status_check
  check (status in (
    'received','validating','in_progress','waiting_approval','completed','rejected','cancelled',
    'submitted','under_review','approved','processing','blocked_by_legal_hold'
  ));

alter table if exists public.privacy_rights_requests
  add column if not exists requested_by uuid references public.profiles(id) on delete set null,
  add column if not exists subject_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists subject_type text,
  add column if not exists child_id uuid references public.children(id) on delete set null,
  add column if not exists request_reason text,
  add column if not exists reviewer_id uuid references public.profiles(id) on delete set null,
  add column if not exists decision_reason text,
  add column if not exists scope_calculated_at timestamptz,
  add column if not exists legal_hold_checked_at timestamptz,
  add column if not exists execution_started_at timestamptz,
  add column if not exists execution_status text not null default 'not_started',
  add column if not exists anonymized_subject_id text,
  add column if not exists export_package_path text,
  add column if not exists retention_conflicts jsonb not null default '[]'::jsonb,
  add column if not exists legal_hold_conflicts jsonb not null default '[]'::jsonb,
  add column if not exists notification_status text not null default 'pending';

update public.privacy_rights_requests
set
  requested_by = coalesce(requested_by, requester_profile_id),
  subject_type = coalesce(subject_type, data_subject_type),
  subject_user_id = coalesce(subject_user_id, case when data_subject_type in ('parent','staff','manager','inspector') then data_subject_id else null end),
  child_id = coalesce(child_id, case when data_subject_type = 'child' then data_subject_id else null end)
where requested_by is null or subject_type is null or subject_user_id is null or child_id is null;

alter table if exists public.privacy_rights_requests
  drop constraint if exists privacy_request_execution_status_check;

alter table if exists public.privacy_rights_requests
  add constraint privacy_request_execution_status_check
  check (execution_status in ('not_started','scoped','blocked','ready','processing','completed','failed','manual_review'));

alter table if exists public.privacy_rights_requests
  drop constraint if exists privacy_request_notification_status_check;

alter table if exists public.privacy_rights_requests
  add constraint privacy_request_notification_status_check
  check (notification_status in ('pending','queued','sent','failed','not_required'));

create table if not exists public.legal_holds (
  id uuid primary key default gen_random_uuid(),
  hold_key text not null unique,
  hold_reason text not null,
  hold_type text not null,
  status text not null default 'active',
  garden_id uuid references public.gardens(id) on delete set null,
  child_id uuid references public.children(id) on delete set null,
  subject_user_id uuid references public.profiles(id) on delete set null,
  incident_case_id uuid,
  inspection_id uuid,
  complaint_id uuid,
  payment_reference_id uuid,
  created_by uuid references public.profiles(id) on delete set null,
  start_date timestamptz not null default now(),
  end_date timestamptz,
  release_requested_by uuid references public.profiles(id) on delete set null,
  release_approved_by uuid references public.profiles(id) on delete set null,
  released_at timestamptz,
  release_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint legal_hold_type_check check (hold_type in ('incident_investigation','inspection_evidence','safety_complaint','payment_dispute','legal_dispute','regulatory_review','audit_preservation')),
  constraint legal_hold_status_check check (status in ('active','pending_release','released','expired','cancelled'))
);

create table if not exists public.data_retention_policies (
  id uuid primary key default gen_random_uuid(),
  policy_key text not null unique,
  data_category text not null,
  title text not null,
  retention_period_days integer,
  review_period_days integer not null default 90,
  deletion_method text not null default 'manual_review',
  anonymization_method text not null default 'redact_direct_identifiers',
  legal_basis text not null,
  owner_role text not null default 'admin',
  legal_hold_required boolean not null default true,
  evidence_preservation_required boolean not null default false,
  automatic_execution_allowed boolean not null default false,
  parent_visible_allowed boolean not null default false,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint data_retention_category_check check (data_category in (
    'medical_data','child_records','attendance_records','pickup_signatures','inspection_reports',
    'incident_evidence','complaints','documents','invoices','payment_records','audit_logs',
    'ai_telemetry','skeleton_telemetry','camera_access_logs','communications','ephemeral_context',
    'private_documents','camera_clips','observer_evidence'
  )),
  constraint data_retention_deletion_method_check check (deletion_method in ('delete','anonymize','redact','manual_review','retain_legal')),
  constraint data_retention_status_check check (status in ('draft','active','needs_legal_review','retired')),
  constraint data_retention_days_check check (retention_period_days is null or retention_period_days >= 0)
);

create table if not exists public.privacy_request_scope_items (
  id uuid primary key default gen_random_uuid(),
  privacy_request_id uuid references public.privacy_rights_requests(id) on delete cascade,
  data_category text not null,
  table_name text not null,
  estimated_record_count integer not null default 0,
  action_recommendation text not null default 'review',
  blocked_by_legal_hold boolean not null default false,
  blocked_by_retention boolean not null default false,
  parent_export_allowed boolean not null default false,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint privacy_scope_action_check check (action_recommendation in ('export','correct','delete','anonymize','retain','review','exclude'))
);

create table if not exists public.privacy_execution_actions (
  id uuid primary key default gen_random_uuid(),
  privacy_request_id uuid references public.privacy_rights_requests(id) on delete cascade,
  action_type text not null,
  target_table text not null,
  target_id uuid,
  status text not null default 'pending_review',
  executed_by uuid references public.profiles(id) on delete set null,
  executed_at timestamptz,
  rollback_reference text,
  audit_event_id uuid,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint privacy_execution_action_check check (action_type in ('export','correct','delete','anonymize','redact','revoke_access','revoke_token','preserve_audit','notify_user')),
  constraint privacy_execution_status_check check (status in ('pending_review','approved','processing','completed','blocked','failed','cancelled'))
);

create table if not exists public.retention_review_queue (
  id uuid primary key default gen_random_uuid(),
  queue_key text not null unique,
  policy_key text references public.data_retention_policies(policy_key) on delete set null,
  data_category text not null,
  target_table text not null,
  target_id uuid,
  garden_id uuid references public.gardens(id) on delete set null,
  child_id uuid references public.children(id) on delete set null,
  subject_user_id uuid references public.profiles(id) on delete set null,
  review_status text not null default 'pending_review',
  due_at timestamptz,
  legal_hold_conflict boolean not null default false,
  recommended_action text not null default 'review',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint retention_review_status_check check (review_status in ('pending_review','approved','blocked','completed','dismissed')),
  constraint retention_review_action_check check (recommended_action in ('delete','anonymize','retain','legal_review','manual_review'))
);

create index if not exists privacy_requests_status_idx on public.privacy_rights_requests(status, request_type, created_at desc);
create index if not exists privacy_requests_subject_idx on public.privacy_rights_requests(subject_user_id, child_id, status);
create index if not exists legal_holds_subject_idx on public.legal_holds(status, subject_user_id, child_id, garden_id);
create index if not exists data_retention_policies_category_idx on public.data_retention_policies(data_category, status);
create index if not exists privacy_scope_request_idx on public.privacy_request_scope_items(privacy_request_id, data_category);
create index if not exists privacy_execution_request_idx on public.privacy_execution_actions(privacy_request_id, status);
create index if not exists retention_review_status_idx on public.retention_review_queue(review_status, due_at);

alter table public.legal_holds enable row level security;
alter table public.data_retention_policies enable row level security;
alter table public.privacy_request_scope_items enable row level security;
alter table public.privacy_execution_actions enable row level security;
alter table public.retention_review_queue enable row level security;

drop policy if exists "privacy rights requester read" on public.privacy_rights_requests;
create policy "privacy rights requester read" on public.privacy_rights_requests
  for select using (requester_profile_id = auth.uid() or requested_by = auth.uid() or subject_user_id = auth.uid() or public.is_admin());

drop policy if exists "privacy rights requester insert" on public.privacy_rights_requests;
create policy "privacy rights requester insert" on public.privacy_rights_requests
  for insert with check (requester_profile_id = auth.uid() or requested_by = auth.uid() or public.is_admin());

drop policy if exists "privacy rights admin update" on public.privacy_rights_requests;
create policy "privacy rights admin update" on public.privacy_rights_requests
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "legal holds admin only" on public.legal_holds;
create policy "legal holds admin only" on public.legal_holds for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "retention policies admin read" on public.data_retention_policies;
create policy "retention policies admin read" on public.data_retention_policies for select using (public.is_admin());

drop policy if exists "retention policies admin write" on public.data_retention_policies;
create policy "retention policies admin write" on public.data_retention_policies for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "privacy scope admin only" on public.privacy_request_scope_items;
create policy "privacy scope admin only" on public.privacy_request_scope_items for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "privacy execution admin only" on public.privacy_execution_actions;
create policy "privacy execution admin only" on public.privacy_execution_actions for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "retention review admin only" on public.retention_review_queue;
create policy "retention review admin only" on public.retention_review_queue for all using (public.is_admin()) with check (public.is_admin());

create or replace view public.privacy_requests as
select
  id,
  request_key,
  requester_profile_id,
  requested_by,
  subject_user_id,
  coalesce(subject_type, data_subject_type) as subject_type,
  garden_id,
  child_id,
  request_type,
  status,
  request_reason,
  reviewer_id,
  decision_reason,
  completed_at,
  due_at,
  response_summary,
  scope_calculated_at,
  legal_hold_checked_at,
  execution_status,
  anonymized_subject_id,
  export_package_path,
  retention_conflicts,
  legal_hold_conflicts,
  notification_status,
  metadata,
  created_at,
  updated_at
from public.privacy_rights_requests;

insert into public.data_retention_policies (policy_key, data_category, title, retention_period_days, review_period_days, deletion_method, anonymization_method, legal_basis, owner_role, legal_hold_required, evidence_preservation_required, automatic_execution_allowed, parent_visible_allowed, status, metadata)
values
  ('medical-data-retention', 'medical_data', 'Medical data retention', 2555, 180, 'manual_review', 'delete_or_encrypt_redact_after_review', 'Child health and operational safety obligations', 'admin', true, false, false, false, 'needs_legal_review', '{"requires_medical_review":true}'::jsonb),
  ('child-records-retention', 'child_records', 'Child records retention', 2555, 180, 'anonymize', 'redact_direct_identifiers', 'Operational and safety record retention', 'admin', true, false, false, true, 'needs_legal_review', '{}'::jsonb),
  ('attendance-retention', 'attendance_records', 'Attendance record retention', 2555, 180, 'anonymize', 'redact_adult_child_identifiers_when_allowed', 'Attendance and pickup audit obligations', 'admin', true, true, false, true, 'needs_legal_review', '{}'::jsonb),
  ('pickup-signature-retention', 'pickup_signatures', 'Pickup and check-in signatures', 2555, 180, 'manual_review', 'redact_signature_metadata_after_legal_review', 'Identity and pickup evidence preservation', 'admin', true, true, false, false, 'needs_legal_review', '{}'::jsonb),
  ('inspection-report-retention', 'inspection_reports', 'Inspection reports', 3650, 365, 'retain_legal', 'redact_personal_identifiers_where_allowed', 'Regulatory inspection evidence', 'admin', true, true, false, false, 'active', '{}'::jsonb),
  ('incident-evidence-retention', 'incident_evidence', 'Incident evidence', 3650, 365, 'retain_legal', 'redact_subject_identifiers_after_case_closure', 'Safety investigation and evidence preservation', 'admin', true, true, false, false, 'active', '{}'::jsonb),
  ('complaints-retention', 'complaints', 'Complaints retention', 2555, 180, 'manual_review', 'redact_complainant_identity_where_allowed', 'Complaint lifecycle and regulatory evidence', 'admin', true, true, false, true, 'needs_legal_review', '{}'::jsonb),
  ('private-documents-retention', 'private_documents', 'Private documents', 2555, 180, 'manual_review', 'delete_private_file_if_no_hold', 'Document and compliance retention', 'admin', true, true, false, false, 'needs_legal_review', '{}'::jsonb),
  ('payment-records-retention', 'payment_records', 'Payment and invoice records', 2555, 365, 'retain_legal', 'anonymize_user_reference_if_allowed', 'Accounting and tax obligations', 'admin', true, false, false, false, 'active', '{}'::jsonb),
  ('audit-log-retention', 'audit_logs', 'Immutable audit logs', null, 365, 'retain_legal', 'remove_direct_identifier_if_legally_required', 'Security and compliance audit integrity', 'admin', true, true, false, false, 'active', '{"normally_not_deleted_by_subject_request":true}'::jsonb),
  ('ai-telemetry-retention', 'ai_telemetry', 'AI telemetry without direct PII', 90, 30, 'anonymize', 'uuid_only_no_direct_pii', 'Safety analytics and model governance', 'admin', true, false, false, false, 'active', '{"direct_pii_forbidden":true}'::jsonb),
  ('skeleton-telemetry-retention', 'skeleton_telemetry', 'Skeleton telemetry short retention', 14, 30, 'anonymize', 'drop_raw_keypoints_keep_reviewed_summary', 'Privacy-preserving observer operation', 'admin', true, false, false, false, 'active', '{"cross_day_identity_forbidden":true}'::jsonb),
  ('ephemeral-context-retention', 'ephemeral_context', 'Daily ephemeral observer context', 1, 1, 'delete', 'daily_expiration', 'Temporary same-day operational context only', 'admin', true, false, false, false, 'active', '{"expires_daily":true}'::jsonb),
  ('camera-access-log-retention', 'camera_access_logs', 'Camera access logs', 2555, 180, 'retain_legal', 'redact_viewer_identifier_if_required', 'Camera access accountability', 'admin', true, true, false, false, 'active', '{}'::jsonb),
  ('communications-retention', 'communications', 'Communication logs and messages', 1095, 180, 'manual_review', 'redact_sensitive_content_where_allowed', 'Operational communication and support history', 'admin', true, false, false, true, 'needs_legal_review', '{}'::jsonb)
on conflict (policy_key) do update set
  retention_period_days = excluded.retention_period_days,
  review_period_days = excluded.review_period_days,
  deletion_method = excluded.deletion_method,
  anonymization_method = excluded.anonymization_method,
  legal_basis = excluded.legal_basis,
  owner_role = excluded.owner_role,
  legal_hold_required = excluded.legal_hold_required,
  evidence_preservation_required = excluded.evidence_preservation_required,
  automatic_execution_allowed = excluded.automatic_execution_allowed,
  parent_visible_allowed = excluded.parent_visible_allowed,
  status = excluded.status,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.security_readiness_checks (category, check_key, title, status, severity, evidence_summary, recommended_action, metadata)
values
  ('privacy', 'phase156-privacy-request-workflow', 'Privacy rights request workflow', 'partial', 'critical', 'privacy_rights_requests supports access, correction, export, deletion, restriction and anonymization with admin review.', 'Connect admin action buttons to approve, reject, scope and execute requests.', '{"phase":156}'::jsonb),
  ('privacy', 'phase156-retention-policy-registry', 'Data retention policy registry', 'partial', 'critical', 'data_retention_policies maps medical, child, attendance, signatures, documents, payments, audit logs, AI and camera logs.', 'Complete legal review and jurisdiction-specific retention periods before production.', '{"phase":156}'::jsonb),
  ('privacy', 'phase156-legal-hold-system', 'Legal hold system', 'partial', 'critical', 'legal_holds can block deletion for incidents, inspections, complaints, payment disputes and regulatory review.', 'Wire active incident and complaint creation to legal hold recommendations.', '{"phase":156}'::jsonb),
  ('privacy', 'phase156-safe-deletion-readiness', 'Safe deletion and anonymization readiness', 'partial', 'critical', 'privacy_execution_actions requires admin review before delete/anonymize/export actions.', 'Build verified execution jobs and signed export package storage.', '{"phase":156}'::jsonb)
on conflict (check_key) do update set
  status = excluded.status,
  severity = excluded.severity,
  evidence_summary = excluded.evidence_summary,
  recommended_action = excluded.recommended_action,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.audit_event_catalog (event_key, category, title, required, implemented, source_table, notes, data_classification, metadata)
values
  ('privacy-request-submitted', 'privacy', 'Privacy request submitted', true, true, 'privacy_rights_requests', 'User-facing privacy request portal writes request and immutable audit event.', 'regulated', '{"phase":156}'::jsonb),
  ('privacy-scope-calculated', 'privacy', 'Privacy request scope calculated', true, false, 'privacy_request_scope_items', 'Admin scope calculation must be audited before execution.', 'regulated', '{"phase":156}'::jsonb),
  ('legal-hold-checked', 'privacy', 'Legal hold checked', true, false, 'legal_holds', 'Deletion/anonymization must check legal holds.', 'regulated', '{"phase":156}'::jsonb),
  ('privacy-export-generated', 'privacy', 'Privacy export generated', true, false, 'privacy_execution_actions', 'Exports must exclude raw AI events and internal investigations.', 'regulated', '{"phase":156}'::jsonb),
  ('privacy-anonymization-executed', 'privacy', 'Privacy anonymization executed', true, false, 'privacy_execution_actions', 'Anonymization must preserve audit integrity and remove direct identifiers.', 'regulated', '{"phase":156}'::jsonb)
on conflict (event_key) do update set
  implemented = excluded.implemented,
  source_table = excluded.source_table,
  notes = excluded.notes,
  data_classification = excluded.data_classification,
  metadata = excluded.metadata;

insert into public.communication_templates (template_key, audience_role, title, body, whatsapp_template_name, approved_template_variables)
values
  ('privacy_request_received', 'all', 'בקשת פרטיות התקבלה', 'בקשת הפרטיות שלך התקבלה ותועבר לבדיקה.', 'privacy_request_received_he', '["userName","requestType"]'::jsonb),
  ('privacy_request_under_review', 'all', 'בקשת פרטיות בבדיקה', 'בקשת הפרטיות שלך נמצאת בבדיקה.', 'privacy_request_under_review_he', '["userName","requestType"]'::jsonb),
  ('privacy_request_approved', 'all', 'בקשת פרטיות אושרה', 'בקשת הפרטיות שלך אושרה ותעבור לביצוע מבוקר.', 'privacy_request_approved_he', '["userName","requestType"]'::jsonb),
  ('privacy_request_rejected', 'all', 'בקשת פרטיות נדחתה', 'בקשת הפרטיות נדחתה לאחר בדיקה. ניתן לפנות לתמיכה לקבלת הסבר.', 'privacy_request_rejected_he', '["userName","requestType"]'::jsonb),
  ('privacy_request_completed', 'all', 'בקשת פרטיות הושלמה', 'הטיפול בבקשת הפרטיות שלך הושלם.', 'privacy_request_completed_he', '["userName","requestType"]'::jsonb)
on conflict (template_key) do update set
  audience_role = excluded.audience_role,
  title = excluded.title,
  body = excluded.body,
  whatsapp_template_name = excluded.whatsapp_template_name,
  approved_template_variables = excluded.approved_template_variables,
  updated_at = now();

comment on table public.legal_holds is 'Legal holds block deletion/anonymization when evidence, investigation, payment, legal or regulatory obligations apply.';
comment on table public.data_retention_policies is 'Retention and anonymization policy registry for privacy-rights review and lifecycle governance.';
comment on table public.privacy_request_scope_items is 'Calculated subject-scope items for access, export, correction, deletion and anonymization requests.';
comment on table public.privacy_execution_actions is 'Admin-reviewed privacy execution actions. No automatic deletion without scope and legal-hold checks.';
comment on table public.retention_review_queue is 'Manual review queue for expired retention candidates and legal hold conflicts.';
