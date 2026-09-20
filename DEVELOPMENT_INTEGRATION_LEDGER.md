# Canonical Development Integration Ledger

Effective 2026-09-19. Machine-readable source: `DEVELOPMENT_INTEGRATION_LEDGER.json`. Migration variants and independent development/Production states: `DEVELOPMENT_MIGRATION_LEDGER.json`. Latest branch/file/stash inventory: `DEVELOPMENT_FINAL_STATE_AUDIT_2026-09-19.json`, `DEVELOPMENT_LOCAL_RECONCILIATION_2026-09-19.json`, `DEVELOPMENT_BRANCH_RECONCILIATION_2026-09-19.json`. Initial audit is retained as historical evidence.

**Main is release-only. No owner release authorization has been issued for this workflow migration. No Production deployment or database write is authorized.** Earlier dated release ledgers and PR descriptions mentioning midnight are historical records, superseded by AGENTS.md.

## Current transition

PUSH 38S scoped inventory (2026-09-19):
`DIGITAL_OBSERVER_PUSH_38S_INTEGRATION_INVENTORY.json` accounts for **124/124**
changed files against the current integration branch (the earlier 123 estimate
was stale). `DIGITAL_OBSERVER_PUSH_38S_DEPENDENCY_GRAPH.json` records the
15-file minimum control-plane candidate and schema/identity/ingress edges.
The domain throughput fixture correction is remotely preserved on the feature
branch at `2175a5e9273f0f348838b6686cad514d3764aa68`; repeated horizontal
qualification and the feature-branch domain gate (30/30) passed. This does not
substitute for cumulative exact-commit CI after integration.
The candidate is **not integrated**: the real-device Development enrollment
bridge and narrowly scoped HTTPS ingress remain unqualified, while the pending
private-delivery migration creates an unused Supabase bucket in addition to
the approved R2 data plane. No development migration has been applied for
PUSH 38S. All 124 source files remain on the remote feature branch; 32 are
evidence-only and 92 remain pending file-level integration disposition.

GB-M30 integration closure (2026-09-19): source
`5c0f344cd59bd75294824eb9f62685bca7b19e11` and validated PR #66 head
`e96b62a6542662840df74a38523ad6d03bb85c2c` are preserved by the
ancestry merge `4217b3c3208cfa18094718f59fe56579e86647f0` into
`integration/development`. Exact-head checks passed 9/9. The ordered
`20260919180000_management_notification_pipeline.sql` migration was applied
only to canonical isolated DEVELOPMENT, with 232/232 migration drift PASS.
Cumulative domain/security/Management/typecheck/lint/build/preflight and
synthetic RLS, 51-recipient broadcast and separate-connection concurrency QA
passed. The occupied PUSH 38S checkout was not modified by this task.
Production/main remain unchanged; live role/provider QA and an explicit owner
release are still pending. External SMS/email/push/WhatsApp activation remains
GB-M31.

GB-M31 integration (2026-09-20):
`codex/gb-m31-external-delivery` at
`bf93be20dd859cae735dc35892429fc3788816a5` is remotely preserved;
PR #67 final head `593d829de9f3a82168f3ec20f744a43002522002`
passed all 9 required checks and merged by ancestry at
`3556cb9a4282fdb9a28be889d4e60dc585eb8a8d` into Development.
Management 228/228, domain 29/29, security 7/7, Parent/Manager contract 20/20,
typecheck, lint, build, migration audit and release preflight passed on the
isolated feature worktree. Both new migrations and synthetic RLS/receipt QA
passed inside a rolled-back Development transaction. The ordered
`20260920110000` and `20260920120000` migrations were applied only to
the guarded synthetic Development database at approval commit `e27ca721`;
the pre-migration archive is held privately with digest
`fa1a880c03279502438950adbb1ffa2f30106d1069cf9103d72e6f40c9ac382d`.
Post-migration synthetic RLS/receipt and separate-connection claim QA passed.
Cumulative Product QA remains pending. No paid
provider was activated, and Production/main remain unchanged.

GB-M31 closure update (2026-09-20): the isolated Development database applied
both ordered migrations and passed 234/234 drift, recipient/RLS, receipt and
two-connection lease checks. Cumulative Management, domain, security,
Parent/Manager, build, typecheck, lint and release preflight passed on the
integrated snapshot. A full-stack smoke found an unauthenticated preferences
GET 500; scoped fix `f5378f6821673a74c88f2c89b74babbc2046ec2b` passed
PR #68 required checks and merged at
`1714e05fe2a650b44f8177862a1469a00727b168`. The exact merged commit
passed UI-only home 200, preferences GET/PATCH 401 and disabled worker 503.
The preserved local Development Colima `gbi` VM then became broken (Lima
host-agent socket refused connection); final-head full-backend health/auth
smoke is pending non-destructive VM recovery. GB-M31 remains
`INTEGRATED_DEVELOPMENT`, not `LOCAL_VERIFIED`; no Production release or paid
external delivery was activated. Do not touch other workstreams' checkouts.

GB-M31 final Development verification (2026-09-20): the stale local Lima
host-agent and SSH loopback forward were repaired without deleting the
synthetic database disk. Drift passed 234/234, and exact integration head
`1714e05fe2a650b44f8177862a1469a00727b168` launched with
`LOCAL_SUPABASE`. Full-backend loopback smoke returned home 200, health 200
with Supabase OK, unauthenticated preferences GET/PATCH 401, and disabled
delivery worker 503. The earlier VM blocker is superseded. GB-M31 is now
`LOCAL_VERIFIED` in Development; Production and paid providers remain deferred.

PUSH 38Q/R handoff (2026-09-19): `codex/push-38q-r2-auth` at
`994ab8b07299e1e37cbd91c3c7cb5488a53a0001` is remotely preserved and
recorded in the JSON ledger. The private R2 authorization repair and its
`20260919190000_edge_home_qa_channel.sql` migration are **pending integration**.
The required signing/trust/OTA source modules are not yet on
`integration/development`; merging the whole feature branch would introduce
124 files without a cumulative review. No development or Production migration
was applied, no QA ingress was published, and no live Home runtime was changed.
The next owner action is a scoped dependency review and exact-commit cumulative
validation, then canonical DEVELOPMENT migration/endpoint qualification only.

**Current Full Stack result:** `DEVELOPMENT_FULL_STACK_CLOSURE_2026-09-19.md`.
Local Product 18/18 HTTP checks PASS at `0620ab40`, health 200, baseline 227 + 1
post-baseline migration verified. This supersedes all earlier UI-only/backend
blockers below, but does not close historical reconciliation or authorize release.

Latest development DB checkpoint: `DEVELOPMENT_DATABASE_BASELINE_REPORT_2026-09-19.md`.
PR #59 integrated the isolated baseline/guards at `00402d7a`. Baseline 227 + one
post-baseline migration are verified in DEVELOPMENT; drift PASS. Auth/REST/RLS
synthetic QA passed, app restart/HTTP verification pending. JSON is authoritative
for current states; older blocked-baseline observations below are historical.
GB-M29 `a07b3ca9` has canonical rollback-only SQL QA PASS, but remains separately
preserved while its owner requests PR #57 open/unmerged and HTTP E2E is pending.
PUSH 38 `b5d2bf82` / `db26a314` remain preserved pending qualification/integration.

Latest closure evidence and owner decision: `DEVELOPMENT_FINAL_CLOSURE_2026-09-19.md`; the earlier transition report is historical. Workflow and canonical SEO are integrated; GB-M29 remains blocked on canonical isolated schema/role QA. This is not a completed full-Product transition.

- Remote main baseline: `8113d0607e4282dc8778540aa58c1502367f4221`. Existing Production was observed Ready on the same commit, deployment `7N3RZmP34J4MTGsXq8JHQiq7bgiu`; this is not a new deployment.
- Canonical development branch: `integration/development`; durable worktree `worktrees/development-integration`. Original dirty root main is preserved and must not be pulled/switched to overwrite local work.
- Feature unit for this migration: `codex/development-workflow-20260919`. Owns workflow docs, ledgers, inventory/guard scripts, local launcher and development identity only.
- GB-M29: PR #57 / `450ac46d38d366b43a25c14f2c0a1075fd52c0e8`, eligible for development integration after scoped recheck; migration `20260913210000_management_canonical_messaging_threads.sql`. Full isolated role/schema QA is still required; no Production application.
- SEO: `86a8cbb7fd88ecc61b00b94fee4640e88eeaee89`, scoped public metadata/copy changes. Preserved remotely during this transition; no schema. Older SEO completion tip `03ca7e7a4376bafa78fbdf9c0eb78cc3a7ffc2a5` has an exact tree equal to remote main and was pushed to preserve its original history, not reapplied over main.
- Security/observability `13d1317d7ee5b31a67958eab835fb34a06b358ed`: preserved to remote `codex/preserve-security-observability-20260919`, not integrated. Old base and root overlap require semantic reconciliation; preserve newer main behavior.
- PUSH 38 / draft PR #28 remains NOT DONE. After explicit task-owner handoff and fresh no-preview verification, `codex/push-38-aws-signing` was pushed at `c4b72859` (including `4a063874` and `ae0fc714`). Eleven remaining temporary R2 source/config/SQL files were copied byte-identically to a separate preservation worktree and pushed as `codex/preserve-push38-r2-draft-20260919` / `05cd2a93`. Two private reports were copied to its ignored Kingston exports folder and checksum-verified. No original temp worktree edits, feature integration or live activation. The blocked delivery migrations must not be applied just to clear the ledger.

## Explicit outstanding gates (do not hide these)

1. Tools are installed, but canonical empty-database replay fails on five identified historical prerequisites. Full-stack and authenticated Product QA remain BLOCKED; adapted feature QA is not canonical proof.
2. Root source versions are preserved remotely, including five exact copied source files in three commits at `codex/preserve-root-source-20260919` / `0994c2b4`. Exact stash `b8739d0d` and all its parents are already remotely reachable from `backup/local-wip-preserved-20260830`; stash retained. Historical incompatible/unvalidated work has explicit pending/blocked dispositions, never blind merges.
3. Some registered temporary worktrees have missing `.git` links/unreadable status even where their directory exists. Preserve metadata and contents; no prune/cleanup. Audit presence and status-readability separately.
4. The initial 449 rows included 208 local absence/untracked observations, not distinct Git migration content. Those observations are retained separately. Actual Git variants, selected cumulative files and source provenance are separately tracked; no undefined blob can count as integration proof. Production application history remains UNVERIFIED, never guessed from Git. Only 227 files are currently selected in cumulative integration; GB-M29 is separate.
5. Vercel included credit is exhausted ($20/$20), with $4.60 on-demand shown during this transition. No spend cap/plan change was made. No-paying-user/all-provider economics and recovery prerequisites remain separate release gates, not a blocker to verified no-build Git preservation.

## Controls changed and verified

- Codex `automation-2` (merge watcher) and `automation-3` (old release coordinator): PAUSED, with prompts explicitly forbidding scheduled release/restart on credit recovery. Existing read-only monthly audit remains active. No new scheduled release.
- Vercel team showed one Git-connected project, `gan-batuach`; two old deployment projects showed “Connect Git Repository”. Production tracks main. Preview Branch Tracking disabled and confirmed unchecked after reload; no deploy hooks. No secret values accessed through the UI.
- `vercel.json` permits automatic Git deployment only for main. Actual no-preview behavior must also be checked after pushes; ignored-build cancellation is not assumed free.
- Four environment/workflow guard tests passed; focused lint and typecheck passed. Baseline full domain 29/29 and security 7/7 passed; migration health 227 files passed; release contract passed; lint reports 0 regressions with existing 5,211 errors/211 warnings outside canonical zero-error scope. Re-run affected cumulative checks after integrations; these initial results do not transfer automatically.

## Ongoing use

Every task updates its JSON unit with exact source commit(s), remote proof, task validation, dependencies, migrations, integration SHA/conflicts, local verification, readiness and deployment status. `npm run qa:integration-ledger` validates structure; `node scripts/development/check-ledger.mjs --release` fails without a recorded new owner authorization and inclusion proof. Neither tool authorizes a release.

No automatic PR/merge to main. When owner explicitly requests release, enumerate INCLUDED / EXCLUDED+reason / BLOCKED+reason, freeze SHA, run the complete gates, provide the exact local RC, then use one consolidated release PR and the controlled main release sequence. Preserve feature branches and all original commit ancestry.

Local command and truthful backend limitations: `DEVELOPMENT_LOCAL_RUNBOOK.md`.

GB-M32 integration handoff (2026-09-20): original feature commit
`40b938fd317917fa702e82bae1702a26133b4792` is remotely preserved and
reachable through PR #69's ancestry merge
`94d7376a191930481ff714b0bf9f4f004f78d04b` on
`integration/development`. All nine required feature checks passed. The
forward migration `20260920130000_management_private_documents.sql` passed a
rollback-only synthetic direct-RLS matrix after GB-M31, and is approved only
for guarded isolated Development application after a verified local backup.
Authenticated private Storage HTTP E2E, cumulative Product QA and retention
policy remain open; Production migration/deployment is not authorized. The
canonical local integration checkout contains a foreign generated file, so
GB-M32 integration QA uses a separate clean checkout without changing it.

GB-M32 verified Development closure (2026-09-20): scoped fix PR #71 passed
nine exact-head checks and merged by ancestry at
`b4e5b0195473a985ecbf14025537515cc983809c`. The isolated Development
migration and 235/235 ordered drift passed. Synthetic private Storage upload,
authorized signed retrieval, tenant/role denial, signed URL expiry, direct RLS,
retention/hold denial, idempotent purge, and independent-connection replacement
race passed. The exact integrated head launched as DEVELOPMENT / INTEGRATION
at `http://127.0.0.1:3000`; health was HTTP 200 and anonymous protected
document APIs returned 401. Production remains untouched. Retention policy,
Production recovery proof, and controlled live-role QA remain release debt.

GB-M33 feature integration (2026-09-20): PR #77 merged by ancestry at
`ef9af8443fd09952b1eb645f35f06ac0ebc93a06` after nine exact-head checks
passed on `40b671c95b7a2402fb2c414118fad5789c34ef4f`. The feature branch
`codex/gb-m33-attendance-pickup` and all three source commits remain remote.
The forward migration `20260920140000_management_child_attendance_pickup.sql`
passed rollback-only synthetic Parent/Guardian/Staff/Manager/Inspector/Admin
authorization QA. It is approved for **isolated Development only** after the
pre-application backup and duplicate-day check. Approval PR #78 merged at
`73f2a6a9316fa64bdba8a2a8570c4cdc2e87c5d2`; the guarded runner then
applied the migration only to isolated Development. The receipt records
236/236 baseline-aware drift, and the applied schema passed synthetic direct
RLS plus separate-connection arrival, release, and revoke/release races.
Cumulative domain, security, Parent/Manager, Classroom, multi-Garden Staff,
ledger and release-contract tests passed. A final full-stack smoke and
controlled live-role QA remain open. Production migration, `main`, and
deployment are unchanged.
