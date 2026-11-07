# Manager → Staff task journey — scoped Development record

## Scope and source

- Task: `GB-PRODUCT-MANAGER-STAFF-TASK-JOURNEY-20261107`.
- Canonical source: `origin/integration/development@fc1ded55ac9dea04d6c6c50c2e211ff7a722f95a`.
- Isolated branch/worktree: `codex/manager-staff-task-journey-20261107` / `/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/worktrees/manager-staff-task-journey-20261107`.
- Product commits: `4e649debc2a174e49dd08edc987875355b705cbf`, `f6ab3fead7278b9e9869bedc463b6a1bfe88c0f1`. Remote feature ref was verified at the second commit before this report.
- Source paths: Manager and Staff task pages, task workbench, active-employment assignee helper, and focused QA checks/harness. No schema, RLS, Auth, RPC, dependency, provider, Digital Observer core, `main`, or Production change.

## Behavior and boundaries

The Manager task page resolves the authorized selected Garden, offers only approved active Staff with a current employment in that Garden, and leaves assignment authority with the existing server RPC. The Staff page uses its verified employment Garden instead of a possibly stale profile Garden. Both lists are bounded to 120 rows and show an unavailable state on read failure. Garden context remounts the workbench, so a prior selection cannot persist across Garden changes. The source-entity label now reflects canonical linked-task fields. This does not create a new task state or expand any role.

## Local synthetic evidence

One guarded feature QA run created exactly one ordinary Garden B task, `e7df7bb9-5648-4cd2-8855-2129ac3f7bf5`, for active Staff B. Manager B created it via UI; Staff B started and submitted it; Manager B approved it. The four browser business POSTs succeeded, with final database status `done`. Its **overall receipt is FAILED** because the subsequent capture expected a completed task in the default active filter. Selecting the existing `הושלמו` filter is the correct UI behavior. Protected receipt SHA256 `a4ddfec163ac1758bb9627672e174e8952960f0f6510d3ffa6f0faab44538742` at `/Volumes/DIGITAL_OBSERVER/Development/gan-batuach/manager-staff-task-journey-20261107/evidence/receipt-1794057959151.json`. No second task or repeat mutation was attempted.

At exact feature SHA `f6ab3fead7278b9e9869bedc463b6a1bfe88c0f1`, a readback run passed `SCOPED_PASS` 22/22 with **zero browser writes**. The same completed task appeared in Staff and Manager UI after choosing the completed filter. A repeated approval returned idempotently without extra audit or notification. Known-ID direct reads by foreign Staff A, Manager A, and Parent A returned no row; their reopen requests returned 403 without task data; guest was denied. The task remained `done`. The task had exactly four audit events and two `in_app` notifications, with no observed external delivery channel. Protected receipt SHA256 `1909db729c0041f8286cd00b7305a5fae9cb8f650fe4f6c6694f3177f10e9fd3` at `/Volumes/DIGITAL_OBSERVER/Development/gan-batuach/manager-staff-task-journey-20261107/evidence/receipt-1794058350180.json`. Actual UI screenshots are listed in that receipt and were visually inspected.

An earlier cold-start attempt failed before mutation with zero writes and three preflight checks; its protected receipt SHA256 is `c5db2b68a5abbb18c10cbde585655a1c927e7a0d8621c6c30ec446df8aaa33e5`. These receipts are retained rather than overwritten. The one synthetic task remains in the isolated local QA database; QA personas were not reset.

Focused assignee tests passed 2/2 and existing task workflow checks passed 6/6. Pinned dependencies were installed in the isolated external-volume worktree; full typecheck, changed-path ESLint, QA script syntax and diff check passed. The feature preview used LOCAL_SUPABASE on loopback and is stopped. One scoped run is not full Product, exhaustive security, forced database-failure behavior, external owner visual approval, live provider, or invoice-backed cost proof. A same-Garden unassigned Staff denial fixture was not independently exercised; the canonical RPC remains the authority. No new paid dependency or fixed monthly commitment was introduced. The project-wide ₪15 per paying user ceiling still requires invoice-backed release review.

The first PR #343 `management-context` check failed because its source assertion only recognized the older `profile.garden_id`/optional-employment syntax, while the scoped Staff page now uses the required verified `employment!.garden_id`. The assertion was updated to check both the verified employment assignment and the actual task query's Garden predicate. Local Management context, existing task, and new assignee tests then passed 16/16; the corrected exact PR head must still pass remote CI.

## Delivery gate

This report records source preservation and scoped QA only. Before Development closure, the exact PR head must pass all six CI gates and applicable quality/security checks, merge by ancestry into `integration/development`, and receive fresh post-merge canonical QA. Full Product/security/visual/cost release gates remain open. Do not merge `main`, deploy Production, or begin RELEASE-GAP-01.
