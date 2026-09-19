# Canonical development Full Stack — verified; overall reconciliation remains open

No main merge/push, Production SQL, Vercel deployment, history rewrite or cleanup.

## Development database and provenance

- READY: isolated local Supabase, project `gan-batuach-integration`, Colima `gbi`.
  VM/database disk: `/Volumes/DIGITAL_OBSERVER/Development/gan-batuach/` (Kingston).
  API 127.0.0.1:55421, DB 127.0.0.1:55422; all published ports loopback-only.
- Baseline `development-c0cf2de7-20260919-v1`; source integration
  `c0cf2de7e11e6e9b368fdd1fc3a068ce544ca55d`. Per-statement source/derived hashes,
  explicit DML/activation omissions and exact ACL artifact are versioned.
- Historical files preserved: **227**. Development baseline maps these files;
  it does **not** claim an unmodified historical transactional replay.
- Post-baseline migrations: **1**, `20260919170000_classroom_scope_trigger_record_fields.sql`,
  original SQL applied after remote integration. Development ledger: 228 expected,
  228 mapped/applied, zero missing. Live schema fingerprint drift **PASS**.
- Schema inventory: 5 extensions, 30 enums, 842 public relations (839 tables),
  177 public functions, 67 relevant triggers, 2,441 indexes, 1,198 public/Storage
  policies, 11 buckets. Inventory is provenance, not a claim every function was
  interactively tested. Exact source/default/column privileges were verified.
- 13 DEVELOPMENT-only Auth identities with random local private passwords.
  Auth and own-profile REST PASS for all 13. Synthetic Gardens, Classrooms,
  Children/guardians/enrollments, Staff/relationships, candidate/revoked roles,
  Inspector/Admin and Observer Sites exist. Normal triggers remain enabled.
- Scoped RLS/security PASS: Parent/Child, Manager/Garden, Staff/Classroom,
  candidate/revocation, assigned Inspector, Admin and Observer Site boundaries;
  invalid cross-Garden assignments and anonymous privileged RPC are denied.
- Private Storage upload/signed-read/anonymous-denial probes PASS using only a
  tiny synthetic artifact. Local mail is captured; no customer delivery.

## Cumulative local application

- FULL STACK from `integration/development`, verified commit
  `0620ab40c497b0e98ee27df5fb118c1c5e41816b` (PR #60; baseline PR #59).
- URL: http://127.0.0.1:3000/digital-observer
- Health HTTP 200, Supabase `ok`; truthful development version identifies local
  backend. No Production credential or remote database fallback is loaded.
- **18/18 HTTP checks PASS**: public entry/health; authenticated Observer
  dashboard/alerts/cameras/recordings; Manager/Parent/Staff dashboards; settings,
  Event Journal, incidents and watch-rule APIs; own Site 200 versus other Site
  403; anonymous 401. Receipt: `development/database/local-product-receipt.json`.
- This is local synthetic full-stack verification, not real camera hardware,
  DVR, AI, payment/email provider activation or an exhaustive browser journey.
  Local Edge Functions/Studio/pooler/analytics/image transforms are not enabled.
  Messaging/attendance/payment operational fixtures and journeys are not all
  qualified by the foundation fixtures; do not report complete domain E2E.
- Exact-source GitHub CI passed on `8506689f` and `b146cbb7`, including full
  build, static quality, domain, security/dependency, migration and release
  contract gates. Later report-only changes do not rewrite those observations.

## Zero-loss reconciliation checkpoint

- **108 branch names**: 51 already in main, 5 integrated in development,
  13 superseded with recorded equivalence evidence, 32 preserved pending
  integration, 3 blocked, 4 evidence-only. No discovered branch lacks a ledger
  unit (main/integration are the explicit baseline refs). No local-only branch
  commits at the audit checkpoint. The pending set is not silently called READY.
- Exact full-tree equality to existing main-history commits additionally proves
  GB-M19/GB-M20 source snapshots already accounted for; no overlay/merge needed.
- **37 registered worktrees**: 2 absent directories, 14 existing directories
  with unreadable Git metadata. Surviving non-generated physical source was
  separately compared to remotely reachable blobs; original paths untouched.
- Dirty root and residual PUSH38 work are preserved, not reset. Integration has
  only permitted Next-generated type imports. Concurrent GB-M29 QA report is
  owned by its task and requested for scoped commit/push; never staged here.
- Stash `b8739d0d5b9073df4556ab507e4a17396519d277` exactly matches remote backup,
  including all three parents. Three initially flagged blobs were partial-clone
  enumeration omissions, then explicitly verified/materialized. Stash retained.
- Seven private evidence references were checksum-reverified on Kingston. Two
  temporary PUSH38 report originals have verified durable Kingston copies.
  No private report/password/media was committed; no blanket independent remote
  backup certification is made for all private evidence.
- Source/audit evidence: `DEVELOPMENT_DATABASE_STATE_AUDIT_2026-09-19.json`,
  `DEVELOPMENT_DATABASE_LOCAL_PRESERVATION_2026-09-19.json`, and the reconciliation
  report. The first two are raw point-in-time observations; the reconciliation
  report explains partial-clone false positives and later preservation.

## Exact remaining gates — not hidden by Full Stack readiness

1. **GB-M29** `a07b3ca9`: canonical rollback-only three-migration/role/attachment
   metadata QA and exact-source CI PASS; all source remotely preserved. Its task
   owner explicitly holds PR #57 open/unmerged. PR targets development, never
   main. Need owner coordination to lift that hold before canonical integration,
   three durable DEV migrations and authenticated attachment HTTP E2E. Alternative:
   separately approved feature QA clone, not unintegrated canonical DB mutation.
2. **PUSH 38** `b5d2bf82` / `db26a314`: separately remotely preserved and
   ledger-recorded; qualification/custody/delivery remain incomplete, NOT DONE.
3. **Historical divergent work**: 32 pending / 3 blocked require per-feature
   semantic and dependency QA; no blind merge or automatic readiness inference.
4. **Missing old directories** `/private/tmp/push3e-event-contract` and
   `/private/tmp/push3e-release-baseline`: committed heads remotely preserved,
   former untracked/private content cannot be proved from Git. No matching
   dedicated archive manifest was located in the bounded Kingston archive scan.
   Owner backup/location evidence is needed to close that uncertainty. Fourteen
   unreadable worktree metadata records are retained, not pruned or repaired.
5. **Release prerequisites** remain separate: Production history/upgrade safety,
   provider cost/backup/recovery checks and full selected-release qualification.
   Development baseline must NEVER be applied to an existing Production DB.

## Protected state

Remote main: `8113d0607e4282dc8778540aa58c1502367f4221`, UNCHANGED.
Production database and Vercel Production: no operation performed by this task.
Earlier verified live Vercel no-preview configuration remains the policy; no new
provider deployment-list observation is inferred from a successful Git push.
Old midnight/hourly release automations remain paused by the prior workflow.

**CANONICAL DEVELOPMENT FULL STACK: READY.**
**WORKFLOW TRANSITION: NOT DONE.**
**READY FOR CONTINUOUS FULL-STACK DEVELOPMENT: YES, for integrated work.**
**READY FOR OWNER-CONTROLLED RELEASE: NO.**

No cleanup. No automatic release. See `DEVELOPMENT_LOCAL_RUNBOOK.md` for startup,
private QA credentials location and the guarded post-baseline migration path.
