# Camera queue migration review — before production apply

This corrects `e7b24b2`. The migration has **not** been applied to Supabase; no deployment, Gateway runtime installation or physical action is part of this review.

Reviewed SQL SHA-256: `f91ca4f57f35d3796f0e7293d01efa759c9fc268b544e231c3ae633f7cafe64d`.

Local verification: 10/10 PostgreSQL/schema/driver integration tests and 61/61 Guard/Gateway/garden/result regression tests passed (exit 0). Targeted TypeScript checking of the queue route and shared contract passed (exit 0), as did targeted ESLint and `git diff --check`. Full-project typechecking did not complete during this verification run; it is not reported as passed. No production build or live-hardware verification was performed for this correction.

## Exact database changes

Target: `public.digital_observer_camera_action_requests`. The base table is created only if absent. Existing installations are upgraded using `ADD COLUMN IF NOT EXISTS`, not merely `CREATE TABLE IF NOT EXISTS`.

| Added column | Type | Default / requirement |
| --- | --- | --- |
| `task_kind` | text, not null | `legacy_command`; new diagnostics use `capability_snapshot` or `command_preflight` |
| `gateway_id` | text | Null for legacy rows; required for diagnostics |
| `stream_id` | text | Null for legacy rows; required, bounded identifier for diagnostics |
| `channel` | integer | Null for legacy rows; 1–64 for diagnostics |
| `requested_at` | timestamptz | Null for legacy rows; required for diagnostics |
| `payload_digest` | text | Null for snapshots; 64 lowercase hexadecimal characters for preflight |
| `result_digest` | text | SHA-256 of the canonical validated result; required for completed diagnostics |

The existing foreign keys are preserved: wire `camera_id` means `camera_source_id` (a Digital Observer source UUID), and wire `site_id` means `observer_site_id`. No redundant `camera_id` or `site_id` columns are added.

Named checks for action type, origin, status, evidence and confirmation are replaced with task-aware checks. Legacy action types, evidence and human-confirmation requirements remain. New diagnostic requests do not manufacture human approval or require prior positive capability evidence just to discover capabilities.

Additional checks enforce task kind, exact non-null binding fields, a maximum two-minute lifetime, digest-only preflight parameters, no `succeeded` status for diagnostics, and a typed completed result. A completed diagnostic must contain matching source/site/stream/channel, literal JSON `executor_installed:false` and `executed:false`, a result digest and completion/delivery timestamps. A preflight also requires its matching action, `ack_kind:preflight_only`, and `requires_immediate_confirmation:true`.

The added function/trigger `public.guard_camera_diagnostic_queue` prevents request kind/binding/action/digest/expiry changes, invalid state transitions and terminal-result replacement. It checks the source/site/Gateway/stream/channel binding on insertion and again on delivery/completion. No legacy row is reclassified or auto-approved.

The partial index `camera_queue_gateway_delivery_idx` covers `(gateway_id, observer_site_id, created_at, id)` for approved diagnostic requests. The API filters by Gateway, site and task kind **before** `LIMIT`; it does not scan a shared queue and then filter other Gateways in application code.

RLS remains enabled. The scoped read policy uses the existing `public.can_manage_observer_site(observer_site_id)` function. `anon` has no table access; `authenticated` has scoped SELECT only; `service_role` writes after server authorization. No camera-source metadata, credentials, profile, enrollment or DVR settings are rewritten by the migration.

## API contract

`POST /api/video-gateway/camera-actions` retains the enrolled-device authentication and the existing `poll` / `result` actions. The request stored in the database supplies every envelope field; the API never hardcodes a preflight kind for an unrelated legacy request. Only snapshot and preflight tasks are polled.

Polling returns exactly `id`, `task_kind`, `camera_id`, `site_id`, `stream_id`, `channel`, `requested_at`, `expires_at`, plus `action` and `payload_digest` for preflight. It returns no camera credentials, arbitrary parameters, confirmation, or raw metadata.

Results are validated against the stored task, current source binding, timestamps and evidence. `outcome:succeeded` is always rejected on this read-only endpoint, even when a Gateway claims an executor exists. Legacy workers may still report failure for their own delivered legacy requests. Identical completed-result retries are acknowledged without another write; conflicting retries are rejected. Database failures return 503 rather than an empty queue or `recorded:true`.

## Verification procedure

`scripts/qa/camera-queue-schema.test.mjs` executes the actual migration against isolated PostgreSQL using PGlite, including an upgrade from the pre-extension table and a second application of the corrected migration. The HTTP tests execute the real route and Supabase PostgREST query builder against that database, substituting only network transport and device authentication. The Gateway compatibility test loads the actual read-only driver, with synthetic source/probe inputs and no physical-command transport.

The tests check column/constraint presence, legacy-row preservation, RLS, null/invalid bindings, TTL and action payloads, physical-success rejection at SQL and HTTP boundaries, result immutability/replay, DB errors, concurrent claiming, source reassignment, and 150 earlier foreign-Gateway jobs.

## Production handoff status — 2026-08-31

Approval was relayed for the exact SQL digest above. At this earlier handoff checkpoint it had not yet been applied. After the user reinstalled the Browser plugin, the actual Supabase page was read and confirmed `gan-batuah`, ref `kuaywzvucllxjsxarogb`, `main Production`. A fresh tab resolved the old-tab issue enough to enter the separate read-only schema query. Input dispatch still timed out even when the editor was uniquely located, visible and enabled. The prepared query was retained at `https://supabase.com/dashboard/project/kuaywzvucllxjsxarogb/sql/2f8c32f7-01a7-463f-ba81-3248c1ba0e0f`; the user was asked to run only that read-only preflight. No migration had been submitted at that checkpoint and no camera command was sent.

An independent live, read-only check used the existing server configuration without printing its credential: the queue table returned HTTP 200 with exact count 0; a HEAD selecting the seven diagnostic columns returned HTTP 400. Thus the base table is reachable but the diagnostic column set is not yet available. Constraint/function verification still needs the SQL preflight result. The local preflight SQL was validated against isolated PostgreSQL (four metadata result sections; no user/device records).

Local machine load averages exceeded 250 during the browser failures. This is a possible contributor, not a proven sole cause. The full staged TypeScript check was interrupted (exit 130) to reduce load, and is explicitly not counted as passed. Other tasks were asked not to start more heavy test runs; the camera runtime was not stopped.

The user explicitly confirmed ownership of `https://github.com/infoganbatuah-ai/gan-batuach.git` and approved the focused code push after the earlier reviewer denial. The push succeeded from `f23c717` to `e3f6fb6` on `codex/ci-typecheck-deployment-repair-20260831`, containing only eight camera-queue code/migration/test/review files. `main` and unrelated workspace files were not changed. GitHub reports an automatic Vercel check as pending; this is not evidence of a ready production deployment. No GitHub Actions runs were returned for this branch push (the checked workflows run on PRs or main/master). There is no live Gateway round-trip evidence yet.

The focused correction consists of the Gateway queue route, shared queue contract, this migration, schema/result safety tests, their test-only TypeScript loader, and this review. It does not deploy the dirty workspace, install a Gateway executor, enable physical actions, or complete the dashboard/Guard integration. After the approved migration and focused release, the next acceptance gate is a live `capability_snapshot` and `command_preflight` round trip with `executor_installed:false` and `executed:false`.

The preview's Vercel status subsequently became `success`. It has not been promoted: its Git baseline must not replace newer production UI/journal fixes. `scripts/qa/stage-camera-queue-release.mjs` instead verified all 1,181 source hashes in the current-production attestation for `dpl_8DeajRc6Y7RojyVwLUK5xhQu48bZ` (manifest SHA-256 `668ebaa20391975d098ee09574cced7466673d3a586a0276d9659a030c91f5d9`) and created `/private/tmp/camera-queue-release.TMWpRw` with only the Gateway route and shared queue contract overlaid. The attested baseline remained unchanged. A separate diagnostics consumer/UI candidate is owned by the Guard task and still needs its own final staged tests; it is not implicitly included in this queue release.

Recovery heartbeat at 2026-08-31 19:24 UTC: the official Vercel CLI, using its existing login and no token argument, independently resolved `ganbatuach.com` to that same deployment in `READY` / `production`. The diagnostics candidate's 1,191 hashes still match its manifest (`d3aff57d6a1068b1b9c5592508c764114bfc00845d15015cb4125777b67ee9e1`), with `stage_tests_passed:false` and `deployed:false`. Load remained extreme (213.82 / 231.53 / 258.10), and the read-only browser check timed out; no SQL, DDL, deployment, heavy build or hardware action was performed. The existing ten-minute heartbeat remains active; current coordination holds DDL while the user is away and the interface recovers.

At 19:38 UTC, live read-only checks still returned queue HTTP 200/count 0 and diagnostic-column HTTP 400. Load was 183.80 / 215.89 / 235.60. Chrome was running and the official checks confirmed the extension installed/enabled in Profile 2 and a valid native-host manifest, but browser discovery exposed only the in-app browser: the Chrome control connection was unavailable. No alternate browser, new login, credential extraction, repair, DDL or heavy test run was attempted. This is a disconnected control channel, not evidence of a missing extension or failed Supabase server authentication.

At 21:02 UTC (September 1, 00:02 local), a read-only diagnostic-column SELECT with `limit(0)` returned HTTP 400 and PostgreSQL error `42703` (`undefined_column`). No row data or raw error text was printed. This confirms the cloud readiness failure is a missing column, rather than an authentication failure. No migration, deployment or physical command was performed. Load remained 182.86 / 193.74 / 196.82. The separate diagnostics stage's latest 26 integration/client tests passed; its documented priority-setting failure and remaining release gates are tracked in `DIGITAL_GUARD_DIAGNOSTICS_RELEASE.md`.

At 21:14 UTC (September 1, 00:14 local), Chrome control recovered and the prepared read-only metadata query was run once in the verified Supabase production project. It returned four metadata rows: the queue, sources, sites, profiles and `can_manage_observer_site(uuid)` function exist; `to_regclass('supabase_migrations.schema_migrations')` returned null. The queue still has only its 18 pre-extension columns, its pre-extension physical-action constraints, and one scoped SELECT RLS policy. The seven diagnostic columns are absent, consistent with the earlier `42703`. The SQL tab was preserved with the results. No DDL, row-data query, deployment or physical command was performed.

At 21:26 UTC, the approved production migration (SHA-256 `f91ca4f57f35d3796f0e7293d01efa759c9fc268b544e231c3ae633f7cafe64d`) was applied in the verified project. The first transactional attempt was fully rolled back after PostgreSQL `40P01` deadlock. A zero-row, read-only lock inspection then showed no remaining locks on either reported relation, and a direct zero-row schema probe confirmed rollback with `42703`. One coordinated retry of the identical transaction completed successfully. Post-apply verification returned all seven diagnostic columns, the diagnostic task/binding/TTL/payload/result/no-physical-success constraints, and exactly the scoped SELECT RLS policy using `can_manage_observer_site(observer_site_id)`. PostgREST accepted the diagnostic-column projection without an error. Existing legacy rows were preserved. No deployment or physical command was performed.

Reproduction (test runtimes are installed separately from application dependencies):

```sh
CAMERA_QUEUE_PGLITE_MODULE=/absolute/path/to/@electric-sql/pglite/dist/index.js \
CAMERA_QUEUE_PREFLIGHT_DRIVER_MODULE=/absolute/path/to/private-nvr-command-preflight.mjs \
node --test scripts/qa/camera-queue-schema.test.mjs
```

Test runtime: PGlite 0.5.8. A missing runtime/driver is a test error, never a skipped success. The production target, current schema and existing migration history still require a read-only pre-apply inspection. The SQL must continue to match the approved digest; any SQL modification requires renewed review. These local tests do not certify live camera capabilities or physical execution.
