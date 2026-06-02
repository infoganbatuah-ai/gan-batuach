# Safety Incident Detection Framework

This document defines the future safety incident detection framework for Gan Batuach.

This phase does not implement real violence detection, distress detection, audio analysis, disciplinary conclusions, or parent notifications from raw detections.

Everything remains human-review first.

## Core Principle

```text
Indicator
-> Human review
-> Confirm / Dismiss / Escalate
-> Notify wider audience only after confirmed workflow
```

The system must never:

- automatically accuse a child, parent, staff member, or kindergarten
- automatically release disciplinary conclusions
- notify parents from raw AI indicators
- expose evidence publicly
- score individual children

## Safety Incident Taxonomy

Supported future incident types:

- `distress_suspected`
- `violence_indicator`
- `aggressive_behavior_indicator`
- `prolonged_crying_indicator`
- `child_left_alone_indicator`
- `staff_absence_indicator`
- `unusual_crowding`
- `fall_suspected`
- `emergency_behavior_indicator`

Each event is phrased carefully as:

- suspected
- indicator
- requires review

## Severity Engine

Severity levels:

- LOW
- MEDIUM
- HIGH
- CRITICAL

The code stores lower-case values for compatibility:

- `low`
- `medium`
- `high`
- `critical`

Each event receives:

- `severity`
- `confidence_score`
- `recommended_action`
- `review_priority`
- `safety_category`

Review priority:

- `1`: immediate review
- `2`: high-priority review
- `3`: normal review
- `4`: low-priority review

## Review Workflow

```text
Event created
-> Manager review
-> Confirm / Dismiss / Escalate
-> Inspector/Admin if needed
-> Parent communication only after confirmed workflow
```

Manager actions:

- mark reviewing
- confirm after review
- dismiss
- escalate
- mark false positive
- mark valid detection
- mark needs more data

Admin:

- sees all incidents
- sees trends
- reviews escalations
- can run mock incidents

Inspector:

- sees only assigned kindergarten incidents
- can review/escalate within assigned scope

## Evidence Model

Prepared fields:

- `snapshot_url`
- `clip_url`
- `evidence_snapshot_paths`
- `evidence_clip_paths`
- `evidence_timeline`
- `evidence_notes`
- `review_notes`

Current phase:

- mock incidents only
- no public evidence access
- no raw stream exposure
- no parent evidence visibility

Future evidence access must use signed, scoped URLs.

## Dashboard Coverage

Manager:

- `/dashboard/garden/ai-events`
- incident queue
- safety categories
- priority review
- notes and review actions

Admin:

- `/dashboard/admin/ai-events`
- all incidents
- trends by category
- escalations
- mock event creation

Inspector:

- `/dashboard/inspector/ai-events`
- assigned incidents only
- review/escalation tools

## Safety Scoring Readiness

Safety scoring is kindergarten-level only.

Prepared signals:

- incident frequency
- resolution time
- repeated category patterns
- escalation count
- false-positive/valid-detection ratio

Forbidden:

- child scoring
- staff blame score
- automatic disciplinary score
- parent-facing raw score

## Future AI Hooks

Future integrations may include:

- violence detection
- distress detection
- crowd analysis
- fall analysis
- anomaly detection

Provider paths:

- local detector
- local YOLO/OpenCV
- private model endpoint
- future external AI only with explicit consent

No external provider is called in this phase.

## Notification Policy

Manager:

- immediate notification for HIGH / CRITICAL indicators

Admin:

- optional notification for high-risk or escalated indicators

Parents:

- only after confirmed workflow
- never from raw AI indicator
- never before human review

## Privacy and Safety Requirements

- No automatic accusations.
- No disciplinary conclusions.
- No parent notification without review.
- No public evidence.
- No child scoring.
- Evidence must be private and access-controlled.
- Every review action must record reviewer and timestamp.

## Testing Plan

Mock-only tests:

1. Admin creates `distress_suspected`.
2. Admin creates `violence_indicator`.
3. Manager sees own kindergarten incident.
4. Inspector sees assigned kindergarten incident.
5. Parent does not see raw incident.
6. Manager marks reviewing.
7. Manager confirms/dismisses/escalates.
8. Safety metrics update.
9. No parent notification is sent from raw event.
