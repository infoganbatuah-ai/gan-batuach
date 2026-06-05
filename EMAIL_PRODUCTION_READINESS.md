# Email Production Readiness

Gan Batuach and the future Digital Observer platform now have a production-ready email architecture. Real email sending remains intentionally disabled.

## Goal

- Support verification, password reset, invitations, approvals, inspection notices, observer notifications, billing readiness and reports.
- Keep email providers swappable.
- Track queue health, delivery, opens, clicks, failures and retries.
- Respect communication preferences.
- Avoid real email delivery until provider credentials, webhooks and operational approval are complete.

## Provider Architecture

Provider code lives in:

- `lib/domain/email-provider.ts`
- `lib/domain/email-service.ts`

Supported providers:

- `mock_email`
- `resend`
- `sendgrid`
- `amazon_ses`
- `custom`

Current behavior:

- `mock_email` is the default.
- Resend, SendGrid and Amazon SES can report configuration readiness.
- Provider calls are dry-run/mock only.
- No real email is sent in this phase.

## Environment Variables

Server-only:

- `EMAIL_PROVIDER`
- `EMAIL_API_KEY`
- `EMAIL_FROM_ADDRESS`
- `EMAIL_FROM_NAME`
- `EMAIL_REAL_SEND_ENABLED=false`
- `SENDGRID_WEBHOOK_SECRET`
- `RESEND_WEBHOOK_SECRET`
- `AWS_SES_REGION`
- `AWS_SES_ACCESS_KEY_ID`
- `AWS_SES_SECRET_ACCESS_KEY`

Provider guidance:

- Resend: `EMAIL_PROVIDER=resend`, `EMAIL_API_KEY`, `EMAIL_FROM_ADDRESS`
- SendGrid: `EMAIL_PROVIDER=sendgrid`, `EMAIL_API_KEY`, `EMAIL_FROM_ADDRESS`
- Amazon SES: `EMAIL_PROVIDER=amazon_ses`, SES region/access keys and `EMAIL_FROM_ADDRESS`

## Data Model

Tables:

- `email_templates`
- `email_delivery_logs`
- `email_category_preferences`
- `email_provider_configs`

`email_templates` stores:

- template key/name
- category
- language
- variables
- status
- subject template
- text body template
- optional HTML body template
- default action URL

`email_delivery_logs` stores:

- queued
- sent
- delivered
- opened
- clicked
- failed
- dead letter
- retry attempts
- next retry time
- provider references
- failure reasons

## Categories

Supported categories:

- verification
- password reset
- invitation
- parent approval
- staff invitation
- inspection notices
- observer notifications
- billing readiness
- reports

## Queue Readiness

The queue model is database-backed through `email_delivery_logs`.

Ready for future worker implementation:

- pick queued rows
- send through configured provider
- update provider reference
- retry failed rows
- move exhausted failures to dead letter
- process delivery/open/click webhook updates

## Communication Preferences

Email preferences are layered:

- global `receive_email` in `communication_preferences`
- category preferences in `email_category_preferences`
- critical-only category mode
- future role-specific defaults

## Admin Dashboard

Route:

- `/dashboard/admin/email-production`

Shows:

- provider readiness
- template status
- queue health
- delivery metrics
- open/click metrics
- failures
- retry readiness

## Real Sending Policy

Real email sending is not enabled in this phase.

Before enabling:

1. Add real provider adapter implementation.
2. Configure verified sender/domain.
3. Configure SPF, DKIM and DMARC.
4. Configure provider delivery webhooks.
5. Verify unsubscribe/preference behavior.
6. Run role-based privacy checks.
7. Enable real send only after pilot approval.

## Testing Checklist

- Run migration and confirm seeded templates.
- Open `/dashboard/admin/email-production`.
- Queue mock email through `queueEmail`.
- Confirm log row status is queued/failed/skipped as expected.
- Confirm missing recipient email creates failed log.
- Confirm disabled preferences skip non-critical messages.
- Confirm provider readiness shows missing config.
- Confirm no real email leaves the system.
