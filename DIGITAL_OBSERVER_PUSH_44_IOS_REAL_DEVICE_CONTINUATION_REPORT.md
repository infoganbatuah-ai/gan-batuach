# DIGITAL OBSERVER — PUSH 44 iOS REAL-DEVICE CONTINUATION

Date: 2026-10-19  
Baseline: `origin/integration/development@4bc2dda2b2e0cae5d5d601b0702de4b90126a08d`  
Branch: `codex/push-44-ios-real-device`

## Result

The targeted physical-iPhone qualification is **BLOCKED**. No iPhone was
visible to the Mac, full Xcode is not installed, and no local Apple Development
signing identity or provisioning profile is available. Consequently no native
iOS build, simulator execution, installation, authentication, cellular remote
playback, real Push receipt, network-transition measurement or TestFlight
candidate is claimed.

PUSH 44 remains `PARTIAL / CANONICAL NOT DONE`. PUSH 46 was not started.

## Observed host and project state

- Qualification host: Apple-silicon MacBook Air (M3), macOS 15.6.1.
- Active developer directory: `/Library/Developer/CommandLineTools`.
- Full Xcode application: not found. `xcodebuild` and `devicectl` are
  unavailable.
- Physical iPhone over USB: not detected. Its model and iOS version therefore
  remain unknown rather than inferred.
- Signing: zero valid code-signing identities and zero local provisioning
  profiles were observed.
- Existing project: Capacitor 8.5.2, Swift Package Manager, iOS deployment
  target 15.0, existing bundle identifier `com.ganbatuach.app`, version 1.0
  build 1.
- APNs callback forwarding already existed. This continuation adds the missing
  configuration-aware signing entitlement: Development uses
  `aps-environment=development`; Release is prepared for a future authorized
  distribution profile. This does not activate APNs or prove delivery.
- No `CAPACITOR_SERVER_URL` is configured in the process or available local
  Development configuration. The repository fallback is localhost, which is
  not an acceptable physical-device endpoint.
- No public tunnel, provider activation, paid service, Production credential,
  customer data, main merge or Production change was made.

## Native and external gates

| Gate | Result | Evidence / exact limitation |
|---|---|---|
| Capacitor iOS dependency/sync | DETERMINISTIC PASS | Existing SPM project and official Capacitor plugins; `npx cap sync ios --inline` |
| iOS project / privacy manifests | DETERMINISTIC PASS | iOS 15 target, app metadata, privacy manifest, URL scheme and APNs callbacks inspected |
| APNs signing configuration | DETERMINISTIC PASS | `App.entitlements` plus Debug/Release `APS_ENVIRONMENT` build settings |
| Native build | BLOCKED | Full Xcode 26.x absent |
| Simulator | NOT RUN | Simulator tooling absent with full Xcode |
| Physical iPhone | BLOCKED | No device visible; model and iOS version unknown |
| Installation | BLOCKED | No Xcode, signing identity, provisioning profile or visible device |
| Secure Development access | BLOCKED | No approved authenticated HTTPS Development URL or secure media path configured |
| Real authentication/UI | NOT RUN | Application did not execute on a physical device |
| Cellular remote playback | NOT RUN | No installed app and no approved HTTPS Development/media endpoint |
| Real Push receipt | NOT RUN | No signed device build, token, APNs Development credentials or approved send |
| Network transitions/performance | NOT RUN | Requires an executing physical-device build |
| TestFlight | BLOCKED | Native archive/signing and App Store Connect access were not available or authorized |

## Minimum owner actions for the next device session

1. Install full Xcode 26.0.1 through 26.3 on this macOS 15.6.1 host. Capacitor
   8 requires Xcode 26.0 or newer; Apple lists Xcode 26.0.1–26.3 as compatible
   with macOS 15.6. Do not install a newer Xcode that requires macOS Tahoe
   without separately approving the OS change.
2. Launch Xcode once, accept its license, install the requested platform
   components, and select `/Applications/Xcode.app/Contents/Developer` in
   Xcode Settings > Locations (or with the owner-approved `xcode-select`
   command).
3. In Xcode Settings > Accounts, sign in to the project-owned Apple developer
   account. Select the authorized Development Team for the existing bundle ID
   and permit Xcode to create a Development provisioning profile. Do not place
   certificates or private keys in Git.
4. Connect the unlocked iPhone by USB, tap **Trust**, enter its passcode, enable
   **Developer Mode** if prompted, restart the phone, and keep it unlocked until
   Xcode lists it under Devices and Simulators.
5. Approve and configure a dedicated authenticated HTTPS Development/QA app URL
   and a secure authorized HTTPS media path. The endpoint must use isolated
   Development data, TLS, tenant/Site enforcement, expiry and revocation, with
   no Production credential fallback. Do not use localhost or an unaudited
   public tunnel.
6. Approve the project-owned APNs Development capability/credential and one
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
