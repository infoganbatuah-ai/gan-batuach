# DIGITAL OBSERVER — PUSH 3C.3 FINAL PERSON E2E REPORT

## FINAL STATUS

**FAIL — REAL DETECTOR CONSISTENCY**

A real person was visibly present in the verified channel-11 relay frames, but the existing ONNX path produced only one unique source-frame `person` observation. The duplicate response for the same source sequence cannot satisfy the two-confirmation Journal contract. No threshold, architecture, event, or test data was changed to force a pass.

## BASELINE

| Check | Result |
|---|---|
| Gateway | Healthy; device authorization ready |
| Relays | 10 active / 10 progressing |
| Channel 11 | Healthy, progressing, and sampled by Journal |
| ONNX | Ready; `ssd_mobilenet_v1_10` using `onnxruntime-node` CPU |
| Journal | Active; local outbox empty and no delivery failures before the test |
| Repaired contract | Loaded: persistent runner config contains `personConfirmations: 2`; installed tracker hash matches workspace |

## PERSON VISIBILITY PROOF

**PERSON PRESENT IN VERIFIED INPUT FRAMES: YES**

Twenty-four temporary local relay snapshots were captured during the same authenticated 120-second channel-11 window. A real person is visibly present in the first five independently timestamped snapshots, moving through the open central corridor for approximately 20 seconds. The snapshots were local only, never uploaded, not retained, and deleted after inspection.

| Measure | Result |
|---|---:|
| Window | `2026-09-04T22:25:42.868Z`–`2026-09-04T22:27:43.161Z` |
| Relay snapshots | 24 |
| Visibly-person-present snapshots | 5 |
| Detector requests | 300 (2.5fps average) |
| Unavailable detector requests | 73 |
| Successful detector responses | 227 |

## REAL ONNX DETECTIONS

| Detection | Source timestamp | Sequence | Confidence | Box | Latency |
|---|---|---:|---:|---|---:|
| First | `2026-09-04T22:25:43.672Z` | 5706 | 0.808 | `[0, 0.4099, 0.6494, 0.6321]` | 108ms |
| Duplicate replay | `2026-09-04T22:25:44.073Z` | 5706 | 0.808 | `[0, 0.4099, 0.6494, 0.6321]` | 115ms |

Model/provider: `ssd_mobilenet_v1_10` / `onnxruntime-node` CPU. Both responses refer to the same source anchor sequence and are therefore one unique observation, not two correlated detections.

Diagnostic detection hit rate: **1 unique person-positive source frame / at least 5 visibly-person-present relay frames = at most 20%**. This is a controlled sanity measurement, not a production precision/recall claim.

## JOURNAL CONFIRMATION

**NOT REACHED.** The Journal correctly rejects replaying the same source sequence as a new confirmation. It received no second unique qualifying person observation, so it correctly produced no normalized event. This is not a Journal-event-bridge failure.

## EVENT / DATABASE

No event was created. The local outbox ended empty, with zero delivery failures. A read-only scoped Supabase query for the tested site/camera after the start timestamp returned no new persisted signal. No manual insertion, mock, local-shadow, seeded event, or synthetic frame was used.

## EVIDENCE / UI

Not applicable: without a validated persisted event, the evidence recording grant, media capture, product event route, and UI entry were not invoked.

## END-TO-END LATENCY

| Step | Result |
|---|---|
| T0 visible person | Established by relay snapshots during the first ~20 seconds |
| T1 first detection | 108ms request latency at `22:25:43.672Z` |
| T2 second unique detection | Not reached |
| T3 Journal event through T6 UI | Not reached |

## REMAINING MOCK BOUNDARY

The tested path was real DVR → real Gateway relay → real local ONNX. Mock/local-shadow sources were not used and remain rejected from the real event path. The separate product mock/local-shadow Observer remains unchanged.

## PUSH 4 READINESS

**ARE WE READY FOR PUSH 4? NO.**

The real person was confirmed in channel-11 input but the detector did not provide the two unique source-frame detections required by the existing safe Journal contract. PUSH 4 must not begin until the real-detector consistency problem is investigated in its own scoped phase. No PUSH 4 work was started.
