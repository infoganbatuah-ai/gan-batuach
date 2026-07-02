# PILOT FIX 5 - Documents / Uploads Flow Validation

Date: 2026-07-03

## Routes And APIs Reviewed

- `/dashboard/parent/documents`
- `/dashboard/garden/documents`
- `/dashboard/staff/documents`
- `/dashboard/admin/documents`
- `/dashboard/admin/document-center`
- `/api/documents`
- `/api/documents/[id]/review`
- `/api/storage/upload`
- `/api/staff/certificates`
- `/api/children/[id]/photo`

## Result

| Check | Result | Notes |
|---|---|---|
| Document routes build | PASS | parent/garden/staff/admin surfaces exist |
| Review API has role scope | STATIC_PASS | admin/manager/owner review endpoint checks garden ownership for non-admin |
| Child photo API has ownership checks | STATIC_PASS | parent must match primary parent; manager/staff must match garden |
| Signed URL/storage runtime proof | MANUAL_REQUIRED | must be tested in Supabase storage |
| Sensitive docs public bucket check | MANUAL_REQUIRED | PILOT FIX 2 requires manual storage verification |

## Required Manual Tests

- Parent A can access only Child A document placeholders.
- Parent A cannot generate or open Child B document URL.
- Staff unassigned cannot access child/staff documents.
- Staff Assigned A sees only policy-allowed Garden A documents.
- Inspector Assigned A accesses inspection evidence only for Garden A.
- Signed URLs are short-lived and not public.

## Status

Document/upload flow status: **READY_FOR_SYNTHETIC_E2E_WITH_STORAGE_VERIFICATION_REQUIRED**
