# DIGITAL OBSERVER — COST ATTRIBUTION ARCHITECTURE

Date: 2026-09-10
Contract: `observer-cost-usage-v1`

## Boundary

Cost Intelligence measures operating resources. It does not set customer price, create invoices, enforce subscriptions, or change the PUSH 32 route. PUSH 40 remains the owner of billing and subscription behavior.

The canonical path is:

`canonical telemetry / AI result → normalized usage → versioned rate (if available) → attributed operational cost → authorized report`

Missing rate or invoice data remains `UNKNOWN` / `NOT RECONCILED`; it is never converted to zero.

## Canonical usage record

Every record carries resource/provider, tenant, Site, optional camera/source, optional AI job/model, optional execution target, quantity/unit, time window, currency, rate/version, calculated cost, provenance and attribution quality. Stable idempotency keys prevent retry duplication. Secret-like fields are rejected.

Supported resource classes are AI inference, CPU/GPU/Edge compute, ingress/egress bandwidth, storage, Evidence storage, database, hosting, notification and external provider. Customer-owned DVR/VMS storage is outside Digital Observer Cloud cost unless Digital Observer actually pays for it.

## Provenance and confidence

- `DIRECTLY_METERED`: quantity comes from an operational meter; its monetary rate may still be absent.
- `PROVIDER_RECONCILED`: calculated cost is compared with an authorized provider bill/usage source.
- `ALLOCATED`: shared cost is distributed under a named, inspectable policy.
- `ESTIMATED`: rate or resource assumption is explicit and versioned.
- `UNKNOWN`: a required rate or meter is unavailable.

Currency is never silently converted or mixed. Any future conversion must preserve currency pair, rate, timestamp and source.

## AI and routing integration

The portable inference worker emits an optional post-result usage observation. The cost record inherits AI job, tenant, Site, camera, model/version, route decision and execution target. Cost does not derive from detector confidence. PUSH 32 continues to select only policy-eligible targets and does not yet optimize by cost.

## Shared allocation and empty channels

Direct costs remain direct. Shared hosting/database/worker-pool cost may be allocated only with an explicit policy and denominator. The supplied equal-share policy uses expected physical cameras. `CHANNEL_EMPTY`, `UNASSIGNED` and disabled slots are excluded. In the current Home, the denominator is 11 physical cameras, never 17 DVR/source slots.

## Security

The API and UI require the dedicated Digital Observer platform-admin claim. Cost tables use RLS and expose no customer-facing policy. Tenant/Site/camera filters are server-side. Raw frames, private URLs, provider credentials and device secrets are prohibited from usage provenance. Cost cannot override target eligibility, privacy, or an approved quality gate.

## Observability and anomaly foundation

Reports expose usage, known/unknown cost, category, target/model and attribution quality. Anomaly detection compares normalized quantities against a stated baseline and emits a signal only; it does not shut down monitoring or change Product policy.
