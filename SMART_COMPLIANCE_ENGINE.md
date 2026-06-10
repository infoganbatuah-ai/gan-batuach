# Smart Compliance Engine

## Goal

Move Gan Batuach from reactive compliance management to proactive monitoring of kindergarten readiness, legal obligations, certifications, inspections and corrective actions.

This phase builds on existing infrastructure:

- Inspections
- Documents
- Staff records
- Staff certificates
- Policies
- Procedures
- National compliance findings
- Corrective workflows

No existing inspection functionality is removed.

## Dashboards Added

Added:

- `/dashboard/admin/compliance-center`
- `/dashboard/garden/compliance`
- `/dashboard/inspector/compliance`

Admin sees national compliance.

Managers see only their kindergarten compliance.

Inspectors see compliance issues only for assigned kindergartens.

## Compliance Model

New tables:

- `compliance_requirements`
- `compliance_alerts`
- `compliance_score_snapshots`
- `compliance_corrective_actions`
- `compliance_report_requests`

Supported categories:

- Licenses
- Insurance
- Staff certifications
- First aid certifications
- Mandatory training
- Safety procedures
- Inspection requirements
- Legal documents

## Expiration Monitoring

The engine tracks:

- Expiration date
- Warning period
- Renewal status

Warning buckets:

- 90 days
- 60 days
- 30 days
- 14 days
- 7 days
- Expired

The migration backfills alerts from:

- `documents.expires_at`
- `staff_certificates.expires_at`

## Staff Compliance Engine

Staff readiness is based on:

- Approved to work
- Background check status
- Police clearance status
- Staff certificates
- Mandatory training readiness

Staff issues reduce the compliance score.

## Kindergarten Compliance Engine

Kindergarten readiness is based on:

- Active inspections
- Overdue inspection requirements
- Open findings
- Required policies
- Mandatory procedures
- Legal documents
- Insurance/license documents

## Compliance Score

The 0-100 score is calculated from:

- Documents
- Staff readiness
- Inspection readiness
- Findings and corrective actions
- Procedures and policies

The score is intentionally conservative. Missing data lowers confidence rather than being treated as fully compliant.

## Alert Model

Alerts are created for:

- Expiring certifications
- Expired documents
- Unresolved findings
- Missing or invalid requirements
- Procedure/policy gaps

Alert statuses:

- Open
- In progress
- Resolved
- Verified
- Dismissed

## Corrective Action Workflow

Lifecycle:

Issue identified
-> corrective action assigned
-> in progress
-> ready for verification
-> verified
-> closed

Corrective actions can link to:

- Compliance alert
- National finding
- Garden
- Assigned person
- Due date
- Verification actor

## AI Compliance Assistant Readiness

The UI prepares decision prompts such as:

- Which certifications expire this month?
- Which kindergartens are non-compliant?
- Which inspectors have unresolved findings?
- Which documents require renewal?

This phase does not add autonomous compliance decisions.

## Compliance Reporting

Reporting readiness table:

- `compliance_report_requests`

Supported report types:

- Monthly
- Annual
- Kindergarten
- Regional
- National

Full report generation can be connected later to the existing reports system.

## Remaining Gaps

- Missing-document detection still depends on a requirement-to-document mapping in future work
- Insurance/license classification depends on document type consistency
- Training completion needs a dedicated training record model
- Report generation is readiness-level, not full PDF/XLS automation
- Legal review is still required before treating compliance scores as official regulatory determinations

## Verification

Required checks:

- `npm run typecheck`
- `npm run build`

Do not push.
