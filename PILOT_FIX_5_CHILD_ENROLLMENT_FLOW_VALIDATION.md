# PILOT FIX 5 - Child Enrollment Flow Validation

Date: 2026-07-03

## Routes And APIs Reviewed

- `/dashboard/parent/discover-kindergartens`
- `/api/parent/enrollment-requests`
- `/api/parent/child-requests`
- `/dashboard/garden/enrollment-requests`
- `/api/garden/enrollment-requests/[id]`
- `/api/garden/children/[id]/approve`
- `/api/garden/children/[id]/status`
- `/api/parent/child-transfer-requests`
- `/api/garden/child-transfer-requests/[id]`

## Lifecycle Matrix

| State | Expected owner | Expected result | Status |
|---|---|---|---|
| Parent created child | Parent A | Child A linked to Parent A | MANUAL_REQUIRED |
| Child unassigned | Parent A | no active kindergarten yet | MANUAL_REQUIRED |
| Enrollment request pending | Parent A + Manager A | Manager A sees request | MANUAL_REQUIRED |
| Manager approved | Manager A | Child A linked/active or pending payment according to rules | MANUAL_REQUIRED |
| Manager rejected | Manager A | Parent A sees rejected state; no active assignment | MANUAL_REQUIRED |
| Child active | Manager A + Parent A | parent-facing data available | MANUAL_REQUIRED |
| Child pending payment | Manager A + Parent A | payment readiness shown, no fake success | MANUAL_REQUIRED |
| Transfer blocked | Manager/parent | no silent cross-garden transfer | MANUAL_REQUIRED |
| Frozen/suspended garden | system/manager/admin | enrollment/payment/camera limited according to policy | MANUAL_REQUIRED |

## Required Negative Tests

- Parent B cannot see Child A enrollment request.
- Manager B cannot approve Child A for Kindergarten A.
- Manager A approval must not affect Kindergarten B.
- Transfer cannot bypass release/authorization rules.

## Status

Enrollment flow status: **READY_FOR_SYNTHETIC_E2E**

Real child enrollment remains blocked until RLS/legal/manual verification passes.
