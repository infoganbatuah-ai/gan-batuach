# GB-M33 Child attendance and pickup — Development report

Date: 2026-09-20. Source base: `integration/development` at `a2adf6c12c86ec9e7c48b63374d722829cd51134`. Branch: `codex/gb-m33-attendance-pickup`. Production remains unchanged.

## Before State

`public.attendance` and `public.authorized_pickup_contacts` / `public.pickup_authorizations` / `public.child_pickup_events` already existed. Garden check-out wrote `left_early` without a pickup identity; a separate pickup route could log an event with a caller-declared `manual_review`, `unauthorized`, time, GPS and camera reference without an atomic departure. Parent GPS/signature POST could directly set Child attendance. Generic attendance and pickup tables had broad direct mutation grants; historical source-specific RLS included broad Garden/Admin paths. The pickup dashboard considered any historical event a current-day pickup.

## Canonical Attendance Model

The existing attendance row remains the business record. The forward migration adds Garden operational timezone, enrollment/Classroom references and arrival/departure actor references. A partial unique index enforces one Child/Garden/local-day record. Existing Staff attendance rows are not deduplicated or rewritten. A preflight query on isolated Development found zero duplicate Child/Garden/day groups. Production must run the same read-only check before migration; ambiguous historical duplicates require manual remediation, never guessed deletion.

## Daily Lifecycle

Staff/Manager arrival is server-timestamped in `management_child_arrival`. It locks the Child row, checks active enrollment for the Garden-local date, snapshots current Classroom, and returns the existing arrival on retry without replacing its timestamp. `management_child_absence` records absence and permits explicit correction to present with a reason and prior/current values in the audit trail. A prior departure or absence is not silently overwritten. The existing `left_early` enum value remains the compatible persisted departure status; `check_out_at` and a confirmed pickup event are the canonical departure evidence. No inferred camera arrival exists.

## Classroom / Enrollment

Active enrollment is checked at the Garden-local date before each operational action. Staff authorization requires current active employment, the canonical attendance teaching scope, appropriate active Classroom responsibility, and the Child's current Classroom assignment in that same Garden. Both the route and direct database RPC enforce teaching scope. Manager/Owner authority uses active Garden membership. The selected UI Garden is not an authorization grant.

## Parent

Canonical Guardian links resolve Parent Child scope, including a non-primary legal Guardian. Parents read only their authorized Child's attendance and pickup history. The old Parent GPS/signature mutation is blocked because it could create physical attendance/departure without Staff confirmation. A Parent pickup request is not departure truth; a separate safe request UI remains product debt.

## Staff

Scoped Staff may record arrival/absence/correction and confirm release for their assigned Classroom. Candidate, revoked, unrelated Classroom and other-Garden Staff are denied by the database RPC even if they know identifiers. No Owner/finance/HR power is conferred.

## Multi-Garden

Employment and Classroom assignment are evaluated against the requested Garden for each action. Garden A context cannot authorize Garden B attendance. Multi-Garden Staff have independent scope per Garden.

## Absence / Late

Garden Staff may mark absent. A later change to present requires explicit correction and reason. There is no product-approved automatic late threshold; no legal deadline is inferred or persisted.

## Corrections

The correction RPC records prior state, new state, actor, reason and time in `attendance_compliance_audit_trail`. It does not silently edit a past release. Historical release correction needs a separately approved exceptional workflow.

## Pickup Authorization

Parent/Guardian creates a pickup contact through one transactional RPC that validates Guardian authority and active enrollment, then links existing contact, adult and authorization models. Uploaded/typed photo, ID number and face match are not treated as identity proof; the legacy public URL input is rejected. Temporary validity is server-checked. Revocation locks the contact and revokes linked authorization/adult state. Other Guardian account authority is unaffected.

## Pickup Event

A confirmed event links the daily attendance and snapshots the contact/Guardian authorization reference, pickup name, Staff actor and server timestamp. Historical event remains after revocation. One confirmed event per attendance is constrained by a partial unique index.

## Release

`management_child_release` is the sole normal release transition. It requires prior arrival, active enrollment, an authorized Staff/Manager, and either a current approved contact/authorization or a current legal Guardian. It locks the Child, attendance and contact, inserts the pickup event and updates departure in one database transaction. Unknown/manual/camera/face-match status cannot complete normal release. The Garden UI no longer offers manual override as a successful normal pickup.

## Revocation

Revoke and release contend on the same contact row. If revocation commits first, the release reads revoked state and fails. If release holds the lock first, it completes before revocation; history records the then-valid authorization. No stale browser status grants release.

## Concurrency

Child-row serialization and unique indexes make duplicate arrival and release requests idempotent at the database level. Rollback-only sequential tests passed, followed by true separate-connection arrival, release and revoke/release races in a disposable clone of the applied isolated Development schema. Results are recorded in the final verification section below.

## Camera / Identity Boundary

No Digital Observer detection, Track ID, face-match result, biometric comparison, GPS value or Parent self-report enters the authoritative release RPC. Human Staff verification is recorded as operational confirmation, not biometric proof. `DIGITAL OBSERVER CORE DIFF: 0`.

## Notifications

The RPC inserts privacy-safe GB-M30 in-app notification intents for active Guardians and Garden management, with source IDs and deterministic dedupe keys. The GB-M30 trigger evaluates preferences/quiet hours and GB-M31 owns external delivery. No direct provider call or real external send is introduced.

## Privacy / RLS

Authenticated direct writes to attendance, confirmed pickup events, pickup contact/adult/authorization state and compliance audit are revoked. Read policies restrict Parent to canonical Child, Staff to Garden/Classroom/employment, and Manager/Owner to active Garden membership. Inspector and ordinary Platform Admin receive no blanket operational read. Elevated RPCs independently validate actor, Child, Garden, enrollment, Classroom and pickup identity.

## Reports / Dashboard Inputs

The Garden attendance and pickup pages use active enrollment and current-day attendance, rather than all Child profiles or any historical pickup event. The pickup page's pending count includes only Children who arrived today and have not departed; absence and expected-only rows are excluded. Existing Parent history surface remains scoped to own Children. Final reporting is GB-M34/36.

## Scale

Indexes cover Child/Garden/day, confirmed release per attendance, and Garden/day/Classroom. The Garden UI fetches bounded enrollment/attendance sets rather than one query per Child. Current page caps (500 enrollments, 500 attendance rows) require pagination for large networks; a single Garden with more than 500 active Children must not be claimed fully covered by this UI.

## Cost

`NEW FIXED MONTHLY COMMITMENT: ₪0`. No new vendor, camera pipeline, public media or paid provider is activated. Illustration only: one combined attendance/pickup row plus indexes/audit per Child-day could be roughly 1–3 KB before database/WAL/backup overhead; at 100,000 Children × 22 operational days, about 2.2–6.6 GB of new transactional data per month. Actual bytes, Supabase headroom, backup/WAL and retention must be measured; long-term growth depends on the approved retention period. No all-in ₪15/user compliance claim is possible without the supplier ledger and paying-user denominator.

## Tests

Rollback-only SQL application of `20260920140000_management_child_attendance_pickup.sql` passed against isolated Development, followed by synthetic Parent A/B, non-primary Guardian, Manager A/B, Staff A/multi-Garden Staff, Inspector and Admin role matrix. The Staff fixtures explicitly received canonical delegated teaching scope; active employment alone was insufficient. Covered valid/denied contact creation, revocation, arrival retry, wrong Classroom/Garden, release without arrival, revoked/unknown pickup denial, one confirmed release, absence correction audit, Guardian pickup, RLS reads and direct-write grants. Migration audit: 236 ordered files, no new migration-order failure. Domain QA 29/29, security QA 7/7, Manager Garden-context and Owner/Teacher denial contracts 51/51, Parent/Manager contract 20/20, Classroom/capacity 16/16, GB-M16 enrollment activation 8/8, GB-M19 Staff 8/8, GB-M32 documents 6/6, GB-M30 synthetic notification regression, release-contract preflight, typecheck and lint regression passed. The Garden-context test was updated to exercise the operational Staff/Manager guard used by the pickup route; denial still occurs before payload or side effects. PR #77 and approval PR #78 each completed all nine required checks, including the production build.

## Live QA

`LIVE ATTENDANCE/PICKUP QA: BLOCKED BY ENVIRONMENT` for controlled Production-like Parent/Staff sessions. Only disposable synthetic identities and rollback-only database state were used; no customer Child was touched.

## Carried QA Debt

GB-M21–M32 environment/provider/live-role debt remains in their reports. GB-M32 Production retention/recovery gates are not closed here.

## Remaining Debt

Production retention period and exceptional correction policy need owner/legal product decisions. Private pickup-person photo upload must use GB-M32 before re-enablement. Parent pickup request UX and broader Garden paging remain pending. Controlled live-role browser QA remains an environment gate for GB-M35/40. Production release requires a separate explicit owner instruction and release checks.

## Inputs For GB-M34

Use Garden-local attendance date, attendance ID, enrollment/Classroom snapshot, server timestamps, and confirmed pickup event. Treat Parent requests and camera context as non-authoritative. Do not infer legal lateness or retention period.

## Development Integration Handoff

PR #77 merged by ancestry into `integration/development` at `ef9af8443fd09952b1eb645f35f06ac0ebc93a06`, preserving source commits `f766314`, `d6d8c3e`, and `40b671c`. Nine exact-head CI checks passed, including the production-build check; the earlier local build was interrupted under exceptional workstation load. The only GB-M33 paths in the integration diff are the report, attendance/pickup routes and UI, focused test, Garden-context test, and one forward migration. Digital Observer core diff remains zero. The migration was held until separate ledger approval and backup, then applied only to isolated Development as recorded below. Production is unchanged.

## Isolated Development Migration and Race Verification

Approval PR #78 passed nine exact-head checks and merged at `73f2a6a9316fa64bdba8a2a8570c4cdc2e87c5d2`. The guarded runner applied only `20260920140000_management_child_attendance_pickup.sql` to the local `gan-batuach-integration` database after confirming 235 preceding canonical migrations and zero duplicate Child/Garden/day groups. The migration receipt reports fingerprint `8122836e01001d39663c7298b3ccf2e58c69b4dbad9f592787a4b40534e7eaff` and `productionAccess=false`. A restricted 5.5 MB pre-application archive at `/private/tmp/gb-m33-development-pre-migration.dump` has SHA-256 `711703968f2fbe39919b188738107110cd7d62ee56f52330b4816f8adcf88a7c` (private synthetic QA data; never commit the archive). Full restore into a separate disposable local database passed using the local Supabase superuser; the limited `postgres` role could not restore Supabase-owned internal objects. Representative synthetic migration, Child and Garden membership rows were verified in the restored copy.

The direct synthetic RLS matrix passed again against the **applied canonical Development schema**, inside a rollback-only transaction. Independent connections against the restored disposable copy produced one daily arrival (one original result, one idempotent retry), one confirmed pickup/departure under simultaneous release, and no pickup/departure when contact revocation committed before release. In the opposite ordering, release completed before revocation and its authorization snapshot remained while the contact ended revoked. No customer or Production rows were used. The canonical baseline-aware drift check passed at integration SHA `73f2a6a9316fa64bdba8a2a8570c4cdc2e87c5d2`: 227 baseline migrations plus 9 post-baseline migrations, 236/236 total, no missing migration or schema drift, and `productionAccess=false`. An earlier sandboxed attempt could not access the local Docker socket; it was rerun successfully with isolated Development access. The legacy non-baseline-aware drift command queries `supabase_migrations.schema_migrations`, which is not the repository's baseline-ledger path and was not used as release evidence.

## Cumulative Development Verification

On integrated source `73f2a6a9316fa64bdba8a2a8570c4cdc2e87c5d2`, the cumulative domain gate passed 29/29, security gate 7/7, Parent/Manager contract 20/20, Classroom capacity 6/6, multi-Garden Staff 8/8, migration audit 236/236, integration-ledger schema 117 units, and release-contract preflight passed. The feature PR #77 and migration-approval PR #78 each passed nine exact-head GitHub checks including build and typecheck. The applied-schema direct RLS matrix and true separate-connection arrival/release/revocation races passed. Controlled Production-like Parent/Staff browser identities remain unavailable; `LIVE ATTENDANCE/PICKUP QA: BLOCKED BY ENVIRONMENT`. No Production migration, deployment, customer attendance, or customer pickup event was created.
