# Production release process

Production deployments must originate from a clean, committed Git snapshot. The commit is the release manifest and rollback target; a dirty working tree is never a deployable release.

Required gates:

1. Review the complete staged file list and scan it for credentials or private camera artifacts.
2. Run the focused feature QA, cross-layer regressions, typecheck, lint and full production build.
3. Commit the complete intended release on a `codex/` release branch.
4. Run `npm run release:production:preflight`. It fails if the Vercel project binding is wrong, the worktree is dirty, the revision is not recorded, or forbidden local artifacts are tracked.
5. Apply database migrations separately and with an isolated dry run when the repository migration history differs from Production.
6. Deploy the exact clean revision and record its Vercel deployment ID and Production alias in the phase report.
7. Run authenticated Production smoke tests and the feature-specific real-world verification.

Rollback uses the recorded Git revision and the preceding known-good Vercel deployment. Database migrations must remain backward-compatible unless a separately approved migration plan says otherwise.

Local credentials, `.env` files, `supabase/.temp`, Gateway Keychain data and private diagnostic media are never part of a release snapshot.
