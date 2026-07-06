# PILOT FIX 8 - Provider Feature Flags / Kill Switches

Date: 2026-07-05

## Required Switches

| Switch | Safe default | Current status | Pilot requirement |
|---|---|---|---|
| enable_payments | disabled/manual | represented by payment mode and UI readiness | explicit mode required |
| enable_live_payments | false | live mode not default | must remain false without approval |
| enable_invoice_provider | false/manual | invoice mode config required | manual until provider approved |
| enable_email | false/test | dry-run/mock by default | limited/test only |
| enable_sms | false/test | dry-run/mock by default | disabled/test only |
| enable_whatsapp | false/test | dry-run/mock by default | disabled/test only |
| enable_push | false/test-device | provider/test gated | native QA required |
| enable_external_notifications | false | external providers not live by default | approval required |
| enable_payment_webhooks | readiness | webhook route exists | live test required |
| enable_invoice_webhooks | readiness | webhook route exists | live test required |
| enable_parent_tuition | manual | child payment state exists | no real provider without approval |
| enable_gan_batuach_subscription | manual/sandbox | subscription readiness exists | manual/sandbox only |
| enable_digital_observer_billing | manual/readiness | separate billing surfaces exist | separation signoff required |
| enable_provider_health_tests | safe/redacted | provider readiness exists | no secrets in output |

## Kill Switch Requirements

- Live payments disabled by default.
- Production invoices disabled by default.
- SMS/WhatsApp production sends disabled by default.
- Push broadcast disabled by default.
- Parent tuition provider flow disabled unless provider/legal ready.
- External notifications limited/test until approved.

If dedicated feature flag infrastructure is added later, these switches should become explicit environment-backed flags with safe defaults.
