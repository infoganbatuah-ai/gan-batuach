# Production Integrations Activation

Date: 2026-06-07
Scope: safe activation readiness for Email, WhatsApp, SMS, Push, Supabase, Vercel, Camera Gateway and AI Provider.

## Safety Rules

- Do not store provider secrets in the database.
- Keep secrets in server-side environment variables.
- Do not enable broad sending from the admin UI.
- Test sends must stay mock/dry-run until a provider is explicitly approved.
- Use only approved test recipients or the currently signed-in admin's own email/phone.
- Move an integration to `active` only after legal, support, security and operational approval.

## Status Model

`production_integrations.status` supports:

- `not_configured`
- `configured`
- `test_mode`
- `production_ready`
- `active`
- `disabled`
- `failed`

Recommended flow:

`not_configured` -> `configured` -> `test_mode` -> `production_ready` -> `active`

## Email

Supported providers:

- Resend
- SendGrid
- Amazon SES

Required setup:

- Verified sender email.
- Verified sending domain.
- DNS records completed.
- Bounce/complaint handling reviewed.
- Test email succeeds in safe mode.

Environment variables:

- `EMAIL_PROVIDER`
- `EMAIL_API_KEY`
- `EMAIL_FROM_ADDRESS`
- `EMAIL_FROM_NAME`
- `EMAIL_REAL_SEND_ENABLED=false`
- `SENDGRID_WEBHOOK_SECRET` for SendGrid webhooks
- `RESEND_WEBHOOK_SECRET` for Resend webhooks
- `AWS_SES_REGION`
- `AWS_SES_ACCESS_KEY_ID`
- `AWS_SES_SECRET_ACCESS_KEY`

Activation checklist:

- Provider account created.
- Domain verified.
- Templates reviewed.
- Test recipient approved.
- Dry-run test logged.
- Real send flag remains false until final approval.

## WhatsApp

Supported providers:

- Meta WhatsApp Business Cloud API
- Twilio WhatsApp

Required setup:

- Phone Number ID.
- Business Account ID.
- Template approval.
- Webhook verification.
- Opt-in/consent process.

Environment variables:

- `WHATSAPP_PROVIDER`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_BUSINESS_ACCOUNT_ID`
- `WHATSAPP_APP_ID`
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
- `WHATSAPP_REAL_SEND_ENABLED=false`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_WHATSAPP_FROM`

Activation checklist:

- Business account approved.
- Templates approved.
- Webhook verified.
- Test phone approved.
- Delivery callback tested.
- Real send flag remains false until final approval.

## SMS

Supported providers:

- Twilio
- MessageBird
- Vonage
- Israeli provider readiness

Required setup:

- Sender name/from number.
- Provider account and API credentials.
- Delivery status callback if supported.
- Local compliance/consent review.

Environment variables:

- `SMS_PROVIDER`
- `SMS_API_KEY`
- `SMS_FROM_NUMBER`
- `SMS_PROVIDER_ACCOUNT_ID`
- `SMS_REAL_SEND_ENABLED=false`
- `VONAGE_API_KEY`
- `VONAGE_API_SECRET`
- `SMS_WEBHOOK_SECRET`

Activation checklist:

- Sender name approved.
- Test phone approved.
- Dry-run test logged.
- Delivery webhook readiness checked.
- Real send flag remains false until final approval.

## Push

Supported providers:

- Firebase FCM
- APNs
- Web Push

Required setup:

- Android FCM project.
- Apple APNs key/team/bundle.
- Web Push VAPID keys.
- Device token health monitoring.

Environment variables:

- `PUSH_PROVIDER`
- `PUSH_REAL_SEND_ENABLED=false`
- `FCM_SERVER_KEY`
- `FCM_PROJECT_ID`
- `FCM_SERVICE_ACCOUNT_JSON`
- `APNS_KEY_ID`
- `APNS_TEAM_ID`
- `APNS_BUNDLE_ID`
- `APNS_PRIVATE_KEY`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `PUSH_WEBHOOK_SECRET`

Activation checklist:

- Device token registration tested.
- Android readiness checked.
- iOS readiness checked.
- Web readiness checked.
- Test push logged in safe mode.

## Supabase

Required setup:

- Auth redirect URLs match production domain.
- RLS role matrix tested.
- Storage buckets are private unless explicitly public.
- Service role key is server-only.
- Backup and restore drill completed.

Environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Vercel

Required setup:

- Production project connected.
- Domain attached.
- SSL verified.
- Production env vars configured.
- Preview/prod separation confirmed.

Environment variables:

- `NEXT_PUBLIC_APP_URL`
- `APP_URL`
- `AUTH_REDIRECT_URL`
- `CAPACITOR_SERVER_URL`

## Camera Gateway

Supported providers:

- MediaMTX
- go2rtc
- Custom gateway

Required setup:

- Gateway reachable from server.
- RTSP credentials remain server-only.
- Browser receives HLS/WebRTC playback, not RTSP.
- Playback tokens and audit logs enabled.

Environment variables:

- `VIDEO_GATEWAY_URL`
- `VIDEO_GATEWAY_PUBLIC_URL`
- `VIDEO_GATEWAY_PROVIDER`
- `VIDEO_GATEWAY_API_KEY`
- `VIDEO_GATEWAY_SIGNING_SECRET`

Activation checklist:

- Daniel home test camera validated in `home_test`.
- One kindergarten DVR/NVR/IP camera validated.
- Parent playback permission tested.
- Gateway health visible in admin.

## AI Provider

Supported readiness:

- Local mock
- OpenCV readiness
- YOLO readiness
- Local HTTP endpoint
- Custom endpoint

Required setup:

- Shadow mode enabled.
- Human review required.
- No automatic accusations.
- No staff scoring.
- No biometric assumptions.
- No parent raw event access.

Environment variables:

- `LOCAL_VISION_PROVIDER`
- `VISION_PROVIDER`
- `LOCAL_VISION_ENABLED=false`
- `LOCAL_VISION_ENDPOINT`
- `CUSTOM_VISION_ENDPOINT`
- `VISION_SHADOW_MODE=true`
- `VISION_HUMAN_REVIEW_REQUIRED=true`
- `AI_OBSERVER_SECRET`

## Test Flow

1. Open `/dashboard/admin/integrations`.
2. Confirm provider status is `configured` or `test_mode`.
3. Add or use an approved test recipient.
4. Run a safe integration test.
5. Confirm a test log is created.
6. Confirm no real broad sending occurred.
7. Move to `production_ready` only after checklist approval.

## Production Activation Checklist

- External account created.
- Required env vars set server-side.
- No secrets committed.
- Webhook signature secret configured.
- Approved test recipient used.
- Dry-run test passed.
- Legal/consent review complete.
- Support owner assigned.
- Rollback plan ready.
- Real send flag intentionally enabled only after final approval.
