# PILOT FIX 1 - Real Pilot Readiness Gates

Date: 2026-06-27

## Gate 1 - Build / Runtime

Must pass:

- `npm run typecheck`
- `npm run build`
- key routes load in target environment
- no critical runtime errors

## Gate 2 - Supabase / RLS

Must pass live target-environment tests:

- Parent A cannot see Parent B child.
- Parent cannot list all garden children.
- Manager sees only own kindergarten.
- Staff sees child/parent data only after approved assignment.
- Inspector sees assigned gardens only.
- Pending inspector sees no gardens.
- Admin access is role-protected and audited.
- Sensitive signed URLs are short-lived.
- Payment/provider data is restricted.

## Gate 3 - Legal / Privacy

Must be reviewed:

- Privacy Policy
- Terms
- child data notice
- camera notice
- AI notice
- data retention
- account deletion
- consent model
- staff document notice

## Gate 4 - Role Flows

Must pass:

- manager flow
- parent flow if included
- staff flow
- inspector flow
- admin flow
- wrong-role redirects/denials

## Gate 5 - Provider / Payments

Must define:

- manual/sandbox/live choice
- no fake live payment
- invoice/receipt policy
- webhook signing/idempotency if provider used
- parent tuition separate from platform subscription

## Gate 6 - Camera

Must pass if camera included:

- no RTSP exposure
- no credential exposure
- tokenized access
- audit logging
- parent viewing disabled unless every policy/legal/session condition passes

## Gate 7 - AI

Must pass if AI included:

- shadow mode only unless approved
- human review required
- no raw AI to parents
- no automatic accusations
- no face recognition/audio in Gan Batuach Israel Mode

## Gate 8 - Support / Operations

Must define:

- support contact
- incident owner
- escalation path
- rollback plan
- monitoring/provider health
- feature kill switches

readiness_gate_status = all_gates_required_before_real_pilot
