# DIGITAL OBSERVER — AI QUEUE ARCHITECTURE

Date: 2026-09-10

## Canonical path

`PUSH 29 preprocessing → PUSH 30 scheduler/candidate-v2 → observer-ai-job-v1 → durable AI queue → eligible portable worker → observer-inference-result-v1 → existing Tracking/Observer → canonical Event`

The Journal no longer invokes expensive inference as an untracked camera-loop side effect. It durably inserts a job, an authenticated eligible worker leases it, and the one-time result returns to the existing Tracker. The Event outbox remains PUSH 21 and is not reused as an inference queue.

## Durability and delivery

SQLite WAL with FULL synchronous writes supplies restart durability on managed local components. Jobs use `PENDING → CLAIMED → COMPLETED`, with `RETRY_WAIT`, `EXPIRED` and `DEAD_LETTER` terminal handling. A bounded visibility lease returns abandoned work after worker death. ACK and result insertion are atomic; stable idempotency prevents duplicate processing effects.

PUSH 32 may request a claim for one routed job and may release a retryable failed lease for another eligible target. This does not create another queue: attempts remain bounded by the original job retry policy, expiry remains authoritative and result uniqueness remains unchanged.

Per-source ordering blocks a later observation while an earlier job for the same ordering key is pending or leased. Unrelated cameras remain concurrent-ready. Priority plus bounded aging protects critical work without permanent low-priority starvation. Hierarchical served counters provide tenant/Site and camera fairness.

## Backpressure and failure

Record and byte limits reject excess admission explicitly rather than growing memory. Retries distinguish retryable runtime failures from malformed/unauthorized work and use bounded exponential delay. Exhausted or non-retryable work is retained in dead-letter state with normalized diagnostics. No raw frame or secret is emitted to audit/telemetry.

## Observability

The existing PUSH 27 status report receives queue depth, oldest age, state counts, priority backlog, throughput, leases, retries and dead-letter count, plus worker busy state, processed/failure counts and inference timing. Queue wait and inference duration are recorded per result. PUSH 33 may consume accounting; PUSH 36 owns production horizontal-scale proof.

## Safety boundaries

- Empty/unassigned DVR channels never reach scheduler/job creation.
- Cheap Site-learning activity remains outside heavy ONNX unless a job explicitly requests it.
- Revoked or wrong-scope workers cannot claim or ACK.
- A worker cannot gain access or capability by self-declared Product strings. In-process admission requires a trusted, non-serializable runtime capability before the registered allow-list is evaluated; PUSH 18 Ed25519 identity remains the external managed-component boundary.
- No Hybrid AI routing or cloud provider selection is implemented; that remains PUSH 32.
