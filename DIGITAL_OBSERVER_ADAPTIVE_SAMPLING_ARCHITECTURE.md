# DIGITAL OBSERVER — ADAPTIVE SAMPLING ARCHITECTURE

Date: 2026-09-10
Contract: `observer-adaptive-sampling-v1`

## Scope

The Gateway, Software Connector and future Enterprise Edge share one local scheduler. It consumes canonical source health, PUSH 29 preprocessing activity, Watch Rules, active Incident/Track state, criticality, learning coverage and bounded resource pressure. It emits an explainable sampling decision; it never emits a Product Event.

`SOURCE → CHEAP SIGNAL → PRIORITY → ADAPTIVE SAMPLE → AI CANDIDATE → TRACKER/OBSERVER → EVENT`

## Purposes and priority

Purposes are `REALTIME_DETECTION`, `TRACKING_CONTINUITY`, `SITE_LEARNING`, `HEALTH_FRESHNESS` and `INVESTIGATION`. Priorities are `CRITICAL`, `HIGH`, `NORMAL`, `LOW` and `LEARNING`.

Active Incidents are CRITICAL. Active Tracks, Watch Rules, recovery and critical-camera policy are HIGH. Activity temporarily boosts a source. Quiet sources decay gradually to a bounded freshness floor; they never disappear permanently. Learning work is lower priority and cannot displace critical realtime work.

## Fairness and pressure

The scheduler sorts due work by never-blind overdue state, priority, least-recent sample and stable source order. A busy camera therefore cannot indefinitely starve another expected camera. Under constrained resources, learning/low work yields first, then normal work; critical/high work and an overdue safety floor remain protected. Decisions include reason, interval, expiry and next evaluation.

## Health and empty channels

Offline/stale is a health condition, never a quiet-scene signal. Recovery causes a bounded health/freshness probe and re-entry. `CHANNEL_EMPTY / UNASSIGNED` receives zero realtime, learning, candidate and AI work.

## Boundaries

Candidate contract `observer-ai-candidate-v2` carries source, observation time, purpose, priority, provenance, zone, policy version and expiry. It is explicitly `canonical_event: false`, deduplicated by bounded activity window and rejected after expiry. PUSH 31 may persist these priority/fairness fields, but PUSH 30 does not implement that durable queue.

No scheduler decision changes Production thresholds automatically. Quality gates remain human-approved and PUSH 28 remains the benchmark authority.
