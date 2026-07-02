# PILOT FIX 5 - Messaging / Notification Flow Validation

Date: 2026-07-03

## Routes And APIs Reviewed

- `/dashboard/parent/messages`
- `/dashboard/garden/messages`
- `/dashboard/staff/messages`
- `/dashboard/parent/notifications`
- `/dashboard/garden/notifications`
- `/dashboard/staff/notifications`
- `/dashboard/inspector/notifications`
- `/dashboard/admin/notifications`
- `/api/messages`
- `/api/parent/messages`
- `/api/garden/communication`
- `/api/notifications`
- `/api/notifications/mark-read`
- `/api/admin/communications/test`
- `lib/domain/communication-service.ts`
- `lib/domain/notification-template-registry.ts`

## Result

| Check | Result | Notes |
|---|---|---|
| In-app message routes build | PASS | role routes exist |
| Notification APIs build | PASS | recipient filtering patterns exist |
| Template registry includes pilot events | PASS | manager approved, subscription required, enrollment, staff, inspector, payment, invoice |
| External email/SMS/WhatsApp/push | READINESS_ONLY | provider adapters default to mock/dry-run patterns unless configured |
| No production broadcast | STATIC_PASS | no broadcast run was triggered |

## Required Manual Tests

- Parent A -> Manager A message stays in Garden A.
- Staff Assigned A -> Manager A message stays in Garden A.
- Inspector Assigned A notification does not reach Inspector Unassigned.
- Enrollment approval/rejection notification reaches Parent A only.
- Payment/demo/freeze notification contains no sensitive child data.
- External providers remain sandbox/mock/readiness.

## Status

Messaging/notification flow status: **READY_FOR_SYNTHETIC_E2E**

External notification status: **PROVIDER_READINESS_ONLY**
