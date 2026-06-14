# Real AI Observer Pilot, Shadow Mode & Calibration

## Purpose

Phase 165 prepares the first real-world Digital Observer pilot while keeping Gan Batuach safe, reviewed, and non-automatic.

The pilot connects real or test camera sources to pose/skeleton readiness, motion anomaly signals, human review, calibration, false-positive tracking, false-negative tracking, and readiness scoring.

## Pilot Architecture

Pipeline:

1. Camera gateway source
2. Secure frame sampling job
3. Pose adapter readiness
4. Skeleton / motion analysis
5. Internal observer signal
6. Human review queue
7. Calibration profile update
8. Readiness scoring

The database migration `20260612016500_real_ai_observer_pilot_shadow_calibration.sql` adds the pilot layer without replacing previous observer tables.

Core tables:

- `observer_pilot_runs`
- `observer_frame_sampling_jobs`
- `observer_pose_adapter_readiness`
- `observer_ground_truth_reviews`
- `observer_calibration_profiles`
- `observer_pilot_quality_snapshots`
- `observer_pilot_dataset_registry`
- `observer_pilot_safety_rules`

## Shadow Mode Rules

All real detections are enforced as shadow-mode records:

- `shadow_mode = true`
- `human_review_required = true`
- `parent_visible = false`
- `model_mode = shadow`

AI may:

- detect motion patterns
- recommend review
- create internal review events
- support calibration

AI may not:

- notify parents automatically
- create confirmed incidents automatically
- make disciplinary conclusions
- make regulatory conclusions
- accuse any person

## Pose / Skeleton Adapter Model

Prepared adapters:

- `local_mock`
- `local_http`
- `future_yolo_pose`
- `future_mediapipe`

Expected adapter output:

- keypoints
- confidence
- timestamp
- camera id
- zone id
- model name
- model version
- inference latency

Raw frames are not persisted by default. RTSP URLs, camera credentials, and gateway secrets must stay server-side.

## Motion Signal Language

Allowed pilot event labels:

- `fall_suspected`
- `inactivity_suspected`
- `high_velocity_motion`
- `crowding_suspected`
- `restricted_area_presence`
- `person_down_suspected`
- `unusual_motion_pattern`

Forbidden wording:

- violence happened
- staff harmed child
- abuse detected
- child is in danger

Safe wording:

- motion anomaly
- suspected fall
- requires review
- unusual movement
- supervision attention may be needed

## Review Workflow

Lifecycle:

1. detected
2. pending_review
3. dismissed / confirmed / needs_followup / uncertain
4. optional task, inspection, or incident only after approval
5. closed

Raw AI events, skeleton events, confidence scores, and unreviewed signals are not parent-visible.

## False Positive Model

False positives are tracked in `observer_ground_truth_reviews` with:

- event type
- camera
- zone
- confidence
- model version
- provider
- threshold used
- false-positive reason

Common reasons:

- normal play
- camera angle
- lighting
- occlusion
- crowding
- object movement
- staff movement

## False Negative Model

Missed detections can be recorded using source type `missed_event_report`.

Captured fields:

- camera
- zone
- approximate time
- expected event type
- reviewer notes
- optional evidence reference where legally allowed

Purpose:

- improve calibration
- identify weak zones
- avoid premature production activation

## Calibration Model

Calibration profiles can be scoped by:

- site
- garden
- camera
- zone
- event type

Tracked calibration fields:

- confidence threshold
- motion sensitivity
- inactivity duration threshold
- crowding threshold
- restricted area sensitivity
- reviewed events
- false positives
- false negatives
- last calibrated date
- calibration status

Statuses:

- `not_started`
- `collecting_data`
- `needs_review`
- `calibrated`
- `unstable`
- `paused`

No profile is promoted to production automatically.

## Readiness Score

`observer_pilot_readiness_score` is calculated from:

- reviewed events count
- false-positive rate
- false-negative rate
- reviewer agreement readiness
- camera stability
- model confidence stability
- zone coverage
- calibration maturity

Production activation remains blocked unless:

- enough events were reviewed
- false-positive rate is acceptable
- false-negative tracking is active
- camera health is stable
- legal mode is enforced
- parent raw visibility remains blocked

## Dashboards

Admin:

- `/dashboard/admin/observer-pilot`
- full pilot overview, safety gates, adapter readiness, calibration, datasets, and quality metrics

Manager:

- `/dashboard/garden/observer-pilot`
- simplified events requiring review, camera coverage, calibration status, and safety rules

Inspector:

- `/dashboard/inspector/observer-pilot`
- assigned garden signals, repeated anomalies, calibration state, and inspection recommendations

## Gan Batuach Israel Restrictions

Enforced for the pilot:

- no audio analytics
- no face recognition
- no biometric child profile
- no raw AI parent visibility
- no automatic accusations
- no automatic disciplinary actions
- no automatic parent notifications

Legal review required:

- contextual child association through skeleton
- soft biometric matching
- gait recognition
- persistent skeleton identity
- cross-day identity tracking

## Dataset Readiness

Pilot dataset records store aggregate review counts only:

- reviewed events
- confirmed events
- dismissed events
- uncertain events
- false positives
- false negatives

No raw video export should occur in Gan Batuach without explicit legal approval and documented DPIA controls.

## Remaining Production Requirements

- Configure a real pose inference endpoint or worker runtime.
- Run controlled frame sampling from home/demo cameras.
- Collect enough reviewed ground-truth events.
- Tune thresholds per camera and zone.
- Complete legal review for any contextual identity feature.
- Validate real gateway latency and health monitoring.
- Validate no parent raw AI visibility in production data.
- Complete external privacy, ISO, and penetration-test review before production observer activation.
