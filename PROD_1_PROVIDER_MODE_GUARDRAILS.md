# PROD 1 Provider Mode Guardrails

## Scope

This document defines production guardrails for Gan Batuach and Digital Observer provider modes after PROD 1.

No live provider was activated in this phase. No secrets were added to the repository.

## Supported Modes

The shared server model now accepts:

- `disabled`
- `mock`
- `sandbox`
- `test`
- `production`
- `live`

Current code location:

- `lib/domain/provider-integration-safety.ts`

## Provider Groups

| Provider group | Mode env | Secret/env dependency | Live side effects |
|---|---|---|---|
| Payment | `PAYMENT_MODE` | `PAYMENT_PROVIDER`, provider credentials, `PAYMENT_WEBHOOK_SECRET` | Blocked unless mode is `production`/`live`, credentials exist and webhook signature is valid |
| Invoice | `INVOICE_MODE` | `INVOICE_PROVIDER`, `INVOICE_API_KEY`, `INVOICE_WEBHOOK_SECRET` | Blocked unless mode is `production`/`live`, credentials exist and webhook signature is valid |
| Email | `COMMUNICATIONS_SEND_MODE` plus provider env | Email provider key and verified sender | Existing readiness only; no PROD 1 live send |
| SMS | `COMMUNICATIONS_SEND_MODE` plus provider env | SMS provider key/account/from number | Existing readiness only; no PROD 1 live send |
| WhatsApp | `COMMUNICATIONS_SEND_MODE` plus provider env | WhatsApp provider token/phone/business account | Existing readiness only; no PROD 1 live send |
| Push | `PUSH_MODE` | Push provider credentials | Existing readiness only; no PROD 1 live send |
| Camera gateway | `CAMERA_GATEWAY_MODE` | Gateway URL/API key/signing secret | Not changed in PROD 1 |
| AI provider | `AI_PROVIDER_MODE` | AI endpoint/API key/webhook secret | Not changed in PROD 1 |

## Rules Enforced In Code

- Missing provider credentials return `not_configured`.
- `disabled` returns `disabled`.
- Non-live payment/invoice webhook calls are logged as readiness events and do not mutate subscriptions or invoices.
- Live payment/invoice side effects require:
  - `PAYMENT_MODE` or `INVOICE_MODE` set to `production` or `live`.
  - Required provider configuration present.
  - Valid HMAC-SHA256 webhook signature using `PAYMENT_WEBHOOK_SECRET` or `INVOICE_WEBHOOK_SECRET`.
- Provider secrets are read only from server env.
- Secrets are not returned in JSON responses.
- Raw webhook payloads are not stored by the new endpoints.
- Card data is not accepted or stored by the new endpoints.

## Webhook Signature Format

The readiness endpoints accept a hex HMAC-SHA256 signature in one of these headers:

- `x-webhook-signature`
- `x-provider-signature`
- `x-signature`

The signature may be either raw hex or prefixed with `sha256=`.

## Production Activation Conditions

Before enabling `production`/`live`:

1. Run the PROD 1 Supabase migration.
2. Configure provider credentials in server-only environment variables.
3. Configure `PAYMENT_WEBHOOK_SECRET` and/or `INVOICE_WEBHOOK_SECRET`.
4. Send signed sandbox webhook events and verify idempotency.
5. Verify duplicate event replay is marked as `replayed`.
6. Confirm no raw card data appears in provider logs, app logs or database rows.
7. Confirm provider dashboards reconcile with Gan Batuach subscription records.

## Remaining Guardrails

- Do not enable live payments from UI alone.
- Do not count parent tuition as Gan Batuach revenue.
- Do not mix Digital Observer invoices with kindergarten subscription invoices.
- Do not issue real invoices until invoice provider legal/accounting review is complete.
