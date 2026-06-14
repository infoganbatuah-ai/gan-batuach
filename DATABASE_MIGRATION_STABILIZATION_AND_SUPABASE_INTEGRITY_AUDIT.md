# Database Migration Stabilization & Supabase Integrity Audit

Phase 162 stabilizes the Supabase database layer after the large 106-160 roadmap. It does not delete production data, reset the database, drop tables, or perform destructive refactors.

## Implemented Artifacts

- Admin dashboard: `/dashboard/admin/database-integrity`
- Migration: `supabase/migrations/20260612016200_database_migration_stabilization_supabase_integrity_audit.sql`
- Audit tables:
  - `database_integrity_audit_items`
  - `database_integrity_score`
  - `database_rls_audit_targets`
  - `database_storage_bucket_audit`
- Navigation and route-safety registration

## Local Migration Audit

Local scan scope:

- Migration directory: `supabase/migrations`
- SQL migration files scanned: 127
- Tables detected by static scan: 476
- Tables with direct static RLS enable statements: 444
- Policies detected: 802
- Policy drops before recreate detected: 703
- Public insert statements detected: 341
- Insert statements without nearby `ON CONFLICT` detected: approximately 132
- Unsafe `DROP TABLE` without `IF EXISTS`: 0
- Unsafe `DROP COLUMN` without `IF EXISTS`: 0

Important nuance:

The static RLS scan does not fully understand dynamic `DO $$ ... alter table ... enable row level security` blocks. The initial schema uses a dynamic RLS loop for core tables, so some static “missing RLS” flags were false positives. Phase 162 still re-applies RLS safely to sensitive core tables as a defensive hardening step.

## Critical Fixes Applied

### RLS Hardening

Phase 162 safely re-applies RLS to sensitive core tables when they exist:

- `gardens`
- `profiles`
- `inspectors`
- `teachers`
- `staff`
- `parents`
- `children`
- `leads`
- `tasks`
- `inspection_forms`
- `inspection_form_questions`
- `inspections`
- `inspection_answers`
- `violations`
- `messages`
- `complaints`
- `documents`
- `attendance`
- `camera_streams`
- `camera_view_logs`
- `ai_events`
- `audit_logs`
- `staff_permanent_files`
- `staff_kindergarten_employments`
- `staff_timeline_events`
- `required_inspections`
- `late_inspections`

This is non-destructive and does not replace existing policies.

### Conditional Index Readiness

Phase 162 adds indexes only if the target table and all referenced columns exist.

Conditional indexes target:

- Children by garden/status and primary parent
- Parents by garden/profile
- Staff by garden/status
- Documents by garden/category and expiration
- Attendance by garden/child/date
- Camera streams by garden/status
- Camera view logs by garden/created date
- AI events by garden/status/created date
- Audit logs by actor/created date
- Inspections by garden/status
- Tasks by garden/status/due date

## Migration Idempotency Audit

Good patterns found:

- Newer roadmap phases generally use `create table if not exists`.
- Newer phases usually use `add column if not exists`.
- Newer phases usually use `create index if not exists`.
- Most recent policy migrations use `drop policy if exists` before `create policy`.
- Helper functions generally use `create or replace function`.

Risky patterns found:

- Older migrations contain seed inserts without `ON CONFLICT`.
- Some policy creation in early migrations does not drop existing policies first.
- Some migrations rely on existing columns/tables from previous phases without explicit guards.
- Some seed rows may duplicate if migrations are replayed against a partially migrated database.

No destructive reset/drop pattern was found in the local scan.

## Enum Consistency Audit

Previous failures show the main enum risks:

- `COALESCE(status, stream_status, health_status)` mixing enum and text.
- `compliance_alerts.status` referenced when the real lifecycle field was not `status`.
- Invalid check values inserted into status fields.
- Grouping queries referencing non-grouped fields.

Current safety rule:

- Use `status::text` when comparing optional or future status values.
- Do not insert enum literals unless they are known to be allowed by the active constraint.
- Do not use `COALESCE(enum_column, text_column)` without explicit text casts.

Remaining work:

- Run a live Supabase enum inventory against `pg_type`, `pg_enum`, `pg_attribute` and migration-used literals.
- Compare TypeScript status strings against real database constraints.

## Schema Drift Findings

Known drift patterns from previous phases:

- `public.kindergartens` vs `public.gardens`
- `user_has_garden_access` vs `can_access_garden`
- `tasks.category` when the schema uses `task_type`
- `compliance_alerts.status` when the lifecycle field differs
- Enum/text COALESCE mismatches
- Dashboard queries assuming phase migrations have already run

Current mitigation:

- New Phase 162 dashboard reads from Phase 162-owned tables.
- The migration uses `to_regclass` and `information_schema.columns` checks before RLS/index hardening.
- Reported drift is tracked in `database_integrity_audit_items`.

## Helper Function Audit

Local migration scan found definitions for:

- `public.is_admin()`
- `public.can_access_garden(uuid)`
- `public.current_role()`
- `public.current_garden_id()`
- `public.can_parent_access_garden(uuid)`
- `public.jwt_garden_id()`
- `public.jwt_room_uuid()`
- `public.can_access_network(uuid)`
- `public.can_parent_view_camera(...)`

Remaining work:

- Verify function signatures in the live Supabase database.
- Verify every security-definer function has a safe `search_path`.
- Confirm there are no duplicate helpers with overlapping semantics.

## RLS Coverage Audit

Sensitive table categories tracked:

- Children and parents
- Staff
- Medical and identity records
- Documents
- Attendance and pickup
- Cameras and camera logs
- AI and observer events
- Audit logs
- Privacy requests
- Billing and payments
- Inspections and compliance

Phase 162 adds `database_rls_audit_targets` for the highest-risk tables.

Remaining work:

- Run live catalog query:

```sql
select
  schemaname,
  tablename,
  rowsecurity,
  (
    select count(*)
    from pg_policies p
    where p.schemaname = t.schemaname
      and p.tablename = t.tablename
  ) as policy_count
from pg_tables t
where schemaname = 'public'
order by tablename;
```

## Parent Data Isolation Audit

Must be verified with seeded negative tests:

- Parent cannot access another child.
- Parent cannot access another garden.
- Parent cannot access raw AI events.
- Parent cannot access internal inspection drafts.
- Parent cannot access staff-only notes.
- Parent cannot access internal investigation data.

Current status: critical blocker until verified.

## Manager / Staff / Inspector Scope Audit

Expected model:

- Manager: own garden only.
- Staff: assigned garden and operationally allowed children only.
- Inspector: assigned gardens and inspection/legal scope only.
- Admin: all data through intended admin routes only.
- Observer site users: own observer sites only.

Remaining work:

- Run seeded role-boundary API tests.
- Verify route guards align with RLS policies.

## Storage Bucket Security Audit

Buckets tracked:

- `profile-photos`
- `child-photos`
- `pickup-person-photos`
- `documents`
- `incident-photos`
- `inspection-reports`
- `camera-snapshots`
- `gallery`

Expected state:

- Sensitive buckets private.
- Sensitive views/downloads use signed URLs or server routes.
- Sensitive file access is audited.
- No public access for medical documents, ID documents, signatures, inspection evidence, incident evidence or camera snapshots.

Remaining work:

- Run live Supabase Storage bucket inventory.
- Verify `storage.buckets.public = false` for sensitive buckets.
- Test signed URL expiry and replay behavior.

## Index & Performance Audit

Phase 162 adds safe conditional indexes for common query dimensions:

- `garden_id`
- `child_id`
- `parent_id`
- `staff_id`
- `camera_id`
- `created_at`
- `status`
- `due_date`
- `expires_at`

Remaining work:

- Review Supabase slow query logs after seeded QA.
- Add additional indexes only from real query evidence.

## Foreign Key & Relationship Audit

High-risk relationship areas:

- Children ↔ parents ↔ gardens
- Staff ↔ gardens ↔ documents
- Inspections ↔ answers ↔ findings ↔ evidence
- Cameras ↔ gateways ↔ playback sessions ↔ audit logs
- Payments ↔ invoices ↔ payout configuration
- Observer events ↔ review queue ↔ incidents/tasks

Remaining work:

- Run live orphan checks.
- Confirm no unsafe cascade deletes on evidence, audit logs, legal holds, inspections or payment records.

## Migration Seed Safety Audit

Risk:

Many older migrations contain inserts without `ON CONFLICT`.

This can be acceptable when:

- The migration is never replayed against a partially seeded database.
- The inserted rows are source-selected from unique rows.
- A unique constraint prevents duplicates.

Still, production readiness requires:

- Disposable database migration replay.
- Fixing seed-heavy older migrations only if replay actually fails.

## Function Safety Audit

Current findings:

- Security-definer helpers are present.
- Some functions set `search_path = public`.
- Newer helper functions generally use `create or replace function`.

Remaining work:

- Run live function inventory:

```sql
select
  n.nspname,
  p.proname,
  p.prosecdef,
  p.proconfig
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by p.proname;
```

## Camera Schema Integrity

Tracked objects:

- `camera_streams`
- `video_stream_sessions`
- `camera_playback_sessions`
- `camera_access_audit_trail`
- Camera gateway/readiness tables

Risk:

- Client-facing tables or routes must never expose direct RTSP URLs, gateway credentials or camera secrets.

Remaining work:

- Verify all camera list APIs sanitize fields.
- Run parent checked-in/checked-out camera token tests.

## AI / Observer Schema Integrity

Expected:

- `parent_visible` defaults false for raw signals.
- Human review required for sensitive AI outputs.
- Restricted capabilities are disabled or legal-review-required for Gan Batuach.
- Parent raw visibility is blocked.

Remaining work:

- Negative parent tests for raw AI events and skeleton/observer signals.

## Billing Schema Integrity

Expected:

- Gan Batuach subscription revenue goes to Gan Batuach.
- Parent tuition payments route to kindergarten account/provider account.
- No raw card fields are stored.
- Billing actions are audited.

Remaining work:

- Payment provider sandbox QA.
- Scan live schema for card-number/CVV-like fields.

## Privacy / Deletion Schema Integrity

Expected:

- Privacy requests are reviewed before execution.
- Legal holds block deletion.
- Audit logs are preserved.
- Telemetry is anonymized where required.

Remaining work:

- Run deletion/anonymization dry run on seed data only.
- Verify legal hold conflicts block deletion.

## Database Integrity Score

Current Phase 162 score: `69/100`

Breakdown:

- Migration safety: 72
- RLS coverage: 82
- Enum consistency: 68
- Helper function consistency: 88
- Storage security: 62
- Index readiness: 78
- Schema drift score: 58
- Critical blockers: 1

Recommendation: `needs_review`

## Critical Blockers

1. Parent isolation live negative tests are not complete.
2. Storage bucket public/private status must be verified in live Supabase.
3. Migration replay must be run against a disposable database.
4. Enum consistency requires live database enum inventory.

## Critical Fixes Applied

- Added database integrity dashboard.
- Added database audit tables.
- Re-applied RLS safely to sensitive core tables if present.
- Added conditional indexes only where tables and columns exist.
- Added storage bucket audit registry.
- Added RLS target registry.
- Added database integrity score snapshot.

## Remaining Database Risks

- Older seed migrations may not be perfectly rerunnable.
- Static analysis cannot prove live Supabase Storage privacy settings.
- Static analysis cannot prove all parent/staff/manager/inspector negative access cases.
- Some older dashboards may still assume phase tables exist before migrations are applied.
- Production readiness still requires a disposable migration replay and live catalog checks.
