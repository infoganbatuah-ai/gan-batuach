# External Security Audit And Hardening Guide

This guide treats Gan Batuach and Digital Observer as if real kindergartens, parents, children, inspectors and cameras are already connected.

The goal is external-audit-grade readiness before customer deployment.

## Current Security Posture

Security command center:

```text
/dashboard/admin/security-center
```

Existing internal security center:

```text
/dashboard/admin/security
```

The platform now tracks:

- External audit domains
- Security findings
- RLS audit report
- API security audit report
- Penetration testing checklist
- Recovery procedures
- Secret readiness
- Backup readiness
- Compliance readiness

## Findings Discovered In This Pass

### Critical: Rotate Local Environment Secrets

Real-looking server secrets were found in the local environment file. The values were not copied into this guide, migration, UI, logs or final report.

Required fix:

- Rotate Supabase service role key before real deployment
- Rotate gateway/provider secrets if any local value was used outside development
- Store production secrets only in managed hosting/provider vaults
- Never commit `.env.local`

Status:

```text
open
```

### Critical: Legal Review For Camera And Child Data

Real kindergarten deployment requires formal privacy, consent, retention and child-data protection review.

Required fix:

- Final privacy policy
- Final terms
- Parent/camera consent process
- Child-data retention policy
- Camera viewing rules
- Data deletion/export process

Status:

```text
open
```

### High: Temporary Password Visibility Review

Provisioning flows expose temporary credentials to privileged users for delivery. This may be acceptable during onboarding, but production must reduce exposure.

Required fix:

- One-time temporary passwords
- Expiry window
- Forced password change
- Redaction in production logs
- Hide after first delivery/reset where possible

Status:

```text
open
```

### High: API ID Ownership Testing Required

API routes generally use role guards, but external testing must verify every route that accepts IDs.

Required fix:

- Test `garden_id`
- Test `child_id`
- Test `camera_id`
- Test `document_id`
- Test `user_id`
- Test cross-garden and cross-parent requests

Status:

```text
open
```

### High: Backup Restore Dry Run Required

Backups are not production-ready until restore is proven.

Required fix:

- Database restore dry run
- Storage restore dry run
- Auth configuration recovery
- Migration replay procedure
- Evidence recorded

Status:

```text
open
```

## Hardening Already In Place

- Admin dashboards use role checks
- Many API routes use `requireRole`
- RLS is enabled across core tables
- Camera UI avoids raw RTSP/password fields in browser payloads
- Playback uses permission/token architecture
- Observer remains human-review only
- Communication providers remain readiness/test-mode by default
- Security findings and audit domains are now tracked
- RLS/API audit reports are now available for admin review
- Penetration testing checklist is generated

## Authentication Audit

Review areas:

- Login
- Logout
- Password reset
- First login onboarding
- Session expiration
- Account activation
- Role switching

Required tests:

- Expired session cannot access dashboard
- Parent cannot open admin/manager/staff routes
- Staff cannot open manager/admin routes
- Manager cannot access another garden
- Role cannot be changed by client payload
- Password reset does not reveal account state beyond safe messaging

## Authorization Audit

Roles to test:

- Admin
- Owner
- Manager
- Parent
- Staff
- Inspector
- Observer site owner

Expected result:

- Admin can access all operational admin data
- Owner/manager scoped to own garden
- Parent scoped to own children and approved camera permissions
- Staff scoped to assigned garden/team workflows
- Inspector scoped to assigned gardens
- Observer site owner scoped to own observer sites only

## RLS Audit

High-risk tables:

- `profiles`
- `gardens`
- `children`
- `parents`
- `staff`
- `documents`
- `camera_streams`
- `parent_camera_permissions`
- `video_stream_sessions`
- `observer_sites`
- `communication_logs`
- `audit_logs`

External tester should use direct Supabase calls with role tokens and verify:

- No cross-garden access
- No cross-parent child access
- No unauthorized document access
- No unauthorized camera access
- No observer site data leakage

## API Security Audit

External tester should review:

- `/api/admin/*`
- `/api/garden/*`
- `/api/parent/*`
- `/api/camera-streams/*`
- `/api/video-gateway/*`
- `/api/observer-*`
- `/api/cron/*`

Verify:

- Authentication is required where needed
- Authorization is server-side
- IDs are ownership-checked
- Request bodies cannot mass-assign roles or scope
- Client role is never trusted
- Secrets are never returned

## Camera Security Audit

Verify:

- RTSP URL never reaches browser
- Camera usernames/passwords never reach browser
- Gateway API keys never reach browser
- Playback requires permission
- Playback tokens expire
- Parent access is camera-scoped
- Camera access is audited

## Observer Security Audit

Verify:

- No automatic accusations
- No disciplinary automation
- No biometric assumptions
- No child profiling
- No staff scoring
- No unauthorized observer access
- Human review is mandatory

## Communication Security Audit

Review:

- WhatsApp logs
- SMS logs
- Email logs
- Push logs

Verify:

- No provider secrets in logs
- No production temporary passwords in logs
- Recipients are scoped
- Opt-in/preference model is respected
- Delivery trail exists

## Secrets Management Audit

Production requirements:

- No real secrets in repository
- No real secrets in client bundle
- No server-only key in `NEXT_PUBLIC_*`
- Service role key used only server-side
- Gateway secrets server-only
- AI/provider keys server-only
- Rotation procedure documented and tested

Immediate hardening:

```text
Rotate any real-looking secret that was stored locally before customer deployment.
```

## Audit Logging Coverage

Required audit events:

- User creation
- Role changes
- Kindergarten approval
- Document review
- Camera access
- Camera changes
- Observer actions
- Security actions
- Payment/subscription changes
- Communication delivery

Current gap:

Some audit catalog events are marked not implemented and need production wiring.

## Backup And Recovery Procedure

Database recovery:

1. Export latest backup metadata.
2. Create isolated restore project.
3. Restore database backup.
4. Run migrations.
5. Validate admin, manager, parent and camera queries.

Storage recovery:

1. Export private buckets.
2. Restore into isolated bucket.
3. Validate signed URL policies.
4. Verify document access by role.

Auth recovery:

1. Verify redirect URLs.
2. Verify admin recovery account.
3. Recreate provider config.
4. Test login, reset and logout.

Secrets recovery:

1. Rotate Supabase service role.
2. Rotate gateway secret.
3. Rotate communication provider keys.
4. Redeploy.
5. Run smoke tests.

## Penetration Testing Checklist

Auth:

- Password reset and session expiration
- Role escalation attempts
- Forced browsing to protected routes

API:

- Mass assignment
- Cross-scope IDs
- Missing auth
- Webhook/cron secrets

Permissions:

- Cross-garden access
- Cross-parent child access
- Staff and inspector boundary tests
- Observer site owner boundary tests

Camera:

- RTSP exposure
- Credential exposure
- Playback without permission
- Expired token replay

Observer:

- Parent raw event access
- Staff raw event access
- Autonomous accusation path
- Disciplinary automation path

Storage:

- Unauthorized document access
- Signed URL replay
- Bucket policy bypass

Communications:

- Provider secret leakage
- Password leakage in logs
- Unsafe recipient changes

Secrets:

- Client bundle scan
- Env var exposure
- Service role usage

Backup:

- Database restore
- Storage restore
- Auth configuration restore

## Remaining Risks

- Critical findings remain open until secrets are rotated and legal/privacy review is complete
- Backup/restore must be proven with a dry run
- Full API ownership testing still needs external evidence
- Some audit events remain readiness-only
- Production camera gateway must be tested with real tokens and scoped permissions

## External Audit Readiness

Current status:

```text
Hardening in progress. Not ready for unrestricted real customer deployment until critical findings are closed.
```

