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

Retrial (2026-10-20T21:27–21:39Z): owner-only protected Quick Tunnel 2026.10.1
again crashed after iPhone Safari OTP with a nil-map panic and HTTP 502
(Ray `a4db2097bb1c9428`). Official checksum-verified 2026.10.2 stayed up
but the owner's second Safari OTP ended in `Bad Request` before Product-origin
proof. Exact PR #234 feature runtime login and JavaScript assets passed local
HTTP 200; the restricted Supabase path returned 404 and anonymous HTTPS
redirected to Cloudflare authentication. No authenticated Product UI, cellular
app journey or media proof was obtained. The temporary ingress was shut down
(ports closed; public HTTP 530). A signed QA rebuild was attempted but Xcode
rejected the CoreDevice UUID as a build destination; no new install is claimed.
PR #234 remains draft and PUSH 44 remains PARTIAL / NOT DONE.

| Device | OS | Build SHA | Network | Test | Timestamp | Evidence | Result / failure reason |
|---|---|---|---|---|---|---|---|
| Owner iPhone 13 Pro / Safari | iOS 27.0.1 | PR #234 `99a4e68a` local Development runtime | Temporary owner-only HTTPS; network type unverified | Cloudflare OTP to Product login, `cloudflared` 2026.10.1 | 2026-10-20 21:31 UTC | Owner-reported 502, Ray `a4db2097bb1c9428`; matching connector nil-map panic | BLOCKED — no completed Product request |
| Owner iPhone 13 Pro / Safari | iOS 27.0.1 | PR #234 `99a4e68a` local Development runtime | Temporary owner-only HTTPS; network type unverified | Cloudflare OTP to Product login, `cloudflared` 2026.10.2 | 2026-10-20 | Owner-reported plain `Bad Request`; local origin login and JavaScript were 200; external Product request not proven | BLOCKED — Product UI/auth not reached |
| Owner iPhone 13 Pro / QA app | iOS 27.0.1 | Existing offline-safe signed QA app | No new remote app install | Signed QA rebuild for new hostname | 2026-10-20 | Xcode build destination used CoreDevice UUID rather than Xcode device ID; build rejected before install | NOT RUN — existing app preserved |

Follow-up diagnostic (2026-10-20): the owner's new iPhone Safari OTP attempt
returned Cloudflare 502; `cloudflared` 2026.10.1 crashed with a nil-map panic
before a completed Product request reached the QA filter. A separate exact
Development asset probe with an external `Origin` reproduced HTTP 403 from
Next.js. Narrow Development-only origin configuration and non-empty denial
headers were added on the draft branch, with deterministic contract checks;
they have **not** been requalified on the iPhone. The temporary ingress is off
(public HTTP 530; local QA port closed). Product login/dashboard, cellular
access, remote camera playback and real Push remain BLOCKED / NOT RUN.

| Device | OS | Build SHA | Network | Test | Timestamp | Evidence | Result / failure reason |
|---|---|---|---|---|---|---|---|
| Owner iPhone 13 Pro / Safari | iOS 27.0.1 | Development runtime `0a909795`; protected Quick Tunnel / draft PR #234 | Temporary HTTPS; network type unverified | Cloudflare OTP to Product login | 2026-10-20 01:00:45 UTC | Owner-reported 502, Ray `a4d4165f4f8a46d0`; connector nil-map panic; no completed Product request | BLOCKED — connector crashed; Product UI/auth not reached |
| Development host | macOS | draft PR #234 | Loopback QA filter | External-Origin JavaScript asset | 2026-10-20 | Asset 403 with tunnel Origin, 200 without; Next.js logged `allowedDevOrigins` rejection | DETERMINISTIC reproduction; iPhone fix proof NOT RUN |
| Development host | macOS | PR #234 head `be875d18` | Loopback-only feature runtime `127.0.0.1:3001` | Login and real JavaScript asset after narrow Origin fix | 2026-10-20T11:46Z | Development schema 256/256; login HTTP 200; configured QA Origin asset HTTP 200 JavaScript; unapproved Origin HTTP 403; runtime stopped | LOCAL DETERMINISTIC PASS only; external/iPhone Product proof NOT RUN |

Bounded owner-approved HTTPS QA update (2026-10-20), baseline
`0a90979504d20c8db0d45574421e6eaf89231fc7`: isolated Development
schema readiness **256/256 PASS**; temporary owner-email-OTP HTTPS ingress
reached the Product origin from both iPhone Safari and the signed Personal Team
QA app. A localhost redirect was corrected to a relative Product URL, the QA
WebView was allowed to navigate to the verified Cloudflare OTP broker host,
and safe percent-encoded Next.js static assets now pass the route filter.
Anonymous access redirected to Cloudflare authentication and internal,
Supabase, media and action routes remained blocked. After the asset-filter
correction the owner repeated OTP and refresh in both app and Safari, but
both remained on a loading screen. The temporary Tunnel and filter were then
stopped; the public URL returned HTTP 530 and loopback port 31744 refused
connections. **This is transport/route proof only, not usable authenticated
Product UI, cellular, media or Push proof.**

A later loopback-only desktop Chrome diagnostic rendered the Hebrew login form
through the same route filter with CSS/JavaScript HTTP 200. The local QA proxy
was stopped again. That desktop result narrows but does not resolve the iOS/
external-path loading failure and is **not** real-device Product proof.

| Device | OS | Build SHA | Network | Test | Timestamp | Evidence | Result / failure reason |
|---|---|---|---|---|---|---|---|
| Desktop Chrome diagnostic | macOS host | Development runtime `0a909795`; QA filter from `8eb27207` | Loopback only | Product login rendering through QA filter | 2026-10-20 | Browser accessibility snapshot showed heading, email/password and button; Next.js CSS/JS 200; no login attempted | LOCAL UI PASS only; iPhone and external HTTPS remain BLOCKED |
| Owner iPhone 13 Pro / PersonalTeamQA | iOS 27.0.1 | baseline `0a909795`; signed QA build from scoped continuation branch | Temporary owner-only HTTPS; network type unverified | Cloudflare challenge, Product origin access, static asset delivery | 2026-10-20 | CoreDevice install/launch; owner reported challenge then persistent loading after refresh; Product GET 200 and real JavaScript asset 200 at origin/filter | REAL DEVICE PASS for HTTPS route only; authenticated Product UI BLOCKED |
| Owner iPhone 13 Pro / Safari | iOS 27.0.1 | Development runtime `0a909795` | Temporary owner-only HTTPS; network type unverified | Access OTP and Product login route | 2026-10-20 | Owner confirmed Access flow; origin recorded login GET 200; persistent loading even after asset-filter correction | Browser route PASS; login UI/authentication BLOCKED |
| Owner iPhone 13 Pro | iOS 27.0.1 | PersonalTeamQA | Cellular outside camera LAN | Real live/playback, expiry/revocation, cross-tenant denial | 2026-10-20 | No approved compliant media ingress; no media route exposed | BLOCKED / NOT RUN |
| Owner iPhone 13 Pro | iOS 27.0.1 | PersonalTeamQA | APNs Development | Real receipt and token lifecycle | 2026-10-20 | QA entitlements omit APNs by design | BLOCKED / NOT RUN |

Personal Team QA update (2026-10-20), source code commit `ef5f6930`:
**NATIVE BUILD PASS** for the signed `PersonalTeamQA` iPhone target,
**REAL DEVICE PASS limited to installation, launch and bundled offline-safe QA
UI** on Daniel Sun Deri 2 (iPhone 13 Pro, iOS 27.0.1). The owner observed the
Hebrew QA screen and its status/access/notifications tabs after developer trust;
CoreDevice confirmed installation, launch and a live app process. The QA app
has no APNs entitlement, remote server URL or native Push registration. This
does **not** prove authenticated Digital Observer UI, remote playback or real
Push. Previous signing and simulator rows below are historical snapshots.
The owner also confirmed that tapping `גישה` and `התראות` changes the bundled
QA content; this is basic offline-shell navigation, not Product navigation.

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
