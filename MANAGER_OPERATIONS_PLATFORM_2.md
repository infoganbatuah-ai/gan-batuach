# Manager Operations Platform 2.0

## Purpose

The manager platform gives the kindergarten manager one operational command center for the whole kindergarten.

Primary route:

`/dashboard/garden/command-center`

The goal is to understand the current situation within seconds and move directly to the right workflow.

## Command Center Model

The command center unifies:

- Daily operations
- Children
- Staff
- Compliance
- Inspections
- Observer and cameras
- Communication
- Finances
- Safety

It does not replace the existing modules. It creates one management layer above them.

## Daily Operations Overview

The command center shows:

- Children present
- Children absent
- Children missing attendance
- Staff currently in shift
- Staff absent or not checked in
- Open tasks
- Unresolved incidents
- Open complaints
- Compliance issues
- Observer alerts

## Operational Health Score

The command center uses the existing `kindergarten_operational_health_scores` foundation and live recalculation from operational data.

Factors:

- Attendance
- Compliance
- Incidents
- Communication
- Inspections
- Observer readiness

The score is explainable and shown by component. It is not a black-box score.

## AI Manager Assistant 2.0

The assistant entry points support:

- What requires attention today?
- Which children need follow-up?
- Which staff members are missing updates?
- Which documents are expiring?
- What inspections are pending?

Answers should remain short, operational and based only on manager-visible data.

## Staff Control Center

The manager sees:

- Active staff
- Staff not in shift
- Approval gaps
- Background/police clearance gaps
- Task completion signals

This is operational visibility only. It is not a public ranking system.

## Child Operations Center

The manager sees:

- Attendance
- Missing child updates
- Health notes
- Allergy alerts
- Incidents
- Parent requests

Quick actions link to the existing children, attendance and child journal modules.

## Unified Task Center

The command center aggregates:

- Tasks
- Operational workflow events
- Compliance corrective actions
- Prevention recommendations

Each item links back to the source module for the real workflow.

## Compliance Command Center

Compliance visibility includes:

- Expiring documents
- Missing/rejected documents
- Open findings
- Corrective actions
- Inspection readiness

## Inspection Readiness

The manager sees:

- Next inspection date
- Open findings
- Last inspection score
- Compliance readiness

## Communication Center

Communication visibility includes:

- Unread parent messages
- Staff messages
- Notices
- Complaints

Deep communication remains in the existing communication modules.

## Observer And Camera Center

The manager sees:

- Camera issues
- Observer alerts
- Unresolved signals
- Human-review-required recommendations

Language stays manager-friendly. No raw technical stream details are shown in the command center.

## Financial Overview

The manager sees:

- Expected payments
- Received payments
- Overdue payment count
- Link to the finance center

The command center avoids accounting complexity.

## Reporting Center

The command center prepares links for:

- Daily report
- Weekly report
- Monthly report

Reports should summarize children, staff, compliance, incidents and safety.

## Remaining Work

- Dedicated daily/weekly/monthly report generation UI
- Better staff update completion from staff-specific action logs
- Richer payment collection state from finance history
- Full mobile QA on tablet and 360/390/414px phones
- Stronger assistant answers when the AI assistant context engine is expanded
