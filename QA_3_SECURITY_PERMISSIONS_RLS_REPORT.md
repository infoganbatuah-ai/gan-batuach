# QA 3 - Security, Permissions, RLS Report

Date: 2026-06-16

Mode: Stronger Codex security QA.

Scope: role isolation, self-service affiliation access, RLS policies, server-side route checks, sensitive data boundaries, payments visibility, camera access, AI observer access and audit coverage.

No code, RLS, auth, payment, camera or AI logic was changed in this QA pass.

## Verification Baseline

| Check | Result |
| --- | --- |
| Current branch | `main` |
| Pre-QA working tree | Clean at start |
| Latest commit at start | `e8a9834 QA 2B – Auth, App Gateway & Registration UX Recheck` |
| `npm run typecheck` | Passed |
| `npm run build` | Passed |
| `git diff --check` baseline | Passed |

## Documents Reviewed

The following QA/phase documents existed during review:

- `QA_1_CORE_PRODUCT_SMOKE_TEST_REPORT.md`
- `QA_2_FULL_USER_JOURNEY_QA_REPORT.md`
- `QA_2B_AUTH_APP_GATEWAY_REGISTRATION_UX_RECHECK_REPORT.md`
- `KINDERGARTEN_MANAGER_SELF_SERVICE_ONBOARDING_ADMIN_APPROVAL_AND_SUBSCRIPTION_ACTIVATION.md`
- `PHASE_190C_UNIFIED_APP_EXPERIENCE_REPORT.md`
- `PHASE_190D_AUTH_REGISTRATION_CITY_PAYMENTS_FINALIZATION_REPORT.md`

## Routes And Areas Reviewed

Reviewed representative sensitive routes and helpers:

- Auth/role helpers: `lib/auth.ts`, `lib/roles.ts`
- Generic CRUD wrapper: `lib/crud-route.ts`
- Parent self-service: `app/api/parent/child-profiles/route.ts`, `app/api/parent/enrollment-requests/route.ts`
- Parent medical/timeline routes: `app/api/parent/medical/route.ts`, `app/api/parent/timeline/route.ts`
- Parent cameras: `app/api/parent/cameras/route.ts`, `lib/domain/parent-camera-list.ts`, `lib/domain/parent-camera-access.ts`
- Camera playback: `app/api/camera-streams/[id]/playback-token/route.ts`, `lib/domain/video-streaming.ts`
- Manager enrollment approval: `app/api/garden/enrollment-requests/[id]/route.ts`
- Staff application approval: `app/api/garden/staff-applications/[id]/route.ts`
- Staff candidate application: `app/api/staff/job-applications/route.ts`
- Inspector application/admin approval: `app/api/inspector/applications/route.ts`, `app/api/admin/inspector-applications/[id]/route.ts`
- Documents/storage: `app/api/documents/route.ts`, `app/api/storage/upload/route.ts`
- AI observer: `app/api/ai-camera-events/route.ts`, `app/api/ai-camera-events/[id]/action/route.ts`
- Billing/subscription: `app/api/garden/subscription/route.ts`
- Admin audit/search/users: `app/api/audit-logs/route.ts`, `app/api/admin/search/route.ts`, `app/api/admin/users/route.ts`

Reviewed representative migrations:

- `20260523000000_initial_schema.sql`
- `20260523010000_premium_daily_child_operations.sql`
- `20260527005000_parent_camera_rls_access.sql`
- `20260527006000_multi_kindergarten_parent_child_architecture.sql`
- `20260602002000_security_hardening_rls_storage.sql`
- `20260602003000_subscription_billing_platform.sql`
- `20260602007000_ai_digital_observer_architecture.sql`
- `20260612014100_enterprise_administration_multi_network_regional_operations.sql`
- `20260612015000_iso_certification_readiness_platform.sql`
- `20260612019200_self_service_registration_affiliations.sql`

## Role Access Matrix

| Role/state | Expected access | QA status |
| --- | --- | --- |
| Logged-out visitor | Public marketing, `/app`, auth and public Digital Observer only | Source routes support this; live middleware behavior not browser-tested in this QA |
| Unassigned parent | Own profile, own child profile, discovery, own requests | Dedicated self-service APIs follow this pattern |
| Active parent | Own child, approved kindergarten relationship, policy-approved camera access | Blocking RLS concern: garden-scoped RLS may over-grant if `profile.garden_id` is set |
| Pending manager | Own draft/application/onboarding only | Needs full live route check; server routes use role/garden scoping |
| Active manager | Own kindergarten children, parents, staff, requests, docs, subscription | Server routes reviewed are scoped by `profile.garden_id` |
| Staff candidate | Own profile/applications and public openings only | Candidate application route follows this pattern |
| Approved staff | Assigned kindergarten only | RLS/generic CRUD depends on `profile.garden_id`; needs regression review |
| Inspector candidate | Own application only | Inspector application RLS and route checks follow this pattern |
| Approved inspector | Assigned gardens only | Camera and AI action routes check assignment; live DB review needed |
| Admin | Platform-wide administrative access | Admin routes reviewed require `admin` role |

## Findings

### Fixed / Requires Recheck - Parent Access Can Be Too Broad Through Garden-Scoped RLS

Classification before fix: `blocking`, `requires_stronger_model`, `requires_manual_review`

Status after security fix: `fixed`, `requires_recheck`

The latest `public.can_access_garden(target_garden_id)` function grants access when an active profile has `p.garden_id = target_garden_id`. It does not exclude parent profiles. Several sensitive policies use `public.can_access_garden(garden_id)` for whole-garden access.

Evidence:

- `supabase/migrations/20260612014100_enterprise_administration_multi_network_regional_operations.sql:255` grants by `p.garden_id = target_garden_id`.
- `supabase/migrations/20260612015000_iso_certification_readiness_platform.sql:313` includes `public.can_access_garden(garden_id)` in `children` read policy.
- `supabase/migrations/20260523010000_premium_daily_child_operations.sql:114` and nearby policies use `public.can_access_garden(garden_id)` for medical/medicine/journal tables.

Impact:

If an active parent profile has `garden_id`, RLS can allow whole-kindergarten reads for tables that should be child-scoped for parents. Affected areas may include children, health records, medicine logs, journals, documents, billing visibility and any generic CRUD route where parent role has the relevant permission.

Fix applied after QA 3:

`supabase/migrations/20260616000100_parent_rls_scope_hardening.sql` narrows `can_access_garden` to operational non-parent access and adds granular helpers such as `can_manage_garden`, `can_parent_access_child`, `can_access_child_record`, `can_access_sensitive_child_data` and `can_access_document`. Sensitive policies were hardened for children, medical records, documents, child timelines, payments, attendance, complaints, camera JWT reads and AI events.

Required recheck:

Run QA 3B with live/staging Supabase policies and role fixtures to verify parent, manager, staff, inspector and admin behavior.

### Partially Fixed / Requires Recheck - Generic Parent-Accessible Routes Depend On RLS For Child/Medical Isolation

Classification before fix: `high`, `requires_stronger_model`

Status after security fix: `partially_fixed`, `requires_recheck`

Some routes use the generic CRUD handler and broad permissions:

- `app/api/children/route.ts` uses `children:read`, which parent role has.
- `app/api/parent/medical/route.ts` points to `medical_events` through generic CRUD.
- `app/api/parent/timeline/route.ts` points to `incident_timeline` through generic CRUD.
- `app/api/child-health-records/route.ts` allows parent role and relies on RLS/query params for read narrowing.

These routes are only safe if RLS is strictly child-scoped for parents. The security fix hardens the relevant RLS helpers and sensitive policies, but these routes still require QA 3B regression with real role fixtures.

### Fixed / Requires Recheck - Storage Upload Signed URLs Are Valid For 30 Days

Classification before fix: `high`, `requires_manual_review`

Status after security fix: `fixed`, `requires_recheck`

`app/api/storage/upload/route.ts:73` previously created a signed URL with `60 * 60 * 24 * 30`, or 30 days.

Impact:

For child documents, medical files, staff ID documents, police clearance, sexual offense clearance, inspection evidence and regulatory documents, a 30-day URL increases exposure if a link is copied, logged or forwarded.

Fix applied after QA 3:

Storage upload signed URLs are now 10 minutes for sensitive buckets and 15 minutes for logo/gallery previews. Inspection signature/evidence signed URLs were reduced from 365 days to 10 minutes.

Remaining recommendation:

A dedicated secure document download endpoint should still be added later so every download performs a fresh authorization check and writes a document access audit event.

### Medium - Upload Authorization Is Role/Bucket Based, Not Entity-Ownership Based

Classification: `medium`, `requires_stronger_model`

`app/api/storage/upload/route.ts` validates role, bucket and mime type, but the route accepts a client-provided `prefix`. The stored path includes `profile.garden_id` and `profile.id`, which helps contain uploads. However, it does not validate that a child/document entity referenced by the prefix belongs to the actor.

Recommended fix:

For sensitive document flows, move from generic upload to entity-bound upload intents. The server should issue an upload path only after confirming the actor can access the target child/staff/application/document.

### Medium - Self-Service Registration Persists Basic Identity But Not Every Role-Specific Field

Classification: `medium`, `deferred`

The role-specific registration UX collects role-specific fields, but `app/api/self-service/register/route.ts` primarily persists common fields and stores limited metadata. This is not an immediate access leak, but staff/inspector/manager review completeness depends on follow-up application/profile pages.

Recommended fix:

Persist role-specific non-secret profile fields to the correct candidate/application table or explicitly route users to complete those details after account creation.

### Medium - Live DB RLS Introspection Was Not Performed

Classification: `medium`, `requires_manual_review`

This QA reviewed migrations/source, not the deployed Supabase catalog. Production readiness requires verifying the applied database state:

- RLS enabled on every sensitive table.
- No unexpected permissive policies.
- Helper functions match the latest migration.
- Storage policies and buckets are private.
- Service-role key is server-only.

## Positive Findings

### Self-Service Enrollment APIs Use Good Server-Side Ownership Checks

Parent child profile creation sets `primary_parent_profile_id = profile.id`. Enrollment request creation verifies the child profile belongs to the current parent before creating a request. Manager approval scopes the request by `profile.garden_id`.

### Staff And Inspector Application Approval Flows Are Scoped

Staff application approval requires manager/owner role and `profile.garden_id`, then loads the application by both id and garden. Inspector approval is admin-only.

### Camera Playback Has Strong Guardrails

Camera playback token creation includes:

- `video:stream` permission check.
- Rate limiting.
- Parent WebRTC-only restriction.
- Parent camera policy check.
- Capability matrix check.
- MFA gate.
- Parent-child-camera authorization.
- Child present in kindergarten requirement.
- Room/class matching.
- RTSP rejection.
- Short token expiry.
- Watermark and audit logs.

This is an appropriate production direction, subject to external camera gateway review.

### AI Observer Events Are Human-Review Oriented

Admin-created AI camera events default to `shadow_mode`, `requires_human_review`, and `parent_visible=false`. `ai_camera_events` RLS restricts access to admin and manager/owner/inspector garden-scoped review.

### Public Insert Policies Are Limited To Public Intake Tables

Policies with `with check (true)` were found only for lead/demo/public website event intake tables, not core child, medical, payment, camera or document tables.

## Payment Visibility Findings

Gan Batuach subscription records are RLS-scoped by admin or `can_access_garden(garden_id)`. Because of the parent garden-scope issue, parent profiles with `garden_id` may be able to select kindergarten subscription/billing rows if a client route or direct Supabase client queries them. This should be fixed by the broader RLS patch before production.

Provider activation, live payment flows and invoice webhooks should be reviewed in QA 4.

## Camera Access Findings

No direct RTSP exposure was found in the playback token path. Parent camera list and token flow sanitize and re-evaluate access. Remaining review items:

- Live gateway URLs and token validation must be tested.
- Storage/log access for snapshots/clips must use short-lived authorization.
- Inspector camera access should be tested with assigned and unassigned gardens.

## AI Access Findings

No raw AI parent exposure was found in the reviewed `ai_camera_events` path. Remaining review items:

- Legacy AI routes using generic CRUD should be reviewed after the parent RLS patch.
- External AI provider callbacks should verify signatures and product/capability boundaries in provider QA.

## Audit Gaps

Audit logging exists for:

- Parent child profile creation.
- Enrollment request submission and manager decision.
- Staff application submission and manager decision.
- Inspector application submission and admin decision.
- Camera playback token/session creation.
- AI event creation/review.
- Storage upload.
- Medical record access/update.

Gaps to review:

- Download/access audit for every sensitive document retrieval.
- Direct Supabase client reads are not necessarily application-audited.
- Parent timeline/medical generic reads need route-specific audit after RLS correction.
- Billing/payment state changes require QA 4 provider review.

## Go / No-Go For QA 4

Recommendation: proceed to QA 4 only as provider/payment QA, not as production approval.

Blocking before production:

1. Run QA 3B against the RLS hardening migration.
2. Add live Supabase policy introspection evidence.
3. Verify short-lived signed URLs in real storage flows.
4. Re-test parent, staff, manager, inspector and admin access after RLS patch.

## Changes Made

No security code or policy changes were made.

Created reports:

- `QA_3_SENSITIVE_ACCESS_AND_RLS_INVENTORY.md`
- `QA_3_SECURITY_PERMISSIONS_RLS_REPORT.md`

Security fix follow-up:

- `SECURITY_FIX_PARENT_RLS_SCOPE_AND_SIGNED_URL_REPORT.md`
- `supabase/migrations/20260616000100_parent_rls_scope_hardening.sql`
