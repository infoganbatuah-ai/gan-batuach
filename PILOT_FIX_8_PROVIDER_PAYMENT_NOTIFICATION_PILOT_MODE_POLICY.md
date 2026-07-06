# PILOT FIX 8 - Provider, Payment & Notification Pilot Mode Policy

Date: 2026-07-05

## Status

This policy keeps the first controlled pilot in safe provider modes only. No live payment, production invoice, production SMS, production WhatsApp, production email, or production push mode is approved by this phase.

## Provider Categories

| Category | Allowed pilot modes | Default pilot recommendation | Live mode status |
|---|---|---|---|
| Payment | disabled, mock, readiness, manual, sandbox | manual or sandbox only | blocked without explicit approval |
| Invoice | disabled, mock, readiness, manual, sandbox | manual or sandbox only | blocked without explicit approval |
| Email | disabled, mock, test, limited approved sends | test or approved pilot-only | blocked by default |
| SMS | disabled, mock, test | disabled or test only | blocked by default |
| WhatsApp | disabled, mock, test | disabled or test only | blocked by default |
| Push | disabled, readiness, test device only | readiness or test device only | blocked until native QA |
| Supabase | configured environment only | keep RLS verification required | live data blocked until RLS signoff |
| Vercel | environment-scoped deploys | demo/staging only for pilot prep | production blocked |
| Camera gateway | per PILOT FIX 6 | no parent viewing | parent viewing blocked |
| AI provider | per PILOT FIX 7 | readiness or shadow only | production AI blocked |
| Digital Observer providers | separated by product context | manual/sandbox/readiness | live billing blocked |

## Mandatory Rules

- Do not activate live payments.
- Do not collect real card payments.
- Do not issue real invoices.
- Do not send production SMS, WhatsApp, email, or push messages.
- Do not expose provider secrets in UI, reports, screenshots, logs, or client bundles.
- Do not mix Gan Batuach subscription, parent tuition, and Digital Observer billing streams.
- Do not treat provider readiness as production readiness.

## First Pilot Recommendation

The first controlled pilot should run with:

- Gan Batuach subscription: manual or sandbox.
- Parent tuition: manual/off-platform unless separately approved.
- Digital Observer billing: readiness/manual only.
- Notifications: in-app only, with external channels test-only.
- Push: readiness/test-device only.
- Camera: locked according to PILOT FIX 6.
- AI: readiness/shadow according to PILOT FIX 7.

Final policy recommendation: PROVIDERS_READY_FOR_LIMITED_PILOT_MANUAL_OR_SANDBOX.
