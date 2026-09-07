# GB-M01 — Gan Batuach Management Repository Audit

## GB-M01 STATUS

**PASS** — repository-wide static audit artifacts are complete. No product fixes or migrations were implemented. Production/runtime QA remains explicitly classified.

## Hard counts

| Measure | Count |
|---|---:|
| Management routes/pages | 285 |
| Management APIs | 195 |
| Relevant Management tables | 64 |
| Migration files inspected | 191 |
| Active components imported by Management pages | 101 |
| COMPLETE | 0 |
| COMPLETE_NEEDS_QA | 21 |
| PARTIAL | 30 |
| UI_ONLY | 1 |
| BACKEND_ONLY | 0 |
| MOCK | 2 |
| BROKEN | 0 |
| LEGACY | 0 matrix rows; legacy route families documented separately |
| MISSING | 5 |
| EXTERNAL_DEPENDENCY | 4 |

Counts are based on the canonical feature rows in `GAN_BATUACH_MANAGEMENT_FEATURE_TRUTH_MATRIX.md`; route classifications are separately recorded in the UX inventory.

## Top findings

1. The repository contains substantial functional Management foundations across all requested roles and domains; rebuilding from zero would be wasteful and risky.
2. The effective identity model is transitional: legacy singular garden fields coexist with multi-garden relationship tables.
3. Owner multi-garden support and explicit owner-as-teacher semantics are missing.
4. Registration exists, email verification is partial, and phone OTP verification is missing.
5. Garden, parent, staff and inspector lifecycles exist but are distributed across multiple non-atomic routes.
6. Classrooms are not a first-class entity; age/setup/fee groups cannot model multiple classes of the same age cleanly.
7. Capacity and ratio rules are hard-coded assumptions without versioned legal provenance.
8. Platform subscription and parent tuition foundations exist and are separated, but real collection/wallet/provider activation is not proven.
9. Admin UX has 140 pages and substantial readiness/launch/pilot duplication.
10. Camera/Digital Observer remains an external dependency under the accepted earlier audit.

## P0/P1 security findings

No exploitable P0 was proven by static inspection. P1 items:

- Candidate users carry staff/inspector roles before activation; role-only guards are insufficient.
- Legacy and new guardian/child/garden links may disagree, creating IDOR risk if an endpoint selects the wrong authority.
- Service-role lifecycle routes bypass RLS and need explicit, tested tenant ownership on every target ID.
- Phone ownership is not verified.
- Inspector approval and enrollment/payment activation perform multi-record transitions without a demonstrated transaction/idempotency boundary.
- Full production RLS/IDOR tests for parent, staff, inspector and cross-garden access remain required.

## Identity/linking findings

Parents and staff have strong multi-garden data foundations, but current UX often resolves one `profile.garden_id`. Owner multi-garden membership is missing. Co-guardian account lifecycle is partial. Invitation handling supports existing/non-user foundations but lacks a unified signed token, recovery and acceptance transaction.

## Payment findings

The 700 ILS base plan exists and Admin can edit plans. Conflicting 800/9,600 commercial assumptions exist elsewhere. Platform checkout is mock/manual through `FutureProviderAdapter`. Tuition ledgers and group prices exist; cards/wallets are UI/readiness only; reconciliation and atomic payment-to-enrollment activation are incomplete.

## Inspector findings

Application, approval, region data, assignment, monthly inspection, scoring, violations and complaints have real foundations. The requested inspector-created preliminary garden and owner invitation flow is missing.

## UX findings

All five role experiences have dedicated shells and extensive responsive RTL styling. The parent and staff experiences are most consistently mobile-oriented. Garden UI layers a global and teacher shell. Admin suffers from severe route/navigation sprawl. Visual/device/accessibility QA is still required.

## Must-not-rebuild summary

Preserve and extend: Auth/profile foundation, role guards, RLS helpers, permanent child files, parent links/enrollments, staff permanent files/employments, onboarding records, inspection engine, pickup/attendance evidence, billing tables, communication platform, notification service, audit logging, role shells/design system and all accepted camera integration foundations.

Repair/consolidate: legacy/new identity links, teachers vs staff, group/class models, messages vs threads, tasks vs remediation workflows, pricing sources, invitation recovery, candidate activation gates and Admin route families.

## Digital Observer integration requirements

Reference: `GB-M01_MANAGEMENT_AUDIT.md` and `GAN_BATUACH_MANAGEMENT_DIGITAL_OBSERVER_BOUNDARY.md`. Required contracts remain capability truth, signed playback/evidence, reviewed event provenance and Management-owned authorization context. Do not duplicate Observer engines.

## Roadmap changes

The repository contains no canonical GB-M02→GB-M40 roadmap document, so exact prior titles could not be compared. The canonical sequencing impact is:

| Push | Recommendation | Canonical scope |
|---|---|---|
| GB-M02 | REORDER | canonical identity/tenant authority before feature work |
| GB-M03 | SPLIT | candidate activation guards and role semantics |
| GB-M04 | KEEP | email + phone verification and recovery |
| GB-M05 | MERGE | signed invitation service |
| GB-M06 | MERGE | parent/guardian invitation acceptance and recovery |
| GB-M07 | KEEP | canonical parent-child linking |
| GB-M08 | ADD | owner-as-teacher and delegated teacher semantics |
| GB-M09 | ADD | owner multi-garden memberships/context |
| GB-M10 | MERGE | garden onboarding atomic activation |
| GB-M11 | ADD | canonical classroom entity |
| GB-M12 | KEEP | capacity/seat reservation enforcement |
| GB-M13 | SPLIT | versioned, admin-configurable ratio policy and legal review |
| GB-M14 | KEEP | public garden discovery/matching |
| GB-M15 | KEEP | enrollment request/decision |
| GB-M16 | REORDER | payment-linked enrollment activation/idempotency |
| GB-M17 | KEEP | staff candidate completeness and job discovery |
| GB-M18 | MERGE | staff application + invitation acceptance |
| GB-M19 | ADD | multi-garden employment context |
| GB-M20 | KEEP | inspector application/admin approval transaction |
| GB-M21 | ADD | inspector preliminary-garden/owner invitation flow |
| GB-M22 | KEEP | monthly inspection scheduling/submission/reporting |
| GB-M23 | MERGE | violations and corrective actions |
| GB-M24 | MERGE | task/workflow consolidation |
| GB-M25 | KEEP | complaints, SLA and escalation closure |
| GB-M26 | SPLIT | platform subscription plan/lifecycle |
| GB-M27 | SPLIT | parent tuition ledger/reconciliation |
| GB-M28 | KEEP | live payment/invoice provider activation after both models |
| GB-M29 | MERGE | canonical messages/threads |
| GB-M30 | MERGE | notification preferences/fan-out |
| GB-M31 | KEEP | email/SMS/push provider verification |
| GB-M32 | KEEP | document storage/review/signed access |
| GB-M33 | KEEP | privacy/data-subject rights |
| GB-M34 | KEEP | immutable/coverage-complete audit logging |
| GB-M35 | ADD | parent/staff/inspector IDOR production probes |
| GB-M36 | REORDER | multi-tenant and multi-garden context validation |
| GB-M37 | KEEP | scale/performance/operational readiness |
| GB-M38 | MERGE | route/navigation consolidation and legacy retirement plan |
| GB-M39 | KEEP | RTL/mobile/desktop/accessibility visual closure |
| GB-M40 | KEEP | final production validation and release decision |

No GB-M02 implementation was started.

## API audit conclusion

195 non-standalone-Digital-Observer API route files were inventoried. Core meaningful endpoints are mapped in the truth matrix and domain audits. Most generic CRUD routes use shared permission guards and session-scoped Supabase/RLS. High-risk service-role endpoints for onboarding, invitations, approvals, enrollment, payments and inspector assignment were inspected separately. Provider/webhook and cron endpoints require production secret/signature/idempotency QA. Static presence is not production proof.

## Validation results

| Check | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint:ci` | PASS against baseline; 5,355 existing errors and 213 warnings, 0 regressions |
| `npm run qa:migrations` | PASS; 191 migrations; warning for duplicate descriptive name |
| `npm run qa:ci:domain` | PASS, 18/18 |
| `npm run qa:ci:security` | PASS, 9/9 |
| `npm run qa:manager-parent-live-contract` | PASS, 20/20 |
| `npm run qa:probe-role-boundaries` | BLOCKED BY ENVIRONMENT: could not create synthetic storage sentinel (`UNKNOWN`) |
| `npm run build` | PASS outside sandbox; 489 routes generated; Sentry import deprecation warning |

The initial sandboxed build failed because Turbopack could not bind a port; the approved unrestricted diagnostic build passed. No source failure was inferred from the sandbox error.
