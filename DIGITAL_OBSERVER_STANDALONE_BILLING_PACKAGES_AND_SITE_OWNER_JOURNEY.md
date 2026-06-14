# Digital Observer Standalone Billing, Packages and Site Owner Journey

Status: commercial readiness inside the existing Gan Batuach project. No live payment charging is activated by this phase.

## Purpose

Phase 177 turns Digital Observer into a standalone commercial product journey for homes, offices, businesses, warehouses, stores, parking lots and custom monitored sites.

Digital Observer continues to reuse the existing camera, AI, observer, workflow, audit, usage and billing infrastructure. It does not create a new repository, Supabase project or Vercel project.

## Site Owner Journey

Digital Observer customer journey:

1. Create account
2. Choose site type
3. Choose package
4. Add site details
5. Add cameras
6. Configure monitoring goals
7. Configure alert channels
8. Review privacy/security settings
9. Start trial or subscription

This journey is separate from Gan Batuach kindergarten manager onboarding.

## Supported Site Types

Current standalone types:

- home
- office
- business
- warehouse
- store
- parking_lot
- custom

Future-ready regulated or special verticals:

- school
- municipality
- construction_site
- clinic
- factory

Future or regulated verticals are not enabled automatically.

## Package Model

Canonical package table:

- `observer_monitoring_packages`

Alias/readiness view:

- `observer_packages`

Packages:

- Home Basic
- Home Plus
- Business Basic
- Business Pro
- Enterprise Monitoring

Each package tracks:

- camera limit
- monitoring hours
- event retention days
- recording retention readiness
- AI event types enabled
- live view enabled
- alert channels
- multi-user access
- advanced analytics
- human review required
- monthly price
- annual price

## Package Feature Matrix

Home Basic:

- small camera limit
- event-only monitoring
- in-app alerts
- short event retention
- no recording retention
- no advanced analytics

Home Plus:

- more cameras
- night monitoring
- longer retention
- SMS/WhatsApp/push readiness
- recording retention readiness
- multi-user readiness

Business Basic:

- business hours / night monitoring
- more cameras
- event review
- camera health monitoring
- email/SMS/WhatsApp/push readiness

Business Pro:

- higher camera limit
- custom schedule
- advanced analytics readiness
- multiple users
- priority alerts

Enterprise Monitoring:

- custom camera limits
- custom monitoring hours
- custom retention
- SLA readiness
- custom pricing

## Subscription Model

Primary subscription table:

- `observer_site_subscriptions`

The subscription model tracks:

- observer site
- package
- subscription status
- trial start
- trial end
- renewal date
- billing cycle
- monthly price
- annual price
- suspension
- cancellation
- grace period
- pending package changes

Supported subscription statuses:

- trial
- active
- pending_payment
- overdue
- expired
- suspended
- cancelled

## Trial Flow

Trial readiness supports:

- trial start
- trial end
- trial reminders
- trial conversion
- trial expired state

Trial mode should not activate unrestricted production monitoring by default.

## Billing Separation

Digital Observer billing is separate from all Gan Batuach billing streams.

Revenue streams:

- Digital Observer customer -> Digital Observer product account
- Gan Batuach kindergarten -> Gan Batuach subscription account
- Parent tuition payments -> kindergarten account

Do not mix:

- Digital Observer subscriptions
- Gan Batuach kindergarten subscriptions
- parent tuition payments
- kindergarten parent payments

## Payment Provider Readiness

Provider readiness table:

- `observer_payment_provider_readiness`

Future providers:

- Stripe
- Cardcom
- Tranzila
- Meshulam
- Pelecard

Rules:

- no raw card data
- no real live charge unless provider mode is explicitly enabled
- provider secrets must remain server-side
- webhooks must be verified before live mode

## Usage Tracking

Usage tables:

- `observer_usage_tracking`
- `observer_site_usage_snapshots`

Tracked per site:

- active cameras
- AI events this month
- storage used
- monitoring hours used
- alerts sent
- playback sessions
- users invited
- failed camera checks
- live view sessions
- package limit status

## Package Limit Enforcement Readiness

Limit checks are tracked in:

- `observer_package_limit_checks`

Prepared checks:

- cannot add camera beyond package limit
- monitoring paused if subscription expired
- recording disabled if package does not include it
- advanced analytics disabled if package does not include it
- alert channels limited by package

These checks apply to standalone Digital Observer sites unless explicitly configured otherwise. They do not break Gan Batuach camera flows.

## Monitoring Schedules

Schedule table:

- `observer_monitoring_schedules`

Supported modes:

- 24/7
- night only
- business hours
- custom schedule
- event-only mode

Stored fields:

- timezone
- active days
- active hours
- schedule JSON
- status

## Alert Channel Settings

Alert channel table:

- `observer_alert_channel_settings`

Supported channels:

- in-app
- email
- SMS
- WhatsApp
- push

Configuration supports:

- who receives alerts
- which channels are enabled
- severity levels
- package allowed flag
- provider mode

## Multi-User Site Access

Membership table:

- `observer_site_memberships`

Supported roles:

- owner
- admin
- viewer
- reviewer
- billing
- operator

Owner permissions:

- billing
- package
- cameras
- users
- alerts

Viewer permissions:

- view dashboard
- view allowed cameras
- view allowed events

Reviewer permissions:

- review observer alerts
- comment on events

## Digital Observer Billing View

Route:

- `/digital-observer/billing`

Shows:

- current package
- subscription status
- trial status
- renewal date
- usage vs limits
- invoices
- upgrade/downgrade readiness
- cancellation/suspension readiness
- payment provider readiness
- billing separation

## Upgrade / Downgrade Readiness

Change request table:

- `observer_subscription_change_requests`

Prepared flows:

- package upgrade
- package downgrade
- cancellation
- resume
- suspension
- prorated billing readiness
- renewal-effective changes

No live provider charging occurs unless configured externally.

## Invoice Readiness

Invoice table:

- `observer_invoices`

Digital Observer invoices are separate from:

- Gan Batuach kindergarten invoices
- parent tuition receipts

Invoice readiness tracks:

- invoice number
- observer site
- site owner
- package
- amount
- billing cycle
- status
- PDF readiness
- invoice provider

## Cancellation and Suspension

If suspended:

- monitoring should be disabled
- billing/support access should remain available
- historical data remains governed by retention policy
- package limits should block new monitoring actions

Cancellation readiness supports:

- site owner cancellation request
- admin suspension
- expired subscription
- overdue payment
- grace period handling

## Product Analytics

Analytics table:

- `observer_product_analytics`

Tracked events:

- onboarding started
- site created
- package selected
- trial started
- camera added
- first alert created
- billing started
- trial converted
- churn risk

## Capability and Legal Profile

Observer goals must pass through the capability matrix.

Sensitive capabilities are not enabled automatically:

- face recognition
- audio analytics
- gait recognition
- biometric matching

Each site type should classify capabilities as:

- allowed
- disabled
- legal_review_required
- consent_required
- future_only

## Remaining Provider Setup

Remaining external steps:

- configure payment provider credentials
- configure invoice provider
- implement live checkout/session creation
- verify payment webhooks
- verify invoice webhooks
- define product account settlement flow
- complete legal review for subscription terms
- finalize cancellation and refund policy
- validate tax/VAT invoice obligations
- run security review before live billing
