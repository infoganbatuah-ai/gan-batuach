# PROD 2 Provider Sandbox Activation Inventory

Date: 2026-06-27

Scope: payment, invoice, email, SMS, WhatsApp, push, Supabase and Vercel sandbox/test readiness. Secret values were not read, printed or committed.

## Inventory

| Provider group | Provider name | Current default mode | Supported modes | Required ENV names | Webhook / callback | Sandbox/test support | Test action | Health/logs | Blockers |
|---|---|---:|---|---|---|---|---|---|---|
| Payment | provider-agnostic (`PAYMENT_PROVIDER`) | `disabled` | `disabled`, `mock`, `sandbox`, `test`, `production`, `live` | `PAYMENT_PROVIDER`, `PAYMENT_API_KEY`, `PAYMENT_PUBLIC_KEY`, `PAYMENT_WEBHOOK_SECRET`, `PAYMENT_SUCCESS_URL`, `PAYMENT_CANCEL_URL` | `/api/webhooks/payment`, `/dashboard/garden/subscription` | Ready for sandbox readiness; live blocked without credentials and signature secret | Admin mock test, manager readiness checkout | `provider_webhook_events`, production integration logs | External provider account/keys still required |
| Invoice | provider-agnostic (`INVOICE_PROVIDER`) | `mock` | `disabled`, `mock`, `sandbox`, `test`, `production`, `live` | `INVOICE_PROVIDER`, `INVOICE_API_KEY`, `INVOICE_WEBHOOK_SECRET` | `/api/webhooks/invoice` | Readiness only until invoice provider configured | Admin mock test | `provider_webhook_events`, production integration logs | External invoice provider setup required |
| Email | provider-agnostic (`EMAIL_PROVIDER`) | `mock` | `disabled`, `mock`, `sandbox`, `test`, `production`, `live` | `EMAIL_PROVIDER`, `EMAIL_MODE`, `EMAIL_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, provider-specific keys | Provider-specific callback paths documented when provider selected | Test-mode templates ready; real send guarded | Admin approved-recipient test | `communication_test_logs`, `provider_delivery_logs` | Domain/sender verification and API key required |
| SMS | provider-agnostic (`SMS_PROVIDER`) | `mock` | `disabled`, `mock`, `sandbox`, `test`, `production`, `live` | `SMS_PROVIDER`, `SMS_MODE`, `SMS_API_KEY`, `SMS_SENDER_ID`, `SMS_WEBHOOK_SECRET`, provider-specific keys | `/api/webhooks/sms/delivery` readiness | Test recipient only; no production broadcast | Admin approved-recipient test | `communication_test_logs`, `provider_delivery_logs` | Provider account, sender ID and test numbers required |
| WhatsApp | Meta/Twilio-ready (`WHATSAPP_PROVIDER`) | `mock` | `disabled`, `mock`, `sandbox`, `test`, `production`, `live` | `WHATSAPP_PROVIDER`, `WHATSAPP_MODE`, `WHATSAPP_TOKEN`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `WHATSAPP_BUSINESS_ACCOUNT_ID` | `/api/webhooks/whatsapp/meta` or `/api/webhooks/whatsapp/twilio` when selected | Template/readiness only until Business setup exists | Admin approved-recipient test | `communication_test_logs`, `provider_delivery_logs` | WhatsApp Business setup, templates and test numbers required |
| Push | FCM/APNs/Web Push-ready (`PUSH_PROVIDER`) | `disabled` | `disabled`, `mock`, `sandbox`, `test`, `production`, `live` | `PUSH_PROVIDER`, `PUSH_MODE`, `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY`, `FCM_SERVER_KEY`, `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_BUNDLE_ID`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | `/api/webhooks/push/feedback` when selected | Real-device QA required | Admin test readiness | `provider_delivery_logs` | Device tokens and mobile/PWA setup required |
| Supabase | Supabase | environment-dependent | `disabled`, `production` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | n/a | Local build/runtime only | Health check only | DB/provider logs | Manual migration verification still required before production |
| Vercel | Vercel | environment-dependent | `disabled`, `production` | `VERCEL_URL`, `NEXT_PUBLIC_APP_URL`, `APP_URL` | n/a | Deployment readiness only | Health check only | Vercel logs | Deployment env must be configured externally |

## Code Inventory

- Safe validator: `lib/domain/provider-configuration-validator.ts`
- Admin safe readiness API: `app/api/admin/provider-readiness/route.ts`
- Admin provider testing center surface: `app/dashboard/admin/integrations/page.tsx`
- Manager sandbox checkout readiness route: `app/api/garden/subscription/sandbox-checkout/route.ts`
- Notification template registry: `lib/domain/notification-template-registry.ts`
- Payment webhook route: `app/api/webhooks/payment/route.ts`
- Invoice webhook route: `app/api/webhooks/invoice/route.ts`
- Existing idempotency/event log model: `provider_webhook_events`

## Safety Result

- No real provider call was added.
- No secret value is displayed by the validator or admin API.
- Live/production modes remain blocked unless required credentials and webhook secrets are configured.
- Test actions remain admin-gated or manager-scoped and return sandbox/readiness state only.
