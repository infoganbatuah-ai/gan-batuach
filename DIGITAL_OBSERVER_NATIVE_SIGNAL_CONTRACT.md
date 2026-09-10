# DIGITAL OBSERVER — NATIVE SIGNAL CONTRACT

Date: 2026-09-10
Version: `observer-preprocessing-v1`

## Canonical signal

Required fields are a stable/bounded signal ID, Site ID, Camera Source ID, signal type and observation timestamp. Optional safe fields are vendor family, vendor confidence and evidence trust. Accepted types are:

- `NATIVE_MOTION`
- `NATIVE_PERSON_EVENT`
- `NATIVE_VEHICLE_EVENT`
- `SCENE_CHANGE`
- `LOCAL_FRAME_DIFF`

Every normalized signal is marked `CANDIDATE_ONLY`. Native `motion=true`, person or vehicle metadata is never canonical Digital Observer truth by itself.

## Validation

Signals are rejected when malformed, older/newer than the bounded freshness window, or scoped to another Site/source. Stable IDs provide dedupe; a per-source window coalesces continuous activity. Proprietary vendor payloads do not cross the adapter boundary.

## Evidence levels

Capability evidence remains distinct: `VERIFIED_REAL`, `VERIFIED_VENDOR_DOCUMENTATION`, `INTEGRATION_TESTED`, `INFERRED`, or `UNKNOWN`. Current real DVR and Tapo sources have `LOCAL_FRAME_DIFF`; native vendor metadata is `NOT_VERIFIED` and is not claimed.

## Failure behavior

Unavailable or malformed metadata selects `SIGNAL_UNAVAILABLE_FALLBACK` and requests AI. Periodic `PERIODIC_NEVER_BLIND_FALLBACK` prevents a long quiet interval from suppressing all analysis. Empty/unassigned channels select `SKIP_EMPTY` and schedule zero AI work.

## Learning boundary

Connection Intelligence may aggregate sanitized family/signal/firmware capability outcomes. It excludes Site ID, source ID, IP, hostname, friendly name, credentials, URLs and raw frames. Promotion remains human-reviewed and cannot change security policy.
