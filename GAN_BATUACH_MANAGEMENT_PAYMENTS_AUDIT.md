# Gan Batuach Management — Payments Audit

## A. Platform subscription: Garden → Gan Batuach

| Capability | Evidence | Status |
|---|---|---|
| 700 ILS base | seed plan in `20260602003000_subscription_billing_platform.sql`; calculator returns 700 + 200/additional class | COMPLETE_NEEDS_QA |
| Annual intent | annual fields/cycles and commercial assumptions exist | PARTIAL |
| Admin price change | admin plan API/page writes plan records and audit logs | COMPLETE_NEEDS_QA |
| Subscription lifecycle | trial, active, pending, failed, frozen, suspended, expired, cancelled | COMPLETE_NEEDS_QA |
| Real checkout | `FutureProviderAdapter` returns manual/not-configured; sandbox checkout exists | MOCK |
| Cards/tokenization | token/readiness tables exist; no raw-card intent | BACKEND_ONLY |
| Invoices/receipts | tables, pages and webhook/readiness foundations | PARTIAL |
| Freeze/reminders | policy + cron + in-app reminders | PARTIAL |

Canonical pricing is not yet clean: later commercial/scale migrations contain 800 ILS and 9,600 annual assumptions. The requested 700 ILS/month annual subscription must be represented by one active plan record controlled by Admin; analytics assumptions must not become billing truth.

## B. Garden tuition: Parent → Garden

| Capability | Evidence | Status |
|---|---|---|
| Per-group price | `kindergarten_fee_groups` | COMPLETE_NEEDS_QA |
| Per-child/month ledger | `child_payment_history` + garden API | COMPLETE_NEEDS_QA |
| Paid/pending months | payment history/status fields and UI | PARTIAL |
| Enrollment payment gate | request status `approved_pending_payment` | PARTIAL |
| Saved payment method/card | token and authorization tables | BACKEND_ONLY |
| Apple Pay/Google Pay/PayBox | preferences/buttons/labels only | UI_ONLY |
| Transfer/standing order/check/manual | recorded as manual method/arrangement | PARTIAL |
| Freeze/activation/reconciliation | statuses exist; reconciliation engine/provider proof absent | PARTIAL |
| Payout destination | `kindergarten_payout_configurations` API foundation | PARTIAL |

No wallet or card surface is classified as real. Parent tuition and platform subscriptions are separate revenue streams and must remain separate. Gan Batuach must not hold or route tuition without an explicit provider/legal architecture.

## Security/provider findings

- Payment mode defaults disabled and live providers require environment configuration.
- Webhook routes exist, but production signatures, idempotency and settlement reconciliation were not verified in this audit.
- Raw card storage is not intended; preserve provider tokenization boundaries.
- **P1:** enrollment activation and payment state changes require a transactional/idempotent contract before live charging.
