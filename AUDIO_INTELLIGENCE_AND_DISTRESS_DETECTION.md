# Audio Intelligence and Distress Detection

## Purpose

This document defines the safe foundation for future audio-based safety indicators in Gan Batuach and the future standalone Digital Observer product.

Phase 4B is readiness only:

- No speech-to-text surveillance.
- No voice identification.
- No parent access to raw audio.
- No automatic accusations.
- No disciplinary conclusions.
- Human review is required before any action or escalation.

## Event Taxonomy

Audio observer events use careful wording. Each event is an indicator, not a conclusion.

- `prolonged_crying_indicator` - possible prolonged crying pattern.
- `distress_sound_indicator` - possible distress sound.
- `scream_indicator` - possible scream indicator.
- `repeated_distress_indicator` - repeated distress-like signal.
- `unusual_noise_indicator` - unusual sound compared with expected routine.
- `crowd_noise_spike` - sudden group noise increase.
- `argument_indicator` - possible argument-like audio pattern.
- `impact_sound_indicator` - possible impact, fall, or hit-like sound.
- `emergency_sound_indicator` - possible emergency sound indicator.

## Data Model

The `audio_observer_events` table stores only event metadata and review state.

Core fields:

- `site_id`
- `kindergarten_id`
- `camera_id`
- `event_type`
- `severity`
- `confidence`
- `review_status`
- `recommended_action`
- `reviewed_by`
- `reviewed_at`
- `notes`
- `audio_source_type`
- `audio_window_metadata`
- `keyword_config`
- `metadata`
- `created_at`
- `updated_at`

The table is prepared for future sources:

- camera microphone
- NVR audio stream
- DVR audio stream
- future audio gateway
- mock source

Raw audio paths should not be stored in event metadata. Future storage of short evidence clips must be explicit, access-controlled, audited, and retention-limited.

## Review Workflow

Audio events follow a human review workflow:

1. Audio indicator is created in mock or future provider mode.
2. Manager reviews the event.
3. Manager chooses one of:
   - reviewing
   - confirmed
   - dismissed
   - escalated
   - false positive
   - needs more data
4. Admin or inspector may review escalated items where permitted.
5. Parents are not shown raw audio indicators by default.

No event should automatically accuse a staff member, parent, child, or visitor.

## Dashboard Readiness

Manager page:

- `/dashboard/garden/audio-events`
- Shows audio indicator queue for the manager's kindergarten only.
- Allows mock event creation for QA.
- Allows human review actions.

Admin page:

- `/dashboard/admin/audio-events`
- Shows global audio event readiness.
- Shows category counts, review queue, false positives, and mock provider behavior.

## Privacy Model

Audio safety features are sensitive and must remain conservative.

Rules:

- No continuous listening product behavior without explicit consent.
- No speech-to-text in this phase.
- No keyword monitoring in this phase.
- No voice recognition.
- No voice profiling.
- No parent-facing raw audio review.
- No automatic disciplinary conclusions.
- Human review and audit trail are mandatory.

Future production use requires explicit consent from the kindergarten and staff, and parent consent where legally required.

## Keyword Readiness

The model includes `keyword_config` for future architecture only.

Future keyword detection must be separately approved and configured. It should support:

- explicit consent
- limited emergency phrase categories
- strict retention controls
- no open-ended conversation transcription
- audit logging

## Future Provider Roadmap

Possible future implementation paths:

- Local audio gateway for sound-level and anomaly detection.
- Edge model for scream/impact/distress indicators.
- Cloud provider for limited emergency audio classification only after consent.
- Optional keyword engine for approved emergency terms.

The first real implementation should prefer local or edge processing and avoid sending raw audio to external providers.

## Testing Scope

Current testing is mock-only:

- create mock audio event
- review event
- mark false positive
- escalate event
- verify manager garden isolation
- verify admin global view
- verify parents cannot access raw audio events

No real audio stream processing is implemented in this phase.
