# Skeleton Analytics, Motion Intelligence & Anonymous Observer Platform

## Purpose

Phase 152 creates the legal motion-intelligence layer for Digital Observer and Gan Batuach Israel Mode.

For Gan Batuach, this is the allowed AI path:

- pose estimation
- skeleton analytics
- motion anomaly detection
- fall suspected detection
- inactivity suspected detection
- crowding suspected detection
- restricted area presence detection

The platform does not use face recognition, audio processing, raw child biometric profiles, automatic accusations or disciplinary automation.

## Pose Extraction Architecture

Prepared providers:

- YOLOv8-Pose
- MediaPipe Pose
- future pose models

Input:

- camera frame
- gateway snapshot
- zone context
- camera UUID
- room or zone UUID

Output:

- anonymous skeleton UUID
- skeleton keypoints
- confidence score
- timestamp
- camera UUID
- garden UUID
- zone UUID

Raw camera frames are not stored by default. Runtime adapters must wipe raw frame buffers after keypoint extraction.

## Skeleton Data Model

Table:

```text
skeleton_observer_events
```

Stores:

- anonymized skeleton UUID
- camera_id
- garden_id
- zone_id
- observer_site_id
- keypoint metadata
- skeleton sequence metadata
- confidence
- event timestamp
- event type
- review status
- retention date

Does not store:

- face image
- facial embedding
- raw audio
- child name
- parent name
- direct identity fields

Database constraints enforce:

- `parent_visible = false`
- `raw_frame_stored = false`
- `face_data_present = false`
- `audio_data_present = false`
- `identity_fields_present = false`

## Keypoint Schema

Supported keypoints:

- nose / head reference
- shoulders
- elbows
- wrists
- hips
- knees
- ankles

Each keypoint is stored as:

```json
{ "x": 0.42, "y": 0.31, "confidence": 0.91 }
```

JSONB storage is used only for necessary metadata and short-retention event evidence.

## Motion Anomaly Model

Code:

```text
lib/domain/observer/skeleton-motion-engine.ts
```

Supported outputs:

- `fall_suspected`
- `inactivity_suspected`
- `high_velocity_motion`
- `crowding_suspected`
- `supervision_attention_required`
- `restricted_area_presence`
- `unusual_motion_pattern`
- `person_down_suspected`

Language rules:

- Use “motion anomaly”, “requires review”, “suspected fall”, “unusual movement”.
- Do not use “violence happened”.
- Do not say “staff hurt child”.
- Do not say “child is in danger”.

## Fall Detection Readiness

Prepared signals:

- sudden drop in center of mass
- horizontal body orientation
- low movement after drop
- duration above threshold

Output:

```text
fall_suspected
```

Human review is mandatory.

## Inactivity Detection Readiness

Prepared signals:

- skeleton remains static
- low joint velocity
- horizontal or isolated body posture
- duration threshold exceeded

Output:

```text
inactivity_suspected
```

This is not a neglect accusation.

## High Velocity Motion Readiness

Prepared signals:

- extreme limb velocity
- sudden acceleration
- sudden stop or impact-like vector
- secondary skeleton displacement

Output:

```text
high_velocity_motion
```

This must not be labeled as violence without human review.

## Crowding & Supervision Readiness

Prepared signals:

- skeleton count per zone
- density threshold
- restricted area crowding
- zone-level supervision attention

Outputs:

- `crowding_suspected`
- `supervision_attention_required`

## Zone-Based Safety Rules

Integrated with:

- camera zones
- restricted areas
- classroom zones
- playground zones
- entrance and exit zones
- sleeping area zones

Signals are meaningful only with zone context.

## ST-GCN / Temporal Graph Readiness

Future input:

```text
sequence of anonymous skeleton frames over time
```

Future output:

- anomaly type
- confidence
- supporting movement features
- review recommendation

Future models:

- ST-GCN
- LSTM
- temporal graph analysis
- action recognition

No real model training or production promotion is included in this phase.

## Gan Batuach Israel Mode Restrictions

Allowed:

- pose estimation
- skeleton analytics
- motion analytics
- fall detection
- inactivity detection
- crowding detection
- restricted area detection

Disabled:

- face recognition
- audio analytics
- speech recognition
- keyword detection
- biometric face matching
- raw identity tracking

Legal review required:

- gait recognition
- persistent skeleton identity
- contextual child matching
- soft biometric matching

## Contextual Child Association

Status:

```text
legal_review_required
```

Prepared table:

```text
observer_ephemeral_context
```

Possible future signals:

- child check-in context
- room assignment
- temporary clothing color metadata
- temporary height estimate
- temporary skeleton proportion estimate
- daily ephemeral context

Rules:

- no permanent child biometric profile
- no cross-day persistent identity
- no face data
- no audio data
- no raw image storage
- temporary context expires daily
- not exposed to parents
- not used without policy approval

## Observer Signal Output

Every review-worthy skeleton event creates:

```text
observer_intelligence_signal
```

With:

- `signal_type = skeleton_motion`
- `source_type = skeleton_motion`
- `review_required = true`
- `parent_visible = false`
- safe recommended action

No parent notification is generated automatically.

## Human Review Workflow

Lifecycle:

```text
detected
→ pending_review
→ reviewing
→ dismissed / confirmed / needs_followup
→ task / inspection / incident if approved
→ resolved / closed
```

No automatic escalation without human review.

## Parent-Safe Summary Boundary

Parents may see:

- reviewed and approved summaries only

Parents may not see:

- raw skeleton events
- raw AI signals
- unreviewed anomalies
- internal confidence scores

## Privacy & Retention

Prepared controls:

- short retention for raw skeleton event data
- longer retention for reviewed summaries
- legal hold only when linked to incident or investigation
- anonymization required
- parent visibility blocked by default

## AI Governance Integration

Integrated with:

- AI Governance Center
- DPIA registry
- AI capability registry
- vertical capability matrix
- Digital Observer Core profile

Every skeleton capability has:

- legal status
- privacy status
- review policy
- enabled verticals
- parent visibility boundary

## Remaining Gaps

- Runtime YOLOv8-Pose and MediaPipe production adapters still need deployment wiring.
- ST-GCN and temporal models are architecture-ready only.
- No real model training is included.
- Contextual child association is disabled pending legal review.
- Browser/mobile review UX can be expanded for manager and inspector role-specific queues.
