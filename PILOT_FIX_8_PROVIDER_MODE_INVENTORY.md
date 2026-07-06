# PILOT FIX 8 - Provider Mode Inventory

Date: 2026-07-05

Secret values were not printed or inspected. Only environment variable names and code-level modes were reviewed.

| Provider type | Current code path | Mode source | Required ENV names | Current safe status | Pilot recommendation | Blocker status |
|---|---|---|---|---|---|---|
| Payment | `provider-configuration-validator`, `provider-webhooks`, `billing` | `PAYMENT_MODE`, `PAYMENT_PROVIDER` | `PAYMENT_WEBHOOK_SECRET`, provider terminal/API env names, success/cancel URLs | defaults disabled/manual; checkout adapter is manual/readiness | manual or sandbox only | live_mode_blocked |
| Invoice | `provider-configuration-validator`, invoice webhook | `INVOICE_MODE`, `INVOICE_PROVIDER` | `INVOICE_API_KEY`, `INVOICE_WEBHOOK_SECRET` | mock/readiness unless configured | manual invoice process acceptable for pilot | invoice_provider_required_before_live_billing |
| Email | `email-provider`, `communication-service` | `EMAIL_PROVIDER`, communication provider config | provider-specific API key/env names | dry-run/mock; no real send by default | test or limited approved sends only | external_setup_required |
| SMS | `sms-provider`, `communication-service` | `SMS_PROVIDER`, communication provider config | provider-specific API key/env names | dry-run/mock; no real send by default | disabled/test only | external_setup_required |
| WhatsApp | `whatsapp-provider`, `communication-service` | `WHATSAPP_PROVIDER`, communication provider config | provider-specific token/env names | dry-run/mock; no real send by default | disabled/test only | external_setup_required |
| Push | `push-provider`, `push-service` | `PUSH_PROVIDER`, `PUSH_REAL_SEND_ENABLED` | `FCM_*`, `APNS_*` provider env names | dry-run/readiness unless explicitly enabled | test-device only after native QA | real_device_required |
| Supabase | server helpers and RLS migrations | Supabase URL/key env names | anon key, service role key server-side only | RLS/security manual signoff still required | pilot/staging only | rls_required |
| Vercel | deployment environment | Vercel env configuration | Vercel project/env names | not verified from local shell | demo/staging only | manual_setup_required |
| Camera gateway | camera gateway modules | `CAMERA_GATEWAY_MODE` | gateway URL/secret env names | per PILOT FIX 6 | no parent view | camera gates remain |
| AI provider | AI modules | `AI_PROVIDER_MODE` | AI provider API key/endpoint env names | per PILOT FIX 7 | readiness/shadow only | AI production blocked |
| Digital Observer billing | observer billing/admin pages | product-specific billing config | payment/invoice env names if separated | readiness/manual | keep separated | separation signoff required |

## Environment Observation

The local shell did not expose live provider credentials for payment, invoice, email, SMS, WhatsApp, push, camera gateway, AI provider, Vercel, or Supabase service role. This supports safe local/build operation, but real environment values must be verified by Daniel in Vercel/Supabase before any pilot.
