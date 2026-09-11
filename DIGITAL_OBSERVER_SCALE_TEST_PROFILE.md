# DIGITAL OBSERVER — SCALE TEST PROFILE

Date: 2026-09-11

## Identical-workload benchmark

The deterministic workload is 120 independent CPU-bound `OBJECT_DETECTION` jobs across two tenants, five Sites and twenty cameras. It contains no camera media and never touches Production streams. Throughput uses productive per-worker CPU makespan so host timer coalescing/suspension cannot inflate the comparison; observed end-to-end wall time is retained separately.

| Workers | Jobs | observed wall | productive CPU makespan | Throughput | Queue wait median / p95 / max |
|---:|---:|---:|---:|---:|---:|
| 1 | 120 | 1,870 ms | 1,240.455 ms | 96.74 jobs/s | 629 / 1,179 / 1,237 ms |
| 4 | 120 | 1,050 ms | 388.299 ms | 309.04 jobs/s | 257 / 408 / 426 ms |

Throughput gain is 3.19×; four-worker scaling efficiency is 79.9%. The current bottleneck is SQLite single-writer claim/accounting serialization plus per-process queue coordination. This is local evidence, not Production capacity.

## Concurrent-process fault profile

Four independent Node processes completed 120 mixed-priority/mixed-tenant/mixed-camera jobs. Results: 120 completed, zero failed, zero dead-letter, zero duplicate accepted effects. A separately abandoned lease was recovered by another worker after expiry and consumed once.

## Camera-count profiles

Each synthetic active camera emits two independent jobs. Empty slots emit zero. The test fully generates each backlog and processes a bounded sample to validate concurrent claim behavior without pretending to execute 1,000 live streams.

| Cameras | Jobs generated | Tenants / Sites | Processed sample | Remaining backlog | sampled queue age median / p95 / max |
|---:|---:|---:|---:|---:|---:|
| 10 | 20 | 2 / 2 | 20 | 0 | 21 / 37 / 38 ms |
| 100 | 200 | 2 / 5 | 20 | 180 | 26 / 48 / 50 ms |
| 1,000 | 2,000 | 10 / 50 | 24 | 1,976 | 72 / 103 / 105 ms |

These are synthetic queue workloads, not 10/100/1,000-camera Production proof.
