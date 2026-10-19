# DIGITAL OBSERVER — PUSH 44 iOS REAL-DEVICE CONTINUATION

Date: 2026-10-20

Baseline: `origin/integration/development@78edef28fd1ec7bb106eba7bd432cd52011c2daa`

Branch: `codex/push-44-ios-kingston-qualification`

## Result

The targeted physical-iPhone qualification is **PARTIAL / BLOCKED**. Full
Xcode is now installed, Capacitor sync passes, and both the iOS Simulator and
unsigned generic iPhone targets compile at exact portable-helper commit `9c886315`.
An owner's iPhone 13 Pro running iOS 18.7.8 is connected by USB and paired.

Real-device execution remains blocked: Developer Mode is disabled, the
Developer Disk Image is unavailable, and no project-owned Apple Development
signing identity or provisioning profile is installed. The app installed and
launched in the iOS 26.3 simulator, but the Product UI remained blank because
the configured localhost endpoint was unavailable; WebKit recorded
`NSURLErrorDomain -1004`. The canonical isolated Development launcher also
failed closed because its schema/history readiness query could not complete.
No secure authenticated HTTPS Development app/media endpoint is configured.

PUSH 44 remains `PARTIAL / CANONICAL NOT DONE`. PUSH 46 was not started.

## Observed host and project state

- Qualification host: Apple-silicon MacBook Air (M3), arm64, macOS 15.6.1.
- Active developer directory: `/Applications/Xcode.app/Contents/Developer`.
- Full Xcode: 26.3, build 17C529. First-launch components and iOS 26.3
  simulator runtime are installed.
- Physical iPhone: iPhone 13 Pro, iOS 18.7.8, USB connected and paired;
  Developer Mode disabled and no Developer Disk Image mounted.
- Signing: no usable project-owned Apple Development signing identity or
  provisioning profile was available. No Apple account or signing setting was
  changed.
- Existing project: Capacitor 8.5.2, Swift Package Manager, iOS deployment
  target 15.0, existing bundle identifier `com.ganbatuach.app`, version 1.0
  build 1.
- APNs callback forwarding already existed. This continuation adds the missing
  configuration-aware signing entitlement: Development uses
  `aps-environment=development`; Release is prepared for a future authorized
  distribution profile. This does not activate APNs or prove delivery.
- No approved `CAPACITOR_SERVER_URL` is configured. The repository fallback
  is `http://localhost:3000`, which is not an acceptable physical-device
  endpoint. Simulator execution confirmed a connection-refused failure rather
  than a Product UI pass.
- Xcode DerivedData, Archives, Swift package clones/cache and result bundles are
  configured on the Kingston volume. See
  `DIGITAL_OBSERVER_PUSH_44_XCODE_STORAGE_CONFIGURATION.md`.
- No public tunnel, provider activation, paid service, Production credential,
  customer data, main merge or Production change was made.

## Native and external gates

| Gate | Result | Evidence / exact limitation |
|---|---|---|
| Capacitor iOS dependency/sync | DETERMINISTIC PASS | Existing SPM project and official Capacitor plugins; `npx cap sync ios --inline` |
| iOS project / privacy manifests | DETERMINISTIC PASS | iOS 15 target, app metadata, privacy manifest, URL scheme and APNs callbacks inspected |
| APNs signing configuration | DETERMINISTIC PASS | `App.entitlements` plus Debug/Release `APS_ENVIRONMENT` build settings |
| Native build | NATIVE BUILD PASS | Simulator and unsigned generic iOS arm64 Debug targets compiled at `9c886315`; signing disabled for qualification |
| Simulator | FAIL | Installed and launched on iPhone 17 Pro / iOS 26.3 simulator, but Product WebView failed with `NSURLErrorDomain -1004` because no Development endpoint was available |
| Physical iPhone | BLOCKED | iPhone 13 Pro / iOS 18.7.8 paired; Developer Mode disabled and DDI unavailable |
| Installation | BLOCKED | Unsigned compile is not installable; Developer Mode, Development signing identity and provisioning profile are required |
| Secure Development access | BLOCKED | No approved authenticated HTTPS Development URL or secure media path configured |
| Real authentication/UI | NOT RUN | No signed physical-device installation and no secure Development endpoint |
| Cellular remote playback | NOT RUN | No installed app and no approved HTTPS Development/media endpoint |
| Real Push receipt | NOT RUN | No signed device build, token, APNs Development credentials or approved send |
| Network transitions/performance | NOT RUN | Requires an executing physical-device build |
| TestFlight | BLOCKED | Build target compiles, but archive signing, distribution profile and App Store Connect authorization are absent |

## Xcode storage and build evidence

- The repository and worktree remain on the external Kingston volume.
- DerivedData, Archives, package clones/cache and result bundles use
  `/Volumes/DIGITAL_OBSERVER/XcodeStorage/DigitalObserver`.
- The build helper fails closed when the Kingston volume is unavailable.
- Exact-commit simulator build completed in approximately 25 seconds using a
  warm package/build cache.
- Exact-commit unsigned generic iOS arm64 build completed in approximately
  10 seconds using the same warm cache.
- Simulator first boot/runtime migration took approximately 116 seconds.
- No physical-device startup, memory, battery, playback, reconnect or network
  performance measurement is claimed.

## Regression and local Product verification

- TypeScript: **PASS**.
- Canonical lint baseline: **PASS**, zero canonical regressions.
- Production build without deployment: **PASS**; Production mutation remained
  false.
- Domain gate: **PASS**, 46/46 suites, including the preserved PUSH 38–45
  contracts.
- Security/isolation gate: **PASS**, 47/47 suites.
- Migration health: **PASS**, 256 ordered migrations, zero new migration and
  zero unreviewed destructive migration.
- Release contract: **PASS**, Production mutation false.
- Integration-ledger schema: **PASS**, 173 units.

The cumulative local full stack is **BLOCKED**, not PASS. The canonical
integration launcher failed closed when the isolated Development
schema/history readiness query could not complete. The mobile app therefore
has no approved running Development endpoint; an HTTP success from an older
process was not substituted as evidence.

## Minimum owner actions for the next device session

1. On the unlocked iPhone, open **Settings → Privacy & Security → Developer
   Mode**, enable it, restart the phone and confirm Developer Mode after restart.
   Reconnect by USB, keep the phone unlocked and confirm that Xcode mounts the
   Developer Disk Image.
2. In Xcode Settings > Accounts, sign in to the project-owned Apple developer
   account. Select the authorized Development Team for the existing bundle ID
   and permit Xcode to create a Development provisioning profile. Do not place
   certificates or private keys in Git.
3. Approve and configure a dedicated authenticated HTTPS Development/QA app URL
   and a secure authorized HTTPS media path. The endpoint must use isolated
   Development data, TLS, tenant/Site enforcement, expiry and revocation, with
   no Production credential fallback. Do not use localhost or an unaudited
   public tunnel.
4. Restore the canonical isolated Development backend readiness gate; its
   current schema/history query fails closed.
5. Approve the project-owned APNs Development capability/credential and one
   bounded synthetic notification send only after the signed Development app
   registers the owner's device. No customer recipient may be used.

After these prerequisites are present, repeat build, installation, login,
cellular playback, Push receipt, Wi-Fi/cellular transitions, revocation and
performance measurements on the actual named iPhone. Android and additional
iOS-device matrix obligations remain separate.

## Preserved boundaries

PUSH 45 legal gates remain closed: no child monitoring, biometrics/Re-ID,
location tracking, external pilot or sensitive workflow was activated. All
PUSH 38–45 history and outstanding proof obligations remain intact. There is no
schema change; expected Development or Production migrations are zero.
