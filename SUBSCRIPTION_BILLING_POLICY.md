# Gan Batuach Subscription And Billing Policy

This document defines the V2A subscription enforcement and billing infrastructure policy.

## Plan Types

- Trial Plan
- Monthly Plan
- Annual Plan
- Custom Enterprise Plan

Each plan may define:

- price
- currency
- duration
- trial duration
- active user limit
- active child limit
- camera limit
- storage limit
- enabled features

## Subscription Statuses

- `active`: paid or manually approved subscription
- `trial`: free trial is active
- `pending_payment`: renewal/payment is being handled
- `suspended`: management actions limited
- `expired`: subscription expired
- `cancelled`: customer cancelled

## Enforcement Policy

When subscription is `active`, `trial` or `pending_payment`:

- Owner/manager access remains open.
- Staff access remains open.
- Parent access remains open.
- Management actions remain open.

When subscription is `expired`, `suspended` or `cancelled`:

- Owner access remains open.
- Manager access remains open for review and renewal.
- Parents keep access to historical child data.
- Admin can override.
- New management actions may be limited:
  - creating new children
  - creating new staff
  - creating new parent leads
  - sending new bulk parent messages
  - opening camera playback
  - updating finance records

Important:

- Do not lock the kindergarten owner out of the account.
- Do not hide historical parent/child data from parents.
- Do not delete data because of payment status.
- Use admin override for support, disputes and grace periods.

## Trial Policy

- Trial plans may define `trial_days`.
- Reminder sequence should run before and after trial end.
- At trial end, status becomes `pending_payment` or `expired` depending on commercial policy.
- Admin can convert trial to paid manually until payment provider integration is connected.

## Reminder Schedule

Generate in-app reminders at:

- 30 days before expiration
- 14 days before expiration
- 7 days before expiration
- 3 days before expiration
- 1 day before expiration
- expiration day
- after expiration

Future channels:

- SMS
- WhatsApp
- Push notifications

## Payment Provider Strategy

The platform uses an adapter model and is not locked to one provider.

Future providers:

- Credit Card
- Tranzila
- Meshulam
- Pelecard
- Grow
- Stripe

V2A implementation:

- manual provider is active
- future providers are represented as adapter placeholders
- no accounting provider is connected yet

## Invoice And Receipt Policy

Billing records support:

- invoice number
- receipt number
- payment reference
- payment method
- billing status
- provider payment id

Accounting integration is future work. Until then, records are operational tracking, not a replacement for a certified accounting system unless approved by finance/legal.

## Audit Logging

Log:

- plan created/updated
- subscription created/updated
- status changed
- admin override
- suspension/reactivation
- upgrade/renewal request
- payment record created/updated
- invoice/receipt created

## V2A Known Limits

- No live payment gateway yet.
- No automatic credit card charge yet.
- No certified accounting provider yet.
- SMS/WhatsApp/Push reminders are future channels.
- Enforcement is policy-driven and should be wired into individual mutation routes gradually.
