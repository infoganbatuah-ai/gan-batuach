# QA 4B Payment, Webhook, Subscription & Demo-Freeze Regression Report

## Status

QA 4B completed as a safe local regression pass after PROD 1.

No live provider was called. No real payment was charged. No real invoice was issued. No production SMS, WhatsApp, email or push was sent. No secrets were added or printed.

Production remains blocked until provider credentials, signed sandbox webhooks, Supabase migration verification and demo-freeze scheduler activation are completed.

## Build Baseline

| Check | Result |
|---|---|
| `npm run typecheck` | Passed, about 17 seconds |
| `npm run build` | Passed, 435 routes |
| `git diff --check` | Passed |
| Existing payment/provider test script | Not found |

## Payment Stream Separation Result

Classification: fixed / verified by code inspection.

The three streams remain separated:

| Stream | Expected separation | QA result |
|---|---|---|
| Gan Batuach subscription | Kindergarten pays Gan Batuach | Subscription pages and payment webhook side effects target only `gan_batuach_subscription` |
| Parent tuition | Parent pays kindergarten account/provider | Parent tuition wording remains separate; webhook processor refuses non-Gan-Batuach subscription side effects |
| Digital Observer subscription | Digital Observer customer pays Digital Observer product account | Digital Observer billing pages and domain model retain standalone wording and separate data |

Evidence:

- `lib/domain/provider-webhooks.ts` allows side effects only for `gan_batuach_subscription`.
- `app/dashboard/admin/provider-production/page.tsx` presents the three streams separately.
- `app/digital-observer/billing/page.tsx` states Digital Observer billing is not Gan Batuach billing and not parent tuition.
- `app/dashboard/garden/subscription/page.tsx` states Gan Batuach subscription is separate from parent tuition.

No evidence was found that parent tuition is counted as Gan Batuach MRR in the reviewed PROD 1 surfaces.

## Provider Mode Result

Classification: fixed / provider_required.

Provider mode model now supports:

- `disabled`
- `mock`
- `sandbox`
- `test`
- `production`
- `live`

Evidence:

- `lib/domain/provider-integration-safety.ts`
- `PROD_1_PROVIDER_MODE_GUARDRAILS.md`

Live side effects are still blocked unless credentials are configured and a valid signature is supplied.

Remaining blocker:

- Actual provider-specific signature algorithms may still be needed after a payment/invoice provider is selected. Current implementation is provider-agnostic HMAC-SHA256 readiness.

## Webhook Route Result

Classification: fixed.

Routes exist and build:

- `POST /api/webhooks/payment`
- `POST /api/webhooks/payments`
- `POST /api/webhooks/payment-provider`
- `POST /api/webhooks/provider`
- `POST /api/webhooks/invoice`
- `POST /api/webhooks/invoices`

Shared implementation:

- `lib/domain/provider-webhooks.ts`

QA result:

- route files exist
- production build includes all routes
- unsupported event types are logged safely as ignored
- malformed payload is rejected safely through schema validation
- raw webhook body is not stored
- card data is not accepted by schema
- service-role usage remains server-only

## Signature Validation Readiness

Classification: fixed / provider_required.

Readiness implemented:

- `PAYMENT_WEBHOOK_SECRET`
- `INVOICE_WEBHOOK_SECRET`
- accepted headers: `x-webhook-signature`, `x-provider-signature`, `x-signature`
- accepted format: raw hex HMAC-SHA256 or `sha256=<hex>`

Production/live mode requires signature validation.

Sandbox/test/mock/disabled mode logs readiness events and skips side effects unless live/production and fully configured.

Remaining blocker:

- provider-specific signature verification must be adapted if the selected provider requires a different canonical string or timestamp scheme.

## Idempotency / Replay Result

Classification: fixed / migration_required.

Implemented:

- duplicate lookup by `webhook_key + idempotency_key`
- duplicate events marked `replayed`
- duplicate events return `duplicate_ignored`
- payment success cannot activate the same subscription twice through the new processor path
- invoice update does not create duplicate invoices

Migration readiness:

- `supabase/migrations/20260627000100_prod1_provider_webhooks_demo_freeze_readiness.sql`

Expected DB support:

- `provider_webhook_events.event_id`
- `related_entity_type`
- `related_entity_id`
- `raw_payload_reference`
- unique index `provider_webhook_events_idempotency_unique_idx`

Remaining blocker:

- Supabase migration must be applied and replay tested against real staging/pilot data.

## Subscription Lifecycle Result

Classification: fixed / manual_supabase_verification_required.

Statuses reviewed:

- `pending_admin_approval`
- `approved_pending_onboarding`
- `approved_pending_subscription`
- `demo_active`
- `active`
- `payment_failed`
- `frozen`
- `suspended`
- `cancelled`

Manager UX:

- Hebrew labels exist for the lifecycle.
- Demo days remaining are shown when a demo end date exists.
- Payment failure and frozen states are shown explicitly.

Admin UX:

- Admin subscription metrics recognize demo, frozen and payment-failed states.
- Admin subscription card labels now avoid raw enum fallback for known lifecycle statuses.

Data model:

- The new migration extends the historical `kindergarten_subscription_status` enum.

Remaining blocker:

- The enum migration must be run in Supabase before any database write uses the new statuses in that environment.

## Demo / Freeze Result

Classification: fixed / external_setup_required.

Cron-ready endpoint added:

- `POST /api/cron/demo-expiration-freeze`

Controls:

- requires `CRON_SECRET`
- uses rate limiting
- requires Supabase service role
- skips subscriptions with paid subscription payments
- freezes expired demo/trial subscriptions
- suspends garden status
- creates manager notification
- creates kindergarten activation event
- creates audit log

Documentation:

- `DEMO_EXPIRATION_FREEZE_JOB_READINESS.md`

Remaining blocker:

- No live scheduler was configured in QA 4B. Production remains blocked until Vercel Cron, Supabase Scheduler or equivalent secure scheduler is connected and tested.

## Manager UX Result

Classification: fixed.

Reviewed:

- `app/dashboard/garden/subscription/page.tsx`

The manager subscription page now covers:

- Gan Batuach subscription
- base pricing
- extra class/group pricing
- expected annual total
- provider mode
- demo state and remaining days
- payment failure
- frozen state
- active subscription

It does not show fake payment success and does not mix parent tuition.

## Admin UX Result

Classification: fixed / high.

Reviewed:

- `app/dashboard/admin/subscriptions/page.tsx`
- `components/subscription-admin-manager.tsx`
- `app/dashboard/admin/provider-production/page.tsx`
- `app/dashboard/admin/integrations/page.tsx`

Admin sees:

- lifecycle counts
- provider mode/readiness
- missing env variable names
- webhook readiness rows after migration is applied
- payment/invoice separation

Remaining high item:

- "last webhook event" visibility depends on the Supabase migration and data rows being present; not fully proven in local static QA.

## Invoice Readiness

Classification: provider_required.

Implemented:

- invoice webhook endpoint readiness
- invoice status update path for an existing invoice in live/production with valid signature
- no fake invoice generation
- no real invoice issuing

Remaining blockers:

- invoice provider credentials not configured
- invoice provider-specific webhook signature not selected
- legal/accounting review still required before real invoice issuing

## Notification Readiness

Classification: fixed / provider_required.

Readiness exists for:

- subscription/payment events through in-app notification paths
- demo expired/frozen manager notification
- existing provider-mode gated communication services

QA confirms:

- no production messages were sent
- external channels remain provider-mode gated
- no payment/provider secrets are included in new notification text

Remaining blockers:

- email/SMS/WhatsApp/push provider setup still required for real external delivery.

## Payment Security Boundaries

Classification: fixed / manual_supabase_verification_required.

Static QA confirms:

- provider webhook events are admin-only through RLS migration history.
- provider secrets are read from server env only.
- no service-role key is used in client code in PROD 1 changes.
- no raw card data is accepted by the new webhook schema.
- raw webhook body is not persisted.
- parent enrollment into frozen/payment-failed gardens is blocked.

Remaining manual tests:

- parent cannot read Gan Batuach subscription records
- staff cannot read provider/payment tables
- inspector cannot read provider/payment tables
- manager sees only own garden subscription
- admin sees platform provider/payment status
- webhook event table is not publicly readable

These require live Supabase RLS verification.

## Supabase Payment Migration Verification Status

Classification: migration_required / manual_supabase_verification_required.

Repository contains:

- `supabase/migrations/20260616000100_parent_rls_scope_hardening.sql`
- `supabase/migrations/20260616000200_payment_provider_rls_scope_hardening.sql`
- `supabase/migrations/20260627000100_prod1_provider_webhooks_demo_freeze_readiness.sql`

Verification plan exists:

- `SUPABASE_PAYMENT_RLS_MIGRATION_VERIFICATION_PLAN.md`

No user-provided confirmation was available in this QA turn that the new PROD 1 migration was manually applied in Supabase.

Production remains blocked until migration application and negative role tests are documented.

## Provider Health Status

Classification: fixed / provider_required.

Admin provider pages show:

- payment provider status
- invoice provider status
- notification provider readiness
- missing environment variable names only
- webhook readiness
- sandbox/mock/live mode language

No secret values are intentionally shown by PROD 1 changes.

Remaining blocker:

- real provider health cannot be green until credentials, test calls and signed webhooks are configured.

## Live Side-Effect Safety

Classification: fixed.

QA 4B did not:

- charge a real card
- issue a real invoice
- send production email
- send production SMS
- send production WhatsApp
- send production push
- call a live payment API
- activate production camera or AI provider
- create fake live success

## Fixes Made During QA 4B

Classification: fixed.

One safe QA fix was made:

- `lib/domain/provider-webhooks.ts` now logs unsupported webhook event types safely as ignored/readiness events instead of rejecting them before event logging.

This does not activate side effects and does not broaden access.

## Remaining Production Blockers

| Classification | Finding |
|---|---|
| blocking | Supabase migrations must be applied and manually verified |
| blocking | Payment/invoice providers are not configured or live-tested |
| blocking | Demo freeze scheduler is not connected |
| high | Signed sandbox webhook replay/idempotency tests still need live Supabase |
| high | Admin last-webhook-event visibility requires real migrated rows |
| provider_required | Provider-specific payment/invoice signature details may differ from generic HMAC readiness |
| provider_required | Email/SMS/WhatsApp/push real delivery not configured |
| external_setup_required | Vercel Cron or Supabase Scheduler required for automatic freeze |
| manual_supabase_verification_required | Payment RLS negative tests still required |

## Recommendation For PROD 2

It is safe to proceed to PROD 2 - Real Provider Sandbox Activation only as a sandbox/provider-setup phase.

Do not mark the system Production-ready until:

- PROD 1 migration is applied
- RLS role tests pass
- payment provider sandbox credentials are configured
- invoice provider sandbox credentials are configured
- signed sandbox webhook tests pass
- replay/idempotency is verified in Supabase
- demo freeze scheduler is connected and tested
- legal/accounting invoice review is complete
