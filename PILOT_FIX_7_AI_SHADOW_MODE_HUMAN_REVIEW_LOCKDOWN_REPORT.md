# PILOT FIX 7 - AI Shadow Mode Human Review Lockdown Report

Date: 2026-07-04

## Final Recommendation

`AI_SHADOW_READY_WITH_SYNTHETIC_DATA`

AI is not approved for real child data, real stream inference, production inference, raw parent alerts, or parent summaries. Parent raw AI is blocked. Human review remains required.

## Summary

- AI pilot policy: created.
- Capability matrix: created.
- Provider status: readiness/mock only; no real provider, endpoint, key, or frame source configured.
- Secret/evidence audit: no AI provider secret values printed or found in app-facing files; parent broad AI read permission removed.
- Shadow mode: enforced in mock/local worker paths.
- Human review queue: internal only; parents excluded.
- Parent visibility: raw AI blocked; approved summaries only if reviewed and parent-approved.
- Manager access: own-kindergarten scoped by route logic; manual negative test required.
- Staff access: disabled by default; staff lacks AI read permission.
- Inspector access: assignment-scoped for review action; manual negative test required.
- Admin operations: redacted operational status only; no secrets.
- Legal mode: audio, face, biometric, raw AI parent alerts, automatic decisions and automatic accusations remain disabled/restricted.
- Event wording: softened to candidate/review language.
- False positive/negative tracking: schema/readiness exists; real calibration process still needs verification.
- Retention/privacy: retention draft exists; external review still required.
- Audit logging: creation/review logging exists; full view/settings audit must be verified.
- Feature flags/kill switches: required for real pilot.
- Digital Observer separation: architecturally separated; manual RLS proof still required.
- Negative access tests: static checks performed; real Supabase tests manual-required.

## Fixes Made

- Removed parent `ai_events:read` from `lib/roles.ts`.
- Softened active AI event labels in `lib/domain/ai-digital-observer.ts`.
- Softened safety incident wording in `lib/domain/safety-incident-framework.ts`.

## Current AI Status

- Real inference connected: no
- Real stream inference connected: no
- Test inference configured: no
- Shadow mode with synthetic/mock data: ready for internal validation
- Parent raw AI visibility: blocked
- Production AI: blocked

## Blockers

Critical blockers: 0 after safe fixes.

High blockers: 7.

Primary open blockers: provider/frame source missing, legal/privacy signoff missing, real Supabase/RLS negative tests missing, retention signoff missing, formal feature flags/kill switches not fully verified, full audit coverage not verified, Digital Observer separation not manually proven.

## Next Phase

It is safe to proceed to `PILOT FIX 8 - Provider, Payment & Notification Pilot Mode Closure`.

It is not safe to enable real AI, raw AI parent visibility, parent AI summaries, face recognition, audio analytics, or automatic AI actions.

