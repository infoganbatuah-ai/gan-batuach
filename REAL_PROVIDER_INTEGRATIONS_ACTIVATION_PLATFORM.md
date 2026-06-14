# Real Provider Integrations Activation Platform

Phase 163 moves Gan Batuach from mock/readiness integrations toward controlled production provider activation. The default posture remains safe: no broad real messages, no live payments and no production invoices unless explicit server-only environment flags and provider credentials are configured.

## Integration Command Center

Route: `/dashboard/admin/integrations`

The command center tracks:

- Email, WhatsApp, SMS, Push, Payments, Invoices, Camera Gateway and AI Provider readiness.
- Provider status: `not_configured`, `configured`, `test_mode`, `production_ready`, `active`, `disabled`, `failed`.
- Global safety modes for communications, payments and invoices.
- Missing server environment configuration.
- Webhook readiness and signing-secret requirements.
- Safe test logs, provider health and delivery logs.

## Safety Modes

The platform uses server-only environment variables:

- `COMMUNICATIONS_SEND_MODE`: `mock`, `test`, `production`
- `PAYMENT_MODE`: `disabled`, `sandbox`, `live`
- `INVOICE_MODE`: `disabled`, `mock`, `production`

Safe defaults:

- Communications: `mock`
- Payments: `disabled`
- Invoices: `mock`

Production activation requires explicit environment configuration and admin review. No provider secrets are stored in the database.

## Provider Model

Database table: `production_integrations`

Phase 163 extends the existing table with:

- `send_mode`
- `missing_configuration`
- `webhook_status`
- `disabled_at`

Supported integration types:

- `email`
- `whatsapp`
- `sms`
- `push`
- `payment`
- `invoice`
- `supabase`
- `vercel`
- `camera_gateway`
- `ai_provider`

## Supported Providers

Email readiness:

- Resend
- SendGrid
- Amazon SES

WhatsApp readiness:

- Meta WhatsApp Cloud API
- Twilio WhatsApp

SMS readiness:

- Twilio
- MessageBird
- Vonage
- Israeli local provider readiness

Push readiness:

- Firebase Cloud Messaging
- Apple Push Notifications
- Web Push

Payment readiness:

- Tranzila
- Meshulam
- Cardcom
- Pelecard
- Stripe future readiness

Invoice readiness:

- Green Invoice / חשבונית ירוקה
- iCount
- Morning / חשבונית אונליין
- Provider-neutral mock adapter

## Payment Separation Rules

Revenue stream A:

Gan Batuach subscription payments flow from kindergarten to the Gan Batuach company account.

Revenue stream B:

Parent tuition payments flow from parent to the kindergarten provider or bank account.

The platform facilitates routing and records readiness, but Gan Batuach does not receive parent tuition funds. No raw card data may be stored. Provider tokenization is mandatory.

## Webhook Readiness

Table: `production_webhook_readiness`

New readiness entries cover:

- Payment success/failure callbacks
- Invoice issued/cancelled callbacks
- Camera gateway health callbacks
- AI provider callbacks

Requirements:

- Signature verification readiness
- Replay protection readiness
- Idempotency key readiness
- Audit logging readiness

## Test Sending Center

Admin route: `/api/admin/integrations/test`

The test route records safe `mock` checks only. It does not send real messages, charge cards or issue production invoices.

Tests are allowed only for:

- Infrastructure channels that do not require recipients.
- Communication channels with an approved test recipient or the logged-in admin’s own email/phone.

## Delivery Logs

Table: `provider_delivery_logs`

Tracks:

- Channel
- Provider
- Recipient preview/hash where appropriate
- Template
- Provider message id
- Status
- Delivery/failure timestamps
- Error details

Statuses:

- `queued`
- `sent`
- `delivered`
- `read`
- `opened`
- `failed`
- `skipped`
- `blocked`

## Provider Health

Table: `provider_integration_health`

Tracks:

- Credential readiness
- Provider reachability
- Webhook health
- Last success/failure
- Rate-limit warnings
- Next action

## Audit Events

Table: `integration_audit_events`

Tracks:

- Provider configured
- Provider disabled
- Test send performed
- Webhook received
- Payment webhook received
- Invoice generated
- Provider failure
- Integration mode changed

This should be mirrored to the immutable audit service where available.

## Environment Variables

`.env.example` now includes placeholders for:

- Email providers
- WhatsApp providers
- SMS providers
- Push providers
- Payment providers
- Invoice providers
- Webhook secrets

All sensitive variables are server-only. No provider secrets should use `NEXT_PUBLIC`.

## Production Activation Checklist

Before production activation:

1. Configure provider credentials in Vercel environment variables.
2. Verify domain/sender setup for email.
3. Approve WhatsApp templates.
4. Configure SMS sender and rate limits.
5. Configure FCM/APNs/Web Push credentials.
6. Configure payment provider sandbox and webhook signing.
7. Confirm Gan Batuach subscription payments route to Gan Batuach account.
8. Confirm parent tuition payments route directly to kindergarten account.
9. Configure invoice provider and invoice numbering rules.
10. Run safe test from `/dashboard/admin/integrations`.
11. Confirm provider webhook health.
12. Change safety modes only after admin approval.

## Remaining External Setup

- Real provider accounts must be created outside the codebase.
- WhatsApp templates require provider approval.
- Payment providers require merchant onboarding and compliance review.
- Invoice providers require legal/accounting configuration.
- Push production requires native app certificates and store setup.
- Live sending and charging should remain disabled until pilot approval.
