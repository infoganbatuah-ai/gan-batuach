# Canonical Development Integration Ledger

Effective 2026-09-19. Machine-readable source: `DEVELOPMENT_INTEGRATION_LEDGER.json`. Migration variants and independent development/Production states: `DEVELOPMENT_MIGRATION_LEDGER.json`. Latest branch/file/stash inventory: `DEVELOPMENT_FINAL_STATE_AUDIT_2026-09-19.json`, `DEVELOPMENT_LOCAL_RECONCILIATION_2026-09-19.json`, `DEVELOPMENT_BRANCH_RECONCILIATION_2026-09-19.json`. Initial audit is retained as historical evidence.

**Main is release-only. No owner release authorization has been issued for this workflow migration. No Production deployment or database write is authorized.** Earlier dated release ledgers and PR descriptions mentioning midnight are historical records, superseded by AGENTS.md.

## Current transition

PUSH 38 relay-probation checkpoint (2026-10-02): the failed live 0.2.56
HLS-window canary completed 15 minutes and recorded a strict source-availability
failure at CH10 checkpoint 4 and CH4 checkpoint 11. Gateway liveness remained
available, with zero process restarts, socket/session/auth failures, playback
failures or AI failures. Runtime source
`dfac1ce380e7a08ab4374d6dbca57bcad269745b` retains the existing 14-second
pre-output deadline but honors the already-defined bounded 21-second total
OUTPUT_RESCUE probation after first output. A real-DVR CH4/CH10 Shadow ran
610,640 ms / 39 checkpoints with zero playback, stale-input or recovery-start
failures. Release metadata is preserved at `bcbe88211920ee04b7e333c0c8d3fc7f9a169b8a`;
the monitor now records exact failed source/checkpoint state at `9fd296ea`.
TypeScript, lint (zero regressions), Domain 30/30, Security 33/33, 209 migration
checks, release contract, relay 18/18, the local Production-compatible build and
exact-head Digital Observer CI run `36945524317` passed. Protected signing run
`36938914476` also completed successfully and produced artifact `11201873816`;
local bundle retrieval/trust verification remains pending. The unit remains
`PRESERVED_PENDING_INTEGRATION`: PUSH 38 is not done, 0.2.57 is not live,
main/Production are unchanged, and new canary/pre-soak/V8 remain pending.

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
ledger and release-contract tests passed. Closure PR #79 passed nine exact-head
checks and merged at `e048c81acae4307e80f9584917772614d984328d`, including
the baseline-aware local launcher fix. That exact head started as
DEVELOPMENT / INTEGRATION at `http://127.0.0.1:3000`; health was HTTP 200,
Garden attendance/release anonymous mutations were 401, and Parent pickup
contact management redirected anonymously to `/login` without mutation.
Controlled live-role QA remains open. Production migration, `main`, and
deployment are unchanged.

GB-M34 feature integration (2026-09-20): PR #81 merged by ancestry at
`9fe30d6a82c8111542bf16002910aa77a14bb914` after nine exact-head checks
passed on `0acb70a8428d82c38dd7b61805d33cb9a298dfa7`. Both source commits
remain on remote `codex/gb-m34-staff-time`. The forward migration
`20260920150000_management_staff_time_ledger.sql` passed rollback-only
synthetic Staff/Manager/Inspector/Admin RLS and ledger QA, an applied-schema
check in a disposable clone, and separate-connection clock/correction races.
Approval PR #82 is **blocked**, so its migration-ledger permission is explicitly
`BLOCKED_REQUIRED_CI`. The required Digital Observer domain gate failed twice
in `horizontal-ai-scale`: workers reported 122 completions for 120 canonical
jobs. The separate queue/ACK race needs its own reviewed fix; the GB-M34
Management diff keeps Digital Observer core unchanged. A restricted 5.5 MB
synthetic Development backup was copied to
`/private/tmp/gb-m34-development-pre-migration.dump` with SHA-256
`1987abbd62191d3b2f1dabf3478034cd14a13f6032fbdcade44927e90673fa3a`
and tested through a disposable restore. Read-only preflight found zero
duplicate open sessions. No canonical Development migration was applied;
cumulative Product QA remains blocked. Production, `main`, and customer time
records are unchanged; live Staff/Manager browser QA remains open for GB-M35/40.

The preceding GB-M34 blocker snapshot is superseded by the separate Digital
Observer repair PR #83 (`251274482432fcc7fe6eebf21b056ac69517b097`),
merged into `integration/development` at
`63b45d0b7edcf5bf1a5cee3cd9ad23fdfcc944bf`. It fences acknowledgement,
failure, and failover under a write transaction. The unchanged horizontal-scale
case passed 10/10 local runs, a dedicated 120/500/1,000-job race test passed,
and PR #83 required checks passed. PR #82 was updated with this repaired
integration baseline at `502c1346f24dedd044a2c9d54723077deb07d860`;
its required checks passed. GB-M34 migration approval is restored for isolated
Development only, conditional on final PR #82 exact-head checks and merge.
Canonical Development application and cumulative Product QA remain pending;
Production is untouched.

GB-M34 isolated Development closure (2026-09-20): final PR #82 head
`5497be7f28ab8578fe7854ba97c81b525286783a` passed all exact-head
required checks and merged by ancestry at
`89dc2d98f4d6f88d57b4ab49487edaab15481cc9`. The guarded Development
runner applied `20260920150000_management_staff_time_ledger.sql` to the
local `gan-batuach-integration` database only. The canonical schema and
migration drift checks passed 237/237; the receipt is in
`development/database/development-application-receipts.json`. Applied-schema
rollback-only role/RLS checks, cumulative domain 30/30, security 7/7,
Staff/Manager 92/92, Parent/Manager 20/20, typecheck, local build, lint
regression and release preflight passed. A loopback Development smoke at
`http://127.0.0.1:3000` on the exact integration commit returned health 200
with Supabase OK and anonymous Staff-time GET/POST 401. Controlled live
Staff/Manager browser QA remains open for GB-M35/40. Production and `main`
remain untouched; this receipt is not an owner-authorized release.

GB-M35 pending handoff (2026-09-20): the synthetic-role QA branch
`codex/gb-m35-role-e2e-qa` is preserved remotely at
`2fad28a68c71c134e23eabf6af4962c299475d2f` in draft PR #86 targeting
`integration/development`. Its matrix, report, redacted receipt and guarded
QA harnesses record partial isolated Development evidence. Inspector guard
repair PR #85 merged separately at `1a0162f261c6141ffb06b3ebe2abf41181a81b70`.
The branch has since advanced to `24c9d766d3500e7867b407e82a98ef4597eeff05`
with 238/238 isolated migrations, a 9/9 Owner-only onboarding and
Garden-scoped invitation browser retest, and separate-connection notification
and document-replacement races. Scoped P1 fixes #91–#94 are merged to
Development; PR #86 remains a draft. Full GB-M21–M34 transactional browser
journeys, signup/Email confirmation and the other concurrency/IDOR gates
remain open. This ledger entry records the unit as **BLOCKED / pending
integration**; it does not merge #86, authorize GB-M36, or release Production.

GB-M35E final closure (2026-09-22) supersedes the pending handoff above. The
stable isolated Auth/DB/Storage environment completed the mandatory internal
matrix with `PASS 40`, `PASS_WITH_P2_P3 3`, `BLOCKED_EXTERNAL 2`, `PARTIAL 0`
and `NOT RUN 0`; no P0/P1 remains. Exact source
`124323ec965656fbe127dd5679b0e62caf0c1027` passed all nine required checks in
PR #86 and was merged by ancestry into `integration/development` at
`693a225a2f17399575e4e2588309bb9051ea53b7`. The external blocks are limited
to controlled live Resend/FCM proof and the owner-controlled Production
release. Accessibility label findings remain P2, no WCAG certification is
claimed, and Production, `main`, customer data and Digital Observer core are
unchanged.

GB-M35 temporary-credential P1 (2026-09-20): scoped PR #98 merged by ancestry
into `integration/development` at
`f83eb1bb781c050019ff6c7e877f946276aecf23`, preserving source commit
`f97819e520dbffd4e4b75e7238da314f3b8cb7f3`. Its nine exact-head
required checks passed. The repair replaces reusable plaintext temporary
passwords in legacy Admin/Garden provisioning with signed Supabase Auth Email
invitations and recovery, removes password projections/mock payloads, and
restricts demo seeders to explicit loopback QA. The forward migration
`20260920170000_retire_generated_plaintext_credentials.sql` removes the secret
column while retaining non-secret history. A disposable synthetic Auth clone
passed invitation/Email-confirmation and migration checks. The canonical
isolated Development application is pending in the migration ledger; PR #86
remains draft and GB-M35 role/browser QA remains open. Production, `main`, and
customer accounts are unchanged. Historical Production backups require
retention/security review in the later owner-authorized release.

GB-M35E Parent Enrollment P1 closure (2026-09-22): scoped PR #109
preserved source commit `a5b6dfd715bd43e77546b26f72d6ea32e51678e7` and merged it
into `integration/development` as `166a65c2d4abe5095783fc3d28b157a2ed0aaa7b`.
The follow-up activation repair PR #110 preserved source commit
`f15dccb46f1c0fcca33ee43263652e127a0c0130`, passed 10/10 checks,
and merged as `d001f37c2a030a371adb7267f1a428c670f758c8`. Healthy isolated
Auth QA completed the Parent Enrollment journey 19/19 with canonical
`activated` status, manual arrangement state, and exactly one typed audit row
per event. The two forward-only migrations are approved here for the guarded
isolated Development database in order; this does not authorize Production,
`main`, GB-M36, or any Digital Observer change. PR #86 remains draft pending
full GB-M35E matrix closure.

GB-M36 Development integration closure (2026-09-22):
`codex/gb-m36-reporting-analytics` preserves canonical Management reporting at
source commit `a9145914ee39f950bda1591fcad6c421e3c02917`. The read-only reporting
contract derives role-scoped totals and bounded CSV exports from the canonical
attendance, pickup, Staff-time, tuition, subscription, inspection, corrective
action, complaint, Task, document, enrollment and Classroom-capacity sources.
Authenticated role E2E passed 27/27; rollback-only RLS passed; the 500-row
synthetic scale test proved the 200-row page bound and cleanup; Management
passed 255/255, Parent/Manager 22/22, domain 30/30, security 7/7 and migration
health 243/243. Typecheck, Production build, lint baseline and release-contract
preflight passed. PR #117 completed 9/9 required checks at exact head
`aafff972df64c1617cc75aab4907b7ba7b4d46d3` and merged by ancestry into
`integration/development` at `48d2bbc489d53eb096b03bfe3f6b91ad904ae050`.
The merge tree is byte-identical to the validated PR tree. No migration or
paid provider was added; Development remains at 243/243 migrations. The unit
is `LOCAL_VERIFIED` and ready for the later owner-controlled consolidated
release. Production, `main`, customer data and Digital Observer core are
unchanged.

GB-M37 branch validation (2026-09-22):
`codex/gb-m37-role-command-center` preserves the canonical role-dashboard and
navigation consolidation at source commit
`ff21556b61970cf0b4644a27384abc2d3a292ba4` in PR #119 targeting
`integration/development`. Branch validation passed Management 264/264,
Parent/Manager 22/22, domain 30/30, security 7/7, GB-M36 reporting 7/7,
migration health and canonical Development drift 243/243, 16/16 synthetic
role dashboard smoke, 8/8 interactive role/context E2E, typecheck, Production
build, lint baseline, release contract and built-server health/auth smoke. No
migration or paid provider was added. Exact final-head PR checks and cumulative
post-merge Development verification remain pending. Production, `main`,
customer data and Digital Observer core are unchanged.

GB-M37 Development integration closure (2026-09-22): PR #119 passed all nine
required checks at exact head
`5de0869fc598b1e0848fa4f4fb10cc43af5ecdce` and merged by ancestry into
`integration/development` at `e96b1e722a2a39ee18aeedc48d46f94f101f7294`.
On that exact merge, Management passed 264/264, Parent/Manager 22/22, domain
30/30, security 7/7, reporting 7/7, migration health and Development drift
243/243, role/context E2E 8/8, typecheck, lint, build and release preflight.
Built-server health returned 200 with Supabase OK and protected dashboard APIs
returned 401 without authentication. No migration was required. The unit is
`LOCAL_VERIFIED` and ready only for a later owner-authorized consolidated
release. Production, `main`, customer data and Digital Observer core remain
unchanged.

GB-M38 branch validation (2026-09-23):
`codex/gb-m38-legacy-consolidation` preserves the evidence-based Management
legacy consolidation at product commit `5a01a973`. It converts three proven
bookmark routes to fixed canonical redirects, removes one zero-caller legacy
Dashboard component, retains a guarded internal API after required CI proved a
cross-project dependency, and records final classifications for all identified
candidates. Branch validation passed Management 272/272, focused GB-M38 8/8,
GB-M37 dashboards 9/9, GB-M36 reporting 7/7, domain 30/30, security 7/7,
migration health 243/243, typecheck, Production build, lint baseline and release
contract. No migration, paid provider or Digital Observer core change was
introduced. Exact-head PR checks and cumulative post-merge Development smoke
remain pending. Production, `main` and customer data are unchanged.

GB-M38 Development integration closure (2026-09-23): PR #121 passed all nine
required checks at exact head
`9e16f276da9c159d244702a76b0a83cd5d058fe0` and merged by ancestry into
`integration/development` at `b143d6f163a5a24bb2ef2020c5c9f2f00d090901`.
On that exact merge, focused GB-M38 passed 8/8, Management 272/272, dashboards
9/9, reporting 7/7, security 7/7, migration health and Development drift
243/243, typecheck, lint, build and release contract. Built-server health
returned HTTP 200 with Supabase OK; canonical login and all five role dashboard
routes avoided 500; compatibility redirects discarded forged context IDs; and
the retained internal API returned 401 without authentication. No migration or
paid provider was added. The unit is `LOCAL_VERIFIED` and ready only for a
later owner-authorized consolidated release. Production, `main`, customer data
and Digital Observer core remain unchanged.

GB-M39 branch validation (2026-09-23):
`codex/gb-m39-production-readiness` records the full Development→Production
delta, the exact 16-migration release sequence, configuration inventory,
backup/restore evidence, rollback runbook and release blockers at source commit
`434cebb88c72a27dd3fe68928be841073d8d16a1`. It hardens public Auth-facing
mutations, passkeys and five Management QA/internal APIs without adding a
migration or touching Digital Observer core. Branch validation passed domain
30/30, security 8/8, migration health 243/243, typecheck, lint, Production
build, release contract and the focused Management/Parent/Inspector/Staff,
reporting, dashboard and legacy regressions. The candidate is intentionally
`BLOCKED` for Production: 23 populated recoverable temporary-password rows
require credential recovery/rotation, Production Auth and required
configuration are unverified/incomplete, provider backup and Storage recovery
are unproved, and the ≤₪15 cost gate lacks invoice/user evidence. GB-M39 is
eligible for Development integration as a security hardening unit; it is not
owner authorization to release, migrate Production or merge `main`.

GB-M39 Development integration closure (2026-09-23): PR #123 passed all nine
required checks at exact head
`5ff091281f8b1d6cf63aeab1d3fe1e517c27164c` and merged by ancestry into
`integration/development` at `8f7620c20397ab52e38103dff5b9dca9267f7ac0`.
The merge tree is identical to the validated PR tree. Post-merge verification
passed the GB-M39 hardening suite, domain 30/30, security 8/8, migration health
243/243, reporting 7/7, dashboards 9/9, legacy consolidation 8/8, typecheck,
lint regression and release-contract preflight. The Development hardening unit
is `LOCAL_VERIFIED`; the cumulative Production release candidate remains
`BLOCKED_PRODUCTION_READINESS` by the recorded credential, Auth/config,
recovery and cost gates. No Production migration, deployment or `main` change
occurred, and Digital Observer core remains unchanged.

GB-M40 branch qualification (2026-09-23): `codex/gb-m40-release-qualification`
at `a5c56da9312fb6b968badd4eb8c257a923629864` is remotely preserved. The
Production blocker audit remained read-only and found 22 legitimate accounts
requiring canonical recovery proof plus one synthetic record; no credential
value was selected or printed. Production Auth configuration was verified,
while required URL/deep-health/cron/hash configuration, provider-managed
restore and durable private Storage recovery acceptance, actual all-in cost
certification, and explicit owner release authorization remain open. Local
qualification passed domain 30/30, security 10/10, 243-migration audit, all
focused Management suites, Parent/Manager 22/22, Production build, lint,
release preflight, 16-migration rehearsal, private Storage recovery and built
health/protection smoke. Production and `main` are unchanged; GB-M40 is
`PUSHED_REMOTE` and pending protected PR integration only.

GB-M40 Development integration closure (2026-09-23): PR #125 passed all nine
required checks on exact head `97c5fff353b0a5fc9cf2bb5ef2dac605bab6aeba`
and merged to `integration/development` at
`494b8e9c768c261dda62158b532deef3e9375c78`. A new clean detached integration
worktree passed Security 10/10, Domain 30/30, migration audit 243/243 and the
Parent/Manager contract 22/22; the exact feature head had also passed all
focused Management suites, typecheck, Production build, lint regression,
release preflight, 16-migration rehearsal, private Storage recovery proof and
built-server health/protection smoke. No migration was added or applied, main
and Production remain unchanged, and the documented Production readiness
blockers remain binding.

UX-IMPLEMENT-02 branch qualification (2026-09-24):
`codex/ux-implement-02-owner-onboarding` is remotely preserved at product
commit `572c9ac711091df793c10453368568346509e1c2` with PR #132 targeting
`integration/development`. The approved Gan Batuach visual system now covers
the complete canonical five-stage Owner/Garden onboarding flow on Desktop and
Mobile. Browser E2E passed 9/9, visual QA passed 22/22 captures with no partial
or failed surface, and branch gates passed typecheck, zero-regression lint,
domain 30/30, security 10/10, migration health 243/243, release contract,
Production build and exact-head preflight. The Parent invitation endpoint now
uses the server-authorized current Garden instead of legacy
`profiles.garden_id`. Required PR checks and post-merge cumulative Development
verification remain pending. No migration, paid provider, Production, `main`
or Digital Observer core change is included. UX-IMPLEMENT-03 has not started.

UX-IMPLEMENT-02 Development integration closure (2026-09-24): PR #132 passed
all required checks on exact head `6a8aaedc6df02a003d1c365d90869fbfd4c58cae`
and merged to `integration/development` at
`fd3fd866dc13f2f81f12a14b1be21afd0ce7d00e`. A clean integration-closure
branch at that merge passed the focused onboarding 11/11, Parent/Manager 23/23,
Owner/Teacher 6/6, multi-Garden 9/9, Classrooms 10/10, capacity 6/6, documents
6/6, signed invitations 6/6, Parent acceptance 5/5, subscriptions 5/5,
typecheck, Domain 30/30, Security 10/10, migration health 243/243 and the release
contract. Visual QA remains 22/22 Desktop/Mobile captures with zero partial or
failed surfaces. No migration, paid provider, Production, `main` or Digital
Observer core change occurred. UX-IMPLEMENT-03 has not started.

UX-IMPLEMENT-04 branch qualification (2026-09-24):
`codex/ux-implement-04-children-classrooms` contains the canonical Children,
Classrooms, Child profile and Enrollment visual implementation at product
commit `8c5eb45090552a793d0fb08ea1ee6ca2d6e6731c`, with implementation and
synthetic visual evidence at
`b253d7486d622b0f0c7df5d0074524da36077ba1`. Desktop and Mobile visual QA
passed 26/26 captures with no console errors, server errors or horizontal
overflow. Branch validation passed the focused Children/Classroom/Enrollment,
capacity, attendance/pickup, tuition, documents, multi-Garden and role-boundary
suites; every synthetic browser persona passed; and typecheck, zero-regression
lint, Production build, Domain 30/30, Security 10/10, migration health 243/243,
Development drift and release-contract preflight passed. Exact-head PR checks
and cumulative post-merge Development verification remain pending. No migration,
paid provider, Production, `main` or Digital Observer core change is included.

UX-IMPLEMENT-04 Development integration closure (2026-09-24): PR #136 passed
all nine required checks on exact head
`1753ea3cea948fdcad3bc39b523277d0a442e669` and merged by ancestry into
`integration/development` at `fad78a6b42d14753c5b277cbdc5de2ed364969fc`.
The merge tree is identical to the validated PR tree. A fresh detached checkout
passed UX-04 focused 6/6, capacity 6/6, Enrollment lifecycle 7/7, activation
8/8, Parent/Manager 23/23, Security 10/10, migration health 243/243 and ledger
validation. The canonical Development launcher then served the exact merge at
`127.0.0.1:3000`; health returned HTTP 200 with local Supabase OK, the build
identity matched the merge SHA, and all 16 synthetic Owner, Parent, Staff,
Inspector and Admin dashboard journeys passed without browser page errors. An
additional route sweep was stopped after three passing Parent routes to yield
machine resources to concurrent Home Edge qualification and is not counted as
PASS evidence. No migration, paid provider, Production, `main`, customer data
or Digital Observer core change occurred. UX-IMPLEMENT-05 has not started.

UX-IMPLEMENT-06 Development integration closure (2026-09-24): PR #140 passed
both required workflows on exact head
`055c160ee0035ba6f0b6ca7e097e22e127967d4c` and merged by ancestry into
`integration/development` at `e04b6515d16e67b2ace4c753b646975279070daa`.
Branch validation passed UX-06 focused 8/8, live isolated-backend
attendance/pickup role and concurrency QA 14 checks, dashboards 9/9,
Parent/Manager 23/23, typecheck, zero-regression lint, Production build,
Domain 30/30, Security 10/10, migration health 243/243, release contract and
exact-head preflight. Desktop and Mobile visual QA passed 13/13 captures with
no partial or failed screen. No migration, paid provider, Production, `main`,
customer data or Digital Observer core change occurred. UX-IMPLEMENT-07 starts
only after cumulative post-merge Development verification.

UX-IMPLEMENT-07 Development integration closure (2026-09-24): PR #142 passed
all required checks on exact head
`20c31250625a4617fa19d462b02252fe7c30b8de` and merged by ancestry into
`integration/development` at `3c169fe7eb1806db96cff759accf43da1c725abc`.
Branch validation passed UX-07 focused 7/7, Staff-time role E2E 16 checks,
multi-Garden Staff 8/8, dashboards 9/9, Tasks 6/6, documents 6/6,
Parent/Manager 23/23, UX-06 regression 8/8, typecheck, zero-regression lint,
Production build, Domain 30/30, Security 10/10, migration health 243/243 and
release contract. Desktop and Mobile visual QA passed 16/16 captures. The
canonical merged Development launcher returned health HTTP 200 with local
Supabase OK, exact build identity, and cumulative role dashboard E2E 8/8. No
migration, paid provider, Production, `main`, customer data or Digital
Observer core change occurred. UX-IMPLEMENT-08 has not started.

UX-IMPLEMENT-08 branch qualification (2026-09-28):
`codex/ux-implement-08-staff-recruitment` is remotely preserved at exact head
`1889d8ddfcfc2d4f9ee88379438ce31160615cce`, with product commit
`02d738305f3541b9ead2944c76f11cea4caaad25`. The canonical Candidate/Recruitment
experience now covers profile completeness, qualifications, documents,
discovery/matching, application lifecycle, signed invitations, activation
handoff and Garden-scoped manager recruitment on Desktop and Mobile. Visual QA
passed 34/34 fresh captures as OWNER_REVIEW_READY with zero drift, polish or
broken results. Focused and cumulative regressions, typecheck, lint, Production
build, Domain 30/30, Security 10/10, migration health 244 and release contract
passed. The bounded manager candidate-review policy migration is preserved but
pending integration and guarded isolated-Development application. Required PR
checks and post-merge verification remain pending. No Production, `main`, paid
provider, customer data or Digital Observer core change occurred.

UX-IMPLEMENT-08 Development integration approval (2026-09-27): PR #146
passed all eight required checks on exact head `76383aa27e0122adffd42265ddcb2f598a47209b` and merged by
ancestry into `integration/development` at `590f74ad661b8bc8524eb36ac413f33f16e756f1`. The bounded manager
candidate-review policy migration is approved for guarded isolated-Development
application; application receipt and cumulative post-merge QA remain pending.
Production and `main` remain unchanged.

UX-IMPLEMENT-08 Development closure (2026-09-27): product PR #146 passed
all eight required checks on exact head `76383aa27e0122adffd42265ddcb2f598a47209b` and merged by ancestry
as `590f74ad661b8bc8524eb36ac413f33f16e756f1`. Approval PR #147 and migration-receipt PR #148 also passed
all eight checks and advanced Development through `1d426d7b78724fb8105e5bf7ab17a9ddc0f1f78c`. The reviewed
manager candidate-profile policy is applied only to isolated Development; drift
is 244/244 with schema fingerprint
`2e5ac2bf9731f7dde7f5148ff2ae6f2169bc398bf7ea78ebca18e6cd3c8149e6`.
Exact merged Development startup, local health/Supabase, cumulative UX-03 through
UX-08 focused QA, Parent/Manager 23/23 and role dashboard browser QA 8/8 passed.
The 34-screen owner-review pack remains the exact checked product tree; invitation
visual proof uses a local-only QA signing key because the canonical launcher
correctly excludes signing secrets. No Production, `main`, paid provider, customer
data or Digital Observer core change occurred. UX-IMPLEMENT-09 has not started.

UX-IMPLEMENT-09 Development closure (2026-09-28): product PR #152 passed
all eight required exact-head checks plus Snyk at
`e2bf14f5ff1b1b4eb39317acd93baa727672f9e4` and merged by ancestry into
`integration/development` as `577db6de92abbf8a98f2bca4722d14d979518cbc`.
Nineteen Inspector concepts produced 38 fresh Desktop/Mobile captures, all
OWNER_REVIEW_READY with zero NEEDS_POLISH, VISUAL_DRIFT or BROKEN results.
Post-merge UX-09 and cumulative contracts, 244/244 Development drift, local
health/Supabase and role dashboard browser QA 8/8 passed. Inspector Live remains
disabled and is presented as unavailable/evidence-only because it is not both
Production-verified and Inspector-policy permitted. No migration, paid provider,
Production, `main`, customer data or Digital Observer core change occurred.
UX-IMPLEMENT-10 has not started.

UX-IMPLEMENT-10 Development closure (2026-09-29): product PR #154 passed
all eight required exact-head checks plus Snyk at
`646e3655159c71458831480e3a9a4177eb712768` and merged by ancestry into
`integration/development` as `cec5d491340f8ce73662b47ceab42a9bd5300faf`.
The canonical Parent tuition ledger and Garden platform subscription remain
separate, with truthful partial/manual/credit/reconciliation and provider-
unavailable states. Fourteen Finance concepts produced 28 fresh Desktop/Mobile
captures, all OWNER_REVIEW_READY with zero NEEDS_POLISH, VISUAL_DRIFT or BROKEN
results. The required dependency audit was restored to zero vulnerabilities by
refreshing the locked `firebase-admin` transitive chain after a new `fast-uri`
advisory. Post-merge focused Finance contracts, 19-check tuition role/concurrency
E2E, 244/244 Development drift, local health/Supabase and role dashboard browser
QA 8/8 passed. No migration, paid provider, Production, `main`, customer data or
Digital Observer core change occurred. UX-IMPLEMENT-11 has not started.

UX-IMPLEMENT-11 Development closure (2026-09-30): product PR #156 passed the
exact-head Management tenant-context workflow, all seven Digital Observer CI
jobs including the six required gates and canonical quality gate, plus Snyk at
`efa2e97a0dd2e5718302ed33425d9a71d1622fe3`. It merged by ancestry into
`integration/development` as `1c29c53fb35bdb28a2a10d19759a9355c9df3ef1`.
Messaging, broadcasts, notifications, complaints and Tasks remain separate;
private attachments and role/Garden scopes remain canonical; external delivery
channels remain disabled unless provider submission readiness is proven. Twenty
communication concepts produced 40 fresh Desktop/Mobile captures, all
OWNER_REVIEW_READY with zero NEEDS_POLISH, VISUAL_DRIFT or BROKEN results.
Post-merge UX-11 focused contracts, the 50-case management-context suite,
244/244 Development drift and local app/Supabase health passed. No migration,
paid provider, Production, `main`, customer data or Digital Observer core change
occurred. The closure receipt then encountered newly published critical Next.js
and high-severity grpc-js advisories; compatible updates to Next.js 16.3.8 and
grpc-js 1.14.5 restored `npm audit` to zero vulnerabilities, with typecheck,
lint, security 10/10, UX-11 8/8 and the 538-page Production build passing.
UX-IMPLEMENT-12 has not started.

UX-IMPLEMENT-12 branch qualification (2026-10-01):
`codex/ux-implement-12-documents` implements the canonical private Documents
platform for Owner/Manager, Parent, active Staff, Inspector and authorized
Admin roles. Twenty concepts produced 40 fresh Desktop/Mobile captures, all
OWNER_REVIEW_READY with zero NEEDS_POLISH, VISUAL_DRIFT or BROKEN results.
Private Storage, signed retrieval, role and Garden isolation, replacement
history, backend-authoritative verification, expiry and separation from message
attachments and inspection evidence passed focused, live-RLS, security, domain,
typecheck, zero-regression lint, migration, release-contract and 539-page
Production-build validation. Exact-head PR checks and cumulative post-merge
Development verification remain pending. No migration, paid provider,
Production, `main`, customer data or Digital Observer core change is included.

UX-IMPLEMENT-12 Development closure (2026-10-02): product PR #158 passed the
exact-head Management tenant-context workflow, all seven Digital Observer CI
jobs including the six required gates and canonical quality gate, plus Snyk at
`54308f492fa8cdd7c68fb9548b2fd3351defade4`. It merged by ancestry into
`integration/development` as `7784388b8122669e41df25853d258d99dba682e8`.
Post-merge UX-12 Documents 6/6, canonical Documents 6/6, Inspector 8/8,
Messaging 8/8, typecheck, ledger validation, exact Development startup,
app/Supabase health and cumulative eight-role dashboard browser QA passed.
All 40 Desktop/Mobile captures remain OWNER_REVIEW_READY with zero
NEEDS_POLISH, VISUAL_DRIFT or BROKEN results. No migration, paid provider,
Production, `main`, customer data or Digital Observer core change occurred.
UX-IMPLEMENT-13 has not started.

UX-IMPLEMENT-13 branch qualification (2026-10-02):
`codex/ux-implement-13-tasks-complaints` is remotely preserved at product commit
`e3ea4e29d73502e9c0458360ddf007c13c4214fe`, based on canonical
`integration/development` head `a4e727f26908591080fea275b028b18ed5c7300f`.
The canonical Tasks, Complaints and Corrective Actions experiences remain three
separate domains, with role-scoped Owner/Manager, Staff, Parent, Inspector and
Admin surfaces. Visual QA produced 38 fresh Desktop/Mobile captures across 19
concepts; all are OWNER_REVIEW_READY with zero NEEDS_POLISH, VISUAL_DRIFT or
BROKEN results. Focused UX-13, Task, Complaint/SLA, isolated Development role
and lifecycle, multi-session Task completion, corrective-action isolation and
score immutability, Parent/Manager, typecheck, zero-regression lint, Production
build, Domain 30/30, Security 10/10, migration health 244/244, Development drift
244/244 and release-contract validation passed. Exact-head PR checks and
cumulative post-merge Development verification remain pending. No migration,
paid provider, Production, `main`, customer data or Digital Observer core change
is included.

UX-IMPLEMENT-13 Development integration closure (2026-10-03): product PR #160
passed all nine exact-head checks at
`608f2d21b65d9424364776a71aeb2e99db90409e` and merged by ancestry into
`integration/development` as `88983d82738d80d6a1f0d2150d0f35a94e860518`.
All 19 Tasks, Complaints and Corrective Actions concepts and 38 Desktop/Mobile
captures remain OWNER_REVIEW_READY with zero NEEDS_POLISH, VISUAL_DRIFT or
BROKEN results. Exact merged Development startup, local health/Supabase, the
18-route authenticated Product verification, UX-13 focused 6/6, canonical
Task/Complaint 11/11, Parent/Manager 23/23, quiet-snapshot typecheck, Domain
30/30, Security 10/10, migration health 244/244, integration-ledger and release-
contract checks passed. No migration, paid provider, Production, `main`,
customer data or Digital Observer core change occurred. UX-IMPLEMENT-14 has not
started.

UX-IMPLEMENT-14 Development integration closure (2026-10-03): product PR #162
passed all nine exact-head checks at
`e1faaa7b82297b84130d7a8186e82abeac0e2f74` and merged by ancestry into
`integration/development` as `7c54b20e3ea593465cbf3c6d9646153edc69dca4`.
All 17 inspection concepts and 34 Desktop/Mobile captures were regenerated from
the exact merged Development head; all are OWNER_REVIEW_READY with zero
NEEDS_POLISH, VISUAL_DRIFT or BROKEN results. The canonical launcher reported
`DEVELOPMENT / INTEGRATION`, `LOCAL_SUPABASE`, `production:false` and
`http://127.0.0.1:3000`. Local health, UX-14 focused 9/9, Inspector approval
4/4, inspection/corrective lifecycle 25/25, private evidence authorization
21/21, Parent/Manager 23/23, UX-09 8/8, UX-13 6/6, typecheck, zero-regression
lint, 541-page Production build, Domain 30/30, Security 10/10, migration health
and Development drift 244/244, and release-contract checks passed. Merged-head
evidence is preserved at `793bb1d31f99ad9f22fc44da988fd2e7070074e7`.
No migration, paid provider, Production, `main`, customer data or Digital
Observer core change occurred. UX-IMPLEMENT-15 has not started.
