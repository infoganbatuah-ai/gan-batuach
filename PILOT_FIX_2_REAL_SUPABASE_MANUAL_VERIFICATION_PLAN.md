# PILOT FIX 2 - Real Supabase Manual Verification Plan

Date: 2026-06-27

This plan is written for Daniel to run in the target Supabase project. Use only synthetic data. Do not use real child, parent, staff, document, camera, or payment records.

## Where To Run

Run catalog checks in Supabase SQL Editor.

Run role-behavior tests either:

- in SQL Editor with synthetic users and `auth.uid()` simulation where your Supabase setup allows it, or
- through a small local/manual test harness where each synthetic user signs in with the anon key and queries through the normal client.

Do not use the service-role key for role behavior tests except to seed synthetic data and clean it up.

## Required Synthetic Users

- `admin_test`
- `manager_a_test`
- `manager_b_test`
- `parent_a_test`
- `parent_b_test`
- `staff_unassigned_test`
- `staff_assigned_a_test`
- `inspector_unassigned_test`
- `inspector_assigned_a_test`

## Required Synthetic Data

- Kindergarten A
- Kindergarten B
- Child A linked to Parent A and Kindergarten A
- Child B linked to Parent B and Kindergarten B
- Staff assignment for Kindergarten A only
- Inspector assignment for Kindergarten A only
- Document for Child A
- Document for Child B
- Payment/subscription record for Kindergarten A
- Camera record for Kindergarten A
- AI event for Kindergarten A

## Catalog Checks

### RLS Enabled

```sql
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'profiles','parents','children','permanent_child_files','parent_kindergarten_links',
    'child_parent_links','parent_child_relations','staff','inspectors','gardens',
    'attendance','messages','documents','child_health_records','child_daily_journals',
    'inspections','incident_reports','camera_streams','video_stream_sessions',
    'camera_view_logs','camera_playback_sessions','ai_events','ai_camera_events',
    'kindergarten_subscriptions','subscription_payments','provider_webhook_events',
    'audit_logs','notifications','observer_sites','observer_site_memberships',
    'observer_site_subscriptions'
  )
order by c.relname;
```

Expected: every sensitive table returns `rls_enabled = true`.

### Policy Inventory

```sql
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'profiles','parents','children','documents','staff','inspectors','gardens',
    'attendance','messages','inspections','camera_streams','ai_events',
    'ai_camera_events','kindergarten_subscriptions','subscription_payments',
    'provider_webhook_events','audit_logs'
  )
order by tablename, policyname;
```

Expected: no sensitive table has broad `using (true)` or unauthenticated broad access.

### Storage Buckets

```sql
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id in (
  'documents','child-photos','profile-photos','pickup-person-photos',
  'kindergarten-logos','incident-photos','inspection-reports','gallery'
)
order by id;
```

Expected:

- sensitive buckets `public = false`
- only intentionally public assets may be public
- no child documents, medical documents, incident evidence, or inspection evidence in public buckets

### Service Role Exposure Search

In the codebase and deployed env, confirm:

- `SUPABASE_SERVICE_ROLE_KEY` exists only as server-side env.
- it is never exposed as `NEXT_PUBLIC_*`.
- browser bundle/config does not contain the service role key.

## Required Role Tests

Record every result as PASS/FAIL with screenshot or query output.

### Parent A

Expected allow:

- own profile
- Child A
- Child A enrollment/request
- approved parent-facing messages/summaries

Expected deny:

- Parent B profile
- Child B
- all children in Kindergarten A
- all children in Kindergarten B
- staff private documents
- internal inspection defects/evidence
- platform subscription records
- provider webhook events
- raw AI events
- camera credentials
- signed URL for Child B document

### Staff Unassigned

Expected deny:

- children
- parents
- internal garden records
- attendance
- sensitive documents
- payments/provider
- camera/AI internals

### Staff Assigned A

Expected allow:

- own profile
- assigned Kindergarten A work context
- own shifts/tasks/messages

Expected deny:

- Kindergarten B
- unrelated children
- parent private data unless explicitly allowed
- provider/payment records
- raw AI/camera credentials

### Manager A

Expected allow:

- own profile
- Kindergarten A
- Kindergarten A children/staff/enrollment/attendance/documents/subscription status

Expected deny:

- Kindergarten B
- Child B
- Parent B unrelated private data
- Staff B
- provider webhook events
- admin-only audit logs
- raw camera credentials
- AI provider secrets
- Digital Observer unrelated data

### Inspector Unassigned

Expected deny:

- all garden internals
- children/parents/staff
- inspections/evidence
- cameras/AI
- payments/provider

### Inspector Assigned A

Expected allow:

- Kindergarten A assigned inspection context
- inspection forms/reports/evidence according to policy

Expected deny:

- Kindergarten B
- payments/provider
- raw camera credentials
- raw AI provider data
- unrelated audit logs

### Admin

Expected allow:

- operational platform data

Expected restrictions:

- no raw secrets in UI/API
- signed URLs are still scoped/short-lived
- admin actions audited where possible

## Pass/Fail Recording Template

| Test ID | User | Query/action | Expected | Actual | PASS/FAIL | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| PARENT-001 | parent_a_test | select Child A | allow |  |  |  |
| PARENT-002 | parent_a_test | select Child B | deny/zero rows |  |  |  |

## Cleanup

After test completion, remove synthetic users/data from the pilot/staging project unless retained for repeatable security QA.

