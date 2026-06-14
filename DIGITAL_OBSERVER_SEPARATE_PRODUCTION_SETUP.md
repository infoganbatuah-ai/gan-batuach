# Digital Observer Separate Production Setup

## Goal

Prepare Digital Observer for a separate production setup while keeping Gan Batuach safe and fully operational.

This phase does not create real external resources, does not move production data and does not remove `/digital-observer`.

## Current Architecture

```text
Gan Batuach project
  -> /digital-observer routes
  -> shared Supabase
  -> shared Vercel
  -> shared GitHub repo
```

## Target Architecture Options

### A. Route-Only Separation

Digital Observer remains under:

`/digital-observer`

This is the current safest mode.

### B. Domain-Only Separation

Custom domain routes to `/digital-observer` in the same Vercel project.

Example:

`observer.gan-batuach.co.il`

### C. Separate Vercel Project

Digital Observer gets a separate Vercel project from the same repository.

This should wait until paid beta validation and QA.

### D. Separate Supabase Later

Digital Observer data may eventually move to a separate Supabase project.

Do not move data in this phase.

### E. Full Repository Separation Later

Only if product maturity, support volume and business needs justify it.

## Domain Setup

Possible domains:

- `observer.gan-batuach.co.il`
- `digital-observer.co.il`
- `app.digitalobserver.ai`
- `app.digital-observer.co.il`

Required later:

- DNS records
- Vercel custom domain
- SSL verification
- redirect rules
- rollback path

## Host-Based Routing

Host routing is prepared but disabled by default.

Required env:

```text
DIGITAL_OBSERVER_CUSTOM_DOMAIN_ENABLED=false
DIGITAL_OBSERVER_PUBLIC_HOST=
DIGITAL_OBSERVER_APP_HOST=
GAN_BATUACH_PUBLIC_HOST=
```

When enabled later, matching Digital Observer hosts may route to `/digital-observer`.

## Environment Strategy

Digital Observer env group:

- `DIGITAL_OBSERVER_STANDALONE_ENABLED`
- `DIGITAL_OBSERVER_CUSTOM_DOMAIN_ENABLED`
- `DIGITAL_OBSERVER_SEPARATE_BILLING_ENABLED`
- `DIGITAL_OBSERVER_SEPARATE_SUPABASE_ENABLED`
- `DIGITAL_OBSERVER_PRODUCT_MODE`
- `DIGITAL_OBSERVER_PUBLIC_HOST`
- `DIGITAL_OBSERVER_APP_HOST`
- `DIGITAL_OBSERVER_PAYMENT_PROVIDER`
- `DIGITAL_OBSERVER_PAYMENT_MODE`
- `DIGITAL_OBSERVER_INVOICE_PROVIDER`
- `DIGITAL_OBSERVER_CAMERA_GATEWAY_URL`
- `DIGITAL_OBSERVER_AI_PROVIDER`
- `DIGITAL_OBSERVER_SUPPORT_EMAIL`
- `DIGITAL_OBSERVER_DEFAULT_PACKAGE`

No real secrets should be committed.

## Supabase Strategy

Current recommendation:

Shared Supabase for now.

Separation relies on:

- `product_type`
- `observer_site_id`
- observer site owner/member records
- capability profiles
- RLS

Future separate Supabase migration checklist:

- `observer_sites`
- `observer_site_members`
- `observer_subscriptions`
- `observer_usage_tracking`
- `camera_streams`
- `camera_gateways`
- `observer_intelligence_signals`
- AI model registry
- audit logs
- billing records

## Product Context Separation

Helper:

`lib/domain/product-context.ts`

Supports:

- `getProductContext()`
- `assertDigitalObserverContext()`
- `assertGanBatuachContext()`
- `isDigitalObserverRoute()`
- `isGanBatuachRoute()`

New Digital Observer routes should use Digital Observer context and avoid kindergarten-only identifiers.

## Billing Separation

Revenue streams:

1. Gan Batuach subscription  
   Kindergarten -> Gan Batuach

2. Parent tuition payments  
   Parent -> Kindergarten

3. Digital Observer subscription  
   Digital Observer customer -> Digital Observer product account

Do not mix invoices, dashboards, accounting exports, payment providers or revenue reports.

## Customer Routes

Prepared routes:

- `/digital-observer/dashboard`
- `/digital-observer/onboarding`
- `/digital-observer/sites`
- `/digital-observer/sites/[id]`
- `/digital-observer/cameras`
- `/digital-observer/alerts`
- `/digital-observer/billing`
- `/digital-observer/settings`

## QA Checklist

Gan Batuach:

- homepage
- login
- manager dashboard
- parent dashboard
- staff dashboard
- inspector dashboard
- admin dashboard
- payments
- onboarding

Digital Observer:

- public page
- onboarding
- dashboard
- site creation
- camera setup
- billing
- alerts
- admin view

## Rollback

If separation fails:

- disable custom Digital Observer domain
- keep `/digital-observer`
- keep shared Supabase
- keep existing routes
- preserve customers
- preserve billing records
- preserve leads

## Remaining Manual Steps

- select real domain
- configure DNS
- configure Vercel project only when approved
- configure production env vars
- complete QA
- review legal/capability matrix
- rehearse rollback
- validate paid beta evidence
