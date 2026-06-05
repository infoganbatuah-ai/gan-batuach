# WhatsApp Production Readiness

## Goal

Prepare Gan Batuach for a production WhatsApp Business integration without sending real messages yet.

The current implementation is mock / dry-run only. It creates provider architecture, template records, opt-in records, and delivery logs so the product can be tested safely before enabling real sending.

## Provider Architecture

Supported now:

- `mock_whatsapp`: default provider, no real messages.
- `meta_whatsapp_business`: Meta payload builder and readiness checks, no real sends.

Future providers can implement the same provider interface in:

- `lib/domain/whatsapp-provider.ts`

Business flows should use:

- `queueWhatsAppTemplate(...)` from `lib/domain/whatsapp-service.ts`

## Required Meta Setup Before Real Sending

Before real sends are allowed:

- Meta Business account approved.
- WhatsApp Business account connected.
- Phone number verified.
- Message templates approved.
- Webhook endpoint implemented and verified.
- Access token stored server-side only.
- Explicit opt-in collected from users.
- Production policy approval to set `WHATSAPP_REAL_SEND_ENABLED=true`.

## Environment Variables

Server-only:

- `WHATSAPP_PROVIDER=meta_whatsapp_business`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_BUSINESS_ACCOUNT_ID`
- `WHATSAPP_APP_ID`
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
- `WHATSAPP_REAL_SEND_ENABLED=false`

Keep `WHATSAPP_REAL_SEND_ENABLED=false` until launch approval.

## Template Events

Prepared events:

- registration
- verification
- parent approval
- child approval
- payment reminder
- safety alert
- inspection alert

Template table:

- `whatsapp_templates`

Statuses:

- draft
- pending approval
- approved
- rejected
- paused
- disabled

## Delivery Logs

Dedicated WhatsApp logs:

- `whatsapp_message_logs`

Statuses:

- queued
- sent
- delivered
- read
- failed

General communication logs remain available in `communication_logs`.

## Opt-In Model

Dedicated opt-in table:

- `whatsapp_opt_ins`

Users must explicitly consent before real WhatsApp sends.

Emergency and legal exceptions must be reviewed before production use.

## Admin Dashboard

Route:

- `/dashboard/admin/whatsapp`

Shows:

- provider readiness
- missing Meta settings
- template status
- opt-ins
- delivery logs
- failures
- mock / dry-run mode

## Real Sending Policy

Real sends are intentionally disabled in this phase.

The Meta adapter currently builds the payload and records dry-run status only. It must not call the Meta Graph API until:

- templates are approved
- webhook delivery receipts are implemented
- opt-in wording is approved
- production switch is explicitly enabled

## Testing Checklist

Mock-only:

- Template rows exist.
- Admin dashboard loads.
- Readiness reports missing env vars.
- Queue helper creates `whatsapp_message_logs`.
- Invalid phone creates failed log.
- No real network call is made.

Future production:

- Webhook verification.
- Delivery status updates.
- Template approval sync.
- Rate limiting.
- Retry policy.
- Opt-out handling.
