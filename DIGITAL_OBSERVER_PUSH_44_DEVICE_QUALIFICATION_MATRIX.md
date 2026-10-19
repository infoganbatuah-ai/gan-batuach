# DIGITAL OBSERVER — PUSH 44 DEVICE QUALIFICATION MATRIX

Date: 2026-10-19
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

| Platform | Version/device | Build | Auth/session | Deep link | Playback/network | Push | Background/resume | Evidence |
|---|---|---|---|---|---|---|---|---|
| iOS | Minimum deployment target 15.0; physical model/iOS unknown | BLOCKED — full Xcode is not installed | DETERMINISTIC PASS | DETERMINISTIC PASS | DETERMINISTIC PASS; REMOTE PLAYBACK PASS not claimed | DETERMINISTIC PASS for APNs project entitlement; REAL PUSH RECEIPT PASS not claimed | DETERMINISTIC PASS | PUSH 44 QA and iOS continuation report |
| Android | minSdk 24; target/compile SDK 36 | BLOCKED — Android SDK is not installed on the qualification host | DETERMINISTIC PASS | DETERMINISTIC PASS | DETERMINISTIC PASS; REMOTE PLAYBACK PASS not claimed | DETERMINISTIC PASS; `google-services.json`/device receipt OPEN | DETERMINISTIC PASS | `npm run mobile:sync`; PUSH 44 QA |

No native-build, simulator, real-device, remote-playback or real-Push PASS is
claimed. The failed local Android build is retained as evidence: Gradle reached
dependency resolution and stopped because `ANDROID_HOME`/`android/local.properties`
has no SDK location. The 2026-10-19 targeted iOS continuation stopped before
compilation because the active developer directory contains Command Line Tools,
full Xcode is absent, no code-signing identity/provisioning profile exists and
no iPhone is visible over USB.

## Targeted iOS continuation evidence

| Device | OS | Build SHA | Network | Test | Timestamp | Evidence | Result / failure reason |
|---|---|---|---|---|---|---|---|
| Physical iPhone not visible; model unknown | Unknown | Source baseline `4bc2dda2b2e0cae5d5d601b0702de4b90126a08d`; no native build | USB discovery | Device discovery | 2026-10-19 | `system_profiler`; `xcrun devicectl` unavailable | BLOCKED — no iPhone detected and full Xcode absent |
| iOS Simulator | Not installed | No native build | Local | Native build and launch | 2026-10-19 | active developer directory `/Library/Developer/CommandLineTools` | BLOCKED — Xcode/simulator unavailable |
| Physical iPhone not visible | Unknown | No installed build | Cellular | Authorized live/playback, reconnect, expiry/revocation and cross-tenant denial | 2026-10-19 | no approved HTTPS Development app/media endpoint configured | NOT RUN |
| Physical iPhone not visible | Unknown | No installed build | APNs Development | Permission, token, receipt, tap, revocation and logout | 2026-10-19 | APNs project entitlement prepared; signing/profile/device/provider proof absent | NOT RUN |
| Physical iPhone not visible | Unknown | No installed build | Wi-Fi/cellular/airplane mode | Network transitions, background/resume and restart | 2026-10-19 | application did not execute on a physical device | NOT RUN |
| Physical iPhone not visible | Unknown | No installed build | Not applicable | Startup, playback/reconnect, memory, battery, crash and network use | 2026-10-19 | application did not execute on a physical device | NOT RUN |

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
