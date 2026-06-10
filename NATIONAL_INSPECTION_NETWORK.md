# National Inspection Network

## Goal

Turn Gan Batuach into a national inspection, supervision and compliance network built on top of the existing inspection infrastructure.

This phase does not remove or replace current inspection functionality. Existing tables such as `inspections`, `required_inspections`, `late_inspections`, `violations`, `complaints` and `ai_events` remain active.

## Dashboard Added

Added:

- `/dashboard/admin/national-inspections`

The dashboard shows:

- Total inspections
- Monthly completed inspections
- Overdue inspections
- Upcoming inspections
- Active inspectors
- Inspection completion rate
- Unresolved findings
- Complaint escalation pressure
- Observer inspection recommendations
- Inspector workload
- Regional/city risk
- High-risk kindergartens

The main admin dashboard links to this center through the new national inspection action.

## Assignment Model

Existing operational assignment remains:

- `gardens.inspector_id`

New assignment history is tracked in:

- `inspector_assignment_history`

Supported assignment scopes:

- Kindergarten
- Region
- Municipality
- City
- Country

Supported assignment types:

- Primary
- Temporary
- Backup
- Follow-up
- Complaint response

This creates an audit trail without breaking current assignment logic.

## Regional Structure

New table:

- `inspection_regions`

Prepared hierarchy:

Country -> Region -> Municipality -> City -> Kindergarten

The migration seeds city-level region records from existing kindergartens. This is a starting point for future national expansion, not a legal geography registry.

## Inspection Lifecycle

Existing inspection execution remains in:

- `required_inspections`
- `inspections`
- `inspection_answers`
- `inspection_signatures`
- `violations`

New planning layer:

- `national_inspection_plans`

Supported plan types:

- Monthly inspection
- Surprise inspection
- Follow-up inspection
- Complaint-driven inspection
- AI-triggered inspection
- Verification inspection

Supported plan statuses:

- Planned
- Assigned
- In progress
- Completed
- Cancelled
- Overdue

## Compliance Workflow

New table:

- `national_compliance_findings`

It can link to:

- Inspection
- Violation
- Complaint
- AI event

Finding statuses:

- Open
- In progress
- Resolved
- Verified

The migration backfills findings from existing `violations` so current compliance work appears in the national layer.

## Follow-Up Workflow

New table:

- `inspection_follow_up_actions`

Supported action types:

- Corrective action request
- Verification inspection
- Closure verification
- Information request

This creates a full lifecycle from finding -> correction -> verification -> closure.

## Complaint Escalation Workflow

New table:

- `complaint_inspection_escalations`

Supported escalation types:

- Review
- Request information
- Schedule inspection
- Urgent escalation

This links parent complaints to inspection workflows without changing the existing complaint table.

## Observer Integration

New table:

- `observer_inspection_recommendations`

Digital Observer events can create inspection recommendations, but they do not trigger autonomous action.

Important rule:

Human review is mandatory before inspection scheduling, escalation or any operational decision.

## Risk-Based Inspection Engine

The admin dashboard computes a risk score per kindergarten from:

- Complaints
- Unresolved findings
- Observer recommendations
- Overdue inspections
- Last compliance score

High-risk kindergartens are shown first in the national dashboard.

## Inspector Workload

The dashboard tracks:

- Assigned kindergartens
- Open inspections
- Overdue inspections
- Completed inspections
- Average score where available

Overload signal:

- 12 or more open inspections
- Or 3 or more overdue inspections

## National Safety Analytics

The dashboard shows:

- Risk by city
- High-risk kindergartens
- Open findings
- Active complaints
- Observer inspection recommendations
- Completion and overdue trends

## Mobile / Field Readiness

Existing inspector screens already support:

- Field inspection forms
- GPS validation
- Photos
- Digital signatures
- Inspection report generation

Remaining field-readiness work:

- Offline inspection draft mode
- Better tablet-first inspection form layout
- GPS validation confidence display
- Photo upload progress and retry UX

## Remaining Gaps

- Assignment write UI is not yet a full drag-and-drop scheduler
- Calendar planning exists as a data model and dashboard view, but not as a rich calendar editor
- Regional hierarchy is readiness-level and needs operational definitions
- Observer recommendations are readiness-only and require human review
- Complaint escalation data model exists; workflow actions should be expanded in future screens
- External/legal compliance review is still required before national rollout

## Verification

Required checks for this phase:

- `npm run typecheck`
- `npm run build`

No push should be performed.
