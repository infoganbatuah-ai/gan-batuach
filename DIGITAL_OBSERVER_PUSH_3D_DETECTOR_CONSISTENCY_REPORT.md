# DIGITAL OBSERVER — PUSH 3D: Detector Consistency & Calibration

## FINAL STATUS

**FAIL — EVENT PERSISTENCE**

The real detector consistency question passed. The real event was automatically
qualified by the Journal, but it remained in the persistent Gateway outbox and
was not visible in the configured local Supabase environment. The Gateway is
configured to deliver to a different cloud deployment; changing that endpoint
or device identity is configuration authority outside this PUSH.

## ROOT CAUSE

The earlier apparent inconsistency was not caused by ONNX preprocessing,
thresholding, NMS, replay, or frame staleness. The earlier controlled windows
contained no visible person in the actual detector-input frames.

During the synchronized window on 2026-09-04, a real person was visible in four
distinct source frames and ONNX detected `person` in all four. The subsequent
end-to-end persistence blocker is an environment-routing mismatch:

- Persistent Gateway cloud target hostname: `gan-batuach.vercel.app`
- Local runtime Supabase hostname: `kuaywzvucllxjsxarogb.supabase.co`
- Local runtime environment label: `demo`

The Gateway Journal automatically created a real `person_detected` event, then
retried cloud delivery. The event was not found in the local configured
Supabase environment. No cloud endpoint, device identity, credential, source,
or event payload was changed to force persistence.

## FRAME UNIQUENESS

- Channel/source: `e9f8abf3-5895-494e-b1cf-ea8818602851` / channel 11
- Stream: `dvr_84e4cdf200faab18d9_11`
- Diagnostic empty-scene sample: 50 distinct source sequences (6204–6253)
- Synchronized sample: 15 distinct source sequences (6480–6492, 6516–6517)
- Replayed source sequences counted as confirmations: 0
- Duplicate pixel hashes within the sampled source sequences: 0

The local diagnostic clips/contact sheets were deleted immediately after
inspection. No raw camera image was retained in the repository or uploaded.

## PREPROCESSING PIPELINE

Current production path:

`MPEG-TS segment → FFmpeg first keyframe → RGB24 → scale 300×300 → uint8 NHWC [1,300,300,3] → ONNX Runtime CPU`

- Source frame: 640×480 H.264, 4:3
- Model input: `image_tensor:0`, uint8, `[1,300,300,3]`, pixel range 0–255
- Colour ordering: RGB24
- Normalization: none; correct for this uint8 graph
- Orientation/rotation: no mismatch observed

## MODEL CONTRACT

Model: `ssd_mobilenet_v1_10` (verified SHA-256)

Outputs consumed by the worker:

- `detection_boxes:0`
- `detection_classes:0`
- `detection_scores:0`
- `num_detections:0`

The graph provides post-NMS candidates. The Gateway does not apply an extra
NMS layer. Class 1 maps to `person`; the Gateway threshold is 0.55.

## RAW OUTPUT ANALYSIS

For all four frames visually confirmed to contain a person, the raw graph
output contained class 1. No person proposal was lost to parsing or a second
NMS pass.

| Sequence | Production stretch | Letterbox | Production threshold result |
| --- | ---: | ---: | --- |
| 6491 | 0.729 | 0.392 | detected |
| 6492 | 0.863 | 0.973 | detected |
| 6516 | 0.952 | 0.989 | detected |
| 6517 | 0.840 | 0.987 | detected |

## THRESHOLD ANALYSIS

- Production person threshold: 0.55
- Visible-person frames: 4
- Person proposals before threshold: 4
- Person detections after threshold: 4
- Mean production confidence: 0.846
- Median production confidence: 0.851
- Minimum/maximum: 0.729 / 0.952

No threshold change is justified. The lowest valid real observation was safely
above the threshold, while the empty-scene control remained clean.

## NMS ANALYSIS

The model returns post-NMS detections. The local worker only limits result
count, maps classes, and applies the confidence threshold. There is no
additional class-aware or class-agnostic NMS capable of discarding the four
validated person boxes.

## ASPECT RATIO COMPARISON

The production stretch path detected all four real-person frames. Letterboxing
increased confidence on three frames but reduced one real person proposal from
0.729 to 0.392, below the production threshold. It is therefore not a
consistent correctness improvement and was not promoted to production.

## POSITIVE PERSON BENCHMARK

- Person visibly present in detector input: **YES**
- Visible-person frames analyzed: 4
- `person` detections: 4
- Diagnostic hit rate: **100%**
- Inference latency (local benchmark): 33.7–37.7 ms per frame
- Sampling window: 2026-09-04T22:41:13.518Z to 2026-09-04T22:42:13.521Z

This is a controlled diagnostic sanity check, not a production recall metric.

## EMPTY-SCENE NEGATIVE CONTROL

Ten independently selected frames from the 50-frame empty corridor sample were
tested in both preprocessing modes.

- False `person` detections: 0 / 10 (stretch)
- False `person` detections: 0 / 10 (letterbox)
- Raw person proposals: 0 / 10 in both modes

## FIX APPLIED

No production detector, Journal, threshold, or model change was applied: the
measured path is correct and the Journal two-distinct-frame rule remains
unchanged.

Added local-only diagnostic utilities:

- `scripts/qa/capture-live-object-diagnostic-sample.mjs`
- `scripts/qa/analyze-object-frame-preprocessing.mjs`

They capture bounded temporary relay segments, compare current preprocessing to
letterboxing, report hashes/metadata only, and never persist or upload camera
pixels.

## BEFORE VS AFTER

| Measurement | Earlier ambiguous runs | Controlled synchronized run |
| --- | --- | --- |
| Person in verified input | no | yes, 4 frames |
| Unique person detections | 0–1 | 4 |
| Replay counted as confirmation | no | no |
| Detector consistency conclusion | not measurable | 4/4 visible frames detected |

## LIVE PERSON RETEST

Real Gateway detections during the synchronized test included four distinct
source sequences with confidences 0.729, 0.863, 0.952, and 0.840. All came
from the authenticated channel 11 relay and no mock, uploaded, seeded, or
synthetic media was used.

## JOURNAL EVENT RESULT

**PASS locally.** The existing two-confirmation Journal generated an event
automatically:

- Event ID: `49cb4b82-d847-4926-a03e-26ed36fff7d1`
- Type: `person_detected`
- Camera/source: `e9f8abf3-5895-494e-b1cf-ea8818602851`
- Stream: `dvr_84e4cdf200faab18d9_11`
- Timestamp: `2026-09-04T22:45:54.310Z`
- Confidence: 0.912
- Model: `ssd_mobilenet_v1_10` / `onnxruntime-node` CPU
- Source anchor sequence: 6714

The outbox preserved the event and retried delivery; it was not manually
inserted.

## DB / EVIDENCE / UI RESULT

| Stage | Result | Evidence |
| --- | --- | --- |
| Cloud delivery | FAIL | Journal outbox retry count reached 7; Gateway device authorization remained ready. |
| Configured local Supabase persistence | FAIL | Read-only scoped query found no signal for the source/site after the event time. |
| Evidence | NOT RUN | Requires cloud event acknowledgement/recording grant. |
| Product UI | NOT RUN | Requires persisted event in the product environment. |

The delivery result must be repaired by aligning the Gateway cloud target with
the intended pilot environment or by verifying the remote deployment's event
route and database. No endpoint or credential was changed in this PUSH.

## MODEL ADEQUACY DECISION

**The current model is adequate for this controlled channel-11 person test.**

It detected every visibly-person-present sampled frame and produced no person
false positives in the empty-scene control. A model replacement is not
recommended based on these measurements.

## TEST RESULTS

| Test | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run qa:real-detection-event-bridge` | PASS |
| Journal/event regression suite (earlier same PUSH session) | PASS |
| Gateway health during 75-second Journal window | PASS |

## PUSH 4 READINESS

**ARE WE READY FOR PUSH 4 — PRODUCT OBSERVER REAL-AI INTEGRATION? NO**

The real detector and local Journal bridge are proven. First resolve the cloud
delivery/persistence environment mismatch and complete the real event →
evidence → UI trace in the intended pilot environment. PUSH 4 must not begin
until that boundary is verified.
