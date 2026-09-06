# DIGITAL OBSERVER — PUSH 3C.2 CONTROLLED PERSON EVENT REPORT

## FINAL STATUS

**BLOCKED — PERSON NOT PRESENT IN VERIFIED INPUT FRAMES**

The controlled diagnostic removed the ambiguity from the previous blind windows. The real channel-11 relay was healthy, current, and sampled at high cadence; temporary local snapshots of that same relay showed no person. Consequently, no valid real detector, Journal, event, evidence, database, or UI result can be claimed.

## CAMERA VIEW VERIFICATION

| Field | Result |
|---|---|
| Camera/source | `e9f8abf3-5895-494e-b1cf-ea8818602851` |
| Stream / DVR channel | `dvr_84e4cdf200faab18d9_11` / `11` |
| Safe view description | Indoor entrance stairwell/corridor: door, stairs, railing, and open tiled floor visible |
| Resolution / codec / nominal FPS | 640×480 / H.264 / 25fps |
| Relay state | Healthy and progressing |
| Expected physical field | The camera sees the stairwell/corridor entrance area, not an exterior doorway-wide view |

This confirmed that channel 11 is a live interior entrance/stairwell view. A test subject must stand in the open lower/central corridor area, rather than behind the railing, beyond the visible doorway, or outside the frame.

## SOURCE VS WALL-CLOCK DELAY

| Observation | Wall clock | Source anchor timestamp | Delay |
|---|---|---|---|
| First high-cadence sample | `2026-09-04T22:21:15.088Z` | `2026-09-04T22:21:14.884Z` | 204ms |
| Last high-cadence sample | `2026-09-04T22:22:14.774Z` | `2026-09-04T22:22:14.655Z` | 119ms |

There is no material stream/timestamp delay. Timing or stale relay behavior does not explain the missed detections.

## SAMPLING RATE

| Window | Duration | Samples | Rate | Unavailable |
|---|---:|---:|---:|---:|
| High-rate detector diagnostic | 75s | 218 | 2.91fps | 0 |
| Verified-input diagnostic | 60s | 150 | 2.50fps | 0 |

The target 2–5fps diagnostic cadence was achieved without changing the persistent production sampling policy.

## PERSON VISIBILITY PROOF

### Was a person visibly present in frames submitted to ONNX?

**NO.**

The second diagnostic used 12 temporary local snapshots from the same authenticated channel-11 relay during the 60-second, 150-frame ONNX window. Manual local inspection found the corridor empty in all twelve snapshots. The snapshots were not uploaded, retained, or included in this report; they were deleted immediately after inspection.

| Measure | Result |
|---|---:|
| Visibly-person-present relay snapshots | 0 / 12 |
| Visible-person ONNX input frames established | 0 |
| ONNX frames analyzed | 150 |
| `person` outputs | 0 |
| Diagnostic hit rate | Not applicable: denominator is zero |

## REAL ONNX DETECTIONS

No real `person` output occurred in either high-cadence diagnostic window. This does not establish detector inconsistency because a person was not visibly present in the verified relay frames.

## JOURNAL CONFIRMATION

Not reached. The repaired two-confirmation runtime is loaded in the persistent Gateway (workspace/runtime hashes matched and the runner is configured with `personConfirmations: 2`), but no person detection was available to form candidate state or satisfy confirmation.

The Journal remained running, listed channel 11 as `sampled`, and ended with zero pending outbox deliveries and zero delivery failures.

## EVENT

Not created. No manual, seeded, mock, or synthetic event was used.

## DATABASE

Not applicable. Since no real detection qualified, normal outbox/backend persistence was never invoked.

## EVIDENCE

Not applicable. No validated event meant no recording grant or evidence capture request.

## UI

Not applicable. No persisted real event existed for the product event route or UI.

## END-TO-END LATENCY

T0–T7 cannot be measured because no person frame was present. The input-side latency diagnostic showed only 119–204ms from the source anchor to receipt at the local diagnostic process.

## ROOT CAUSE OF PREVIOUS MISSES

The earlier 3C.1 windows did not establish that a person was in channel 11’s actual indoor stairwell/corridor field. This PUSH verifies that the current high-rate windows were empty rather than delayed or stale. The previous lack of detections is therefore explained by absence from the verified detector input, not by the repaired Journal bridge, stream delay, or a demonstrated ONNX miss.

## PUSH 4 READINESS

**ARE WE READY FOR PUSH 4? NO.**

The next action is a new controlled pass in the verified indoor stairwell/corridor field: stand in the central open floor area for 20–30 seconds while the 2–3fps diagnostic is active. Only then can the existing two-confirmation Journal repair be proved through a real normalized event, persistence, evidence evaluation, and UI display. PUSH 4 was not started.
