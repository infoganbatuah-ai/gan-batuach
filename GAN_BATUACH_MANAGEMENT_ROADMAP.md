# Gan Batuach Management — final post-GB-M01 roadmap

Derived before implementation on 2026-09-07 from the completed GB-M01 audit at `dc50fca02db7d866c7ecc5416940da34e764b033` and its ten companion artifacts. The audit is canonical; this order supersedes the earlier conversation's numeric titles. GB-M01 PASS means the static audit is complete, not that production is ready.

## Execution order

Execute GB-M02 through GB-M40 in the order below. Recommendations are the audit's decisions, not new feature claims. Each push extends existing code and must record its validation and remaining production gates.

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

## Dependencies and retained coverage

- GB-M02 establishes one Management tenant-check entry point backed by the existing database authority. GB-M03 completes candidate activation/role semantics; GB-M04–07 complete identity verification, signed invitations and canonical family linking.
- GB-M08–09 add owner/teacher semantics and owner memberships; GB-M10 makes onboarding activation atomic. Registration documents/consent and garden profile/address validation remain onboarding requirements, with private storage completion at GB-M32.
- GB-M11–13 establish classrooms, capacity and versioned ratio policies. No legal ratios may be invented or promoted from current hard-coded assumptions.
- GB-M14–16 complete discovery, enrollment and idempotent activation. GB-M16 defines the activation transaction and manual-state contract; verified live collection is gated on GB-M26–28. A successful UI action is never payment proof.
- GB-M17–19 complete staff identity, applications and employment context. Existing shifts/hours/workforce operations remain part of GB-M19 and receive end-to-end validation at GB-M40.
- GB-M20–25 complete inspector, remediation and complaints lifecycles. Preserve the existing scoring/inspection engine.
- GB-M26–28 keep platform subscription and parent tuition separate, unify authoritative pricing and activate providers only with evidence. The audit's editable 700 ILS base plan is not replaced by other hard-coded prices.
- GB-M29–34 consolidate communications, delivery, private documents, privacy and audit coverage.
- GB-M35–36 provide full live IDOR and multi-garden evidence. Targeted denial tests are required in earlier security changes too; do not postpone known authorization defects to these pushes.
- GB-M37 retains operational reports/analytics, the Management Safety Center and Digital Observer contract/capability verification. The old GB-M02 boundary lock applies throughout this roadmap; old GB-M37–38 camera/evidence/policy coverage remains here and at GB-M40, without editing Observer core.
- GB-M38–40 consolidate existing role navigation, complete visual/device/accessibility QA and decide release. Children/classroom operations, attendance/pickup and all retained domains require production E2E evidence here; existing static PASS does not replace it.

## GB-M02 implementation contract

Model recommendation: Astra, because tenant authority is a security-sensitive dependency.

Implement a Management-only authenticated garden context guard. The selected profile garden is a context hint; a successful session-scoped `can_manage_garden` database decision is required before existing manager/owner operational APIs proceed, especially before service-role reads or writes. Fail closed on missing identity, unsupported role, inactive profile, absent context, denied authority or failed lookup. Keep resource-ID ownership checks and RLS in place.

Adopt the guard across the existing manager/owner garden operational routes. Preserve the pre-garden manager-application bootstrap and the retired create-parent endpoint (which already rejects mutation). Do not change auth/RLS helpers shared with Digital Observer. Do not create a parallel membership schema, grant parents garden-wide authority, add owner multi-garden UX, or complete later candidate lifecycles in this push.

Acceptance: executable guard and route denial tests (including no privileged effects), typecheck, lint baseline, Management contract QA, domain/security suites, migration health and build. Document environment-blocked live checks honestly. Validate, then commit only this push and push its isolated branch; production deployment is a separate gate.

## Authority transition

The existing `can_manage_garden` SQL currently uses active profile scope (plus its existing admin/network rules). GB-M02 makes operational APIs consult that same authority instead of silently bypassing it. It does not claim that legacy schema authority is already replaced by memberships. GB-M07/09/19 must change the underlying relationship authority with migration and RLS evidence; GB-M35/36 verify the completed transition in a live environment.
