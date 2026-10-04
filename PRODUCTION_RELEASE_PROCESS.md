# Production release process

## Owner-controlled release only — effective 2026-09-19

The canonical contract is AGENTS.md, section "Owner-controlled consolidated development and release". It supersedes earlier daily/midnight/per-PUSH release instructions, including historical handoffs. Main is release-only. Normal development goes to pushed feature branches, the DEVELOPMENT_INTEGRATION_LEDGER and integration/development, not main. No scheduled release or automatic retry to Production is authorized.

Only a new explicit owner release instruction authorizes a release. Freeze the exact integration SHA, reconcile all READY units and dependencies/migrations against remote branches, audit omitted/local-only work, and record INCLUDED / EXCLUDED / BLOCKED. Start that exact candidate locally for inspection. After full cumulative checks, cost/backup gates and required approvals, create one consolidated release PR to main. Apply only reviewed included migrations in their verified compatible order and let the existing main integration perform one intentional release sequence; do not also issue a manual deployment. Record actual deployment behavior rather than promising a billing count.

The steps below are validation requirements, not independent authorization to merge or deploy. PUSH 38 remains excluded until qualified. Production migration-history reconciliation must not replay already-applied or blocked draft migrations.

Production deployments must originate from a clean, committed Git snapshot. The commit is the release manifest and rollback target; a dirty working tree is never a deployable release.

Required gates:

1. Require the canonical `Digital Observer CI` workflow to pass all six deterministic gates. Local equivalent: `npm run ci:quality`.
2. Review the complete staged file list and scan it for credentials or private camera artifacts.
3. Run any Tier 2 integration, Tier 3 hardware or Tier 4 Production smoke checks required by the changed capability; these must not be represented as deterministic CI.
4. Run the focused feature QA, cross-layer regressions, typecheck, lint baseline and full production build.
5. Commit the complete intended release on a `codex/` release branch.
6. Run `npm run release:production:preflight`. It fails if the Vercel project binding is wrong, the worktree is dirty, the revision is not recorded, or forbidden local artifacts are tracked.
7. Apply database migrations separately and with an isolated dry run when the repository migration history differs from Production.
8. Deploy the exact clean revision and record its Vercel deployment ID and Production alias in the phase report.
9. Run authenticated Production smoke tests and the feature-specific real-world verification.

Rollback uses the recorded Git revision and the preceding known-good Vercel deployment. Database migrations must remain backward-compatible unless a separately approved migration plan says otherwise.

Local credentials, `.env` files, `supabase/.temp`, Gateway Keychain data and private diagnostic media are never part of a release snapshot.
