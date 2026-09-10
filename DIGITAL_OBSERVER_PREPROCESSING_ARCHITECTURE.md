# DIGITAL OBSERVER — PREPROCESSING ARCHITECTURE

Date: 2026-09-10
Contract: `observer-preprocessing-v1`

## Boundary

PUSH 29 adds one cheap, vendor-agnostic stage in front of the existing ONNX call. It does not create an Event engine. The only Product-event path remains:

`candidate → ONNX → Observation/Tracking → canonical Event → Incident → Risk → Verification → Decision`.

Vendor signals and local frame-difference results are candidates only. They cannot create an Incident, Decision or action directly.

## Runtime flow

1. The canonical event manifest supplies source assignment, health policy, active Watch Rule/criticality, available signals and an approved preprocessing policy.
2. `journal-loop.mjs` excludes `CHANNEL_EMPTY` sources and asks the existing Gateway for a bounded local activity sample before `/detections`.
3. `preprocessing-policy.mjs` validates scope/freshness, deduplicates native signals, coalesces active windows and decides whether to request expensive inference.
4. Missing/malformed cheap metadata fails open to AI. Source health failure is reported as health failure, never interpreted as a quiet scene.
5. Only the existing `JournalTracker.observe` path may create canonical Events.

## Policy safety

- `ALWAYS_ANALYZE`: no optimization.
- `CANDIDATE_DRIVEN`: candidate scheduling plus bounded never-blind fallback.
- `ADAPTIVE`: candidate scheduling, coalescing and bounded fallback.

`CANDIDATE_DRIVEN` and `ADAPTIVE` require `preprocessing_quality_gate_approved=true`; otherwise Production remains `ALWAYS_ANALYZE`. Active Watch Rules, critical-camera policy and elevated incidents force analysis. No Production threshold is changed automatically by benchmark output.

## Health and privacy

Offline, unreachable or stale sources return `SOURCE_HEALTH_NOT_QUIET`; they are not counted as quiet suppression. The activity endpoint returns aggregate motion metrics and explicitly returns no raw video. Telemetry contains counts, bounded reason categories and latency only.

## Extension boundary

Vendor adapters may emit the canonical signal contract. Future VMS/NVR/Enterprise Edge adapters do not change Observer Core. PUSH 30 may expand adaptive scheduling; PUSH 29 does not start that work.
