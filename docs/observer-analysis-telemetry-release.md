# Source Analysis Telemetry Release

Status: prepared locally; not deployed or migrated. This is not product acceptance.

## Scope

- Base: deployed web revision `16ef30faee651c62dbaeead62499cf13b031e785`.
- Port: the cloud-learning route, dashboard/rules coverage UI, runtime loader,
  telemetry validation and migration from source revision `7b4d08f1`.
- The ten ported application/migration/QA files match that source byte-for-byte.
  The PostgreSQL test additionally uses a newer report timestamp so a rejection
  after a valid first update actually tests transaction rollback.
- No Gateway runtime, installer, scheduler, package, routing, provider, model,
  environment or credential changes are part of this release.

## Local Evidence

- Ten focused web checks pass: round authorization, per-source metrics, coverage,
  truthful status, chat actions, event evidence, site selection, site-preserving
  edits, biometric gates and privacy boundaries.
- The migration/RPC passes in-memory PostgreSQL tests for atomic rollback,
  one-time receipt consumption, source/site ownership, stale ordering, RLS,
  authenticated/anonymous privileges and source deletion cascade.
- The PostgreSQL tests use the previously verified temporary PGlite installation.
  No application dependency or production database is used.
- No private environment files are present in this release directory.
- Migration SHA-256:
  `0f21b5e7e9169779d896aed279e10878fb28b0a74f6d3b781bf08b1d0a27d4df`.
- The complete normal `npm run build` passes: Turbopack compilation, full
  TypeScript validation, all 481 pages and build-artifact cleanup. The build used
  a local, secret-free environment with no live activation. The final TypeScript
  stage took 19 minutes; earlier stopped runs are not counted as passes.
- An attempted Webpack fallback failed with `UnhandledSchemeError: node:crypto`
  through `video-gateway.ts` -> `camera-health.ts` -> the client component
  `camera-ai-admin-modules.tsx`. Those files are unchanged from the deployed base.
  No bundler/configuration workaround or unrelated refactor is in this release.

## Authorized Rollout Order

1. Obtain explicit approval for this scoped web release and migration
   `20260831020000_observer_source_analysis_telemetry.sql`. Reverify the current
   production revision and authenticated Supabase project before changing either.
2. Apply only this additive migration through the authenticated database workflow.
   Verify the table, service-role-only RPC and site/current-Gateway SELECT policy.
   Do not change camera ownership, source mapping, consent or existing event data.
3. Deploy the exact tested web revision; wait for READY and verify the production
   target, health, anonymous access denial and the signed-in coverage UI.
4. Keep analysis unavailable when no current authenticated report exists. Old
   Gateways may ignore the authorization receipt and do not become telemetry-ready.
   A completed round does not establish continuous analysis or semantic learning.
5. Separately approve and stage the local Gateway update. Verify Keychain-only
   configuration and health before any permitted camera processing. Confirm real
   per-source receipt outcomes, stale/failure states and isolation in the UI.

## Remaining Gates

- Chrome tab enumeration and claim work, but the read-only page inspection timed
  out after 20 seconds. A later reconnect also timed out before visual inspection.
  There is no new signed-in UI acceptance for this candidate or the coverage UI
  in its deployed base. Do not substitute health checks for that evidence.
- The UI is a server-rendered snapshot. Freshness is evaluated on page rendering,
  not by a live-push subscriber or continuous browser timer.
- A latest-state row is bounded per source; per-round webhook audit receipts still
  require a separately reviewed retention/cost policy and scale tests.
- PostgreSQL fixtures do not prove the production schema or multi-session races.
- A read-only local health check initially timed out after eight seconds. A
  subsequent direct HTTP check returned 200 in 325ms: ten registered streams,
  cached discovery five connected of sixteen, zero progressing/stalled relays
  and identity recognition false. This is not browser live evidence. No service
  restart, discovery, Keychain access or physical command was performed.
- Live processing, sustained live media, identity, physical controls and provider
  delivery remain under the broader acceptance ledger, not this web release.

## Recovery

If release verification fails, stop before the Gateway rollout. Preserve the
existing source/event data and report the failed check. Do not automatically drop
the additive table, change consent, remap sources or roll back a later deployment.
Any production rollback must select a verified revision and be separately approved.
