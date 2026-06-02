# Local Vision Detection Setup

Gan Batuach now has a local vision adapter behind the existing AI Observer shadow detector.

Current mode:

- Provider: `local_mock`
- Detector mode: `local_shadow`
- Parent visibility: disabled
- Face recognition: disabled
- Audio analysis: disabled
- Child identity recognition: disabled
- External AI calls: disabled
- Raw frame storage: disabled unless explicitly configured later

The adapter is intentionally production-safe without OpenCV or YOLO installed. It lets the worker pipeline create shadow events, collect review outcomes, and measure detector quality before real model processing is enabled.

## Architecture

```text
Video Gateway snapshot or mock frame
-> local-vision-adapter
-> local-detector interface
-> observer rule engine
-> ai_camera_events
-> manager/admin human review
```

All events created by this path must remain:

- `shadow_mode = true`
- `requires_human_review = true`
- `parent_visible = false`
- `detector_mode = local_shadow`

## Frame Analyzer Contract

Input:

- `camera_id`
- `kindergarten_id`
- `frame_url` or `frame_buffer`
- `zone_id`
- `timestamp`
- `routine_context`
- `previous_frame_hash`
- `motion_metadata`

Output:

- detections
- confidence
- bounding boxes when available
- object labels
- motion score
- provider latency
- provider version

## Supported Detection Targets

The first local-shadow targets are:

- `person_detected`
- `multiple_persons_detected`
- `motion_detected`
- `no_motion_too_long`
- `camera_obstruction_suspected`
- `camera_frozen_suspected`
- `camera_offline`
- `restricted_area_occupancy`

Not included in this phase:

- violence detection
- distress detection
- face matching
- child identity
- staff accusations
- audio analysis
- parent notifications
- external AI providers

## OpenCV Option

Future setup:

1. Add a server-only OpenCV package, for example `opencv4nodejs` or a maintained WASM/native OpenCV binding.
2. Run it only in the observer worker/server environment.
3. Use snapshots from the Video Gateway, never raw RTSP in browser code.
4. Compute safe signals only:
   - motion score
   - frame hash
   - obstruction indicators
   - basic contour/person-like movement signals if supported
5. Keep all events in shadow mode until pilot review confirms quality.

Docker notes:

- Native OpenCV packages often require system libraries.
- Build images should include the required OpenCV runtime libraries.
- Do not add OpenCV to the browser bundle.

## YOLO / Ultralytics Option

Future setup:

1. Run YOLO as a separate local worker or local HTTP service.
2. Keep model inference server-side only.
3. Return object labels and bounding boxes without identities.
4. Start with generic `person` detection only.
5. Do not enable face recognition or child matching.

GPU notes:

- GPU support should be optional.
- CPU fallback is required for small pilots.
- Add per-camera rate limits before enabling real inference.

## Local HTTP Model Endpoint Option

Future setup:

- Configure a private local endpoint such as `LOCAL_VISION_ENDPOINT`.
- The endpoint should accept a snapshot or secure internal frame reference.
- The endpoint must never receive parent-visible URLs or direct RTSP secrets.
- The endpoint must return:
  - labels
  - boxes
  - confidence
  - latency
  - model version

This endpoint is local/private infrastructure, not an external AI provider.

## Video Gateway Snapshot Input

Preferred future flow:

```text
Camera source
-> Video Gateway
-> secure snapshot endpoint
-> local detector
```

If the gateway has no snapshot support, the current adapter uses mock frame metadata. It does not expose raw stream URLs and does not store frames.

## False Positive Feedback

Manager/admin review outcomes are used for quality tracking:

- `false_positive`
- `valid_detection`
- `needs_more_data`

The admin observer dashboard derives quality by:

- event type
- camera
- kindergarten
- confidence
- review outcome

No ML retraining is performed in this phase.

## Why Shadow Mode First

Kindergarten camera analysis is sensitive. Shadow mode is required because:

- children are minors
- detections can be wrong
- context matters
- no automatic accusation is acceptable
- parent-facing communication requires human review
- privacy and consent must be confirmed before real use

Real detection should move beyond shadow mode only after:

1. Legal/consent review.
2. Pilot false-positive review.
3. Storage and retention approval.
4. Gateway snapshot security verification.
5. Admin and manager review workflow validation.
