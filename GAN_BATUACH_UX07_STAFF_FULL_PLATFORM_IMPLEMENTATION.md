# GAN BATUACH UX-IMPLEMENT-07 — STAFF FULL PLATFORM

## Status

Implementation targets the canonical active-employment model and the approved `GB_UX_REF_STAFF_FULL_PLATFORM.png` visual language. Candidate discovery and application flows remain separate for UX-IMPLEMENT-08.

## Route map

| Capability | Route |
| --- | --- |
| Staff command center | `/dashboard/staff` |
| Own shifts and hours | `/dashboard/staff/shifts` |
| Clock in/out and time history | `/dashboard/staff/attendance` |
| Own profile/settings | `/dashboard/staff/settings` |
| Documents/certificates | `/dashboard/staff/documents`, `/dashboard/staff/certificates` |
| Tasks/messages/notifications | `/dashboard/staff/tasks`, `/dashboard/staff/messages`, `/dashboard/staff/notifications` |
| Scoped Child attendance | `/dashboard/staff/children-attendance` |
| Scoped pickup/release | `/dashboard/staff/pickup` |
| Policy-bound cameras | `/dashboard/staff/cameras` |
| Manager Staff directory/profile cards | `/dashboard/garden/staff` |
| Manager time and payroll-ready export | `/dashboard/garden/staff-time` |

## Component map

- `RoleAppShell`: responsive Staff navigation and shared authenticated shell.
- `StaffAppFrame`: active Garden selector and Staff page composition.
- `StaffAttendanceActions`: explicit clock actions plus optional automatic geofence monitoring.
- `StaffProfileCards`: Manager Staff directory, employment state, readiness and actions.
- `StaffTimeManagerActions` / `StaffTimeRateForm`: audited correction, approval and rate-history entry.
- Gan Batuach design system cards, metrics, chips, empty states and mobile navigation are reused across all routes.

## Staff state and employment mapping

Operational access resolves `staff_employments_for_current_user` and requires an active `staff_kindergarten_employments` record. Invited, pending, suspended and ended states remain distinct. Candidate pages do not inherit active operational access. Ended or suspended employment history remains in the canonical model while operational guards deny access.

## Multi-Garden behavior

`StaffGardenSelector` writes the canonical active-Garden context. Dashboard, Classroom/Child scope, shifts, hours, Tasks, messages and cameras derive from the selected active employment. No route uses a client-only Garden switch.

## Classroom and Child scope

Child access resolves active `staff_classroom_assignments`, then current `child_classroom_assignments`. Attendance and release operations reuse UX-06 canonical server flows. A Staff member receives no Garden-wide Child access merely from opening the UI.

## Shifts, time and hours

Clock actions call `/api/staff/gps-attendance`, which revalidates identity and employment and executes `staff_attendance_transition` with server time. Duplicate transitions and stale state remain server-controlled. Manager exports use `management_staff_time_export`. Missing clock-out is shown as action required. The UI explicitly describes the result as payroll-ready data, not statutory payroll.

## Role visibility matrix

| Surface | Staff | Owner/Manager | Candidate | Suspended/ended |
| --- | --- | --- | --- | --- |
| Own dashboard/profile | Own active employment | Directory/profile cards | Candidate-only handoff | Operational access denied |
| Shifts/time | Own Garden records | Garden Staff ledger | Hidden | History retained; actions denied |
| Children/attendance/pickup | Assigned Classrooms only | Garden scope by permission | Hidden | Denied |
| Rates/cost | Only when canonical permission allows | Authorized management view | Hidden | Denied |
| Cameras | `staff_view_allowed` plus verified playback readiness | Policy-specific management surface | Hidden | Denied |

## Responsive behavior

Desktop uses the deep-navy sidebar, airy light workspace, metrics, card/table hybrids and Staff profile composition. At 390×844, tables become cards, action controls remain at least touch size, the bottom navigation stays fixed to high-value destinations, and profile/time sections collapse to one column without horizontal overflow.

## Visual reference mapping

- Staff list, profile and employment chips follow the upper Staff reference panels.
- Manager schedule/time ledger follows the reference calendar and attendance-table density.
- Mobile profile, clock, shifts, documents, messages and settings follow the reference phone hierarchy.
- Royal blue primary actions, navy shell, soft blue surfaces, rounded cards and quiet shadows match the approved shared Gan Batuach system.

## QA evidence

- Focused contract: `npm run qa:ux07-focused`.
- Canonical Staff time role E2E: `node scripts/qa/run-management-staff-time-role-e2e.mjs`.
- Multi-Garden employment contract: `npm run qa:management-multi-garden-staff`.
- Visual evidence: `qa-evidence/ux-implement-07/` at 1440×1024 and 390×844.
- Full CI gates: typecheck/lint, build, domain, security/isolation, migration health and release contract.

## Deviations

- No new scheduling, payroll, leave or HR backend was created. Surfaces expose only canonical records.
- Camera Live state requires an online/connected camera, ready playback, a real gateway stream identifier and Staff policy access. Unverified states show `בדיקה נדרשת`.
- No paid dependency, provider, migration or Digital Observer core change is introduced.

## Feature completeness map

| Canonical active-Staff capability | Access surface |
| --- | --- |
| Dashboard, current shift, quick actions | Staff command center |
| Employment, role, Garden and Classroom | Staff profile; Manager Staff directory |
| Multi-Garden active context | Staff Garden selector |
| Schedule, clock and time history | Shifts; Attendance |
| Payroll-ready ledger and corrections | Manager Staff time |
| Documents and certificate expiry | Documents; Certificates |
| Tasks, messages and notifications | Dedicated canonical routes |
| Child attendance and pickup | UX-06 scoped routes |
| Safety and cameras | Staff cameras with policy/readiness gate |
| Profile, contact and security | Staff settings |
