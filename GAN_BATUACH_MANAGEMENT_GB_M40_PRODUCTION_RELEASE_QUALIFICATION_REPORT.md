# Gan Batuach Management — GB-M40 Production release qualification

Date: 2026-09-23
Starting integration SHA: `3c2398647e5bfabbc3f4f5e03c9ad3a5f14c2dad`
Production/main SHA: `8113d0607e4282dc8778540aa58c1502367f4221`
Production mutations: **none**

## Decision

**IS GAN BATUACH MANAGEMENT TECHNICALLY READY FOR AN OWNER-AUTHORIZED PRODUCTION RELEASE?**

`NO — BLOCKERS REMAIN`

The application and migration engineering are release-candidate quality in Development, Production Auth configuration is now independently verified, cryptographic configuration is hardened, and isolated database/Storage recovery paths pass. Production release still cannot start because 22 legitimate accounts require owner-approved canonical recovery proof before irreversible migration 12; required Production URL/health/cron/hash configuration is absent; a provider-managed database restore and durable Production private-Storage recovery have not been accepted/proven; and the all-in current cost-per-paying-user gate lacks invoices/allocation/denominator. No exact Production release/window authorization exists.

## Blocker 1 — legacy credentials

Read-only Production inventory found 23 populated rows without selecting the secret field. All 23 have active canonical Auth identities, present and verified Email, and canonical recovery availability. No row has independent password-change or prior recovery-delivery proof. Classification is 22 `REQUIRES_USER_RECOVERY` and one `SYNTHETIC_QA`; there are no orphan or unknown rows. Six have recent activity, which does not prove they no longer use the exposed/recoverable credential.

Development has zero active authentication/invitation reads of the legacy plaintext field. The remediation plan gives redacted one-way references, owner decisions and the release assertion. The synthetic rehearsal covers active/inactive, verified/unverified, orphan, recovery and migration-12 eligibility. Migration 12 remains blocked until `LEGACY CREDENTIAL REMEDIATION COMPLETE` is true.

## Blocker 2 — Auth and Email

Supabase Production configuration was inspected read-only:

- Site URL is `https://ganbatuach.com`; callback/confirm allowlist includes the canonical domain, current Vercel domain and localhost Development callbacks.
- Signup, Email signup and Email confirmation are enabled.
- OTP length/expiry: 8 digits / 3,600 seconds; Email frequency 1 minute.
- JWT expiry: 3,600 seconds; refresh rotation enabled with 10-second reuse interval.
- Anonymous sign-in disabled; TOTP enroll/verify enabled.
- Custom Auth SMTP is configured through Gmail on port 465 with the Gan Batuach sender. Password presence was checked as a boolean only.

Result: `CONFIGURATION VERIFIED`; `LIVE PRODUCTION JOURNEY NOT EXECUTED`. Resend is not the current Supabase Auth SMTP. Resend application credentials may exist, but domain/webhook/bounce and controlled Production send proof remain optional-provider gaps.

## Blocker 3 — cron

`CRON_SECRET` remains absent in Production. Complaint SLA and permit-expiry automation are core scheduled Management jobs and fail closed without it. Monthly inspection/reminder routes are unscheduled optional automation. Demo-expiration freeze is QA-only. Digital Observer media retention is DO-owned and destructive-policy-blocked. No retention/deletion job was enabled.

## Blocker 4 — Production configuration

Supabase URL/client key and server-only service role, invitation signing, Resend/FCM names and current field encryption key are present by name. Before release Production still requires:

- explicit `NEXT_PUBLIC_APP_URL=https://ganbatuach.com` for application-created links;
- `HEALTHCHECK_SECRET` for authenticated deep health;
- `CRON_SECRET`;
- dedicated `FIELD_HASH_PEPPER` plus an explicit `FIELD_ENCRYPTION_KEY_VERSION` without rotating the current key.

GB-M40 makes Production lookup hashing fail closed without a dedicated pepper. The service role is never accepted as an encryption/hash secret. Passkey RP/origin remains optional and disabled. Payment, invoice, SMS and WhatsApp remain optional/unavailable.

## Blocker 5 — backup and recovery

Supabase reports eight consecutive completed daily physical backups through 2026-09-23. WAL-G is enabled and PITR is disabled. GB-M39 logical backup/isolated restore passed representative Auth, Garden, profile, Child, enrollment, message and document metadata. A non-destructive provider-managed restore into another hosted project is not self-proven and requires a temporary target/support path.

Private Production Management buckets were private and empty at the read-only audit. GB-M40 performed a new local isolated proof: synthetic private object upload → export → hash → deletion → restore → identical hash → signed authorized retrieval, while anonymous raw access was denied. This proves the recovery procedure, not a configured hosted backup. A durable future target/retention must be approved before customer-file risk is accepted.

Provider-managed restore proposal: temporary isolated Supabase target, no customer-report output, immediate teardown after verification; cost approval cap **USD 25 plus tax for one month**, expected USD 10–25 subject to provider plan/support. `OWNER COST APPROVAL REQUIRED`; nothing was provisioned.

## Blocker 6 — cost

Current supplier invoices, project-level allocation and the distinct active-paying-user denominator remain unavailable, so `CERTIFIED CURRENT` is **not available**. The architecture is `PROJECTED AT SCALE` only.

Public price floor researched 2026-09-23: Vercel Pro $20/month with $20 included usage credit; Supabase Pro from $25/month with 7-day daily backups, 100k MAU, 8 GB database, 100 GB file Storage and included bandwidth; Resend free 3,000/month or Pro $20/50k; FCM itself no-cost; R2 Standard includes 10 GB then $0.015/GB-month with free egress. Actual plans/invoices/tax are unverified. The existing communication model uses ₪3.028/USD and sparse SMS/WhatsApp fallback.

Illustrative Management-only floor (excludes Digital Observer, domain, GitHub/CI/AI tools, tax, invoice provider and unknown AWS/legacy-retention bills):

| Paying users | Known fixed + communication floor | ₪/user/month |
|---:|---:|---:|
| 100 | ₪137.97 | ₪1.38 |
| 500 | ₪144.82 | ₪0.29 |
| 1,000 | ₪153.37 | ₪0.15 |
| 5,000 | ₪282.36 | ₪0.06 |
| 10,000 | ₪367.90 | ₪0.04 |
| 100,000 | ₪2,043.90 | ₪0.02 |

These figures are not invoices and do not certify the all-in ₪15 ceiling. Digital Observer-heavy use is reported separately and remains monetarily unknown without real compute/provider rates. Retired `face-scan`/`final-server` compute is not active runtime; any retained snapshots are `LEGACY RETENTION`, not Management cost. GB-M40 adds `NEW FIXED MONTHLY COMMITMENT: ₪0` and `MONTHLY COST DELTA: ₪0 fixed`.

## Blocker 7 — release freeze

No releasable RC is frozen because required owner actions remain open. The machine-readable manifest therefore records `rcCommitSha: null`, the exact reason, all 16 pending migrations and abort gates. A later owner-authorized release task must freeze the final integrated SHA and update this one field before applying any Production change.

## Migration and rollback qualification

The 16 pending migrations remain split as rehearsed:

1. Migrations 1–11.
2. Deploy the new compatible application.
3. Reassert recovery/backup/configuration gates.
4. Migration 12, the point of no return, then 13–16.

All 16 passed a fresh GB-M40 Production-schema clone rehearsal in order. Total apply time was about **8.1 seconds**; the longest file was migration 9 at **1.09 seconds** on the empty clone. GB-M39's injected failure inside migration 8 rolled back and a clean retry passed. Raw replay of migration 1 correctly proved non-idempotent, so ledger enforcement is mandatory. The final expected Development state is 243 migrations. Old Production application rollback becomes unsafe after migration 12 removes its required column.

## Optional capability matrix

| Capability | Launch classification | Truthful behavior |
|---|---|---|
| Electronic payment / Apple Pay / Google Pay | Optional disabled | Manual tuition/subscription paths; no fake checkout/receipt |
| SMS / WhatsApp | Optional disabled | Email-verified accounts continue normally |
| Passkeys | Optional disabled | UI unavailable until RP/origin configured |
| Resend transactional Email | Optional until controlled proof | Supabase Auth SMTP remains separate; in-app delivery continues |
| FCM push | Optional until controlled device proof | In-app notification remains authoritative |
| Digital Observer live cameras/AI | Optional external capability | Unavailable/readiness unless `production_verified`; no mock incident |

## Core Management launch matrix

Owner onboarding, Garden activation, Parent/Child, Staff/Inspector, enrollment, attendance/pickup, messaging/in-app notifications, documents, manual tuition, inspections, Tasks, complaints and reporting do not require payment, SMS, WhatsApp, passkeys or Digital Observer. External Email/push failure does not roll back source-domain transactions.

## Security and RC validation

The cumulative GB-M39 baseline had no open P0/P1. GB-M40 adds focused crypto separation and credential-remediation checks to the required Security CI gate, plus an isolated private Storage recovery proof. Exact-head local validation passed:

- required Security gate: **10/10 PASS**;
- required Domain gate: **30/30 PASS**, including queue terminal-race coverage;
- Management suites: **17 suites PASS** (capacity, staffing, discovery, enrollment, employment, Inspector, Tasks, subscription, tuition, payments, documents, reporting, dashboards and legacy boundaries);
- Parent/Manager contract: **22/22 PASS**;
- migration audit: **243 migrations PASS**, no failures or drift in the isolated target;
- Production build: **PASS** with Next.js 16.3.3 and 529 generated pages;
- lint regression: **PASS** (`5055` errors and `197` warnings, both below the approved baseline; zero canonical-path findings and zero regressions);
- release-contract preflight: **PASS**;
- built-RC smoke: public health `200`, authenticated deep health `200` with all seven representative tables healthy, login `200`, and unauthenticated Staff-time/Documents endpoints `401`;
- Storage export/restore/hash/signed-read proof: **PASS**.

The most recent bounded isolated RC load evidence remains applicable because GB-M40 changes only server-side configuration validation and adds no request/query path: 140 concurrent requests, 0 errors, p50 about 1,453 ms and p95 about 1,970 ms. A separate ten-round role soak recorded 40 protected role requests with 0 errors. These are Development measurements, not a Production SLA. Protected CI on the exact remote feature head remains the final Development-integration gate. Production error/config values remain redacted. No Digital Observer core file was changed.

## Release package

- `GAN_BATUACH_PRODUCTION_LEGACY_CREDENTIAL_REMEDIATION_PLAN.md`
- `GAN_BATUACH_MANAGEMENT_PRODUCTION_RELEASE_MANIFEST.json`
- `GAN_BATUACH_MANAGEMENT_FINAL_PRODUCTION_RELEASE_RUNBOOK.md`
- `GAN_BATUACH_MANAGEMENT_OWNER_ACTIONS_BEFORE_PRODUCTION.md`
- `GAN_BATUACH_MANAGEMENT_FINAL_UX_UI_BACKLOG.md`
- `GAN_BATUACH_MANAGEMENT_FINAL_UX_UI_HANDOFF.md`
- `GAN_BATUACH_MANAGEMENT_UX_UI_DESIGN_INPUT_PACKAGE.md`

## UX/UI handoff

No GB-M40 blocker introduces a new core user-facing screen. The surviving GB-M38 route map remains canonical. The consolidated backlog contains no visual P0/P1; the prior 81 unlabeled-input sample is P2 and must be recounted only on surviving screens. `UX/UI SURFACE FREEZE: READY`.

## Owner actions and recommendation

The exact decisions and work split are in the owner-action matrix. The next technical step is not Production release: approve and execute credential recovery, required secret/URL configuration, provider restore acceptance and cost reconciliation, then freeze a new exact RC and run this package. Production and `main` remain unchanged.
