# DIGITAL OBSERVER CAPACITY QUALIFICATION

Preliminary run generated at `2026-09-11T20:31:20.410Z` on Node v24.16.0 / darwin arm64. Canonical machine output: `qa-evidence/push-38/preliminary-load-chaos.json`.

One worker processed 250.87 jobs/s; two 418.01; four 576.04; eight 643.39. Four-worker 100-camera batches showed queue-age p95 rising from 130 ms at the 25% profile to 698 ms at 100% and 1,518 ms under overload. The measured local bottleneck remains SQLite single-writer coordination plus per-claim accounting; the 4→8 gain is materially sublinear.

| Profile | Jobs | Workers | Throughput | Queue p95 / max | Loss / duplicates / dead letters |
|---|---:|---:|---:|---:|---:|
| 10 cameras | 200 | 2 | 448.23 jobs/s | 428 / 446 ms | 0 / 0 / 0 |
| 100 cameras | 1,000 | 4 | 495.58 jobs/s | 1,977 / 2,027 ms | 0 / 0 / 0 |
| 1,000 cameras | 4,000 | 8 | 296.68 jobs/s | 13,239 / 13,535 ms | 0 / 0 / 0 |

The 1,000-camera run admitted and completed all 4,000 jobs; it did not hide backlog by processing a sample. RSS grew by 88.281 MiB over that local process run. This is a bounded capacity observation, not a leak conclusion or a Production capacity claim. The real 24-hour process/resource trend is still running.
