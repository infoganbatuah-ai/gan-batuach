# DIGITAL OBSERVER CAMERA HEALTH MODEL

`observer-camera-health-v1` is the single health projection consumed by Product, API, Fleet and future observability/SLO qualification. It does not replace PUSH 20 supervision or PUSH 27 telemetry; it turns their evidence into truthful camera usability.

## Dimensions

Each expected camera reports source availability, frame freshness, relay, playback, AI/inference, managed component, authentication, cloud and recording independently. `HEALTHY`, `RECOVERING`, `DEGRADED`, `OFFLINE`, `ACTION_REQUIRED`, `EMPTY` and `UNKNOWN` summaries are derived, never accepted as an unqualified stale boolean.

An empty/unassigned channel is not an expected camera. Configured capacity, expected physical cameras and active cameras remain separate. Availability and SLO denominators use expected resources only.

## Root cause and recovery

A confirmed component outage becomes one root cause with dependent camera symptoms. A single source failure does not blame its healthy Gateway. Watchdog recovery projects `RECOVERING`; repeated state transitions can add `FLAPPING`. Historical healthy evidence expires when freshness TTLs pass.

## Customer truth

Normal Product language distinguishes a working camera, recovery, Live View degradation, Observer/AI degradation, required action and an unused channel. Advanced diagnostics retain dimensions, timestamps, dependency and confidence without exposing credentials or private stream URLs.
