# Digital Observer Offline Buffer Architecture

## Existing durability audit

PUSH 21 extends the existing SQLite Journal/outbox. The prior system already provided WAL restart persistence, stable Event IDs, `INSERT OR IGNORE`, per-camera concurrent delivery, exponential retry, server-side Event idempotency, Incident correlation and evidence upsert. Gaps were explicit tenant/Site/device binding per queue, encrypted payloads, durable media work, schema/version metadata, disk policy, rebind/revocation handling and live-versus-backfill semantics.

## Canonical contract

`observer-offline-buffer-v1` is the single local store-and-forward contract for managed Connector, Gateway and future Enterprise Edge profiles. The Journal now writes Events and operational state through this queue; evidence metadata/media work uses the same typed record model. True zero-install integrations are outside this managed-edge queue.

Every record has a stable ID, kind, schema version, tenant, Site, device, source, ordering key, original observation time, queue time, priority, state, attempts and encrypted payload size. Supported kinds are `EVENT`, `INCIDENT_INPUT`, `EVIDENCE_METADATA`, `EVIDENCE_MEDIA`, and `OPERATIONAL_STATE`. Raw frames are never buffered indiscriminately.

## Security and persistence

Payloads are encrypted at rest with AES-256-GCM using a device-local protected secret-derived key. Password, token, private-key, credential and private-stream fields are rejected before persistence. SQLite uses WAL and `synchronous=FULL`; the database file is restricted to the local account. PUSH 18 authentication is still required for delivery.

Tenant/Site/device scope is immutable. A rebind with pending records fails closed pending explicit export/discard/authorized lifecycle handling. Revocation blocks resync. Compatible update/rollback reopens schema v1 and resets interrupted `DELIVERING` rows to `PENDING` without changing identifiers.

## Delivery

Transport is at-least-once; Product effect is idempotent. Rows are deleted only after explicit cloud acknowledgement. Missing/ambiguous acknowledgement becomes a bounded retry. Batches are bounded; unrelated ordering keys may progress concurrently while source/track ordering remains causal.

Original `timestamp`, `queued_at`, delivery delay and cloud ingestion time remain distinct. Delayed records carry `BACKFILL_RESYNC` without changing `REAL_CAMERA_AI` provenance. Cloud persistence/correlation remains valid, while fresh emergency notifications and autonomous camera actions are suppressed for historical backfill.

## Boundaries

PUSH 21 does not provide full Fleet Management, broad disaster recovery, indefinite local autonomy or raw-video archival. PUSH 20 supervises the queue worker without restarting the entire component for one delivery failure. PUSH 19 preserves the database across compatible update/rollback. Final fleet presentation belongs to PUSH 22.
