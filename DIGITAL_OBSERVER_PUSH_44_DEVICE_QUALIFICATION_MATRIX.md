# DIGITAL OBSERVER — PUSH 44 DEVICE QUALIFICATION MATRIX

2026-11-16 latest qualification checkpoint — **SIGNED OBSERVER QA LOCAL LAUNCH / OFFLINE PUSH SAFETY PASS; LIVE GATES OPEN**: PR #587 merged to Development at `3260feb368e7ae61038d2883caaaa59bd8664bd2` after exact-head Digital Observer CI, Management and Snyk passed. Its signed `com.digitalobserver.app.qa` archive verified nested code signatures, installed on the approved iPhone 13 Pro, and launched/reopened locally without the previous dyld failure. This proves local shell execution only: the QA host remains disabled and authenticated login/callback, Push registration/receipt, media, and Android device behavior were not exercised. PR #588 then merged at `eb6f1ab71018e7e5014183e2c4df79f88bd7785b` after the same three exact-head checks passed. Three focused tests show communication/category preference read errors stop the domain Push sender before token lookup/provider submission; the management sender already rejects preference read errors. Neither PR establishes trusted product-to-token binding in either active sender. PUSH 44 remains PARTIAL.

2026-11-16 notification-link and logout checkpoint — **DETERMINISTIC / CI PASS ONLY**: PRs #579–#581 merged to Development at `d9f31cdd01b3a3754c4a8e4877cad99f002f51e9`. Exact-head Digital Observer CI, Management and Snyk passed; local focused checks passed 5/5 (Web Push taps), 4/4 (Gan in-app destinations), and 10/10 (Observer QA revocation-failure UI). Read-only sender review found both active send paths still select tokens by profile; no deployed trusted product binding or writer exists. These checks do not prove a device tap, live Push receipt, authenticated Observer account or server-side revocation on the standalone QA build. PUSH 44 remains PARTIAL.


2026-11-16 standalone Observer iPhone QA screen — **OWNER-REPORTED OFFLINE SCREEN PASS ONLY**: the connected iPhone previously accepted and launched a locally signed `com.digitalobserver.app.qa` staging build; device inventory confirmed that app and the older Gan QA shell were installed separately. The owner later identified the new Hebrew-labeled Observer app with its icon and reported that opening it showed "בדיקת התקנה מקומית בלבד". This confirms visible display of the offline QA status page by owner report, without independently tying that visual observation to the signed executable hash. Authenticated Product login/return, App Attest, APNs, media, Android device qualification and release readiness remain NOT PROVEN. Evidence: `review-only/push44-observer-qa-link-return/observer-offline-install-receipt-20261116.md`. PUSH 44 remains PARTIAL.

2026-11-16 Push-token ownership preparation — **OFFLINE CONTRACT/TEST PASS; PROVIDER AND DEVICE NOT RUN**: PRs #555–#558 qualified the absent trusted native app/token binding, reviewed official Apple/Google prerequisites, added a disconnected canonical challenge and in-process nonce fixture, and added a disconnected fail-closed policy for synthetic already-verified verdicts. Both code PRs passed focused 3/3, TypeScript and lint; all four PRs passed nine exact-head CI checks and merged to Development through `e473232f53dc9e75994adca69ebe01a372361e66`. No cryptographic attestation verifier, persistent nonce, binding writer, active send-path isolation, APNs/FCM receipt or physical Observer app proof; PUSH 44 remains PARTIAL.

2026-11-16 native QA identity/notification/link continuation — **OFFLINE SOURCE/APK AND DETERMINISTIC PASS; OBSERVER PHYSICAL DEVICE NOT RUN**: PR #551 built and inspected separate Gan and Observer Android QA Debug variants. PR #552 confirmed the merged Observer QA Android manifest excludes notification permission and Firebase messaging entry points, while the Gan build retains them; runtime Push registration is gated by eligible release IDs. PR #553 preserved exact `observerqaapp`/`observerqaandroid` schemes through one-use link replay and checked native app ID/platform before server authorization. Its focused 28/28, aggregate PUSH 44 QA, typecheck and lint passed. All three PRs passed nine exact-head checks and merged to Development at `54a31741dbdcb014729e592221743dfefdcefdf5`, `879d2fe94b0c3b5ef95fb61360e5398a0e45213b` and `b33cab0a00514e3706c5d94195a0dd8629afc3bb`. No signed/installed Observer app, authenticated physical callback, actual Push receipt, live playback or release proof; PUSH 44 remains PARTIAL.

2026-11-16 native QA branding and Push audience — **IOS UNSIGNED BUNDLE / ANDROID DEBUG APK BRANDING PASS; PRODUCT DEVICE/PUSH NOT RUN**: PR #547 built and inspected distinct Observer iOS QA icon/launch/bundle/label/callback; PR #549 built and inspected distinct Observer Android QA package/label/icon/splash/callback and inert URL. Both merged to Development with exact-head CI PASS. PR #548 merged a review-only product-audience contract; its schema proposal is not a migration and no active send path uses it. Android Debug APK SHA-256 `b0b840f3792076f76ada1aca89d5c1579b79eccd5aba95487ec4df2e92906b25`; no packaged Firebase credentials were found, but the shared Push plugin/permissions remain. No signed standalone Observer app, device install, Auth callback, APNs/FCM receipt, live media or release-store proof.

2026-11-16 separate app identity continuation — **WEB ID / ANDROID QA DEBUG BUILD / IOS QA UNSIGNED BUILD PASS; PHYSICAL OBSERVER APP NOT RUN**: PRs #542, #544 and #545 passed exact-head CI and merged to Development at `27acead72349159740e428a65bc600e2d3e6771b`, `4094a74a5e5d5958e189a78e4780b3da44a77c7a` and `baed24bd52721716fe53c91a66275aa30ed12272`. Web manifest ID is `/digital-observer/`; Android and iOS QA candidates use `com.digitalobserver.app.qa` and separate names/schemes. Android offline Debug APK (169 tasks) was inspected for package/label/scheme/HTTPS/cleartext, but uses an `.invalid` URL and has shared Push-plugin permissions without Observer credentials. iOS generic-device build is unsigned, uses an `.invalid` URL and has no Observer profile; its bundle identity/config were checked. Neither Observer QA artifact was installed or launched; no authenticated callback, separate-app notification receipt, live media, final icon, release signing or store proof is claimed. Earlier `com.ganbatuach.app.qa` physical results remain QA-shell-only.

Product target clarification, 2026-11-16: final apps are separately identified Gan Batuach Management and Digital Observer for home/business. Gan subscribers receive Observer cameras/alerts within Gan Management through the shared camera core; large-business Observer dashboard/updates use its app, with investigations/integrations in the browser. Existing `com.ganbatuach.app.qa` iPhone evidence belongs to the QA shell only. Neither final app has a corresponding build/install/launch PASS here. Future rows require target app ID, audience, surface and device/browser acceptance evidence; shared native contracts may be reused but do not transfer physical PASS between apps.

2026-11-16 signed opt-in packaging — **GAN BATUACH QA SHELL SIGNED BUILD PASS; DEVICE CALLBACK NOT RUN**: device-targeted PersonalTeamQA build at Development `aac3b9c20a82ad27036ddd436d542cb51cca13ee` succeeded with explicit `observerqa`, zero errors and strict code-signature verification. Output bundle `com.ganbatuach.app.qa` contains exactly one callback scheme `observerqa` and no `digitalobserver`; the existing QA Development profile matches the paired iPhone 13 Pro. Result bundle: `.dev-cache/tmp/push44-qa-signed-optin-20261116/ResultBundles/PersonalTeamQA-observerqa-signed.xcresult`; executable SHA-256 `f98c0f2c9af4945b23fa68c3bf89ea9bb162ce3044fb781fe72fb1ad5c78e52a`. No opt-in installation, launch, Auth callback or standalone Observer app was tested. The older offline-shell return PASS below applies only to that installed QA shell, not this new build or a separate product.

2026-11-16 QA callback build-mode continuation — **SOURCE / UNSIGNED NATIVE BUILD PASS; SIGNED CALLBACK NOT TESTED**: PR #535 merged to Development `a696f2b5bd56ad3aed6ebe4dee4a0386eea584e5` after eight exact-head checks. An incremental-build defect could restore an inherited URL type after the old generated-plist mutation. The QA target now chooses static source plists: default off has no callback scheme; explicit observerqa registers exactly observerqa; invalid values fail. Three actual unsigned generic-iOS builds off → observerqa → off verified output plists in that order. The callback code remains disabled, no opt-in build was signed or installed, and account identity/session exchange remains NOT TESTED. The earlier signed offline shell launch/return proof below is unchanged.

2026-11-15 iPhone QA handoff continuation — **ISOLATED POSTGRESQL PASS / UNSIGNED NATIVE BUILD PASS; REAL DEVICE HANDOFF NOT RUN**: PRs #496, #497, #499, #500, #501, #503, #504, #505, #507, #509, #510 and #512 merged dormant source components after eight exact-head CI checks each. PR #519 then fixed a real `service_role`/`auth.sessions` ACL mismatch. A disconnected synthetic PostgreSQL 17.6 test proved private-function role denial, one-use/replay, one winner for two concurrent consumes and rejection after session deletion; disposable data and container were removed, and canonical Development was unchanged. PR #521 fixed a Secure Enclave key-cast compiler error; an actual unsigned generic-iOS PersonalTeamQA build succeeded with zero errors on the external drive. The proposed SQL was not applied to canonical Development or promoted to a migration; the native key was not enrolled, no signed physical iPhone callback or remote QA login was tested, and PersonalTeamQA still lacks the callback signing configuration. **SIGNED REAL DEVICE HANDOFF / REMOTE BUILD: BLOCKED / NOT RUN**. Existing physical login/session observations below retain their original scope. Evidence: `exports/restricted/push44-private-consume-qa-20261115/REPORT.md` and `.dev-cache/tmp/push44-ios-build-20261115/ResultBundles/PersonalTeamQA-generic-ios-after-seckey-fix.xcresult`.

2026-11-15 server handoff rate accounting — **SOURCE/CI PASS; LIVE GATE NOT RUN**: PR #526 merged to Development `e54981bddd4f6580124bc97d49c26f68f5efd40d` after exact-head CI. The dormant HTTP gate now fails closed unless trusted server-side rate accounting succeeds before parsing/Auth. Focused 27/27, TypeScript and lint passed. It remains hard-disabled and unimported; no endpoint, physical device, provider, media or canonical private-store SQL was activated.

2026-11-15 signed iPhone QA build — **SIGNED NATIVE BUILD PASS; INSTALL/LAUNCH NOT RUN**: Xcode built PersonalTeamQA for the connected iPhone 13 Pro using the existing QA team, created a matching Development profile and passed strict code-signature verification. The result bundle is `.dev-cache/tmp/push44-ios-signing-gap-20261115/ResultBundles/PersonalTeamQA-signed-connected-device.xcresult`; executable SHA-256 `d8b38b0ac1abd66e8df7ce8fb7cd8d925ae528b8bc36a26561e623c4c8c52f97`. Profile expires 2026-11-22T21:21:11Z. No installation, launch, callback, Secure Enclave device proof, APNs receipt or media test.

2026-11-15 owner-authorized device installation continuation — **INSTALL PASS; LAUNCH FAIL; ACCOUNT/RETURN NOT TESTED**: CoreDevice installed the signed PersonalTeamQA 1.0 build and device inventory confirmed `com.ganbatuach.app.qa` on the paired iPhone 13 Pro. One launch before and one after the owner approved developer trust in iOS Settings both returned CoreDeviceError 10002 / FBS security refusal. Developer Mode is enabled. The signed certificate and team, application identifier, entitlement values and embedded profile match in read-only checks. The generic refusal does not establish a specific cause. Await the exact iOS on-screen result from one owner tap on the QA icon before another build or launch attempt. No callback, account identity, return-to-app, media, live Push or Production PASS is claimed.

2026-11-15 post-verification physical continuation — **LOCAL QA SHELL LAUNCH AND RETURN PASS**: the owner-provided iOS alert identified the prior block as Untrusted Developer. After the owner completed device verification, one CoreDevice launch succeeded and the native app process appeared in read-only process inventory. The owner visually confirmed the local **Digital Observer QA** screen, moved to Home and reopened the app; the same screen returned. This qualifies installation, local shell opening and simple foreground return for this signed offline build. It does **not** qualify account identity, Auth callback, authenticated Product UI, external HTTPS/media or live Push; those remain NOT TESTED.

Date: 2026-10-20
Scope: Development only; no store submission, provider activation or Production use.

2026-10-23 synthetic-only edge continuation — **DETERMINISTIC PASS**, 17 new SQLite/transport/control/session cases and affected existing CH1 23/23 regression. Fixture is generated H264 MPEGTS, 48,316 bytes, 20 distinct synthetic frames, NOT camera footage. Disabled Cloudflare package dry-run compiles; **external DNS/TLS/edge limits and physical iPhone cellular playback BLOCKED / NOT RUN**, pending completed limited OAuth and actual deployment/security/cost qualification. No new native build, installation, real camera access or phone interaction. No prior real-device evidence promoted or replaced. See `DIGITAL_OBSERVER_PUSH_44_SYNTHETIC_EDGE_QUALIFICATION.md`.

2026-10-23 CH1 final pre-activation — **DETERMINISTIC PASS**: composed session/delegation/HttpOnly-cookie/private-TLS/passive-reader/synthetic-MPEGTS contract, 23/23 cases. **Actual read-only source inspection**: one existing CH1 segment H264 High Level3, MPEGTS, 640×480,25fps,yuv420p;25 distinct frames decoded locally, no media retained/transmitted. **REAL DEVICE / CELLULAR VIDEO NOT RUN**. Exact Home QA Site has no owner, zero active memberships, no matching owner QA administrator; candidate media DNS NXDOMAIN. See final follow-up in `DIGITAL_OBSERVER_PUSH_44_CH1_PRIVATE_GATEWAY_QUALIFICATION.md`. Prior phone session proof preserved; no APNs/Android promotion.

2026-10-23 CH1 private-media continuation — **DETERMINISTIC PASS**, 22 isolated security/media/TLS cases; no physical-device media test and no real camera bytes read. Exact CH1/site, lease, 300-second deadline, aggregate 100 MiB payload budget, session/delegation checks, passive generation reader, durable operator journal and pending live-adapter boundaries are recorded in `DIGITAL_OBSERVER_PUSH_44_CH1_PRIVATE_GATEWAY_QUALIFICATION.md`. **REAL DEVICE PASS / REMOTE PLAYBACK PASS: NOT RUN** for this media task. Existing iPhone login/session/network evidence below is preserved; no APNs or Android promotion.

## Evidence classes

- `DETERMINISTIC PASS`: source/contract tests only.
- `NATIVE BUILD PASS`: a native target compiled successfully with the recorded toolchain and SHA.
- `SIMULATOR PASS`: compiled and exercised in an OS simulator.
- `REAL DEVICE PASS`: exercised on the named physical device and network.
- `REMOTE PLAYBACK PASS`: authorized playback was exercised outside the camera LAN through the recorded secure media path.
- `REAL PUSH RECEIPT PASS`: a physical device registered and received the approved Development notification.
- `BLOCKED`: a named prerequisite is absent.
- `NOT RUN`: the test was not executed and no result is inferred.

## Physical-iPhone session security continuation — 2026-10-23

CH1 media follow-up, baseline `2a70695a`: **BLOCKED / NOT RUN**. Current source/relay progression was verified read-only for CH1 `6fddc732-13df-4268-9f32-3357262ea997`, but the existing canonical Development phone viewer is not authorized for its Home QA Site. Current local Home DVR status GET returns 403; no grant was issued. Existing R2 VOD publisher and generic ingress do not enforce the requested CH1-only live stream, one viewer and aggregate 100 MiB/300-second cutoff. No real media or cellular playback initiated; no new physical proof beyond connected device discovery. See `DIGITAL_OBSERVER_PUSH_44_CH1_MEDIA_PREFLIGHT_20261023.json`. Prior phone session, cellular control-plane and restart PASS rows are unchanged.

Final integration receipt: PR #240 head `7998b9bbb251d82bb455294cc40ca70b58c0b302` passed 9/9 exact-head checks and merged as `74e55a8031e782ebff9bfb2ab352df0fb70b70ae`. Canonical Product at that merge passed login-resume 5/5, mobile/deep-link isolation 5/5 and actual migration drift reconciliation 257/257. These post-merge local checks corroborate, but do not substitute for, the owner-confirmed physical rows below.

Device: iPhone 13 Pro / iOS 27.0.1, PersonalTeamQA `com.ganbatuach.app.qa` 1.0 (1), installed and launched through CoreDevice. Signed executable SHA-256 `c6a88bd7b992ab045ef6a042b4a2e9d99db4cfb742db83425cc41dfb38f8a0d7`; strict signature seal PASS, QA APNs entitlement absent. Compiled Observer journey source `ecdd1466d37687b0be4beccaba71d9c7e7b66cc7`, Observer code identical to reviewed PR #238 head `45961d8375d7fbca8ef13483c0272da698b98999` (later Staff-only compatibility change). Integrated as `9e4277bfb63dc641d16879d25359eaa42c2c0d6a`; application receipt integrated as `ced317668294571e2438794f9e4d235ba35b76eb`. Both PRs passed 9/9 exact-head CI. Actual local schema: 257 reconciled migrations (227 baseline-covered + 30 applied post-baseline), no Production access.

| Network | Test | Timestamp (UTC) | Evidence | Result |
|---|---|---|---|---|
| Owner-only HTTPS Development, network type not yet confirmed | Dedicated Development login and actual dashboard | 2026-10-23, session observed 16:50:25 | Owner explicitly confirmed interface after login; exact dedicated fixture session observed only in trusted host memory | REAL DEVICE PASS |
| Same bounded HTTPS path | Strict server-side session expiry, background/resume | Trigger 2026-10-23 16:54:04 | Exact current dedicated QA session `not_after` expired; protected API returned 401 in 170 ms locally; owner explicitly reported login screen after leaving/reopening app | REAL DEVICE PASS for expiry denial and resume; 170 ms is host probe latency, NOT measured phone propagation |
| Same bounded HTTPS path | Reauthentication after expiry | 2026-10-23, new session observed 16:55:21 | Owner confirmed login again; fresh dedicated QA session and runtime 200 observed | REAL DEVICE PASS |
| Same bounded HTTPS path | Canonical server-side revocation, not client logout | Trigger 2026-10-23 16:55:47 | Supabase admin signOut with local-session scope for the exact newly observed QA session; protected API returned 401 in 82 ms locally; owner explicitly reported login screen after leaving/reopening app | REAL DEVICE PASS for revocation denial and resume; exact phone propagation latency not measured |
| Wi-Fi → cellular | Reauthentication after revocation and cellular dashboard | 2026-10-23, fresh session observed 16:57:47 | Owner reported dashboard loads after dedicated Development login and switching off Wi-Fi | REAL DEVICE PASS — control plane only |
| Cellular → Wi-Fi | Session continuity | 2026-10-23 | Owner confirmed dashboard continues without another password | REAL DEVICE PASS |
| Airplane mode, Wi-Fi off | Truthful offline indicator | 2026-10-23 | Owner explicitly reported the no-network message after ten-second instruction | REAL DEVICE PASS for indicator; protected-view shield source/contract tested, not a separate forensic cache test |
| Network restored / full app restart | Session continuity before login-resume correction | 2026-10-23 | Owner reported login screen; QA bootstrap always targets login and that public page did not continue an already valid Observer session | FAIL — identified route behavior, not proof that cookies were lost; minimal server-authorized resume correction under qualification |
| Network restored / full app restart | Continuity retrial after canonical login-resume correction | 2026-10-23, active session observed 17:04:48 | Owner explicitly confirmed dashboard returns without reentering password after full close/reopen; corrected compiled Product code matches commit `403628cd` (build identity stamped its pre-commit base `ced31766`, not misrepresented as an exact-head canonical runtime). Local valid/anonymous/error/expired/revoked resume checks 5/5 PASS | REAL DEVICE PASS; earlier failure preserved above |
| No external path | Cleanup and offline-safe native rollback | 2026-10-23 17:05:52 | Final dedicated QA session revoked; exact temporary tunnel deleted, public HTTP 530, QA proxy closed. Signed offline bundle strict seal PASS, no remote URL/APNs/Push plugin; physical reinstall and CoreDevice launch PASS; ephemeral gate/tunnel files deleted | DETERMINISTIC PASS for operational shutdown; NATIVE BUILD PASS and installation/launch PASS, not another authenticated Product proof |

An earlier expiry attempt at 16:50:51 returned local 401 in 142 ms but the owner interaction was ambiguous; it is not counted separately as device proof. The confirmed outcomes show return to login rather than protected Product access, not forensic proof about OS screenshots or every possible cache. Network transition/offline/restart timings were not instrumented; no latency estimate is presented as measured. No media or Push activated. Historical results below are preserved without status inflation. Sanitized protected session/shutdown receipts remain under ignored `tmp/push44-session-campaign-20261023-*`; no credentials or verifier material in Git. PUSH 44 remains PARTIAL / NOT DONE.

## Earlier physical-iPhone qualification — 2026-10-22

Integration receipt: PR #234 merged as `69eab585c806dfb1342efb56920ddc7809c043d1` from final head `60ad671783a88bd790f7323db2c946134f957f14` after 9/9 exact-head checks. Post-merge LOCAL_SUPABASE Product PUSH 39–45 regression passed 71/71 at the merge SHA; actual schema/history reconciliation passed 256 expected (227 baseline-covered + 29 post-baseline), no drift. These local tests do not upgrade the separate real-device evidence categories below.

This section supersedes only the corresponding earlier failed login observations; all historical evidence below remains preserved. Native Product journey source: `0efb200bf9e934111e0cad485c1a4d0c8fccf08a`, PersonalTeamQA `com.ganbatuach.app.qa` 1.0 (1), iPhone 13 Pro / iOS 27.0.1. Executable SHA-256: `da8e75c5efc3b8ead2e2db98cdd5d12b72da6a85f5fd755ab07ebb72d7497b5d`.

| Network | Test | Timestamp | Evidence | Result |
|---|---|---|---|---|
| Owner-only HTTPS Development | Dedicated Development account authentication and actual dashboard | 2026-10-22; local Auth corroboration 02:56:31 UTC | Explicit owner confirmation of dashboard; synthetic viewer identity, no Production credentials | REAL DEVICE PASS |
| Cellular | Product dashboard and navigation | 2026-10-22 | Owner confirmed working cellular navigation; cameras disconnected in isolated viewing fixture | REAL DEVICE PASS — control plane only |
| Owner-only HTTPS Development | Logout, back/refresh requires login again | 2026-10-22 | Owner explicitly confirmed reauthentication required | REAL DEVICE PASS — not stolen-token revocation proof |
| No external path | Temporary ingress shutdown | 2026-10-22 03:01:03 UTC | Dedicated tunnel deleted; public HTTP 530; ports 31744/3001 closed; existing Home tunnel untouched | DETERMINISTIC PASS — operational shutdown evidence |
| USB / offline-safe bundle | Repeated signed build and offline QA reinstall | 2026-10-22 | Two signed builds; strict seal, QA aps-environment absent; CoreDevice installation succeeded; automatic launch blocked by locked phone | NATIVE BUILD PASS; offline reinstall PASS, post-reinstall launch NOT RUN |

Strict session expiry/revocation on the physical device, separate background/resume, real authorized camera playback on cellular, real APNs receipt, native release/TestFlight/App Store readiness and Android physical-device qualification remain NOT PROVEN / BLOCKED. No sensitive legal gate activated. Sanitized private evidence: `tmp/push44-iphone-session-20261022-evidence.json`; owner replies are primary evidence for phone interaction. PUSH 44 remains PARTIAL / CANONICAL NOT DONE.

## Historical matrix

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
| Android | minSdk 24; target/compile SDK 36 | LOCAL_BUILD_PASS — 2026-11-14 `:app:assembleDebug`, 168 actionable tasks; `app-debug.apk` SHA-256 `6ae6a63c330be3f3497da4f2dbc0013be6160f54cdbdb2af62596aee7eb211d8` | DETERMINISTIC PASS; physical NOT RUN | DETERMINISTIC PASS; physical NOT RUN | DETERMINISTIC PASS; REMOTE PLAYBACK PASS not claimed | DETERMINISTIC PASS; `google-services.json`/FCM device receipt OPEN | DETERMINISTIC PASS; physical NOT RUN | `/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/.dev-cache/tmp/push44-android-sdk/local-build-evidence-20261114.json`; APK hash independently rechecked |

The Android row describes the **existing 2026-11-14 Debug APK only**. Its static inspection (`DIGITAL_OBSERVER_PUSH_44_ANDROID_APK_STATIC_SECURITY_20261115.md`) found the canonical package ID, global cleartext permission and broad FileProvider paths in that compiled artifact. Subsequent source fixes in Development PRs #474 and #478 do not retroactively change it. A replacement QA Debug APK from Development `3b2ad5c5` passed local build and static inspection (`DIGITAL_OBSERVER_PUSH_44_ANDROID_QA_APK_REPLACEMENT_20261115.md`): distinct QA package, loopback-only cleartext and no FileProvider. That is **LOCAL BUILD / STATIC PASS**, not a physical-device, cellular QA or release PASS. PRs #476, #477 and #479 add push-result correlation and logout cleanup at source level; real FCM receipt/revocation remains NOT RUN.

Native compilation now passes, but no SIMULATOR PASS, REAL DEVICE PASS, REMOTE
PLAYBACK PASS or REAL PUSH RECEIPT PASS is claimed. The Android Debug APK is a
local build result only; Android physical-device/OEM, FCM delivery, APNs, DB,
full-stack and broad mobile qualification remain open. The simulator app process
installed and launched, but its WebView remained blank and recorded
`NSURLErrorDomain -1004` because no approved Development endpoint was
available. The earlier failed Android build remains historical evidence: Gradle
reached dependency resolution and stopped because `ANDROID_HOME`/`android/local.properties`
had no SDK location at that time. The 2026-10-20 targeted iOS continuation used Xcode 26.3,
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

2026-10-21 01:20 Asia/Jerusalem, bounded owner-only HTTPS QA: the owner
confirmed that the installed PersonalTeamQA application on Daniel Sun Deri 2
(iPhone 13 Pro, iOS 27.0.1) rendered the actual Digital Observer Product login
screen. The signed native build and installation preceded source fix
`c93c7c51`; the local compiled Product used the login-loop fix, which was
subsequently committed and pushed. This is **REAL DEVICE PASS for Product
login-screen rendering only**, not exact-head native-binary proof or
authenticated Product access. The first ingress attempt had targeted the
separate integration server on port 3000 rather than the isolated QA Product
on port 3001. The route filter now targets port 3001; anonymous external HTTPS
returns 401 with trusted TLS, and media/direct database routes remain denied.
Temporary ingress was stopped and its QA Tunnel deleted before the
2026-10-20 22:29:38 UTC deadline. Product authentication,
cellular session access, remote camera playback and APNs receipt remain **NOT
PROVEN**. The QA build has no APNs entitlement; Production and PUSH 46 are
unchanged.
The owner attempted iPhone Product login and reported "invalid credentials".
Their working computer URL is `gan-batuach.vercel.app`, not the isolated
Development Product. The working Product account's email was observed in the
owner's already-open Vercel settings page; a read-only scan of isolated
Development Auth found no account for that email among 24 local users. The
separate Cloudflare-gate email also was absent, but is not assumed to be the
Product login. This identifies an environment mismatch without assuming a
wrong password. No Production credential was copied and no account was
created or reset.

| Device | OS | Build/source | Network | Test | Timestamp | Evidence | Result / limitation |
|---|---|---|---|---|---|---|---|
| Daniel Sun Deri 2 / iPhone 13 Pro | iOS 27.0.1 | PersonalTeamQA 1.0 (1); source fix `c93c7c51` after build | Temporary owner-only HTTPS; cellular not asserted | Actual Product login screen | 2026-10-21 01:20 Asia/Jerusalem | Owner visual confirmation; QA login/static HTTP 200, anonymous external 401 and trusted TLS | REAL DEVICE PASS — login rendering only; authentication/dashboard/remote playback unproven |
| Daniel Sun Deri 2 / iPhone 13 Pro | iOS 27.0.1 | Same PersonalTeamQA build | Temporary owner-only HTTPS | Product email/password login | 2026-10-21 01:23 Asia/Jerusalem | Owner reports "invalid credentials"; computer URL is Vercel, and isolated Development lacks the working Product account email | BLOCKED — Development identity absent; dashboard not proven |

The owner-approved campaign must record exact app SHA/build, OS version, model, notification permission state and network path for at least:

- one supported current iPhone and one older supported iPhone;
- one current Android reference device and one supported lower/mid-range Android device;
- Wi-Fi → cellular, cellular → Wi-Fi, interruption, background/resume and application restart;
- authorized, revoked, expired and cross-tenant sessions;
- authorized remote live/playback through a configured HTTPS media edge, not LAN-only playback;
- Push registration, token rotation, receipt, tap/deep-link authorization and revocation;
- startup, playback/reconnect latency, bandwidth, memory, battery and crash observations.

Store review, store approval, Production delivery and arbitrary LAN-only camera access remain explicitly outside this matrix.
