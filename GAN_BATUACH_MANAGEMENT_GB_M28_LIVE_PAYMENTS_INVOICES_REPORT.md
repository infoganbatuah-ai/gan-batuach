# GB-M28 — Live payments and invoices

## Before State
GB-M26 and GB-M27 established separate subscription and tuition models. The generic provider webhook still could activate a platform subscription or mark an invoice paid from signed payload IDs without a pre-existing checkout intent, amount/currency comparison or gateway-specific verification. Its duplicate handler also replaced the original event status with `replayed`. The sandbox checkout surface was readiness-only but could say `sandbox_ready` without an actual checkout adapter.

## Provider Architecture
The existing provider inventory, webhook event journal and safety modes are retained. `financial-provider-policy` evaluates explicit evidence gates; `financial-provider-capability` projects current capabilities. No provider-specific adapter is installed. Generic HMAC is only transport authentication and can retain an ignored event for manual review; it is not provider payment confirmation. No parallel financial ledger was created.

## Platform / Tuition Separation
GB-M26 `kindergarten_subscriptions` and GB-M27 `tuition_billing_periods` remain independent. The generic webhook no longer mutates either from an unbound event. No payment purpose is inferred from amount or client metadata.

## Provider Readiness States
The capability vocabulary is `not_configured`, `disabled`, `sandbox`, `verified_test`, `live`. Mode or credential presence alone never yields checkout availability. In this release verified adapter, account, webhook and live-enable evidence are false, so checkout/live charges/tax documents remain false. The Admin readiness API and public safe readiness projection expose this truth without secrets.

## Checkout Flow
No hosted checkout adapter or authoritative session API exists. The existing Garden sandbox endpoint remains a readiness-only response with `checkout_url: null`; it no longer calls this `sandbox_ready`. Parent and Garden are not offered a false card success path. Future checkout must bind purpose, Garden, resource, amount, currency and a provider idempotency key before redirect.

## Webhook Verification
The generic route rejects missing or invalid HMAC before parsing an event and rejects a payload provider that differs from server configuration. Its HMAC is not the unimplemented gateway-specific signature/timestamp/account verification, so signed events remain `ignored` with no financial side effect. If the secret is absent it returns 503. Invalid signature returns 401 with no event mutation.

## Event Normalization
Known generic event labels normalize to internal names for safe event metadata; unknown events normalize to `unsupported`. Normalization does not confer financial authority.

## Idempotency
The existing `(webhook_key,idempotency_key)` uniqueness remains. A repeated signed event returns duplicate status without changing the original journal row. No settlement or document issuance callback runs from this generic endpoint.

## Platform Subscription Settlement
Deliberately unavailable: a provider-specific verified event must call a GB-M26 locked transition using the bound subscription period and agreed snapshot. The previous unbound direct update was removed.

## Tuition Settlement
Deliberately unavailable: a verified provider adapter must apply the payment to exact GB-M27 period(s), preserving partial balance and unapplied credit. No Parent tuition amount is derived from platform billing.

## Enrollment Activation Integration
GB-M16 service-role electronic confirmation remains the canonical activation transaction. The generic webhook never calls it. A future adapter must validate the bound request, reservation, amount and provider event before invoking it once.

## Reconciliation
Signed generic events are retained as non-settling journal entries. Payment confirmed by a future gateway but not applied to a domain must require reconciliation, not a second charge. This cannot be end-to-end verified without a chosen gateway and test account.

## Refund / Reversal
No automated refund is exposed. Existing paid history is never erased. Provider-specific refund/chargeback event mapping and ledger reversal need a verified account and sandbox tests.

## Apple Pay
Unavailable. No merchant/domain/device verification or provider wallet capability has been proven.

## Google Pay
Unavailable for the same reason.

## PayBox
No embedded verified PayBox adapter exists. It may only be presented as an explicitly configured external/manual method, never as in-app paid proof.

## Invoice / Receipt Provider
Green Invoice, iCount and Morning Production rows are `not_configured` or mock with no verified webhook. Generic invoice events cannot mark an invoice paid or issue a document. No official-looking tax document is fabricated.

## Invoice Idempotency
No issuance path is enabled. A future issuer must uniquely bind each intended document type to a verified payment and retain retryable failures without rolling back payment truth.

## Security / Secrets / PCI Boundary
No raw card/CVV or wallet token is handled. Secrets remain server-side; public readiness exposes only state and booleans. Forged HMAC is rejected before parsing. Generic provider payload IDs cannot mutate Garden subscription, tuition or invoice rows. Admin readiness returns 401/403 before exposing the inventory.

## UI Truthfulness
Garden subscription and Admin provider views no longer mark payment ready merely because the mode is `live`. The sandbox-checkout response says readiness only. Wallet and receipt capability is false.

## Tests
Focused tests verify capability gates, normalization, forged/malformed HMAC, provider mismatch and absence of generic financial mutations (5/5). Management regression (217/217), GB-M16 (8/8), GB-M26 (5/5), GB-M27 (3/3), Parent contract (20/20), domain QA (29 suites), security QA (7 tests), migration audit (227 migrations), typecheck and lint regression passed. The first local build was restricted by the sandbox's temporary-port policy; it was retried in the permitted build environment. No synthetic test is reported as a real provider transaction.

## Live / Sandbox QA
`LIVE PAYMENT QA: BLOCKED BY ENVIRONMENT/PROVIDER`. Production metadata has no verified card/invoice provider, no successful webhook test and no controlled sandbox merchant account. No customer charge was attempted.

## Production Provider State
Cardcom, Meshulam, Pelecard and Tranzila are `not_configured`/`disabled`; candidate invoice providers are `not_configured`/`mock`. Generic webhook endpoint rows labelled `configured` do not prove delivery verification. No mode was switched to live.

## Cost / Usage
Pre-release read-only check: Vercel Pro showed $18.11 of $20 included credit used and a zero on-demand budget; Supabase Pro reported no quota exceedance, 0 GB current-cycle egress and a 2 GB provisioned project disk. This change adds no polling, paid provider, tax issuance, migration or customer charge.

## Carried QA Debt
GB-M21–M27 controlled browser role journeys, private evidence retrieval and separate-connection races remain for GB-M35/40. GB-M28 adds real gateway checkout, signed callback, duplicate delivery, invoice failure and refund tests once a sandbox provider exists.

## Remaining Debt
Choose and validate a payment gateway and authorized invoice issuer; establish merchant-of-record/payout and accounting policy; implement hosted checkout, provider-native signature and timestamp checks, bound payment intent, locked GB-M26/27 settlement, GB-M16 activation, reconciliation and document retries. The technical state is partial until these are proven in a controlled environment.

## Inputs For GB-M29
Messages/notifications may reflect only canonical financial states. A browser redirect, generic HMAC, sandbox fixture or ignored webhook is never payment success. Digital Observer core diff: 0.
