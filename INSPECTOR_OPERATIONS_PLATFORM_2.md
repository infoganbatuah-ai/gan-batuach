# Inspector Operations Platform 2.0

## Purpose

The inspector workspace now has a dedicated field command center:

`/dashboard/inspector/command-center`

It gives inspectors one place to manage inspections, complaints, observer signals, compliance issues, follow-up work and field readiness.

## Inspection Lifecycle

The command center supports the existing inspection flow without replacing it:

1. Identify due, overdue or recommended inspections.
2. Open the inspection workflow.
3. Verify arrival with GPS.
4. Start inspection.
5. Save progress.
6. Resume if needed.
7. Attach evidence.
8. Submit inspection.
9. Sign inspection.
10. Generate the full report.

The page links into the existing inspection and report routes rather than adding duplicate business logic.

## Calendar Model

The inspection calendar groups open inspection requirements into:

- monthly inspections
- surprise inspections
- follow-up inspections
- complaint-driven inspections
- observer-recommended inspections

Each group shows the current count and nearest due date.

## GPS Workflow

The field workflow highlights:

- arrival verification
- departure/inspection duration readiness
- GPS verified inspection count
- suspicious GPS count when completed inspections are not verified

GPS validation remains part of the existing inspection workflow and report metadata.

## Evidence Workflow

Evidence readiness is shown as a field step:

- photos
- documents
- notes
- observer evidence
- camera evidence

Evidence is attached through the existing inspection, violation, incident and report flows.

## Complaint Workflow

Inspectors see active complaints from assigned kindergartens only.

The workflow supports:

- review
- response
- request information
- escalation
- closure

The command center links to `/dashboard/inspector/reports`.

## Observer & Risk Workflow

Observer signals, high-risk kindergartens, camera issues and compliance actions are surfaced as recommendations for human review only.

No automatic accusations, enforcement or disciplinary decisions are created.

## Reporting Workflow

The platform already supports reports with:

- unique identifier
- barcode/verification metadata
- inspection summary
- questions and answers
- scoring
- findings
- photos/documents
- signatures
- GPS metadata

The command center exposes the readiness and routes to those reports.

## Mobile Field Readiness

The layout is optimized for phone and tablet:

- large action cards
- short labels
- compact priority queue
- single-column mobile fallback
- minimal typing
- clear next action

## Remaining Gaps

- Offline inspection drafts still need a durable local queue.
- Signature capture UX should be improved inside the inspection form itself.
- Evidence upload can be made faster with direct camera capture on mobile.
- Inspector performance analytics are surfaced as operational counts; deeper admin-only performance reporting can be expanded later.
