# Gan Batuach Management GB-M39 Production Readiness Report

Date: 2026-09-23
Branch: `codex/gb-m39-production-readiness`
Development baseline: `285f3400eb1402a83fea606a5bb2e49525e6eed4`
Production/main: `8113d0607e4282dc8778540aa58c1502367f4221` (unchanged)

# Executive Decision

**GB-M39 engineering hardening is eligible for Development integration, but the cumulative Management state is not yet safe to release to Production.** The migration sequence and application candidate work in isolated rehearsal. Release remains blocked by recoverable plaintext credentials in Production, unverified Production Auth, missing cron/core configuration, incomplete provider-backup and Storage recovery proof, an uncertified project cost ceiling, and the absence of an owner-authorized maintenance window.

# Development to Production Delta

The exact baseline comparison contains 218 commits and 308 changed files: 185 added, 122 modified and 1 deleted. The diff contains 473,318 insertions and 2,000 deletions, heavily influenced by generated baselines and ledgers. It spans Management canonical domains GB-M01–M38, 16 forward Production migrations, role dashboards/reports/routes/APIs, private Storage contracts, Auth/provider configuration requirements and three scheduled routes. It is a consolidated release, not an ordinary feature deployment.

# Migration Plan

Production migration ledger head is `20260913194000`. The repository/linked reconciliation found 38 versions on both sides, 205 historical local-only baseline entries and no Production-only version. Only the 16 later versions in `GAN_BATUACH_MANAGEMENT_PRODUCTION_MIGRATION_PLAN.md` are release candidates. All 16 passed an ordered schema-clone rehearsal. They are not generally replay-idempotent, so ledger control is mandatory.

Migration 12 removes `generated_credentials.temporary_password`; the current Production app still uses that field. The release therefore requires a staged maintenance sequence: migrations 1–11, new application, then migrations 12–16. No Production migration was applied.

# Production Schema Compatibility

A read-only schema dump of Production `public`, `auth` and `storage` restored successfully to isolated Postgres. Production has 812/812 public tables with RLS enabled and 1,172 policies. After the 16 migrations the rehearsal clone had 817/817 public tables with RLS and 1,155 policies. The policy-count change reflects policy replacement/consolidation and requires exact release verification; it is not treated as proof by count alone.

Production aggregate preflight found no duplicate attendance day rows and no current communication-log, notification, pickup or staff-shift rows that conflict with the reviewed constraints. No customer row or secret value was copied into Git evidence.

# Migration Failure / Rollback

An injected failure inside migration 8 rolled the transaction back completely and exact retry passed. The runbook requires one transactional file and ledger update at a time. Application rollback is safe only while the schema remains backward compatible. After migration 12, the old app cannot be restored without a compatible forward repair.

# Backup and Restore

The provider lists eight completed daily physical backups dated 2026-09-15 through 2026-09-22, with WAL-G enabled and PITR disabled. Provider in-place restore was not attempted and is **not proven**.

An isolated synthetic Development custom backup restored successfully: 10,297 archive entries; 20 synthetic Auth users, 4 QA Gardens, 20 profiles, 3 Children and 3 messages were readable. This is `BACKUP RESTORE PROOF: PASS — ISOLATED SYNTHETIC DATA`, not Production-provider restore proof.

# Storage Recovery and Consistency

Eleven Production buckets were inspected read-only. All Management/private and Digital Observer evidence buckets are private; only the intended editorial-images bucket is public. Management buckets use bounded MIME allowlists and 12 MiB limits. No current object sample exists, so live signed access, DB/object consistency and object-backup recovery could not be proven. Database backup alone is insufficient.

# Configuration

`GAN_BATUACH_MANAGEMENT_PRODUCTION_CONFIGURATION_INVENTORY.md` records names/readiness without values. Critical gaps are missing `CRON_SECRET`, canonical app/Auth URL configuration, deep-health secret and unresolved encryption/hash configuration. Passkeys fail closed without explicit RP/origin. Production Supabase Auth settings could not be independently read.

# Development / Production Separation

The isolated QA runtime uses different local database/Auth/Storage services and synthetic identities. Production was accessed read-only. No Production customer account, payment, Email, notification, Storage object, migration or deployment was created or mutated.

# Production Guards and Public Endpoint Hardening

GB-M39 adds a central Production-environment guard and applies it to five internal/demo/test APIs. They now return an unavailable response in Production even to an ordinary Admin. Signup, verification resend, public contact validation, invitation token paths and all passkey mutations now use canonical trusted-origin checks, database-backed rate limits and bounded JSON where applicable. Passkeys fail closed without explicit Production RP/origin configuration. Standard route error handling preserves security statuses and suppresses internal exception text in Production.

# Authentication and Invitations

The candidate retains Supabase Auth, Email verification, recovery, session refresh, signed invitations and passkeys as the existing identity architecture. Invitation contracts are signed, recipient- and Garden-bound, expiring and replay-controlled. No active candidate route creates or returns a plaintext temporary password. Production signup/Email/redirect provider configuration remains unverified and blocks release.

# Providers

- **Resend:** environment names exist; sender/domain, historical live send, webhook and bounce proof are unverified.
- **FCM:** environment names exist; ownership/invalid-token logic and privacy-safe payloads exist; live submission/receipt proof is unverified.
- **SMS/WhatsApp:** optional and unconfigured; they do not block normal Email-verified accounts.
- **Payments/invoicing:** no verified live provider. Manual tuition/subscription workflows must remain truthful; Card/Apple Pay/Google Pay cannot appear available.
- **Digital Observer:** external and optional for core Management. Lack of `production_verified` must show readiness/unavailable, never a live Safety claim.

# Cron and Retention

Vercel config schedules complaint SLA escalation hourly, permit expiry daily and Digital Observer media retention daily. Missing `CRON_SECRET` makes these routes fail closed. No unknown job was enabled. Automatic destructive document/export cleanup remains disabled until owner-approved retention policy exists.

# Security Review

Read-only Production schema inventory found RLS enabled on every public table. Critical IDOR/role boundaries were retested against the isolated candidate through cumulative Management/security/tenant suites. Service-role route review found explicit actor/context, cron-secret, webhook-signature or signed-invitation guards on the inspected paths. Private uploads use server-generated paths, authorization, allowlisted types and 12 MiB limits.

Dependency audit reports 0 critical, 0 high and 6 moderate advisories in the optional Firebase Admin/Google Storage dependency chain. Enabling FCM requires a scoped dependency review; the current result is not a P0/P1 core Management blocker.

# Logging, Errors and Observability

GB-M39 prevents standard Production route errors from returning exception text and logs only bounded error type/code for that path. No active password, verification token, signed URL, private message body or document content logging was found in the reviewed paths. `/api/health` is healthy but reports version `unknown`; release SHA publication remains operational debt. Sentry variable names exist, but live safe telemetry proof is unavailable.

# Health, Performance and Load

Current Production read-only health: homepage/login 200; `/api/health` 200 with application and Supabase OK; deep health correctly returns 401 without its secret. Security headers include CSP, HSTS, frame denial, no-sniff, strict-origin referrer policy and permissions policy.

The built candidate generated 529/529 pages and started in 504 ms. Ten authenticated role-soak rounds produced 40/40 successful dashboard requests. Login p50/p95 was 261/575 ms; protected-route p50/p95 106/372 ms; health p50/p95 13/24 ms.

Bounded synthetic load at concurrency 10 produced 140/140 successful requests across Parent/Garden/Staff/Inspector dashboards, attendance, messages and reporting. Overall p50/p95 was 1,453/1,970 ms, consistent with the GB-M37 Development reference. An unbounded simultaneous 140-request burst timed out locally, so no claim is made for 140 concurrent users or a Production SLA.

# Cost

GB-M39 introduces no paid vendor or permanent resource. `NEW FIXED MONTHLY COMMITMENT: ₪0`; `MONTHLY COST DELTA: ₪0 fixed`, with existing usage-based database/compute/provider traffic unchanged by the hardening itself. Retired AWS infrastructure is excluded from active Gan Batuach runtime; any retained snapshots require separate invoice evidence.

Actual invoices, project allocation and active paying-user denominator were unavailable. The `≤ ₪15 per active paying user/month` target therefore **cannot be certified** and remains a release blocker under the repository contract.

# Release Blockers

The exact blocker and optional-capability classification is in `GAN_BATUACH_MANAGEMENT_GB_M39_RELEASE_BLOCKERS.md`. Most urgent is the read-only aggregate finding that Production contains 23 populated recoverable temporary-password rows. Dropping the column does not rotate the corresponding Auth password and backups may retain it.

# Owner Actions

Before authorizing release, the owner must approve the affected-account credential recovery/rotation procedure and backup treatment; obtain Production Auth/Email configuration proof; configure/reconcile required Production secrets and URLs; approve/test database and Storage recovery; provide the cost ledger/invoice denominator; and authorize the exact frozen candidate and maintenance window. No secret should be pasted into chat.

# Release / Rollback / Smoke

`GAN_BATUACH_MANAGEMENT_RELEASE_RUNBOOK.md` defines the staged sequence, abort conditions, rollback decision tree and post-deployment role/storage smoke. It was not executed against Production.

# Digital Observer Boundary

No Digital Observer core file or behavior was changed. The shared CI manifest only adds a Management Production-hardening security check. `DIGITAL OBSERVER CORE DIFF: 0`.

# Recommendation

`PRODUCTION RELEASE CANDIDATE: BLOCKED` until every core blocker has evidence. GB-M39 itself should integrate into Development because it closes real Production exposure paths and preserves fail-closed behavior. Production and `main` remain unchanged.

# Development Integration Closure

PR #123 targeted `integration/development` at exact final head
`5ff091281f8b1d6cf63aeab1d3fe1e517c27164c`. All nine required checks reached
`completed/success`; the PR was mergeable and had no requested reviewers,
reviews or review comments. It merged with ancestry preserved at
`8f7620c20397ab52e38103dff5b9dca9267f7ac0`. The resulting integration tree is
identical to the validated PR tree, and the feature head is reachable from the
remote integration head.

Post-merge cumulative verification passed: GB-M39 hardening; domain 30/30;
security 8/8; migration health 243/243; reporting 7/7; dashboards 9/9; legacy
consolidation 8/8; typecheck; lint regression with zero canonical regressions;
and release-contract preflight. The exact PR Production build had already
passed and the merge introduced no tree change. No GB-M39 migration was added.

`GB-M39 DEVELOPMENT INTEGRATION: PASS`

`PRODUCTION RELEASE CANDIDATE: BLOCKED`

`PRODUCTION STATUS: UNCHANGED`

# Validation

Branch validation on 2026-09-23:

- GB-M39 Production hardening: PASS (3 public mutations, 2 invitation paths, 4 passkey paths and 5 internal tools covered).
- Manager/Parent contract: 22/22 PASS.
- Multi-Garden Staff: 8/8 PASS; Inspector approval: 4/4 PASS; Documents: 6/6 PASS.
- Enrollment lifecycle: 7/7 PASS; activation: 8/8 PASS; tuition: 3/3 PASS; payment-provider truth: 5/5 PASS.
- GB-M36 reporting: 7/7 PASS; GB-M37 dashboards: 9/9 PASS; GB-M38 consolidation: 8/8 PASS.
- Domain gate: 30/30 PASS.
- Security/isolation gate: 8/8 PASS, including the new Management Production-hardening suite.
- Migration audit: 243/243 PASS; no GB-M39 migration added.
- Typecheck and lint regression: PASS; zero canonical lint regression.
- Release contract: PASS; Production mutation false.
- Production build: PASS, 529/529 pages generated. The restricted sandbox initially blocked Turbopack's internal loopback port; the identical build passed outside that restriction.
- Dependency audit: 0 critical, 0 high, 6 moderate.
