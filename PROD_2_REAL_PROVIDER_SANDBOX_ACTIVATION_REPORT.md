# PROD 2 Real Provider Sandbox Activation Report

Date: 2026-06-27

Status: completed for sandbox/readiness preparation. No live provider activation was performed.

## Provider Inventory

Created `PROD_2_PROVIDER_SANDBOX_ACTIVATION_INVENTORY.md`.

Covered:

- payment
- invoice
- email
- SMS
- WhatsApp
- push
- Supabase
- Vercel

Result: provider inventory is available with modes, required ENV names, webhook/callback readiness, test action readiness and blockers. Secret values were not read or printed.

## ENV Schema Status

Updated `.env.example` with missing generic provider variables:

- `PAYMENT_API_KEY`, `PAYMENT_PUBLIC_KEY`, `PAYMENT_SUCCESS_URL`, `PAYMENT_CANCEL_URL`
- `INVOICE_API_KEY`, `INVOICE_WEBHOOK_SECRET`
- `EMAIL_MODE`, `EMAIL_FROM`, `EMAIL_REPLY_TO`
- `SMS_MODE`, `SMS_SENDER_ID`
- `WHATSAPP_MODE`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `WHATSAPP_BUSINESS_ACCOUNT_ID`
- `PUSH_MODE`, `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY`, APNs placeholders

No real secrets were added.

## Provider Configuration Validator

Implemented `lib/domain/provider-configuration-validator.ts`.

The validator reports:

- provider selected
- current mode
- supported modes
- missing ENV names only
- webhook URL
- callback URL
- sandbox/test support
- production support
- test action availability
- health/log availability
- status: `configured`, `missing_env`, `sandbox_ready`, `production_blocked`, `disabled`, `invalid_mode`

Production/live modes remain blocked when required credentials or webhook secrets are missing.

## Payment Sandbox Status

Implemented manager-scoped readiness endpoint:

- `POST /api/garden/subscription/sandbox-checkout`

Behavior:

- requires manager/owner role
- requires assigned kindergarten
- reads the latest kindergarten subscription
- returns `sandbox_ready` only when the payment provider validator allows it
- otherwise returns `readiness_only`
- records audit/notification readiness
- never creates a live checkout
- never charges a card
- never stores card data

Payment provider remains external setup required until real sandbox credentials are configured.

## Invoice Sandbox Status

Invoice webhook readiness already exists at:

- `POST /api/webhooks/invoice`

PROD 2 added invoice ENV schema coverage and validator status. Real sandbox invoice creation remains external provider setup required.

## Email Test Status

Existing admin integration test center remains the safe test path for email. PROD 2 added validator readiness and notification template registry coverage.

No production email was sent.

## SMS Test Status

Existing admin integration test center remains the safe test path for SMS with approved recipients only.

No production SMS was sent.

## WhatsApp Readiness Status

WhatsApp readiness now includes generic Meta/Twilio ENV names, webhook URL readiness by provider choice and template registry coverage.

WhatsApp Business external setup is still required.

No WhatsApp message was sent.

## Push Readiness Status

Push readiness now includes FCM, APNs and Web Push ENV names. Real push remains pending real-device/device-token QA.

No production push was sent.

## Notification Template Registry

Implemented `lib/domain/notification-template-registry.ts`.

Templates covered:

- `manager_approved`
- `subscription_payment_required`
- `demo_expiring`
- `kindergarten_frozen`
- `parent_invite`
- `enrollment_request_approved`
- `staff_application_approved`
- `inspector_assigned`
- `payment_failed`
- `invoice_failed`

Templates use Hebrew copy, variables, channel lists and provider requirements. Bodies avoid secrets and sensitive medical/child details.

## Admin Testing Center Status

Updated admin integrations page:

- adds sandbox/test readiness by provider
- shows missing ENV names only
- does not show secret values
- keeps existing safe test center and logs

Added admin API:

- `GET /api/admin/provider-readiness`

The route is admin-only and returns safe provider/template status.

## Webhook Status

Existing PROD 1 webhook infrastructure remains in place:

- `/api/webhooks/payment`
- `/api/webhooks/invoice`
- provider aliases for payment/invoice routes
- `provider_webhook_events`
- idempotency/replay protection from migration `20260627000100_prod1_provider_webhooks_demo_freeze_readiness.sql`

No live webhook was invoked in this phase.

## Event Logging Status

Provider events are logged through existing production integration/test log tables and webhook event infrastructure. PROD 2 added audit/notification readiness for manager sandbox checkout requests.

Sensitive payloads, card data and secret values are not logged by the new code.

## External Setup Checklist

Created `PROD_2_EXTERNAL_PROVIDER_SETUP_CHECKLIST.md`.

External setup remains required for:

- payment sandbox account and keys
- invoice sandbox account and keys
- email sender/domain verification
- SMS sender and allowed test numbers
- WhatsApp Business phone, templates and test numbers
- FCM/APNs/device-token QA

## Blockers

| Classification | Finding | Status |
|---|---|---|
| external_setup_required | Payment sandbox credentials are not configured in source and were not tested live. | Open |
| external_setup_required | Invoice sandbox provider is not configured in source and no real invoice was issued. | Open |
| external_setup_required | Email/SMS/WhatsApp providers require approved test recipients and external provider dashboards. | Open |
| real_device_required | Push requires device-token and mobile/PWA device QA. | Open |
| manual_supabase_verification_required | Supabase migration execution and RLS/payment role tests still require manual confirmation in the target Supabase project. | Open |

## QA 5 Readiness

QA 5 can begin for controlled sandbox readiness validation, provided it does not call live providers and uses only approved test credentials/recipients.

The platform is not production/live-provider activated yet.
