# DIGITAL OBSERVER — PUSH 31 DURABLE AI QUEUE REPORT

Date: 2026-09-10

## FINAL STATUS

`PASS`

PUSH 31 introduces one durable prioritized inference queue and one portable worker contract between PUSH 30 candidates and the existing Tracker/Observer. It does not begin Hybrid Routing (PUSH 32), horizontal Production scale, or a second Event pipeline.

## IMPLEMENTATION

- Versioned `observer-ai-job-v1`, `observer-inference-result-v1` and `observer-inference-worker-v1` contracts.
- SQLite WAL/FULL durable jobs, stable IDs/idempotency, claim lease, atomic result/ACK, bounded retry/backoff, expiry and dead letter.
- CRITICAL/HIGH/NORMAL/LOW/LEARNING priority with bounded aging.
- Tenant/Site and per-camera fairness; source-order protection without global serialization.
- Capability/model-class matching and authenticated, non-revoked tenant/Site worker scope.
- Explicit record/byte backpressure and PUSH 27-safe queue/worker metrics.
- Journal integration replaces its direct expensive-inference step with enqueue → eligible worker → consume-once result → the unchanged JournalTracker.
- Heavy AI learning jobs remain explicit; cheap `/activity` Site learning remains outside ONNX.

## FAULT / SECURITY QA

Deterministic QA passed: queue restart durability; worker death after claim and lease recovery by another worker; duplicate enqueue/result idempotency; priority; tenant/Site fairness; camera fairness; causal per-source ordering; bounded backpressure; retryable recovery; non-retryable/exhausted dead letter; expiry; forged worker-registration denial; wrong tenant/Site; unauthenticated/revoked boundary; unsupported capability/model class; secret-shaped payload rejection; and one-time downstream consumption.

Portable proof passed with the identical contract in `EDGE_LOCAL` and a separate `ISOLATED_PROCESS`. This is not a Cloud Production claim.

## REAL CAMERA JOB

Read-only isolated proof used the existing physical Tapo C211 through its Software Connector. Eleven real-home source identities (10 DVR + Tapo) emitted valid scoped jobs; six empty slots emitted zero. Only the Tapo CRITICAL QA job was executed to avoid live load:

`Tapo real source → durable job → eligible existing ONNX worker → result → canonical JournalTracker`

Final closure run: queue wait median/p95 5/5 ms; inference median/p95 807/807 ms; total 812 ms; n=1. A valid zero-detection result was returned and no Event was fabricated. Result consumption was one-time, DVR remained 10/10 progressing before and after, Tapo remained 1/1 progressing, and source configuration was unchanged. The sample is operational proof, not a representative latency distribution.

## QUALITY / EVENT BOUNDARY

Job/result detector confidence is not Risk, Verification or benchmark accuracy. Real-event creation still requires the canonical Tracker/Observer evidence rules. PUSH 28 quality contracts remain unchanged. The real read-only sample proved pipeline traversal but did not naturally produce an Event.

## REAL HOME

The test is read-only. Ten populated DVR sources and one Tapo are eligible; six `CHANNEL_EMPTY / UNASSIGNED` slots create zero jobs. A transient pre-warm health snapshot showed DVR relays recovering; bounded observation then showed 10/10 progressing and 0 stalled for four consecutive checks, and the final queue proof remained 10/10 before/after. Tapo remained 1/1 progressing and 0 stalled. Authorized Production UI showed 11 broadcasting sources; Tapo moving Live View advanced to camera time `04:46:06`, and DVR channel 1 advanced from grid time `04:46:32` to detail time `04:46:36`. No mock/manual stream was used. No Site, device or Camera Source is created.

## REGRESSION

PUSH 29 preprocessing historical QA was updated to assert the new correct boundary—cheap `/activity` before durable AI-job scheduling—rather than relying on the obsolete source order of a direct `/detections` call. Canonical domain/security/quality/build/Product and live-home gates are recorded after final execution. The separate deferred PUSH 25 billing RLS finding remains open and unchanged.

## NORTH-STAR

`Queues` and `AI job queue` move from NOT STARTED to IMPLEMENTED — NEEDS REAL PROOF. Real multi-worker deployment, horizontal throughput/failover and representative long-duration load remain PUSH 32/36/38 obligations. The matrix remains 190 rows with zero unowned capabilities.

## CANONICAL STATUS

PUSH 31: `DONE` after completion gates.
PUSH 32: `NOT STARTED`.
