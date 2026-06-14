# Digital Observer Standalone Commercial Launch

## Overview

Phase 184 prepares Digital Observer for its first standalone commercial launch as an independent product experience while still safely using the existing Gan Batuach codebase and infrastructure.

This phase does not:

- remove `/digital-observer`
- create a new GitHub repository
- create a new Supabase project
- create a new Vercel project
- activate live billing automatically
- enable restricted AI capabilities automatically
- mix Digital Observer billing with Gan Batuach or parent tuition payments

## Launch Architecture

Current architecture:

```text
Gan Batuach project
  -> /digital-observer
  -> shared Supabase
  -> shared Vercel
  -> shared GitHub repo
```

Launch mode:

```text
Digital Observer commercial surface
  -> public website
  -> demo/start flows
  -> lead capture
  -> admin follow-up
  -> observer site onboarding
  -> trial/payment readiness
```

## Customer Journey

Visitor  
→ Digital Observer website  
→ chooses use case  
→ request demo or start monitoring  
→ lead created  
→ admin follows up  
→ observer site created  
→ package selected  
→ cameras added  
→ monitoring goals configured  
→ trial started  
→ payment readiness  
→ active customer

## Packages

Launch-ready packages:

- Home Basic
- Home Plus
- Business Basic
- Business Pro
- Enterprise Monitoring

Each package should define:

- camera limit
- monitoring hours
- retention readiness
- alert channels
- user limit
- AI capabilities
- trial availability
- monthly price
- annual price
- upgrade readiness

If pricing is not finalized, use “starting from” or “contact us”.

## Billing Separation

Revenue streams:

1. Gan Batuach subscriptions  
   Kindergarten → Gan Batuach

2. Parent tuition payments  
   Parent → Kindergarten

3. Digital Observer subscriptions  
   Digital Observer customer → Digital Observer product account

Do not mix:

- invoices
- dashboards
- revenue reports
- payment provider configuration
- billing emails
- accounting exports

## Support Workflows

Launch support workflows:

- camera setup failed
- RTSP unknown
- DVR/NVR channel issue
- gateway unavailable
- playback issue
- alerts too noisy
- missed alert
- billing issue
- package upgrade
- cancellation request

## Launch Modes

### Soft Launch

Env:

`DIGITAL_OBSERVER_SOFT_LAUNCH=true`

Meaning:

- product visible
- lead forms active
- onboarding controlled
- paid subscriptions optional
- admin approval required for activation
- limited customers

Default remains false.

### Commercial Launch

Env:

`DIGITAL_OBSERVER_COMMERCIAL_LAUNCH=true`

Meaning:

- public site active
- demo requests active
- start monitoring active
- onboarding active
- packages active
- payment readiness active if configured

Default remains false.

## Analytics

Track:

- visits
- demo requests
- start monitoring clicks
- leads
- converted leads
- trial starts
- packages selected
- cameras connected
- first alert created
- paid conversions
- cancellations

## Decision Model

Admin launch decisions:

- not_ready
- needs_more_beta
- soft_launch_ready
- commercial_launch_ready
- pause_launch

Decision factors:

- package readiness
- billing readiness
- camera setup success
- support readiness
- legal/capability readiness
- customer demand
- launch blockers

## Remaining Launch Gaps

- complete launch QA
- finalize pricing or keep “starting from/contact us”
- configure live payment provider only after approval
- complete legal/capability review
- prove gateway capacity
- verify support load
- keep Gan Batuach regression-free
