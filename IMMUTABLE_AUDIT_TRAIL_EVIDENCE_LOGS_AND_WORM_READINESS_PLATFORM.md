# Immutable Audit Trail, Evidence Logs & WORM Readiness Platform

Phase 154 creates the unified audit and legal evidence layer for Gan Batuach high-security readiness.

## Audit Event Model

Primary table:

- `immutable_audit_events`

Core fields:

- `event_type`
- `event_category`
- `actor_profile_id`
- `actor_role`
- `target_type`
- `target_id`
- `garden_id`
- `child_id`
- `camera_id`
- `document_id`
- `inspection_id`
- `incident_id`
- `ip_address`
- `user_agent`
- `device_fingerprint`
- `request_id`
- `session_id`
- `metadata`
- `risk_level`
- `created_at`
- `previous_event_hash`
- `event_hash`

Supported categories:

- `auth`
- `medical`
- `camera`
- `document`
- `child`
- `staff`
- `parent`
- `inspection`
- `incident`
- `observer`
- `payment`
- `admin`
- `security`
- `regulatory`

## Append-Only Model

Database triggers block:

- `UPDATE`
- `DELETE`

Protected tables in this phase:

- `immutable_audit_events`
- `medical_data_access_logs`
- existing `audit_logs` remains protected by the Phase 150 trigger

Admin UI can read audit records but cannot edit or delete them.

Important limitation: PostgreSQL triggers improve local tamper resistance, but a database superuser or infrastructure owner can still theoretically bypass local controls. Production-grade WORM requires external immutable storage.

## Hash-Chain Model

`pgcrypto` is used to compute event hashes at insert time.

Hash input includes:

- event id
- event type
- category
- actor id
- target type/id
- garden/child/camera/document ids
- timestamp
- metadata hash
- previous event hash

This creates tamper-evident continuity inside the local Supabase database. Chain verification evidence should be exported during ISO readiness testing.

## Audit Logging Service

Server-only service:

- `lib/security/audit-log-service.ts`

Functions:

- `writeAuditEvent`
- `writeMedicalAccessEvent`
- `writeCameraAccessEvent`
- `writeDocumentAccessEvent`
- `writeAdminActionEvent`
- `writeSecurityEvent`
- `writePaymentEvent`
- `writeAIReviewEvent`
- `withAuditLog`
- `sanitizeAuditMetadata`

The service uses the Supabase admin client to write audit evidence while applying strict metadata sanitization.

## Privacy-Safe Metadata Rules

Audit logs must never contain:

- plaintext medical data
- identity numbers
- passwords
- one-time passwords
- tokens
- cookies
- API keys
- encryption keys
- RTSP URLs
- gateway secrets
- private signed URLs
- decrypted field values
- raw signature images

`sanitizeAuditMetadata` redacts sensitive keys and risky URL/value patterns before persistence.

## Medical Access Logging

Medical route coverage added:

- child health record views
- child health record updates
- medication log views
- medication log updates

Each medical event writes:

- unified immutable audit event
- compatibility row in `medical_data_access_logs`

Content is not logged. Only access context is stored.

## Camera Access Logging

Camera creation now writes a unified camera audit event without camera secrets, raw URLs or gateway credentials.

Required next coverage:

- viewing token created
- parent viewed camera
- session started
- session ended
- camera access denied
- inspector/admin viewing attempts

## Document And Evidence Logging

Phase 154 adds the unified model and coverage dashboard readiness. Full route integration remains required for:

- document viewed
- document downloaded
- signed URL generated
- evidence viewed
- incident evidence downloaded
- inspection report evidence viewed

Every sensitive file access must be routed through a server endpoint and audited.

## Admin, Role And Onboarding Logging

Existing onboarding/user creation audits are bridged into `immutable_audit_events` while preserving the older `audit_logs` rows.

Required next coverage:

- role changed
- permission override
- user disabled
- garden suspended/reactivated
- inspector assignment changed

## AI / Observer Review Logging

The service exposes `writeAIReviewEvent` for:

- AI event reviewed
- observer signal confirmed
- observer signal dismissed
- parent visibility approved
- escalation created
- model threshold changed
- restricted capability toggled

No raw AI events should be exposed to parents or stored as audit content.

## Payment Logging

Financial audit tables already exist. Phase 154 prepares the bridge into the unified immutable stream.

Required next coverage:

- invoice downloaded
- bank details changed
- discount applied
- refund created
- plan price changed

## Audit Coverage Dashboard

Admin dashboard:

- `/dashboard/admin/audit-logs`

Shows:

- unified event count
- critical events
- high-risk actions
- failed access attempts
- medical access logs
- security events
- tamper protection readiness
- audit coverage score
- category activity
- recent event stream

Readiness table:

- `audit_coverage_readiness`

## Retention Policy

Default readiness policy:

- retain sensitive audit logs at least 24 months
- retain security incidents according to approved policy
- preserve legal evidence under legal hold
- never automatically delete immutable evidence without legal/policy approval

## External WORM Readiness

Future external immutable storage options:

- AWS CloudWatch Logs with locked retention
- S3 Object Lock / WORM
- external SIEM
- immutable ledger storage
- Supabase log drain to external archival target

This phase does not add AWS or external infrastructure. It prepares the local schema and service boundaries.

## Remaining Production Gaps

- Full auth events are not yet wired: login success/failure, logout, MFA failure.
- Camera viewing token/session routes still need audit integration.
- Document and evidence signed URL/download routes still need full audit coverage.
- Financial audit events need bridge writes into `immutable_audit_events`.
- AI review workflows need full use of `writeAIReviewEvent`.
- External WORM/SIEM provider must be selected before production certification.
- Chain verification job/report should be added for ISO evidence.
