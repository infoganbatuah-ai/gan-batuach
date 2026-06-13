-- PHASE 153: Medical, Sensitive Data & Field-Level Encryption Platform
-- Transitional, idempotent schema additions for AES-256-GCM application-level encryption.

alter table if exists public.children
  add column if not exists identity_number_encrypted text,
  add column if not exists identity_number_hash text,
  add column if not exists mother_identity_number_encrypted text,
  add column if not exists mother_identity_number_hash text,
  add column if not exists father_identity_number_encrypted text,
  add column if not exists father_identity_number_hash text,
  add column if not exists sensitivities_encrypted text,
  add column if not exists pickup_authorized_encrypted text,
  add column if not exists encryption_version text;

alter table if exists public.permanent_child_files
  add column if not exists identity_number_encrypted text,
  add column if not exists identity_number_hash text,
  add column if not exists allergies_encrypted text,
  add column if not exists sensitivities_encrypted text,
  add column if not exists regular_medications_encrypted text,
  add column if not exists medical_notes_encrypted text,
  add column if not exists pickup_authorized_encrypted text,
  add column if not exists encryption_version text;

alter table if exists public.parents
  add column if not exists identity_number_encrypted text,
  add column if not exists identity_number_hash text,
  add column if not exists address_encrypted text,
  add column if not exists phone_hash text,
  add column if not exists encryption_version text;

alter table if exists public.staff
  add column if not exists identity_number_encrypted text,
  add column if not exists identity_number_hash text,
  add column if not exists address_encrypted text,
  add column if not exists emergency_contact_encrypted text,
  add column if not exists encryption_version text;

alter table if exists public.staff_permanent_files
  add column if not exists identity_number_encrypted text,
  add column if not exists identity_number_hash text,
  add column if not exists emergency_contact_encrypted text,
  add column if not exists encryption_version text;

alter table if exists public.profiles
  add column if not exists identity_number_encrypted text,
  add column if not exists identity_number_hash text,
  add column if not exists encryption_version text;

alter table if exists public.authorized_adults
  add column if not exists identity_number_encrypted text,
  add column if not exists identity_number_hash text,
  add column if not exists phone_hash text,
  add column if not exists encryption_version text;

alter table if exists public.authorized_pickup_contacts
  add column if not exists identity_number_encrypted text,
  add column if not exists identity_number_hash text,
  add column if not exists phone_hash text,
  add column if not exists encryption_version text;

alter table if exists public.child_health_records
  add column if not exists medications_encrypted text,
  add column if not exists emergency_contacts_encrypted text,
  add column if not exists medication_approval_url_encrypted text,
  add column if not exists encryption_version text;

alter table if exists public.medicine_given_logs
  add column if not exists encryption_version text;

alter table if exists public.attendance_digital_signatures
  add column if not exists signature_metadata_encrypted text,
  add column if not exists encryption_version text;

alter table if exists public.inspection_signatures
  add column if not exists signature_metadata_encrypted text,
  add column if not exists encryption_version text;

alter table if exists public.documents
  add column if not exists sensitive_metadata_encrypted text,
  add column if not exists access_classification text not null default 'internal',
  add column if not exists encryption_required boolean not null default false,
  add column if not exists encryption_version text;

alter table if exists public.incident_case_evidence
  add column if not exists sensitive_metadata_encrypted text,
  add column if not exists access_audit_required boolean not null default true,
  add column if not exists encryption_required boolean not null default false,
  add column if not exists encryption_version text;

create table if not exists public.medical_data_access_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  role text,
  child_id uuid references public.children(id) on delete set null,
  garden_id uuid references public.gardens(id) on delete set null,
  field_accessed text not null,
  action text not null,
  ip inet,
  user_agent text,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint medical_access_action_check check (action in ('decrypt','view','update','export','delete_request'))
);

create table if not exists public.sensitive_data_backfill_runs (
  id uuid primary key default gen_random_uuid(),
  run_key text not null unique,
  table_name text not null,
  status text not null default 'planned',
  plaintext_fields jsonb not null default '[]'::jsonb,
  encrypted_fields jsonb not null default '[]'::jsonb,
  rows_scanned integer not null default 0,
  rows_encrypted integer not null default 0,
  rows_failed integer not null default 0,
  verification_status text not null default 'not_started',
  started_at timestamptz,
  completed_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sensitive_backfill_status_check check (status in ('planned','running','completed','failed','paused')),
  constraint sensitive_backfill_verification_check check (verification_status in ('not_started','sampling','verified','failed'))
);

create index if not exists children_identity_hash_idx on public.children(identity_number_hash) where identity_number_hash is not null;
create index if not exists children_mother_identity_hash_idx on public.children(mother_identity_number_hash) where mother_identity_number_hash is not null;
create index if not exists children_father_identity_hash_idx on public.children(father_identity_number_hash) where father_identity_number_hash is not null;
create index if not exists permanent_child_files_identity_hash_idx on public.permanent_child_files(identity_number_hash) where identity_number_hash is not null;
create index if not exists parents_identity_hash_idx on public.parents(identity_number_hash) where identity_number_hash is not null;
create index if not exists staff_identity_hash_idx on public.staff(identity_number_hash) where identity_number_hash is not null;
create index if not exists profiles_identity_hash_idx on public.profiles(identity_number_hash) where identity_number_hash is not null;
create index if not exists medical_access_logs_child_idx on public.medical_data_access_logs(child_id, created_at desc);
create index if not exists medical_access_logs_garden_idx on public.medical_data_access_logs(garden_id, created_at desc);
create index if not exists medical_access_logs_user_idx on public.medical_data_access_logs(user_id, created_at desc);

alter table public.medical_data_access_logs enable row level security;
alter table public.sensitive_data_backfill_runs enable row level security;

drop policy if exists "medical access logs admin read" on public.medical_data_access_logs;
create policy "medical access logs admin read" on public.medical_data_access_logs
  for select using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','owner')));

drop policy if exists "medical access logs scoped insert" on public.medical_data_access_logs;
create policy "medical access logs scoped insert" on public.medical_data_access_logs
  for insert with check (auth.uid() = user_id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','owner')));

drop policy if exists "sensitive backfill admin read" on public.sensitive_data_backfill_runs;
create policy "sensitive backfill admin read" on public.sensitive_data_backfill_runs
  for select using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','owner')));

insert into public.security_data_classifications (
  classification_key,
  table_name,
  field_name,
  data_classification,
  data_domain,
  contains_child_data,
  contains_medical_data,
  encryption_required,
  audit_required,
  retention_policy_key,
  access_rule_summary,
  metadata
) values
  ('phase153-children-identity', 'children', 'identity_number', 'regulated', 'identity', true, false, true, true, 'child-record-retention', 'Server-side access only; exact lookup should use identity_number_hash.', '{"phase":153}'::jsonb),
  ('phase153-children-medical', 'children', 'medical_notes', 'medical', 'child_health', true, true, true, true, 'medical-record-retention', 'Server-side decryption only for authorized operational roles.', '{"phase":153}'::jsonb),
  ('phase153-child-health-records', 'child_health_records', 'medical_notes', 'medical', 'child_health', true, true, true, true, 'medical-record-retention', 'Every read/write should create medical_data_access_logs.', '{"phase":153}'::jsonb),
  ('phase153-medicine-given-logs', 'medicine_given_logs', 'medicine_name', 'medical', 'medication', true, true, true, true, 'medical-record-retention', 'Medication logs have encrypted mirror columns during transition.', '{"phase":153}'::jsonb),
  ('phase153-parent-identity', 'parents', 'identity_number', 'regulated', 'identity', false, false, true, true, 'parent-record-retention', 'Identity numbers are encrypted with hash-for-lookup.', '{"phase":153}'::jsonb),
  ('phase153-staff-identity', 'staff', 'identity_number', 'regulated', 'identity', false, false, true, true, 'staff-record-retention', 'Staff identity is encrypted with hash-for-lookup.', '{"phase":153}'::jsonb),
  ('phase153-signature-metadata', 'attendance_digital_signatures', 'signature_metadata_encrypted', 'regulated', 'digital_signature', true, false, true, true, 'signature-retention', 'Signature files remain private; metadata is encrypted and access must be audited.', '{"phase":153}'::jsonb),
  ('phase153-sensitive-documents', 'documents', 'sensitive_metadata_encrypted', 'confidential', 'documents', true, false, true, true, 'document-retention', 'Sensitive file metadata should not be exposed through public URLs.', '{"phase":153}'::jsonb)
on conflict (classification_key) do update set
  encryption_required = excluded.encryption_required,
  audit_required = excluded.audit_required,
  access_rule_summary = excluded.access_rule_summary,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.encrypted_field_registry (
  registry_key,
  table_name,
  plaintext_field,
  encrypted_field,
  data_classification,
  encryption_algorithm,
  encryption_status,
  key_reference,
  key_rotation_status,
  coverage_percent,
  notes,
  metadata
) values
  ('phase153-children-identity-number', 'children', 'identity_number', 'identity_number_encrypted', 'regulated', 'aes-256-gcm', 'partial', 'FIELD_ENCRYPTION_KEY_CURRENT', 'versioned', 45, 'New writes encrypt identity; existing rows need backfill verification.', '{"phase":153,"hash_field":"identity_number_hash"}'::jsonb),
  ('phase153-children-allergies', 'children', 'allergies', 'allergies_encrypted', 'medical', 'aes-256-gcm', 'partial', 'FIELD_ENCRYPTION_KEY_CURRENT', 'versioned', 50, 'New writes encrypt allergies; plaintext remains during transition.', '{"phase":153}'::jsonb),
  ('phase153-children-medical-notes', 'children', 'medical_notes', 'medical_notes_encrypted', 'medical', 'aes-256-gcm', 'partial', 'FIELD_ENCRYPTION_KEY_CURRENT', 'versioned', 50, 'New writes encrypt medical notes; plaintext remains during transition.', '{"phase":153}'::jsonb),
  ('phase153-child-health-medical-notes', 'child_health_records', 'medical_notes', 'medical_notes_encrypted', 'medical', 'aes-256-gcm', 'partial', 'FIELD_ENCRYPTION_KEY_CURRENT', 'versioned', 55, 'Direct health route now writes encrypted mirror fields.', '{"phase":153}'::jsonb),
  ('phase153-medicine-name', 'medicine_given_logs', 'medicine_name', 'medicine_name_encrypted', 'medical', 'aes-256-gcm', 'partial', 'FIELD_ENCRYPTION_KEY_CURRENT', 'versioned', 55, 'Direct medication route now writes encrypted mirror fields.', '{"phase":153}'::jsonb),
  ('phase153-parent-identity-number', 'parents', 'identity_number', 'identity_number_encrypted', 'regulated', 'aes-256-gcm', 'partial', 'FIELD_ENCRYPTION_KEY_CURRENT', 'versioned', 40, 'Parent creation and child registration now write encrypted identity mirrors.', '{"phase":153,"hash_field":"identity_number_hash"}'::jsonb),
  ('phase153-staff-identity-number', 'staff', 'identity_number', 'identity_number_encrypted', 'regulated', 'aes-256-gcm', 'partial', 'FIELD_ENCRYPTION_KEY_CURRENT', 'versioned', 40, 'Staff creation now writes encrypted identity mirrors.', '{"phase":153,"hash_field":"identity_number_hash"}'::jsonb),
  ('phase153-attendance-signature-metadata', 'attendance_digital_signatures', 'signature_image', 'signature_metadata_encrypted', 'regulated', 'aes-256-gcm', 'partial', 'FIELD_ENCRYPTION_KEY_CURRENT', 'versioned', 35, 'Fallback signatures and metadata use AES-GCM; private bucket validation remains required.', '{"phase":153}'::jsonb)
on conflict (registry_key) do update set
  encryption_algorithm = excluded.encryption_algorithm,
  encryption_status = excluded.encryption_status,
  key_reference = excluded.key_reference,
  key_rotation_status = excluded.key_rotation_status,
  coverage_percent = excluded.coverage_percent,
  notes = excluded.notes,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.sensitive_data_backfill_runs (
  run_key,
  table_name,
  status,
  plaintext_fields,
  encrypted_fields,
  notes,
  metadata
) values
  ('phase153-children-medical-backfill', 'children', 'planned', '["identity_number","mother_identity_number","father_identity_number","allergies","sensitivities","regular_medications","medical_notes","pickup_authorized"]'::jsonb, '["identity_number_encrypted","mother_identity_number_encrypted","father_identity_number_encrypted","allergies_encrypted","sensitivities_encrypted","regular_medications_encrypted","medical_notes_encrypted","pickup_authorized_encrypted"]'::jsonb, 'Manual server-side backfill required before plaintext removal.', '{"phase":153}'::jsonb),
  ('phase153-health-records-backfill', 'child_health_records', 'planned', '["allergies","sensitivities","medications","medical_notes","emergency_contacts","medication_approval_url"]'::jsonb, '["allergies_encrypted","sensitivities_encrypted","medications_encrypted","medical_notes_encrypted","emergency_contacts_encrypted","medication_approval_url_encrypted"]'::jsonb, 'Manual server-side backfill required before plaintext removal.', '{"phase":153}'::jsonb),
  ('phase153-medicine-logs-backfill', 'medicine_given_logs', 'planned', '["medicine_name","dosage","notes"]'::jsonb, '["medicine_name_encrypted","dosage_encrypted","notes_encrypted"]'::jsonb, 'Manual server-side backfill required before plaintext removal.', '{"phase":153}'::jsonb)
on conflict (run_key) do update set
  plaintext_fields = excluded.plaintext_fields,
  encrypted_fields = excluded.encrypted_fields,
  notes = excluded.notes,
  metadata = excluded.metadata,
  updated_at = now();

comment on table public.medical_data_access_logs is 'Append-only-style medical/sensitive data access log for server-side decrypt, view, update, export and deletion request actions.';
comment on table public.sensitive_data_backfill_runs is 'Phase 153 readiness registry for safe server-side encryption backfill and later plaintext removal.';
