# Local AI Shadow Detector

Phase 2G adds the first local-only pilot detector foundation for the Digital Observer.

It does not process real child video, does not identify children, does not use face recognition, does not analyze audio, does not call external AI providers, and does not notify parents.

## Shadow Mode Rules

Every detection is stored as:

- `shadow_mode = true`
- `requires_human_review = true`
- `parent_visible = false`
- `detector_provider = local_mock`
- `detector_mode = local_shadow` or `shadow`

Only admin/manager/owner/assigned inspector review screens can see raw detections.

## Detection Types

The local pilot detector supports mock/heuristic shadow detections:

- `camera_offline`
- `camera_frozen_suspected`
- `motion_detected`
- `no_motion_too_long`
- `person_detected`
- `multiple_persons_detected`
- `restricted_area_occupancy`
- `camera_obstruction_suspected`

All wording is careful:

- suspected
- indicator
- requires review

## Input Contract

`lib/domain/ai-observer/local-detector.ts` defines the frame/sample contract:

- `camera_id`
- `kindergarten_id`
- `gateway_snapshot_url`
- `frame_metadata`
- `zone_id`
- `timestamp`
- `previous_frame_hash`
- `motion_score`

Real frames are not stored in this phase.

## Output Contract

Each detection returns:

- `event_type`
- `severity`
- `confidence_score`
- `title`
- `description`
- `recommended_action`
- `dedupe_key`
- `metadata`

No personal identity fields are returned.

## Worker Integration

The observer worker pipeline now runs:

observer job
-> camera/zone/routine/learning context
-> local mock detector
-> rule engine and cooldown
-> `ai_camera_events`
-> admin/manager review

## False Positive Tracking

Reviewers can mark:

- `false_positive`
- `valid_detection`
- `needs_more_data`

These outcomes are saved to `ai_camera_events.review_outcome` for future model tuning.

## Next Step For Real OpenCV/YOLO

1. Add OpenCV camera health checks for offline/frozen/obstruction.
2. Add YOLO/Ultralytics person/object detection behind the same local detector interface.
3. Keep shadow mode active during pilot.
4. Compare detections to human review outcomes.
5. Only after measured quality, consider live operational alerts.
