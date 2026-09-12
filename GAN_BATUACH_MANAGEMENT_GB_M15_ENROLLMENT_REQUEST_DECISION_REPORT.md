# GB-M15 — Enrollment Request & Garden Decision Lifecycle

## Before State

The existing request table and Inbox allowed unrestricted status patches and could activate a Child directly from the Garden decision route. Approval and capacity reservation were not one transaction.

## Canonical Request Model / Status Lifecycle

The existing `kindergarten_enrollment_requests` table remains canonical. It now records canonical Classroom, review, information exchange, reservation and cancellation fields. Central RPCs guard submitted, review, information-required, resubmitted, awaiting-payment, waitlisted, rejected, cancelled and expired transitions.

## Parent Submission

Submission validates the GB-M07 guardian link, verified contact, active enrollment conflicts, Garden publication/enrollment state and canonical Classroom age compatibility. An advisory lock and partial unique index make retries duplicate-safe.

## Garden Inbox / Information Required

The existing Inbox uses explicit safe fields, active canonical Classrooms and the central decision RPC. Managers can request information; the authorized Parent response moves the same request to resubmitted and preserves timestamps/history.

## Approval / Classroom / Capacity / Reservation

Approval locks the request and Classroom, validates Garden and age scope, calls the GB-M12 atomic reservation primitive, and changes the request to `awaiting_payment`. It does not create or activate an Enrollment. Retry returns the existing reserved result. Competing final-seat approvals inherit the GB-M12 row lock and capacity conflict.

## Rejection / Waitlist / Cancellation

Rejection and waitlist preserve the request. Waitlist consumes no seat. Parent or Garden cancellation releases a request-owned active reservation atomically and preserves audit history.

## Staffing Policy Readiness

Approval returns GB-M13 projected staffing readiness. Missing Production policy remains `policy_not_configured` and does not become a fabricated legal rejection.

## Invitation Compatibility / Notifications

Garden invitations now converge into a submitted canonical request and no longer activate a Child immediately. Request and decision events use the existing notification and audit tables; provider delivery is not claimed.

## APIs / RLS / Security

Parent APIs list only requests for canonical authorized Children and provide submit, information response and cancellation. Garden APIs use the active Garden context and `can_manage_garden`. Elevated SQL functions recheck actor, Child, Garden, Classroom and transition scope.

## Tests

Focused tests cover transitions, duplicate submission, Child/Garden IDOR controls, age/Classroom checks, approval/reservation, cancellation release, invitation convergence and no premature activation. Live QA requires controlled Parent and Manager identities.

## Live QA

`LIVE ENROLLMENT REQUEST QA: BLOCKED BY ENVIRONMENT` — no controlled Parent and Garden Manager identities are configured for a non-customer destructive workflow.

## Migration / Production Verification

Migration `20260912040000` is additive, rewrites only the two superseded status names, replaces the old all-history uniqueness rule with one active Child/Garden request, and updates GB-M14 discovery compatibility. Production application and post-deployment verification are release gates after merge.

## Remaining Debt / Inputs For GB-M16

GB-M16 must consume the existing reservation during idempotent payment/manual activation, create the active Enrollment atomically and close conflicting pending requests without deleting history.
