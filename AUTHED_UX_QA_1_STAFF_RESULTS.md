# AUTHED UX QA 1 - Staff Results

## Result

`BLOCKED_BY_AUTH_ACCESS`

Staff dashboards were not accepted because safe authenticated Staff sessions were not established.

## Expected Scope

- Staff unassigned state
- Staff assigned dashboard
- Job/application state if available
- Attendance
- Shifts/tasks
- Messages
- Documents

## Blockers

- No verified unassigned staff session.
- No verified assigned staff session.
- No multi-role session switch completed.

## Pilot Impact

High for staff-included pilot. Not blocking a manager-only pilot by itself, but it blocks full authenticated role acceptance.

