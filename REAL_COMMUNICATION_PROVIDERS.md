# Real Communication Providers

Gan Batuach now has a production-ready communication provider layer for WhatsApp, SMS, Email, and Push. The system is prepared for real providers, but it does not require credentials and does not send production messages until a provider is configured, tested, and explicitly activated.

## Admin Communication Center

Admin route:

`/dashboard/admin/communications`

The page shows:

- WhatsApp, SMS, Email, and Push status.
- Provider readiness for each channel.
- Template readiness for key product messages.
- Delivery and failure analytics.
- Mock-only testing for each channel.
- Links to the deeper channel screens.

Supported states:

- `not_configured`
- `configured`
- `testing`
- `active`
- `disabled`

## Supported Providers

### WhatsApp

Prepared providers:

- Meta WhatsApp Business Cloud API
- Twilio WhatsApp
- Mock WhatsApp
- Future custom provider

Tracked configuration:

- Provider name
- Sending phone number
- Status
- Mode: `mock`, `dry_run`, or `real`
- Credentials configured flag
- Webhook configured flag
- Template support

Expected environment values when enabling real sending:

- `WHATSAPP_PROVIDER`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_BUSINESS_ACCOUNT_ID`
- `WHATSAPP_ACCESS_TOKEN`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_WHATSAPP_FROM`

### SMS

Prepared providers:

- Twilio
- MessageBird
- Vonage
- Local Israeli provider readiness
- Mock SMS

Tracked configuration:

- Provider name
- Sender name
- Status
- Mode
- Credentials configured flag
- Delivery logs

Expected environment values when enabling real sending:

- `SMS_PROVIDER`
- `SMS_FROM_NUMBER`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `MESSAGEBIRD_API_KEY`
- `VONAGE_API_KEY`
- `VONAGE_API_SECRET`

### Email

Prepared providers:

- Resend
- SendGrid
- AWS SES
- Mock Email

Tracked configuration:

- Provider name
- Sender email
- Sender name
- Domain verification status
- Credentials configured flag
- Template status
- Delivery logs

Expected environment values when enabling real sending:

- `EMAIL_PROVIDER`
- `EMAIL_FROM_ADDRESS`
- `EMAIL_FROM_NAME`
- `RESEND_API_KEY`
- `SENDGRID_API_KEY`
- `AWS_SES_REGION`
- `AWS_SES_ACCESS_KEY_ID`
- `AWS_SES_SECRET_ACCESS_KEY`

### Push

Prepared providers:

- Firebase FCM
- APNs
- Web Push
- Mock Push

Tracked configuration:

- Provider name
- Environment
- Status
- Credentials configured flag
- Webhook/configuration readiness
- Delivery logs

Expected environment values when enabling real sending:

- `PUSH_PROVIDER`
- `FCM_PROJECT_ID`
- `FCM_CLIENT_EMAIL`
- `FCM_PRIVATE_KEY`
- `APNS_TEAM_ID`
- `APNS_KEY_ID`
- `APNS_PRIVATE_KEY`
- `WEB_PUSH_PUBLIC_KEY`
- `WEB_PUSH_PRIVATE_KEY`

## Templates

Central templates are prepared for:

- Welcome
- Password reset
- Kindergarten approval
- Correction required
- Onboarding completed
- Parent invitation
- Staff invitation
- Alerts

Each template is tracked per channel. WhatsApp templates can also track provider approval status.

## Delivery Logs

The system tracks:

- Channel
- Provider
- Recipient preview or masked recipient
- Template
- Status
- Created time
- Sent time
- Failure time or failure reason where supported

Passwords and credentials must not be written to public logs. Test logs use masked recipient previews.

## Testing Center

The admin testing flow is mock-only by default.

When an admin tests a channel, the system:

- Creates a communication test log.
- Creates a matching channel-specific delivery log where possible.
- Marks the provider as `testing`.
- Stores `real_send: false` in the test payload.

No real WhatsApp, SMS, Email, or Push message is sent by this testing center.

## Production Activation Checklist

Before enabling real sending:

- Create provider account and verify ownership.
- Add credentials to the production environment.
- Set provider config status to `configured`.
- Complete domain, phone, sender, or app verification.
- Approve WhatsApp templates with the selected provider.
- Send test messages in dry-run or mock mode first.
- Confirm opt-in and user communication preferences.
- Confirm delivery logs do not expose private credentials.
- Enable webhooks for status callbacks.
- Switch provider mode from `mock` or `dry_run` to `real`.
- Set provider status to `active`.
- Monitor failures and success rate after activation.

## Remaining Production Work

- Add encrypted secret storage if credentials are managed from the admin UI.
- Add provider webhook endpoints for delivery receipts where not already present.
- Add template editor actions for provider submission and approval sync.
- Add rate limits and per-channel sending quotas.
- Add production runbooks for provider outages.
