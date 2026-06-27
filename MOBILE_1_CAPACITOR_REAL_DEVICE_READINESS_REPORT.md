# MOBILE 1 - Capacitor Real Device Readiness Report

Date: 2026-06-27

## Summary

MOBILE 1 is completed as a readiness pass, with build and Capacitor sync passing. Real-device validation remains required before App Store / Google Play readiness.

Overall status:

- web_build_status = passed
- capacitor_sync_status = passed
- android_project_status = exists
- ios_project_status = exists
- real_device_status = not_tested
- store_submission_status = not_started

## Build Result

Baseline commands:

- `npm run typecheck`: passed in 27.062s
- `npm run build`: passed in 50.808s
- `git diff --check`: passed in 0.037s

Final verification:

- `npm run typecheck`: passed in 23.496s
- `npm run build`: passed in 59.320s
- `git diff --check`: passed in 0.019s
- `npx cap sync`: passed in 0.790s

## Capacitor Config Status

Capacitor is configured with:

- `appId`: `com.ganbatuach.app`
- `appName`: `גן בטוח`
- `webDir`: `public`
- strategy: remote/hybrid WebView via `server.url`

The app currently defaults to `http://localhost:3000` when `CAPACITOR_SERVER_URL` and `NEXT_PUBLIC_APP_URL` are missing. This is acceptable for local development only. A pilot/store package must use an HTTPS URL.

## Web/Mobile Strategy

The mobile app uses the same Next.js UI through a WebView. Web deployment updates ordinary UI, while native sync/build is needed for native config, plugins, permissions, icons, splash, or store packages.

See `MOBILE_WEB_SYNC_STRATEGY.md`.

## Sync Result

`npx cap sync` passed.

The sync copied public assets and wrote Capacitor config for Android and iOS. No unexpected native git changes were detected afterward.

## Android Readiness

Ready:

- Android project exists.
- `applicationId`/namespace match `com.ganbatuach.app`.
- Manifest exists.
- Internet permission exists.
- App icon and splash resources exist.
- Release signing keys are not committed.

Blocked/not completed:

- Gradle wrapper needs to download Gradle `8.14.3`; the environment cannot resolve `services.gradle.org` because network is restricted.
- Debug APK build was not completed in this environment.
- FCM native push requires Firebase setup and `google-services.json`.

Android status:

- android_readiness = project_ready_manual_gradle_required

## iOS Readiness

Ready:

- iOS project exists.
- Bundle ID is configured as `com.ganbatuach.app`.
- Info.plist exists.
- App icon and splash assets exist.
- Certificates/provisioning profiles are not committed.

Blocked/not completed:

- `xcodebuild` cannot run because only Command Line Tools are active; full Xcode is required.
- iOS device build/signing was not attempted.
- APNs requires Apple Developer setup and real device testing.

iOS status:

- ios_readiness = project_ready_xcode_required

## Permissions Review

Android currently requests only:

- Internet

iOS currently has no camera/microphone/location/photo/Face ID permission usage strings.

This is safe for current readiness. Add native permissions only when real-device testing proves they are required for upload, geolocation, push, or other native features.

See `MOBILE_1_PERMISSION_REVIEW.md`.

## Mobile Layout QA

This pass did not run an in-app browser or real device visual session because local server/browser execution is restricted in the current environment.

Responsive stabilization was previously performed and documented. Real device validation remains required for:

- safe-area behavior
- keyboard/form behavior
- bottom navigation overlap
- drawers/dialogs
- role dashboards

## Auth Mobile Result

Routes are present and build:

- `/app`
- `/login`
- `/register`
- `/app/login`
- `/app/register`
- role-specific registration routes under `/app/register/*`

Manual device validation is still required.

## Role Dashboard Mobile Result

Role dashboard routes build:

- parent
- manager/garden
- staff
- inspector
- admin
- Digital Observer

Manual real-device validation is still required.

## Push Readiness

Push is readiness-only:

- Web push service worker exists.
- Push provider/service code exists.
- FCM/APNs env names exist.
- Native device token testing was not performed.

Status:

- push_real_device_test_required
- provider_required

See `MOBILE_1_PUSH_READINESS_REPORT.md`.

## Camera / AI Mobile Safety

No new camera or AI live flow was activated.

Expected mobile safety state:

- no RTSP exposure
- no camera credentials exposed
- no fake live video
- AI readiness/shadow only unless provider/frame source is explicitly configured
- raw AI events remain blocked from parents

Manual device validation is still required.

## Payment Mobile Safety

No payment provider was activated.

Expected mobile safety state:

- provider mode shown honestly
- sandbox/mock/readiness only unless credentials are configured
- no card data stored
- Gan Batuach subscription remains separate from parent tuition
- Digital Observer billing remains separate

Manual device validation is still required.

## Real Device Test Plan

Created:

- `MOBILE_1_REAL_DEVICE_TEST_PLAN.md`

## Blockers

- real_device_required: iPhone and Android physical-device validation is still required.
- google_play_required: Android store/package readiness was not attempted.
- apple_developer_required: iOS signing and APNs require Apple Developer setup.
- provider_required: Push requires FCM/APNs credentials and real device token validation.
- manual_visual_review_required: WebView safe-area and keyboard behavior must be checked on real devices.

## Files Changed

New MOBILE 1 documentation:

- `MOBILE_1_CAPACITOR_CONFIGURATION_AUDIT.md`
- `MOBILE_WEB_SYNC_STRATEGY.md`
- `MOBILE_1_CAPACITOR_SYNC_REPORT.md`
- `MOBILE_1_PERMISSION_REVIEW.md`
- `MOBILE_1_PUSH_READINESS_REPORT.md`
- `MOBILE_1_REAL_DEVICE_TEST_PLAN.md`
- `MOBILE_1_CAPACITOR_REAL_DEVICE_READINESS_REPORT.md`

Existing relevant uncommitted responsive QA work remains present:

- `app/globals.css`
- `RESPONSIVE_QA_1_CROSS_DEVICE_VISUAL_REGRESSION_REPORT.md`

No signing secrets, certificates, provisioning profiles, APK, AAB, or IPA artifacts were found in the checked native paths.

## MOBILE 2 Readiness

MOBILE 2 can begin as package/submission preparation only after:

1. `CAPACITOR_SERVER_URL` is set to a real HTTPS pilot/staging URL.
2. Android debug build is completed in Android Studio or an environment with Gradle network/cache.
3. iOS debug build is completed in full Xcode.
4. Real device test plan is executed.
5. Push/provider status is either configured for testing or explicitly excluded from the first package.

Store-ready status:

- not_store_ready
