# Regulatory Implementation Gap Analysis

Date: 2026-06-13

Scope: Gan Batuach regulatory architecture alignment against the current stack:

- Next.js / TypeScript
- Vercel
- Supabase PostgreSQL
- Supabase Auth
- Supabase Storage
- GitHub CI/CD
- Capacitor for mobile

This document maps the regulatory plan into the existing architecture. It does not delete code and does not introduce Express, NestJS, Socket.io, AWS KMS, AWS Kinesis, or MongoDB. Those technologies should remain future external infrastructure only if ever needed.

## Executive Summary

Gan Batuach already contains a large part of the regulatory foundation: role-based access gates, Supabase RLS migrations, camera viewing token logic, regulatory mode tables, AI capability matrices, passkey readiness, audit tables, ISO readiness tables, legal camera policies, attendance compliance tables, and skeleton analytics governance.

The main production gaps are enforcement gaps, not planning gaps:

- MFA readiness exists, but global MFA enforcement is not yet wired into all role gates.
- Medical encryption helpers and encrypted columns exist, but several application flows still write/read medical details in plaintext fields.
- Camera parent playback is comparatively strong, but several dashboards still select playback URL fields directly and need a token-only display boundary.
- Audio and face/biometric modules exist as mock/future capability paths and must be disabled in Gan Batuach Israel mode at route/UI/service level.
- Request audit logging exists as console logging in middleware and database append-only protection exists for `audit_logs`, but full request persistence to Supabase is not yet implemented.
- Parent AI visibility is mostly modeled as reviewed/approved-only in schema, but parent permissions and pages need route-level verification that no raw AI event can be exposed.

## Requirement Classification

| Area | Current Classification | Evidence | Required Next Action |
| --- | --- | --- | --- |
| Supabase Auth sessions | implemented | `lib/auth.ts` uses Supabase Auth and profile lookup. | Keep; add MFA gate after login and before sensitive role access. |
| Role permissions | partially implemented | `lib/roles.ts` defines role permissions, including camera, AI, and medical permissions. | Tighten sensitive permissions with scope checks, not only role checks. |
| Parent/staff/manager/inspector access | partially implemented | Many routes use `requireRole`; some rely on Supabase RLS or route filters. | Audit service-role/admin-client routes and add explicit garden/child/assignment filters. |
| MFA readiness | partially implemented | Passkeys exist; `mfa_enrollment_status` is checked for parent camera playback in `lib/domain/video-streaming.ts`. | Enforce MFA globally for parents, staff, managers, inspectors, and admins before sensitive pages/actions. |
| Passkeys | implemented as readiness | `components/passkey-enrollment-prompt.tsx`, `lib/passkeys.ts`, and passkey API routes exist. | Decide whether passkeys count as MFA factor or remain login convenience. |
| Audit logs table | implemented | `audit_logs` exists and Phase 150 adds update/delete blocking triggers. | Validate trigger in staging with service role. |
| Request audit middleware | partially implemented | `lib/supabase/middleware.ts` logs request audit data to console only. | Persist request audit records to Supabase or a Vercel-compatible log collector. |
| Audit log immutability | partially implemented | `supabase/migrations/20260612015000_iso_certification_readiness_platform.sql` blocks UPDATE/DELETE on `audit_logs`. | Extend immutable triggers to other audit tables if they are considered official evidence. |
| Medical encryption | partially implemented | `lib/security/encryption.ts` provides AES-GCM and AES-CBC helpers; Phase 146 adds encrypted columns. | Move all medical writes/reads to encrypted fields and backfill plaintext fields. |
| Medical data access | partially implemented | `medical_events` CRUD uses `children:read/write`; medicine logs expose sensitive fields. | Introduce explicit `medical_data:*` route checks and scoped parent/child filters. |
| Camera streaming tokens | implemented for parent token path | `lib/domain/video-streaming.ts` enforces WebRTC for parents, MFA, child presence, viewing policy, token expiry, audit logging, and RTSP blocking. | Keep and expand tests. |
| Direct camera URL exposure | partially implemented | Token logic blocks RTSP, but camera dashboards select `hls_playback_url`, `sample_hls_url`, and `webrtc_playback_url`. | Remove direct playback URLs from UI queries unless admin-only masked diagnostics; playback must go through token API. |
| Parent camera access | implemented with remaining QA | Parent token creation checks camera policy, child enrollment, child presence, viewing hours, MFA, and WebRTC. | Add automated policy tests for child checked-out, camera not approved, MFA missing, and outside viewing hours. |
| Staff camera access | partially implemented | `video-streaming.ts` blocks staff unless garden matches and `staff_view_allowed` is true. | Add explicit audit review and route-level tests. |
| Inspector camera access | partially implemented | `video-streaming.ts` requires inspector assignment and viewing reason for stricter policy. | Expand assignment model beyond `gardens.inspector_id` if regional assignments are active. |
| Audio processing | should be disabled in Gan Batuach | Audio routes, migrations, dashboards, calibration fields, and audio observer event flows exist. | Gate routes/UI/services by `GAN_BATUACH_ISRAEL_MODE`; keep only as future Digital Observer capability. |
| Face recognition / face matching | should be disabled in Gan Batuach | `app/api/garden/face-match-results/route.ts`, `app/dashboard/garden/pickup-face/page.tsx`, `face_reference_images`, and `face_match_results` exist. | Disable in Gan Batuach route/UI/policy layer; keep as future legal-review-only capability. |
| Biometric matching | should be disabled in Gan Batuach | Regulatory migrations disable child biometric profiles and face databases, but historical schema fields remain. | Rename/deprecate operational use of `face_image_url`; ensure it is treated as a general profile photo, not biometric reference. |
| Child identity inference | requires legal review | Phase 152 creates contextual child association as restricted/legal-review-required; pickup face mock exists. | Keep disabled by default; require DPIA and legal approval before any identity inference. |
| Raw AI event parent visibility | partially implemented | Many tables default `parent_visible = false`; Phase 145 marks parent visibility controls. Parent role still has `ai_events:read`. | Verify every parent AI route filters only reviewed, approved, parent-safe summaries. |
| Skeleton analytics | implemented as readiness | `lib/domain/observer/skeleton-motion-engine.ts` and Phase 152 skeleton migration avoid raw face/audio/identity fields. | Connect runtime ingestion to frame wiping and retention enforcement before production use. |
| AI governance / DPIA | implemented as readiness | AI governance, capability, DPIA, and regulatory migrations exist. | Make capability checks executable in API routes and dashboards. |
| Capacitor mobile anti-leak controls | partially implemented / missing runtime | Capacitor project exists; camera anti-leak readiness is documented in prior phases. | Add Android `FLAG_SECURE` and iOS capture masking in native layers for video screens. |
| GitHub CI/CD security gates | partially implemented | CI workflow exists from ISO readiness work, but full production gate validation needs review before launch. | Ensure CodeQL/secret/dependency checks block production deployment on high/critical findings. |
| External providers | requires external provider | SMS/WhatsApp/push/payment/video gateways are provider-dependent. | Keep integrations abstracted; production requires provider contracts and credentials in Vercel env. |

## Risky Code Findings

### Audio Processing

Classification: should be disabled in Gan Batuach; future Digital Observer only; requires legal review for any vertical that enables it.

Findings:

- `app/api/audio-observer-events/route.ts` supports mock audio event creation and review.
- `app/dashboard/garden/audio-events/page.tsx` and `app/dashboard/admin/audio-events/page.tsx` expose audio event dashboards.
- `components/audio-observer-events-panel.tsx` renders audio observer events.
- `lib/domain/observer-intelligence-engine.ts` aggregates `audio_observer_events` into observer summaries.
- `app/dashboard/admin/observer-replay/page.tsx` and `app/dashboard/admin/observer-calibration/page.tsx` query audio observer events.
- `supabase/migrations/20260606001000_audio_intelligence_distress_detection.sql` and calibration migrations create audio-related structures.

Recommended fix:

- Add a central regulatory capability guard for `audio_recording`, `audio_analysis`, `keyword_detection`, `speech_recognition`, and `sound_classification`.
- In Gan Batuach Israel mode, return 404 or disabled-state UI for audio routes/pages and exclude audio sources from observer aggregation.
- Keep database objects only as disabled/future Digital Observer readiness.

### Face Recognition, Face Matching, and Biometrics

Classification: should be disabled in Gan Batuach; future Digital Observer only; requires legal review.

Findings:

- `app/api/garden/face-match-results/route.ts` creates mock face match results from `face_reference_images` and writes to `face_match_results`.
- `app/dashboard/garden/pickup-face/page.tsx` exposes a face pickup workflow.
- `components/face-match-review-panel.tsx` renders face match review UI.
- `app/api/parent/child-registration/route.ts` writes child photo data to `face_image_url`.
- `supabase/migrations/20260523006000_admin_completion_and_safety_modules.sql` adds `face_image_url`.
- `supabase/migrations/20260603009000_face_matching_pickup_verification.sql` creates face matching pickup structures.

Positive controls:

- `app/api/parent/pickup-contacts/route.ts` stores metadata indicating `biometric_identification_allowed: false`.
- `app/api/parent/attendance/route.ts` records `biometric_identification_used: false`.
- `app/dashboard/admin/attendance-compliance/page.tsx` flags biometric or camera-based attendance/release if present.
- Phase 145 and Phase 152 migrations mark face recognition and biometric matching disabled or legal-review-required for Gan Batuach.

Recommended fix:

- Feature-gate all face matching routes and UI behind a vertical capability check.
- In Gan Batuach, treat child photos as profile photos only; stop writing new data into `face_image_url` and migrate future code to `photo_url`.
- Keep face matching objects only as future Digital Observer or non-kindergarten legal-review capability.

### Child Identity Inference

Classification: requires legal review; disabled by default for Gan Batuach.

Findings:

- Phase 152 prepares contextual child association and ephemeral context as legal-review-required.
- Current face pickup mock flow can imply identity matching even though it labels itself mock and human-reviewed.

Recommended fix:

- Explicitly block contextual child association, persistent skeleton identity, soft biometrics, gait recognition, and cross-day identity matching in Gan Batuach.
- Allow only anonymous skeleton/motion events with no child name, parent name, direct identity, face image, or audio.

### Raw AI Event Parent Visibility

Classification: partially implemented; must be verified.

Findings:

- `supabase/migrations/20260602007000_ai_digital_observer_architecture.sql` includes `parent_visible boolean default false` and risky legacy event names such as `violence_indicator`, `audio_anomaly`, and `keyword_detected`.
- `supabase/migrations/20260612012800_camera_digital_observer_infrastructure_platform.sql` adds parent-safe checks for observer processing queue.
- `app/dashboard/parent/ai-events/page.tsx` and `app/api/ai-events/route.ts` exist.
- `lib/roles.ts` grants `ai_events:read` to parents.

Recommended fix:

- Parent-facing AI routes must return only reviewed, approved, parent-safe summaries.
- Raw event rows, confidence scores, observer signals, skeleton events, and investigation drafts must never be returned to parent routes.
- Replace AI labels such as `violence_indicator` in Gan Batuach surfaces with careful language like `high_velocity_motion` or `motion anomaly requiring review`.

### Direct Camera URL Exposure

Classification: partially implemented.

Positive controls:

- `lib/domain/video-streaming.ts` blocks direct RTSP playback URLs, enforces WebRTC for parents, creates short-lived tokens, enforces MFA for parent camera viewing, validates child presence, applies viewing windows, and writes camera access audits.

Risks:

- `components/camera-playback-card.tsx` reads direct URL fields to decide playback availability.
- `app/dashboard/garden/cameras/page.tsx`, `app/dashboard/admin/cameras/page.tsx`, `app/dashboard/admin/camera-infrastructure/page.tsx`, and `app/dashboard/inspector/cameras/page.tsx` select `hls_playback_url`, `sample_hls_url`, and `webrtc_playback_url`.

Recommended fix:

- UI should never render or depend on raw camera URLs for parent/staff/inspector playback.
- Keep playback URL fields only for gateway diagnostics and admin masked operations.
- All viewing must call the token API and log a session.

### Medical Data Stored in Plaintext

Classification: partially implemented; high priority gap.

Positive controls:

- `lib/security/encryption.ts` provides AES-GCM and AES-CBC helpers sourced from environment variables.
- Phase 146 creates encrypted medical columns and encryption readiness tables.

Risks:

- `app/api/parent/child-registration/route.ts` writes `allergies`, `sensitivities`, `regular_medications`, and `medical_notes` directly into `children` and `permanent_child_files`.
- `app/api/medicine-given-logs/route.ts` writes `medicine_name`, `dosage`, and `notes` in plaintext and allows broad reads filtered by query params.
- `app/api/parent/medical/route.ts` uses generic CRUD on `medical_events` with `children:read/write` instead of explicit `medical_data:*`.
- `app/dashboard/garden/children/page.tsx`, `app/dashboard/garden/children/[id]/page.tsx`, `app/dashboard/garden/children/[id]/timeline/page.tsx`, and `app/dashboard/admin/system-health/page.tsx` render plaintext medical fields.

Recommended fix:

- Introduce a medical data service that encrypts writes and decrypts only for authorized server-side reads.
- Migrate plaintext medical columns into encrypted columns and redact or null plaintext copies after verification.
- Change medical routes to `medical_data:read/write` and add parent-child/garden/staff assignment checks.

### Missing MFA Enforcement

Classification: partially implemented.

Findings:

- `lib/auth.ts` requires user/role but does not enforce MFA.
- `lib/domain/video-streaming.ts` enforces MFA for parent camera viewing.
- Passkey components and routes exist, but MFA enforcement is not globally required for all roles.

Recommended fix:

- Add an MFA enforcement layer after login for all roles, with temporary enrollment grace only where legally/operationally approved.
- Require MFA before medical data, camera viewing, admin, inspector, staff attendance, and parent pickup/payment actions.
- Log MFA failures in `security_events`.

### Editable / Deletable Audit Logs

Classification: implemented for `audit_logs`; partially implemented for broader evidence logs.

Findings:

- `supabase/migrations/20260612015000_iso_certification_readiness_platform.sql` creates `block_audit_logs_mutation()` and triggers that block UPDATE and DELETE on `audit_logs`.
- Other audit/evidence tables such as camera infrastructure logs, security events, regulatory audit events, and financial audit trails may not all have equivalent immutable triggers.
- `lib/supabase/middleware.ts` logs request audit entries to console rather than persisting each request to Supabase.

Recommended fix:

- Keep `audit_logs` append-only trigger and validate it in staging with the service role.
- Add append-only triggers to every table that is officially used as compliance evidence.
- Replace console-only request audit with a Vercel-compatible Supabase insert path or structured log drain.

## Addendum: Operational Regulatory Checks

### Child Attendance Workflows

Classification: partially implemented.

Positive controls:

- `app/api/parent/attendance/route.ts` implements adult-initiated child check-in/check-out with latitude, longitude, graphical signature, device label, and optional authorized adult ID.
- GPS distance is calculated server-side and blocked when the parent is more than 30 meters from the kindergarten.
- Failed GPS attempts are written to `gps_attendance_validations`.
- Successful attendance writes set `legal_attendance_method: "adult_initiated"`, `parent_identity_verified: true`, `biometric_identification_used: false`, and `camera_based_attendance_used: false`.
- Signatures are uploaded to the `restricted-signatures` bucket, with AES-256-GCM encrypted fallback and encrypted signature metadata.
- Successful attendance events are written to `attendance_compliance_audit_trail`.

Risks:

- The parent attendance route verifies that the child belongs to the parent, but when `authorized_adult_id` is supplied it does not yet prove that the adult ID is approved, active, unexpired, and linked to that child.
- Manual override handling exists in schemas and manager pickup flows, but needs an explicit review/approval workflow before it is considered production compliant.
- `app/api/parent/pickup/route.ts` still uses generic CRUD for `pickup_confirmations`, so its permission and audit model is less strict than the newer legal attendance route.
- Real-time dashboard updates are represented through notifications/metadata, not a verified realtime subscription/audit contract.

Recommended fix:

- Before accepting `authorized_adult_id`, validate `authorized_adults` and `pickup_authorizations` status, scope, and expiry.
- Add a dedicated manual override endpoint that requires manager reason, parent notification, and immutable audit.
- Route legacy pickup confirmation writes through the same legal attendance compliance trail.

### Child Pickup Workflows

Classification: partially implemented.

Positive controls:

- `app/api/parent/pickup-contacts/route.ts` lets parents create permanent and temporary pickup contacts, requires a time window for temporary permissions, writes `authorized_pickup_contacts`, `authorized_adults`, and `pickup_authorizations`, and logs to `attendance_compliance_audit_trail`.
- The same route prevents parents from editing pickup permissions for children not linked to them.
- `app/api/garden/pickup-events/route.ts` validates child/garden scope for managers, checks active contact status, expiry, and blocked statuses, and creates attendance exceptions for unauthorized pickup attempts.
- Manager pickup records explicitly set `biometric_identification_used: false` and `camera_based_release_used: false`.
- Parent visibility exists through `app/api/parent/pickup-contacts/route.ts`, which returns pickup contacts and pickup history only for the parent's linked child IDs.

Risks:

- Emergency pickup is supported as a status path, but the approval workflow is not yet distinct enough: it should require a manager reason, parent contact attempt, and post-event review.
- Manager pickup signature storage uses `signature_image` directly when supplied, unlike parent attendance which uploads to restricted storage or encrypts fallback.
- Parent confirmation requests are notified, but parent approval/denial lifecycle needs stronger audit coverage.
- Face pickup pages and face match mock routes coexist with the legal no-biometric pickup path and must be disabled in Gan Batuach.

Recommended fix:

- Add explicit emergency pickup approval records with reason, approving manager, parent notification attempt, and follow-up closure.
- Store manager pickup signatures with the same restricted/encrypted signature storage strategy used by parent attendance.
- Disable pickup face matching in Gan Batuach while preserving it as legal-review-only Digital Observer capability.

### Data Retention and Deletion

Classification: partially implemented; requires legal review.

Positive controls:

- `supabase/migrations/20260612013400_business_continuity_backup_disaster_recovery.sql` creates `retention_alignment_checks` with deletion request support, legal hold support, and backup erasure notes per data domain.
- `supabase/migrations/20260612015000_iso_certification_readiness_platform.sql` references `privacy_rights_requests` and `right_to_be_forgotten_runs` as partial ISO 27701 evidence.
- `supabase/migrations/20260612015200_skeleton_analytics_motion_intelligence_observer_platform.sql` adds skeleton retention controls, short retention, legal hold flags, and anonymization requirements.

Risks:

- No production-grade parent deletion request route was found in the application layer.
- Child deletion/anonymization, medical data deletion, document retention, legal hold handling, and telemetry anonymization are modeled as readiness but not fully executable workflows.
- Backup erasure remains manual-review readiness, not tested end-to-end.
- Medical plaintext fields make deletion/anonymization harder until data is migrated into encrypted fields.

Recommended fix:

- Implement a privacy rights request workflow for access, correction, deletion, export, and legal hold exceptions.
- Add a dry-run and execute mode for family PII purge that removes parent signatures, medical data, direct identifiers, and documents while preserving allowed anonymized telemetry.
- Make legal hold resolution mandatory before deletion of inspection, incident, audit, or evidence records.

### Sensitive File Access

Classification: partially implemented.

Positive controls:

- `app/api/storage/upload/route.ts` restricts upload buckets by role, checks file type and size, uses server-side Supabase admin client, and writes upload events to `audit_logs`.
- Private buckets such as `inspection-reports` and `restricted-signatures` are used in sensitive workflows.
- Incident evidence has visibility levels in `incident_case_evidence` and parent visibility is limited to approved parent updates.

Risks:

- `app/api/storage/upload/route.ts` returns a signed URL valid for 30 days after upload. That is too broad for medical documents, ID documents, incident evidence, and inspection evidence.
- Document reads/downloads use generic CRUD (`app/api/documents/route.ts`) and do not yet show a dedicated audited download endpoint.
- Inspection report routes can render report evidence links and downloadable HTML after `requireUser()`, relying on downstream RLS/query behavior rather than explicit role/garden/inspector/parent visibility checks in the route.
- `app/api/inspections/[id]/submit/route.ts` stores inspection signatures using a signed URL valid for 365 days.
- There is no universal `file_viewed` / `file_downloaded` audit event for every sensitive file access.

Recommended fix:

- Replace long-lived signed URLs with short-lived, purpose-scoped access URLs generated only at view/download time.
- Add a file access service that enforces role, garden, child, inspector assignment, evidence visibility, and parent-safe rules.
- Log every sensitive view/download with file ID, bucket, path, viewer, role, IP, device, purpose, and result.

### Camera Viewing Security

Classification: partially implemented, with strong parent token path.

Positive controls:

- `app/api/camera-streams/[id]/playback-token/route.ts` applies the `video:stream` permission and rate limiting before token creation.
- `lib/domain/video-streaming.ts` enforces parent WebRTC-only viewing, active parent camera policy, approved camera list, viewing hours, MFA, parent-child relationship, child checked-in status, room matching when available, short token expiration, watermarking, and audit logs.
- Direct RTSP playback URLs are blocked when creating a playback session.
- Camera authorization checks, access audit trail, playback sessions, and view logs are recorded.

Risks:

- `createCrudHandlers` and multiple camera dashboards still select `hls_playback_url`, `sample_hls_url`, and `webrtc_playback_url`.
- `components/camera-playback-card.tsx` uses direct URL fields to determine whether playback is available.
- Admin/manager/inspector camera pages need to avoid exposing raw gateway URLs unless masked diagnostics are strictly required.
- HLS is still available for non-parent roles; policy should confirm whether staff/inspector HLS is acceptable or must also be WebRTC-only.

Recommended fix:

- Make all camera cards rely on capability/status fields and the playback-token endpoint, not raw playback URLs.
- Keep raw stream fields server-side only or admin masked diagnostics only.
- Add automated tests for MFA missing, child checked-out, outside viewing hours, unapproved camera, other-garden parent, and RTSP URL exposure.

### Parent Access Isolation

Classification: partially implemented.

Positive controls:

- Parent attendance and pickup contact routes explicitly derive linked child IDs from the authenticated parent.
- Parent camera list uses `getParentCameraListForProfile` and scopes by parent/kindergarten relationship.
- Parent playback token creation revalidates parent-child-garden relationship and child presence.

Risks:

- `lib/roles.ts` grants parents broad permissions including `ai_events:read`, `medical_data:read`, `documents:read`, and `documents:download`; each route must independently enforce child/garden visibility.
- Generic CRUD endpoints can become risky if exposed to parent routes without strict filters.
- Parent AI pages and APIs need a route-by-route proof that raw AI events, raw observer signals, internal investigations, and confidence scores are never returned.
- Incident case evidence is internal by default in schema, but parent-facing complaint/status surfaces should be explicitly checked against `approved_parent_update` only.

Recommended fix:

- Add parent isolation tests for other child, other garden, raw AI event, internal incident case, internal document, and unapproved camera.
- Replace broad parent-sensitive permissions with action-specific server checks.
- Create a parent-safe data mapper for AI, incidents, documents, pickup, camera, and timelines.

### Security Headers and Deployment

Classification: partially implemented.

Implemented:

- `vercel.json` sets Content-Security-Policy, HSTS with `max-age=63072000; includeSubDomains; preload`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and `Permissions-Policy`.
- `Permissions-Policy` disables microphone and limits geolocation/payment/camera to self.
- Server-only secrets are accessed through `process.env` in server code, and the storage upload route explicitly requires server-side service-role configuration.

Risks:

- CSP still allows `'unsafe-inline'` and `'unsafe-eval'`, which may be needed during current Next.js operation but is not ideal for high-security launch.
- `media-src` and `connect-src` allow broad `https:` / `wss:`; production should narrow them to Supabase, Vercel, gateway, and approved provider domains.
- The app should keep verifying no `SUPABASE_SERVICE_ROLE_KEY` or service role secret is exposed through `NEXT_PUBLIC_*` variables or client bundles.

Recommended fix:

- Keep current headers as a baseline, then harden CSP by environment.
- Add a CI check for `NEXT_PUBLIC_.*SERVICE|SERVICE_ROLE|SECRET|PRIVATE|TOKEN`.
- Maintain provider allowlists for Supabase, payment, push, SMS, WhatsApp, and camera gateways.

### CI/CD Security Gates

Classification: partially implemented.

Implemented:

- `.github/workflows/deploy.yml` runs typecheck, build, `npm audit --audit-level=high`, CodeQL, and Gitleaks.
- `.github/workflows/production-checks.yml` runs typecheck and build on pull requests and main/master pushes.

Risks:

- The workflow is readiness-level; it does not by itself prove branch protection is configured to block merges/deployments on failure.
- Dependency scanning uses `npm audit`, but there is no visible Dependabot or explicit high/critical policy dashboard in the repo.
- Secret scanning readiness exists through Gitleaks, but production requires GitHub Advanced Security or equivalent organization settings if available.

Recommended fix:

- Mark security gate workflows as required checks in GitHub branch protection.
- Add Dependabot or scheduled dependency review if the organization allows it.
- Document that Vercel production deployment must wait for these checks and protected environment approval.

### Digital Observer Architecture Notes

Classification: implemented as architecture readiness; future Digital Observer only for advanced capabilities; requires legal review for identity-related capabilities.

Confirmed direction:

- Digital Observer Core capabilities should remain in the same repository for now and be restricted through policy, not deleted.
- Gan Batuach Israel Mode disables audio and face recognition.
- Skeleton analytics, pose estimation, motion analytics, fall detection, inactivity detection, crowding detection, and restricted area detection are allowed with human review.
- Contextual child association, gait recognition, persistent skeleton identity, and soft biometric matching must stay `legal_review_required` unless approved.
- Future capabilities should remain in Digital Observer Core and be activated per vertical via the capability matrix.

Recommended fix:

- Build one executable capability check service used by API routes, server components, and background jobs.
- Add production tests proving Gan Batuach cannot activate audio, face recognition, biometric matching, raw AI parent visibility, or child identity inference.

## Regulatory Status by Phase Area

| Phase | Recommended Status | Notes |
| --- | --- | --- |
| 145 Israeli Regulatory Mode | partially implemented | Policy tables exist; enforcement must be attached to routes/UI/services. |
| 146 Privacy/Security High Security | partially implemented | Readiness tables and encryption helpers exist; global MFA and medical encryption adoption incomplete. |
| 147 Legal Camera Streaming | partially implemented / strong camera token path | Parent token flow is strong; remove direct URL reliance from UI and add native anti-leak controls. |
| 148 Legal Attendance/Pickup | partially implemented | GPS/signature/no-biometric direction exists; validate every attendance path and storage rule. |
| 149 Responsible AI Governance | partially implemented | DPIA/capability structures exist; runtime capability checks need enforcement. |
| 150 ISO Readiness | partially implemented | ISO tables and dashboard exist; request audit persistence and operational evidence coverage need work. |
| 151 Digital Observer Core Separation | implemented as architecture readiness | Capability/profile mapping exists; no repo split yet, as required. |
| 152 Skeleton Analytics | implemented as architecture readiness | Skeleton-only model exists; production ingestion, retention, and frame wipe need runtime proof. |

## Recommended Implementation Order for Phases 145-160

1. Phase 145: enforce regulatory capability guards in routes, dashboards, and services.
2. Phase 146: implement global MFA enforcement, sensitive data access gates, and medical encryption write/read service.
3. Phase 147: make camera playback token-only in UI and add automated policy tests for parent viewing.
4. Phase 148: finish GPS/signature attendance checks and confirm no biometric or camera-based attendance path is active.
5. Phase 149: enforce AI governance checks before any AI event can become visible or actionable.
6. Phase 150: persist request audit logs, validate immutable audit triggers, and complete ISO evidence coverage.
7. Phase 151: finalize Observer Core capability boundaries without extracting repositories.
8. Phase 152: wire skeleton-only ingestion runtime, frame disposal, retention controls, and parent visibility boundaries.
9. Phase 153: disable Gan Batuach audio/face/biometric routes and UI using feature gates, without deleting future Digital Observer code.
10. Phase 154: backfill medical plaintext into encrypted columns and remove plaintext rendering from dashboards.
11. Phase 155: complete MFA enrollment, recovery, backup codes, and enforcement UX for all roles.
12. Phase 156: make all compliance evidence logs append-only and add audit read dashboards.
13. Phase 157: run RLS/service-role boundary tests for parent, staff, manager, inspector, admin, and network manager.
14. Phase 158: implement Capacitor anti-capture controls for video screens and sensitive medical screens.
15. Phase 159: run parent visibility QA for AI summaries, incidents, investigations, documents, camera sessions, and timelines.
16. Phase 160: production legal review, DPIA sign-off, security review, pilot readiness sign-off, and external provider validation.

## External Provider Boundaries

The following should remain provider integrations within the current architecture, not new infrastructure frameworks:

- SMS OTP and SMS messaging: provider adapter via Vercel environment variables.
- WhatsApp notifications: provider adapter via Vercel environment variables.
- Push notifications: FCM/APNs via existing push provider abstraction.
- Payment providers: Tranzila/Meshulam/Cardcom/Pelecard/Stripe readiness via payment gateway abstraction.
- Video gateways: WebRTC/MediaMTX/go2rtc/Janus via gateway abstraction; no direct RTSP to clients.
- Log export/SIEM: future external provider only if compliance requires it.

## No-Code-Deletion Decision

No code should be deleted in this pass. The safer sequence is:

1. Add executable capability gates.
2. Disable Gan Batuach-restricted paths at runtime.
3. Preserve future Digital Observer modules behind legal-review controls.
4. Migrate sensitive data storage.
5. Remove or archive legacy code only after legal and product approval.

## Launch Blockers Before Production

- Gan Batuach must not expose audio processing in any active route or page.
- Gan Batuach must not expose face recognition, face matching, or biometric identity flows.
- Parent AI routes must be proven to return only approved parent-safe summaries.
- Medical data must stop being written/read in plaintext fields.
- MFA must be enforced for all production users, at minimum before sensitive actions.
- Camera playback must be token-only and gateway-only for all non-admin viewing.
- Request audit logs must be persisted, not console-only.
- Immutable audit protection must cover every table used as official evidence.
