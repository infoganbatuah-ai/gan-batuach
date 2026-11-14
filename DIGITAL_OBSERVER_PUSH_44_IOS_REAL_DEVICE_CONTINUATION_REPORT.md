# DIGITAL OBSERVER — PUSH 44 iOS REAL-DEVICE CONTINUATION

## Zero Trust Free activation gate — 2026-10-20T21:44Z

The owner approved a bounded, owner-only Zero Trust Free QA configuration with
zero additional fixed cost and no media/database exposure. The signed-in
Cloudflare account's actual checkout presented **Zero Trust Free, $0/month**, but
also required (1) acceptance of Cloudflare's Terms of Service and Privacy
Policy, and (2) authorization to charge an existing payment card for usage
beyond free limits each month until cancellation. These are separate binding
legal and potentially billable permissions, outside the bounded zero-increment
QA approval. Neither checkbox was selected and **Activate** was not clicked.
No Zero Trust subscription, named Tunnel, Access application, DNS route, or
additional provider access was activated. The temporary Quick Tunnel, QA
filter and Product runtime remained off; no Product, iPhone login, cellular or
media proof was added. PR #234 remains draft and PUSH 44 remains partial.

Next action requires an owner decision on the checkout terms and uncontrolled
overage authorization, or an alternative secure QA ingress with enforceable
zero-increment limits. The agent must not accept the legal/overage checkboxes
on the owner's behalf under the present approval. Do not revive the failed
Quick Tunnel as a security workaround.

## Protected HTTPS retrial after account verification — 2026-10-20T21:27–21:39Z

Read-only Cloudflare account inspection found the existing domain on Free,
Workers Free active, R2 Paid already subscribed, billable usage **$0.00** for
the observed Oct 13–20 cycle interval and projected cycle **$0.00** on that
dashboard, and **1/1,000** included named Tunnels in use. Zero Trust had not
been onboarded. No new plan, paid feature, account, DNS record or named Tunnel
was activated. Cloudflare documents protected Quick Tunnels as temporary and
accountless; the existing QA filter bounded this trial to 30 minutes,
1,200 requests, 120/minute and 80 MiB total response data, with no media or
Supabase route. This establishes no new fixed supplier activation, **not** an
invoice-verified all-in project cost or a dependable QA service.

The owner repeated the OTP challenge on the physical iPhone in Safari. With
`cloudflared` **2026.10.1**, the owner observed Cloudflare HTTP 502, Ray
`a4db2097bb1c9428`, and the process again exited in
`proxy.(*Proxy).proxyHTTPRequest` with `assignment to entry in nil map`.
The isolated Development backend was healthy; the exact PR #234 feature
runtime at `99a4e68ab734bbb3433a688741fb2bb1fedacb04` returned login
HTTP 200 and a referenced JavaScript asset HTTP 200 for the exact QA Origin.
The loopback filter returned 404 for the Supabase path, while anonymous
external access redirected to Cloudflare authentication. No Product login
request from the failed iPhone attempt completed at the origin.

A **temporary, checksum-verified** official `cloudflared` 2026.10.2 binary
was then tried without updating the installed binary or the existing home
Gateway Tunnel. The owner completed a second Safari OTP challenge and reported
plain `Bad Request` on a black screen, before any completed Product-origin
request. This is not Product authentication proof. Cloudflare's protected
Quick Tunnel session-expiry issue remains open; 2026.10.2 was not established
as a working fix in this environment. No unprotected tunnel was attempted.
The temporary connector, QA filter and feature runtime were stopped; ports
3001 and 31744 had no listeners and the public hostname returned HTTP 530.

The connected iPhone 13 Pro remained visible to CoreDevice. A planned signed
QA rebuild for the first trial was **not** completed: Xcode rejected the
CoreDevice identifier as an Xcode destination (its build destination uses a
different device ID). No new signed build was installed, and no app or cellular
Product claim is made for this retrial. The existing offline-safe QA app and
canonical APNs-capable Release configuration were not changed. PR #234 remains
draft, exact-head CI **9/9 PASS**, with no migration or Product source change
from this retrial. PUSH 44 stays **PARTIAL / CANONICAL NOT DONE**.

The next secure option is a **separate** named Tunnel plus an owner-only
Cloudflare Access application, never the existing home Gateway Tunnel.
Cloudflare Zero Trust Free onboarding requires selecting a subscription and
confirming payment details even though its documentation says the Free plan is
not charged. That new account/security configuration and any applicable terms
need an explicit at-action owner decision before activation. No media path is
included; real remote video requires a separate compliant design and proof.

Sources: [Quick Tunnel](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/),
[protected Quick Tunnel](https://developers.cloudflare.com/changelog/post/2026-10-02-protected-quick-tunnels/),
[Cloudflare Zero Trust onboarding](https://developers.cloudflare.com/learning-paths/cybersafe/account-creation/create-zero-trust-org/),
[included Tunnel capacity](https://developers.cloudflare.com/tunnel/features/tunnels-for-platforms/),
[open session issue](https://github.com/cloudflare/cloudflared/issues/1752).

## Local-only requalification — 2026-10-20T11:46Z

On draft PR #234 head `be875d1805f6283bef1956675d42b8b677d6a16e`,
the isolated Development migration/history/schema check passed **256/256**
with no missing migrations. A separate feature-branch Development runtime bound
only to `127.0.0.1:3001` returned the Product login page with HTTP 200 after
its initial compilation. A real JavaScript asset referenced by that page
returned HTTP 200 and `application/javascript` for the one configured QA
Origin; an unapproved Origin returned HTTP 403. This verifies the narrow
Development-origin fix locally, **not** Cloudflare, iPhone, authenticated
Product, or cellular proof. The local feature runtime was stopped.

The proposed external Quick Tunnel was rejected by the environment's approval
gate before launch because account-specific plan/cost verification remained
unavailable. The prepared loopback QA filter was stopped; no external ingress,
media path, provider activation or Production path was opened. Do not bypass
that gate. The next external trial requires verified account/cost scope and
owner-only access, followed by fresh physical-iPhone proof. PR #234 remains
draft and PUSH 44 remains PARTIAL / CANONICAL NOT DONE.

## HTTPS loading-failure diagnostic continuation — 2026-10-20

The owner repeated the Cloudflare email challenge in iPhone Safari on a new,
bounded, protected Quick Tunnel and received **HTTP 502 Bad Gateway** at
`2026-10-20 01:00:45 UTC` (Cloudflare Ray `a4d4165f4f8a46d0`). The local
`cloudflared` 2026.10.1 process exited at the same time with a Go panic,
`assignment to entry in nil map`, in `proxy.(*Proxy).proxyHTTPRequest`.
The QA filter recorded no completed Product request from that attempt. This
establishes a connector/response-handling failure for this 502, **not** a
Digital Observer login or database failure. The exact trigger of the
cloudflared panic has not been independently isolated. The existing home
Gateway Tunnel was not changed.

Separately, a reproducible Next.js Development-origin rejection was found:
with the external `Origin` header, a real Turbopack JavaScript asset returned
HTTP 403 and the Development server logged that the tunnel hostname was not in
`allowedDevOrigins`; the same asset without that external `Origin` returned
HTTP 200. This can prevent remote loading even if the tunnel remains healthy.
The scoped fix permits only one explicitly configured QA hostname in
Development; no Production origin is added. The QA filter now puts no-store /
no-index headers on early denials as well as proxied responses, avoiding the
observed empty-header condition that may trigger the connector bug. Redacted
route/status/timing diagnostics are opt-in; no URL, OTP or password is logged.
The deterministic ingress checks cover these changes, but a repeat iPhone
journey through a stable owner-only ingress remains required.

Validation for the scoped source commit `b1f74d7593e0e272a48b95f55a3f75c41c65524e`:
TypeScript PASS; canonical lint-baseline PASS with no regression; no-deploy
Production build PASS; domain 46/46; security 48/48; 256 migration files;
release contract PASS; PUSH 39–45 deterministic preservation PASS; QA ingress
contract PASS; exact-head CI 9/9 PASS. The first local security and build
attempts were denied a loopback test/compiler port by the sandbox and passed
when run with the required local permission. These checks do not substitute
for authenticated iPhone Product evidence.

The temporary QA filter was stopped and its loopback port refused connections;
the crashed public hostname returned HTTP 530. No new tunnel, DNS, Access
policy, paid service, media route or Production path was activated. The
protected Quick Tunnel is **not** considered a stable qualification path:
Cloudflare also has an open report of protected-session expiry shortly after
OTP ([upstream issue](https://github.com/cloudflare/cloudflared/issues/1752)).
An isolated named Access path could be evaluated only after actual account-plan
and cost headroom, owner-only policy, and rollback are verified; the existing
home Gateway Tunnel must remain untouched. No authenticated Product dashboard,
cellular Product access or remote video proof is claimed. PR #234 remains draft
and PUSH 44 remains PARTIAL / CANONICAL NOT DONE.

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

## 2026-10-21 owner-only named-tunnel QA continuation

The owner approved a temporary, no-new-fixed-plan QA ingress for at most 30
minutes, with a one-time private gate before the Product, bounded request/byte
limits, and no media or public database routes. Cloudflare's existing Free
account had one of 1,000 included Tunnels in use before creating this isolated
QA Tunnel. Zero Trust onboarding and payment-card terms were not accepted.
The QA hostname was `qa-iphone-p44-20261021.ganbatuach.com`, with a fixed
shutdown deadline of 2026-10-20 22:29:38 UTC. The token and tunnel credentials
were held outside Git; no value is included in this report.

The initial iPhone black/white loading screen was traced to a concrete origin
mix-up: the QA route filter forwarded to `127.0.0.1:3000`, the separate
integration/development preview, while the scoped PUSH 44 feature Product
ran on `127.0.0.1:3001`. This delivered mismatched Next.js Development/HMR
assets. A separate native login-loop defect was found: the mobile runtime
probed an authenticated endpoint even on the public login page and redirected
an expected 401 back to login. Source fix `c93c7c51` isolates the QA upstream
on port 3001, adds a fixed deadline and source guard, and skips protected
bootstrap on public routes. The owner then confirmed the real Product login
screen rendered in the installed iPhone QA app. The compiled local Product
used isolated Development Supabase; a direct request to the session runtime
returned 401 without authentication, and direct DB/media paths were denied.
Anonymous public HTTPS returned 401 with verified TLS.

This proves **login-screen rendering only**. The owner attempted iPhone login
and received an invalid-credentials message, despite reporting that computer
login succeeds. The computer URL was `https://gan-batuach.vercel.app`, whereas
the phone used the isolated Development database. The working Product account
email was observed in the owner's already-open Vercel settings page; a read-only
Development Auth scan found no matching account among 24 local users. The
separate Cloudflare-gate email was also absent but is not assumed to be the
Product login.
No Production credential was copied, no account was reset, and neither a
password nor one-time code was collected. Successful
Development Product authentication, dashboard navigation, cellular access and
remote playback remain unproven. No video route, APNs, child monitoring, biometric
feature, Production resource or PUSH 46 work was activated. The signed QA
build remains Personal Team/no-APNs. The compiled runtime was built from the
working tree immediately before commit `c93c7c51`; exact-head native build
and authenticated iPhone proof remain open. PR #234 remains draft pending its
required proof and exact-head CI. No migration was added.

Rollback completed before the fixed deadline: the scoped route filter,
`cloudflared` connector and feature Product runtime were stopped; the temporary
QA Tunnel UUID was deleted after checking the target. The pre-existing home
Gateway Tunnel and the canonical integration runtime were untouched. The
former QA hostname returned Cloudflare 530 after shutdown and the temporary
loopback ports closed. No further external QA can proceed without a new,
bounded ingress preflight. An isolated Development-only owner identity must
be provisioned through the authorized Development process before repeating
Product sign-in; the working Vercel Product login is not a Development account.
