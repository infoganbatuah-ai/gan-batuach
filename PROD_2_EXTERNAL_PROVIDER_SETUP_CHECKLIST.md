# PROD 2 External Provider Setup Checklist

Date: 2026-06-27

This checklist intentionally lists ENV names and setup steps only. Do not paste secrets into reports or source files.

## Payment Provider

- Choose provider: Tranzila, Meshulam, Cardcom, Pelecard or another supported provider.
- Create sandbox/test account.
- Configure ENV names: `PAYMENT_PROVIDER`, `PAYMENT_MODE=sandbox`, `PAYMENT_API_KEY`, `PAYMENT_PUBLIC_KEY` if applicable, `PAYMENT_WEBHOOK_SECRET`, `PAYMENT_SUCCESS_URL`, `PAYMENT_CANCEL_URL`.
- Configure webhook URL: `/api/webhooks/payment`.
- Configure success/cancel return URLs to the manager subscription screen.
- Collect provider-supported test card instructions.
- Run only sandbox transactions first.
- Confirm duplicate webhook delivery does not duplicate subscription activation.

## Invoice Provider

- Choose invoice provider.
- Create sandbox/test account where available.
- Configure ENV names: `INVOICE_PROVIDER`, `INVOICE_MODE=sandbox`, `INVOICE_API_KEY`, `INVOICE_WEBHOOK_SECRET`.
- Configure webhook URL: `/api/webhooks/invoice`.
- Configure legal company details in provider dashboard.
- Confirm test invoice/PDF/receipt behavior before any production invoice.

## Email Provider

- Choose provider such as Resend, SendGrid or SES.
- Verify sending domain.
- Configure SPF, DKIM and DMARC.
- Configure ENV names: `EMAIL_PROVIDER`, `EMAIL_MODE=test`, `EMAIL_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`.
- Add approved test recipients before sending.
- Run one template render and one test send to an approved internal recipient only.

## SMS Provider

- Choose provider such as Twilio, Vonage, MessageBird or an Israeli provider.
- Configure sender ID or test number.
- Configure ENV names: `SMS_PROVIDER`, `SMS_MODE=test`, `SMS_API_KEY`, `SMS_SENDER_ID`, `SMS_WEBHOOK_SECRET`.
- Configure callback URL if the provider supports delivery callbacks.
- Add allowed test phone numbers.
- Do not enable production broadcast until rate limits and opt-out policy are approved.

## WhatsApp Provider

- Complete Meta/WhatsApp Business or Twilio WhatsApp setup.
- Configure phone number ID and business account.
- Configure ENV names: `WHATSAPP_PROVIDER`, `WHATSAPP_MODE=test`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `WHATSAPP_BUSINESS_ACCOUNT_ID`.
- Create and approve templates for invite/payment/demo messages.
- Configure webhook URL for the selected provider.
- Add allowed test numbers and confirm opt-in process.
- Do not fake delivery when templates or phone numbers are not approved.

## Push Notifications

- Create Firebase project for Android/FCM.
- Configure iOS APNs credentials if iOS push is required.
- Configure browser/PWA push keys if web push is required.
- Configure ENV names: `PUSH_PROVIDER`, `PUSH_MODE=test`, `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY`, `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_BUNDLE_ID`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`.
- Confirm device token collection in the real app/device flow.
- Run real-device QA before production push.

## Shared Production Gates

- Production/live mode requires explicit user approval.
- Provider secrets must be configured only in the deployment environment.
- Webhook secrets must be server-side only.
- Test recipients/devices must be approved before any outbound message.
- No real card charge, production invoice or production customer message is allowed during PROD 2.
