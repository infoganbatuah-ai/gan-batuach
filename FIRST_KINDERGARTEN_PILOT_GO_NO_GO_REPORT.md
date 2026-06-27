# First Kindergarten Pilot Go / No-Go Report

Date: 2026-06-27

## Decision

Decision: `INTERNAL_DEMO_ONLY`

Equivalent real-user decision: `NO_GO` for onboarding real parents, real children, real staff documents, real camera streams or live AI.

## Why

The application is strong enough for an internal end-to-end demo using synthetic data, but it is not yet safe to run a real kindergarten pilot with real families because the live security/provider/camera/AI gates are not fully proven.

## Ready For Internal Demo

- Public/auth journey.
- Role dashboards for parent, manager, staff, inspector and admin.
- Kindergarten manager approval/onboarding flow.
- Parent child/enrollment flow with demo data.
- Staff candidate/assigned-state flows with demo data.
- Inspector assignment/inspection readiness with demo data.
- Admin provider readiness visibility.
- In-app notification/readiness surfaces.
- Payment/subscription lifecycle as manual/sandbox/readiness state.

## Not Ready For Real Pilot

- Live Supabase/RLS negative tests are not documented as passed in the target environment.
- Payment/invoice providers are not configured/tested with sandbox credentials and signed provider webhooks.
- External email/SMS/WhatsApp/push are not verified for approved test recipients.
- Demo/freeze automation requires scheduler verification in the deployment environment.
- Camera gateway is not proven with a real connected camera, tokenized viewing and audit logs.
- AI is not proven with real inference and must remain mock/shadow/readiness only.
- Legal/privacy/camera/AI consent notices require final review.

## Allowed Pilot Mode

Allowed now:

- Internal demo only.
- Synthetic users and synthetic child data.
- No real payment.
- No production invoice.
- No production external messages.
- No parent camera view.
- No real AI inference exposure.
- Admin may review provider readiness only.

## Next Required Phase

Recommended next phase before any real pilot:

1. Supabase live RLS/JWT role isolation verification.
2. Provider sandbox credential setup and signed webhook tests.
3. Demo/freeze scheduler activation test.
4. Support and incident-response readiness.
5. Legal/privacy/camera/AI notice review.

Only after those pass should the decision move to `PILOT_WITHOUT_CAMERA_AI` or `PILOT_WITH_SANDBOX_PAYMENTS_ONLY`.
