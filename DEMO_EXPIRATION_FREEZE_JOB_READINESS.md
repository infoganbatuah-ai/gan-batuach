# Demo Expiration / Freeze Job Readiness

## Status

PROD 1 added a cron-ready endpoint:

- `POST /api/cron/demo-expiration-freeze`

The endpoint is protected with:

- `CRON_SECRET`
- rate limiting through `rate_limit_events`
- server-side Supabase service role only

No scheduler was activated in this phase.

## Business Rule Implemented

The endpoint finds kindergarten subscriptions where:

- `status` is `demo_active` or `trial`
- `trial_ends_at` is in the past
- `admin_override` is false
- no paid subscription payment exists

For each matching subscription it:

- sets subscription `status` to `frozen`
- sets `billing_status` to `suspended`
- sets `trial_status` to `expired`
- records `suspended_at` and `suspension_reason`
- updates the garden payment state to frozen
- sets garden `status` to `suspended`
- creates a manager notification
- writes a kindergarten activation event
- writes an audit log

## How To Run Manually

Use a server-side request with:

```bash
curl -X POST "$APP_URL/api/cron/demo-expiration-freeze" \
  -H "x-cron-secret: $CRON_SECRET"
```

Do not run this against production before confirming the target Supabase project and test data.

## Scheduler Setup Options

Recommended options:

- Vercel Cron calling `/api/cron/demo-expiration-freeze`
- Supabase scheduled function calling the endpoint securely
- Internal admin runbook action that calls the endpoint with `CRON_SECRET`

## Manual Verification

Create or identify a test kindergarten subscription:

- status: `demo_active`
- `trial_ends_at`: more than 3 days after `trial_started_at`, and already in the past
- no `subscription_payments.billing_status = paid`
- no `admin_override`

Expected result:

- subscription becomes `frozen`
- garden becomes `suspended`
- manager gets an in-app notification
- audit log contains `demo_expired_subscription_frozen`
- parent enrollment into that garden is blocked

## Remaining Blocker

Automatic freeze is cron-ready but not production-active until a scheduler is configured and verified.
