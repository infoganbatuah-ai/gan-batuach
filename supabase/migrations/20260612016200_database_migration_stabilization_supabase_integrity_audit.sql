-- PHASE 162: Database Migration Stabilization & Supabase Integrity Audit

create extension if not exists "pgcrypto";

create table if not exists public.database_integrity_audit_items (
  id uuid primary key default gen_random_uuid(),
  item_key text not null unique,
  audit_area text not null,
  title text not null,
  status text not null default 'needs_review',
  severity text not null default 'medium',
  finding text not null,
  recommended_action text,
  affected_objects text[] not null default '{}'::text[],
  evidence jsonb not null default '{}'::jsonb,
  fixed_in_phase text,
  last_checked_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint database_integrity_audit_status_check check (status in ('passed','fixed','needs_review','warning','critical','blocked')),
  constraint database_integrity_audit_severity_check check (severity in ('critical','high','medium','low'))
);

create table if not exists public.database_integrity_score (
  id uuid primary key default gen_random_uuid(),
  score_key text not null unique,
  migration_safety_score integer not null default 0,
  rls_coverage_score integer not null default 0,
  enum_consistency_score integer not null default 0,
  helper_function_score integer not null default 0,
  storage_security_score integer not null default 0,
  index_readiness_score integer not null default 0,
  schema_drift_score integer not null default 0,
  critical_blocker_count integer not null default 0,
  database_integrity_score integer not null default 0,
  recommendation text not null default 'needs_review',
  summary text,
  measured_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint database_integrity_score_range_check check (
    migration_safety_score between 0 and 100
    and rls_coverage_score between 0 and 100
    and enum_consistency_score between 0 and 100
    and helper_function_score between 0 and 100
    and storage_security_score between 0 and 100
    and index_readiness_score between 0 and 100
    and schema_drift_score between 0 and 100
    and database_integrity_score between 0 and 100
  )
);

create table if not exists public.database_rls_audit_targets (
  id uuid primary key default gen_random_uuid(),
  table_name text not null unique,
  sensitivity text not null default 'internal',
  expected_scope text not null default 'role_scoped',
  rls_expected boolean not null default true,
  policy_expected boolean not null default true,
  current_status text not null default 'needs_review',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint database_rls_sensitivity_check check (sensitivity in ('public','internal','confidential','sensitive','medical','regulated')),
  constraint database_rls_status_check check (current_status in ('passed','fixed','needs_review','warning','critical','blocked'))
);

create table if not exists public.database_storage_bucket_audit (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null unique,
  bucket_purpose text not null,
  sensitivity text not null default 'internal',
  expected_public boolean not null default false,
  signed_url_required boolean not null default true,
  access_audit_required boolean not null default true,
  current_status text not null default 'needs_review',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint database_storage_sensitivity_check check (sensitivity in ('public','internal','confidential','sensitive','medical','regulated')),
  constraint database_storage_status_check check (current_status in ('passed','fixed','needs_review','warning','critical','blocked'))
);

create index if not exists database_integrity_audit_area_idx on public.database_integrity_audit_items(audit_area, status, severity);
create index if not exists database_integrity_score_measured_idx on public.database_integrity_score(measured_at desc);
create index if not exists database_rls_audit_status_idx on public.database_rls_audit_targets(current_status, sensitivity);
create index if not exists database_storage_bucket_status_idx on public.database_storage_bucket_audit(current_status, sensitivity);

alter table public.database_integrity_audit_items enable row level security;
alter table public.database_integrity_score enable row level security;
alter table public.database_rls_audit_targets enable row level security;
alter table public.database_storage_bucket_audit enable row level security;

drop policy if exists "database integrity audit admin only" on public.database_integrity_audit_items;
create policy "database integrity audit admin only" on public.database_integrity_audit_items for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "database integrity score admin only" on public.database_integrity_score;
create policy "database integrity score admin only" on public.database_integrity_score for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "database rls audit admin only" on public.database_rls_audit_targets;
create policy "database rls audit admin only" on public.database_rls_audit_targets for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "database storage audit admin only" on public.database_storage_bucket_audit;
create policy "database storage audit admin only" on public.database_storage_bucket_audit for all using (public.is_admin()) with check (public.is_admin());

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'gardens','profiles','inspectors','teachers','staff','parents','children','leads','tasks',
    'inspection_forms','inspection_form_questions','inspections','inspection_answers','violations',
    'messages','complaints','documents','attendance','camera_streams','camera_view_logs',
    'ai_events','audit_logs','staff_permanent_files','staff_kindergarten_employments',
    'staff_timeline_events','required_inspections','late_inspections'
  ]
  loop
    if to_regclass('public.' || target_table) is not null then
      execute format('alter table public.%I enable row level security', target_table);
    end if;
  end loop;
end $$;

do $$
declare
  idx record;
begin
  for idx in
    select *
    from (values
      ('children', 'database_idx_children_garden_status', array['garden_id','status']),
      ('children', 'database_idx_children_primary_parent', array['primary_parent_id']),
      ('parents', 'database_idx_parents_garden_profile', array['garden_id','profile_id']),
      ('staff', 'database_idx_staff_garden_status', array['garden_id','status']),
      ('documents', 'database_idx_documents_garden_category', array['garden_id','category']),
      ('documents', 'database_idx_documents_expires_at', array['expires_at']),
      ('attendance', 'database_idx_attendance_garden_child_date', array['garden_id','child_id','attendance_date']),
      ('camera_streams', 'database_idx_camera_streams_garden_status', array['garden_id','status']),
      ('camera_view_logs', 'database_idx_camera_view_logs_garden_created', array['garden_id','created_at']),
      ('ai_events', 'database_idx_ai_events_garden_status_created', array['garden_id','status','created_at']),
      ('audit_logs', 'database_idx_audit_logs_actor_created', array['actor_id','created_at']),
      ('inspections', 'database_idx_inspections_garden_status', array['garden_id','status']),
      ('tasks', 'database_idx_tasks_garden_status_due', array['garden_id','status','due_date'])
    ) as v(table_name, index_name, columns)
  loop
    if to_regclass('public.' || idx.table_name) is not null
       and not exists (
         select 1
         from unnest(idx.columns) as cols(col_name)
         where not exists (
           select 1
           from information_schema.columns c
           where c.table_schema = 'public'
             and c.table_name = idx.table_name
             and c.column_name = col_name
         )
       ) then
      execute format(
        'create index if not exists %I on public.%I (%s)',
        idx.index_name,
        idx.table_name,
        (select string_agg(format('%I', col_name), ', ') from unnest(idx.columns) as cols(col_name))
      );
    end if;
  end loop;
end $$;

insert into public.database_rls_audit_targets (table_name, sensitivity, expected_scope, rls_expected, policy_expected, current_status, notes, metadata)
values
  ('children', 'regulated', 'garden_scoped_parent_limited', true, true, 'fixed', 'Phase 162 re-applies RLS safely; parent isolation still needs seeded negative QA.', '{"phase":162}'::jsonb),
  ('parents', 'sensitive', 'garden_scoped_self_limited', true, true, 'fixed', 'Phase 162 re-applies RLS safely.', '{"phase":162}'::jsonb),
  ('staff', 'sensitive', 'garden_scoped_staff_manager', true, true, 'fixed', 'Phase 162 re-applies RLS safely.', '{"phase":162}'::jsonb),
  ('documents', 'regulated', 'garden_scoped_private_storage', true, true, 'fixed', 'RLS expected and private storage proof still needs live Supabase check.', '{"phase":162}'::jsonb),
  ('attendance', 'regulated', 'garden_child_scoped', true, true, 'fixed', 'RLS expected; GPS/signature audit needs seeded QA.', '{"phase":162}'::jsonb),
  ('camera_streams', 'regulated', 'garden_scoped_no_credentials_to_client', true, true, 'fixed', 'RLS expected; route-level sanitization must continue blocking RTSP/credentials.', '{"phase":162}'::jsonb),
  ('camera_view_logs', 'regulated', 'audit_scoped', true, true, 'fixed', 'RLS expected and admin/manager scoped reads should be verified.', '{"phase":162}'::jsonb),
  ('ai_events', 'regulated', 'garden_scoped_no_parent_raw', true, true, 'fixed', 'RLS expected; parent raw visibility needs negative tests.', '{"phase":162}'::jsonb),
  ('audit_logs', 'regulated', 'admin_read_append_only', true, true, 'fixed', 'RLS expected; immutable mutation blockers exist in Phase 154.', '{"phase":162}'::jsonb),
  ('privacy_requests', 'regulated', 'admin_review_subject_scoped', true, true, 'needs_review', 'Privacy workflow RLS should be verified against user-facing /dashboard/privacy.', '{"phase":162}'::jsonb)
on conflict (table_name) do update set
  sensitivity = excluded.sensitivity,
  expected_scope = excluded.expected_scope,
  rls_expected = excluded.rls_expected,
  policy_expected = excluded.policy_expected,
  current_status = excluded.current_status,
  notes = excluded.notes,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.database_storage_bucket_audit (bucket_id, bucket_purpose, sensitivity, expected_public, signed_url_required, access_audit_required, current_status, notes, metadata)
values
  ('profile-photos', 'User profile photos', 'sensitive', false, true, true, 'needs_review', 'Bucket is configured private in migrations; signed URL and audit flow need live Supabase verification.', '{"phase":162}'::jsonb),
  ('child-photos', 'Child photos', 'regulated', false, true, true, 'needs_review', 'Sensitive child media must remain private.', '{"phase":162}'::jsonb),
  ('pickup-person-photos', 'Authorized pickup adult photos', 'regulated', false, true, true, 'needs_review', 'Pickup identity images require private access and audit.', '{"phase":162}'::jsonb),
  ('documents', 'General and sensitive documents', 'regulated', false, true, true, 'needs_review', 'Medical, ID and compliance files require private bucket proof.', '{"phase":162}'::jsonb),
  ('incident-photos', 'Incident evidence photos', 'regulated', false, true, true, 'needs_review', 'Incident evidence must not be public.', '{"phase":162}'::jsonb),
  ('inspection-reports', 'Inspection reports and evidence', 'regulated', false, true, true, 'needs_review', 'Inspection evidence requires scoped signed URL access.', '{"phase":162}'::jsonb),
  ('camera-snapshots', 'Camera snapshots and observer evidence', 'regulated', false, true, true, 'warning', 'Earlier migrations allowed authenticated reads; verify no parent/client broad exposure.', '{"phase":162}'::jsonb),
  ('gallery', 'Parent-approved gallery media', 'regulated', false, true, true, 'needs_review', 'Parent-visible media must be approved and scoped to child/garden.', '{"phase":162}'::jsonb)
on conflict (bucket_id) do update set
  bucket_purpose = excluded.bucket_purpose,
  sensitivity = excluded.sensitivity,
  expected_public = excluded.expected_public,
  signed_url_required = excluded.signed_url_required,
  access_audit_required = excluded.access_audit_required,
  current_status = excluded.current_status,
  notes = excluded.notes,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.database_integrity_audit_items (item_key, audit_area, title, status, severity, finding, recommended_action, affected_objects, evidence, fixed_in_phase, metadata)
values
  ('migration-order-127-files', 'migration_safety', 'Migration order reviewed', 'passed', 'low', '127 SQL migration files are ordered by timestamp naming. No destructive reset/drop table pattern was found in the local scan.', 'Keep new migrations timestamped and append-only.', array['supabase/migrations'], '{"migration_files":127,"drop_table_without_if_exists":0,"drop_column_without_if_exists":0}'::jsonb, null, '{"phase":162}'::jsonb),
  ('seed-idempotency-risk', 'migration_safety', 'Seed inserts without conflict handling', 'warning', 'medium', 'Local scan found many seed inserts that do not use ON CONFLICT near the insert statement. Some may be safe by source data uniqueness, but they are not uniformly rerunnable.', 'Prioritize older seed-heavy migrations for ON CONFLICT or where-not-exists cleanup.', array['supabase/migrations'], '{"estimated_insert_statements":341,"estimated_without_nearby_on_conflict":132}'::jsonb, null, '{"phase":162}'::jsonb),
  ('core-rls-hardening-reapplied', 'rls', 'Core sensitive RLS re-applied safely', 'fixed', 'high', 'Phase 162 re-applies RLS to core sensitive tables if they exist, without replacing policies or touching data.', 'Run Supabase catalog query in production to confirm relrowsecurity=true for sensitive tables.', array['children','parents','staff','documents','attendance','camera_streams','ai_events','audit_logs'], '{"safe_statement":"alter table ... enable row level security"}'::jsonb, '162', '{"phase":162}'::jsonb),
  ('helper-functions-present-in-migrations', 'helper_functions', 'Core helper functions are defined', 'passed', 'low', 'Local migration scan found create-or-replace definitions for is_admin, can_access_garden, current_role, current_garden_id and can_parent_access_garden.', 'Verify function signatures in Supabase after migrations.', array['public.is_admin','public.can_access_garden','public.current_role','public.current_garden_id','public.can_parent_access_garden'], '{"helpers_found":true}'::jsonb, null, '{"phase":162}'::jsonb),
  ('enum-text-coalesce-risk', 'enum_consistency', 'Enum/text comparison risk reduced but not fully proven', 'needs_review', 'medium', 'Recent migration failures came from enum/text COALESCE and invalid status assumptions. Newer migrations often use status::text, but a live schema enum audit is still required.', 'Use status::text when comparing optional/future status values and never insert unknown enum literals.', array['camera_status','inspection_status','compliance_alerts','billing_status'], '{"known_previous_failures":["camera COALESCE enum/text","compliance_alerts.status missing","launch_validation_area_check invalid value"]}'::jsonb, null, '{"phase":162}'::jsonb),
  ('schema-drift-known-risks', 'schema_drift', 'Known schema drift patterns documented', 'needs_review', 'high', 'Previous failures show fragile assumptions around gardens/kindergartens aliases, compliance_alerts lifecycle fields, tasks category/type, helper names and enum values.', 'Keep all new migrations using existing table names, add columns before use, and guard optional columns through schema-aware logic.', array['gardens','compliance_alerts','tasks','camera_streams'], '{"previous_failures":5}'::jsonb, null, '{"phase":162}'::jsonb),
  ('storage-private-proof-needed', 'storage', 'Sensitive storage requires live bucket proof', 'warning', 'high', 'Private bucket definitions exist, but production bucket public flags and signed URL audit cannot be fully verified from SQL files alone.', 'Run Supabase storage bucket inventory and signed URL access tests before pilot.', array['storage.buckets','storage.objects'], '{"sensitive_buckets":8}'::jsonb, null, '{"phase":162}'::jsonb),
  ('safe-indexes-added', 'indexes', 'Safe conditional indexes added', 'fixed', 'medium', 'Phase 162 adds indexes only when the table and all referenced columns exist.', 'Review slow query logs after pilot and add additional non-destructive indexes as needed.', array['children','parents','staff','documents','attendance','camera_streams','ai_events','audit_logs','inspections','tasks'], '{"conditional_indexes":13}'::jsonb, '162', '{"phase":162}'::jsonb),
  ('parent-isolation-live-test-needed', 'parent_isolation', 'Parent isolation requires seeded negative tests', 'critical', 'critical', 'Policies and route guards exist, but parent cannot access other child/garden/raw AI/internal investigation must be proven with live seeded tests.', 'Run negative role QA before pilot and keep this as a launch blocker until verified.', array['children','parents','ai_events','documents','camera_streams'], '{"launch_blocker":true}'::jsonb, null, '{"phase":162}'::jsonb),
  ('camera-schema-integrity', 'camera', 'Camera schema integrity partially ready', 'needs_review', 'high', 'Camera health, tokens, audit and policies exist. Direct RTSP/credential exposure must be verified at route and view level.', 'Confirm client-facing queries sanitize playback URLs and credentials.', array['camera_streams','video_stream_sessions','camera_playback_sessions','camera_access_audit_trail'], '{"no_direct_rtsp_required":true}'::jsonb, null, '{"phase":162}'::jsonb),
  ('ai-observer-parent-visibility', 'ai_observer', 'Raw AI parent visibility blocked by policy but needs QA', 'needs_review', 'high', 'Observer and capability policy tables mark parent_visible false and legal_review_required capabilities blocked, but live parent route tests are still needed.', 'Run parent negative tests for raw AI, skeleton events and internal observer signals.', array['ai_camera_events','skeleton_observer_events','observer_intelligence_signals','observer_vertical_capability_decisions'], '{"parent_visible_default_false_expected":true}'::jsonb, null, '{"phase":162}'::jsonb),
  ('billing-separation-audit', 'billing', 'Billing separation model exists', 'needs_review', 'high', 'Gan Batuach subscription and parent tuition routing are modeled separately, but payment provider sandbox and raw-card-field audit still need live validation.', 'Run provider sandbox QA and scan billing tables for raw card fields before pilot.', array['kindergarten_subscriptions','parent_payment_transactions','revenue_separation_ledger'], '{"raw_card_storage_forbidden":true}'::jsonb, null, '{"phase":162}'::jsonb),
  ('privacy-retention-legal-hold', 'privacy', 'Privacy retention and legal hold model exists', 'needs_review', 'medium', 'Privacy requests, retention policies and legal holds exist. Execution paths must be tested before production deletion workflows.', 'Run deletion/anonymization dry run on seed data only.', array['privacy_requests','legal_holds','data_retention_policies'], '{"no_blind_delete":true}'::jsonb, null, '{"phase":162}'::jsonb)
on conflict (item_key) do update set
  audit_area = excluded.audit_area,
  title = excluded.title,
  status = excluded.status,
  severity = excluded.severity,
  finding = excluded.finding,
  recommended_action = excluded.recommended_action,
  affected_objects = excluded.affected_objects,
  evidence = excluded.evidence,
  fixed_in_phase = excluded.fixed_in_phase,
  last_checked_at = now(),
  metadata = excluded.metadata,
  updated_at = now();

insert into public.database_integrity_score (
  score_key, migration_safety_score, rls_coverage_score, enum_consistency_score, helper_function_score,
  storage_security_score, index_readiness_score, schema_drift_score, critical_blocker_count,
  database_integrity_score, recommendation, summary, metadata
)
values (
  'phase-162-current',
  72, 82, 68, 88, 62, 78, 58, 1, 69,
  'needs_review',
  'Database layer is safer after Phase 162 hardening, but production readiness still requires live Supabase catalog, storage, parent isolation and migration replay validation.',
  '{"phase":162,"migration_files":127,"tables_detected":476,"tables_with_rls_detected":444,"unsafe_seed_insert_estimate":132}'::jsonb
)
on conflict (score_key) do update set
  migration_safety_score = excluded.migration_safety_score,
  rls_coverage_score = excluded.rls_coverage_score,
  enum_consistency_score = excluded.enum_consistency_score,
  helper_function_score = excluded.helper_function_score,
  storage_security_score = excluded.storage_security_score,
  index_readiness_score = excluded.index_readiness_score,
  schema_drift_score = excluded.schema_drift_score,
  critical_blocker_count = excluded.critical_blocker_count,
  database_integrity_score = excluded.database_integrity_score,
  recommendation = excluded.recommendation,
  summary = excluded.summary,
  measured_at = now(),
  metadata = excluded.metadata,
  updated_at = now();

comment on table public.database_integrity_audit_items is 'Supabase migration and schema integrity audit findings for Phase 162.';
comment on table public.database_integrity_score is 'Database integrity readiness score across migration safety, RLS, enums, helpers, storage, indexes and drift.';
comment on table public.database_rls_audit_targets is 'Sensitive table RLS coverage targets and verification notes.';
comment on table public.database_storage_bucket_audit is 'Supabase Storage bucket security expectations for sensitive files and evidence.';
