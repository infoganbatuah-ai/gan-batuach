# First Real Kindergarten Pilot Deployment

Status: readiness package only. This document does not approve production usage, legal compliance, camera parent viewing, AI parent visibility, or real data ingestion.

## Pilot Goal

Prepare Gan Batuach for one controlled real-kindergarten pilot with a named kindergarten, named support owner, clear legal/privacy/security gates, limited data scope, and human-reviewed operations.

The pilot must remain in `pilot_mode` until all blocking gates are approved.

## Pilot Gates

Required before `active_pilot`:

- Admin approval for the selected kindergarten and pilot owner.
- External legal/privacy readiness review.
- Security readiness review and critical blocker review.
- Pilot agreement, privacy notice, parent notice, staff notice, camera notice, AI/observer notice, support terms, and data processing terms.
- Manager onboarding readiness.
- Parent communication readiness.
- Support plan readiness with daily review cadence.

The database trigger `enforce_first_pilot_activation_gates` blocks `active_pilot` when required blocking gates are missing or not approved.

## Pilot Mode Rules

- Extra monitoring and issue review are enabled.
- Risky features are disabled by default.
- Parent AI visibility is disabled by default.
- Parent camera viewing is disabled unless explicitly approved.
- Observer runs in shadow mode only.
- No automatic parent notification from AI.
- No automatic disciplinary, regulatory, or safety conclusions.
- Support/admin monitoring remains active throughout the rollout.

## Pilot Data Policy

Default posture:

- Test data: allowed.
- Real kindergarten data: blocked until approval.
- Parent data: blocked until parent notice and opt-in workflow are approved.
- Child data: blocked until legal/privacy approval.
- Medical data: blocked until encryption, audit, and explicit approval are validated.
- Camera data: blocked until camera law review and camera policy approval.
- AI processing: blocked until legal mode, shadow mode, and review workflow are approved.
- Staff data: blocked until staff notice and document workflow are approved.
- Payment data: sandbox/test only until payment and invoice review is complete.

## Onboarding Workflow

Manager pilot onboarding:

1. Credentials are issued in controlled mode.
2. Manager changes password.
3. MFA is completed where required.
4. Kindergarten profile is completed.
5. Age groups are configured.
6. Staff are added.
7. Children are added only after data approval.
8. Parents are invited only after parent notice approval.
9. Required documents are uploaded.
10. Payment configuration remains sandbox/test until approved.
11. Pilot mode limitations are explained.

Staff pilot onboarding:

1. Invitation received.
2. Password changed.
3. MFA completed where required.
4. Profile completed.
5. Required documents uploaded.
6. Daily workflow training completed.
7. GPS attendance readiness validated.
8. Child update and incident reporting readiness validated.

Parent pilot onboarding:

1. Invitation received after legal/privacy readiness.
2. Password changed.
3. MFA completed where required.
4. Child registration completed where approved.
5. Pickup contacts configured.
6. Payment flow explained.
7. Notification preferences configured.
8. Privacy boundaries explained.

## Training Workflow

Training tracks:

- Manager training.
- Staff training.
- Parent guidance.
- Inspector guidance.
- Admin/support training.

Each track records completion date, trainer, notes, and issues raised.

## Support Workflow

Pilot support categories:

- Onboarding issue.
- Login issue.
- Parent issue.
- Staff issue.
- Camera issue.
- Payment issue.
- Document issue.
- Notification issue.
- AI/observer issue.
- Bug report.
- Feature request.

Daily support review should triage critical and high issues first.

## Camera Pilot Rules

If cameras are included:

- Gateway must be configured.
- No RTSP URL or camera credentials may be exposed to the browser.
- Viewing tokens must be short-lived and audited.
- Parent viewing remains disabled unless externally approved.
- Camera access is role-scoped and time-scoped.
- Observer runs in shadow mode only.

If cameras are not ready, mark them as a future pilot phase.

## Observer Pilot Rules

If observer is included:

- Shadow mode must be active.
- Human review queue must be active.
- No raw AI events are visible to parents.
- No automatic escalation.
- Gan Batuach Israel Mode is enforced.
- Skeleton/motion only for Gan Batuach.
- False positive and false negative tracking are active.

## Payment Pilot Rules

- Gan Batuach subscription flow may be tested in sandbox/test mode.
- Parent-to-kindergarten payment flow may be tested in sandbox/test mode.
- Live payment mode requires explicit provider, legal, and billing approval.
- No raw card data may be stored.
- Invoice generation must be audited if enabled.

## Daily Health Check

Daily checks:

- Manager logged in.
- Staff used system.
- Parents used system.
- Documents uploaded.
- Child updates created.
- Messages sent/read.
- Support issues reviewed.
- Critical blockers checked.

## Success Metrics

Track:

- Manager activation complete.
- Staff activation rate.
- Parent activation rate.
- Daily active users.
- Child update completion.
- Parent message open rate.
- Support ticket volume.
- Unresolved critical issues.
- Satisfaction score.

## Exit Criteria

The pilot may be marked completed only when:

- No critical blockers remain.
- Manager workflow works.
- Staff workflow works.
- Parent workflow works.
- Support workflow works.
- Privacy boundaries are validated.
- Security blockers are resolved.
- Feedback is collected and reviewed.
- Next action is decided.

## Remaining Pilot Blockers

- External legal/privacy approval is still required.
- External security review and penetration-test readiness must be reviewed.
- Real kindergarten identity and pilot agreement must be finalized.
- Parent and staff notices must be approved.
- Live payment/provider modes must remain disabled until approved.
- Parent camera viewing and parent AI visibility remain disabled by default.
