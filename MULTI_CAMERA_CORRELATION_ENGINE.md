# Multi Camera Correlation Engine

## Purpose

The Multi Camera Correlation Engine prepares the Digital Observer to connect related events across multiple cameras and sensors into one reviewable timeline.

This phase is mock/readiness only:

- No identity recognition.
- No biometric tracking.
- No accusations.
- No child profiling.
- No staff profiling.
- No automatic parent notifications.
- Human review remains required.

## Timeline Architecture

The core model is:

1. Source event is created by a camera, audio indicator, pickup flow, watch request or safety framework.
2. Correlation engine links related source events.
3. `observer_correlated_events` stores the parent correlated event.
4. `observer_correlated_event_links` stores each timeline step.
5. Manager/admin reviews the combined event.

Example:

```text
Camera A event
↓
Camera B event
↓
Audio indicator
↓
Single correlated timeline
↓
Human review
```

## Event Correlation

Supported source link types:

- `ai_camera_event`
- `audio_observer_event`
- `safety_incident`
- `pickup_event`
- `watch_request_event`
- `camera_health`
- `mock`

Supported correlation types:

- multi-camera timeline
- cross-camera confirmation
- audio/video correlation
- pickup path correlation
- watch request correlation
- safety event correlation
- camera health correlation
- mock correlation

## Movement Path Readiness

The engine can store:

- entry zone
- intermediate zones
- destination zone
- involved cameras
- involved zones

This is event correlation only. It is not identity tracking and must never be presented as a person-specific path unless a future consented, reviewed feature explicitly supports it.

## Confidence Model

Confidence is deterministic in this phase:

- Multiple camera confirmations increase confidence.
- Multiple sensor types increase confidence.
- Single-camera-only events receive a small confidence penalty.
- Source event confidence contributes to the average.

Confidence is an advisory review signal. It does not trigger enforcement or parent messaging.

## Multi-Sensor Correlation

The model is ready to combine:

- video events
- audio events
- safety events
- pickup events
- watch request events
- camera health events

Future real correlation should consume only permission-safe, reviewed or shadow-mode events.

## Review Workflow

Correlated event statuses:

- open
- reviewing
- confirmed
- dismissed
- escalated
- false positive
- needs more data

Human review is required before escalation or any wider notification.

## Privacy Protections

Hard boundaries:

- No face recognition.
- No biometric tracking.
- No identity tracking.
- No child profiling.
- No staff profiling.
- No automatic accusations.
- No automatic parent notifications.

The UI and metadata must describe correlation as event-level only.

## Future Expansion

Future phases may add:

- real gateway event ingestion
- time-window clustering
- camera adjacency maps
- zone transition rules
- learning-engine confidence adjustment
- inspector review for escalated correlations

All future expansion must preserve human review and consent boundaries.
