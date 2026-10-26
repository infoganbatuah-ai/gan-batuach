# PUSH 44 / PUSH 50 — local offline typecheck environment receipt

Date: 2026-10-26. Source branch:
`codex/event-ingest-replay-identity-20261025`, code/document baseline
`2c624dc9e781deb70ead5e2d9b76440a52ad8f5f`.

The sparse worktree had no `node_modules`. The canonical project's existing
shared `node_modules` lacked five declared `@capacitor/*` packages and held
`core`, `cli`, `ios` and `android` at 8.3.4, while the tracked lock requires
8.5.2 for those four. These are environment facts, not a source-code defect.

An ignored, worktree-local `node_modules` overlay now links existing shared
packages **without modifying their targets**. Its nine `@capacitor/*`
packages were extracted only from already cached exact-version tarballs after
each tarball's SHA-512 matched the tracked `package-lock.json` integrity and
its archive paths/types were checked. Installed package names and versions
were then compared with the lock. The five previously missing packages are
`app`, `device`, `network`, `preferences` and `push-notifications` at 8.0.0;
`core`, `cli`, `ios` and `android` are at 8.5.2. The shared project's original
packages, package manifests and lockfile were not changed. No npm lifecycle
scripts, registry fetch, package install, global configuration, provider or
database action occurred. The overlay is ignored by Git and not a release
artifact; it may need rebuilding after local cleanup.

After the exact-lock overlay was established:

- `npm run typecheck` — PASS, exit 0.
- `node scripts/qa/check-digital-observer-push44.mjs` — PASS, deterministic
  source/contract QA only.
- Nine local `@capacitor/*` package names/versions versus lockfile — PASS.
- `git status --short --branch` — clean branch; no tracked Product change.

This removes a local typecheck-environment blocker only. It does **not** prove
a clean-install CI run, native compilation or physical iPhone behavior; it
does not change `Native Access: BLOCKED`, `PUSH 44: PARTIAL`, media/APNs gates,
or any external activation status. A later exact-head CI run in a clean
environment remains separate proof.
