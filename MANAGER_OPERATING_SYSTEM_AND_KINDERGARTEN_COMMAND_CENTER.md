# Manager Operating System & Kindergarten Command Center

## Command Center Architecture

The manager homepage is now `/dashboard/garden/command-center`.

`/dashboard/garden` redirects there, reducing duplicate dashboard surfaces and making the command center the primary operating workspace.

The command center is organized around:

- Daily focus
- Kindergarten health score
- One-tap operations
- Smart alerts
- Unified work queue
- Garden timeline
- Opening and closing checklists
- Operational widgets
- Explainable health components

The goal is that a manager can understand the garden state in a few seconds and act without jumping across many screens.

## Widget Architecture

The command center includes focused widgets for:

- Children
- Staff
- Parent communication
- Compliance
- Inspections
- Finance
- Cameras
- Digital Observer
- Reports

Each widget shows a short status, one meaningful count, and one primary action. Details stay in the existing specialist screens.

## AI Assistant Architecture

The assistant remains advisory.

It can suggest:

- Send daily child updates.
- Review parent messages.
- Check expiring documents.
- Prepare for inspection.
- Review unavailable cameras.

It must not:

- Make automatic decisions.
- Assign blame.
- Trigger disciplinary actions.
- Expose raw observer signals to parents.

The assistant uses existing command-center signals and links the manager to the correct action screen.

## Health Score Model

The Kindergarten Health Score is explainable and uses:

- Attendance completion
- Compliance readiness
- Inspection readiness
- Incident readiness
- Communication readiness
- Observer/camera readiness

The current implementation uses `buildOperationalHealthScore` in `lib/domain/kindergarten-operating-system.ts` and prefers the latest saved score from `kindergarten_operational_health_scores` when available.

Scores are shown with components so managers understand why the score changed.

## Workflow Integration

The command center integrates:

- `daily_operations`
- `kindergarten_operational_health_scores`
- `operational_workflow_events`
- `tasks`
- `documents`
- `required_inspections`
- `incident_reports`
- `complaints`
- `parent_child_requests`
- `camera_streams`
- `observer_intelligence_signals`
- `prevention_recommendation_actions`

PHASE 130 adds:

- `manager_command_center_events`
- `manager_daily_checklist_status`

These tables prepare manager analytics and daily checklist persistence without replacing the task system.

## Screen Reduction

Primary manager surfaces are now intended to be:

- Command Center
- Children
- Staff
- Parents
- Cameras
- Compliance
- Inspections
- Settings

Other existing pages remain available, but the command center now acts as the operating hub.

## Remaining Gaps

- Checklist items are currently displayed from live data; completion persistence is prepared but not yet wired to interactive check buttons.
- Manager analytics events are ready in schema but not yet emitted from every command-center click.
- Smart alert priority is deterministic; future iterations can include response-time and engagement trends.
- Screen reduction still needs navigation cleanup in the sidebar so secondary pages are grouped behind the primary manager surfaces.
