# PILOT FIX 8 - Pilot Payment Mode Closure

Date: 2026-07-05

## Payment Mode Result

Current implementation supports a pilot-safe posture:

- Manager subscription requests use a manual/readiness adapter.
- Sandbox checkout readiness route returns `live_payment: false`.
- No real checkout URL is created unless future provider configuration is added.
- Webhook side effects are guarded by live/production mode, complete configuration, valid signature, and supported event type.
- Card data is not stored by the application.

## Screens Checked

| Surface | Result |
|---|---|
| Manager subscription screen | Honest manual/sandbox/readiness language; separates parent tuition. |
| Admin subscription manager | Manual billing only; provider adapters described as future/controlled. |
| Parent payments | Parent tuition state is separate; no platform live checkout claim. |
| Provider production dashboard | States live activation requirements and no default live charge. |

## Pilot-Safe Payment Modes

- manual payment tracking
- sandbox checkout readiness
- disabled payment with clear message
- demo subscription status

## Not Allowed

- fake successful payment
- hidden live mode
- real charge without explicit approval
- card data storage
- parent tuition mixed with platform subscription

## Closure Recommendation

Payment recommendation: manual_or_sandbox_subscription_only.

Live payment remains blocked until explicit provider setup, webhook verification, legal/accounting signoff, and production payment approval.
