# SMS Production Readiness

## Goal

Prepare Gan Batuach for production SMS delivery without sending real SMS messages yet.

The current implementation is mock / dry-run only. It creates provider architecture, template records, opt-in records, delivery logs, and retry readiness.

## Provider Architecture

Provider abstraction:

- `lib/domain/sms-provider.ts`

Queue/log service:

- `lib/domain/sms-service.ts`

Supported providers:

- `mock_sms`
- `twilio`
- `messagebird`
- `israeli_local`
- future custom providers

All real providers currently return dry-run results only.

## Environment Variables

Server-only:

- `SMS_PROVIDER`
- `SMS_API_KEY`
- `SMS_FROM_NUMBER`
- `SMS_PROVIDER_ACCOUNT_ID`
- `SMS_REAL_SEND_ENABLED=false`

Keep `SMS_REAL_SEND_ENABLED=false` until production approval.

## Template Events

Prepared SMS events:

- registration verification
- password reset
- parent approval
- child approval
- safety alerts
- payment reminders
- inspection reminders

Template table:

- `sms_templates`

Statuses:

- draft
- active
- paused
- disabled

## Delivery Tracking

Dedicated SMS logs:

- `sms_message_logs`

Statuses:

- queued
- sent
- delivered
- failed
- dead_letter

Provider references:

- provider
- provider_message_id
- provider_reference
- failure_reason

## Retry Readiness

The SMS log model includes:

- retry_attempts
- max_retry_attempts
- next_retry_at
- dead_letter_at

Future worker behavior:

1. Find failed logs with `next_retry_at <= now()`.
2. Retry until `max_retry_attempts`.
3. Move to `dead_letter` after repeated failure.
4. Show dead letters in admin dashboard.

## Consent Readiness

Dedicated opt-in table:

- `sms_opt_ins`

General communication preferences still apply:

- `communication_preferences.receive_sms`
- emergency preference fields

Real SMS should not be sent until opt-in wording is approved.

## Admin Dashboard

Route:

- `/dashboard/admin/sms`

Shows:

- provider readiness
- delivery status
- failures
- retry schedule
- templates
- opt-in count

## Real Sending Policy

Real sends are intentionally disabled in this phase.

Before enabling real sending:

- choose provider
- verify sender ID / phone number
- implement delivery webhooks
- approve consent wording
- approve retry policy
- set production secret values
- explicitly enable real sending

## Testing Checklist

Mock-only:

- SMS templates exist.
- Admin dashboard loads.
- Readiness reports missing provider env vars.
- Queue helper creates `sms_message_logs`.
- Invalid phone creates failed log with retry schedule.
- No real network call is made.

Future production:

- provider webhook delivery updates
- dead-letter retry worker
- rate limiting
- opt-out handling
- message cost reporting
