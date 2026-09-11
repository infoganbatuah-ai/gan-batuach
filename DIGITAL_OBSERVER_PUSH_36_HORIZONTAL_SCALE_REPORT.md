# DIGITAL OBSERVER — PUSH 36 HORIZONTAL SCALE REPORT

Date: 2026-09-11

## FINAL STATUS

`PASS ON VERIFIED PR MERGE`

PUSH 36 extends the PUSH 31 queue and worker contracts; it does not create a second inference/Event pipeline and does not begin PUSH 37 HA.

## IMPLEMENTATION

- Added `observer-ai-queue-backend-v1` and an explicit SQLite WAL single-host evidence boundary.
- Added `observer-inference-worker-pool-v1` for authenticated runtime addition/removal and concurrent draining without camera rewiring.
- Added batch admission, five-second SQLite contention handling, indexed source ordering and queue wait median/p95/max by priority.
- Preserved job/result contracts, lease ownership, retries, dead letter, expiry, priority aging, tenant/Site/source fairness, routing provenance and one-time downstream consumption.
- Exported truthful Postgres distributed-claim semantics without claiming an unimplemented managed backend.

## MULTI-WORKER / SCALE EVIDENCE

Identical 120-job CPU workload: one worker 96.74 jobs/s (1,240.455 ms productive CPU makespan); four workers 309.04 jobs/s (388.299 ms makespan). Gain 3.19×, efficiency 79.9%. Queue wait changed from 629/1,179/1,237 ms to 257/408/426 ms median/p95/max. Observed end-to-end wall was 1,870 ms vs 1,050 ms; productive CPU makespan is the scale denominator so host timer suspension cannot inflate it.

Four independent processes completed 120 mixed jobs with zero loss, failures or duplicate accepted effects. Worker-loss lease recovery returned one result and one downstream consume. Synthetic camera profiles generated 20/200/2,000 jobs for 10/100/1,000 cameras; the 1,000-camera profile is queue-contract QA, not Production stream proof.

The measured bottleneck is SQLite single-writer claim/accounting serialization. It is suitable for local multi-process scale, not multi-host Production. The canonical backend boundary permits a future server queue without changing jobs/workers.

## SAFETY / INTEGRATION

Tenant and camera fairness, priority/aging, backpressure, capability matching, expiry, dead letter, queue restart and idempotency remain covered by PUSH 31 plus PUSH 36 concurrent QA. Six empty DVR slots generate zero jobs. PUSH 32 routing, PUSH 33 cost hooks, PUSH 23 health and PUSH 27 telemetry are reused.

## REAL HOME

Read-only proof routed one current physical Tapo C211 sample through a two-member horizontal pool; only `real-tapo-horizontal-a` accepted it and one result was consumable. Queue wait was 1 ms, inference 661 ms, model `ssd_mobilenet_v1_10`, and zero detections produced no fabricated Event. DVR remained 10/10 progressing before/after with zero stalled; Tapo remained 1/1 with zero stalled; six empty slots emitted zero jobs. The test changed no source configuration. Playback code was untouched and canonical authorization/Live View regressions pass; Product video was not visually reopened during this PUSH.

## EVIDENCE CLASSIFICATION

Achieved: `LOCAL_MULTI_WORKER_PROOF`, `LOCAL_MULTI_PROCESS_PROOF`, `SYNTHETIC_SCALE_TEST`. Not claimed: `MULTI_HOST_PROOF`, `PRODUCTION_SCALE_PROOF`, HA or sustained 1,000-camera operation.

## CANONICAL STATUS

PUSH 36 becomes `DONE` only after required checks pass, the scoped PR merges, and `origin/main` is verified. PUSH 37 remains not started.
