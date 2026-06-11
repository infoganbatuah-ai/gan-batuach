# Staff Operations Platform 2.0

## Purpose

The staff platform is designed for speed. Staff should spend time with children, not filling long forms.

The main staff workspace is:

`/dashboard/staff/operations`

## Attendance Workflow

The attendance flow is:

Arrival → GPS validation → automatic check-in

Departure → GPS validation → automatic check-out

The staff member uses one large action panel. The system records:

- Staff member
- Kindergarten
- Shift date
- Check-in time
- Check-out time
- GPS verification state

If the device is offline, the action is queued locally. When the connection returns, the sync process asks for fresh GPS before sending the attendance event.

## Shift Progress Workflow

The shift progress score combines:

- Child attendance completion
- Children updated
- Meals updated
- Sleep updated
- Tasks completed

This creates a simple “how much of my shift is done?” score for staff.

## Child Update Workflow

One-tap actions support:

- Arrived
- Meal completed
- Sleeping / awake-ready updates through journal flow
- Activity or mood update
- Bathroom / clothes note
- Health update
- Incident link

Quick updates use the existing child daily journal and attendance APIs.

## Child Attention Queue

The operations page automatically surfaces children who need attention:

- Missing attendance
- Missing daily update
- Allergy alert
- Medical note
- Regular medication
- Incident follow-up

This makes the next action obvious without searching.

## Incident Fast Mode

Incident reporting is linked from:

- Emergency center
- Child quick actions
- Attention queue

The target workflow is under 30 seconds:

1. Select child
2. Choose severity
3. Add short note
4. Add photo if needed
5. Submit

## Staff Task Center

The staff operations page summarizes:

- Assigned tasks
- Overdue tasks
- Completed tasks
- Manager notices

Detailed completion still happens in the existing staff task center.

## Communication Workflow

Staff can access:

- Manager messages
- Team messages
- Announcements
- Alerts

The operations page keeps unread notices visible without turning it into a noisy feed.

## AI Staff Assistant Workflow

The staff assistant entry points answer operational questions:

- Which children still need updates?
- What tasks remain?
- Any health alerts?
- Any urgent actions?

Answers must stay short and use only staff-visible kindergarten data.

## Emergency Mode

Emergency actions are always near the bottom of the operations page:

- Incident report
- Message manager
- Open alerts

These actions are large, mobile-friendly and require minimal typing.

## Offline Workflow

The offline queue stores local actions for:

- Attendance
- Child journal updates
- Child attendance updates
- Child operation updates

When the device reconnects:

1. Staff opens the offline panel.
2. Staff taps sync.
3. Attendance requests fresh GPS.
4. Valid actions are sent.
5. Failed actions remain in the local queue.

## Performance Insights Boundary

Performance insights are manager-visible only.

Tracked areas:

- Update completion
- Task completion
- Attendance consistency

No public ranking. No parent visibility. No staff comparison feed.

## Remaining Work

- True background sync service worker
- Offline photo upload queue
- Push reminder for unsynced actions
- Faster incident photo capture
- Native app-level GPS reliability testing
- Real device QA at 360px, 390px and 414px
