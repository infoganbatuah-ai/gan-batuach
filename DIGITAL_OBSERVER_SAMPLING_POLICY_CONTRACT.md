# DIGITAL OBSERVER — SAMPLING POLICY CONTRACT

Date: 2026-09-10

## Inputs

- tenant-scoped Site and Camera Source identity;
- expected/empty assignment and source/frame health;
- PUSH 29 cheap/native candidate activity and provenance;
- active Watch Rule, Incident, Track, zone and critical-camera policy;
- Site-learning under-coverage;
- bounded worker/Site budget and `NORMAL`, `CONSTRAINED` or `CRITICAL` resource pressure.

## Decision

Every decision exposes `camera_id`, purpose, priority, `request_sample`, reason, target interval, reevaluation time, expiry, AI eligibility and optional non-canonical candidate. Reasons include `ACTIVE_INCIDENT`, `ACTIVE_TRACK`, `ACTIVE_WATCH_RULE`, `PREPROCESSING_ACTIVITY`, `QUIET_SCENE_DECAY`, `QUIET_SCENE_FRESHNESS_FLOOR`, `CAMERA_UNDER_COVERED`, `SOURCE_RECOVERING`, `RESOURCE_PRESSURE_DEFERRED` and `CHANNEL_EMPTY`.

The default bounded intervals are 0.5 seconds CRITICAL, 1 second HIGH, 2 seconds NORMAL, gradual quiet decay, and a 30-second never-blind floor. Manifest policy can tighten approved bounds; it cannot remove the floor for an expected monitored source.

## Safety invariants

1. Empty channels have zero work.
2. Health failure never means quiet.
3. Watch Rule/Incident/Track priority cannot be defeated by cost optimization.
4. Least-recent and overdue ordering prevents camera starvation.
5. Stale realtime candidates expire and cannot masquerade as fresh Events.
6. Candidate is not Event; canonical Observer/Tracker processing remains mandatory.
7. Learning work is separately accounted and cannot reduce realtime safety.
8. No raw video or secret enters scheduler telemetry.

## PUSH 31 handoff

Future durable jobs receive stable candidate ID, source/Site scope, purpose, priority, reason, policy version and expiry. PUSH 31 owns persistence, retries and worker delivery; PUSH 30 owns only scheduling and queue-ready metadata.
