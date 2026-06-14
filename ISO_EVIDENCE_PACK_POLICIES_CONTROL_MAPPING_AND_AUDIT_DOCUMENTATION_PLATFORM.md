# ISO Evidence Pack, Policies, Control Mapping & Audit Documentation Platform

This phase prepares Gan Batuach and the future Digital Observer ecosystem for an external ISO readiness review.

It does not claim certification. It creates the internal evidence structure needed for an ISO consultant or auditor to review ISO/IEC 27001, ISO/IEC 27017 and ISO/IEC 27701 readiness with fewer missing artifacts.

## Evidence Architecture

The central evidence repository is `iso_evidence_items`.

Each evidence item tracks:

- ISO standard: `iso_27001`, `iso_27017`, `iso_27701`, or `combined`
- control ID
- evidence type
- owner
- status
- optional file location
- source table or source record
- review and expiry dates
- sensitivity classification

Evidence statuses:

- `missing`
- `draft`
- `uploaded`
- `reviewed`
- `approved`
- `expired`

Evidence metadata must not contain secrets, payment card data, child personal data, medical text, raw camera feeds or raw AI event data.

## Control Mapping Model

Existing `iso_controls` records from the ISO readiness platform remain the main control map.

Phase 158 adds:

- `iso_evidence_items`
- `iso_statement_of_applicability`
- `iso_gap_analysis_items`
- `iso_corrective_actions`

The dashboard combines these records to show:

- evidence coverage
- missing evidence
- expired evidence
- open gaps
- corrective action status
- per-standard readiness

## Statement of Applicability Readiness

`iso_statement_of_applicability` prepares the ISO 27001 SoA.

For each control or control group it tracks:

- applicability
- justification
- implementation status
- evidence reference
- owner
- review date
- next review date

The SoA is readiness documentation only. It should be reviewed and completed by a qualified ISO consultant before certification work.

## Policy Repository Model

The existing `security_policies_repository` table is extended instead of duplicated.

It now supports:

- approval status
- effective date
- next review date
- approver
- ISO standards covered
- evidence item linkage

Seeded policy areas include:

- Information Security Policy
- Access Control Policy
- Privacy Policy
- Data Retention Policy
- Incident Response Policy
- Backup Policy
- Supplier Security Policy
- Change Management Policy
- AI Governance Policy
- Camera Privacy Policy
- Data Subject Rights Policy

Policies require formal management approval before external audit.

## Procedure Repository Model

`security_procedures` tracks operational procedures such as:

- user onboarding
- user offboarding
- role review
- MFA enforcement
- backup restore
- incident response
- supplier review
- deployment approval
- privacy request handling
- audit log review

Procedures link back to policies and evidence items where available.

## Supplier Review Model

`iso_supplier_evidence` prepares supplier records for:

- Supabase
- Vercel
- GitHub
- Email provider
- SMS provider
- WhatsApp provider
- Push provider
- Payment provider
- Camera gateway provider
- AI provider

Each supplier tracks:

- supplier purpose
- data processed
- security review status
- privacy review status
- contract status
- DPA status
- risk rating
- review dates

DPAs, contracts and provider security evidence must be collected before production certification work.

## Access Review Evidence

`iso_access_reviews` supports periodic review of:

- admin users
- managers
- staff
- parents
- inspectors
- Supabase access
- GitHub access
- Vercel access
- service accounts

Each review tracks:

- reviewed users
- privileged users
- inactive users
- revoked access
- reviewer
- next review due date
- findings

## Gap Analysis Model

`iso_gap_analysis_items` tracks gaps across ISO 27001, 27017, 27701 and combined governance areas.

Statuses:

- `open`
- `in_progress`
- `fixed`
- `accepted_risk`
- `verified`

Every gap should move through:

Gap -> owner assigned -> corrective action -> evidence uploaded -> reviewed -> verified.

Accepted risk requires a reason and expiration date.

## Audit Binder Model

`iso_audit_binder_exports` prepares future export of:

- policies
- procedures
- evidence list
- risk register
- asset inventory
- supplier register
- access reviews
- incident records
- backup evidence
- audit log evidence
- DPIA evidence

Formats prepared:

- PDF
- ZIP
- CSV
- metadata-only external auditor view

Exports must exclude:

- secrets
- child personal data
- medical data
- raw camera feeds
- raw AI events
- payment details

## External Auditor Access Model

Future auditor access should be limited to:

- policy metadata
- evidence metadata
- readiness scores
- gap analysis
- audit binder exports

Auditors must not access:

- child records
- medical data
- raw camera feeds
- Supabase service role keys
- payment provider secrets
- parent private communications
- internal investigation drafts unless separately approved

## Review Schedule

`iso_review_schedule_items` tracks recurring reviews for:

- policies
- risk register
- suppliers
- access reviews
- incident response plan
- backup tests
- privacy assessments
- AI governance
- camera compliance

The dashboard highlights overdue or blocked reviews.

## Remaining Certification Requirements

Before external certification work, Gan Batuach still needs:

- formal approval of policies
- signed supplier contracts and DPAs
- completed first access review
- completed backup restore test evidence
- evidence export workflow implementation
- auditor-safe limited access mode
- branch protection enforced in GitHub
- real CI/CD scan history
- production provider configuration evidence
- legal review of Israeli kindergarten privacy, camera and AI restrictions

Certification must be performed by an external qualified ISO certification body or consultant.
