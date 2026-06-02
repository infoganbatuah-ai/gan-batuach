# AI Observer Privacy And Safety

The AI Digital Observer is designed as a safety assistance layer, not an automatic accusation system.

Phase 2C does not process real child video, does not call external AI providers, and does not record real clips. It creates the data model, review flow, permissions, mock event workflow, and safety boundaries for future implementation.

## Core Safety Principles

- Human review is required before escalation.
- Events use careful language such as suspected, indicator, and requires review.
- Parents do not see raw AI events by default.
- No automatic accusations are made against children, parents, staff, or visitors.
- Access is role-scoped and kindergarten-scoped.
- Sensitive minors data must be minimized, protected, and retained only as needed.

## Consent

Before real observer processing is enabled, each kindergarten must have:

- Clear consent and policy configuration.
- Parent-facing disclosure where legally required.
- Staff disclosure where legally required.
- Camera-specific eligibility controls.
- Admin-level auditability.

## Minimal Data

The system should store only what is necessary for review:

- Event type.
- Camera/kindergarten reference.
- Time window.
- Severity.
- Short description.
- Optional confidence score.
- Optional protected snapshot/clip when recording is enabled.

Raw frames should not be stored unless an event requires review and retention policy allows it.

## Retention

Future clip and snapshot retention must be explicit:

- Default retention should be short.
- Retention days should be stored per event or policy.
- Expired clips/snapshots should be deleted or made inaccessible.
- Legal hold or admin override must be audited.

## Human Review

Reviewers may:

- Mark event as reviewing.
- Confirm after review.
- Dismiss as not relevant.
- Escalate to admin/inspector.
- Add review notes.

Review decisions are stored in `ai_camera_events`:

- `status`
- `review_notes`
- `reviewed_by`
- `reviewed_at`
- `escalated_to_role`

## Parent Visibility

Parents should not see raw observer events.

Parent-facing updates are allowed only when:

- A human reviewer approved the update.
- The wording is safe, calm, and non-technical.
- The update is scoped to the parent's own child/kindergarten.
- No unrelated child, staff, parent, or camera detail is exposed.

## Access Control

Expected access:

- Admin: all AI observer events.
- Manager/Owner: only own kindergarten events.
- Inspector: only assigned kindergarten events.
- Parent: no raw AI observer events.
- Staff: no raw AI observer events unless a future policy explicitly allows a limited assigned workflow.

Clip and snapshot access must be protected by signed URLs or a secure API. Storage buckets should remain private.

## Audit Logs

The system should audit:

- Mock event creation.
- Future worker-created events.
- Review status changes.
- Escalation.
- Parent visibility changes.
- Clip/snapshot access when implemented.
- Policy or retention changes.

## Sensitive Minors Policy

Because the system works around minors:

- Avoid unnecessary identification.
- Avoid exposing images outside authorized roles.
- Avoid automated conclusions.
- Avoid broad sharing.
- Keep event language neutral.
- Keep data retention short and purposeful.
- Require human review before any parent-facing or disciplinary step.

## Production Readiness Notes

Before real AI/video processing:

- Confirm legal consent flow.
- Confirm private storage and signed access.
- Confirm gateway stream isolation.
- Confirm RLS policies in production.
- Confirm notification deduplication.
- Confirm audit logging.
- Run a privacy review with real operational stakeholders.
