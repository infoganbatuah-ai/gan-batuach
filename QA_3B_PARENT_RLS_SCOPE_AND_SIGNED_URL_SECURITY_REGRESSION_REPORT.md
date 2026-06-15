# QA 3B - Parent RLS Scope And Signed URL Security Regression Report

Date: 2026-06-16

Scope: regression review of the QA 3 security fix for parent RLS scope and sensitive signed URL lifetime.

This QA is source/migration based. Supabase CLI/local database was not available in this workspace, so live policy execution and fixture-based role tests still require staging/local Supabase validation.

## Pre-QA Status

| Item | Result |
| --- | --- |
| Branch | `main` |
| Latest commit at start | `9e2d093 QA 3 – Security, Permissions, RLS & Sensitive Access QA` |
| Working tree | Existing uncommitted security-fix files present |
| Security fix report | `SECURITY_FIX_PARENT_RLS_SCOPE_AND_SIGNED_URL_REPORT.md` exists |
| QA 3 report | `QA_3_SECURITY_PERMISSIONS_RLS_REPORT.md` updated |
| RLS hardening migration | `supabase/migrations/20260616000100_parent_rls_scope_hardening.sql` exists |

## Build Baseline

| Check | Result |
| --- | --- |
| `npm run typecheck` | passed |
| `npm run build` | passed |
| `git diff --check` | passed |

## Parent Access Regression

Status: `requires_manual_review` for live DB execution, `passed` for source/migration intent.

Verified in migration:

- `can_access_garden` no longer grants access based on a parent `garden_id`.
- Parent access is now routed through `can_parent_access_child`, `can_parent_access_child_file`, `can_access_child_record`, `can_access_sensitive_child_data`, and record-specific checks.
- `children`, `child_health_records`, `medicine_given_logs`, `medical_events`, `child_daily_journals`, `child_timeline_events`, `documents`, `attendance`, `complaints`, `pickup_confirmations`, and `child_payment_history` now include child-specific parent checks instead of garden-wide parent access.
- Gan Batuach subscription tables now use admin/manager access, not parent garden membership.

Expected after migration:

- Parent A can access own child and own child-related records.
- Parent A cannot access child B by whole-garden membership.
- Parent A cannot access garden-wide children, medical notes, documents, diary/timeline, staff documents, subscription billing, raw AI events, or camera rows through garden-level RLS.

Remaining required test:

- Apply migration to Supabase staging/local DB and run direct select tests with Parent A and Parent B JWT sessions.

## Garden-Level Access Regression

Status: `passed` for source review, `requires_manual_review` for live role fixtures.

Reviewed helper behavior:

- `can_manage_garden`: admin, manager/owner for own garden, assigned network manager.
- `can_staff_access_garden`: manager/owner/admin plus active staff assigned to the garden.
- `can_inspector_access_garden`: admin plus active inspector assigned through `gardens.inspector_id`.
- `can_access_garden`: operational roles only via the helpers above.

Expected after migration:

- Parent with `garden_id` does not gain sensitive garden-wide access.
- Manager/owner keeps own garden access.
- Staff keeps assigned garden access.
- Inspector keeps assigned garden access.
- Admin keeps intended platform access.

## Enrollment Request Regression

Status: `passed` for source review, `requires_manual_review` for live RLS tests.

Existing policies from PHASE 190A remain in place:

- Parent reads own enrollment request through `parent_id = auth.uid()`.
- Parent insert requires ownership of the child profile.
- Manager reads/updates only requests for own accessible garden.
- Admin can view/manage all.

Server route review:

- `app/api/parent/enrollment-requests/route.ts` verifies the child profile belongs to the current parent before creating a request.
- `app/api/garden/enrollment-requests/[id]/route.ts` scopes manager action by `profile.garden_id`.

Remaining required test:

- Direct RLS select/update attempts as another parent and another manager.

## Document Signed URL Regression

Status: `passed` for source review, `requires_manual_review` for real storage behavior.

Actual configured durations:

- Sensitive storage upload signed URL: 10 minutes.
- Inspection evidence/signature signed URL: 10 minutes.
- Kindergarten logo/gallery preview signed URL: 15 minutes.

Verified:

- No app code path remains with a 30-day or 365-day `createSignedUrl` call.
- Upload audit records `signed_url_ttl_seconds` and does not store the signed URL itself.
- Buckets remain private in migration definitions.
- Upload route still requires authenticated user, role/bucket allowlist, MIME allowlist, size limit, and server-side service-role storage access.

Remaining limitation:

- A full secure document download endpoint with fresh authorization and per-download audit is still recommended. This QA only validates the signed URL lifetime reduction and current upload-time authorization.

## Manager / Staff / Inspector / Admin Regression

Status: `passed` for source review, `requires_manual_review` for live role fixtures.

Manager:

- Manager/owner garden-wide access is preserved through `can_manage_garden`.
- Own garden enrollment requests, children and documents should remain available.

Staff:

- Assigned staff access is preserved through `can_staff_access_garden`.
- Unapproved staff should remain blocked because helper requires active profile with role `staff` and matching `garden_id`.

Inspector:

- Assigned inspector access is preserved through `can_inspector_access_garden`.
- Pending inspector should remain blocked because helper requires active profile and matching `gardens.inspector_id`.

Admin:

- Admin access remains via `public.is_admin()`.

## Public Directory Regression

Status: `not_blocking`, `requires_manual_review`

The RLS hardening migration does not weaken public directory policies. Public-safe garden access continues to be governed by garden public profile policies and discovery routes. Sensitive tables are now less exposed to parent garden membership.

Need visual/API confirmation in next QA pass:

- Directory shows only garden name, city/general area, age groups, published prices and public summary.
- No private documents, medical data, child data, internal inspection details or private addresses appear.

## Findings

| Finding | Classification | Status |
| --- | --- | --- |
| Parent whole-garden access through `can_access_garden` | `still_blocking_until_staging_test` | Source fix present; needs live RLS validation |
| Sensitive signed URLs too long | `passed` | Reduced to 10/15 minutes in source |
| Manager/staff/inspector/admin regression risk | `requires_manual_review` | Source helpers preserve access; needs fixture tests |
| Secure document download endpoint absent | `requires_manual_review` | Not blocking this fix, recommended before production |
| Supabase local execution unavailable | `requires_manual_review` | Run migration/policy tests in staging/local Supabase |

## Production Status

Production remains blocked until:

1. The RLS hardening migration is applied to staging or local Supabase.
2. Direct RLS tests confirm Parent A cannot access Parent B/whole-garden sensitive records.
3. Manager/staff/inspector/admin fixture tests confirm no operational regression.
4. Storage tests confirm signed URLs expire at the configured short durations.

## QA 4 Recommendation

QA 4 can proceed in parallel for payments/providers/notifications, but not as a production approval. QA 3B live/staging validation must pass before launch readiness can be marked safe.
