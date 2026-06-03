# Digital Observer Billing Automation

This document defines the future standalone Digital Observer billing and subscription automation foundation.

It does not affect Gan Batuach kindergarten billing.

Gan Batuach remains:

- Fixed price: 700 ILS per kindergarten per month
- Digital Observer included
- No separate observer upsell inside Gan Batuach at this stage

## Scope

This billing model applies only to future standalone Digital Observer customers:

- Homes
- Businesses
- Warehouses
- Offices
- Stores
- Parking facilities
- Enterprise customers

## Subscription Lifecycle

Supported statuses:

- trial
- active
- pending_payment
- overdue
- suspended
- cancelled

Tracked lifecycle fields:

- start date
- trial start
- trial end
- current billing period
- renewal date
- cancellation date
- cancellation reason
- suspension date
- suspension reason
- admin override

## Tables

### observer_subscriptions

Stores the future standalone subscription lifecycle per observer site.

Tracks:

- site
- package
- status
- billing cycle
- trial dates
- renewal date
- provider references
- retry schedule
- reminder schedule
- package limits snapshot

### observer_billing_events

Stores mock/readiness automation events:

- trial started
- trial expiring
- renewal reminder
- invoice prepared
- payment failed
- retry scheduled
- overdue marked
- suspended
- cancelled

Channels:

- in_app
- email
- sms
- whatsapp
- push

### observer_usage_tracking

Stores package usage readiness:

- active cameras
- AI events
- storage used
- monitoring hours used
- SMS alerts
- WhatsApp alerts
- push alerts
- email alerts
- playback sessions
- limit checks
- exceeded limits

Default enforcement mode is `observe_only`.

## Billing Readiness

Prepared future capabilities:

- Credit card collection
- Recurring billing
- Invoice generation
- Receipt generation
- Payment failure handling
- Retry schedule
- Renewal reminders
- Trial conversion to paid

No real provider integration is active in this phase.

## Payment Providers

Future provider adapters may include:

- Credit card
- Tranzila
- Meshulam
- Pelecard
- Grow
- Stripe
- Manual billing

Provider secrets must remain server-side only.

## Trial Management

Future trial flow:

1. Site owner creates standalone observer site.
2. Admin or customer selects package.
3. Trial starts.
4. Reminders are queued before trial end.
5. Customer converts to paid plan.
6. If no payment is added, status becomes pending_payment or overdue.
7. If unresolved, subscription may be suspended.

## Reminder Automation

Reminder readiness supports:

- Trial ending soon
- Renewal upcoming
- Payment failed
- Payment retry scheduled
- Subscription overdue
- Suspension warning

Future channels:

- Email
- SMS
- WhatsApp
- Push
- In-app

Current phase stores mock events only.

## Package Enforcement Readiness

Future package checks:

- Camera limit
- Monitoring hour limit
- Storage limit
- AI event type limit
- Recording availability
- SMS / WhatsApp alert availability
- Multi-user access

Important: enforcement must only apply to standalone observer sites unless explicitly designed otherwise. It must not block Gan Batuach kindergarten flows.

## Admin Dashboard

Readiness route:

- `/dashboard/admin/observer-billing`

The dashboard shows:

- active subscriptions
- trials
- pending / overdue accounts
- revenue readiness
- package distribution
- mock billing events
- usage and limit tracking

## Customer Billing Readiness

Future site owner view should show:

- current package
- next renewal
- billing history
- invoices
- payment status
- usage versus package limits

No customer payment screen is active yet.

## Remaining Integration Work

- Real payment provider adapter
- Invoice and receipt provider
- Automatic renewal worker
- Failed payment retry worker
- Communication jobs for reminders
- Real usage aggregation
- Customer billing UI
- Legal terms and cancellation policy
- Tax/VAT policy
