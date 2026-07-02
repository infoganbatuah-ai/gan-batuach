# PILOT FIX 5 - Kindergarten Manager Flow Validation

Date: 2026-07-03

## Routes And APIs Reviewed

- `/dashboard/garden`
- `/onboarding/kindergarten`
- `/dashboard/garden/onboarding`
- `/dashboard/garden/settings`
- `/dashboard/garden/children`
- `/dashboard/garden/children/[id]`
- `/dashboard/garden/enrollment-requests`
- `/dashboard/garden/attendance`
- `/dashboard/garden/messages`
- `/dashboard/garden/documents`
- `/dashboard/garden/staff`
- `/dashboard/garden/staff-applications`
- `/dashboard/garden/finance`
- `/dashboard/garden/subscription`
- `/dashboard/garden/cameras`
- `/dashboard/garden/ai-events`
- `/api/garden/manager-application`
- `/api/garden/enrollment-requests/[id]`
- `/api/garden/staff/[id]/approve`
- `/api/garden/fee-groups`
- `/api/garden/subscription`

## Positive Flow Expectations

| Flow | Status | Notes |
|---|---|---|
| Register as manager | READY_BY_ROUTE | route/API exists; account not created |
| Pending admin approval | MANUAL_REQUIRED | requires pending manager fixture |
| Approved manager onboarding | MANUAL_REQUIRED | requires manager profile + Garden A |
| Complete kindergarten card | MANUAL_REQUIRED | must verify Garden A only |
| Define city/classes/pricing | MANUAL_REQUIRED | fee group route exists |
| View subscription/demo/payment readiness | READY_BY_ROUTE | no live provider activated |
| Invite staff/parents | PARTIAL | mock/test provider mode only |
| Approve Parent A / Child A request | MANUAL_REQUIRED | requires enrollment fixture |
| Manage attendance/schedule/messages/docs | MANUAL_REQUIRED | route coverage exists, RLS proof needed |
| Camera/AI readiness | PARTIAL | no raw credential/live claim allowed |

## Negative Boundaries

| Boundary | Expected | Current result |
|---|---|---|
| Manager A cannot see Kindergarten B | deny | MANUAL_REQUIRED |
| Manager A cannot see Child B | deny | MANUAL_REQUIRED |
| Manager A cannot access provider webhook records | deny | STATIC_EXPECTED / MANUAL_REQUIRED |
| Manager A cannot access raw camera credentials | deny | MANUAL_REQUIRED |
| Manager A cannot enable parent camera viewing by default | deny | POLICY_REQUIRED |

## Status

Manager flow status: **READY_FOR_SYNTHETIC_E2E**

Real pilot blocker: cannot approve real manager/parent/child use until RLS/legal/environment gates are signed off.
