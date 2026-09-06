# DIGITAL OBSERVER — PUSH 3B REAL PERSON E2E REPORT

## FINAL STATUS

**FAIL — EVENT PIPELINE**

The real home-camera runtime and real ONNX detector are healthy. A physical person was detected twice from authenticated live frames, but the existing Journal did not create a normalized `person_detected` event during the synchronized test windows. The manifest explicitly allows `person_detected`, yet Supabase contained no new event and no evidence. No mock, synthetic, uploaded, seeded, or manually generated event was used.

This PUSH stops at the event-pipeline boundary. No architecture redesign or workaround was introduced.

## REAL PERSON DETECTION

| Field | Result |
|---|---|
| Model | `ssd_mobilenet_v1_10` via `onnxruntime-node` CPU |
| Real frame timestamp | `2026-09-04T21:37:31.665Z` and `2026-09-04T21:37:33.265Z` |
| Class | `person` |
| Confidence | `0.933`, `0.975` |
| Inference latency | `111 ms`, `116 ms`; 77 sampled requests in the 122-second direct observation window |
| Real frame | YES |
| Mock/synthetic | NO |

The first person-positive frames were authenticated through the existing Gateway and carried the correct source anchor:

- Camera/source: `e9f8abf3-5895-494e-b1cf-ea8818602851`
- Site: `cc1673b8-3eb0-4785-a12c-1fb88f425a41`
- Stream: `dvr_84e4cdf200faab18d9_11`
- Gateway: `62df97e2-3c0b-427f-9108-bde029bc10e7`
- Anchor sequences: `3682`, `3683`

The first 122-second window produced 2 `person` hits and no other labels. A second Journal-only window ran from `2026-09-04T21:40:51.567Z` through `2026-09-04T21:42:51.572Z`, allowing the existing event consumer to operate without competing direct sampler requests. Its Journal status remained sampled/degraded with zero pending deliveries and zero delivery failures, but no new event appeared.

## EVENT

No normalized real event exists for this run.

| Field | Result |
|---|---|
| Event ID | NOT CREATED |
| Event type | Expected `person_detected`, not emitted |
| Camera | Real source detected correctly, but no event row |
| Site | Real source anchor correct, but no event row |
| Timestamp | Detection timestamps recorded; no event timestamp |
| Persistence | FAIL — no automatic persistence |

The Journal remained active and continued sampling the real Gateway sources. No event was injected to satisfy this test.

## EVIDENCE

| Evidence | Result |
|---|---|
| Snapshot | NOT APPLICABLE — no event grant |
| Pre-event | NOT APPLICABLE — no event grant |
| Event clip | NOT APPLICABLE — no event grant |
| Post-event | NOT APPLICABLE — no event grant |
| Signed access | NOT APPLICABLE — no media record |

The evidence engine was not bypassed. Its existing source-anchor and recording-grant requirements remain intact.

## UI

| Check | Result |
|---|---|
| Visible? | NO — no persisted event |
| Correct camera? | NOT APPLICABLE |
| Correct timestamp? | NOT APPLICABLE |
| Evidence visible? | NOT APPLICABLE |

The product UI and event route were not treated as proof without a persisted real event.

## LATENCY

| T-step | Result |
|---|---|
| T0 — live frame containing person | `2026-09-04T21:37:31.665Z` |
| T1 — person inference result | same request; 111 ms, confidence 0.933 |
| T2 — normalized event created | UNAVAILABLE — event pipeline emitted nothing |
| T3 — database persistence | UNAVAILABLE |
| T4 — evidence ready | UNAVAILABLE |
| T5 — UI visible | UNAVAILABLE |

Measured pilot inference-request latency was 2–159 ms, average 77 ms over 77 direct requests. Detection-to-event, DB, evidence, UI, and overall latency are unavailable because the event was not emitted.

## FAILURE / RECOVERY

**NOT RUN.** The event pipeline did not complete, so no relay/Gateway interruption was introduced to the active home-camera system.

Observed baseline health before sampling:

- Gateway HTTP health: 200
- Active relays: 10
- Progressing relays: 10
- Object detection: ready
- Channel 11 source mapping: correct

## REMAINING MOCK BOUNDARY

The REAL verified path currently reaches:

`real DVR → persistent Gateway → live relay → real frame extraction → real ONNX inference`

The following failed or remain unproven in PUSH 3B.1 after real person detections occurred:

`person detection → normalized event → evidence → database → product UI`

The main product Observer still has a separate `mock` / `local_shadow` worker path. Synthetic/demo sources and historical event rows remain distinct and were not used. The Gateway Journal, ONNX worker, evidence engine, and cloud event path remain the existing production-like components.

## PUSH 4 READINESS

**ARE WE READY TO REPLACE/WIRE THE MOCK PRODUCT OBSERVER WITH THE PROVEN REAL AI PIPELINE? NO.**

The real camera, relay, frame extraction, ONNX inference, and person detection layers are verified. The existing Journal-to-normalized-event handoff did not produce an event despite a valid real detection and an allowed event policy. PUSH 4 must not begin until this narrow event-pipeline gap is diagnosed and fixed. No architectural blocker was assumed, and no PUSH 4 work was started.
