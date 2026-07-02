# PILOT FIX 5 - Staff Flow Validation

Date: 2026-07-03

## Routes And APIs Reviewed

- `/app/register/staff`
- `/onboarding/staff`
- `/dashboard/staff`
- `/dashboard/staff/job-market`
- `/dashboard/staff/attendance`
- `/dashboard/staff/shifts`
- `/dashboard/staff/tasks`
- `/dashboard/staff/messages`
- `/dashboard/staff/documents`
- `/dashboard/staff/cameras`
- `/api/staff/job-applications`
- `/api/garden/staff-applications/[id]`
- `/api/garden/staff/[id]/approve`
- `/api/staff/gps-attendance`
- `/api/staff/shifts`
- `/api/staff/certificates`

## Positive Flow Expectations

| Flow | Status | Notes |
|---|---|---|
| Staff registers | READY_BY_ROUTE | synthetic account required |
| Unassigned/pending state | READY_BY_ROUTE | dashboard handles no garden assignment |
| Apply to/receive invitation | PARTIAL | fixtures required |
| Manager approval | MANUAL_REQUIRED | Manager A can approve Staff A only |
| Assigned dashboard | MANUAL_REQUIRED | requires staff.garden_id=A |
| Attendance/shifts/tasks/messages | MANUAL_REQUIRED | scoped Garden A data |
| Documents | MANUAL_REQUIRED | private storage policy test required |

## Negative Boundaries

| Boundary | Expected | Current result |
|---|---|---|
| Unassigned staff cannot see children | deny | MANUAL_REQUIRED |
| Unassigned staff cannot see parent records | deny | MANUAL_REQUIRED |
| Assigned Staff A cannot see Kindergarten B | deny | MANUAL_REQUIRED |
| Staff cannot see provider/payment records | deny | MANUAL_REQUIRED |
| Staff cannot see raw camera/AI internals | deny | MANUAL_REQUIRED |

## Status

Staff flow status: **READY_FOR_SYNTHETIC_E2E**

Real staff use remains limited until assignment boundaries are manually verified.
