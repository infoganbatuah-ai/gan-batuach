# Inspector Command Center, Monthly Supervision & Regulatory Operations Platform

## Purpose

PHASE 132 turns the inspector workspace into a regulatory supervision layer for assigned kindergartens. The inspector sees monthly inspection coverage, overdue inspections, complaints, observer signals, compliance risks, GPS validation and signed inspection records from one command center.

No automatic regulatory decisions are made. The system prioritizes, records and recommends. A human inspector, manager or admin must review and act.

## Main Route

- `/dashboard/inspector/control-center`
- Existing `/dashboard/inspector/command-center` remains available and powers the same operational experience.

## Monthly Inspection Model

Every assigned kindergarten receives a monthly cycle in `monthly_inspection_cycles`.

Tracked fields:

- `garden_id`
- `inspector_id`
- `cycle_month`
- `due_at`
- `completion_status`: `pending`, `completed`, `overdue`, `rescheduled`
- `readiness_status`: `pending`, `ready`, `needs_attention`, `blocked`
- linked `required_inspection_id`
- linked completed `inspection_id`

The migration includes `sync_monthly_inspection_cycles()` so the current month can be safely regenerated without duplicates.

## Alert Model

Inspection reminders are stored in `inspection_alert_events`.

Supported alert types:

- `due_14_days`
- `due_7_days`
- `due_3_days`
- `overdue`

Target recipients:

- inspector
- kindergarten manager / owner
- admin

The current implementation creates readiness records and queued alert events. Real provider delivery remains tied to the communication provider layer.

## Complaint Workflow

Inspector complaint activity is tracked in `complaint_regulatory_actions`.

Supported actions:

- review
- reply
- request additional information
- escalate
- close

This preserves complaint history and keeps parent-visible updates separate from internal investigation notes.

## Additional Inspection Requests

`inspection_additional_requests` supports:

- follow-up inspection
- surprise inspection
- urgent inspection
- complaint-driven inspection
- observer-recommended inspection

Statuses:

- requested
- approved
- scheduled
- completed
- rejected
- cancelled

Requests are recommendations or planned work items. They do not create enforcement decisions automatically.

## GPS Validation

`inspection_gps_validations` records:

- inspector coordinates
- kindergarten coordinates
- distance
- arrival/departure timestamps
- duration readiness
- validation result
- consistency status

The inspection submission route now records a GPS validation row and locks the regulatory report metadata after signature.

## Digital Inspection Forms

The field form supports:

- sections
- scoring
- notes
- photo evidence
- document evidence
- video evidence link
- progress tracking
- GPS-required submission
- digital signature

Video evidence is stored as an evidence link to avoid creating a fragmented storage system.

## Signed Report / PDF-Ready Record

The inspection report route includes:

- barcode-style verification block
- unique document number
- report metadata
- all questions and answers
- scores
- notes
- photo/document/video evidence links
- findings
- corrective actions
- GPS validation
- inspector signature
- document lock timestamp

The route returns HTML optimized for browser print/PDF.

## Findings & Corrective Actions

The platform connects inspection answers to:

- `violations`
- `national_compliance_findings`
- `inspection_follow_up_actions`
- task/corrective action workflows

Human verification is required before closure.

## Audit Trail

`regulatory_audit_events` stores append-only regulatory events for:

- submitted inspections
- complaint actions
- findings
- GPS validations
- document locking

Policies allow scoped reads and inserts, but no update/delete policy is created.

## Privacy & Safety Rules

- Inspectors see only assigned kindergarten data unless admin.
- Parents do not see raw observer signals or internal investigation notes.
- Observer and risk signals create recommendations only.
- No automatic accusations.
- No disciplinary decisions.
- No autonomous regulatory closure.

## Remaining Production Work

- Connect queued inspection alert events to the real communication delivery engine.
- Add a dedicated complaint detail screen for inspector replies and information requests.
- Convert the HTML inspection report into a generated PDF artifact if legal export requires a stored binary.
- Add offline queueing for inspection forms when field connectivity is poor.
- Add admin-only national inspector performance dashboards using `inspector_performance_metrics`.
