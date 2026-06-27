# PILOT FIX 2 - Supabase/RLS Security Closure Report

Date: 2026-06-27

## Summary

PILOT FIX 2 completed the local repository security/RLS closure plan and static review, but did not close the real Supabase gate because the target Supabase environment was not reachable from this workspace.

Final recommendation:

`RLS_MANUAL_SUPABASE_VERIFICATION_REQUIRED`

Real pilot cannot proceed from an RLS/security perspective until Daniel runs the manual Supabase verification plan and all critical/high tests pass.

## Build Baseline

- `npm run typecheck`: passed.
- `npm run build`: passed.
- `git diff --check`: passed.

## Environment Inventory

Created:

- `PILOT_FIX_2_SUPABASE_ENVIRONMENT_INVENTORY.md`

Key result:

- local migrations exist
- Supabase CLI not available in this shell
- no direct target DB verification was possible
- manual SQL Editor or external CLI verification is required

## Sensitive Data Inventory

Created:

- `PILOT_FIX_2_SENSITIVE_DATA_SURFACE_INVENTORY.md`

Highest-risk surfaces:

- children and parent-child links
- documents and storage buckets
- staff/inspector assignments
- payments/provider events
- camera streams/tokens
- raw AI events/review queue
- audit logs
- Digital Observer sites/events/billing separation

## Role Access Matrix

Created:

- `PILOT_FIX_2_ROLE_ACCESS_MATRIX.md`

The matrix defines allowed/denied access for:

- public/anonymous
- parent states
- staff states
- manager states
- inspector states
- admin
- Digital Observer customer/admin

## Migration Verification Status

Created:

- `PILOT_FIX_2_MIGRATION_STATUS_VERIFICATION.md`

Local critical migrations are present:

- `20260616000100_parent_rls_scope_hardening.sql`
- `20260616000200_payment_provider_rls_scope_hardening.sql`
- `20260627000100_prod1_provider_webhooks_demo_freeze_readiness.sql`

Remote status:

- not verified
- manual required

## Manual Verification Plan

Created:

- `PILOT_FIX_2_REAL_SUPABASE_MANUAL_VERIFICATION_PLAN.md`

This includes:

- synthetic users
- synthetic data set
- RLS catalog checks
- policy inventory queries
- storage bucket checks
- role-specific positive/negative tests
- pass/fail evidence template

## Parent RLS Result

Status:

`MANUAL_REQUIRED`

Local evidence:

- parent hardening migration exists
- parent child-specific helper functions exist locally
- parent camera list uses safe columns and policy filtering

Not proven:

- Parent A cannot see Child B
- Parent A cannot list whole kindergarten children
- Parent A cannot access Child B document signed URL
- Parent A cannot see raw AI/camera/payment/provider data

## Staff RLS Result

Status:

`MANUAL_REQUIRED`

Not proven:

- unassigned staff sees no children/parents/internal garden data
- assigned staff sees only own kindergarten scope
- staff cannot access payment/provider records or raw camera/AI secrets

## Manager RLS Result

Status:

`MANUAL_REQUIRED`

Local evidence:

- `can_manage_garden(target_garden_id)` exists in parent hardening migration
- camera status mutation checks manager garden ownership

Not proven:

- Manager A cannot access Kindergarten B records
- pending manager cannot access active manager capabilities

## Inspector RLS Result

Status:

`MANUAL_REQUIRED`

Local evidence:

- `can_inspector_access_garden(target_garden_id)` exists in parent hardening migration
- camera playback checks assigned inspected garden for inspector

Not proven:

- unassigned inspector cannot see gardens
- assigned inspector cannot see unassigned gardens/cameras/AI/payment records

## Admin Access Result

Status:

`MANUAL_REQUIRED`

Static evidence:

- many admin mutating routes use `requireRole(["admin"])`
- service-role client is centralized server-side
- no client-component service-role import was found by static scan

Remaining concerns:

- admin RLS policies must be verified live
- admin UI/API must not expose raw secrets in payloads
- admin signed URL access must remain scoped/audited

## Payment/Provider RLS Result

Status:

`MANUAL_REQUIRED`

Local evidence:

- payment/provider hardening migration exists
- policies exclude inherited staff/inspector operational access and use admin/manager scope

Not proven:

- parent/staff/inspector cannot read provider webhook/payment tables
- manager sees only own garden subscription
- admin sees platform status without secrets

## Storage/Signed URL Result

Status:

`MANUAL_REQUIRED`

Local evidence:

- sensitive bucket definitions are local and private in migration
- upload route uses server-side service role, role bucket allow-list, type/size validation, audit log, and 10-minute TTL for sensitive files

Not proven:

- target Supabase bucket flags are private
- unauthorized signed URL generation is impossible
- no sensitive object exists in public storage

## Camera Security Result

Status:

`MANUAL_REQUIRED`

Local evidence:

- playback session logic blocks direct RTSP/private hosts from browser playback URLs
- parent viewing requires policy, legal capability, MFA, child relation, attendance presence, viewing hours, token, and audit
- token TTL is bounded to 60-300 seconds

Not proven:

- live API payloads never return RTSP/local IP/credentials
- wrong parent/manager/inspector cannot issue tokens

## AI Event Security Result

Status:

`MANUAL_REQUIRED`

Static evidence:

- mock AI camera event creation is admin-only and sets `parent_visible=false`, `shadow_mode=true`, and human review metadata

Remaining risk:

- generic `ai_events` CRUD read permission relies on RLS for raw parent denial
- parent raw AI denial must be tested against the live database

## Digital Observer Separation Result

Status:

`MANUAL_REQUIRED`

Static evidence:

- Digital Observer separation migrations and product-context modules exist locally

Not proven:

- Gan Batuach parent cannot access Observer site data
- Digital Observer customer cannot access Gan Batuach children/cameras/events

## API Route Security Result

Created:

- `PILOT_FIX_2_API_ROUTE_SECURITY_REVIEW.md`

Status:

`MANUAL_SUPABASE_AND_API_NEGATIVE_TESTS_REQUIRED`

No code changes were applied in this phase because no critical live failure was proven from the local environment.

## Fixes Made

No code or policy fixes were made.

Documentation and verification artifacts were created only.

## Remaining Blockers

Critical:

1. target Supabase migration status unverified
2. sensitive table RLS catalog unverified
3. parent/child isolation unverified
4. manager/staff/inspector assignment boundaries unverified
5. sensitive storage bucket privacy and signed URL denial unverified
6. payment/provider table isolation unverified
7. raw AI parent denial unverified
8. camera credential/token negative tests unverified
9. Digital Observer separation unverified

High:

1. generic API CRUD object ownership relies on RLS for multiple tables
2. admin UI/API secret payload review requires live testing
3. error-message hardening should be considered for sensitive production routes

## Final Recommendation

`RLS_MANUAL_SUPABASE_VERIFICATION_REQUIRED`

Real pilot remains blocked.

It is safe to proceed to `PILOT FIX 3 - Legal, Privacy, Consent & Child Data Documentation Closure` as a parallel preparation phase, but not to any real-user pilot until PILOT FIX 2 manual Supabase signoff is complete.

