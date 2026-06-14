# ISO Consultant Handoff Package

Status: readiness package only. This document does not claim ISO certification.

## Purpose

This package gives an external ISO consultant a structured starting point for reviewing Gan Batuach and the future Digital Observer ecosystem against ISO/IEC 27001, ISO/IEC 27017 and ISO/IEC 27701.

No real child data, parent data, staff data, medical records, camera streams, raw AI events, payment data, secrets, encryption keys or private signed URLs should be included in the consultant export.

## Scope Summary

Included:

- Gan Batuach SaaS platform
- Digital Observer Core readiness
- Supabase PostgreSQL, Auth, Storage and realtime architecture
- Vercel hosting and deployment model
- GitHub CI/CD readiness
- Internal admin dashboards
- Customer data processing governance
- AI governance and human review controls
- Camera access governance
- Privacy rights and deletion workflows

Excluded for this readiness phase:

- External providers internal systems
- Customer-owned camera hardware
- External payment processor internal controls
- Future Digital Observer verticals not yet launched

## Review Materials

Core materials:

- Architecture overview and deployment model
- Asset inventory
- Risk register and risk treatment plan
- ISO control registry
- Statement of Applicability readiness
- Policy repository
- Procedure repository
- Evidence item register
- Supplier/subprocessor register
- Internal audit readiness
- Management review readiness

Technical evidence areas:

- Authentication, MFA and trusted device readiness
- RBAC and route protection
- Supabase RLS readiness
- Immutable audit trail readiness
- Field-level encryption readiness
- Backup and restore readiness
- Incident response process
- CI/CD security gates
- Data retention and legal hold model
- Camera compliance controls
- AI governance and DPIA readiness

## Consultant Review Questions

- Are the certification scope boundaries clear and auditable?
- Are exclusions reasonable and properly justified?
- Are ISO 27001 controls mapped to real evidence?
- Are ISO 27017 shared-responsibility controls documented clearly enough?
- Are ISO 27701 privacy controls sufficient for child, parent, staff, medical, camera and AI data?
- Which evidence items need stronger proof before an external audit?
- Which policies require formal approval before certification body engagement?
- Which risks need additional treatment before pre-audit?

## Safe Access Model

The consultant should receive metadata-only access to:

- Policies and procedures
- Evidence metadata
- Risk register
- Asset inventory
- Control mapping
- Supplier register
- Readiness scores
- Gap analysis

The consultant must not receive:

- Child personal data
- Parent personal data
- Staff personal data
- Medical data
- Raw camera feeds
- Raw AI events
- Payment details
- Secrets or encryption keys

## Expected Output

The expected consultant output is a formal gap analysis with:

- Control-level findings
- Evidence gaps
- Policy approval gaps
- Technical remediation items
- Supplier evidence gaps
- Risk treatment recommendations
- Pre-audit readiness recommendation

