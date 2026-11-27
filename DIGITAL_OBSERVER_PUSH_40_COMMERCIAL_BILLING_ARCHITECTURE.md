# DIGITAL OBSERVER — PUSH 40 COMMERCIAL BILLING ARCHITECTURE

Date: 2026-10-19
Scope: Development implementation only
Production payments, Production migrations, paid suppliers and real commercial prices: **disabled / not authorized**

## Canonical boundary

PUSH 40 extends the existing `observer_site_subscriptions` owner. It does not create a second Event, Site, tenant or subscription domain. Digital Observer billing remains separate from Gan Batuach subscriptions and parent-to-kindergarten tuition. A commercial profile (`consumer`, `small_business`, `enterprise`, `oem_reseller`, or `white_label_partner`) classifies the contract; it is not a replacement tenant identity.

The server is the source of truth:

`approved plan version → quote → checkout intent → authenticated provider event → subscription transition → entitlement grant → invoice/refund/reconciliation audit`

A browser success message cannot activate a subscription. An unknown provider outcome remains `unknown` and does not grant entitlements or trigger an uncontrolled retry.

## Plan catalog and prices

`digital_observer_plan_versions` is the immutable versioned commercial catalog. A checkout requires `pricing_status=approved`, an explicit amount/currency, an effective version and recorded approval. Historical seeded package prices are snapshotted as `unapproved`; they remain visible only as legacy configuration and are rejected by checkout. PUSH 40 does not invent or approve a real commercial price.

Each plan carries bounded server entitlements for Sites, cameras, AI, retention, Evidence storage, Investigation, notifications, API, partner features and white-label features. Overage is explicit (`deny`, `warn`, or contract-controlled); no implicit metered overage is activated.

## Subscription lifecycle

The canonical commercial states are `trial`, `active`, `past_due`, `grace_period`, `suspended`, `cancelled`, and `expired`. Invalid transitions fail closed. Trials are single-use and bounded to at most 30 days; the Product uses 14 days. Upgrades require verified payment before activation. Downgrades and customer cancellation are scheduled for the current period boundary. Unsupported proration is never calculated locally.

Payment failures follow a bounded retry policy (one hour, then six hours, then a seven-day grace period) and move through `past_due`/`grace_period`; recovery restores `active`. Unknown outcomes remain unknown and require reconciliation. These conditions create a `SYSTEM_BILLING` notification intent through PUSH 39. In-app notification can be queued after current recipient authorization is checked; external provider delivery remains disabled unless separately approved.

## Provider abstraction and callbacks

Payment adapters expose `DISABLED`, `SANDBOX`, and `PRODUCTION`. Runtime defaults to `DISABLED`. The deterministic adapter is Development contract evidence only. The Production adapter deliberately throws because no supplier or Production activation is authorized.

Callbacks require a provider event ID, timestamp and HMAC signature over the exact raw body. The route enforces a replay window, event/outcome consistency, provider-event uniqueness and checkout identity. Payment history and financial audit rows are append-only. Repeated or concurrent events cannot create a second financial effect; a repeated authenticated callback safely completes a previously interrupted effect rather than creating another charge. Reconciliation is required after any ambiguous outcome.

Refund authorization locks and validates the original confirmed payment, currency and cumulative requested amount. Provider confirmation is required before the refund is called complete. Partial credits remain attached to the internal invoice. A fully confirmed credit marks that internal invoice credited, cancels the associated subscription and revokes its entitlement grants. No tax document is fabricated.

No raw card, CVV, bank credential, provider secret or unrestricted invoice artifact is stored. Tax documents remain `legal_review_required` or provider-controlled until an approved legal/provider process exists.

## Entitlement enforcement

`digital_observer_entitlement_grants` and the subscription snapshot are evaluated on the server. Current enforcement points include Site creation, camera creation, AI event ingestion, Evidence storage, retention limits, notification orchestration and Investigation. Suspended/cancelled/expired subscriptions fail closed, trial and grace expiry are enforced, and numeric limits use current server-measured usage.

Existing Development subscriptions receive a package snapshot so the PUSH 39 regression path is preserved. The snapshot is explicitly marked as not verified payment proof. Future API, partner and white-label enforcement uses the same entitlement vocabulary; PUSH 42 and PUSH 43 retain ownership of public API identity and partner hierarchy/provisioning.

## RLS and financial isolation

The deferred PUSH 25 billing-role issue is closed technically in this migration: `billing` membership no longer satisfies the broad operational `can_access_observer_site` helper used by camera/event/evidence/playback policies. A separate security-definer billing summary returns only safe Site identity fields, and billing tables use a billing-specific Site authorization helper. Browser roles have read-only, tenant-scoped financial views; financial mutation is server/service-only. Partner accounts and reconciliation are platform-admin-only.

This technical closure still requires isolated Development role-negative proof before it can be called verified. It does not change Gan Batuach authorization or kindergarten privacy policy.

## Usage, OEM and white-label boundary

Commercial usage records retain `measured`, `allocated`, `estimated`, and `unknown` evidence classes and link to PUSH 33 operational usage. Partner billing accounts support wholesale contract metadata, customer/Site attribution and settlement reconciliation while explicitly leaving retail pricing with the partner. This is a PUSH 40 commercial foundation, not PUSH 43 OEM/white-label completion.

## Cost architecture

Two independent metrics remain mandatory:

1. infrastructure cost / registered user / month, historical target ₪15;
2. all-in attributable cost / active paying user / month, current ceiling ₪15.

PUSH 40 implements separate calculations and unknown-safe 100/1,000/10,000/100,000 user projections. Compliance is unmeasured until provider invoices, taxes, FX, shared allocation and both denominators are verified. No paid supplier or quota is activated.

## Recovery and retention

The migration is additive and forward-only. Rollback is an application rollback that leaves the new records intact; financial history is not deleted to reverse a release. Checkout/payment/refund/audit records are retained for the later legal/finance retention decision. Raw provider payloads are not retained; only bounded safe metadata and a body digest are stored.

## External completion gates

Development implementation is not commercial launch proof. The canonical activation register keeps payment and notification providers, device actions, mobile Push, OEM integrations, Zero-Install, pilots, legal/privacy and Production deployment disabled until their named owner, approvals, sandbox/real proof, cost and release gates are satisfied.
