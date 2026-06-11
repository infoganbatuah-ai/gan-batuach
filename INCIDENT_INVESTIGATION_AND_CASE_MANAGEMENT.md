# Incident Investigation And Case Management

PHASE 113 adds a case-management layer for incidents, complaints, observer alerts and evidence. The goal is full documentation and review, not automatic judgment.

## Safety Rules

The incident center must follow these rules:

- no automatic conclusions
- no automatic blame assignment
- no disciplinary decision without human review
- no raw internal evidence exposed to parents
- no observer event treated as proof without review

## Case Lifecycle

Cases use this lifecycle:

- `reported`
- `under_review`
- `investigating`
- `evidence_collection`
- `pending_decision`
- `resolved`
- `closed`

Each lifecycle change should be written to `incident_case_timeline`.

## Case Model

Main table: `incident_cases`.

Core fields:

- case number
- incident type
- severity
- status
- kindergarten
- child reference when relevant
- assigned inspector
- assigned reviewer
- source type and source id
- created by
- reviewed by
- closed by
- closed at
- parent visible status
- reviewed AI summary

Supported incident categories:

- injury
- safety concern
- complaint
- pickup incident
- health incident
- observer alert
- camera incident
- staff incident
- compliance incident

## Evidence Workflow

Evidence table: `incident_case_evidence`.

Supported evidence types:

- photos
- documents
- videos
- camera clips
- camera snapshots
- observer events
- inspection reports
- witness notes
- timeline notes

Evidence is internal by default. A parent-safe update must be explicitly reviewed and approved before it appears outside the investigation workspace.

## Investigation Timeline

Timeline table: `incident_case_timeline`.

Timeline events include:

- case created
- status changed
- evidence added
- review completed
- inspection performed
- decision recorded
- correction assigned
- correction completed
- case closed
- parent update approved

The timeline is the source for PDF-ready investigation and closure reports.

## Corrective Actions

Corrective action table: `incident_case_corrective_actions`.

Actions track:

- action title
- description
- severity
- status
- responsible party
- due date
- completion date
- verification date
- evidence requirement

Actions are not punishment. They are operational remediation steps that require verification.

## Complaint Integration

Parent, staff and inspection complaints can seed incident cases. Parents may see their own complaint status and approved updates, but not internal notes, raw evidence, reviewer discussion or unreviewed recommendations.

## Observer Integration

Observer signals may be linked as evidence or recommendations. They do not create conclusions. A reviewer must decide whether the signal is relevant, dismissed, or needs follow-up.

## Camera Evidence

Camera clips, snapshots and playback references can be linked as evidence. RTSP URLs, camera credentials and gateway secrets must never be stored in case evidence or exposed in the browser.

## Escalation Workflow

Recommended escalation path:

1. Case is reported.
2. Reviewer checks source details.
3. Evidence is collected.
4. Inspector or admin reviews timeline.
5. Corrective action is assigned if needed.
6. Human reviewer records decision.
7. Parent-safe update is approved when relevant.
8. Case is resolved or closed.

## Audit Requirements

The system must track:

- who created the case
- who reviewed the case
- who uploaded evidence
- who changed status
- who assigned corrective action
- who verified completion
- who closed the case

## Reporting

Reports should be generated from:

- case profile
- evidence summary
- timeline
- corrective actions
- closure summary

AI may summarize evidence and timeline, but it must not assign blame or make a final decision.

## Remaining Work

- add dedicated case detail pages
- add server actions for status changes and evidence upload
- add PDF generation for case reports
- add inspector-specific case queue
- add parent-safe update approval workflow
