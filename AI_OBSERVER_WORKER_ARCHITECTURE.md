# AI Observer Worker Architecture

Phase 2D creates the worker foundation for the Gan Batuach Digital Observer.

This phase does not process real child video, does not connect external AI providers, and does not make automatic accusations. All detections are mock detections for architecture and workflow testing only.

## Pipeline

Camera
-> Video Gateway
-> Observer Job Queue
-> Frame Sampler
-> Detection Engine Interface
-> Event Rules Engine
-> AI Camera Event
-> Notification

## Worker Tables

### `observer_workers`

Tracks worker identity and health:

- `status`
- `worker_type`
- `last_seen_at`
- `last_run_at`
- `failure_reason`
- `metadata`

Phase 2D seeds a `Mock Observer Worker`.

### `observer_jobs`

Queue table for observer work:

- `status`: `queued`, `running`, `completed`, `failed`, `retrying`, `cancelled`
- `priority`
- `retry_count`
- `max_retries`
- `cooldown_until`
- `scheduled_for`
- `started_at`
- `completed_at`
- `failure_reason`
- `result_event_id`
- `metadata`

### `observer_job_logs`

Operational logs for each job:

- `level`
- `message`
- `failure_reason`
- `metadata`

### `camera_zones`

Readiness table for camera zones:

- `classroom`
- `playground`
- `entrance`
- `exit`
- `sleeping_area`
- `restricted_area`
- `bathroom_entrance`
- `kitchen`
- `yard`

No drawing UI is implemented yet. `polygon` is future metadata.

### `observer_rules`

Rules for mock/future detections:

- `camera_offline`
- `person_in_restricted_area`
- `child_missing_from_area`
- `fall_suspected`
- `crowding_suspected`
- `door_open`
- `pickup_mismatch`
- `audio_anomaly`
- `keyword_detected`

Each rule supports:

- `enabled`
- `severity`
- `threshold`
- `cooldown_seconds`
- `priority`
- `last_triggered_at`
- `metadata`

## Job Lifecycle

1. Admin requests a mock run from `/dashboard/admin/ai-observer`.
2. `POST /api/admin/ai-observer/run-mock-job` creates an `observer_jobs` row.
3. The mock processor marks the job `running`.
4. The mock frame sampler writes a log. It does not read real video.
5. The mock detection engine returns a simulated detection.
6. The rule engine checks:
   - enabled rule
   - confidence threshold
   - cooldown
   - dedupe key
7. If allowed, the worker creates an `ai_camera_events` row.
8. Urgent/high/critical mock events notify manager/admin only.
9. The job becomes `completed` or `failed`.

## Detection Engine Interface

Implemented file:

`lib/domain/ai-observer/detection-engine.ts`

Future providers:

- OpenAI Vision
- Gemini Vision
- Azure Vision
- YOLO
- Custom model

Current provider:

- `mock`

The mock provider returns careful, review-first detections only.

## Rule Engine

Implemented file:

`lib/domain/ai-observer/rule-engine.ts`

The rule engine returns:

- `allow`
- `suppressed: rule_disabled`
- `suppressed: below_threshold`
- `suppressed: cooldown`

Dedupe keys include kindergarten, camera, zone, rule and time bucket.

## Safety Limitations

Phase 2D intentionally does not:

- Process real video.
- Sample real frames.
- Record clips.
- Store real snapshots.
- Connect AI providers.
- Notify parents.
- Make automatic accusations.

Events use careful language such as suspected, indicator and requires review.

## Permissions

- Admin controls worker jobs and rules.
- Manager/owner sees only own kindergarten `ai_camera_events`.
- Inspector sees only assigned kindergarten events.
- Parent sees no raw AI events.
- No raw stream URLs, RTSP credentials, snapshots or clips are exposed.

## Future Real AI Integration

Before real AI is connected:

1. Connect Video Gateway stream access through server-only credentials.
2. Add signed worker stream URLs.
3. Implement frame sampling with retention controls.
4. Connect one detection provider behind the interface.
5. Add storage for protected snapshots/clips.
6. Confirm consent, privacy and legal review.
7. Run pilot in shadow mode before real alerting.

## Test Checklist

- Create mock observer job.
- Process mock job.
- Create mock `ai_camera_events` row.
- Confirm manager sees only own event.
- Confirm admin sees worker logs.
- Confirm cooldown suppresses repeated events.
- Retry failed mock job.
- Confirm parents do not see raw events.
