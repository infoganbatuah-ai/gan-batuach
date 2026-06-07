# Security And Compliance Final Audit

Date: 2026-06-07
Scope: Gan Batuach dashboards, onboarding, camera infrastructure, Digital Observer readiness, communications, Supabase RLS, API routes, secrets, audit logs, backups, and retention readiness.

## Executive Status

Gan Batuach is materially closer to pilot readiness, but it is not yet a fully certified production compliance posture. The application has strong foundations: role-based dashboards, Supabase RLS on core and readiness tables, admin-only security center data, camera playback audit logs, mock-first communications, server-side camera credential handling, and Observer shadow/test flows.

Remaining pre-pilot work is mainly operational and legal: restore drills, final RLS smoke tests against live seeded users, retention policy approval for minors, provider credential rotation process, and human/legal approval of privacy documents.

## RLS Status

Reviewed policy patterns in Supabase migrations for:

- Admin access through `public.is_admin()`.
- Garden-scoped manager/owner/staff access through `public.can_access_garden(...)` and `public.current_garden_id()`.
- Parent access through parent/child relationship tables and dedicated camera permission checks.
- Inspector access through assigned garden scoping.
- Standalone Digital Observer access through `observer_site_memberships`.
- Admin-only readiness tables: security checks, findings, secret inventory, backup readiness, disaster recovery, monitoring, and audit catalog.

Status:

- Core RLS is present across the main schema.
- New security/readiness tables are admin-only.
- Communication provider configuration and test logs are admin-only.
- Observer test/calibration tables are admin-only.
- Camera playback sessions are audited and scoped.

Residual risk:

- A live database RLS matrix test is still required with real seeded users for admin, manager, owner, parent, staff, inspector, and observer site owner.
- Some older broad policies, especially garden-scoped reads, rely heavily on helper functions. Those helpers should be regression-tested before pilot.

## API Status

Reviewed API route patterns for role/session enforcement and ownership scoping.

Positive findings:

- Most operational APIs use `requireRole(...)`, `requirePermission(...)`, or direct Supabase auth checks.
- Cron routes use `CRON_SECRET`.
- Camera status/test routes check manager garden ownership.
- Admin communication, gateway, user, garden, and security routes are admin-only.

Fixed in this audit:

- Public parent join preselection now only returns gardens where `public_profile_enabled = true`.
- RTSP ingest now blocks non-admin users from submitting a different `garden_id`.
- RTSP ingest no longer stores the raw credential-bearing RTSP URL in `source_url`; it stores a masked URL and encrypted sensitive fields.

Residual risk:

- A route-by-route automated permission test suite is still needed.
- Public lead/contact endpoints should stay intentionally public and rate-limited.

## Camera Privacy

Reviewed camera setup, playback, gateway, parent camera access, and camera audit surfaces.

Status:

- RTSP URLs are not intended for browser display.
- Camera passwords are stripped from CRUD payload responses and encrypted before storage.
- Parent playback goes through `canParentViewCamera(...)`.
- Playback sessions write token hashes and audit rows.
- Gateway secrets are server-side environment variables.
- Camera setup stores masked connection summaries for UI display.

Fixed in this audit:

- RTSP ingest now stores masked `source_url` and encrypted source/credentials.
- RTSP ingest response strips encrypted camera fields.

Residual risk:

- Some admin/staff/inspector camera pages display HLS/WebRTC playback URLs. Those are browser-safe playback URLs, not RTSP, but they should be short-lived gateway URLs before real deployment.
- `video_stream_sessions.playback_url` stores gateway playback URLs. Confirm retention and token expiry before pilot.

## AI And Observer Privacy

Reviewed Digital Observer readiness, shadow mode, test center, and calibration model.

Status:

- Observer test/calibration tables are admin-only.
- Shadow mode is present and defaults to safe validation behavior.
- Ground truth review is human-centered.
- Documentation and UI language keep human review mandatory.
- Parent raw Observer event access is not part of the reviewed production path.

Hard rules retained:

- No autonomous disciplinary action.
- No accusations.
- No child profiling.
- No staff scoring.
- No biometric assumptions for discipline.
- Human review remains mandatory.

Residual risk:

- Any future real model integration must pass a separate privacy review before production activation.
- Legal review is required before using AI-derived observations around minors.

## Communication Security

Reviewed WhatsApp, SMS, email, push readiness, delivery logs, templates, and onboarding credential delivery.

Status:

- Real providers remain readiness-only/mock-first unless explicitly configured.
- Communication preferences are modeled.
- Provider configs and test logs are admin-only.
- Recipient phone values are masked where available.

Fixed in this audit:

- Parent/staff invitation logs redact temporary passwords outside dev/sandbox mock mode.
- Kindergarten approval credential logs redact temporary passwords outside dev/sandbox mock mode.

Residual risk:

- The `generated_credentials` table still stores temporary passwords for admin handoff. It is admin-only, but production should replace this with one-time links or encrypted, expiring credentials.
- Template definitions still mention temporary password variables for readiness. Real provider activation must ensure passwords are not stored in provider logs.

## Secrets And Environment

Reviewed `.env.example` and server/client variable naming.

Status:

- No real secrets were found in `.env.example`.
- Server-only variables are labeled for service role, cron, health checks, field encryption, video gateway, communication providers, AI, and passkeys.
- Public variables are limited to expected app URL/Supabase public settings and sandbox flag.

Residual risk:

- Production hosting must verify that service role, field encryption, gateway, provider, and AI keys are not exposed to client bundles.
- Rotation runbooks and ownership should be finalized before pilot.

## Audit Logs

Coverage exists for:

- User provisioning.
- Kindergarten approval and onboarding state changes.
- Camera playback sessions.
- Camera status/gateway actions.
- Child registration and transfer actions.
- Staff approval flows.
- Admin user actions.
- Security readiness catalog.

Remaining gaps:

- Login success/failure events.
- Role/permission changes in every path.
- Subscription/payment changes.
- Observer configuration changes.
- Document review actions in every path.
- Security monitoring event ingestion from live auth/provider signals.

## Backup Readiness

Tracked in admin security center:

- Supabase database backup readiness.
- Supabase Storage backup readiness.
- Configuration backup readiness.
- Secrets recovery readiness.
- Disaster recovery checkpoints.

Status:

- Documentation/readiness tracking exists.
- Real restore tests are not yet complete.

Required before pilot:

- Supabase database restore dry run.
- Private storage bucket export/import test.
- Supabase Auth recovery procedure test.
- Environment/secrets recovery checklist.
- Migration rollback/recovery drill.

## Data Retention Readiness

Prepared model areas:

- Documents.
- Camera playback sessions.
- AI events.
- Audio events.
- Observer events.
- Audit logs.
- Communication logs.

Status:

- Retention fields exist in several camera/observer areas.
- No unsafe automatic deletion was added.

Required before pilot:

- Legal retention schedule for minors.
- Policy for parent document removal requests.
- Policy for camera playback audit retention.
- Policy for AI/audio/observer event retention.
- Immutable audit log retention period.

## Compliance Risks Still Open

- Legal approval for privacy policy, terms, consent, and data processing around minors.
- DPIA or equivalent privacy impact review for camera and AI observer workflows.
- Live RLS and protected-route test using real role accounts.
- Backup restore proof.
- Incident response runbook and owner assignment.
- Production provider security review for WhatsApp, SMS, email, push, video gateway, and AI.
- Replace temporary password delivery with one-time invite/reset links before broad rollout.

## Pilot Gate Recommendation

Proceed only with a controlled pilot after:

- RLS role matrix test passes.
- Production environment secrets are reviewed.
- Restore drill is completed.
- Privacy/consent documents are approved.
- Real camera gateway uses short-lived playback URLs only.
- Observer remains in shadow/test mode with human review.
