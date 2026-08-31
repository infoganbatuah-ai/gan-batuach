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

Approval was relayed for the exact SQL digest above. It has not yet been applied. The existing browser tab identifies the Supabase project as `gan-batuah`, ref `kuaywzvucllxjsxarogb`; reading the actual SQL Editor and verifying the live schema remain incomplete because taking control of that tab timed out twice. Browser/extension/native-host diagnostics passed. Recovery requires the requested browser-window approval; no credentials were extracted and no SQL was submitted.

The earlier remote push was denied by the approval reviewer. Explicit confirmation of the exact repository destination was requested; this restriction is not bypassed by another task or deployment mechanism. There is no corrected production deployment or live Gateway round-trip evidence yet.

The focused correction consists of the Gateway queue route, shared queue contract, this migration, schema/result safety tests, their test-only TypeScript loader, and this review. It does not deploy the dirty workspace, install a Gateway executor, enable physical actions, or complete the dashboard/Guard integration. After the approved migration and focused release, the next acceptance gate is a live `capability_snapshot` and `command_preflight` round trip with `executor_installed:false` and `executed:false`.

Reproduction (test runtimes are installed separately from application dependencies):

```sh
CAMERA_QUEUE_PGLITE_MODULE=/absolute/path/to/@electric-sql/pglite/dist/index.js \
CAMERA_QUEUE_PREFLIGHT_DRIVER_MODULE=/absolute/path/to/private-nvr-command-preflight.mjs \
node --test scripts/qa/camera-queue-schema.test.mjs
```

Test runtime: PGlite 0.5.8. A missing runtime/driver is a test error, never a skipped success. The production target, current schema and existing migration history still require a read-only pre-apply inspection. The SQL must continue to match the approved digest; any SQL modification requires renewed review. These local tests do not certify live camera capabilities or physical execution.
