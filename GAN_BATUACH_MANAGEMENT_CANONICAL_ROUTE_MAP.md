# Gan Batuach Management Canonical Route Map

Date: 2026-09-23

## Owner / Manager

- Home: `/dashboard/garden/operations` (`/dashboard/garden` redirects here)
- Children and enrollment: `/dashboard/garden/children`, `/dashboard/garden/enrollment-requests`
- Classrooms and attendance: `/dashboard/garden/attendance`, Classroom actions through canonical Children/Staff flows
- Staff: `/dashboard/garden/staff`, `/dashboard/garden/staff-applications`, `/dashboard/garden/staff-time`
- Communication: `/dashboard/garden/messages`, `/dashboard/garden/notifications`; provider operations remain at `/dashboard/garden/communication`
- Finance: `/dashboard/garden/finance`, `/dashboard/garden/tuition-ledger`, `/dashboard/garden/subscription`
- Documents: `/dashboard/garden/documents`
- Tasks/complaints: `/dashboard/garden/tasks`, complaint operations through the canonical case surface
- Inspections/corrections/reports: `/dashboard/garden/inspections`, `/dashboard/garden/corrective-actions`, `/dashboard/garden/reports`
- Pickup: `/dashboard/garden/pickup`
- Safety/settings: `/dashboard/garden/cameras`, `/dashboard/garden/trust-center`, `/dashboard/garden/settings`

## Owner as Teacher / delegated Teacher

Uses the Garden operational shell and the same Garden-scoped routes. Delegated Teacher permissions omit Owner finance, subscription, wage and membership administration. The active Garden selector is presentation context only.

## Parent

- Home/day: `/dashboard/parent`, `/dashboard/parent/family-home`
- Child detail/timeline: `/dashboard/parent/children/[id]`, `/dashboard/parent/children/[id]/timeline`
- Discovery/enrollment: `/dashboard/parent/discover-kindergartens`
- Messages/notifications: `/dashboard/parent/messages`, `/dashboard/parent/notifications`
- Tuition/documents: `/dashboard/parent/payments`, `/dashboard/parent/documents`
- Attendance/pickup/schedule: `/dashboard/parent/schedule`, `/dashboard/parent/pickup`
- Complaints/inspections/trust/reports: `/dashboard/parent/complaints`, `/dashboard/parent/inspections`, `/dashboard/parent/trust-center`, `/dashboard/parent/reports`
- Settings: `/dashboard/parent/settings`

## Staff

- Home/operations: `/dashboard/staff`, `/dashboard/staff/operations`
- Candidate-only: `/dashboard/staff/job-market`, `/dashboard/staff/access-pending`
- Attendance/shifts: `/dashboard/staff/attendance`, `/dashboard/staff/shifts`
- Children/journals: `/dashboard/staff/child-journal`, `/dashboard/staff/daily-journal`
- Tasks/messages/notifications: `/dashboard/staff/tasks`, `/dashboard/staff/messages`, `/dashboard/staff/notifications`
- Documents/reports/settings: `/dashboard/staff/documents`, `/dashboard/staff/reports`, `/dashboard/staff/settings`

## Inspector

- Home/field work: `/dashboard/inspector`, `/dashboard/inspector/command-center`, `/dashboard/inspector/control-center`
- Inspections: `/dashboard/inspector/inspections`, `/dashboard/inspector/inspections/due`, `/dashboard/inspector/inspections/history`
- Findings/corrections: `/dashboard/inspector/violations`
- Assigned Gardens/bootstrap: `/dashboard/inspector/preliminary-gardens`
- Tasks/reports/ratings: `/dashboard/inspector/tasks`, `/dashboard/inspector/reports`, `/dashboard/inspector/ratings`
- Notifications/settings: `/dashboard/inspector/notifications`, `/dashboard/inspector/settings`

## Platform Admin

- Home: `/dashboard/admin`
- Gardens: `/dashboard/admin/kindergartens`; details remain `/dashboard/admin/gardens/[id]`
- Users/roles: `/dashboard/admin/users`, `/dashboard/admin/inspectors`, `/dashboard/admin/inspector-applications`
- Subscriptions: `/dashboard/admin/subscriptions`
- Complaints/escalations: `/dashboard/admin/complaints`
- Providers/system: `/dashboard/admin/provider-production`, `/dashboard/admin/system-health`
- Reports: `/dashboard/admin/reports`
- Audit/support: `/dashboard/admin/audit-logs`, `/dashboard/admin/security-center`
- Configuration: `/dashboard/admin/settings`, `/dashboard/admin/policies`, `/dashboard/admin/staffing-policies`

Readiness, pilot, launch, QA and Observer engineering pages are not canonical Platform Admin product navigation. They remain internal/QA compatibility until their unique controls and evidence are migrated.

## Compatibility redirects

| Old URL | Canonical destination | Context behavior |
|---|---|---|
| `/dashboard/garden` | `/dashboard/garden/operations` | Existing fixed redirect |
| `/dashboard/garden/inspection-status` | `/dashboard/garden/inspections` | No Garden/ID forwarding |
| `/dashboard/garden/pickup-face` | `/dashboard/garden/pickup` | No face result/ID forwarding |
| `/dashboard/parent/trust` | `/dashboard/parent/trust-center` | No Child/Garden/ID forwarding |

All destinations re-authorize. A redirect conveys no role, Garden, Child, Staff or Inspector authority.
