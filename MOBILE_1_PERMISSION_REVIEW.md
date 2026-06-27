# MOBILE 1 - Permission Review

Date: 2026-06-27

## Android

Manifest reviewed:

- `android/app/src/main/AndroidManifest.xml`

Current permissions:

- `android.permission.INTERNET`

No Android permissions were found for:

- camera
- microphone
- location
- contacts
- photo/media library
- biometrics / Face ID equivalent

Assessment:

- Android permissions are currently minimal.
- Camera viewing is web/gateway readiness only and does not require direct native camera permission.
- Upload flows may use browser/WebView file picker behavior; native photo/camera permissions should be added only after real-device testing confirms they are required.

## iOS

Info.plist reviewed:

- `ios/App/App/Info.plist`

No iOS usage descriptions were found for:

- camera
- microphone
- photo library
- location
- Face ID / biometrics
- push entitlements

Assessment:

- iOS permission surface is currently minimal.
- Do not add microphone or Face ID usage strings unless a real implemented feature requires them.
- If document/evidence upload needs native camera/photo capture in the packaged app, add the relevant usage strings only with precise Hebrew/English privacy copy and real-device validation.
- If inspector GPS/location is implemented through browser geolocation inside WebView, iOS location usage text may be required before real-device QA.

## Push

Push readiness exists at the web/server provider layer, but native push entitlements and device token collection were not verified in this pass.

Status:

- push_real_device_test_required
- provider_required for FCM/APNs

## Recommendation

Keep native permissions minimal for the next validation round. Add permissions only when a real device test proves the WebView flow requires them.
