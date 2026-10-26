# PUSH 44 / PUSH 50 — isolated local web build receipt

Date: 2026-10-26 02:04 UTC. Source branch:
`codex/event-ingest-replay-identity-20261025`, source HEAD
`07c64662ec81d88c484f36ee96ac1a6f4c594b02`.

The environment-safety preflight passed in `demo` mode with live activation
disabled. The build used a cleared process environment containing only `PATH`,
`APP_ENV=demo`, `NEXT_PUBLIC_APP_ENV=demo`,
`NEXT_PUBLIC_SANDBOX_MODE=true`, and `NEXT_TELEMETRY_DISABLED=1`. No real
application `.env` file existed in this worktree. No database, provider, server,
deployment, camera, or external activation was intentionally invoked.

The canonical `npm run build` Turbopack path **did not pass** in this sparse
worktree: initially the shared Next installation did not match the lockfile;
after exact-lock local Next/SWC restoration, Turbopack rejected dependency
symlinks outside its project root and its loader could not bind a local helper
port under the sandbox. These are local build-environment constraints, not a
passing canonical build result.

For a supported isolated qualification, the installed Next.js 16.4.1
documentation explicitly permits `next build --webpack`. The required
`@aws-sdk/*`, `@smithy/*`, `@aws/lambda-invoke-store`, and `bowser` packages were
restored only into this worktree's ignored `node_modules` from existing npm
cache tarballs. Every tarball's SHA-512 was checked against the tracked
`package-lock.json`, its archive entries were checked for unsafe paths/types,
and the extracted package version was compared with the lock. The shared
project's installation, manifests, and lockfile were unchanged. The overlay is
not a reproducible clean installation or a release artifact.

`next build --webpack` under the cleared demo environment — **PASS**, exit 0.
The production-mode bundle compiled, TypeScript completed, page data and
static pages were generated, and the route inventory was emitted. The command
was local only; it did not start an application server or deploy anything.

This receipt proves a local Webpack build at the stated source HEAD only. It
does **not** prove that the canonical Turbopack npm script, clean-install CI,
native iOS build, physical iPhone, media, database integration, or Production
passes. `Native Access: BLOCKED`, `PUSH 44: PARTIAL`, `Guard: OFF`, and
`PUSH 46: NOT STARTED` are unchanged.
