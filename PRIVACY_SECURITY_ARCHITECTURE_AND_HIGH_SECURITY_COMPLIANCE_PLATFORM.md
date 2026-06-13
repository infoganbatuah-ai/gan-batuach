# Privacy, Security Architecture & High Security Compliance Platform

## Purpose

Phase 146 establishes the security architecture required before production deployment with real kindergarten, parent, child, medical, attendance, inspection, camera and AI data.

The goal is enforceable, measurable and auditable security readiness for Israeli privacy protection requirements and future ISO readiness.

## Security Command Center

The central security dashboard is:

`/dashboard/admin/security`

It tracks:

- MFA readiness.
- Encryption readiness.
- Audit readiness.
- Privacy readiness.
- Backup readiness.
- Security risk status.
- Device and session trust.
- Sensitive data classification.
- Security policy and training readiness.

## MFA Architecture

MFA is mandatory for:

- Parents.
- Staff.
- Managers.
- Inspectors.
- Admins.

Supported methods:

- Authenticator app.
- SMS OTP.
- Backup codes.

The table `mfa_enrollment_status` tracks enrollment per profile and role. Password-only access is not production-ready until the authentication layer enforces MFA completion.

## Encryption Architecture

Medical and regulated fields require application-level encryption using `FIELD_ENCRYPTION_KEY`.

The existing encryption helper uses AES-256-GCM. Phase 146 adds encrypted target columns and an encrypted-field registry for:

- Child allergies.
- Child medical notes.
- Regular medications.
- Child health records.
- Medicine names.
- Medicine dosage.
- Medicine notes.

Plaintext migration is still required before real customer data is connected.

## Sensitive Data Classification

Data is classified as:

- Public.
- Internal.
- Confidential.
- Sensitive.
- Medical.
- Regulated.

Initial regulated or medical classifications include:

- `children.allergies`
- `children.medical_notes`
- `children.regular_medications`
- `child_health_records`
- `medicine_given_logs`
- `camera_streams`
- `ai_camera_events`
- `audit_logs`

The classification registry defines whether encryption and audit evidence are required.

## Access Control Model

Access must remain least-privilege:

- Parents can access only their own children and parent-visible records.
- Staff can access only assigned kindergarten operational information.
- Managers can access only their kindergarten.
- Inspectors can access only assigned kindergartens and inspection-related data.
- Admins can access cross-platform data for operations, security and compliance.

RLS and server-side route checks remain mandatory. Client role claims must not be trusted.

## Data Separation Model

Core Data:

- Parents.
- Children.
- Staff.
- Medical records.
- Attendance.
- Documents.
- Communications.

AI Data:

- Observer events.
- Skeleton or motion telemetry.
- AI metadata.
- Risk signals.
- Review queues.

Core data and AI data must remain separated by tables, policies and visibility rules. Raw AI events are not parent-visible.

## Immutable Audit Architecture

The audit framework tracks:

- Login.
- Logout.
- Failed login.
- MFA failures.
- Permission violations.
- Data access.
- Data modification.
- Camera viewing.
- Medical record access.
- Inspection actions.

Phase 146 adds `security_events` for security-specific evidence and expands the audit catalog. Future implementation should wire sensitive read paths into append-only events.

## Device Trust and Session Security

The platform now has readiness tables for:

- Trusted devices.
- Suspicious devices.
- New devices.
- Session expiration.
- Forced logout.
- Concurrent session monitoring.
- Suspicious session detection.

Device fingerprints must be hashed. Raw device identifiers should not be stored.

## Privacy Rights Framework

The table `privacy_rights_requests` prepares workflows for:

- Access requests.
- Correction requests.
- Deletion requests.
- Export requests.
- Restriction requests.
- Objection requests.

Legal SLA, approval workflow and identity verification still need final sign-off.

## Security Risk Register

The risk register tracks:

- Vulnerability or risk.
- Severity.
- Domain.
- Owner.
- Mitigation plan.
- Due date.
- Verification status.

Initial risks include MFA enforcement, medical plaintext migration, sensitive read audit coverage and privacy request SLA sign-off.

## Security Policies Repository

The platform tracks policies for:

- MFA.
- Medical encryption.
- Privacy rights.
- Incident response.
- Retention and legal hold.

Policies are draft or review-ready until legal and operational approval is complete.

## Security Training Readiness

Training readiness is tracked for:

- Admins.
- Managers.
- Staff.
- Inspectors.

Training must cover child data, medical data, access control, incident response and audit responsibilities before production launch.

## Remaining Security Gaps

- MFA enforcement must be wired into authentication.
- Existing medical plaintext fields must be encrypted and migrated.
- Sensitive read audit events must be added to all relevant routes.
- Device fingerprinting must be implemented with hashed identifiers only.
- Session monitoring must be connected to auth lifecycle.
- Privacy rights workflow needs legal approval and SLA.
- Final Israeli legal/privacy review is required before real deployment.
