# PILOT FIX 5 - Parent Flow Validation

Date: 2026-07-03

## Routes And APIs Reviewed

- `/dashboard/parent`
- `/dashboard/parent/family-home`
- `/parent-onboarding`
- `/dashboard/parent/discover-kindergartens`
- `/dashboard/parent/children/[id]`
- `/dashboard/parent/schedule`
- `/dashboard/parent/messages`
- `/dashboard/parent/payments`
- `/dashboard/parent/cameras`
- `/dashboard/parent/ai-events`
- `/dashboard/parent/documents`
- `/api/parent/child-registration`
- `/api/parent/child-profiles`
- `/api/parent/enrollment-requests`
- `/api/parent/messages`
- `/api/parent/schedule`
- `/api/parent/cameras`

## Positive Flow Expectations

| Flow | Status | Notes |
|---|---|---|
| Register parent | READY_BY_ROUTE | no real account created |
| Create Child A profile | MANUAL_REQUIRED | synthetic only |
| Discover Kindergarten A | READY_BY_ROUTE | public directory routes build |
| Submit enrollment request | MANUAL_REQUIRED | requires Child A/Garden A |
| View request status | MANUAL_REQUIRED | requires request fixture |
| View approved child/kindergarten relationship | MANUAL_REQUIRED | requires manager approval |
| See schedule/messages/payment readiness/camera state | MANUAL_REQUIRED | parent-facing data only |
| Access legal/privacy/support links | READY_BY_ROUTE | legal docs created in PILOT FIX 3 |

## Negative Boundaries

| Boundary | Expected | Current result |
|---|---|---|
| Parent A cannot see Child B | deny | MANUAL_REQUIRED |
| Parent A cannot see Parent B profile | deny | MANUAL_REQUIRED |
| Parent A cannot list all children in Kindergarten A | deny | MANUAL_REQUIRED |
| Parent A cannot see staff private records | deny | MANUAL_REQUIRED |
| Parent A cannot see provider/platform payment data | deny | MANUAL_REQUIRED |
| Parent A cannot see raw AI events | deny | MANUAL_REQUIRED |
| Parent A cannot see camera credentials | deny | MANUAL_REQUIRED |
| Parent A cannot access unauthorized documents | deny | MANUAL_REQUIRED |

## Status

Parent flow status: **BLOCKED_FOR_REAL_PILOT / READY_FOR_SYNTHETIC_E2E**

No real parent or child data may be admitted yet.
