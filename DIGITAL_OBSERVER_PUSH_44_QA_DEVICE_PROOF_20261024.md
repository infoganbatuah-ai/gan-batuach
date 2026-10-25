# PUSH 44 — one-installation device proof (isolated Development candidate)

## 2026-10-24 actual local Next/Auth control-path qualification — no external activation

Ran `scripts/qa/check-push44-real-local-control.mjs` with the original `gbi`
Colima Development Supabase (`127.0.0.1:55421`) and the existing protected
`owner-iphone@integration.qa.invalid` credentials. Elevated, read-only runtime
checks found the seven original Supabase containers healthy; the sandboxed
`colima list` reporting `Broken` was not the actual VM state. The script starts
its own feature-branch Next.js process on loopback port 3001, uses an ephemeral
in-memory Access-compatible signer and private proxy key, then shuts down its
own Next process and Unix-socket ingress. It creates no Auth user, pending
device approval, public listener, Cloudflare policy or media route. Credential
and session values are not emitted; only protected local files are read.

**Real local result:** PASS for unauthenticated enrollment-to-login redirect,
actual Next login HTML, all **32** referenced Next static JS/CSS assets, a
password sign-in through the canonical Development Supabase Auth endpoint,
server-side active Observer session and authenticated enrollment screen.
The real login returned QA-host-scoped `Secure; HttpOnly; SameSite=Lax` cookies;
the proxy forwarded only `sb-*` cookies to the loopback application and no
session cookie to static assets. Direct access to the loopback Next page without
the private proxy key, forged cookies, unrelated dashboard/media routes and
invalid device-status requests were denied. The test used **40** proxy attempts
and **11,122,342** reserved-plus-reply bytes under a five-minute local
deadline; **10,712,742** bytes were actual local replies. These are not
Cloudflare measurements or a financial cap.

The actual Next.js runtime exposed two gaps hidden by earlier mock replies:
(1) a streamed Server Component redirect arrived as HTTP 200 plus a meta
refresh; the ingress now accepts only the expected login/enrollment targets and
normalizes them to exact-host HTTP redirects; (2) Next reconstructs `Host` as
`localhost:3001`, so the protected QA page now requires the private proxy key,
the exact forwarded QA hostname and HTTPS protocol, plus the original loopback
Development backend, instead of trusting Host alone. Focused tests cover these
behaviors and hostile targets. No arbitrary forwarded header authorizes access.

**Still not proven:** a real pending Secure Enclave request/key fingerprint,
successful device challenge and status against that request, physical iPhone
flow, or live Cloudflare Access assertion delivery. The local control API
confirmed denial without a real pending request; it did not fabricate one or
issue owner approval. For this existing password identity, the same-origin
login POST establishes the Supabase session; an email `auth/confirm` callback
was not part of this flow and remains intentionally unexposed.

**Access return blocker:** the preserved signed PersonalTeamQA app has only
the QA hostname in `allowNavigation`, no Associated Domains entitlement and no
approved Access-specific return/exchange handler. Cloudflare requires the same
browser context to complete sign-in; a system-browser Access cookie cannot be
assumed to appear in the app's WKWebView. A generic custom-scheme callback
would not safely establish the Access session and is not added here. Thus the
signed binary is valid on disk (provisioning expires **2026-10-26T23:14:41Z**),
but external Access login/return is **BLOCKED** pending a separately qualified,
narrow native return or server-side exchange contract. No installation occurred.
See [Cloudflare Access troubleshooting](https://developers.cloudflare.com/cloudflare-one/access-controls/troubleshooting/)
and [Capacitor universal-link prerequisites](https://capacitorjs.com/docs/guides/deep-links).

**Edge/cost decision unchanged:** the existing Zero Trust Free entitlement has
no new fixed subscription for the intended one-owner control test. Origin
enforces 1,000 total attempts, 60/minute, 2-KiB request bodies, bounded
responses and 64 MiB cumulative reserved-plus-reply bytes with a 30-minute
absolute deadline. Cloudflare Free's shared-zone rate rule cannot match the
exact Host and was not enabled; pre-origin Access/denied requests, provider
traffic and cellular data are outside the origin ledger. There is no verified
contractual hard financial ceiling, so expected incremental provider charge
is estimated at $0 **with residual unbounded edge-cost risk**, not guaranteed
$0. No owner activation request should be made until the Access return path
and actual provider-edge exposure are explicitly accepted/qualified.

## 2026-10-24 iPhone control-page and cost gate continuation — no activation

The proposed Unix-socket ingress now has a narrow same-origin **Development-only**
surface: `GET /digital-observer/qa-device-enrollment`, scoped `GET
/digital-observer/login?next=...`, `POST /api/digital-observer/auth/login`,
`POST /api/digital-observer/qa-device`, and immutable `/_next/static/` assets.
The form is limited to the existing `owner-iphone@integration.qa.invalid`
identity and the enrollment return path. Every admitted request still requires
the signed Access assertion and exact host/forwarding checks; the origin receives
only a private proxy key and scoped Development cookies. The proxy rewrites only
the login/enrollment redirects to the exact QA HTTPS host and emits only scoped
`Secure; HttpOnly; SameSite=Lax` cookies. It rejects unrelated app routes,
administrative approval, HLS/media, arbitrary redirects, forged headers and
wrong-account login. The shared login page redirects an already authenticated
QA viewer back to enrollment, not the general dashboard. The Next bridge now
accepts the *observed* `https://localhost:3001` reconstructed URL only alongside
the exact QA Host and private proxy key. The ingress refuses a non-loopback
Supabase Development URL at startup. No listener, external route or policy was
started by this change.

**Evidence and limits:** a read-only invalid-credential probe against the
existing loopback Next runtime yielded a `303` whose Location was
`https://localhost:3000/...`, even with the QA Host and forwarded host headers.
This is why the ingress validates and rewrites a local-origin Location before
returning it; it never forwards `localhost` to the iPhone. Focused Unix-socket
tests now cover login/page/assets, scoped redirects/cookies, media denial,
identity/header failures and expiry. These use a synthetic Access signer and
mock Next reply; the direct loopback probe used invalid credentials. **A full
live proxy-to-Next/Supabase login, Cloudflare JWT delivery and physical iPhone
flow are not proven.** The `auth/confirm` email callback is deliberately not
exposed: this QA test uses the already established password identity. If an
Access or Supabase callback is actually needed on the phone, it is a new
reviewed control path, not an implicit wildcard.

The durable SQLite ceiling remains 1,000 requests and 60/minute with a
30-minute absolute deadline. With login/pages/assets admitted, it now reserves
10 KiB per attempt and atomically accounts each bounded reply before sending
it, stopping at **64 MiB total origin-to-client bytes**; a page is capped at
512 KiB, a static asset at 4 MiB, and a control JSON reply at 8 KiB. One
upstream request is in flight. Failed accounting returns no upstream content.
These are origin controls, **not** a Cloudflare edge request or billing cap.

The correct Cloudflare One account is visibly on **Zero Trust Free** with team
`spring-feather-ce4e`; the published seat price is $0 for up to 50 users.
Official Free WAF rate-limiting expressions do **not** offer Host matching,
so a zone-wide Path/IP rule on the shared `ganbatuach.com` zone is not an
acceptable exact-host edge control and was not installed. Cloudflare also
documents that rate-limit counters are not exact global request ceilings.
The intended control-only Tunnel/Access path is supported in principle and
requires no new fixed subscription, but denied edge requests, Access sign-in,
TLS handshakes, other zone usage and cellular data are not bounded by the
64-MiB/1,000-attempt origin ledger. Expected incremental Cloudflare charge
under the present Free entitlement is $0; **no contractual maximum total test
charge is established**. Do not describe this as a guaranteed $0 test.
Sources: [Free pricing](https://www.cloudflare.com/plans/),
[Free rate-limit fields](https://developers.cloudflare.com/waf/rate-limiting-rules/),
[rate-limit counter limitations](https://developers.cloudflare.com/waf/rate-limiting-rules/),
[Access JWT](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/).

The signed PersonalTeamQA package exists with bundle
`com.ganbatuach.app.qa`, team `27G7ZP4U3Q` and provisioning expiry
`2026-10-26T23:14:41Z`. macOS `codesign --verify --deep --strict`
validated the package on disk and its designated requirement with normal
host trust access; it was not installed. More importantly, its QA configuration permits
navigation only to the control hostname. Cloudflare Access authentication
uses a team-domain session/cookie and can redirect through an identity
provider. That **cross-host iPhone sign-in/callback is not qualified** by the
exact-host WebView configuration. Adding broad navigation or assuming Safari
cookies transfer into the app would be an unsafe guess; an approved native
system-browser return path or proven narrow WebView flow is still required.
See [Access cookies](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/).

**Activation decision: BLOCKED.** The next executable Development task is an
isolated end-to-end Access login/callback design for the signed QA app,
followed by a local full proxy-to-Next test using the actual isolated backend.
Only after those pass should the owner receive a 30-minute exact-host Allow
policy/Tunnel/installation request that explicitly accepts residual edge-cost
risk. No Access Allow policy, public DNS/route, phone installation, capability,
Mac approval, media, Home or Production change was made.

## 2026-10-24 transport decision and Free-plan edge gate — no activation

**Decision:** the existing *private-hostname* Access application is not a
qualified origin-JWT transport for this HTTPS topology without Gateway TLS
decryption. The supported candidate is an exact-host **self-hosted public
Access application** with a published Cloudflare Tunnel application route,
not a private-network route or video tunnel. Cloudflare documents delivery of
`Cf-Access-Jwt-Assertion` to a public self-hosted application's origin; the
origin must verify its signature, issuer, exact application audience, expiry
and owner identity. Tunnel `Protect with Access` is an additional upstream
JWT check, not a substitute for canonical Development session authorization.
See [public Access applications](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/),
[origin JWT validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)
and [Tunnel Access protection](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/origin-parameters/).
The current private app stays default-deny; no conversion, new application,
policy, route or DNS record was made. The new public application's AUD must be
read from its actual configuration before startup; the verifier now rejects a
missing AUD rather than silently using the current private app's AUD. Live
assertion delivery remains **unproven**.
In this candidate, the iPhone would validate Cloudflare's *edge* TLS
certificate; the previously issued exact-host Let's Encrypt certificate is
protected but is not automatically installed at that edge or exercised by a
Unix-socket origin. Real device TLS remains unproven.

The local control ingress is now Unix-socket-only: it requires a fresh
`control.sock` beneath an owner-owned `0700` real directory, applies socket
mode `0600`, and refuses pre-existing paths, symlinked parent directories,
TCP connections and direct public binding. A future dedicated `cloudflared`
published-application route may use Cloudflare's documented `unix:` origin
service, with only the exact QA hostname and a separate owner-approved Access
Allow policy. The administrator approval operation remains Mac-local. The
ingress still admits only the exact POST control API and validates Access JWT,
forwarding constraints and canonical Development session separately. It does
not admit HLS, media, Home or Production routes. The signed iPhone control UI
still needs a separately reviewed same-origin login/page/assets path; this
single-API socket is **not yet a usable physical-iPhone transport**. See
[Tunnel routing](https://developers.cloudflare.com/tunnel/concepts/routing/).
The local Next bridge checks the reconstructed HTTPS request URL even though
the current upstream hop is loopback HTTP; an actual local proxy-to-Next
request must prove those forwarded URL semantics before calling the bridge
operational. Isolated constructed `Request` tests do not establish that
integration.

**Edge limitations:** Cloudflare Free documents only one zone rate-limiting
rule, with Path/Verified-Bot matching and IP counting over 10 seconds; Host
matching is not available on Free. A new QA rule cannot safely be applied to
the shared zone until actual rule inventory, a collision-free dedicated path
and legitimate-traffic impact are verified. Cloudflare rate limiting is also
per-data-center and may fail open; it is not a global 1,000-request ceiling or
hard financial cap. Do not change existing WAF rules or purchase the paid
account-level WAF add-on. The durable local 30-minute/1,000-attempt/12-MiB
reservation protects the origin only; it does not meter denied edge requests,
handshakes, Access authentication, Tunnel traffic or unrelated account use.
The Free plan has no new fixed seat charge within its published 50-user tier,
but **maximum provider cost remains residual/unbounded by an enforceable
spending cap**. No dollar maximum may be represented as guaranteed. See
[Cloudflare rate-limiting limits](https://developers.cloudflare.com/waf/rate-limiting-rules/),
[limiting behavior](https://developers.cloudflare.com/waf/rate-limiting-rules/troubleshooting/)
and [Zero Trust pricing](https://www.cloudflare.com/plans/).

**Activation remains blocked.** The narrow same-origin iPhone UI/auth surface,
actual public Access AUD and JWT delivery, exact-host route, zone-level edge
rule impact, and an explicit owner decision on residual provider-cost risk all
remain open. No external route, Allow policy, iPhone installation or media
was activated. Rollback for a *future separately authorized* test is to stop
the socket listener and dedicated tunnel, remove only task-created DNS and
policy resources, and revoke temporary grants. Existing Production, Home,
certificate and deny-only applications are not rollback targets.

## 2026-10-24 control-only trust and cost continuation — no activation

The existing Access application `4382f628-c338-4a23-9da0-1490056b83e4`
still has the exact private hostname on port 443, zero policies, no route, and
Cloudflare One Client automatic authentication off. Its displayed application
AUD was the isolated-test fixture in the prior revision; the live verifier
now requires an explicit AUD at startup. The issuer is the exact
`spring-feather-ce4e` team domain. A future owner-only policy is **prepared,
not saved**: one Allow rule for `info.ganbatuah@gmail.com`, preferably through
the existing verified GitHub IdP, no Bypass or Service Auth, 30-minute maximum
session, with the separate canonical Development QA session and device proof
still mandatory. The email rule alone does **not** bind one iPhone.

Cloudflare's [private-hostname Access guide](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/non-http/self-hosted-private-app/)
states that origin Access JWTs for HTTPS private hostnames require Gateway TLS
decryption; without it the Cloudflare One Client manages the session instead.
That shared-account TLS-decryption configuration is not verified or approved
for change, and the existing iPhone Client is disconnected. Therefore the
current private-hostname Access application cannot yet be claimed as a
server-verified JWT delivery path. A signed-JWT verifier cannot repair that
transport mismatch. The live signing-key endpoint was not reachable from the
current local/browser checks; local tests use isolated synthetic keys only.
No Allow policy, TLS decryption, VPN, DNS, route or origin was activated.

A new inert-by-default, owner-only Unix-socket control ingress candidate validates the
exact issuer, app audience, RS256 signature against the team's current JWKS,
expiry, 30-minute token lifetime and exact owner email. It requires the exact
Host/Origin/HTTPS forwarding and one POST control path, rejects duplicate or
spoofed sensitive headers, strips all caller identity headers, injects the
protected private proxy-to-origin key, and forwards only scoped Supabase
session cookies to the existing Development bridge. The bridge separately
checks the canonical Development QA session and tenant/Site/device policy;
Access identity cannot replace it. The ingress has 2-KiB request, 8-KiB
response, one in-flight request, durable SQLite 60-attempt/minute,
1,000-attempt and 12-MiB
conservative reserved-byte ceilings, plus a 30-minute absolute shutdown. The ledger
atomically reserves the maximum request/response bytes **before** forwarding;
an accounting failure cannot authorize an upstream operation. A changed
deadline cannot reset its ledger. No listener starts on import, and no
production activation command or secret is committed. Its single allowed API
path denies HLS, media, Home, Production and Mac administrator actions.
This is **isolated proof**, not an externally deployed edge or a complete
phone-facing page/login route.

The signed iPhone UI currently requires an authenticated HTML page and assets;
the new minimal control-only API ingress intentionally does not expose them.
Before a phone test, a reviewed same-origin login/page/static-asset delivery
boundary must be qualified without widening to unrelated application routes.
The current private-hostname Access/JWT mismatch must also be resolved via a
separately approved architecture; enabling shared Gateway TLS decryption is
not authorized by this task.

The account remains Zero Trust Free (up to 50 users, $0 seat price); no new
fixed subscription was created. At the application boundary 1,000 accepted or
denied attempts with at most 2 KiB request plus 8 KiB response each imply
under 10 MiB of bounded body data, with a separate 12-MiB local reservation
failsafe. The reserved bytes are an upper bound, **not measured transfer**.
This **does not** bound Cloudflare pre-origin requests, headers,
handshakes, retries, cellular traffic or unrelated account usage. Because no
approved compatible external route and provider-level cost/abuse control are
verified, the maximum financial exposure is **BLOCKED**, not $0 guaranteed.
No paid add-on may be activated to resolve that gap.

The protected Mac presence helper remains owner-owned mode `0700` beneath a
`0700` parent and retains the previously pinned SHA-256; no new presence
prompt or enrollment approval was performed. Focused synthetic tests cover
forged/wrong-audience/wrong-issuer/expired Access tokens, wrong owner,
spoofed headers, forbidden paths, concurrency, oversized bodies/responses,
durable attempt accounting, deadline, existing parent self-approval denial,
wrong key, replay, expired approval, session revocation and tenant/Site scope.
Those tests do not prove live Cloudflare JWT issuance or physical-iPhone TLS.

**Activation decision: BLOCKED.** The supported public self-hosted Access
architecture is selected above, but its live AUD/JWT, narrow page/login
surface and provider-edge cost risk remain unqualified. Only after those gates may the owner be
asked separately to approve a 30-minute control-only route and signed-app
installation. Rollback remains: close the loopback listener, remove only the
future temporary route/policy, revoke the one-use QA grant, and leave the
existing deny-only Access app and issued certificate untouched unless a
separate cleanup decision is made.

## 2026-10-24 non-public control TLS and Access preflight

Owner authorization covered one exact-host DNS-01 challenge, issuance through
the existing dedicated Let's Encrypt ACME account, challenge cleanup, and one
deny-only Access application. Account `693f824a750afcc264fe6ee58c8a86ab`
and its `ganbatuach.com` zone were verified in Cloudflare. The DNS zone had 14
records before the operation, with no exact control-host or challenge record;
the Access inventory had only the separate synthetic-media application, so no
exact-host collision existed.

Certbot 5.8.0 requested only `qa-iphone-device-proof.ganbatuach.com` with a
fresh ECDSA key, reusing the protected ACME account under the Mac's
`/Users/danielderi/Library/Application Support/DigitalObserverQA/acme/config/`
tree. One task-created TXT at
`_acme-challenge.qa-iphone-device-proof.ganbatuach.com` propagated to both
authoritative Cloudflare nameservers and resolver `1.1.1.1` before validation.
Let's Encrypt issued the single-name certificate. Its sole SAN is the exact
control hostname; issuer `YE2`, validity **2026-10-24 17:59:24 UTC through
2027-01-22 17:59:23 UTC**, certificate SHA-256 fingerprint
`32:6B:A9:11:F6:84:3F:95:25:F3:52:28:EB:F3:80:5D:95:62:82:88:ED:96:88:C0:B2:48:95:C2:59:9A:2D:62`.
Local chain verification using the issuer chain and Homebrew trust bundle
returned OK; public-key digests of the certificate and protected key matched.
The key file is owner-owned mode `0600` under an owner-only `0700` config/archive
parent. No key or challenge value was copied to Git. Manual DNS-01 will **not**
renew automatically; renewal requires a later approved challenge. Public
certificate-transparency logging of the QA hostname is an expected consequence
of issuance, not endpoint activation. This is local trusted-chain proof, **not**
an iPhone TLS test.

Only the task-created TXT was deleted after issuance. The DNS inventory returned
to 14 records, and both authoritative nameservers returned no TXT at that name.
Public A, AAAA and CNAME for the control hostname remain absent. A dedicated
Cloudflare self-hosted **private-hostname** Access application, ID
`4382f628-c338-4a23-9da0-1490056b83e4`, now names only the exact host on
port 443. It has **zero policies** (no Allow, Bypass or Service Auth), a
30-minute application session setting, and is hidden from App Launcher. This
is deny-only configuration, not a public or private route. Cloudflare still
shows only the pre-existing Home tunnel, with no routes; no QA origin, CNAME,
private route, media, iPhone install or owner enrollment approval was activated.

Zero Trust remains Free (`Teams Free Base`); the account's existing Workers
Free and R2 Paid subscriptions were unchanged. No new fixed subscription was
activated. The future external control-window request/traffic and cellular
cost bound is still **unverified**, so no route may open. A trusted proxy must
also be qualified for header sanitation, Access-audience validation and
loopback-only forwarding before that window. Rollback of this preparation is
limited to deleting only Access application
`4382f628-c338-4a23-9da0-1490056b83e4` after checking no dependent use;
the DNS challenge is already gone. Certificate revocation requires a separate
incident/cleanup decision, not deletion of the existing ACME account.
Existing signed iPhone build, device-proof core, migrations, PR #235, main,
Production and Home services remain unchanged; physical proof has not run.

## 2026-10-24 final physical-enrollment readiness pass (no activation)

The exact-host PersonalTeamQA installation now targets only
`https://qa-iphone-device-proof.ganbatuach.com/digital-observer/qa-device-enrollment`.
The native bridge checks both the hostname and that exact path before creating
or using its Secure Enclave key. The Development-only page requires the fixed
QA viewer's current authenticated session, presents the random pending request
ID and public-key fingerprint, and never contains an approval action. It
supports pending, approved, denied and expired status; approval completion
uses the existing one-use challenge/signature core. The status read is scoped
server-side to the exact key, request ID and canonical session. Isolated tests
confirm wrong-key/request denial, expiry, revocation, replay, tenant/Site and
session denial; none is physical-iPhone proof.

The native login retains HttpOnly Supabase cookies. A new inert-by-default
server-side control bridge revalidates the exact QA viewer, reads the session
token only on the local server, forwards only four named operations to the
loopback operator and never returns a token to JavaScript. Its guards require
the exact HTTPS Host/Origin/forwarded protocol, an owner-protected proxy key,
`LOCAL_SUPABASE` on `127.0.0.1`, a loopback-only operator URL, an absolute
deadline no more than 30 minutes away, 2,048-byte bodies and explicit
`PUSH44_QA_CONTROL_ONLY=1`. It fails closed on Vercel or missing configuration.
Two deterministic boundary tests deny host/origin spoofing, insecure forwarding,
wrong proxy key, non-loopback backends and expired or overlong windows.
No media/admin route exists in this bridge. A future trusted proxy must remove
client-supplied forwarding/proxy-key headers before injecting its own and must
validate Cloudflare Access's exact application audience; this proxy and Access
application are **not** active or qualified yet. The local control transport
still enforces its durable 1,000-attempt ceiling; edge-denied traffic is not
covered by that ceiling.

The reviewed macOS presence helper was compiled to an owner-only directory
under `~/Library/Application Support/DigitalObserver/Push44Qa/` on the internal
Mac (not Kingston's `noowners` volume), with directory mode `0700`, binary
mode `0700`, owner UID and pinned SHA-256
`13fe7419e282a04516e72f2a55f0a4a351975c20de5c9591b86ab4c239759283`.
The owner approved one fresh macOS presence prompt and the helper returned
`PRESENT`. This verifies the local presence mechanism, **not** a current
Development owner approval session, scoped bootstrap capability, real pending
device request, or one-use device approval. No such grant was issued. The
existing SQLite hash-chain audit is tamper-evident within host custody, not an
independently immutable off-host receipt; immutable receipt qualification
remains open before live enrollment.

The QA hostname still returns public DNS `NXDOMAIN` on the read-only lookup. The
Cloudflare account/zone and Free plan were previously verified, but there is
no exact-host Access application, DNS route or hostname-specific publicly
trusted TLS certificate. The earlier Let's Encrypt certificate covers the
different synthetic-media hostname. [Cloudflare's current self-hosted app
guide](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/)
requires an Access policy before publishing a Tunnel route and origin token
validation. Its Free plan has a $0 fixed seat price under 50 users, but a
complete account-specific request/traffic/cellular cost bound and edge limits
are **not verified**, so no external route may be opened. Only control
requests are proposed; video remains expressly excluded by provider terms
and this owner's approval.

A new non-installed PersonalTeamQA device build on Kingston targets the exact
page above and passed macOS designated-requirement verification. It has bundle
ID `com.ganbatuach.app.qa`, no APNs entitlement, no bootstrap token and no
Production URL. Its executable SHA-256 is
`b30e69138e9bff8541ae4667abeb948425e42cd216a453078aac82a6436db83c`.
The previous signed build remains preserved; this one has **not** been
installed or tested on the physical iPhone. Its Personal Team provisioning
profile expires **2026-10-26 23:14:41 UTC**; a later owner-approved window
must check validity and rebuild if necessary. No DNS, Access, Tunnel, Supabase
role/data, Home, media or Production mutation occurred in this pass.

Next technical gate before requesting a live control window: qualify the
exact-host certificate and owner-only Access application **without publishing
the route**, then test the trusted local proxy's header sanitation, Access
audience validation and edge accounting in isolation. Only after those gates
and a verified cost bound should the owner be asked to approve one 30-minute
control-only window, one signed-app installation and one exact-key bootstrap
ceremony; the owner approval must occur after the physical pending request
exists. No broad administrative privilege is needed.

## Exact physical enrollment-request preparation — 2026-10-24

This continuation reuses the existing verified GitHub owner-identity receipt
below; it does not repeat the email query or turn repository administration
into application administration. The Development owner identity remains a
confirmed, unassigned parent with **no** enrollment capability. No capability,
one-use approval or pending physical-device request has been issued.

The PersonalTeamQA bridge now accepts **only** the proposed control hostname
`qa-iphone-device-proof.ganbatuach.com`, not the former `qa-iphone-*` pattern.
The build preparation script has a separate `PUSH44_QA_CONTROL_ONLY=1` mode:
it requires the exact HTTPS origin URL with no path, query or embedded token;
it refuses a bootstrap-token file, other host, Push plugin and pre-existing
server URL. The old owner-only Product QA mode remains separate. Configuration
generation neither starts a listener nor exposes the control hostname.

The eventual phone request is exactly the native bridge's X9.63 P-256 public
key submitted to `POST /qa-device/request-enrollment` under the **existing**
canonical authenticated LOCAL_SUPABASE viewer session. The server derives the
SHA-256 key fingerprint, generates a random request ID, pins it to that session
and the fixed synthetic QA viewer/tenant/Site delegation, and expires it after
five minutes. A second key/session cannot replace an active pending request.
Neither a public-key fingerprint nor an installation/request ID can be known
or preapproved before the actual signed app creates the key on the iPhone and
reaches the authorized control route. The private key never leaves Secure
Enclave/Keychain. There is presently **no phone-side control UI/request
adapter**, phone-reachable control route, hostname-specific trusted TLS, or
Cloudflare Access application for this hostname. Thus a real pending request
is **blocked**, despite isolated request-store tests passing; do not fabricate
one from a synthetic key or use the old URL-token bootstrap.

The subsequent Mac-only ceremony must read the real pending request and exact
fingerprint from the trusted host, reverify the distinct owner Development
session and audited one-request bootstrap capability, require fresh macOS
presence with the protected pinned helper, and issue the existing 60-second
single-use approval. The phone's parent session cannot approve itself. The
helper was previously exercised once in a temporary owner-only location, but
its protected durable installation and a fresh live presence prompt remain
open. Approval is never exposed through the phone-facing HTTP transport.

Before any separately authorized physical test: implement and review a
control-only phone UI that obtains the existing Development session without a
client secret, calls `Push44QaDeviceProof.publicKey`, and sends only that
public key to the private route; establish exact-host trusted TLS and
owner-only Cloudflare Access with strict forwarding-header sanitation, the
30-minute absolute shutdown, edge request/traffic limits, audit and immediate
rollback; verify the total provider cost bound; install the separately signed
QA build only after owner approval. The route must deny all media, admin and
Production paths. No DNS, route, phone installation or media activation is
performed by this preparation.

A separate non-installed `PersonalTeamQA` device build was completed on
Kingston at `worktrees/push-44-ios-real-device/ios/DerivedData/Push44ControlQA/Build/Products/PersonalTeamQA-iphoneos/App.app`
at 2026-10-24 18:12 UTC. macOS `codesign --verify --strict` succeeded with
the existing Apple Development identity and designated requirement. Its
bundle ID is `com.ganbatuach.app.qa`; the embedded server URL is the exact
control HTTPS origin; `cleartext` is false; Push is absent; no APNs entitlement
was found. The executable SHA-256 is
`fd1d015de011d11503fe5eba0db4ebf326ef6948703923c689a2725a783f4898`.
The bundle remains a local build artifact, not a remotely preserved signed
release or physical-device proof. Installation, actual iOS TLS trust and
Secure Enclave operation still require a separately approved QA window.

## Owner bootstrap identity check — 2026-10-24 (read-only)

The connected GitHub App installation identifies account `infoganbatuah-ai`
with numeric user ID `287220776`; GitHub reports repository `admin`
permission. Its profile email field alone has no verification flag. A separate
existing GitHub CLI credential stored in the macOS keyring was confirmed to
authenticate as the same login and user ID. With no scope extension, the
authenticated read-only `GET /user/public_emails` response established:

- Target owner email matched: **YES**.
- GitHub `verified` for that exact target: **TRUE**.
- Verification timestamp: **2026-10-24 18:01:43 UTC**.
- Authentication method: **existing GitHub CLI keyring credential**, tied to
  user ID `287220776`; the GitHub App connection was used only for a profile
  cross-check.

Only the exact target-match and verification booleans were returned from the
email query. No address list or credential was printed, stored, or committed.
The broader `/user/emails` endpoint remains unavailable to the existing CLI
scopes, but **no `user:email` or Email addresses: read permission is needed**
for this public-address verification. No scope extension or new token occurred.
The LOCAL_SUPABASE confirmation still came through the local mail catcher;
it proves a local Auth confirmation/session, not independent mailbox delivery
or Observer ownership by itself.

GitHub's verified address and repository administration establish a useful
independent project-owner identity check, **not** an automatic Development
authorization grant. A one-request capability still requires an explicit
new owner approval, the exact active LOCAL_SUPABASE owner Auth ID and session,
recheck of repository administration, a pending installation ID and public-key
fingerprint, fixed QA viewer/tenant/Site scope, fresh Mac owner presence,
an auditable short expiry, one-time consumption and revocation. The parent QA
account and synthetic administrator cannot issue it. No capability, pending
device approval, global role or Production permission was granted here;
external HTTPS, VPN and media remain off.

## Owner-scoped enrollment boundary — 2026-10-24 (not activated)

The original `LOCAL_SUPABASE` was checked read-only after the owner signed in:
one exact owner Auth record exists, but the profile remains an unassigned
Gan Batuach `parent`; it owns zero Observer Sites, has zero active Observer
memberships, and has no `push44_qa_enrollment_approver` capability. The
synthetic QA Site is not a database Site record. Consequently neither parent
login, email confirmation, Mac unlock, nor the synthetic admin fixture is an
independent Observer ownership/bootstrap anchor. **No capability or device
approval was issued.** No Management role, global `admin`, RLS, or Production
record was changed.

The isolated Development transport now accepts an authenticated
`/qa-device/request-enrollment` request containing only a P-256 public key.
It records one pending installation with an unpredictable request ID, exact
public-key SHA-256 fingerprint, canonical QA session and five-minute expiry.
A second key/session cannot replace the active pending request. The host-only
approval operation requires that exact pending ID and key, a fresh separate
owner session with server-held `observer.qa_device_enrollment.approve`
capability pinned to the same ID/key/tenant/Site/viewer, and fresh Mac owner
presence. It rechecks the pending row atomically before issuing the existing
60-second, single-use approval. No HTTP route issues approval; no service-role
key enters the Mac helper or phone. The new route is **not externally active**.
Its isolated tests do not prove a physical iPhone or legitimate capability
provisioning.

Required bootstrap before any grant: the owner must separately authorize the
exact one-request Development capability after the pending iPhone installation
ID and public-key fingerprint exist. A trusted operator must independently
verify project-owner control through an existing project-owned administration
identity (not this parent login, a fixture, or email string alone), confirm the
exact LOCAL_SUPABASE Auth ID and current session, obtain fresh macOS owner
presence, and record an auditable, expiring Auth-admin metadata update with
revocation. If that independent authority cannot be established, issuance
remains blocked. The owner must not approve an unobserved or arbitrary key.
The protected Mac helper and private HTTPS transport remain separate gates.

## Owner Development Auth invitation and least-privilege correction — 2026-10-24

The original `LOCAL_SUPABASE` project had no Auth user or profile for the
project-owner mailbox before this operation. A single Auth Admin invitation was
created through the guarded local Supabase API, without a password. The new
Auth user was initially unconfirmed; its active profile is the default
`parent` role with no Garden assignment. No enrollment capability, admin role,
device approval, or second iPhone identity was granted. The connected owner
Gmail account identifies the same mailbox, but local Supabase uses a **local
mail catcher** and has email confirmations disabled; invitation creation is
not proof that the actual mailbox received an email. A later read-only check
found email confirmation and one Auth session. The owner independently
confirmed that following the invitation on the Mac opened the Gan Batuach
**parent** dashboard in Development, not the Digital Observer dashboard. The
generic callback defaults to the Management product for an unassigned parent
profile. This corroborates a local Auth sign-in, not Observer administrator
access, and does not grant the
single-purpose approval capability or prove a fresh presence ceremony. No device
privilege follows from a session record alone. The invitation link must
not be copied into Git, logs, chat, or a report.
Sanitized local Auth timestamps (UTC): invited `17:00:01`, confirmed
`17:03:19`, first sign-in `17:03:20` on 2026-10-24. The local mail catcher
contains one addressed invitation; its body and one-time link were not read
by the agent.

`profiles.role = admin` is global Development authority: read-only review
found 1,058 RLS policies referencing `is_admin()` (of 1,234 policies) and
additional administrative application routes. It is not a suitable role for
this single-purpose phone enrollment. The host-only reader now refuses a
global admin role and instead requires the exact pinned owner Auth/profile
identity, confirmed email, a current server-side session, an active unassigned
profile, and a short-lived Auth-admin-controlled `app_metadata` capability
bound to the one synthetic viewer, Site, tenant and purpose. It accepts no
user-editable metadata and re-reads Auth on each decision. The capability is
**not issued in this operation**; issuance requires a separately verified
owner login, a fresh Mac owner-presence ceremony, a guarded local Auth Admin
update, and a sanitized audit/revocation record. The approval store remains
empty, the loopback transport closed, and the external QA endpoint closed.

The local Mail UI is `http://127.0.0.1:55424`. The owner must personally
use the normal Development sign-in on the Mac; the agent must not inspect or
relay the one-use link. Before capability issuance, reverify
`email_confirmed_at`, that the profile remains unassigned, and that no broad
role appeared. If actual mailbox-delivery proof is required, first configure
an approved outbound Development SMTP path; local catcher receipt is not
equivalent. No Production Auth or Cloudflare configuration was changed.

Scope: PR #248, `LOCAL_SUPABASE` viewer, fixed synthetic Site/tenant/source in
`SYNTHETIC_QA`. No Production schema, Cloudflare policy, Home source, or public
route is changed. The existing media lease and byte accounting remain the
authoritative media gate; proof of possession is an additional condition.

## Trust boundary and enrollment

- The PersonalTeamQA iOS binary registers a Capacitor plugin only for the
  configured `qa-iphone-*.ganbatuach.com` HTTPS origin. It generates a P-256
  Secure Enclave private key with `WhenUnlockedThisDeviceOnly` Keychain access.
  The bridge returns only the X9.63 public key and ECDSA signatures. It never
  exposes an export API for the private key. Availability and non-exportability
  are source-level properties until a signed binary is exercised on the phone.
- Enrollment requires the existing authenticated Development session, an exact
  synthetic delegation, and an independently approved administrator/owner
  record pinning the public-key digest, session, viewer, tenant, Site and source.
  An email/password login or client-supplied device label alone cannot enroll a
  new key. The approval adapter must be backed by an authenticated, auditable,
  one-time owner action before activation; the isolated test uses synthetic
  callbacks and is **not** an approval service.
- The host-local core accepts a caller-owned protected SQLite connection and
  the canonical Development authentication adapter. It creates one binding,
  one-use challenges and a hash-chained audit record. There is no HTTP listener
  or general-purpose enrollment endpoint in this change. The public Worker and
  QA Access application remain closed/default-deny.
- Challenge bytes bind protocol version, operation, Development environment,
  viewer, tenant, Site, synthetic source, session, public-key digest, method,
  path, random 256-bit nonce and 30-second expiry. Verification consumes the
  challenge atomically before signature checking; failed signatures cannot be
  retried with the same nonce. ECDSA P-256/SHA-256 is verified by Node's
  cryptographic library. A revoked or expired binding is denied immediately.
- A new key cannot silently replace an active key. Replacement requires
  revocation or expiry and a fresh independently approved, one-time enrollment.
  App reinstall, device restore and Keychain reset are treated as key-loss
  events requiring this owner-mediated recovery; no automatic recovery is
  asserted. The native plugin fails closed on a Keychain/UserDefaults marker
  mismatch. A future physically tested recovery ceremony must establish how
  the owner clears a stale local key/marker without weakening enrollment.

## Integration and remaining activation gates

`withPush44QaDeviceProof` wraps the existing private gate's `authenticate`
adapter. It validates a fresh request-bound proof, rechecks the canonical
session and key state on each gate call, and pins the media `deviceId` to the
verified public-key digest rather than an untrusted client label. It does not
alter the existing 300-second, 100-MiB, one-viewer or lease controls.

This is **isolated contract integration, not a deployed end-to-end media
path**. A trusted private challenge/enrollment transport, durable restricted
approval store, native-to-Product bridge invocation and iOS HLS request
authorization still need to be completed and reviewed before any activation.
In particular, native `<video>`/AVPlayer HLS segment fetches cannot be assumed
to attach one-time proof headers; the current adapter intentionally denies
such unsigned requests. Do not work around this by putting reusable tokens
in HLS URLs or weakening the existing media gate. The approved iPhone has not
run this new binary, so no real-device key or second-iPhone proof is claimed.

For the current Development-only candidate, tests use in-memory SQLite and
synthetic P-256 key pairs. They prove the server-side contract, including
unapproved/second-key denial, wrong account/tenant/Site/source denial, replay,
expiry, revocation, error fail-closed and audit minimization. No real camera,
external synthetic media, Cloudflare change or Production operation is part of
these tests. The exact native compile, required CI and Git status are recorded
in the PR checks and task handoff; a code test does not imply physical proof.

## Controlled-enrollment continuation — 2026-10-24

The private host candidate now has a SQLite-backed, single-pending-approval
store. An authenticated `LOCAL_SUPABASE` principal, exact synthetic delegation
and a **separate trusted owner/admin action adapter** must all succeed before
it issues a 60-second, one-use approval pinned to the public-key digest and
canonical session. Atomic consumption, explicit approval revocation and a
metadata-only hash-chained audit survive process recreation when the caller
uses a protected durable SQLite file. A second key cannot be silently enrolled.
The tested synthetic owner-action callback is **not** an actual authorized
administrator ceremony; no live owner enrollment has been performed.

The challenge/enroll/prove/revoke transport binds exclusively to `127.0.0.1`
on an ephemeral port and starts only when a trusted operator calls `listen()`.
It rejects browser Origin, cookies, invalid Bearer credentials, oversized
bodies, arbitrary paths and non-POST methods. A durable 1,000-attempt ceiling
and metadata-only STARTED/ACCEPTED/DENIED audit are enforced at the serving
boundary; an unavailable audit blocks the protected action. The caller must supply the
canonical server-side Development session adapter. The host-only operator
factory composes the existing `createCh1DevelopmentAuthenticator` against the
exact loopback Product SHA, `LOCAL_SUPABASE` runtime and active mobile session;
its isolated test uses synthetic Product responses and confirms runtime drift
and revoked-session denial. It opens no public route and is **not reachable from the
iPhone**. A future approved HTTPS bridge must retain the same authorization
checks and be reviewed before any phone-facing activation.

The existing media gate still requires a fresh per-request device signature
as well as the canonical Supabase session, exact delegation and lease. Native
AVPlayer/HLS does not attach those proof headers to playlist and segment
requests. A copied cookie or URL is therefore denied, but playback is also
denied. This is a deliberate fail-closed state, **not** completed iOS HLS
authorization. The next design must provide device-bound native request
handling or equivalent proof at the actual serving boundary without a reusable
bearer-only media session. No media route was activated here.

No migration was added: this short-lived Development operator state belongs
to a protected local SQLite file, not Production or public Supabase. The file
owner, retention and cleanup are the trusted operator; expected volume is one
binding, one pending approval and at most 600 challenges for the single QA
session. A real owner-action adapter and protected durable store must be
qualified before phone enrollment. Key loss/reinstall still requires an
explicit owner-authorized re-enrollment and cannot be silently repaired.

A local `PersonalTeamQA` device build completed with the existing Apple
Development identity and the connected iPhone 13 Pro selected in Xcode.
`codesign --verify --strict` passed for bundle `com.ganbatuach.app.qa`;
the executable SHA-256 is
`0aa3023b1dd61f7ef4ca1836e96167da7c77d22b79e4a1419a700ededa3a9f77`.
The signed entitlements have no APNs key. The built package remains under
`/Volumes/DIGITAL_OBSERVER/XcodeStorage/DigitalObserver/DerivedData/Build/Products/PersonalTeamQA-iphoneos/App.app`.
It was **not installed or exercised** in this continuation: the current
offline-safe QA bundle has no approved phone-reachable challenge transport,
and installation would not prove Secure Enclave behavior or owner enrollment.

## Distinct owner approval and HTTPS ingress preparation — 2026-10-24

The actual isolated Development iPhone fixture is a `parent` profile with a
`home` account in onboarding state. It is **not** an owner/administrator. Its
valid login cannot approve its own device key. The host operator requires
a separately pinned owner identity and a separately active Auth session. The
read-only owner adapter accepts only the canonical loopback LOCAL_SUPABASE URL,
verifies the user through Supabase Auth, checks the server-side
`digital_observer_current_session_active` RPC and the scoped owner capability
described above, then binds the distinct session to the one synthetic QA
Site/tenant. It never uses a service-role key or trusts
user-editable metadata. Its owner profile ID and token are supplied only to
the trusted host process; no owner token is included in the iPhone build.

For each approval or revocation, the trusted host action checks that owner
record, requires a fresh macOS `deviceOwnerAuthentication` ceremony through
the reviewed local helper, then checks the owner session again. It accepts no
caller-supplied approval string. The existing SQLite approval store remains
the only issuer of a one-use, 60-second, exact-key approval. The helper source
typechecks on macOS, but a protected, trusted binary has **not** been installed
or exercised with the actual owner. A local Mac unlock proves host presence,
not by itself the Development owner's identity; both checks are
required. The helper must be placed on an ownership-enforcing protected volume
and verified before a live ceremony; the Kingston `noowners` volume is not a
safe executable custody location.

The same loopback transport has a prepared optional trusted-ingress mode. It
still binds only `127.0.0.1`; in this mode it requires the exact
`qa-iphone-*.ganbatuach.com` Host and Origin, HTTPS forwarding assertions,
and a high-entropy host-to-ingress key that never reaches the phone. The
reverse proxy must **strip incoming forwarding and ingress-key headers** and
inject its own after Cloudflare Access owner-only authentication. Direct
loopback requests are denied when this mode is enabled. The Product session,
one-time challenge, delegation and key binding are rechecked by the transport;
an ingress key alone cannot authorize enrollment. No reverse proxy, DNS route,
Cloudflare policy, HTTPS endpoint or media path was activated in this task.

The host helper adapter rejects Kingston execution, requires an owner-only
binary and parent directory, and checks a pinned SHA-256 before invoking it.
The digest and binary placement must be approved and verified at activation;
the helper is not installed by this PR.

Activation remains blocked until (1) the verified Development owner account
receives the scoped capability and its current session is independently
validated; (2) a
trusted protected host helper is installed and qualified; (3) a time-bounded
owner-only HTTPS ingress with valid iPhone TLS is separately approved and
verified, including forwarding-header sanitation, strict origin routing,
rate/cost bounds and immediate disable; and (4) the QA build is configured
for the approved HTTPS origin and its signature is valid at installation.
The current `PersonalTeamQA` package still has the offline-safe configuration.
The previously recorded executable digest remains unchanged. An initial
sandboxed `codesign --verify --strict` check returned
`CSSMERR_TP_NOT_TRUSTED`; the same check with normal macOS trust-store access
verified that the package is valid on disk and satisfies its Designated
Requirement. This verifies the existing package signature, **not** that a
phone-reachable HTTPS-configured variant has been built or installed.

Physical qualification after separate approval: open the Development QA app
on the iPhone, authenticate as the existing dedicated viewer, generate the
Secure Enclave key, send only its public key to the private challenge route,
perform the separate owner presence/administrator approval on the host, sign
the one-use challenge, confirm enrollment and persistence after app restart,
then revoke and verify immediate denial. A second independent installation
must be denied. Key loss requires a new explicit approval. No physical proof,
external media or real CH1 playback is claimed here. The existing unsigned
HLS playlist/segment boundary remains denied.

## 2026-10-24 control-only activation preflight (not activated)

- The isolated LOCAL_SUPABASE database has one active `admin` profile,
  `00000000-0000-4000-8000-000000000501`, but a read-only boolean comparison
  shows it does **not match the project-owner email used for Cloudflare**, and it has **zero unexpired
  Auth sessions**. The dedicated phone account remains a `parent`; its session
  cannot approve enrollment. A verified Development-only administrator identity
  authorized by the actual owner, separately authenticated from the phone account, must
  be established through the canonical authorization workflow before any host
  approval. Do not elevate the parent or treat the unrelated admin fixture as
  owner. A separate exact-email lookup found **zero Development Auth users**
  for the project-owner Cloudflare email. No token was read, minted or copied
  during this preflight.
- Cloudflare account `693f824a750afcc264fe6ee58c8a86ab` owns the active
  `ganbatuach.com` zone (`7ed7c66b239f8f6d108e2c3944db29a4`). The live
  DNS dashboard lists 14 records and **no** record for
  `qa-iphone-device-proof.ganbatuach.com`. Its only Access application is the
  separate deny-only synthetic-media destination
  `gateway-media-homeqa.ganbatuach.com:443`, with zero policies. It does not
  protect the proposed control hostname. No DNS, Access or Tunnel write was
  made. The previously issued certificate covers the media hostname, not this
  control hostname; iPhone-trusted TLS for this hostname is **not proven**.
- The prepared loopback transport now requires that *exact* control hostname,
  a private ingress key, HTTPS forwarding assertions and an absolute deadline
  no later than 30 minutes after startup. Its durable 1,000-attempt ceiling,
  2,048-byte body cap and exact control-route allowlist remain in place. Tests
  deny wrong host, wrong key/protocol, non-control/media routes, oversized
  bodies and post-deadline requests. These are isolated tests only; no edge
  policy, proxy header sanitation or Cloudflare Access token validation has
  yet been deployed. A 1,000-attempt origin ceiling does not cap rejected
  requests or traffic at Cloudflare's edge.
- The Mac presence helper source is typechecked, but no owner-protected,
  pinned-hash executable has been installed or exercised with the owner. The
  existing signed PersonalTeamQA package is still the offline-safe variant.
  The old HTTPS configuration helper embeds an owner bootstrap token in the
  app URL, so it is **not** suitable as-is for this control-only, no-client-
  secret route. A reviewed non-secret control UI/auth bootstrap and a newly
  signed exact-host build remain necessary. Do not install the old package
  as proof of this path.
- The proposed future edge sequence is: establish the distinct local admin
  session and Mac presence helper; prepare a control-only static/auth surface;
  issue hostname-specific trusted TLS; create a new exact-host owner-only
  Access application with no Bypass policy; configure a dedicated outbound
  tunnel with `access.required`, exact audience and origin JWT validation;
  strip all incoming forwarding/ingress-key headers at a local trusted proxy
  before injecting the private origin key; set a 30-minute shutdown timer and
  edge rate/traffic controls; verify media/admin/Production routes deny; then
  request **separate owner authorization** before any external activation.
  The administrator approval operation stays Mac-local and presence-gated.
  Rollback is to stop the loopback operator and tunnel, revoke the temporary
  ingress key/grants, and remove only task-created DNS/Access resources after
  verifying no unrelated dependency. No such resources were created here.
- Cloudflare's published Zero Trust Free tier is $0 for up to 50 users, and
  its documentation supports a self-hosted Access application behind Tunnel.
  This establishes no new *fixed* subscription requirement for this design,
  not a verified all-in maximum: edge-denied traffic, cellular usage and actual
  account quotas must be bounded/checked before activation. No financial
  commitment or charge was incurred by this preflight.

## Development owner identity and Mac presence recovery (2026-10-24)

Historical pre-invitation baseline below. The owner identity and scoped reader
status at the top of this document supersede its then-current blockers.

- Read-only LOCAL_SUPABASE inspection found the sole active administrator
  profile `00000000-0000-4000-8000-000000000501` belongs to the synthetic
  `admin@integration.qa.invalid` fixture. Its Auth role and app metadata are
  `admin`/`DEVELOPMENT`, both set by the guarded Development identity seed and
  fixture SQL. It has a password/email sign-in identity and confirmed fixture
  email, but zero unexpired Auth sessions, zero active observer-Site memberships,
  no Garden assignment and no verified connection to the human project owner.
  Its normal sign-in mechanism exists, but logging into this synthetic account
  would not establish a legitimate owner approval session. No credentials or
  verifier material were read. The iPhone QA user remains a distinct `parent`.
- A separate lookup still found no Auth user for the owner's project email in
  LOCAL_SUPABASE. The existing canonical invitation path uses Supabase Auth's
  administrator invitation API, verified email ownership, a server-side
  `profiles.role` assignment and audit. It requires a properly authorized
  Development administrator; the synthetic fixture is not silently promoted
  into owner provenance. The next owner-controlled step is separate approval
  for a *Development-only* owner-admin invitation and least-privilege role
  grant, followed by email verification and a fresh normal login. Do not use
  direct SQL, the parent's session, or a copied Production identity.
- The owner reader now requires a host-pinned owner profile ID **and** verified
  owner email, a confirmed Auth email, an active Auth session checked server-
  side, and an active administrator profile with the same email. It rejects
  `.invalid` fixture addresses even if their role is admin. The synthetic
  tenant/Site scope remains hard-pinned; this is not a real Home membership.
- The Swift `LocalAuthentication` helper was compiled for the Mac in an
  owner-only temporary directory, checked for 0700 directory/executable modes
  and pinned SHA-256, then actually prompted the owner once. The owner approved
  the macOS prompt and the helper returned only `PRESENT`; no biometric or
  password value was accessed. This proves the local presence mechanism, **not**
  an enrollment approval: no valid owner-admin session exists, and no key was
  enrolled. The temporary helper is not a durable installation; before any
  later enrollment, rebuild or install it in a protected owner-only Mac path,
  repin its hash and repeat fresh presence with the authorized admin session.
- Isolated negative tests cover fixture-email denial, mismatched Auth/profile
  email, unconfirmed email, parent role, inactive session, wrong user and
  non-local Supabase URL. No Development Auth user, role, approval, DNS, Tunnel,
  iPhone installation, Cloudflare setting, media or Production data was changed.
