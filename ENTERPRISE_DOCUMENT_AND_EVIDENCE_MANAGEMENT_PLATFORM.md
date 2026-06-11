# Enterprise Document & Evidence Management Platform

## Purpose

Gan Batuach now has an enterprise document and evidence command center:

`/dashboard/admin/document-center`

It is a unified administrative view for documents, evidence, inspection artifacts, incident case files, complaint attachments and compliance records. It does not duplicate files or create a separate storage system.

## Classification Model

Documents and evidence are grouped into:

- kindergarten documents
- child documents
- staff documents
- inspection documents
- compliance documents
- incident evidence
- complaint evidence
- contracts
- invoices
- receipts

Classification is based on existing ownership fields such as `garden_id`, `child_id`, `staff_id`, `parent_id`, document type, owner type and linked evidence source.

## Digital File Model

The platform presents digital files as views over existing records:

- Kindergarten file: licenses, insurance, procedures, compliance documents, inspection reports and contracts.
- Child file: enrollment documents, medical/allergy records, approvals, emergency contacts and incident links.
- Staff file: certifications, training records, contracts, background checks and compliance records.
- Inspection file: reports, answers, photos, documents, GPS metadata and signatures.
- Incident file: case evidence, photos, videos, witness notes, investigation summaries and corrective actions.
- Complaint file: complaint attachments, screenshots, responses and supporting documents.

## Evidence Model

Evidence is linked through existing tables:

- `incident_case_evidence`
- `inspection_answers`
- `inspection_signatures`
- `complaints.attachment_urls`
- `documents`

Evidence remains tied to its source record and visibility rules. Parent-visible evidence must be explicitly approved through existing workflows.

## Expiration & Renewal Model

The document center highlights:

- expiring documents within 30 days
- expired documents
- missing documents
- rejected documents
- documents waiting for review

No automatic deletion is performed.

## Version Model

The current platform stores document replacement as new records or updates on the existing record. Production-grade version history should preserve:

- old file reference
- new file reference
- changed by
- changed at
- reason for replacement

The document center is ready for a future `document_versions` layer without duplicating storage.

## Audit Model

Required audit coverage:

- uploaded by
- reviewed by
- viewed by
- downloaded by
- modified by
- deleted by

Upload and review metadata already exist in `documents`. View/download/delete audit should be expanded through `audit_logs` before production document repository use.

## Search Model

The command center prepares search across:

- title
- category
- type
- owner
- garden
- child
- staff member
- date
- status
- expiration

Future full-text search can be added without changing the storage model.

## AI Document Assistant Model

Assistant capabilities should remain advisory:

- summarize document
- identify missing fields
- identify expiring items
- extract key information

No document modification, deletion, approval or rejection should happen without human confirmation.

## Retention Model

Recommended retention categories:

- child documents
- staff documents
- inspection documents
- incident evidence
- complaint evidence
- audit logs
- financial documents

Retention should be configurable by admin and legal policy. Automatic deletion is not enabled in this phase.

## Secure Sharing Model

Visibility should follow existing role boundaries:

- admin can see all records
- manager can see own kindergarten records
- inspector can see assigned kindergarten records and inspection evidence
- parent can see only approved child/family documents
- staff can see own staff documents and permitted operational documents

Raw incident evidence, internal investigations and protected observer materials remain internal unless explicitly approved.

## Remaining Gaps

- Dedicated `document_versions` table is still needed for full version history.
- View/download audit logging needs deeper coverage.
- Bulk import UX and scan-from-camera UX are prepared conceptually but not implemented as new upload flows.
- Retention policies are documented and displayed as readiness, but no automatic retention engine is active.
