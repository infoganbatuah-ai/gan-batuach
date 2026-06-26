# PROD 1 Production Blockers: Payments, Webhooks, Demo Freeze

## Status

PROD 1 is completed as a readiness and blocker-reduction phase.

The project is not Production-ready yet because live provider credentials, live webhook tests, Supabase manual migration verification and scheduler activation are still incomplete.

No live providers were activated. No secrets were added. No push was performed.

## Payment Stream Separation

Status: improved and preserved.

The three streams remain separated:

| Stream | Flow | PROD 1 handling |
|---|---|---|
| Gan Batuach subscription | Kindergarten → Gan Batuach | New payment webhook side effects apply only to `gan_batuach_subscription` and subscription IDs |
| Parent tuition | Parent → Kindergarten | Parent enrollment and manager child-payment logic remain separate; parent tuition is not counted as Gan Batuach subscription revenue |
| Digital Observer subscription | Digital Observer customer → Digital Observer | Not mixed into Gan Batuach subscription webhook side effects |

The new payment webhook processor refuses subscription side effects when the payload stream is not `gan_batuach_subscription`.

## Provider Mode Guardrails

Status: implemented.

Updated:

- `lib/domain/provider-integration-safety.ts`
- `PROD_1_PROVIDER_MODE_GUARDRAILS.md`

Supported modes now include:

- `disabled`
- `mock`
- `sandbox`
- `test`
- `production`
- `live`

Live payment/invoice side effects require:

- live/production mode
- provider configuration present
- HMAC-SHA256 webhook signature validation

Missing configuration returns readiness states and blocks live side effects.

## Webhook Routes Added

Status: implemented as provider-agnostic readiness endpoints.

Added:

- `POST /api/webhooks/payment`
- `POST /api/webhooks/payments`
- `POST /api/webhooks/payment-provider`
- `POST /api/webhooks/provider`
- `POST /api/webhooks/invoice`
- `POST /api/webhooks/invoices`

Shared implementation:

- `lib/domain/provider-webhooks.ts`

Supported payment events:

- `payment_success`
- `payment_failed`
- `subscription_created`
- `subscription_updated`
- `subscription_cancelled`

Supported invoice events:

- `invoice_created`
- `invoice_sent`
- `invoice_paid`
- `invoice_failed`
- `receipt_created`

## Signature Validation Readiness

Status: implemented.

The endpoints support HMAC-SHA256 signatures through:

- `x-webhook-signature`
- `x-provider-signature`
- `x-signature`

Accepted format:

- raw hex HMAC-SHA256
- `sha256=<hex>`

When the relevant webhook secret exists, or the mode is live/production, unsigned or invalid events are rejected.

## Idempotency And Replay Protection

Status: implemented in code and migration; requires Supabase migration application.

Added migration:

- `supabase/migrations/20260627000100_prod1_provider_webhooks_demo_freeze_readiness.sql`

It adds:

- `provider_webhook_events.event_id`
- `provider_webhook_events.related_entity_type`
- `provider_webhook_events.related_entity_id`
- `provider_webhook_events.raw_payload_reference`
- unique idempotency index on `webhook_key, idempotency_key`

Duplicate provider events are marked as replayed and do not trigger duplicate subscription activation.

Raw webhook bodies are not stored by the new endpoints.

## Webhook Event Log Status

Status: implemented with existing `provider_webhook_events`.

Events are recorded with:

- provider
- integration type
- event type
- event id
- idempotency key
- signature validity
- replay detection
- status
- safe metadata

Access remains admin-only through existing RLS policy.

## Invoice Webhook Readiness

Status: readiness implemented.

Invoice endpoint logs signed/unsigned readiness events and, only in production/live with valid signature and configuration, can update an existing invoice status by `invoice_id`.

The endpoint does not create fake invoices and does not issue real provider invoices.

## Demo / Freeze Mechanism

Status: cron-ready implemented, scheduler not activated.

Added:

- `POST /api/cron/demo-expiration-freeze`
- `DEMO_EXPIRATION_FREEZE_JOB_READINESS.md`

The endpoint:

- requires `CRON_SECRET`
- checks expired `demo_active` / `trial` subscriptions
- skips subscriptions with paid payment records
- freezes the subscription
- suspends the garden
- creates manager notification
- writes activation event
- writes audit log

Remaining requirement:

- configure Vercel Cron, Supabase Scheduler or an equivalent secure scheduler.

## Manager Lifecycle UX Status

Status: improved.

Updated:

- `app/dashboard/garden/subscription/page.tsx`

Manager-facing copy now clearly covers:

- pending subscription
- demo active with days remaining
- payment failed
- frozen until payment resolution
- active subscription

The screen still honestly shows provider mode and does not claim live payment success.

## Admin Lifecycle UX Status

Status: improved.

Updated:

- `app/dashboard/admin/subscriptions/page.tsx`
- `components/subscription-admin-manager.tsx`

Admin lifecycle now recognizes:

- `pending_admin_approval`
- `approved_pending_onboarding`
- `approved_pending_subscription`
- `demo_active`
- `active`
- `trial`
- `pending_payment`
- `payment_failed`
- `frozen`
- `suspended`
- `expired`
- `cancelled`

Admin counts now include demo as active/readiness and frozen/payment failure as lifecycle blockers.

## Parent Enrollment Boundary

Status: fixed.

Updated:

- `app/api/parent/enrollment-requests/route.ts`

Parent enrollment requests are blocked when the target garden is not active or has frozen/suspended/failed payment state.

This prevents enrollment activation into a garden frozen by demo/payment lifecycle.

## Payment RLS Migration Status

Status: repository ready, live verification required.

Verified files exist:

- `supabase/migrations/20260616000100_parent_rls_scope_hardening.sql`
- `supabase/migrations/20260616000200_payment_provider_rls_scope_hardening.sql`
- `supabase/migrations/20260627000100_prod1_provider_webhooks_demo_freeze_readiness.sql`

Created:

- `SUPABASE_PAYMENT_RLS_MIGRATION_VERIFICATION_PLAN.md`

Manual Supabase verification remains required before live activation.

## Notification Readiness

Status: readiness improved.

The demo freeze endpoint creates in-app manager notifications.

Provider-driven notification channels are not activated:

- email
- SMS
- WhatsApp
- push

These remain provider-mode gated.

## Provider Health Status

Status: migration-readiness updated.

The new migration updates readiness rows for:

- payment provider events
- invoice provider events
- demo expiration freeze cron
- provider integration health for payment/invoice readiness

Provider dashboards can surface these after the migration is applied.

## Security Boundary Findings

No intentional security weakening was introduced.

Preserved:

- no RLS broadening
- no service-role in client code
- no provider secrets in UI
- no raw card storage
- no camera gateway changes
- no AI core changes
- no live side effects

New safeguards:

- signed webhook validation for production/live
- replay/idempotency index
- no raw webhook body persistence
- enrollment block for frozen/payment-failed gardens

## External Provider Setup Still Required

Blocking before live:

- choose payment provider
- configure server-only credentials
- configure `PAYMENT_WEBHOOK_SECRET`
- choose invoice provider
- configure `INVOICE_API_KEY`
- configure `INVOICE_WEBHOOK_SECRET`
- run signed sandbox webhook tests
- reconcile provider dashboard against Supabase rows
- complete legal/accounting invoice review

## Remaining Production Blockers

| Classification | Blocker |
|---|---|
| blocking | Supabase migrations must be applied and manually verified |
| blocking | Payment/invoice providers are not configured or live-tested |
| blocking | Demo freeze scheduler is not connected |
| high | Signed webhook sandbox replay/idempotency tests still need live Supabase |
| high | Invoice issuing is readiness-only, not real provider generation |
| provider_required | Payment, invoice, email, SMS, WhatsApp and push still require provider setup |
| manual_supabase_verification_required | RLS negative tests for payment/provider tables |
| external_setup_required | Vercel Cron/Supabase Scheduler setup for demo freeze |

## QA 4B Readiness

QA 4B can begin for sandbox/readiness validation.

Do not call the system Production-ready until:

- migrations are applied to Supabase
- signed sandbox webhooks pass
- duplicate webhook replay is verified
- demo freeze scheduler is configured and tested
- provider credentials are configured server-side
- live provider activation is explicitly approved by the user
