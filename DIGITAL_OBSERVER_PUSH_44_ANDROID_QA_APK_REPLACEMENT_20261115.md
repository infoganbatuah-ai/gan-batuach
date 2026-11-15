# PUSH 44 — replacement Android QA Debug APK, local static qualification

Date: 2026-11-15. Source: `origin/integration/development` at
`3b2ad5c53ab5d60269e348cadb4f44d7d1073ab0`. This ancestry includes
PR #474 (`ef720a8b`) and PR #478 (`a410fbae`). No device installation or
external provider was used.

## Reproduction

The SDK, JDK 21 and Gradle cache were already on `/Volumes/DIGITAL_OBSERVER`
under `.dev-cache/tmp/push44-android-sdk`. The source worktree was clean before
and after the build. The following local-only commands succeeded:

```sh
CAPACITOR_BUILD_PROFILE=development CAPACITOR_SERVER_URL=http://localhost:3000 ./node_modules/.bin/cap sync android
JAVA_HOME=/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/.dev-cache/tmp/push44-android-sdk/jdk-21.0.13+9/Contents/Home ANDROID_HOME=/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/.dev-cache/tmp/push44-android-sdk/sdk GRADLE_USER_HOME=/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/.dev-cache/tmp/push44-android-sdk/gradle CAPACITOR_BUILD_PROFILE=development CAPACITOR_SERVER_URL=http://localhost:3000 ./gradlew :app:assembleDebug --offline --no-daemon --quiet
```

APK: `android/app/build/outputs/apk/debug/app-debug.apk` (local generated,
ignored artifact). Measured size: **23,489,321 bytes**. SHA-256:
`a011fb8dfff4107d309918a3a3e9af757585278be02d5246ebbd8ee4ffbe71ba`.

## Compiled artifact checks

Checked with Android SDK Build Tools 36.0.0 `aapt` and `apksigner`, and read
the embedded Capacitor JSON without printing a raw URL:

| Gate | Measured result |
| --- | --- |
| Package | `com.ganbatuach.app.qa`, version `1.0-qa`; distinct from canonical `com.ganbatuach.app` |
| Build type | Debuggable; minimum SDK 24, target SDK 36 |
| Signature | APK verifies with v2 signature; one Android Debug signer, certificate SHA-256 `0e7f1eae5a43241ae606363eaa0f88ac187545f559d2c96ce89da4a0deab8cf3` |
| Embedded server | `http://localhost:3000`, no userinfo/query/fragment; local Development preview only |
| Cleartext | Compiled manifest `usesCleartextTraffic=false`; compiled network security base false, exception only for `localhost` and `127.0.0.1` |
| FileProvider | No `FileProvider`, `.fileprovider` authority or `FILE_PROVIDER_PATHS` in compiled manifest |
| Exported activity | MainActivity exported for launcher and `digitalobserver` scheme; link still requires server-side authorization |
| Exported receivers | FirebaseInstanceIdReceiver requires `com.google.android.c2dm.permission.SEND`; ProfileInstallReceiver requires `android.permission.DUMP` |
| Other providers/services | FirebaseInitProvider and AndroidX InitializationProvider are not exported; inspected services are not exported |
| FCM configuration | No `android/app/google-services.json`; real FCM delivery not proven |

No broad external-storage provider or unrestricted cleartext permission was
present in the compiled APK. The localhost URL is not a cellular QA endpoint;
this artifact is not a signed release, Android-device test, login proof, media
proof, or Push-delivery receipt. No Production/Home service or paid provider was
changed.
