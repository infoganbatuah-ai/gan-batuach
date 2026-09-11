# DIGITAL OBSERVER — QUEUE BACKEND CONTRACT

Contract: `observer-ai-queue-backend-v1`

Required operations are enqueue, claim/lease, acknowledge, fail/retry, result, recovery, metrics and close. Backends must preserve `observer-ai-job-v1`; backend choice cannot change Observer/Event semantics.

## Implemented backend

`SQLITE_WAL_LOCAL_MULTI_PROCESS` uses WAL, FULL synchronous durability, a five-second busy timeout, atomic conditional claims, lease expiry, unique idempotency/result keys, retry/dead-letter, bounded admission and indexed source ordering. It is appropriate for a managed component or a single server host with multiple processes. It is not advertised as multi-host.

## Distributed backend boundary

A future Postgres/server implementation must use transactional `FOR UPDATE SKIP LOCKED` (or an equivalent maintained queue primitive), server-time leases, atomic completion/result uniqueness and durable fairness cursors. The exported contract marks this `CONTRACT_ONLY_NOT_PRODUCTION_VERIFIED`; no Cloud queue proof is claimed.

## Safety invariants

- one active lease per job;
- ACK only by the authenticated lease owner;
- expired lease is reclaimable;
- accepted result is unique by job;
- expired realtime jobs cannot become fresh Events;
- tenant/Site authorization precedes work;
- queue depth/age/backpressure remain observable;
- process-local locking is never the sole ownership control.
