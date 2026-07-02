# PILOT FIX 5 - Attendance / Schedule Flow Validation

Date: 2026-07-03

## Routes And APIs Reviewed

- `/dashboard/garden/attendance`
- `/dashboard/garden/operations`
- `/dashboard/garden/daily-journal`
- `/dashboard/staff/attendance`
- `/dashboard/staff/shifts`
- `/dashboard/staff/tasks`
- `/dashboard/parent/schedule`
- `/api/attendance`
- `/api/garden/attendance-action`
- `/api/parent/attendance`
- `/api/parent/schedule`
- `/api/staff/gps-attendance`
- `/api/staff/shifts`
- `/api/daily-operational-tasks`

## Expected Role Behavior

| Role | Expected access | Forbidden access | Status |
|---|---|---|---|
| Manager A | create/manage Garden A attendance/schedule | Garden B | MANUAL_REQUIRED |
| Staff Assigned A | assigned schedule/tasks and allowed attendance actions | unassigned child manipulation / Garden B | MANUAL_REQUIRED |
| Parent A | parent-facing schedule/attendance for Child A | staff attendance manipulation | MANUAL_REQUIRED |
| Inspector Assigned A | relevant inspection/safety context only | operational manipulation unless policy allows | MANUAL_REQUIRED |
| Admin | operational overview | secret exposure | PARTIAL |

## Status

Attendance/schedule flow status: **READY_FOR_SYNTHETIC_E2E**

Real pilot blocker: requires A/B data and RLS/manual browser validation.
