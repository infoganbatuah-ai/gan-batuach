# PILOT FIX 5 - Payment / Subscription Flow Validation

Date: 2026-07-03

## Routes And APIs Reviewed

- `/dashboard/garden/subscription`
- `/dashboard/garden/finance`
- `/dashboard/parent/payments`
- `/dashboard/admin/subscriptions`
- `/dashboard/admin/billing`
- `/dashboard/admin/integrations`
- `/digital-observer/billing`
- `/api/garden/subscription`
- `/api/garden/subscription/sandbox-checkout`
- `/api/garden/child-payments`
- `/api/webhooks/payment`
- `/api/webhooks/payment-provider`
- `/api/webhooks/invoice`
- `lib/domain/billing.ts`
- `lib/domain/provider-webhooks.ts`

## Result

| Check | Result | Notes |
|---|---|---|
| Manager subscription route builds | PASS | readiness state route exists |
| Parent tuition routes build | PASS | separate parent payment surfaces exist |
| Digital Observer billing route builds | PASS | separate billing stream exists |
| Sandbox checkout API exists | PASS | no live checkout was triggered |
| Provider webhooks exist | PASS | signature/idempotency readiness documented previously |
| Live payment activated | NO | no live mode or card collection |
| Fake payment success shown | NOT_OBSERVED_STATICALLY | manual UI validation still required |

## Required Manual Tests

- Manager A sees only Kindergarten A subscription state.
- Parent A sees tuition/readiness only, not Gan Batuach platform subscription records.
- Digital Observer billing remains separate from Gan Batuach subscription.
- Sandbox checkout stays sandbox/manual and does not collect real card data.
- Provider webhook/event records are not visible to parent/staff/inspector.

## Status

Payment/subscription flow status: **READINESS_ONLY / READY_FOR_SYNTHETIC_E2E**

Commercial launch remains blocked.
