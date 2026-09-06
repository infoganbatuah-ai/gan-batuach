# DIGITAL OBSERVER — PUSH 3C.1 REAL EVENT VERIFICATION REPORT

## FINAL STATUS

**BLOCKED — REAL PERSON NOT PRESENT**

The repaired runtime was loaded and healthy, but the controlled 180-second real-camera window produced zero `person` detections. No Journal event, database event, evidence, or UI state was fabricated.

## BASELINE

| Check | Result |
|---|---|
| Persistent Gateway | PASS — LaunchAgent running |
| Running code | PASS — installed hashes matched workspace for Journal, tracker, and runner |
| Channel 11 relay | PASS — healthy and progressing |
| Real frames | PASS — 60 fresh authenticated samples, 0 unavailable |
| ONNX readiness | PASS — object model ready, `ssd_mobilenet_v1_10`, CPU |
| Journal | PASS — running and sampling channel 11 |
| Two-confirmation contract | PASS — persistent runner configured with `personConfirmations: 2` |
| Old process/version | PASS — one active LaunchAgent/runtime with matching installed files |

## REAL DETECTIONS

| Field | Result |
|---|---|
| Source | `e9f8abf3-5895-494e-b1cf-ea8818602851` |
| Site | `cc1673b8-3eb0-4785-a12c-1fb88f425a41` |
| DVR channel | `11` |
| Stream | `dvr_84e4cdf200faab18d9_11` |
| Window start | `2026-09-04T22:09:36.603Z` |
| Window end | `2026-09-04T22:12:36.634Z` |
| Duration | 180 seconds |
| Real samples | 60 |
| Unavailable samples | 0 |
| `person` detections | 0 |

No two valid real detections occurred, so the Journal confirmation contract was not exercised by a real person in this window. PUSH 3B.1 remains the evidence that this source previously produced real ONNX person detections.

## JOURNAL CONFIRMATION

**NOT REACHED.** The Journal status showed channel 11 as sampled and the local outbox remained empty. Because no real detector output occurred in this window, it is not valid to classify this run as a Journal bridge failure.

## EVENT

**NOT CREATED.** Event ID, event type, timestamps, confidence, provenance, and source anchor are not applicable. No manual insertion or synthetic event was used.

## DATABASE

**NOT APPLICABLE.** No real detection qualified for normal outbox delivery, so no new event was expected in the configured database.

## EVIDENCE

**NOT APPLICABLE.** The existing evidence engine was not invoked because no validated event and recording grant existed.

## UI

**NOT APPLICABLE.** There was no persisted real event for the normal product event route to display.

## LATENCY

T0–T6 cannot be measured for an event because no real person frame/detection occurred. The observation window itself was 180 seconds, with 60 successful real sampling requests and no unavailable requests.

## REMAINING MOCK BOUNDARY

The real Gateway → frame extraction → ONNX path remains independent and is not replaced by the product `mock` / `local_shadow` observer. The repaired bridge rejects `demo`, `mock`, and `local_shadow` source modes and preserves source anchor/model provenance when a real detection qualifies. The product mock/local-shadow observer remains unchanged.

## PUSH 4 READINESS

**NO.** A new controlled physical person pass is required to produce two real detections and verify automatic Journal event creation, persistence, evidence evaluation, and UI visibility. PUSH 4 was not started.

## TESTS

- Real detection bridge contract: PASS.
- Journal, ingest, outbox, object inference, and event-media regressions: PASS.
- Persistent Gateway safety QA: PASS.
- Typecheck: PASS.
- Relevant lint: PASS with existing warnings only.
