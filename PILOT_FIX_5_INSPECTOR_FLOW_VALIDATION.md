# PILOT FIX 5 - Inspector Flow Validation

Date: 2026-07-03

## Routes And APIs Reviewed

- `/join-inspector`
- `/dashboard/inspector/apply`
- `/dashboard/inspector`
- `/dashboard/inspector/control-center`
- `/dashboard/inspector/inspections`
- `/dashboard/inspector/inspections/due`
- `/dashboard/inspector/inspections/history`
- `/dashboard/inspector/reports`
- `/dashboard/inspector/violations`
- `/dashboard/inspector/cameras`
- `/dashboard/inspector/ai-events`
- `/api/inspector/applications`
- `/api/inspectors`
- `/api/inspections`
- `/api/inspections/[id]/submit`
- `/api/inspections/[id]/report`
- `/api/violations/[id]/status`

## Positive Flow Expectations

| Flow | Status | Notes |
|---|---|---|
| Inspector registers | READY_BY_ROUTE | synthetic account required |
| Pending/unassigned state | READY_BY_ROUTE | apply route exists |
| Admin approval | MANUAL_REQUIRED | synthetic application required |
| Assignment to Kindergarten A | MANUAL_REQUIRED | admin fixture required |
| View assigned garden only | MANUAL_REQUIRED | core RLS/access test |
| Start/fill inspection | MANUAL_REQUIRED | inspection form fixture required |
| Upload evidence | MANUAL_REQUIRED | storage/signed URL verification required |
| Findings/follow-up/report | MANUAL_REQUIRED | synthetic report fixture required |

## Negative Boundaries

| Boundary | Expected | Current result |
|---|---|---|
| Unassigned inspector cannot see gardens | deny | MANUAL_REQUIRED |
| Inspector Assigned A cannot see Kindergarten B | deny | MANUAL_REQUIRED |
| Inspector cannot see provider/payment records | deny | MANUAL_REQUIRED |
| Inspector cannot see raw camera credentials | deny | MANUAL_REQUIRED |
| Inspector cannot see raw AI provider secrets | deny | MANUAL_REQUIRED |

## Status

Inspector flow status: **READY_FOR_SYNTHETIC_E2E**

Real inspector workflow remains blocked until assigned-garden scope is verified manually.
