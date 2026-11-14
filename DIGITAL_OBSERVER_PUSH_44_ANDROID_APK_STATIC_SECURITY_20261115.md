# PUSH 44 — Android Debug APK static security receipt (2026-11-15)

Scope: offline inspection of the existing `app-debug.apk` only. No build, device installation, network request, database access or provider operation was performed. This is **not** Android physical-device, OEM, FCM delivery, real playback, full-stack or release proof.

## Artifact identity and signing

- APK: `/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/worktrees/development-integration/android/app/build/outputs/apk/debug/app-debug.apk`.
- SHA-256 remeasured: `6ae6a63c330be3f3497da4f2dbc0013be6160f54cdbdb2af62596aee7eb211d8`; matches `/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/.dev-cache/tmp/push44-android-sdk/local-build-evidence-20261114.json`.
- SDK 36.0.0 `aapt`: package `com.ganbatuach.app`, version `1.0` (code 1), min SDK 24, target SDK 36, `android:debuggable=true`.
- SDK 36.0.0 `apksigner verify --verbose --print-certs`: signature verification **PASS** using APK Signature Scheme v2; one signer, Android Debug certificate, RSA 2048, public certificate SHA-256 `87dd4239e42a97970c88f8cb8d7f4e9a031d59894eb31be813bd79b29c61cada`. This is not a release signing identity. Certificate not-before/not-after dates were not exposed by this verifier and remain **NOT PROVEN**.
- The package ID is the canonical `com.ganbatuach.app`, **not** the separate iPhone PersonalTeamQA bundle. Do not install this Debug APK on a device with an existing application of the same package without a separate package/signing and data-preservation review.

## Compiled manifest

- Requested permissions: `INTERNET`, `POST_NOTIFICATIONS`, `ACCESS_NETWORK_STATE`, `WAKE_LOCK`, FCM receive and an app-scoped dynamic-receiver permission. No camera, microphone, location, contacts or broad storage permission was observed in the compiled manifest.
- `allowBackup=false`; the compiled cloud-backup and device-transfer rules exclude root, file, database, shared preferences and external/device domains. This is static policy evidence, not an Android restore test.
- Exported: `MainActivity` (launcher plus `digitalobserver` custom-scheme `VIEW`/`BROWSABLE`), Firebase Instance ID receiver protected by `com.google.android.c2dm.permission.SEND`, and AndroidX ProfileInstallReceiver protected by `android.permission.DUMP`. FileProvider, MessagingService and other inspected services/providers are non-exported. The custom scheme has no manifest host restriction; source-side `parseMobileLink` validates route and Site, but this APK contains no bundled Next.js application to prove the handler's runtime behavior.
- FileProvider is non-exported and grants URI permissions; its packaged path definition contains `external-path path="."`. Actual sharing call sites and URI-grant behavior were not exercised. Review before release if file sharing is enabled.
- `usesCleartextTraffic=true` is compiled into the application and no `networkSecurityConfig` attribute appears. The packaged Capacitor config has `server.url` host `http://localhost` and `server.cleartext=true`; no remote server URL appears in that config. This permits cleartext at the Android application policy level, not merely for loopback. No Production endpoint fallback is proven or ruled out for code loaded later from a server.

## Decision and bounded next fix

**STATIC SIGNATURE/MANIFEST INSPECTION: PASS WITH RELEASE BLOCKERS.** The APK is a local Debug artifact only, with Debug signing, debuggable flag, canonical package ID and globally permitted cleartext traffic. It must not be promoted as a secure QA or release package. Before a future device or release qualification, prepare a distinct Development QA application ID and verified HTTPS-only runtime configuration; retain loopback cleartext only in an explicitly isolated Debug flavor if truly needed, and validate the compiled manifest and deep-link handler of that new artifact. This report does not authorize that build, installation or deployment.

The existing 2026-11-14 `LOCAL_BUILD_PASS` remains valid. Physical Android/OEM, FCM delivery, APNs, authorized live playback, DB/full-stack, store policy and Production safety remain **NOT PROVEN**. PUSH 44 remains **PARTIAL / NOT DONE**; PUSH 46 remains **NOT STARTED**.
