# ISO 27001, 27017 & 27701 Certification Readiness Platform

## Scope

Phase 150 connects Gan Batuach's certification dashboards to engineering controls across Vercel, Supabase and GitHub.

Covered standards:

- ISO/IEC 27001: information security controls, audit logging, access control, encryption and risk management.
- ISO/IEC 27017: cloud service controls for Vercel, Supabase and GitHub shared responsibility.
- ISO/IEC 27701: privacy information management, DPIA, minimization, right to erasure and AI/video governance.

## Implemented Control Framework

The new control model is stored in `iso_controls`.

Each control tracks:

- `control_id`
- `standard`
- `category`
- `implementation_status`
- `evidence_status`
- `policy_status`
- `owner_role`
- `gap_summary`
- `remediation_plan`

Readiness is calculated dynamically from implementation, evidence and policy coverage rather than hard-coded dashboard numbers.

## Evidence Collection Model

Evidence sources are linked from:

- `security_policies_repository`
- `security_readiness_checks`
- `encrypted_field_registry`
- `audit_logs`
- `ai_capabilities`
- `vertical_capability_matrix`
- `privacy_by_design_controls`
- `asset_inventory`
- `internal_audits`

The dashboard at `/dashboard/admin/iso-readiness` shows readiness percentages, open gaps, risks, audits, permit alerts and cloud assets.

## Cloud Asset Inventory

The `asset_inventory` table maps:

- Supabase PostgreSQL and storage.
- Vercel API routes and hosting.
- GitHub CI/CD.
- Camera configurations.
- Digital Observer AI pipelines.

Assets include classification, encryption requirement, backup requirement and RLS requirement.

## Risk Register

The `risk_register` table tracks:

- Risk domain.
- Risk description.
- Severity.
- Likelihood.
- Mitigation strategy.
- Remediation status.
- Due date.

Open high and critical risks reduce the readiness score.

## Internal Audit Model

The `internal_audits` table tracks:

- Audit scope.
- Findings.
- Corrective actions.
- Closure status.
- Next audit date.

Audits are certification evidence, not business workflow features.

## Israeli Permit Inventory

Staff records now support:

- Police clearance certificate for sex offender restrictions.
- First aid certification.
- Safe conduct training.

Kindergarten records now support:

- Fire safety permit.
- Home Front Command / shelter readiness.
- Operating permit.
- Camera law declaration.

`/api/cron/permit-expiry-scan` creates admin alerts up to six months before expiration. It is protected by `CRON_SECRET` in production.

## Tenant Isolation

Phase 150 enables/aligns RLS on core tables and adds JWT helper functions:

- `jwt_garden_id()`
- `jwt_room_uuid()`

Core policies use `can_access_garden`, JWT garden claims and direct parent-child relationships.

## Encryption

Sensitive application writes are encrypted before Supabase persistence.

Implemented helpers:

- `encryptField`
- `decryptField`
- `encryptSensitiveFieldCbc`
- `decryptSensitiveField`

Sensitive medical fields are written into encrypted columns when child, health and medicine records are created.

Keys are read only from environment variables:

- `FIELD_ENCRYPTION_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

No raw payment or provider secrets are stored in code.

## AI and Video Privacy

Gan Batuach regulatory mode forbids:

- Face recognition.
- Facial landmarks.
- Face matching.
- Audio recording.
- Audio analytics.
- Keyword detection.

The observer pipeline records only abstract skeleton/keypoint metadata. Raw frame references are cleared after skeleton extraction and metadata explicitly records `raw_pixels_wiped_from_memory`.

Parents receive only approved summaries or approved events. Raw observer events are never parent-visible by default.

## Camera Streaming Security

Parent viewing is restricted to:

- WebRTC token flow.
- Active MFA.
- Active parent-child relationship.
- Approved kindergarten camera policy.
- Active viewing window.
- Child checked in.
- Room/class match when camera room metadata exists.

Watermarks include the viewer's legal name, masked phone, IP and session identifier.

Android uses `FLAG_SECURE`. iOS monitors screen capture and masks the app with a black overlay while captured.

## Geofenced Attendance

Parent attendance requires:

- Live coordinates.
- 30-meter radius validation.
- Digital signature.
- GPS validation record.
- Attendance audit trail.

Failed radius checks return HTTP 400 and are logged.

## Right To Be Forgotten

`scripts/right-to-be-forgotten.mjs` supports dry-run and explicit execution.

It removes or nulls:

- Parent PII.
- Child medical and family PII.
- Signature files and hashes.
- Child health records.
- Medication logs.

It preserves non-identifiable telemetry.

## Immutable Audit Trail

`audit_logs` was extended with HTTP request fields:

- `user_uuid`
- `user_role`
- `http_method`
- `api_endpoint`
- `client_source_ip`
- `http_status_code`
- `request_id`

Database triggers block all `UPDATE` and `DELETE` operations on `audit_logs`.

The Next/Vercel proxy writes best-effort request audit events directly to Supabase REST using server environment variables.

## Vercel Controls

`vercel.json` defines:

- CSP.
- HSTS with `max-age=63072000`.
- `X-Frame-Options: DENY`.
- `X-Content-Type-Options: nosniff`.
- Referrer policy.
- Permissions policy disabling microphone access.
- Cron entry for permit expiry scanning.

## GitHub CI/CD Security Gates

`.github/workflows/deploy.yml` adds:

- TypeScript checks.
- Production build.
- `npm audit --audit-level=high`.
- GitHub CodeQL.
- Gitleaks secret scanning.

The workflow fails on high/critical dependency issues or credential leaks.

## Remaining Certification Gaps

- Attach formal Vercel, Supabase and GitHub provider attestations.
- Run RLS penetration tests with production JWT claims.
- Execute medical-field encryption migration on production data after key activation.
- Test right-to-be-forgotten in staging and attach evidence.
- Add independent evidence for skeleton-only runtime behavior.
- Complete policy approvals and internal audit closure before external certification audit.
