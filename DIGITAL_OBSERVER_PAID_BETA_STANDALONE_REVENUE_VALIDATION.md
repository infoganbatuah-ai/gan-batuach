# Digital Observer Paid Beta Standalone Revenue Validation

## Overview

Phase 181 creates the paid beta operating layer for Digital Observer as a standalone business line inside the current Gan Batuach project.

No new repository, Supabase project or Vercel project is created in this phase.

## Paid Beta Model

Core tables:

- `digital_observer_beta_customers`
- `digital_observer_beta_sites`
- `digital_observer_beta_funnel_stages`
- `digital_observer_beta_subscriptions`
- `digital_observer_beta_invoices`
- `digital_observer_customer_health_scores`
- `digital_observer_product_market_fit_signals`
- `digital_observer_beta_launch_decisions`

## Customer Journey

Lead → Demo → Trial → Camera setup → First alerts → Customer feedback → Package confirmation → Payment → Paid beta

## Billing Separation

Revenue Stream A:

Gan Batuach subscriptions → Gan Batuach company account

Revenue Stream B:

Parent tuition payments → Kindergarten account/provider

Revenue Stream C:

Digital Observer subscriptions → Digital Observer product/company account

The platform must not mix invoices, dashboards or revenue streams unless clearly labeled by product.

## Package Validation

The beta validates:

- package selected
- package rejected
- requested package changes
- price objection
- camera limit issue
- monitoring hours issue
- alert channel issue
- retention issue
- upgrade interest

## Pricing Validation

For each customer, track:

- proposed monthly price
- proposed annual price
- discount offered
- accepted price
- rejected price
- rejection reason
- expected lifetime value
- support cost estimate

## Support Model

Paid beta support playbooks cover:

- camera cannot connect
- RTSP path unknown
- DVR channel issue
- gateway unavailable
- alert too noisy
- alert missed
- payment failed
- invoice issue
- package upgrade request
- cancellation request

## Health And Churn

Customer health score uses:

- setup completion
- camera stability
- alert value
- usage frequency
- support load
- payment status
- satisfaction
- churn risk

Churn risk triggers include:

- no camera connected
- no alerts reviewed
- too many false alerts
- payment failed
- unresolved support
- low login frequency
- negative feedback
- package mismatch

## Launch Decision

Standalone launch should remain blocked until enough evidence exists for:

- real paid customers
- camera setup success
- useful alerts
- manageable support load
- pricing acceptance
- legal/capability safety

## Remaining Standalone Business Gaps

- external legal review of paid beta terms
- external review of privacy notice
- live payment provider setup
- invoice provider setup
- real customer evidence
- support cost benchmark
- package pricing confirmation
- future standalone infrastructure extraction decision
