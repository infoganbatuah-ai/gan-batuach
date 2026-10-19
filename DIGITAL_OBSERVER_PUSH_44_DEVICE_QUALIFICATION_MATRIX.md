# DIGITAL OBSERVER — PUSH 44 DEVICE QUALIFICATION MATRIX

Date: 2026-10-20
Scope: Development only; no store submission, provider activation or Production use.

## Evidence classes

- `DETERMINISTIC PASS`: source/contract tests only.
- `NATIVE BUILD PASS`: a native target compiled successfully with the recorded toolchain and SHA.
- `SIMULATOR PASS`: compiled and exercised in an OS simulator.
- `REAL DEVICE PASS`: exercised on the named physical device and network.
- `REMOTE PLAYBACK PASS`: authorized playback was exercised outside the camera LAN through the recorded secure media path.
- `REAL PUSH RECEIPT PASS`: a physical device registered and received the approved Development notification.
- `BLOCKED`: a named prerequisite is absent.
- `NOT RUN`: the test was not executed and no result is inferred.

## Current matrix

Personal Team QA update (2026-10-20), source code commit `ef5f6930`:
**NATIVE BUILD PASS** for the signed `PersonalTeamQA` iPhone target,
**REAL DEVICE PASS limited to installation, launch and bundled offline-safe QA
UI** on Daniel Sun Deri 2 (iPhone 13 Pro, iOS 27.0.1). The owner observed the
Hebrew QA screen and its status/access/notifications tabs after developer trust;
CoreDevice confirmed installation, launch and a live app process. The QA app
has no APNs entitlement, remote server URL or native Push registration. This
does **not** prove authenticated Digital Observer UI, remote playback or real
Push. Previous signing and simulator rows below are historical snapshots.

| Device | OS | Build SHA | Network | Test | Timestamp | Evidence | Result / failure reason |
|---|---|---|---|---|---|---|---|
| Daniel Sun Deri 2 / iPhone 13 Pro | iOS 27.0.1 | `ef5f6930`, `com.ganbatuach.app.qa` 1.0 (1) | USB; bundled local UI | Personal Team signed install, launch, offline QA screen | 2026-10-20 02:19 Asia/Jerusalem | CoreDevice install/launch and running process; owner visual confirmation | REAL DEVICE PASS — limited offline-safe QA UI; no authenticated Product UI claim |
| Daniel Sun Deri 2 / iPhone 13 Pro | iOS 27.0.1 | `ef5f6930` | Cellular | Authorized remote live/playback, expiry, revocation, cross-tenant denial | 2026-10-20 | No approved authenticated HTTPS app/media endpoint | BLOCKED / NOT RUN |
| Daniel Sun Deri 2 / iPhone 13 Pro | iOS 27.0.1 | `ef5f6930` | APNs Development | Token, real receipt, tap, revocation | 2026-10-20 | Personal Team QA profile cannot carry APNs entitlement; no send attempted | BLOCKED / NOT RUN |

Recovery update (2026-10-20), runtime SHA
`31db906863984a35ad48d492457afaef07cac421`: **SIMULATOR PASS for basic
Development landing rendering only**, screenshot
`/private/tmp/push44-runtime-recovery-loaded.png`. Authenticated Observer UI
remains untested in the simulator. Mobile API authorization passes 5/5;
database drift passes 256/256 without data/schema changes. The connected iPhone
13 Pro reports iOS 27.0.1, Developer Mode enabled, paired and DDI available.
Signing and installation remain BLOCKED. Earlier rows are historical evidence.

| Platform | Version/device | Build | Auth/session | Deep link | Playback/network | Push | Background/resume | Evidence |
|---|---|---|---|---|---|---|---|---|
| iOS | Minimum deployment target 15.0; iPhone 13 Pro / iOS 18.7.8 paired; iPhone 17 Pro / iOS 26.3 simulator | NATIVE BUILD PASS — simulator and unsigned generic iOS arm64 Debug targets at `9c886315` | DETERMINISTIC PASS; physical NOT RUN | DETERMINISTIC PASS; physical NOT RUN | DETERMINISTIC PASS; REMOTE PLAYBACK PASS not claimed | DETERMINISTIC PASS for APNs project entitlement; REAL PUSH RECEIPT PASS not claimed | DETERMINISTIC PASS; physical NOT RUN | PUSH 44 QA, iOS continuation and Xcode storage reports |
| Android | minSdk 24; target/compile SDK 36 | BLOCKED — Android SDK is not installed on the qualification host | DETERMINISTIC PASS | DETERMINISTIC PASS | DETERMINISTIC PASS; REMOTE PLAYBACK PASS not claimed | DETERMINISTIC PASS; `google-services.json`/device receipt OPEN | DETERMINISTIC PASS | `npm run mobile:sync`; PUSH 44 QA |

Native compilation now passes, but no SIMULATOR PASS, REAL DEVICE PASS, REMOTE
PLAYBACK PASS or REAL PUSH RECEIPT PASS is claimed. The simulator app process
installed and launched, but its WebView remained blank and recorded
`NSURLErrorDomain -1004` because no approved Development endpoint was
available. The failed local Android build is retained as evidence: Gradle reached
dependency resolution and stopped because `ANDROID_HOME`/`android/local.properties`
has no SDK location. The 2026-10-20 targeted iOS continuation used Xcode 26.3,
but no usable Apple Development identity/profile exists and the paired iPhone
has Developer Mode disabled with no Developer Disk Image mounted.

## Targeted iOS continuation evidence

| Device | OS | Build SHA | Network | Test | Timestamp | Evidence | Result / failure reason |
|---|---|---|---|---|---|---|---|
| iPhone 17 Pro simulator | iOS 26.3 | `9c886315` | Local simulator | Debug simulator target compile | 2026-10-20 | Xcode 26.3 result bundle on Kingston; `** BUILD SUCCEEDED **` | NATIVE BUILD PASS |
| Generic iPhone arm64 target | iOS deployment target 15.0 | `9c886315` | Not applicable | Unsigned Debug hardware-target compile | 2026-10-20 | Xcode 26.3 result bundle on Kingston; signing disabled; `** BUILD SUCCEEDED **` | NATIVE BUILD PASS — not installation proof |
| iPhone 17 Pro simulator | iOS 26.3 | `55eec8c0` | Local; configured app URL fallback `localhost:3000` | Install, launch and render | 2026-10-20 | process launch succeeded; screenshot blank; WebKit `NSURLErrorDomain -1004` | FAIL — no Product UI; SIMULATOR PASS not claimed |
| iPhone 13 Pro | iOS 18.7.8 | `9c886315` unsigned compile only | USB paired | Device discovery / DDI | 2026-10-20 | Xcode device discovery | BLOCKED — Developer Mode disabled, DDI unavailable, no signing/profile |
| iPhone 13 Pro | iOS 18.7.8 | No installed build | Cellular | Authorized live/playback, reconnect, expiry/revocation and cross-tenant denial | 2026-10-20 | no signed app or approved HTTPS Development app/media endpoint | NOT RUN |
| iPhone 13 Pro | iOS 18.7.8 | No installed build | APNs Development | Permission, token, receipt, tap, revocation and logout | 2026-10-20 | APNs entitlement prepared; signing/profile/token/provider send absent | NOT RUN |
| iPhone 13 Pro | iOS 18.7.8 | No installed build | Wi-Fi/cellular/airplane mode | Network transitions, background/resume and restart | 2026-10-20 | application did not execute on physical device | NOT RUN |
| iPhone 13 Pro | iOS 18.7.8 | No installed build | Not applicable | Startup, playback/reconnect, memory, battery, crash and network use | 2026-10-20 | application did not execute on physical device | NOT RUN |

## Required real-device campaign

The owner-approved campaign must record exact app SHA/build, OS version, model, notification permission state and network path for at least:

- one supported current iPhone and one older supported iPhone;
- one current Android reference device and one supported lower/mid-range Android device;
- Wi-Fi → cellular, cellular → Wi-Fi, interruption, background/resume and application restart;
- authorized, revoked, expired and cross-tenant sessions;
- authorized remote live/playback through a configured HTTPS media edge, not LAN-only playback;
- Push registration, token rotation, receipt, tap/deep-link authorization and revocation;
- startup, playback/reconnect latency, bandwidth, memory, battery and crash observations.

Store review, store approval, Production delivery and arbitrary LAN-only camera access remain explicitly outside this matrix.
