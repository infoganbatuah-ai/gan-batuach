# ISO Certification External Process And Auditor Handoff

Status: Phase 172 readiness artifact. This document does not issue, imply or claim ISO certification.

## Goal

Prepare Gan Batuach and the future Digital Observer ecosystem for a real external ISO certification process covering ISO/IEC 27001, ISO/IEC 27017 and ISO/IEC 27701.

The goal is to make the system, documents, evidence and internal controls ready for external consultant and auditor review with minimal missing technical work.

## Process Stages

Tracked stages:

- not_started
- internal_ready
- consultant_review
- gap_remediation
- pre_audit_ready
- stage_1_audit_ready
- stage_2_audit_ready
- certification_pending
- certified
- surveillance_audit

The `certified` stage must not be used unless an accredited external certification body issues a certificate.

## Roles

Internal roles:

- Executive owner
- Security owner
- Privacy owner
- Engineering owner
- Operations owner
- Supplier owner

External roles:

- ISO consultant
- ISO auditor
- Certification body
- Privacy consultant
- Cloud security reviewer
- Penetration test provider

## Scope

Included in readiness:

- Gan Batuach SaaS platform
- Digital Observer Core readiness
- Supabase / Vercel deployment architecture
- GitHub CI/CD process
- Internal admin dashboards
- Customer data processing
- AI governance
- Camera access governance
- Privacy rights workflows

Excluded for now:

- External providers internal systems
- Customer-owned camera hardware
- External payment processors
- Future Digital Observer verticals not yet launched

## Evidence Package

Evidence binder categories:

- Access control
- MFA
- RBAC
- Audit logs
- Encryption
- Backups
- Disaster recovery
- Incident response
- Supplier management
- Cloud security
- Privacy rights
- Data retention
- AI governance
- Camera compliance
- CI/CD security
- Penetration test readiness

## Safe Access Model

External reviewers may receive:

- Policies
- Procedures
- Evidence metadata
- Risk register
- Asset inventory
- Control mapping
- Supplier register
- Readiness scores
- Gap analysis

External reviewers must not receive:

- Child personal data
- Parent personal data
- Staff personal data
- Medical data
- Raw camera feeds
- Raw AI events
- Payment details
- Secrets
- Encryption keys
- Private signed URLs

Reviewer actions should be logged in `iso_reviewer_access_audit` and, where available, the immutable audit trail.

## Gap Remediation Process

Workflow:

1. Gap identified.
2. Owner assigned.
3. Remediation plan written.
4. Evidence after fix attached.
5. Internal review completed.
6. External consultant or auditor verifies.
7. Gap status changes to verified or accepted risk.

Accepted risks must include business reason, mitigation and review date.

## External Dependencies

Items that cannot be completed internally:

- External ISO consultant review
- Certification body selection
- Legal/privacy lawyer confirmation
- Penetration test provider
- Cloud provider evidence collection
- Payment provider compliance documents
- External policy validation

## Certification Body Comparison

Potential bodies to research:

- SII / מכון התקנים
- BSI
- DNV
- SGS
- IQC
- Other accredited bodies

No body is selected automatically.

## Public Claims Guardrails

Before certification, allowed wording:

- ISO readiness
- Certification preparation
- Compliance readiness
- Security controls implemented
- Privacy-by-design architecture

Forbidden without external proof:

- ISO certified
- Privacy certified
- Legally approved
- Regulator approved

## Required Manual Steps

1. Select ISO consultant.
2. Complete consultant gap analysis.
3. Complete legal/privacy review.
4. Complete external penetration test.
5. Collect provider evidence.
6. Approve policy and procedure set.
7. Select certification body.
8. Run Stage 1 and Stage 2 audit with the selected body.

