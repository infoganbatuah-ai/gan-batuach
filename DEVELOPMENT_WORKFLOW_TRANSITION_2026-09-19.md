# Owner-controlled workflow transition — 2026-09-19

## Result and scope

Policy active; cumulative integration exists locally and remotely. **Full Product/backend verification and historical-work reconciliation remain BLOCKED**, not complete. No owner release approval, main merge/push, Production deployment or Production SQL was performed by this task. No branches, stashes, worktrees, archives or user files were deleted/reset/cleaned.

Canonical root remains the Kingston project. Its mixed-owner Product changes were preserved: all 63 hashable files in the initial root inventory still matched at final comparison. Root HEAD remained `21d5e2854363552c0210f02a187930b48c384fcd`; remote main remained `8113d0607e4282dc8778540aa58c1502367f4221`. Only root AGENTS.md was intentionally changed to activate the new contract before inventory capture.

## Preserved and integrated

| Unit | Source / remote proof | Development disposition |
| --- | --- | --- |
| Workflow | `codex/development-workflow-20260919` / `29f253b636f7edba0d853d1a9e439e13635c0293` | Integrated by `5d71fdc8c3ab04a7bebf3d872c67e2ca94ccb5e7`; portability follow-up `4f38fe2ba3d92f81a1f5e94f705ee56ece08492f` |
| Canonical SEO | `codex/seo-canonical-positioning-20260917` / `86a8cbb7fd88ecc61b00b94fee4640e88eeaee89` | Integrated by `8be94254a311920988415496b2e496d020855ab3`, no conflicts |
| Older SEO history | `codex/seo-content-completion` / `03ca7e7a4376bafa78fbdf9c0eb78cc3a7ffc2a5` | Exact tree equals main; preserved, not reapplied |
| Old-base security/observability | `codex/preserve-security-observability-20260919` / `13d1317d7ee5b31a67958eab835fb34a06b358ed` | Remote preserved; semantic review against newer main/root needed |
| GB-M29 | PR57 / `450ac46d38d366b43a25c14f2c0a1075fd52c0e8` | CI passed, pending isolated role/schema QA; not integrated |
| PUSH38 | Draft PR28; local delivery draft `ae0fc7145fcab4e6ffe79aee83afc5a5d5ee8685` | NOT DONE, camera owner active; no concurrent staging/push/integration |

The Management owner confirmed that it pushed integration tip `8be94254` during transition, with no main/deployment action, and handed exclusive integration ownership back to this task. It confirmed GB-M29 remains separate pending isolated QA. Source-branch and integration remote hashes above were checked with `git ls-remote`; final ledger/follow-up commits require the normal final push and comparison.

## Inventory and limitations

Initial 13:33 UTC inventory: 91 local branches + 98 remote-tracking branches; 32 registered worktrees; 2 directories missing; 16 statuses unreadable (includes missing directories); 1 retained stash; 449 migration file/blob variants. Later preservation branches and integration follow-ups are recorded in the development ledger. Initial PUSH38 worktree file status was captured during another task's restoration, not as a deletion decision. No prune/repair was attempted.

The 105 ledger units account for branch observations and preservation blockers; they are not 105 validated features. Ancestry, exact-tree and patch-ID equivalence are distinguished from semantic approval. At least one historical partial-clone comparison could not load an object; its unit is explicitly not proven. Root/stash/parallel legacy work must still receive semantic owner disposition. Stash `b8739d0d5b9073df4556ab507e4a17396519d277` was not applied or dropped.

227 selected baseline migrations passed static health. GB-M29 migration `20260913210000_management_canonical_messaging_threads.sql` remains excluded pending isolated verification. Historical variants are inventory, not an apply list. Production application history is UNVERIFIED; no migration was applied locally or remotely because no isolated full stack was available.

## Local validation

- Locked install: PASS, 765 packages, lifecycle scripts disabled for initial install.
- Cumulative Next build + TypeScript: PASS, 522 static pages. First sandboxed build could not bind an internal worker port; permission-adjusted local retry passed without live credentials.
- Domain suites: 29/29 PASS after correcting a hard-coded path in the new ledger initializer. Initial failure is retained here, not hidden.
- Security/isolation suites: 7/7 PASS (deterministic scope, not live hardware/provider proof).
- Workflow/environment guards: 5/5 PASS, including exact generated Next type-import handling; ledger structure PASS; release inclusion check correctly BLOCKED without owner approval.
- Migration health and release snapshot contract: PASS.
- Lint baseline: PASS, 0 regressions; canonical scope 0 errors/warnings. Existing broader baseline: 5,211 errors / 211 warnings, not a clean lint claim.
- Scoped/committed diff formatting: PASS. New source-blob secret heuristic scan: no findings; not a complete security audit.
- Dependency audit: 0 high/critical; 6 moderate transitive findings through Firebase/Google Storage/uuid, GHSA-w5hq-g745-h8pq. Owner: dependency/security follow-up; review before a future release (target 2026-09-26), no unrelated dependency auto-upgrade.
- Local Node 24.16 / Next 16.3.3. GitHub CI uses repository Node22; integration push now runs the existing six gates in GitHub without Vercel deployment. Do not infer remote CI PASS from local results.

At Product commit `4f38fe2b`, UI-only launcher bound `127.0.0.1:3000`. `/api/development/version` returned 200, DEVELOPMENT / INTEGRATION, exact SHA, `UNAVAILABLE_UI_ONLY`, `production:false`. `/`, `/digital-observer`, `/digital-observer/login`, `/digital-observer/alerts`, `/dashboard/garden/messages` returned 200 with the development and UI-only labels. These are page-render checks, **not authenticated live data or tenant-boundary verification**. `/api/health` returned 503, consistent with the unavailable backend. Default full-mode launcher correctly refused startup without isolated Supabase.

## Deployment controls

- Existing release/merge automations `automation-2` and `automation-3`: PAUSED; no restart on midnight or credit recovery. Monthly read-only audit retained. OpenAI documentation/automation skill guided the supported automation updates.
- Live Vercel Preview Branch Tracking disabled and persisted after reload; Production remains main. One Git-connected project observed; the two older deployment projects showed no repository connection; no deploy hooks.
- Repository Vercel Git policy: `**: false`, `main: true`. No spend limit, plan, production env or domain changes.
- After preservation pushes, unfiltered deployment listing still showed newest Ready main deployment from September 13, `7N3RZmP34J4MTGsXq8JHQiq7bgiu` at `8113d060`; the separate Error filter showed newest error September10. No new development deployment was visible. This is dashboard observation, not a billing guarantee or proof for future pushes.
- Included usage displayed $20/$20 and $4.60 on-demand. No billable add-on activated. Final live settings read verified Ignored Build Step = **Only build production**, Basic build machine, on-demand concurrency disabled and Node24. None of those existing settings was changed. Preview prevention also relies on the persisted environment setting and repository branch policy, not an assumed free canceled build.

## Final remote and local evidence

- Remote integration `156ffc7a2e6f909356816212ec2c7e61fe5f9ebb` matched local; original feature history retained. [GitHub run 35447522105](https://github.com/infoganbatuah-ai/gan-batuach/actions/runs/35447522105) passed all six gates and the aggregate quality gate on that exact commit (Node22).
- Earlier run `35447201645` at `8be94254` failed in event-outbox with expected2/actual3; this is distinct from the local initializer path failure. The subsequent full run passed without modifying event-outbox. Treat the earlier test intermittency as QA follow-up (owner: event-outbox/CI maintainer; review before release), not proof that an underlying timing cause was fixed.
- Restart on `156ffc7a` succeeded despite only the exact Next-generated type-import diff. Version endpoint returned that exact SHA; alerts page returned200 with matching SHA and UI-only label. No uncommitted Product files remained in the integration worktree. The generated `next-env.d.ts` diff was deliberately not committed/reset.
- Vercel was re-read after integration push: newest visible deployment remained September13 main `8113d060`; no new deployment appeared. Final inventory still found only the active camera owner's `ae0fc714` as a local-only branch commit; its blocked handoff remains explicit.
- This final evidence update changes documentation/ledger only; the displayed server SHA must be refreshed after the final commit if it advances. Future release still requires fresh checks on its exact candidate.

## Exact next actions

1. Provision an approved isolated Supabase/runtime environment; do not use Production secrets/data or a loopback tunnel to Production. Decide local Docker setup versus separately approved QA infrastructure.
2. Review/apply selected baseline migrations only to that isolated environment, verify synthetic auth/RLS/tenant journeys, then GB-M29 in dependency order.
3. Original owners reconcile mixed root/stash/old-base security and historical parallel work. Camera owner preserves and qualifies PUSH38 separately; no automatic legacy merge.
4. Keep each new unit committed, pushed and ledger-recorded. Only the integration owner advances the cumulative worktree; do not race its running tests/server.
5. No Production action until a new explicit owner instruction, frozen candidate, nothing-missing gate, exact required CI, migration/recovery/security/cost gates and owner-controlled release PR.
