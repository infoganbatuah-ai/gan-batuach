# PILOT FIX 7 - AI Audit Logging Validation

## Existing / Observed

- AI camera event creation writes an audit log.
- AI camera event review actions write audit logs.
- Mock observer worker writes observer job logs.
- Capability blocks attempt to log capability audit events.

## Required Events

- Frame sampled
- Inference requested
- AI event created
- Event queued for review
- Event viewed
- Event reviewed
- Event dismissed
- False positive marked
- False negative / missed event marked
- Parent-safe summary created/published if ever enabled
- AI mode changed
- Capability enabled/disabled
- Threshold changed
- Provider error

## Gap

Viewing and settings-change audit coverage must be manually verified against the real Supabase schema and admin routes before any real AI pilot.

Do not log secrets or unnecessary raw frame content.

