# MOBILE 1 - Push Readiness Report

Date: 2026-06-27

## Current Push Readiness

Push-related application infrastructure exists:

- web push service worker at `public/sw.js`
- push provider readiness in `lib/domain/push-provider.ts`
- push preparation logic in `lib/domain/push-service.ts`
- admin push/provider pages
- push ENV names in `.env.example`

Relevant ENV names include:

- `PUSH_PROVIDER`
- `PUSH_MODE`
- `PUSH_REAL_SEND_ENABLED`
- `FCM_PROJECT_ID`
- `FCM_CLIENT_EMAIL`
- `FCM_PRIVATE_KEY`
- `FCM_SERVER_KEY`
- `FCM_SERVICE_ACCOUNT_JSON`
- `APNS_KEY_ID`
- `APNS_TEAM_ID`
- `APNS_BUNDLE_ID`
- `APNS_PRIVATE_KEY`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`

## Android

The Android Gradle config conditionally applies Google services only if `android/app/google-services.json` exists.

No committed `google-services.json` was found or required for this QA.

Status:

- FCM native readiness requires Firebase project setup and `google-services.json`.
- Do not commit Firebase secrets or production service account material.

## iOS

APNs readiness requires:

- Apple Developer account
- push capability/entitlement
- APNs key or certificate
- app bundle ID configuration
- real device token test

No iOS push entitlement or real APNs test was performed in this pass.

## Safety

No production push was sent.
No real device token was used.
No provider secret was touched.

## Status

push_status = readiness_only

Blockers:

- provider_required: FCM/APNs credentials are needed.
- real_device_required: Device token registration must be tested on physical devices.
- app_store_account_required: iOS push capability requires Apple Developer setup.
