# PILOT FIX 7 - Staff AI Access Validation

## Default

Staff AI access is disabled.

## Current Permission Status

Staff does not have `ai_events:read` in `lib/roles.ts`.

## Staff Must Not

- See review queue by assignment alone.
- See raw AI events.
- See confidence scores.
- See raw evidence involving children unless a future policy explicitly allows a reviewed workflow.
- Receive automatic AI accusations.
- Receive raw AI alerts.

## Pilot Status

Staff AI is blocked for the first controlled pilot unless a separate policy, legal, RLS, and audit gate is approved.

