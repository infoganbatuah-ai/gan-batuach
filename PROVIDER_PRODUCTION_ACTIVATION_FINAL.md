# Provider Production Activation Final

Status: readiness package, not automatic production activation.

This document defines the controlled path for moving Gan Batuach and Digital Observer from provider readiness mode into real provider production activation.

Production activation is allowed only when environment variables, provider dashboards, webhooks, approved test recipients, audit logs, fallback rules and rollback controls are all verified.

## Safety Defaults

No provider should start in production mode by default.

Required safety flags:

| Area | Variable | Safe default | Production value |
| --- | --- | --- | --- |
| Email / WhatsApp / SMS | `COMMUNICATIONS_SEND_MODE` | `mock` | `production` |
| Payments | `PAYMENT_MODE` | `disabled` | `live` |
| Invoices | `INVOICE_MODE` | `mock` | `production` |
| Push | `PUSH_MODE` | `disabled` | `production` |
| Camera gateway | `CAMERA_GATEWAY_MODE` | `disabled` | `production` |
| AI provider | `AI_PROVIDER_MODE` | `mock` | `production` |

Live charging, mass messaging and broad production sending are blocked operationally until an admin completes provider tests and approves activation.

## Provider Command Center

Admin route:

`/dashboard/admin/provider-production`

The command center shows:

- provider activation status
- missing configuration
- current provider modes
- test mode and production mode readiness
- webhook status
- provider health and incident alerts
- delivery logs
- provider cost baselines
- fallback rules
- rollback controls
- safe test-send center
- production runbooks

## Provider Configuration Audit

Every provider must pass this checklist before being marked `production_active`:

- provider selected
- required env vars configured
- secrets server-side only
- webhook secret configured
- safe test completed
- production send approved
- audit logging enabled
- rollback option exists
- owner approved

Provider statuses:

- `not_configured`
- `configured`
- `test_mode`
- `production_pending`
- `production_active`
- `degraded`
- `failed`
- `disabled`

## Communications

Supported readiness:

- Email: Resend, SendGrid, Amazon SES, future adapter
- WhatsApp: Meta WhatsApp Cloud API, Twilio WhatsApp, future adapter
- SMS: Twilio, MessageBird, Vonage, Israeli provider readiness
- Push: FCM, APNs, Web Push

Production requirements:

- verified sending identity
- webhook delivery feedback
- retry and failure handling
- rate limit awareness
- cost tracking
- user preferences respected
- no free-text bulk WhatsApp without approval
- no mass Email/SMS/WhatsApp without admin approval

## Payments

Payment provider readiness supports:

- Tranzila
- Meshulam
- Cardcom
- Pelecard
- Stripe future readiness

No raw card data is stored. Payments must use provider tokenization.

Revenue streams must remain separate:

1. Gan Batuach subscriptions: kindergarten pays Gan Batuach.
2. Parent tuition payments: parent pays kindergarten account/provider.
3. Digital Observer subscriptions: customer pays Digital Observer product account.

Live payment mode requires `PAYMENT_MODE=live`, provider webhooks, idempotency and finance approval.

## Invoices

Invoice provider readiness supports:

- Green Invoice / חשבונית ירוקה
- iCount
- Morning / חשבונית אונליין
- future provider-neutral adapter

Invoice streams stay separate:

- Gan Batuach invoice to kindergarten
- kindergarten invoice/receipt to parent where legally and technically supported
- Digital Observer invoice to standalone customer

## Camera Gateway

Production gateway requirements:

- gateway health check
- source registration
- stream availability
- secure playback token
- no RTSP exposure
- no camera credential exposure
- session audit logs
- reconnect behavior
- admin diagnostics

Gan Batuach Israel Mode keeps:

- audio disabled
- face recognition disabled
- raw AI parent visibility blocked

## AI Provider

Supported modes:

- `mock`
- `shadow`
- `production`

Gan Batuach AI must start in shadow and human-review mode.

No automatic:

- accusations
- disciplinary actions
- parent raw alerts
- regulatory conclusions

AI provider records must include model endpoint, model version, provider, capability matrix, thresholds, review queue and audit logs.

## Webhooks

Production webhooks must include:

- signature verification
- replay protection
- idempotency
- event logging
- retry readiness
- dead-letter readiness
- failure handling

No webhook should trust unauthenticated payloads.

## Logs And Costs

Provider delivery logs track:

- provider
- channel
- recipient
- template
- status
- provider message id
- sent, delivered, read, opened and failed timestamps
- error code
- error message
- metadata

Provider costs track:

- product
- garden
- observer site
- channel
- month
- estimated cost
- actual cost

## Fallback Rules

Examples:

- Email fails: queue retry and keep in-app notification.
- WhatsApp fails: fallback to SMS/email only if allowed.
- SMS fails: fallback to email/in-app.
- Push fails: in-app notification remains source of truth.
- Payment provider fails: show retry later, never duplicate charge.
- Invoice provider fails: mark invoice pending and retry.
- AI provider fails: manual review mode.
- Camera gateway fails: safe unavailable message.

## Rollback Plan

Rollback must preserve:

- delivery logs
- invoices
- payment records
- provider event records
- customer state

Admin may switch providers back to mock, test, sandbox or disabled mode using the safety flags.

## Manual External Steps

Before production activation, the operator still must:

- configure real provider accounts
- add real server-side secrets outside Git
- verify sending domains and templates
- configure webhook endpoints in provider dashboards
- approve test recipients
- perform provider test sends
- approve finance live-payment controls
- document provider-specific fallback and rollback owners
