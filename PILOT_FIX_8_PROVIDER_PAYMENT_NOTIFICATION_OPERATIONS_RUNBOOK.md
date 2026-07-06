# PILOT FIX 8 - Provider, Payment & Notification Operations Runbook

Date: 2026-07-05

## Current Operating Mode

- Payments: manual/sandbox/readiness only.
- Invoices: manual/sandbox/readiness only.
- Email: dry-run/test unless explicitly configured.
- SMS: disabled/test only.
- WhatsApp: disabled/test only.
- Push: readiness/test-device only.

## Keep Live Payments Disabled

1. Keep `PAYMENT_MODE` out of `live` / `production`.
2. Do not add live payment provider secrets until approval.
3. Keep live payment buttons hidden/disabled unless provider health, legal, and webhook tests pass.
4. Confirm webhook secrets and callback URLs in the provider dashboard before live mode.

## Test Providers Safely

- Use provider sandbox dashboards only.
- Use test cards/test invoices/test recipients only.
- Use internal test email/phone/device token only.
- Never send SMS/WhatsApp/push to real pilot users before consent and routing tests.

## Webhook Operations

- Check provider event logs after each sandbox event.
- Confirm duplicate events do not double-activate subscriptions.
- Confirm invalid signatures are rejected.
- Confirm no raw provider secrets are logged.

## Incident Response

| Incident | Immediate action |
|---|---|
| Wrong notification recipient | Disable external notifications, preserve logs, notify incident owner. |
| Accidental live payment path | Disable payment mode, revoke checkout path, audit affected records. |
| Invoice issued incorrectly | Stop invoice provider, contact accounting/legal owner. |
| Provider secret exposed | Rotate secret, remove exposure, audit logs and git history. |
| Push broadcast risk | Disable push provider and external notifications. |

## Rollback

Use provider mode switches and feature flags first. If needed, remove provider env values from deployment and redeploy. Do not delete audit/provider event records during incident investigation.
