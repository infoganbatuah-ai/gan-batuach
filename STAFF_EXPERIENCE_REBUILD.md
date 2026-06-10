# Staff Experience Rebuild

Date: 2026-06-11

Scope: PHASE UX-FINAL-4 staff mobile-first operational workspace.

## Goal

Make the staff experience fast, simple and mobile-first. Staff users are operators, so the interface prioritizes daily action over dashboards and analysis.

## Screens Changed

- `/dashboard/staff`
- `/dashboard/staff/attendance`
- `/dashboard/staff/child-journal`
- `/dashboard/staff/incidents`
- `/dashboard/staff/tasks`
- `/dashboard/staff/messages`
- Shared staff styling in `app/globals.css`

## Staff Home

The staff home now starts with:

- current shift status
- attendance state
- children requiring updates
- urgent alerts
- remaining tasks
- shift progress

The first screen answers:

> What do I need to do right now?

## GPS Attendance Readiness

The attendance screen now presents GPS attendance as a guided experience:

- checked in
- checked out
- waiting for check-in
- GPS permission required
- kindergarten location context

No new attendance backend was added. Existing GPS attendance flow remains in place.

## Shift Progress

The staff home now shows shift progress from existing daily journal data:

- children updated
- meals recorded
- sleep updates
- health/medicine updates
- incidents open

This is shown as a practical progress indicator for staff.

## Child Quick Updates

The existing one-hand child update mode is now positioned as a core staff workflow.

It supports fast child actions through existing quick update components:

- child update
- food/sleep/mood style updates
- incident path
- mobile-friendly child cards

## Child Attention Queue

The staff home now shows children requiring attention:

- no update today
- allergy alert
- health note
- medication note
- incident note

Each child links directly to the staff child journal with the child selected.

## AI Staff Assistant Foundation

The staff home now includes simple assistant-style prompts:

- who still needs an update?
- which tasks remain?
- who has health alerts?
- should I report an incident?

No new AI backend was added.

## Incident Reporting

The incident page copy was redesigned around fast reporting:

- child
- severity
- short text
- photo if needed

The existing incident manager stays in use.

## Staff Tasks

The staff tasks page now summarizes:

- open tasks
- overdue tasks
- completed tasks

The existing task workbench remains.

## Staff Communication

The messages page now frames communication as shift messages:

- manager messages
- team communication
- child-linked messages when needed

## Emergency Center

The staff home includes a persistent emergency action area:

- report incident
- message manager
- open notifications

## Remaining Staff UX Issues

- True automatic GPS attendance still depends on browser permissions and existing API behavior.
- Child quick actions depend on the existing `QuickChildOps` behavior and may need a dedicated touch QA pass.
- Health and medication flows are routed through current child journal/medicine data; a specialized medication micro-flow can be added later if needed.
- Browser QA at 360px, 390px and 414px still needs a live server or deployed environment.
