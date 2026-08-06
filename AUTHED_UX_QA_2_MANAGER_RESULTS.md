# AUTHED UX/UI QA 2 - Manager Results

Status: BLOCKED_AUTH_SESSION_SWITCH

## Reason

The demo Manager account exists in seed data, but the browser session remained authenticated as Parent. The login form was not available after the Parent session, and a safe session switch to Manager was not completed.

## What Was Not Accepted

- Manager dashboard
- Kindergarten profile/card
- Onboarding
- Children list
- Attendance
- Schedule
- Enrollment requests
- Invitations
- Staff management
- Finance/payments
- Documents/reports
- Cameras
- Subscription/payment state

## Product Reality Regression Status

Static code verification confirms the Manager dashboard no longer uses:

- hardcoded `25 במאי 2025`
- fake `24` children fallback
- fake `5 מתוך 6` staff fallback
- fake `07:45` update time

Runtime authenticated Manager acceptance is still required.
