# AI Observer Worker Contract

This document defines the Phase 2C architecture contract for the Gan Batuach AI Digital Observer.

No real AI provider, video processing, child video analysis, recording, or external model call is implemented in this phase. The current implementation supports mock event creation, review workflows, permissions, notifications, and future worker readiness.

## Pipeline

Camera Stream
-> Video Gateway
-> AI Observer Worker
-> Frame Sampling
-> AI/Event Rules
-> `ai_camera_events`
-> Notifications
-> Manager/Admin/Inspector dashboards

## Eligible Cameras

The future worker should fetch only cameras that are explicitly eligible for observer processing:

- Camera is active and not disabled.
- Camera belongs to an active kindergarten.
- Kindergarten has consent/configuration for observer processing.
- Camera has gateway playback/source registration.
- Camera is not marked sample-only unless the worker is running in mock/test mode.

The worker must not fetch parent-only playback URLs or browser playback URLs. It should request a server-side gateway stream reference through a protected service.

## Gateway Stream URL

The worker receives stream access through the video gateway service only.

Expected service behavior:

- `getPlaybackUrls()` returns worker-safe stream references.
- RTSP credentials remain server-side.
- Gateway API keys remain server-side.
- Stream references are short-lived where possible.
- No stream credentials are stored in `ai_camera_events`.

## Frame Sampling

Frame sampling is future work. When implemented:

- Sampling interval must be configurable per camera/kindergarten.
- Sampling should avoid unnecessary processing outside configured hours.
- Sampling must support backoff when a stream is offline or unstable.
- No raw frames should be stored unless an event is created and retention policy allows it.

## Event Rules

All detections must use careful language:

- suspected
- indicator
- requires review

The worker may create these event types:

- `person_detected`
- `unauthorized_person`
- `child_missing_from_area`
- `restricted_area_entry`
- `fall_suspected`
- `crowding_suspected`
- `gate_or_door_open`
- `pickup_mismatch`
- `staff_behavior_concern`
- `distress_suspected`
- `violence_indicator`
- `audio_anomaly`
- `keyword_detected`
- `camera_tampering`
- `camera_offline`

No event should be treated as a final factual accusation before human review.

## Event Creation

The worker creates rows in `ai_camera_events` with:

- `kindergarten_id`
- `camera_id`
- `event_type`
- `severity`
- `title`
- `description`
- `confidence_score` when available
- `started_at`
- `ended_at` when available
- `detected_entities` as JSON
- `metadata` with worker version, rule id, gateway source id, and run id
- `dedupe_key`

Clip and snapshot fields are nullable readiness fields:

- `clip_url`
- `snapshot_url`
- `pre_event_seconds`
- `post_event_seconds`
- `retention_days`

They must point to protected storage or signed-access services only when recording is implemented.

## Status Updates

The worker should only create and maintain technical detection state. Human users own review state.

Allowed event statuses:

- `open`
- `reviewing`
- `confirmed`
- `dismissed`
- `escalated`

The worker should not set `confirmed`, `dismissed`, or `escalated`; those are human review actions.

## Spam Avoidance

Every event should include a deterministic `dedupe_key` where possible:

`kindergarten_id:camera_id:event_type:area:time_bucket`

Suggested default windows:

- Camera offline: one event per camera per 30 minutes.
- Door/gate open: one event per camera/zone per 10 minutes.
- Fall suspected: one event per camera/child/person per 5 minutes.
- Crowding suspected: one event per area per 15 minutes.
- Audio anomaly/keyword: one event per area/key per 10 minutes.

The worker should update metadata or timestamps on a related open event instead of creating repeated identical events.

## Notifications

Urgent or critical events create notifications for:

- Kindergarten manager/owner.
- Admin.
- Inspector only when assigned/configured.

Parents are not notified automatically. Parent-facing updates require explicit human approval and parent-safe wording.

## Future Machine Learning Layer

Future learning capabilities may include:

- Learning kindergarten routine.
- Reducing false positives.
- Identifying recurring patterns.
- Camera zone learning.
- Pickup routine learning.
- Staff behavior trend review.

All learning must preserve consent, minimal data retention, role-based access, and human review.

## Standalone Digital Observer Reuse

The same observer engine should later support:

- Homes.
- Businesses.
- Warehouses.
- Offices.
- Parking lots.
- Kindergartens.

The future standalone product can use subscription dimensions such as camera count, monitoring hours, alert types, and recording retention.
