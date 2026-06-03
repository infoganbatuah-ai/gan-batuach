# Observer Custom Watch Requests

This document defines the custom watch request foundation for the Digital Observer.

This phase is mock/rule-based readiness only:

- No real AI execution
- No natural language AI parsing
- No automatic accusations
- No parent notifications from raw detections
- All triggered events are shadow-mode and require human review

## Use Cases

Examples:

- "שים לב לשער האחורי"
- "שים לב אם יש תנועה אחרי 22:00"
- "שים לב אם מישהו נכנס לאזור אסור"
- "שים לב אם המצלמה חסומה"
- "שים לב אם אין תנועה יותר מדי זמן"

## Data Model

Table:

- `observer_watch_requests`

Fields:

- site / kindergarten scope
- optional camera
- optional zone
- creator
- title
- description
- watch type
- active flag
- priority
- schedule JSON
- notification channels JSON
- human review requirement
- metadata

AI events can link back through:

- `ai_camera_events.watch_request_id`

## Watch Types

Supported deterministic types:

- `movement_in_area`
- `no_movement`
- `door_left_open`
- `person_near_object`
- `restricted_area_entry`
- `after_hours_activity`
- `camera_obstruction`
- `custom_text_instruction`

`custom_text_instruction` stores the user text for future interpretation. It is not parsed by AI in this phase.

## Rule Translation

Helper:

- `lib/domain/observer-watch-request-engine.ts`

Purpose:

```text
watch request
↓
deterministic rule input
↓
observer job context
↓
shadow ai_camera_event
↓
human review
```

Example:

```text
after_hours_activity
↓
schedule outside routine
↓
motion/person detection context
↓
review-only event
```

## Schedule Rules

Supported schedule modes:

- always active
- business hours
- night only
- custom days/hours

Timezone should come from:

- observer site timezone
- kindergarten timezone / default `Asia/Jerusalem`

## UI Readiness

Admin:

- `/dashboard/admin/observer-watch`

Manager / owner:

- `/dashboard/garden/observer-watch`

Parents cannot create raw AI watch requests.

## Mock Trigger Behavior

Trigger mock creates:

- `ai_camera_event`
- `watch_request_id`
- `shadow_mode = true`
- `requires_human_review = true`
- `parent_visible = false`
- detector provider `watch_request_mock`

No parent notification is created.

## Notification Policy

Raw watch request detections:

- manager/admin/site owner review only

Confirmed watch request events:

- future notifications can go to manager/site owner/admin according to request settings
- parent notification requires explicit reviewed/approved parent-safe workflow

## Safety Limitations

The observer must use careful language:

- suspected
- indicator
- requires review
- recommended action

Avoid:

- automatic accusations
- certainty claims
- disciplinary conclusions
- parent-facing raw AI outputs

## Future NLP / AI Work

Future natural language support may:

- parse custom instructions
- map them to zones, schedules and event types
- estimate ambiguity
- ask clarifying questions

Before enabling NLP:

- consent model must be complete
- data minimization policy must be approved
- human review must remain required
- safety prompts and audit logging must be in place
