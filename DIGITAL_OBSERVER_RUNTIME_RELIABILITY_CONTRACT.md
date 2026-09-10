# Digital Observer Runtime Reliability Contract

## Measurements

| Signal | Definition |
|---|---|
| Availability | Expected assigned physical resource is healthy inside the observation window |
| Frame freshness | Input bytes/chunks or playlist timestamp advance inside the configured freshness window |
| Recovery success | Bounded recovery action passes its post-action health check |
| Recovery latency | Failure detection to verified recovery |
| Crash-loop count | Bounded repeated process exits in the configured window |
| Stale-stream count | Running relay/source observed without frame progression |
| User-intervention count | Recovery ladder exhausted or deterministic action-required failure |

No SLA is declared by PUSH 20. The freshness/backoff values are operating controls, not commercial promises. Long-duration and scale qualification belong to PUSH 38.

## Required dimensions

Process, authentication, cloud, source, relay, frame/inference and playback dimensions remain separately reportable. Local processing may remain healthy during a cloud outage; playback may be degraded while processing progresses.

## Resource protection

Audit history, recovery-duration samples, concurrency and retry frequency are bounded. Backoff prevents connection/session storms and log flooding. Empty DVR capacity is excluded. Full durable offline buffering and replay are explicitly outside this contract until PUSH 21.
