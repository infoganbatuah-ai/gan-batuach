# Canonical Development Integration Ledger

Effective 2026-09-19. Machine-readable source: `DEVELOPMENT_INTEGRATION_LEDGER.json`. Migration variants and ordering: `DEVELOPMENT_MIGRATION_LEDGER.json`. Full observed branch/worktree/stash/file inventory: `DEVELOPMENT_STATE_AUDIT_2026-09-19.json`.

**Main is release-only. No owner release authorization has been issued for this workflow migration. No Production deployment or database write is authorized.** Earlier dated release ledgers and PR descriptions mentioning midnight are historical records, superseded by AGENTS.md.

## Current transition

- Remote main baseline: `8113d0607e4282dc8778540aa58c1502367f4221`. Existing Production was observed Ready on the same commit, deployment `7N3RZmP34J4MTGsXq8JHQiq7bgiu`; this is not a new deployment.
- Canonical development branch: `integration/development`; durable worktree `worktrees/development-integration`. Original dirty root main is preserved and must not be pulled/switched to overwrite local work.
- Feature unit for this migration: `codex/development-workflow-20260919`. Owns workflow docs, ledgers, inventory/guard scripts, local launcher and development identity only.
- GB-M29: PR #57 / `450ac46d38d366b43a25c14f2c0a1075fd52c0e8`, eligible for development integration after scoped recheck; migration `20260913210000_management_canonical_messaging_threads.sql`. Full isolated role/schema QA is still required; no Production application.
- SEO: `86a8cbb7fd88ecc61b00b94fee4640e88eeaee89`, scoped public metadata/copy changes. Preserved remotely during this transition; no schema. Older SEO completion tip `03ca7e7a4376bafa78fbdf9c0eb78cc3a7ffc2a5` has an exact tree equal to remote main and was pushed to preserve its original history, not reapplied over main.
- Security/observability `13d1317d7ee5b31a67958eab835fb34a06b358ed`: preserved to remote `codex/preserve-security-observability-20260919`, not integrated. Old base and root overlap require semantic reconciliation; preserve newer main behavior.
- PUSH 38 / draft PR #28 remains NOT DONE. Camera task is actively working on its source; no concurrent staging, reset, push or merge by this task. Its local `ae0fc714...` delivery draft and sensitive external qualification artifacts require its owner's current handoff. The blocked 256 MiB delivery migration must not be applied against the 50 MB capped store. Do not infer that a missing/partial temp checkout means its Git objects or external artifacts are lost or verified.

## Explicit outstanding gates (do not hide these)

1. No Docker/local Supabase configuration was available: local backend/schema application/authenticated Product QA is NOT TESTED. UI-only preview is not full Product readiness.
2. Mixed-owner root work, stash, historical/parallel branches and detached work are individually represented by inventory and ledger states. Not all are approved for integration. Do not call the transition completely reconciled while these owner/equivalence decisions remain.
3. Some registered temporary worktrees have missing `.git` links/unreadable status even where their directory exists. Preserve metadata and contents; no prune/cleanup. Audit presence and status-readability separately.
4. All 449 observed migration file/blob variants are inventoried, including historical branches. This does **not** mean all should be applied. Only the cumulative selected set is a release candidate. Production application history remains UNVERIFIED until a read-only remote comparison; file presence is not proof.
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
