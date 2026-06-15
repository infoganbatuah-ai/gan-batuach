# QA 4 - Payments, Providers, Notifications & Subscription Lifecycle QA

Date: 2026-06-16
Mode: Stronger Codex model
Scope: payments, providers, notifications, subscription lifecycle, demo/freeze readiness, invoice readiness and payment stream separation.

## Verification Summary

- Pre-QA branch: `main`
- Latest commit before QA: `b176d56 SECURITY FIX - Parent RLS Scope Hardening & Sensitive Document Signed URL Reduction`
- Working tree before QA: clean
- Baseline `npm run typecheck`: passed
- Baseline `npm run build`: passed
- Baseline `git diff --check`: passed
- No push performed.
- No provider secrets were printed or committed.
- No raw card data was added.
- No live payment or live notification send was triggered.

## Routes And Areas Reviewed

- `/dashboard/garden/subscription`
- `/dashboard/admin/subscriptions`
- `/dashboard/admin/billing`
- `/dashboard/admin/provider-production`
- `/dashboard/admin/integrations`
- `/dashboard/parent/payments`
- `/digital-observer/billing`
- `/dashboard/admin/observer-billing`
- `/api/garden/subscription`
- `/api/admin/subscriptions`
- `/api/garden/child-payments`
- `/api/admin/integrations/test`
- `/api/admin/communications/test`
- Provider/payment/invoice migrations and readiness tables.

## Payment Stream Separation Status

Status: passed with production-readiness blockers

The product clearly separates:

- Gan Batuach subscription: Kindergarten -> Gan Batuach company account.
- Parent tuition: Parent -> kindergarten account/provider.
- Digital Observer subscription: standalone observer customer -> Digital Observer product/account.

Evidence:

- Garden subscription page states that parent tuition remains separate and is not Gan Batuach revenue.
- Admin billing dashboard separates Gan Batuach MRR/ARR from parent tuition routing and the revenue separation ledger.
- Parent payment page states that tuition belongs to the kindergarten and is not paid through Gan Batuach.
- Digital Observer billing page states that Digital Observer billing is separate from Gan Batuach and parent tuition.
- Digital Observer admin billing page is labeled as standalone/mock readiness.

Classification: not_blocking for readiness; live activation requires provider setup.

## Kindergarten Subscription Lifecycle Status

Status: partially passed

The lifecycle model exists in code and UI:

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

The manager subscription screen clearly shows:

- Base price: 800 NIS/month.
- Additional class/group: +200 NIS/month.
- Demo period: 3 days.
- Provider status: disabled/sandbox/live according to env safety mode.
- Separation from parent tuition and Digital Observer.
- Hebrew status copy for pending payment, demo, frozen/suspended and active states.

Finding:

- `components/subscription-admin-manager.tsx` still exposes an older admin status selection list: `active`, `trial`, `pending_payment`, `suspended`, `expired`, `cancelled`.
- The API accepts the newer status set, but the admin UI does not expose all 190D lifecycle statuses such as `pending_admin_approval`, `approved_pending_onboarding`, `approved_pending_subscription`, `demo_active`, `payment_failed`, and `frozen`.

Classification: medium, deferred. This is an admin UX/lifecycle-completeness gap, not a live charge risk.

## Demo / Freeze Lifecycle Status

Status: partially passed

The UI and status model represent demo/freeze behavior:

- `demo_active` is treated as open but warning-guided.
- `frozen` and `suspended` block advanced capabilities in `evaluateSubscriptionAccess`.
- Manager UI explains that demo must be paid before it ends.

Finding:

- I did not find a production cron/job that automatically moves an expired 3-day demo to `frozen` or `suspended`.
- Existing cron routes cover inspections and permits, not kindergarten subscription demo expiration.

Classification: high, deferred. Production needs a scheduled demo-expiration job or an explicit manual operations runbook before commercial activation.

## Manager Payment UX Status

Status: passed for readiness

The manager payment/subscription page shows:

- Gan Batuach subscription.
- Monthly estimate.
- Base plan and additional group/class pricing.
- Demo period.
- Current status.
- Payment history.
- Invoices and receipts.
- Renewal reminders.
- Clear copy that parent tuition is separate and routed to the kindergarten.

No fake live payment success is shown. The manager action route sends a request to admin and uses a manual/future provider adapter.

Classification: not_blocking for readiness.

## Admin Subscription Status

Status: partially passed

Admin has:

- `/dashboard/admin/subscriptions`
- `/dashboard/admin/billing`
- subscription lists
- failed payment counts
- invoice/readiness panels
- payment gateway readiness
- revenue separation panels
- parent tuition routing summaries
- financial audit readiness

Finding:

- Admin manual subscription status controls need to be aligned with the full newer lifecycle status set.
- Manual override exists in admin subscription UI and is audited by `/api/admin/subscriptions`, but this path should remain admin-only and reviewed in staging.

Classification: medium, deferred.

## Provider Readiness Status

Status: readiness only, production blocked

Safe defaults exist:

- `COMMUNICATIONS_SEND_MODE`: fallback `mock`
- `PAYMENT_MODE`: fallback `disabled`
- `INVOICE_MODE`: fallback `mock`
- `PUSH_MODE`: fallback `disabled`
- `CAMERA_GATEWAY_MODE`: fallback `disabled`
- `AI_PROVIDER_MODE`: fallback `mock`

`.env.example` contains placeholders for provider modes and server-only provider secrets. Current shell/runtime inspection did not expose configured live provider flags.

No live provider activation was verified.

Classification: blocking for live production payments/providers; not_blocking for mock/readiness mode.

## Payment Provider Readiness

Status: readiness only

Payment provider readiness tables and UI exist for:

- Tranzila
- Meshulam
- Cardcom
- Pelecard
- Stripe future readiness
- manual mode

The current `getPaymentProviderAdapter` returns a future/manual adapter and does not perform live provider checkout. This is safe and avoids fake live payments.

Classification: requires_external_provider_setup.

## Payment Webhook Readiness

Status: blocked for live provider activation

Readiness records define intended webhook paths such as:

- `/api/webhooks/payments/provider`
- `/api/webhooks/invoices/provider`
- `/api/webhooks/email/resend`
- `/api/webhooks/whatsapp/meta`
- `/api/webhooks/sms/delivery`

Finding:

- No actual `app/api/webhooks/...` routes were found in the codebase.
- Webhook signature verification, replay protection and idempotency are modeled in readiness tables, but not implemented as live endpoints.

Classification: blocking for live payments, invoice provider production, and provider callbacks.

## Invoice Provider Readiness

Status: readiness only

Admin billing supports invoice/readiness records:

- invoice number
- PDF URL readiness
- email status
- accounting export status
- invoice jobs
- receipts
- refunds/credit notes

Finding:

- No live invoice provider adapter was found.
- No production invoice webhook route was found.
- Parent tuition invoice handling remains legal/provider-dependent and correctly not counted as Gan Batuach revenue.

Classification: requires_external_provider_setup.

## Notification Provider Readiness

Status: passed for mock/test readiness; production blocked

Notification templates and mock send paths exist for:

- in-app
- email
- SMS
- WhatsApp
- push readiness

Admin test endpoints are safe:

- `/api/admin/communications/test` writes mock logs only.
- `/api/admin/integrations/test` requires admin, approved internal recipient for communication tests, masks recipients, records audit/logs and sets `real_send: false`, `live_payment: false`, `production_invoice: false`.

Finding:

- `lib/domain/communication-service.ts` uses `COMMUNICATION_PROVIDER`, while provider production safety uses `COMMUNICATIONS_SEND_MODE`. This creates a naming mismatch between the older communication send service and the newer provider safety model.
- Real provider adapters in `communication-service` intentionally fail as unimplemented if `COMMUNICATION_PROVIDER=real`.

Classification: medium, deferred. Safe default is mock, but production send activation requires adapter/mode alignment.

## Provider Health Dashboard Status

Status: passed for readiness

`/dashboard/admin/provider-production` shows:

- provider status
- safety flags
- missing configuration
- webhook readiness
- rollback readiness
- provider health
- costs
- incident alerts
- fallback rules
- runbooks
- safe test center
- delivery logs

No secrets are displayed. Missing env names may be shown, but not values.

Classification: not_blocking for readiness.

## Notification Copy Status

Status: passed for core Hebrew flows

Reviewed notification copy is user-readable and avoids raw enum values for primary templates:

- Parent request submitted/approved/rejected.
- Payment failed.
- Manager subscription issue.
- Staff tasks/missing documents.
- Inspector assignment.
- System alert.

Finding:

- Some admin/status tables still display raw status values for technical/admin readiness rows. This is acceptable for admin readiness dashboards, but customer-facing flows should continue using labels.

Classification: low, deferred.

## Security Boundary Findings For Payments

Status: fixed in this QA

Finding:

After the QA 3 parent hardening, Gan Batuach subscription tables were correctly restricted to admin/manager scope. However, several advanced payment/provider tables still used `can_access_garden`, which can include assigned staff/inspectors. That could allow staff/inspectors to read finance-sensitive records such as payment method token references, checkout sessions, retry attempts, invoice jobs, billing notifications, refund notes, payout configurations or parent payment transaction records.

Fix added:

- `supabase/migrations/20260616000200_payment_provider_rls_scope_hardening.sql`

The migration narrows finance-sensitive payment/provider policies to:

- `public.is_admin()`
- `public.can_manage_garden(garden_id)` for manager/owner scope
- relevant parent only for parent tuition authorizations/transactions

Tables hardened:

- `subscription_reminders`
- `payment_method_tokens`
- `subscription_checkout_sessions`
- `payment_retry_attempts`
- `invoice_generation_jobs`
- `billing_notifications`
- `billing_refund_credit_notes`
- `kindergarten_payout_configurations`
- `parent_payment_authorizations`
- `parent_payment_transactions`

No payment logic was changed. No provider logic was changed. This was RLS hardening only.

Classification: fixed, requires Supabase migration execution and QA recheck.

## Parent Tuition Separation UX

Status: passed for readiness

Parent payment page clearly says:

- Tuition belongs to the kindergarten.
- Gan Batuach displays/coordinates the process but does not receive the tuition money.
- No automatic charge happens on the parent payments screen.

Parent tuition data is modeled separately via `child_payment_history`, `parent_payment_authorizations`, `parent_payment_transactions`, payout configurations and the separation ledger.

Classification: not_blocking for readiness.

## Digital Observer Billing Separation

Status: passed for readiness

Digital Observer billing is clearly separated in:

- customer billing page
- admin observer billing page
- package/provider readiness tables
- beta billing fields

Live billing is not enabled. The UI states mock/readiness where appropriate.

Classification: not_blocking for readiness; live billing requires separate provider setup.

## Blockers

1. blocking - Live payment activation is not ready. Provider credentials and sandbox validation are not configured/verified.
2. blocking - Payment/invoice/provider webhook routes are readiness-only; actual `/api/webhooks/...` endpoints were not found.
3. high - Automated 3-day demo expiration/freeze job was not found.
4. high - New payment/provider RLS hardening migration must be executed in Supabase and regression-tested.
5. medium - Admin subscription status selector should expose the full 190D lifecycle statuses.
6. medium - Communication provider mode naming should be aligned before production sending.

## External Setup Required

- Select payment provider and configure server-side credentials.
- Configure `PAYMENT_MODE=sandbox` first, then live only after approval.
- Configure `PAYMENT_WEBHOOK_SECRET`.
- Implement and test payment webhook signature validation, replay protection and idempotency.
- Select invoice provider and configure server-side credentials.
- Configure `INVOICE_MODE=mock` or production after provider verification.
- Implement invoice provider webhook endpoint.
- Configure email/SMS/WhatsApp/push providers and approved test recipients.
- Run safe internal provider tests before any production send.
- Configure a demo expiration/freeze scheduled job or manual operations runbook.

## Safe Fixes Made

- Added one RLS-hardening migration for payment/provider finance tables:
  - `supabase/migrations/20260616000200_payment_provider_rls_scope_hardening.sql`

No UI refactor, no payment provider activation, no live sending, no live charging, no camera/AI changes.

## Recommendation

QA 4 is completed for code/readiness review and safe hardening.

Do not enable live payments or production provider sending yet.

It is safe to proceed to QA 5 only as a non-live QA/stabilization phase, after applying the new RLS migration in Supabase. Production commercial activation remains blocked until payment/invoice webhooks, provider credentials, sandbox tests and demo-freeze automation are completed.
