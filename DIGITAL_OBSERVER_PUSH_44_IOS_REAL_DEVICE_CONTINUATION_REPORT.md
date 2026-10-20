# DIGITAL OBSERVER — PUSH 44 iOS REAL-DEVICE CONTINUATION

## Owner-approved bounded HTTPS Development QA — 2026-10-20

Baseline: `origin/integration/development@0a90979504d20c8db0d45574421e6eaf89231fc7`.
The isolated Development backend passed 256/256 migration-history/schema
readiness checks and served the exact baseline SHA with `LOCAL_SUPABASE`;
Production fallback was false. A temporary Cloudflare Quick Tunnel with
email-OTP allowlisting was connected only to a loopback QA route filter. That
filter permits the Digital Observer Product pages, selected read-only APIs,
login and logout; it rejects Supabase, Management, media, physical actions and
other internal routes. The trial is capped at 30 minutes, 1,200 requests,
120 requests/minute, 64 KiB/request and 80 MiB total response data. The
external endpoint returned an authentication redirect to anonymous probes;
its loopback filter returned 404 for prohibited routes. No database or media
port was published. The temporary hostname and personal OTP are not retained
in Git.

The signed `PersonalTeamQA` iPhone build was installed and launched on the
owner's iPhone 13 Pro / iOS 27.0.1. Its QA-only Capacitor configuration points
to the temporary HTTPS Product URL and allows the exact Cloudflare OTP broker
hosts. Its effective entitlements still omit `aps-environment`; canonical
Debug/Release Push capability and source contracts remain unchanged. The QA
route filter rewrites localhost-origin redirects to same-origin relative paths
and marks Product cookies `Secure`; a dummy empty-login probe verified this
without using credentials. The owner reached the Cloudflare challenge in the
app, but the first OTP attempt ended in a plain `Bad Request` before any
Product-origin request. Safari on the same iPhone passed the Cloudflare OTP
challenge and the Product login route returned HTTP 200; the owner initially
saw only a loading screen, not a confirmed login UI. Redirect tracing
identified an additional broker host, which was added only to the QA build;
the corrected signed app was reinstalled and launched. The app then reached
`/digital-observer` at the Development origin, but also remained loading. We
traced this second failure to the QA route filter rejecting valid
percent-encoded Next.js static asset names. The filter was corrected to permit
safe encodings while denying encoded slashes, dots, backslashes, percent
escapes and internal routes; a real Turbopack JavaScript asset then returned
HTTP 200 through the filter. After reloading and repeating Cloudflare OTP,
the owner reported that both the QA app and Safari still displayed only a
loading screen. Thus the bounded endpoint proved identity-gated transport and
Product-origin reachability, **not** usable Product UI or authentication. The
symptom is consistent with a currently open Cloudflare protected Quick Tunnel
session/subresource issue, but that upstream cause is not confirmed here. No
unprotected tunnel or broad fallback was attempted. The temporary tunnel and
local route filter were stopped; the public URL returned HTTP 530 and loopback
port 31744 refused connections. The previously existing Cloudflare service
was not altered. The owner iPhone was returned to the offline-safe Personal
Team QA build with no temporary server URL. **An authenticated Product journey
is not claimed.** Safari transport access is not native-app Product proof.

A follow-up **loopback-only desktop Chrome diagnostic** loaded the login page
through the same QA route filter and rendered the Hebrew Product heading,
email/password fields and login button. Next.js CSS/JavaScript requests
returned HTTP 200. The development-only HMR WebSocket and a decorative asset
returned 404 without blocking that desktop page. This narrows the observed
failure to the external protected path or iOS-specific behavior; it does not
identify a confirmed Cloudflare root cause, nor does desktop rendering count
as iPhone Product proof. The loopback diagnostic proxy was stopped again.

Validation at this continuation: signed PersonalTeamQA build/install/launch
PASS; QA route and negative-path contract PASS; TypeScript PASS; canonical lint
PASS; production build without deployment PASS; domain regression 46/46 PASS;
security/isolation 48/48 PASS; migration safety 256/256 PASS; release-contract
PASS with Production mutation false. No migration was added or applied. The
temporary Product trial did not reach authenticated UI, so cumulative local
full-stack functionality is not promoted from transport PASS to Product PASS.

No camera video route was exposed. Cloudflare's public-hostname Tunnel terms
do not authorize continuous video delivery on the current unverified plan;
the existing Gateway/media configuration was not changed. Real remote camera
playback, APNs receipt, full native release readiness and PUSH 46 zero-install
proof remain open. Incremental fixed supplier charge for this temporary Quick
Tunnel is $0 according to the provider's published feature description; the
bounded trial's actual metered/account cost has not been invoice-verified.
The protected supplier ledger remains the cost source of truth.

Next safe prerequisite: verify a separate owner-only named Cloudflare Access
application and isolated Tunnel, including its actual account plan, zero-cost
headroom, session behavior and rollback, without modifying the existing home
Gateway Tunnel. A new media ingress requires its own compliant transport and
short-lived grants; the application Quick Tunnel must not carry video.

Cloudflare references: [protected Quick Tunnels](https://developers.cloudflare.com/changelog/post/2026-10-02-protected-quick-tunnels/),
[video delivery restrictions](https://developers.cloudflare.com/fundamentals/reference/policies-compliances/delivering-videos-with-cloudflare/),
and [open protected-session issue](https://github.com/cloudflare/cloudflared/issues/1752).
No Production, main, real customer, paid provider, sensitive feature or PUSH 46
action was authorized or performed. PUSH 44 remains **PARTIAL / CANONICAL NOT
DONE**.

## Personal Team QA installation — 2026-10-20

PR #232, branch `codex/push44-ios-personal-team-install`, code commit
`ef5f6930` add the isolated `PersonalTeamQA` build configuration. The
Development-signed `com.ganbatuach.app.qa` / `Digital Observer QA` 1.0 (1)
build installed on the connected **Daniel Sun Deri 2**, iPhone 13 Pro,
iOS 27.0.1, using Personal Team `27G7ZP4U3Q`. After the owner trusted the
developer identity, CoreDevice launched the app and the process remained
running. The owner confirmed that the Hebrew `Digital Observer QA` screen and
its `מצב / גישה / התראות` tabs actually appeared. This is real-device
**installation and offline-safe QA UI proof**, not authenticated Product UI.
The owner subsequently confirmed both `גישה` and `התראות` switch the bundled
QA content when tapped; no authenticated Product navigation is inferred.

The effective app signature and embedded provisioning profile contain no
`aps-environment`; the QA bundle omits native Push registration and the
canonical deep-link URL claim. The QA WebView uses a bundled local status page
with no remote URL, credentials or Production fallback. It truthfully labels
login, Sites, cameras, Events, remote playback and real Push unavailable.
Canonical Debug/Release retain their APNs entitlements, native callback bridge,
Push plugin, notification backend and product experience. The separate `.qa`
bundle ID avoids replacing the Gan Batuach app, whose shared canonical bundle
ID and landing page remain a product-branding issue for future resolution.

The isolated Development database already passed 256/256 migration/schema
readiness and basic simulator landing rendering. No approved authenticated
HTTPS application/media endpoint exists for this physical device; authenticated
Observer journeys and cellular camera playback remain **BLOCKED/NOT RUN**.
Personal Team cannot provision APNs, so real Push receipt remains **BLOCKED**.
No Production, provider, customer, migration, store or PUSH 46 action occurred.
PUSH 44 stays **PARTIAL / CANONICAL NOT DONE**. Earlier failed signing and
runtime observations below remain historical evidence, not current device
status.

## Signing follow-up — 2026-10-20

A valid Apple Development identity and Personal Team `27G7ZP4U3Q` are now
verified. The root checkout's Debug/Release team selections are preserved on
`codex/push44-ios-personal-team-install`; unrelated root changes are untouched.
Automatic signing and canonical APNs settings remain intact.

The canonical source `10d088574f96a7479ab5e3bd947198842649ac34` was built
for the verified connected iPhone using that team as a build override, with
outputs on external storage. **Signed build FAIL / installation BLOCKED**:
Personal Team provisioning cannot support Push Notifications; its profile lacks
that capability and `aps-environment`. A second local build with an empty
entitlement-file override also failed on the required Push capability. No app
was installed. No canonical capability was removed to bypass qualification.

Next prerequisite: an existing authorized Apple Developer Program team/profile
supporting Push, or an explicit owner choice for a separate no-Push QA build
configuration. No paid enrollment, APNs send or store publication occurred.
Earlier missing-identity observations below are historical; the remaining
signing issue is Personal Team capability support.

## Current recovery receipt — 2026-10-20

Runtime/source: `31db906863984a35ad48d492457afaef07cac421`.
Branch: `codex/push44-ios-runtime-recovery`.

Database PASS: all 256 expected migrations match (227 baseline + 29 later),
with no missing entries or schema errors. The reproduced failure was sandbox
permission denial on the dedicated local Docker socket. The same read-only
verifier passed with authorized socket access. No database reset, recreation,
repair, migration or data deletion was needed.

The canonical launcher serves `http://127.0.0.1:3000` with the exact source SHA
and `LOCAL_SUPABASE`. The existing simulator app now renders the Development
landing UI. Screenshot: `/private/tmp/push44-runtime-recovery-loaded.png`.
Protected copy: `exports/restricted/push44-ios-runtime-recovery-20261020/simulator-loaded.png`.
SHA256: `7dd1981ad3947220612e1a51a21496f77d4f52f90ff96aa1b9a73d30542b5e4c`.
Five authenticated mobile authorization probes pass, including anonymous,
cross-Site and forged-link denial. This establishes basic simulator rendering
only. The landing page is Gan Batuach branded; an authenticated Observer
simulator journey remains unqualified.

Runtime regression results at this SHA: PUSH 39 24/24, PUSH 40 6/6, PUSH 41
7/7, PUSH 42 10/10, PUSH 43 15/15, PUSH 44 5/5, PUSH 45 4/4 PASS. These use
isolated synthetic Development data; no external provider send is claimed.

The connected iPhone 13 Pro reports **iOS 27.0.1**, paired, booted, Developer
Mode enabled and DDI services available. This supersedes the earlier 18.7.8
observation below. Zero valid signing identities exist and the project has no
Development Team. Installation and physical UI remain BLOCKED. The owner must
sign in to the project-owned Apple account in Xcode Settings → Accounts, then
select its existing team for the App target. New paid enrollment is not
authorized. Check device-OS/toolchain compatibility during the signed build.

### HTTPS QA proposal — owner authorization required

Reuse an approved project-owned HTTPS reverse proxy/tunnel for a temporary
owner-only QA hostname. Require identity-aware ingress plus Product login;
proxy only the application loopback port and existing allowlisted playback
ingress. Keep Supabase private. Require trusted TLS, scoped expiring media
grants, request limits, revocation and immediate shutdown. Before activation,
verify account ownership, existing plan/quota, zero added fixed cost, bounded
egress, iPhone/WebView access, and cross-tenant denial. No DNS, hostname, tunnel
or provider configuration was activated. Existing TLS playback-ingress source
contracts do not establish a working application endpoint. Real camera cellular
playback remains open.

APNs remains blocked by signing, capability/credential and token readiness.
Then obtain owner approval for one synthetic Development send. No message was
sent. Android, PUSH 38 reliability and PUSH 45 legal gates remain open.

External APFS storage is writable with approximately 1.6 TiB free. SMART is
unsupported. Prior repair warnings remain unresolved. No repair or unmount
was run. Safe follow-up: stop drive users, verify a recoverable backup, then
run offline Disk Utility First Aid in an owner-approved maintenance window.

PUSH 44 remains PARTIAL. PUSH 46 is not started. The earlier receipt and failed
qualification below are preserved as history.

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
