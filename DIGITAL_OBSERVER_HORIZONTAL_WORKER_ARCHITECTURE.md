# DIGITAL OBSERVER — HORIZONTAL WORKER ARCHITECTURE

Date: 2026-09-11

## Canonical path

`observer-ai-job-v1 → observer-ai-queue-backend-v1 → priority/fairness/lease → N observer-inference-worker-v1 → observer-inference-result-v1 → canonical Observer`

Workers are stateless with respect to Product truth. Their mutable state is bounded to model/runtime cache, temporary input and the current lease. Camera, tenant, Event and Incident truth remains outside the worker.

## Scale and ownership

- Any authenticated eligible worker may claim a job; the atomic state transition permits one active lease.
- Adding/removing a worker does not change camera bindings or the AI job contract.
- Job ID, idempotency key and the unique accepted result preserve one downstream Product effect across retries and lease recovery.
- Per-source ordering blocks a later observation only behind earlier unfinished work for the same ordering key. Unrelated sources run in parallel.
- CRITICAL/HIGH/NORMAL/LOW/LEARNING priority, bounded aging and tenant/Site/source service cursors preserve urgency without making FIFO a global lock.
- Worker health/capability remains separate from camera health and is reused by the PUSH 32 router.

## Evidence boundary

PUSH 36 proves local concurrent workers and four independent Node processes sharing one SQLite WAL queue. SQLite is explicitly a single-host backend. Multi-host Postgres claim semantics are specified, but no managed distributed queue or multi-host Production deployment is claimed. HA remains PUSH 37; sustained qualification remains PUSH 38.
