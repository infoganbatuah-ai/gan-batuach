# PILOT FIX 7 - AI Retention / Privacy Validation

## Current Status

Retention readiness exists, but policy signoff is still required.

## Evidence

- Shadow calibration migration marks raw frame persistence/logging as false.
- Security classification migration marks `ai_camera_events` as regulated AI observer data with audit and retention requirement.
- PILOT FIX 3 data retention draft exists and must be externally reviewed.

## Data Types

- Raw frames: must not be stored by default.
- Frame references: private only, no public URLs.
- AI event metadata: internal and scoped.
- Review decisions: retained for calibration/audit according to approved policy.
- Evidence previews: private and access-controlled only.
- Model logs: no secrets, no unnecessary sensitive frame content.
- Audit logs: retained according to legal/security policy.
- Parent-safe summaries: only reviewed and approved, if ever enabled.
- Digital Observer events: separate product context and retention profile.

## Blocker

`ai_retention_policy_required` remains open until retention periods and deletion/legal-hold rules are approved.

