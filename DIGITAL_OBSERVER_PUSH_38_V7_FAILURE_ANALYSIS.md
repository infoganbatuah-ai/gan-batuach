# PUSH 38 v7 failure analysis

Status: **FAILED; analysis incomplete where v7 instrumentation cannot identify a layer.** Source: `qa-evidence/push-38/v7-frozen-20260913/` (hash manifest). `failure-timeline.json` is the chronological, machine-readable record of **every failed/degraded checkpoint**, with component/relay/AI/resource snapshots and log byte offsets. It contains 140 records because overlapping failure dimensions are separate records for one checkpoint; it is not 140 independent failures.

## Time and coverage

Started 2026-09-11 21:08:41.574 UTC; ended 2026-09-12 21:08:41.678 UTC; elapsed **86,400,104 ms** (24h + 104 ms). At 60-second cadence, expected **1,440** checkpoints; recorded **1,418**, missing **22**. First/last samples: 21:08:41.614 and 21:08:03.922 UTC on consecutive days. Three gaps exceeded 150 seconds: sequence 28→29 **271,522 ms**, 75→76 **208,424 ms**, 76→77 **223,558 ms**. The remaining deficit is cumulative sampling drift/slow cycles, not 22 individually localized missing samples. The monitor exited normally; that does not make coverage valid. The old loop waited for all sequential deep probes and then slept another full interval. It also used unbounded process inspection. Those are demonstrated monitoring defects; the exact cause of each of the three specific gaps is not provable from v7.

## Availability and failure windows

| Path | Failed checkpoints | Windows | Observed first-bad→next-good span, sum | Median / p95 / longest window | Approx. health transitions/hour |
| --- | ---: | ---: | ---: | ---: | ---: |
| DVR aggregate | 22 | 18 | 1,503,613 ms | 60,138 / 240,430 / 240,430 ms | 1.5 |
| Tapo | 77 | 27 | 5,143,514 ms | 120,721 / 592,051 / 1,529,420 ms | 2.25 |
| Connector `/health` non-response | 40 | 18 | 2,725,140 ms | 68,041 / 1,160,000 / 1,160,000 ms | 1.5 |

Spans are **checkpoint-bounded upper observations**, not exact physical outage durations; starts may have occurred after the previous good sample, and gaps widen uncertainty. The machine timeline lists every window's first/last failed sample and recovery checkpoint. Seven checkpoint sequences (29, 75, 848, 855, 1002, 1202, 1400) had both DVR and Tapo deficits; v7 cannot show whether they share a network or host cause. No individual component process PID changed. No manual intervention is recorded.

Observed camera-samples: **15,371/15,598 = 98.544685%**; DVR **14,030/14,180 = 98.942172%** and Tapo **1,341/1,418 = 94.569817%**. The six empty DVR slots are excluded. These are sampled progression/response rates, **not continuous-time availability**. Tapo's 40 unresponsive `/health` samples are **unknown source state**, not proven camera outages: confirmed failing relay samples are 37/1,418, and the Tapo physical availability lies between the observed lower and upper bounds pending independent probe evidence. Per-DVR-camera availability is **not calculable**: v7 stored aggregate progression plus input presence, and presence is not progression. The prior per-camera percentages in `result.json` must not be used as proof. Gateway `/health` responded 1,418/1,418, but that is endpoint availability, not full component/media health; ten relays were sometimes absent. Connector `/health` responded 1,378/1,418 with stable PID; whether its 40 failures were service stalls or probe failures remains unresolved.

## DVR diagnosis

The 22 failed samples are **not 22 independent camera faults**. Eighteen samples had at least two relays down, and nine had all ten absent; examples: seq 29 0/10, seq 75 0/10, seq 855 0/10, seq 1413–1414 0/10. Seq 1415–1416 recovered to 9/10. Discovery `failedStreamCount` was 0 in 21/22 samples and 1 at seq 1416, so discovery state was not a dependable live-progress proxy. Gateway run deltas: **2,012 relay starts, 1,900 input socket errors, 108 stale-input detections, 40 recorder-session failures, zero auth rejects**, no Gateway process restart. Multiple relay counters moved together in ten-channel groups. This supports shared recorder/transport/session disturbance and excessive relay churn; v7 cannot distinguish recorder, LAN, host networking, or which channel failed in partial windows. No session storm is established solely by attempts, but the churn is unacceptable and needs targeted instrumentation/observation. The identified internal backoff bypass amplified failures: `ensureRelay` ignored `next_retry_at`; any playback/AI request could restart before the scheduled bounded retry. See root-cause register.

## Tapo and Connector diagnosis

Of 77 Tapo deficits, **37** had responding `/health` with zero progressing relays; **40** had no usable `/health` response. Connector run deltas: **272 relay starts, 146 upstream failures, 36 stale-input detections**, stable supervisor/runtime PIDs. The retained log slice has many `Error opening input: Network is unreachable` relay exits, but no timestamps; physical camera/Wi-Fi vs host network cannot be established. Repeated windows around minute :30 across many hours and a 23-checkpoint window seq 834–856 (about 25.5 minutes until next good) are not acceptable flapping. The `ensureRelay` backoff bypass also applies to Tapo and could amplify retries. The 40 health non-responses remain a HIGH unresolved service/probe diagnosis; **not** labeled external.

## AI, playback, resources and monitor

Deep probes: **24**; playback decoded **264/264** source samples, but only hourly, so it cannot clear minute-level playback outages. AI sampled **239/240** policy-eligible camera opportunities; the only failure (seq 832) was Tapo while its source progression was 0. DVR 9/9 eligible samples succeeded at that probe; DVR channel 2 is policy-excluded from visual-event inference but remains a physical camera. v7 contains no evidence of a queue or worker stall for the one AI failure. A quiet camera with no required AI work must not be called stalled; the probe uses current policy eligibility, not inference count alone.

Gateway CPU median/p95/max **9.1/16/26.8%**, RSS **224.14/268.937/303.251 MB**, handles **62/65/86**; Connector CPU **0.8/4.5/14.4%**, RSS **110.375/127.61/147.704 MB**, handles **27/30/35**. No observed resource exhaustion or process crash. Offline queue depth p95 0/max 1; AI queue telemetry was unavailable (`null`), so queue health cannot be inferred. Untimestamped logs and absent per-relay recovery records prevent precise failure-to-action attribution. v8 must capture per-channel progression, health response category/latency, recovery actions, timestamped relay/session logs, and queue/worker progress.
