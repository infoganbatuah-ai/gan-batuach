# DIGITAL OBSERVER — PUSH 21 OFFLINE RESYNC REPORT

## FINAL STATUS

`PASS`

## Existing durability audit

The existing Journal used SQLite WAL, stable Event IDs, `INSERT OR IGNORE`, per-camera delivery lanes, exponential retry and cloud Event/Incident/Evidence idempotency. It already continued local sampling while cloud requests were slow. Missing pieces were encrypted typed records, immutable tenant/Site/device scope, durable evidence/media work, explicit schema compatibility, pressure/retention behavior, rebind/revocation boundaries and a first-class backfill contract.

## Canonical implementation

`observer-offline-buffer-v1` now backs the Journal and supports Event, Incident input, Evidence metadata/media and operational-state records. SQLite uses WAL plus `synchronous=FULL`; encrypted AES-256-GCM payloads are deleted only after explicit acknowledgement. Stable IDs provide at-least-once transport with idempotent Product effect. Interrupted `DELIVERING` rows return to `PENDING` on restart/update/rollback.

Queue scope is immutable tenant + Site + managed device. Rebind with backlog fails closed; revocation blocks resync. Secret-bearing payload fields are rejected. Version 1 remains readable across compatible runtime update/rollback.

## Ordering and resync

Only the oldest pending item for a Site/source/track ordering key is eligible; unrelated cameras may use separate bounded lanes. Automatic resync uses bounded batches, exponential retry, explicit ACK and queue-depth/byte/age/failure/pressure metrics. Ambiguous acknowledgement retries the same stable ID.

## Evidence/media

Evidence metadata/media are typed encrypted queue records with `PENDING_UPLOAD` until confirmed persistence. QA proves media work survives restart and is not acknowledged as available before cloud ACK. Existing cloud Evidence upsert and Event identity prevent duplicate Product evidence. Continuous raw frames are not buffered.

## Backfill safety

Original observation time, queue time, delivery delay and cloud ingestion time are separate. Delays over 60 seconds are `BACKFILL_RESYNC`, retain real-camera provenance, and persist/correlate at original time. Historical backfill does not automatically trigger fresh external notification or Digital Guard camera action.

## Storage policy

Defaults are 10,000 records, 512 MiB encrypted payloads, seven-day retention, bounded batches and 5-second-to-5-minute retry. Pressure is reported at 80% and at limit. Retention expiry and rejected optional input are audited; critical capacity exhaustion becomes explicit and is never silently discarded.

## Fault injection

Isolated QA passed cloud-loss queue growth, process restart, automatic cloud-return resync, duplicate delivery, ambiguous ACK, causal entry/exit ordering, evidence/media pending-to-available semantics, disk pressure, cross-tenant/rebind denial, revoked-device denial, encrypted-at-rest secret rejection and compatible update/rollback reopen. Event outbox, slow-cloud polling, Event ingestion, Incident idempotency and Evidence media regression pass.

## Real reference and home regression

No natural qualifying `REAL_CAMERA_AI` Event occurred during a safely controlled cloud-delivery interruption, so real camera offline/resync proof is `NOT VERIFIED`; no mock/manual Event was substituted.

A read-only 60.131-second home observation produced 7/7 successful samples: DVR remained 10/10 progressing, six slots stayed empty/unassigned, Tapo remained 1/1 progressing, maximum stalled streams was 0 and endpoint errors were 0. Tapo playback-ready claims advanced 121 → 123. Existing authorized Product playback proof remains the latest visual UI evidence. No Site/device/source duplicate was introduced.

## Boundaries

Zero-install remains unchanged; the queue applies only to managed local components. PUSH 20 supervises the queue worker. PUSH 19 owns update rollback. Full Fleet Management was not implemented. The deferred PUSH 25 billing RLS finding remains open.

## Security and regression

Final gates passed: production typecheck, canonical lint with zero new regressions, production build, 21/21 domain QA, 10/10 security QA, 21 observability checks, migration safety, release-contract validation, PUSH 18 managed-device identity, PUSH 19 OTA/rollback, PUSH 20 supervision, Event/Incident/Evidence idempotency, and the focused offline/resync fault matrix. The first sandboxed production-build attempt was blocked from binding a local build port; the identical approved build completed successfully. No authentication, tenant-isolation, Zero-Install, OTA, or watchdog boundary was weakened.

## North-Star

190 capabilities and zero without owner remain. Counts: 24 DONE + REAL PROOF, 19 IMPLEMENTED — NEEDS REAL PROOF, 69 FOUNDATION, 17 PARTIAL, 60 NOT STARTED, 1 EXTERNAL COVERAGE GAP. Offline buffering and resync advanced only to implemented-needs-real-proof because natural real Event resync remains unproven.

## Canonical status

Canonical PUSH 21: `DONE`. PUSH 22 readiness: `YES`; PUSH 22 was not started.

## Git completion

PUSH 21 files are isolated from the pre-existing PUSH 25/27 and Live View worktree changes. Final commit and push identifiers are recorded in the completion response.
