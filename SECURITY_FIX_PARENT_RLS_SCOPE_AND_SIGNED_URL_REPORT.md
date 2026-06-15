# Security Fix - Parent RLS Scope And Signed URL Hardening

Date: 2026-06-16

Scope: fixes for QA 3 production-blocking findings:

1. Parent profiles could inherit broad garden-level access through `can_access_garden`.
2. Sensitive storage uploads/inspection signatures returned long-lived signed URLs.

No push was performed.

## Current Behavior Reviewed Before Changes

### Access Helpers

Reviewed helpers and policy usage:

- `public.current_role()`
- `public.current_garden_id()`
- `public.current_user_role()`
- `public.is_admin()`
- `public.can_access_garden(target_garden_id)`
- `public.can_parent_access_garden(target_garden_id)`
- Generic CRUD permission wrapper in `lib/crud-route.ts`
- Role permissions in `lib/roles.ts`
- Storage upload flow in `app/api/storage/upload/route.ts`
- Inspection signature upload flow in `app/api/inspections/[id]/submit/route.ts`

Before this fix, the latest `can_access_garden` returned true when an active profile had `garden_id = target_garden_id`, regardless of role. That meant an active parent linked to a kindergarten could satisfy RLS policies intended for whole-garden operational access.

## What Changed

### New Migration

Added:

- `supabase/migrations/20260616000100_parent_rls_scope_hardening.sql`

### Helper Functions Added Or Changed

Added:

- `public.can_manage_garden(garden_id uuid)`
- `public.can_staff_access_garden(garden_id uuid)`
- `public.can_inspector_access_garden(garden_id uuid)`
- `public.can_parent_access_child(child_id uuid)`
- `public.can_parent_access_child_file(child_file_id uuid)`
- `public.can_access_child_record(child_id uuid)`
- `public.can_access_sensitive_child_data(child_id uuid)`
- `public.can_parent_access_enrollment_request(request_id uuid)`
- `public.can_access_document(document_id uuid)`
- `public.can_access_payment_record(payment_id uuid)`

Changed:

- `public.can_access_garden(garden_id uuid)` is now operational garden access only. It no longer grants parent whole-kindergarten access.

### RLS Policies Hardened

Hardened policies for:

- `children`
- `parents`
- `staff`
- `documents`
- `child_daily_journals`
- `child_health_records`
- `medicine_given_logs`
- `medical_events`
- `incident_timeline`
- `child_timeline_events`
- `child_kindergarten_enrollments`
- `parent_kindergarten_links`
- `kindergarten_subscriptions`
- `subscription_payments`
- `billing_invoices`
- `billing_receipts`
- `child_payment_history`
- `attendance`
- `complaints`
- `pickup_confirmations`
- `ai_events`
- `camera_streams` JWT tenant read policy

## Parent Access After Fix

Parent access is now intended to be:

- Own profile and own parent record.
- Own child via `can_parent_access_child`.
- Own parent-owned child file via `can_parent_access_child_file`.
- Own enrollment/request records.
- Own child timeline, attendance, pickup and medical records only when tied to that child.
- Public-safe kindergarten discovery through existing public garden policies, not through sensitive child/table policies.
- Camera access only through the existing camera-specific parent policy and playback-token checks.

Parent access is no longer intended to include:

- Whole garden children list.
- Other child medical records.
- Other child documents.
- Staff records/documents.
- Gan Batuach subscription billing.
- Raw AI garden events.
- Internal inspection evidence merely because the parent is linked to a garden.

## Non-Parent Access After Fix

Admin:

- Still has platform-level access where policies allow `public.is_admin()`.

Manager/owner/network manager:

- Uses `can_manage_garden`.
- Retains operational access to own managed garden scope.

Staff:

- Uses `can_staff_access_garden`.
- Retains staff-scoped access to assigned garden where intended.

Inspector:

- Uses `can_inspector_access_garden`.
- Retains assigned-garden access where `gardens.inspector_id = profile.id`.

## Signed URL Changes

Changed:

- `app/api/storage/upload/route.ts`
- `app/api/inspections/[id]/submit/route.ts`

Previous behavior:

- General storage upload returned signed URLs valid for 30 days.
- Inspection signature upload returned signed URLs valid for 365 days.

New behavior:

- Sensitive storage signed URLs: 10 minutes.
- Kindergarten logo/gallery preview signed URLs: 15 minutes.
- Inspection report/signature evidence signed URLs: 10 minutes.

Audit:

- Storage upload audit now records `signed_url_ttl_seconds` without logging the signed URL.

## CRUD/API Review

The generic CRUD helper still relies on role permissions and RLS. This fix intentionally hardens RLS rather than adding ad-hoc route filters everywhere.

Routes that remain especially important for QA 3B regression:

- `app/api/children/route.ts`
- `app/api/child-health-records/route.ts`
- `app/api/parent/medical/route.ts`
- `app/api/parent/timeline/route.ts`
- `app/api/documents/route.ts`
- `app/api/garden/subscription/route.ts`
- `app/api/camera-streams/[id]/playback-token/route.ts`

## Regression Test Matrix

### Parent

- Parent A cannot see child B.
- Parent A cannot see child B medical records.
- Parent A cannot see child B documents.
- Parent A can see own child.
- Parent A can see own enrollment request.
- Parent A cannot see garden-wide children list.
- Parent A cannot see Gan Batuach subscription/payment records.
- Parent A can still use public-safe kindergarten discovery.
- Parent A can only access cameras through camera policy, MFA, child presence and playback token flow.

### Manager

- Manager can see own garden children.
- Manager cannot see another garden.
- Pending manager cannot see full active modules.
- Frozen/suspended manager limitations must be checked against business rules.

### Staff

- Unapproved staff cannot see children.
- Approved staff sees only assigned garden scope.
- Staff can see own staff profile/document where intended.
- Staff cannot see other staff/private docs unless manager policy permits.

### Inspector

- Pending inspector sees no gardens.
- Approved inspector sees assigned gardens only.
- Inspector cannot see unassigned gardens.

### Admin

- Admin platform access remains working.

### Unauthenticated

- No sensitive routes/data/documents are accessible.

## Signed URL Regression Tests

- Sensitive document URL expires after 10 minutes.
- Inspection evidence URL expires after 10 minutes.
- Logo/gallery preview URL expires after 15 minutes.
- No 30-day or 365-day `createSignedUrl` usage remains in app code.
- Unauthorized users cannot request signed URLs.
- Storage buckets remain private.
- No service-role key or storage secret is exposed to the client.

## Remaining Manual Review Items

1. Apply the migration to a local or staging Supabase database and introspect final policy state.
2. Run QA 3B with real users/fixtures for parent, manager, staff, inspector and admin.
3. Verify all dashboards still load after parent access is no longer garden-wide.
4. Verify storage URL expiry and document download experience with real Supabase Storage.
5. Review any older domain-specific tables not in this migration that still use `can_access_garden`; since `can_access_garden` now excludes parents, most are safer by default, but product-specific parent views may need explicit child/request-scoped policies.

## Accepted Limitations

- This fix does not introduce a full secure document download endpoint. It shortens signed URL lifetime and records signed URL TTL in upload audit metadata. A dedicated download endpoint with fresh authorization and access audit is still recommended.
- This fix does not change payment provider logic, camera gateway logic or AI provider logic.
- This fix does not perform live Supabase policy introspection because no local Supabase database was available in this thread.

## QA Recommendation

QA 3B Security Regression can begin after this fix.

Production should remain blocked until QA 3B confirms:

- Parent cannot access garden-wide sensitive data.
- Manager/staff/inspector/admin access did not regress.
- Short-lived signed URLs work in real storage flows.
