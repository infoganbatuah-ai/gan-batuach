# Data Rights, Retention, Deletion & Right-To-Be-Forgotten Platform

Phase 156 creates Gan Batuach's privacy-rights and data lifecycle governance layer.

The platform must never blindly delete sensitive kindergarten, child, parent, medical, camera, AI, inspection or audit data. Every destructive or anonymizing action requires scope calculation, legal-hold review and admin approval.

## Privacy Request Lifecycle

Canonical table:

- `privacy_rights_requests`

Compatibility view:

- `privacy_requests`

Supported request types:

- `access`
- `correction`
- `deletion`
- `export`
- `restriction`
- `anonymization`

Supported statuses:

- `submitted`
- `under_review`
- `approved`
- `rejected`
- `processing`
- `completed`
- `blocked_by_legal_hold`

Workflow:

1. Request submitted by user.
2. Admin reviews the request.
3. Data subject scope is calculated.
4. Legal holds and retention conflicts are checked.
5. Admin approves, rejects or blocks by legal hold.
6. Execution action is prepared.
7. Audit log is written.
8. User is notified.

No automatic deletion is performed in this phase.

## Deletion Model

Deletion requests must check:

- active child enrollment
- outstanding payments
- active incident case
- active complaint
- legal hold
- inspection evidence
- audit requirement
- payment/accounting retention
- safety investigation retention

If deletion is allowed, execution actions may include:

- revoke account access
- revoke camera permissions
- revoke push tokens
- delete private documents where allowed
- delete medical data where allowed
- anonymize parent or child records
- preserve audit logs without sensitive content

Execution readiness table:

- `privacy_execution_actions`

## Anonymization Model

When direct deletion is unsafe, direct identifiers should be replaced with:

- `anonymized_subject_id`
- redacted name
- removed phone
- removed email
- removed ID number
- removed address

Audit integrity must be preserved.

AI and telemetry data should keep only UUID references or anonymous aggregates. No names, phone numbers, emails, ID numbers or medical text should be stored in telemetry tables.

## Legal Hold Model

Core table:

- `legal_holds`

Legal hold can block deletion for:

- active incident investigation
- inspection evidence
- safety complaint
- payment dispute
- legal dispute
- regulatory review
- audit preservation

Legal holds track:

- reason
- type
- creator
- start date
- end date
- release request
- release approval

## Retention Policy Registry

Core table:

- `data_retention_policies`

Categories:

- medical data
- child records
- attendance records
- pickup signatures
- inspection reports
- incident evidence
- complaints
- private documents
- invoices
- payment records
- audit logs
- AI telemetry
- skeleton telemetry
- camera access logs
- communications
- ephemeral context

Every policy stores:

- retention period
- deletion method
- anonymization method
- legal basis
- owner
- legal hold requirement
- evidence preservation requirement

Production retention periods still require final legal approval.

## Subject Scope Model

Helper:

- `lib/privacy/data-subject-scope.ts`

Purpose:

Given a user, child or garden context, identify related records across:

- profiles
- children
- parents
- staff
- attendance
- timeline
- health records
- pickup authorizations
- documents
- communications
- complaints
- incidents
- camera access logs
- observer signals
- skeleton telemetry
- payments
- immutable audit events

The helper returns categories, tables, estimated record counts and recommended actions.

No deletion or export should happen without scope.

## Export Rules

Export packages may include:

- profile data
- allowed child records
- attendance records
- approved timeline events
- messages where allowed
- document metadata
- payment records

Export packages must not include:

- other children
- raw AI events
- internal investigation drafts
- unrelated inspection evidence
- raw camera footage
- sensitive files without admin approval

## Signature Retention

Signature data includes:

- parent check-in signatures
- pickup signatures
- inspection signatures
- manager approvals

Signatures should be retained when required for identity, safety, audit or evidence purposes. Deletion requires legal hold and retention review.

## Camera & Observer Retention

Camera-related data:

- camera access logs
- playback sessions
- snapshots
- clips
- incident-linked evidence
- observer-linked evidence

Gan Batuach should not expose direct camera URLs or raw AI signals to privacy exports.

Skeleton and ephemeral context:

- ephemeral context expires daily
- raw skeleton data has short retention
- reviewed summaries may be retained by policy
- cross-day child identity profiling is not allowed without legal review

## Audit Model

Use the Phase 154 immutable audit service for:

- request submitted
- data scoped
- legal hold checked
- approval or rejection
- deletion or anonymization executed
- export generated
- user notified

Audit logs are normally retained and not deleted by user request. If required by law, direct identifiers may be redacted while preserving integrity.

## Dashboards

Admin:

- `/dashboard/admin/privacy-rights`

User:

- `/dashboard/privacy`

Admin can:

- view requests
- calculate data scope
- approve
- reject
- mark complete
- create legal hold

User can:

- request access
- request correction
- request export
- request deletion
- request restriction
- request anonymization
- view request status

## Remaining Legal Review Requirements

- Final Israeli legal retention periods for every category.
- Approved export package format.
- Signed storage location for export files.
- Verified deletion/anonymization jobs.
- Provider-specific deletion for Supabase Storage and push tokens.
- Payment/accounting retention legal sign-off.
- Camera clip retention policy with provider terms.
- Document retention policy per evidence type.
