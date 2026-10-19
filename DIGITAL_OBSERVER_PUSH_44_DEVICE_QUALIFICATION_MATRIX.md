# DIGITAL OBSERVER — PUSH 44 DEVICE QUALIFICATION MATRIX

Date: 2026-10-19
Scope: Development only; no store submission, provider activation or Production use.

## Evidence classes

- `DETERMINISTIC PASS`: source/contract tests only.
- `NATIVE SYNC PASS`: Capacitor project generation/plugin wiring only.
- `SIMULATOR PASS`: compiled and exercised in an OS simulator.
- `REAL DEVICE PASS`: exercised on the named physical device and network.
- `PRODUCTION PASS`: approved signed store build and live environment. None is claimed here.

## Current matrix

| Platform | Version/device | Build | Auth/session | Deep link | Playback/network | Push | Background/resume | Evidence |
|---|---|---|---|---|---|---|---|---|
| iOS | Minimum deployment target 15.0 | BLOCKED — full Xcode/simulator is not installed on the qualification host | DETERMINISTIC PASS | NATIVE SYNC + DETERMINISTIC PASS | DETERMINISTIC PASS; real remote path OPEN | NATIVE SYNC; APNs capability/credential/device receipt OPEN | DETERMINISTIC PASS | `npm run mobile:sync`; PUSH 44 QA |
| Android | minSdk 24; target/compile SDK 36 | BLOCKED — Android SDK is not installed on the qualification host | DETERMINISTIC PASS | NATIVE SYNC + DETERMINISTIC PASS | DETERMINISTIC PASS; real remote path OPEN | NATIVE SYNC; `google-services.json`/device receipt OPEN | DETERMINISTIC PASS | `npm run mobile:sync`; PUSH 44 QA |

No simulator or real-device PASS is claimed. The failed local Android build is retained as evidence: Gradle reached dependency resolution and stopped because `ANDROID_HOME`/`android/local.properties` has no SDK location. iOS qualification stopped before compilation because the active developer directory contains Command Line Tools rather than full Xcode.

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
