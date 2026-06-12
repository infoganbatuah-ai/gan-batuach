-- PHASE 133: Data migration, import and external system integration platform.
-- Safe migration foundation: upload, mapping, validation, preview, confirmation,
-- import audit and rollback readiness. No existing customer data is overwritten by
-- this migration.

create table if not exists public.data_migration_batches (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid references public.gardens(id) on delete cascade,
  network_name text,
  batch_name text not null,
  import_scope text not null default 'single_kindergarten',
  source_type text not null default 'excel',
  source_system text,
  status text not null default 'draft',
  preview_required boolean not null default true,
  confirmation_required boolean not null default true,
  rollback_available boolean not null default false,
  total_records integer not null default 0,
  records_to_create integer not null default 0,
  records_to_update integer not null default 0,
  validation_error_count integer not null default 0,
  warning_count integer not null default 0,
  imported_count integer not null default 0,
  duplicate_count integer not null default 0,
  correction_rate numeric(5, 2) not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  confirmed_by uuid references public.profiles(id) on delete set null,
  confirmed_at timestamptz,
  imported_by uuid references public.profiles(id) on delete set null,
  imported_at timestamptz,
  rolled_back_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint data_migration_import_scope_check check (import_scope in ('single_kindergarten','network','bulk_onboarding')),
  constraint data_migration_source_type_check check (source_type in ('excel','csv','google_sheets_export','pdf_bundle','image_bundle','external_export','future_api')),
  constraint data_migration_status_check check (status in ('draft','uploaded','validating','preview_ready','awaiting_confirmation','importing','completed','failed','rolled_back','cancelled'))
);

create table if not exists public.data_migration_files (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.data_migration_batches(id) on delete cascade,
  file_name text not null,
  file_type text not null,
  storage_bucket text,
  storage_path text,
  row_count integer not null default 0,
  parsed boolean not null default false,
  parse_status text not null default 'pending',
  checksum text,
  metadata jsonb not null default '{}'::jsonb,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint data_migration_file_type_check check (file_type in ('excel','csv','google_sheets_export','pdf','image','contract','license','certification','invoice','receipt','external_export')),
  constraint data_migration_file_parse_status_check check (parse_status in ('pending','parsed','failed','unsupported'))
);

create table if not exists public.data_mapping_templates (
  id uuid primary key default gen_random_uuid(),
  template_name text not null,
  source_system text,
  entity_type text not null,
  mapping jsonb not null default '{}'::jsonb,
  required_fields text[] not null default '{}',
  validation_rules jsonb not null default '{}'::jsonb,
  reusable boolean not null default true,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint data_mapping_entity_type_check check (entity_type in ('child','parent','staff','document','payment','invoice','receipt','authorized_pickup','communication_preference')),
  unique(template_name, entity_type)
);

create table if not exists public.data_migration_preview_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.data_migration_batches(id) on delete cascade,
  file_id uuid references public.data_migration_files(id) on delete cascade,
  row_number integer,
  entity_type text not null,
  external_id text,
  action_type text not null default 'create',
  validation_status text not null default 'pending',
  duplicate_match_id uuid,
  target_table text,
  target_entity_id uuid,
  raw_payload jsonb not null default '{}'::jsonb,
  mapped_payload jsonb not null default '{}'::jsonb,
  validation_errors jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint data_preview_entity_type_check check (entity_type in ('child','parent','staff','document','payment','invoice','receipt','authorized_pickup','communication_preference')),
  constraint data_preview_action_type_check check (action_type in ('create','update','skip','manual_review')),
  constraint data_preview_validation_status_check check (validation_status in ('pending','valid','warning','error','duplicate','manual_review'))
);

create table if not exists public.data_migration_validation_issues (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.data_migration_batches(id) on delete cascade,
  preview_row_id uuid references public.data_migration_preview_rows(id) on delete cascade,
  entity_type text not null,
  issue_type text not null,
  severity text not null default 'warning',
  field_name text,
  message text not null,
  suggested_fix text,
  resolved boolean not null default false,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint data_validation_issue_type_check check (issue_type in ('duplicate','missing_required_field','invalid_format','invalid_relationship','conflict','unsupported_file','permission_issue','manual_review')),
  constraint data_validation_issue_severity_check check (severity in ('info','warning','error','critical'))
);

create table if not exists public.data_migration_rollback_events (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.data_migration_batches(id) on delete cascade,
  rollback_type text not null default 'full',
  status text not null default 'planned',
  affected_entity_type text,
  affected_records integer not null default 0,
  rollback_snapshot jsonb not null default '{}'::jsonb,
  reason text,
  requested_by uuid references public.profiles(id) on delete set null,
  executed_by uuid references public.profiles(id) on delete set null,
  executed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint data_rollback_type_check check (rollback_type in ('full','partial','failed_import_recovery')),
  constraint data_rollback_status_check check (status in ('planned','running','completed','failed','cancelled'))
);

create table if not exists public.external_system_connectors (
  id uuid primary key default gen_random_uuid(),
  connector_key text not null unique,
  connector_name text not null,
  connector_type text not null,
  status text not null default 'not_configured',
  supported_entities text[] not null default '{}',
  auth_mode text not null default 'manual_upload',
  last_test_at timestamptz,
  last_test_status text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_connector_type_check check (connector_type in ('spreadsheet','google_sheets','external_export','accounting','crm','education_system','municipal_system','future_api')),
  constraint external_connector_status_check check (status in ('not_configured','configured','test_mode','production_ready','active','disabled','failed')),
  constraint external_connector_auth_mode_check check (auth_mode in ('manual_upload','oauth_ready','api_key_env','sftp_ready','webhook_ready'))
);

create table if not exists public.data_quality_snapshots (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid references public.gardens(id) on delete cascade,
  batch_id uuid references public.data_migration_batches(id) on delete set null,
  scope_type text not null default 'kindergarten',
  completeness_score integer not null default 0 check (completeness_score between 0 and 100),
  duplicate_score integer not null default 0 check (duplicate_score between 0 and 100),
  relationship_score integer not null default 0 check (relationship_score between 0 and 100),
  document_score integer not null default 0 check (document_score between 0 and 100),
  overall_score integer not null default 0 check (overall_score between 0 and 100),
  missing_data_count integer not null default 0,
  invalid_records_count integer not null default 0,
  duplicate_records_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint data_quality_scope_check check (scope_type in ('kindergarten','network','platform'))
);

create index if not exists data_migration_batches_status_idx on public.data_migration_batches(status, created_at desc);
create index if not exists data_migration_batches_garden_idx on public.data_migration_batches(garden_id, created_at desc);
create index if not exists data_migration_files_batch_idx on public.data_migration_files(batch_id, created_at desc);
create index if not exists data_mapping_templates_entity_idx on public.data_mapping_templates(entity_type, active);
create index if not exists data_preview_rows_batch_idx on public.data_migration_preview_rows(batch_id, entity_type, validation_status);
create index if not exists data_validation_issues_batch_idx on public.data_migration_validation_issues(batch_id, severity, resolved);
create index if not exists data_rollback_events_batch_idx on public.data_migration_rollback_events(batch_id, created_at desc);
create index if not exists external_connectors_status_idx on public.external_system_connectors(connector_type, status);
create index if not exists data_quality_snapshots_garden_idx on public.data_quality_snapshots(garden_id, calculated_at desc);

alter table public.data_migration_batches enable row level security;
alter table public.data_migration_files enable row level security;
alter table public.data_mapping_templates enable row level security;
alter table public.data_migration_preview_rows enable row level security;
alter table public.data_migration_validation_issues enable row level security;
alter table public.data_migration_rollback_events enable row level security;
alter table public.external_system_connectors enable row level security;
alter table public.data_quality_snapshots enable row level security;

drop policy if exists "data migration batches admin read" on public.data_migration_batches;
create policy "data migration batches admin read" on public.data_migration_batches
for select using (public.is_admin() or (garden_id is not null and public.current_role() in ('manager','owner') and public.can_access_garden(garden_id)));

drop policy if exists "data migration batches admin write" on public.data_migration_batches;
create policy "data migration batches admin write" on public.data_migration_batches
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "data migration files admin read" on public.data_migration_files;
create policy "data migration files admin read" on public.data_migration_files
for select using (
  public.is_admin()
  or exists (
    select 1 from public.data_migration_batches b
    where b.id = batch_id and b.garden_id is not null and public.current_role() in ('manager','owner') and public.can_access_garden(b.garden_id)
  )
);

drop policy if exists "data migration files admin write" on public.data_migration_files;
create policy "data migration files admin write" on public.data_migration_files
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "data mapping templates scoped read" on public.data_mapping_templates;
create policy "data mapping templates scoped read" on public.data_mapping_templates
for select using (public.is_admin() or active = true);

drop policy if exists "data mapping templates admin write" on public.data_mapping_templates;
create policy "data mapping templates admin write" on public.data_mapping_templates
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "data preview rows admin read" on public.data_migration_preview_rows;
create policy "data preview rows admin read" on public.data_migration_preview_rows
for select using (
  public.is_admin()
  or exists (
    select 1 from public.data_migration_batches b
    where b.id = batch_id and b.garden_id is not null and public.current_role() in ('manager','owner') and public.can_access_garden(b.garden_id)
  )
);

drop policy if exists "data preview rows admin write" on public.data_migration_preview_rows;
create policy "data preview rows admin write" on public.data_migration_preview_rows
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "data validation issues admin read" on public.data_migration_validation_issues;
create policy "data validation issues admin read" on public.data_migration_validation_issues
for select using (
  public.is_admin()
  or exists (
    select 1 from public.data_migration_batches b
    where b.id = batch_id and b.garden_id is not null and public.current_role() in ('manager','owner') and public.can_access_garden(b.garden_id)
  )
);

drop policy if exists "data validation issues admin write" on public.data_migration_validation_issues;
create policy "data validation issues admin write" on public.data_migration_validation_issues
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "data rollback events admin read" on public.data_migration_rollback_events;
create policy "data rollback events admin read" on public.data_migration_rollback_events
for select using (public.is_admin());

drop policy if exists "data rollback events admin write" on public.data_migration_rollback_events;
create policy "data rollback events admin write" on public.data_migration_rollback_events
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "external connectors admin read" on public.external_system_connectors;
create policy "external connectors admin read" on public.external_system_connectors
for select using (public.is_admin());

drop policy if exists "external connectors admin write" on public.external_system_connectors;
create policy "external connectors admin write" on public.external_system_connectors
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "data quality snapshots scoped read" on public.data_quality_snapshots;
create policy "data quality snapshots scoped read" on public.data_quality_snapshots
for select using (public.is_admin() or (garden_id is not null and public.current_role() in ('manager','owner') and public.can_access_garden(garden_id)));

drop policy if exists "data quality snapshots admin write" on public.data_quality_snapshots;
create policy "data quality snapshots admin write" on public.data_quality_snapshots
for all using (public.is_admin()) with check (public.is_admin());

insert into public.data_mapping_templates (template_name, source_system, entity_type, mapping, required_fields, validation_rules)
values
  ('ילדים - CSV בסיסי', 'spreadsheet', 'child', '{"שם מלא":"full_name","תאריך לידה":"birth_date","קבוצה":"class_group","אלרגיות":"allergies","הערות רפואיות":"medical_notes","טלפון חירום":"emergency_phone"}'::jsonb, array['full_name'], '{"date_fields":["birth_date"],"duplicate_keys":["identity_number","full_name"]}'::jsonb),
  ('הורים - CSV בסיסי', 'spreadsheet', 'parent', '{"שם הורה":"full_name","טלפון":"phone","אימייל":"email","כתובת":"address","העדפת תקשורת":"communication_preferences"}'::jsonb, array['full_name','phone'], '{"phone_required":true,"duplicate_keys":["phone","email","identity_number"]}'::jsonb),
  ('צוות - CSV בסיסי', 'spreadsheet', 'staff', '{"שם מלא":"full_name","תפקיד":"role_title","טלפון":"phone","אימייל":"email","תחילת עבודה":"start_date","תעודות":"certifications"}'::jsonb, array['full_name','role_title'], '{"date_fields":["start_date"],"duplicate_keys":["identity_number","email","phone"]}'::jsonb),
  ('מסמכים - תיקייה', 'document_bundle', 'document', '{"שם קובץ":"title","סוג מסמך":"category","תאריך תוקף":"expires_at","ישות קשורה":"owner_reference"}'::jsonb, array['title','category'], '{"supported_files":["pdf","jpg","png","docx"],"requires_owner":true}'::jsonb),
  ('תשלומים - יתרות', 'accounting_export', 'payment', '{"שם ילד":"child_name","יתרה":"balance","חשבונית":"invoice_number","תאריך":"payment_date","סטטוס":"status"}'::jsonb, array['child_name','balance'], '{"numeric_fields":["balance"],"date_fields":["payment_date"]}'::jsonb)
on conflict (template_name, entity_type)
do update set
  mapping = excluded.mapping,
  required_fields = excluded.required_fields,
  validation_rules = excluded.validation_rules,
  updated_at = now();

insert into public.external_system_connectors (connector_key, connector_name, connector_type, status, supported_entities, auth_mode, notes)
values
  ('excel_upload', 'Excel Import', 'spreadsheet', 'configured', array['child','parent','staff','payment'], 'manual_upload', 'Manual Excel and CSV upload readiness.'),
  ('google_sheets_export', 'Google Sheets Export', 'google_sheets', 'configured', array['child','parent','staff'], 'manual_upload', 'Use exported CSV/XLSX files. OAuth can be added later.'),
  ('document_bundle_upload', 'Document Bundle Upload', 'external_export', 'configured', array['document'], 'manual_upload', 'PDF and image bundle migration readiness.'),
  ('accounting_export', 'Accounting Export', 'accounting', 'not_configured', array['payment','invoice','receipt'], 'api_key_env', 'Future accounting connector readiness.'),
  ('crm_export', 'CRM Export', 'crm', 'not_configured', array['parent','lead','communication_preference'], 'api_key_env', 'Future CRM connector readiness.'),
  ('municipal_export', 'Municipal Export', 'municipal_system', 'not_configured', array['kindergarten','inspection','document'], 'api_key_env', 'Future municipal system connector readiness.')
on conflict (connector_key)
do update set
  connector_name = excluded.connector_name,
  connector_type = excluded.connector_type,
  supported_entities = excluded.supported_entities,
  auth_mode = excluded.auth_mode,
  notes = excluded.notes,
  updated_at = now();

comment on table public.data_migration_batches is 'Safe migration/import batches. Imports require preview and confirmation before data writes.';
comment on table public.data_migration_preview_rows is 'Per-row preview and validation result before import confirmation.';
comment on table public.data_migration_validation_issues is 'Validation findings for duplicates, missing fields, invalid formats and invalid relationships.';
comment on table public.data_migration_rollback_events is 'Rollback and failed import recovery audit trail.';
comment on table public.external_system_connectors is 'Readiness registry for spreadsheet, accounting, CRM, education and municipal connectors.';
