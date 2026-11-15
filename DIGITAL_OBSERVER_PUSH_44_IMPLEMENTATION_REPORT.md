# DIGITAL OBSERVER — PUSH 44 IMPLEMENTATION REPORT

## iPhone QA one-use handoff development — 2026-11-15

After the owner completed iOS developer verification, one CoreDevice launch of the installed signed PersonalTeamQA build succeeded and read-only process inventory showed its native app process running. The owner visually confirmed the local **Digital Observer QA** screen, then returned to the Home screen and reopened the app; the same QA screen returned. This is **physical install, local shell launch and simple return-to-app PASS** for this offline build only. The bundled QA configuration has no remote server URL, the handoff callback remains disabled, and no account identity, authenticated Product session, live media or Push receipt was tested.

The owner-authorized signed QA app was installed on the paired iPhone 13 Pro; CoreDevice confirmed `com.ganbatuach.app.qa` 1.0. A single launch before and a single launch after the owner approved developer trust in iOS Settings both failed with CoreDeviceError 10002 / FBS security refusal. Developer Mode is enabled. Read-only checks found the signed certificate, team, application identifier, entitlement values and embedded profile consistent, so the generic iOS error does not establish a specific signing defect. **Install PASS; launch FAIL; account identity and return-to-app NOT TESTED.** The next device diagnostic is the exact on-screen result of tapping the QA icon once. No Auth, camera, media, live Push, Production or paid service was exercised in this continuation.

A device-targeted **signed PersonalTeamQA native build** succeeded after Xcode provisioned the paired iPhone 13 Pro for the existing QA bundle and Apple team. The build result reports zero errors and `codesign --verify --deep --strict` passed; executable SHA-256 `d8b38b0ac1abd66e8df7ce8fb7cd8d925ae528b8bc36a26561e623c4c8c52f97`. The sanitized Development profile binds team `27G7ZP4U3Q`, bundle `com.ganbatuach.app.qa` and one matching provisioned device; it expires 2026-11-22T21:21:11Z. Result bundle: `.dev-cache/tmp/push44-ios-signing-gap-20261115/ResultBundles/PersonalTeamQA-signed-connected-device.xcresult`. At build time the app had **not yet been installed or launched**; the later installation and failed launch are recorded above. No callback, enrollment, physical Secure Enclave, Auth, APNs or media behavior was proven.

PR #526 added mandatory trusted server-side attempt accounting to the still-disabled QA handoff HTTP gate. It calls the existing atomic service-only limiter before URL/body/Auth work; missing, exhausted or unavailable accounting fails closed. The server composition uses one global key at 30 attempts per fixed minute, which caps any 30-minute interval at 930 application attempts. Focused checks passed 27/27, TypeScript and focused lint passed, and all exact-head CI checks passed before merge to Development `e54981bddd4f6580124bc97d49c26f68f5efd40d`. No active route imports the gate. Live limiter/edge enforcement and provider cost ceilings remain unqualified.

Follow-up PR #519 fixed a verified Development Auth ACL mismatch: `service_role` cannot read `auth.sessions`, so the earlier direct consume query could not work. A private, `service_role`-only executable function now owns the Auth row lock and one-use update. In a disconnected PostgreSQL 17.6 container with synthetic identities, the proposed schema applied, direct Auth read failed as expected, one consume succeeded and replay failed, two concurrent consumes yielded one winner, and consumption after session deletion failed without marking the challenge consumed. `anon`/`authenticated` could not use the private schema or function. The container and its data were removed; canonical Development remained at 129 MB without `observer_qa_private`. This is **ISOLATED POSTGRESQL PASS**, not canonical migration application or full Supabase Auth lifecycle proof. Protected evidence: `exports/restricted/push44-private-consume-qa-20261115/REPORT.md`.

PR #521 fixed an actual Secure Enclave `CFTypeRef`/`SecKey` compiler error. The unsigned PersonalTeamQA generic-iOS target then built successfully for Any iOS Device with zero errors in an isolated external-drive Xcode environment; four focused QA scripts passed 9 tests. The app was unsigned and not installed. Result bundle: `.dev-cache/tmp/push44-ios-build-20261115/ResultBundles/PersonalTeamQA-generic-ios-after-seckey-fix.xcresult`; executable SHA-256 `f23dd1a177ecbd010d650ea38d753ef9c0b48edea2cd1552381f09ae65966b7e`. This is **NATIVE BUILD PASS only**, not a signed build, callback, Secure Enclave device proof or authenticated remote QA.

Development PRs #496, #497, #499, #500, #501, #503, #504, #505, #507, #509, #510 and #512 each passed eight exact-head CI checks and merged. They add a dormant P-256 server verifier, a review-only private receipt schema and conditional one-use adapter, QA-only Secure Enclave signing code, a Swift/server byte-format fixture, a default-off return-state validator and native entrypoint, an iOS-15-compatible ASWebAuthenticationSession probe and adapter, a default-off HTTP boundary, a server-only helper that derives session ID after canonical Auth verification, and a hard-off composition of the server parts. The schema was **not applied to canonical Development** or promoted to a migration; no active route imports the handoff, and the iOS code does not enroll a key or exchange a session. The bounded isolated PostgreSQL result above does not prove a physical Secure Enclave key.

The native QA return entrypoint is default-off and intentionally lacks a trusted account/installation source; the current PersonalTeamQA signing configuration has no Associated Domains entitlement and strips URL schemes. A read-only Apple contract review therefore does not qualify a Universal Link callback. PRs #505 and #507 prepare an iOS-15-compatible, default-off ASWebAuthenticationSession custom-scheme option, still with a nil identity provider and no `start()` invocation; the newer HTTPS callback API requires iOS 17.4 and associated web credentials. PR #512 tests the hard-off server composition against a fake DB; PR #519 adds the bounded PostgreSQL consume proof above. Neither callback option has been delivered on a device. An earlier unsigned QA Xcode build stopped before compilation because the configured shared SwiftPM cache was not writable; PR #521 passed an actual unsigned generic-iOS build with dedicated external-drive paths. The remote iPhone build block stays in place pending signing and device qualification.

To complete this handoff, review and migrate the private schema in the canonical Development sequence, prove the full Supabase Auth lifecycle, wire a trusted authenticated server route and approved installation enrollment, qualify a supported callback and signed build on the physical iPhone, then test expiry, replay, account switching and revocation end to end. The bounded local PostgreSQL and unsigned-build gates above are complete; the remaining activation and real-device gates are not. PUSH 44 remains **PARTIAL / NOT DONE**; PUSH 46 does not start on this evidence.

## Account isolation and remote iPhone QA gate — 2026-11-15

Development PRs #480, #481 and #484 passed all eight exact-head CI checks and merged as `9b2dd820`, `456d9e35` and `c8a74b4b`. They respectively prevent an owner QA bearer token from being embedded in a signed iPhone app, preserve a sanitized cold-start deep link across login for server-side authorization, and discard saved native Push Site/registration intent when the authenticated account changes. The account-state fix also passed 28 focused local tests. These are source and deterministic-check results, not physical-device qualification.

The remote iPhone QA build remains deliberately blocked by `PUSH44_QA_REMOTE_BUILD_BLOCKED` in `scripts/qa/prepare-push44-iphone-qa-config.mjs`. Read-only flow inspection found that the existing QA proxy exchanges a bearer token from `GET /__push44/bootstrap?t=...` for a cookie in the requesting browser; the offline iOS shell has no verified Safari-to-WKWebView cookie handoff or one-time server-side exchange. Removing the build block alone would produce an unauthenticated or unsafe remote IPA. The synthetic `check-push44-owner-qa-ingress.mjs` check passed without real secrets. A bounded, secret-free authenticated handoff and physical-device proof remain open; no remote QA, provider, live media or Production activation is claimed.

## Development continuation — 2026-11-15

The 2026-11-14 Android Debug APK passed local compilation and static signature/manifest inspection, recorded in `DIGITAL_OBSERVER_PUSH_44_ANDROID_APK_STATIC_SECURITY_20261115.md`. That APK predates the later Android QA application-ID, network-policy and FileProvider source fixes. A replacement QA Debug APK was built from Development `3b2ad5c5` and statically inspected in `DIGITAL_OBSERVER_PUSH_44_ANDROID_QA_APK_REPLACEMENT_20261115.md`: distinct `com.ganbatuach.app.qa` package, loopback-only cleartext exception and no FileProvider in the compiled manifest. Neither APK was installed on a physical Android device or qualified for release.

Development PRs #474, #477, #478, #476 and #479 merged Android QA transport/identity safeguards, current-device push-token cleanup on logout, removal of an unused broad FileProvider, correlation of native push registration results, and closure of the GET logout bypass respectively. All passed their CI gates. This establishes repository checks only; it does not prove APNs/FCM delivery, real-device background/resume and deep-link handling, authorized live playback, database/full-stack behavior or store review. PUSH 44 remains PARTIAL / NOT DONE; PUSH 46 remains NOT STARTED.

## CH1 media activation preflight — 2026-10-23, BLOCKED

Preflight started from remote integration baseline `2a70695aefd9a8ac03647125eeb237483a0580a6`; this continuation changes only documentation/evidence, not Product code or schema. No live media activation is authorized or performed. Exact read-only findings and gate ownership are in `DIGITAL_OBSERVER_PUSH_44_CH1_MEDIA_PREFLIGHT_20261023.json`; prior real-iPhone session-security and backup proof remain intact.

CH1 source `6fddc732-13df-4268-9f32-3357262ea997`, Site/QA-enrollment tenant `cc1673b8-3eb0-4785-a12c-1fb88f425a41`, Gateway `62df97e2-3c0b-427f-9108-bde029bc10e7`, enrollment `1c450dca-38a8-4e49-853f-c613ca498c27`, stream `dvr_3a2d4e23f178cefa8f_1` were read from the verified isolated Home PUSH38T database, not Production or canonical Development. The current delivered enrollment was not revoked. Read-only Gateway health at 17:30:45/48 UTC showed CH1 input bytes advancing 75,513,472→75,715,696, chunks 39,572→39,700, current owner, output idle 211 ms, ten canonical/live relays and no candidate handoff. This establishes source/relay progression, NOT independently decoded moving video or cellular playback. Source input is HEVC/ISOBMFF with VideoToolbox reported; actual iPhone media decoding remains untested. No media bytes were requested by this preflight.

The connected physical device is iPhone 13 Pro. Existing dedicated canonical Development viewer remains active and scoped only to synthetic Site A. Home Site and CH1 do not exist in canonical Development. Actual host-side probes: authenticated runtime 200, Home DVR GET 403, anonymous 401, revoked session 401 (4/4); only the new dedicated probe session was created/revoked. No playback/grant POST, Legacy refresh, Home credential, verifier, Keychain export, enrollment change or live reporter operation occurred. NULL Home Site owner/organization fields were not confused with its separate enrollment tenant binding. Supabase least-privilege guidance requires preserving the observed denial, not granting a blanket cross-environment bypass.

The existing R2 helper publishes four visual sources from eleven configured sources, generates VOD ENDLIST snapshots, and may update release-bucket-wide CORS. Its 25 MiB upload cap does NOT bound repeated client transfer; presigned links can be reused by their holders and do not enforce one viewer or current-session revocation. The existing generic HTTPS ingress has request limits but not the required atomic 100 MiB/one-viewer/non-resettable 300-second total budget. No existing public TLS media listener was present on 18443; a global IPv6 address is not external reachability/TLS proof. No listener, tunnel, Worker, DNS, bucket policy or CORS configuration was created/changed.

Candidate architecture reuses existing Gateway HLS/grants and private R2 Standard objects only behind a separately qualified authenticated metered media gate. It is NOT selected for activation. Missing gates are (1) explicitly reviewed Home-to-Development viewing delegation for the pinned tuple, (2) a CH1-only live—not VOD—adapter with one owner-session/device lease and atomic accounting for retries/Range/concurrent requests plus in-flight deadline/revocation cutoff, and (3) exact-prefix/IAM/CORS/trusted-HTTPS qualification without repurposing release access. Hard requested bounds remain 300 seconds, 104,857,600 media-payload bytes, one source/viewer/stream; they are NOT represented as enforced in the existing path.

Provider read-only preflight confirmed existing R2 Paid / Workers Free, observed/projected cycle usage $0.00, 5.29 GB-month, 115 Class A and 17 Class B requests; these are dashboard estimates, not invoices or hard caps. R2 Standard explicitly supports video objects ([storage classes](https://developers.cloudflare.com/r2/buckets/storage-classes/)); [pricing](https://developers.cloudflare.com/r2/pricing/) includes free quotas and no R2 egress fee. Expected incremental R2 usage is $0 only within verified quotas and a genuinely bounded path. If other activity exhausts quotas, one extra rounded storage/A/B billing unit could total $4.875 before applicable tax; hosting and tax remain unverified. No all-in ₪15/user compliance claim or actual media charge is invented. [Presigned URL documentation](https://developers.cloudflare.com/r2/api/s3/presigned-urls/) confirms bearer access until expiry. [CDN terms](https://www.cloudflare.com/service-specific-terms-application-services/) are NOT blanket permission to send continuous video through the application Tunnel. Existing bucket public-access/IAM/CORS state is not qualified for this new scope.

Relevant PUSH39–45, private-R2 capability and isolated loopback TLS ingress contracts passed. Synthetic TLS fixtures do not establish public trusted TLS or real media proof. No migration was added; actual local history/schema reconciliation is required and recorded separately. **Activation request: NOT READY / not submitted.** Complete the missing isolated authorization/metered-adapter qualification before requesting one bounded live approval. PR235 stays Draft; main, Production, Home services and all 17 source identities remain unchanged. PUSH44 PARTIAL; PUSH46 NOT STARTED.

## Latest continuation receipt — 2026-10-23

Final behavioral PR #240 merged as `74e55a8031e782ebff9bfb2ab352df0fb70b70ae` after exact head `7998b9bbb251d82bb455294cc40ca70b58c0b302` passed all nine checks. Post-merge canonical Product at that exact SHA passed the five-case login-resume verifier and five mobile/deep-link isolation cases; actual schema/history reconciliation again passed 257 with no missing migrations or schema drift. Source-level, actual local full-stack and owner-confirmed physical observations remain distinct. The final follow-up changes only documentation/receipts; no new migration or live action.

PUSH 44 remains PARTIAL / CANONICAL NOT DONE. PR #238 integrated session authorization and patched newly disclosed Critical/High dependencies as `9e4277bfb63dc641d16879d25359eaa42c2c0d6a` after 9/9 exact-head checks. PR #239 integrated actual Development application receipts as `ced317668294571e2438794f9e4d235ba35b76eb` after 9/9. Actual isolated schema/history reconciles 257 migrations (227 baseline-covered + 30 post-baseline); session function/ACL rollback checks passed 8/8. Canonical Product PUSH39–45 regressions passed 71/71 at `ced317668294571e2438794f9e4d235ba35b76eb`, without rewriting historical test receipts. No Production database/code deployment occurred.

Owner-confirmed physical iPhone 13 Pro / iOS 27.0.1 proof: dedicated Development login/dashboard, strict current-session expiry returning to login after resume, successful reauthentication, and independent canonical server-side revocation returning to login (not client logout). Local protected API denial latency was 170 ms for the confirmed expiry attempt and 82 ms for revocation; these are NOT phone propagation measurements. The exact build/source and remaining network observations are in the existing device matrix. No synthetic result is promoted to real-device proof.

The reused HTTPS design is the previously owner-approved private 256-bit ingress gate plus Product authentication, not a newly activated Cloudflare Zero Trust subscription or email policy. Anonymous login was 401, gated login 200, unauthenticated Product API 401, and direct Supabase/internal/media paths 404. TLS validation remained enabled. Duration 30 minutes, 1,200 requests, 120/minute, 80 MiB responses, 64 KiB requests, no media. Cloudflare existing-account preflight showed $0.00 observed/projected cycle usage and no new fixed fee; invoice-level incremental cost remains unverified, not a claimed final charge. No claim of all-in per-paying-user cost compliance is made without the paying-user denominator and restricted supplier reconciliation.

### Separate media gate — NOT ACTIVATED

The physical restart probe found a distinct gap: the QA bootstrap always lands at login and that page rendered the form even with a valid session. The minimal correction reuses `getDigitalObserverApiUser` (JWT, current Auth session, active profile and Observer scope) to continue to the fixed same-origin dashboard. Explicit error requests remain on login. No new identity storage or bypass is introduced. The dedicated local-only five-case test passed anonymous, valid, explicit-error, expired and revoked sessions against the compiled Product. The owner then explicitly confirmed full close/reopen returns to dashboard without a password. Wi-Fi→cellular→Wi-Fi continuity and truthful offline indicator were also owner-confirmed. Build, post-build TypeScript and canonical lint passed; the first parallel TypeScript attempt raced generated build types and was rerun after build completion, not waived. Strict cache/screenshot forensics and instrumented phone timings are not claimed.

The campaign ended at 2026-10-23T17:05:52.750Z, before its original 17:17:28 deadline: final dedicated QA session revoked, exact temporary tunnel deleted, public HTTP 530, loopback QA proxy and scoped Product server closed. The unrelated Home tunnel was untouched. The signed offline-safe QA bundle was verified (no remote URL, APNs or Push plugin), reinstalled and launched on the physical iPhone. Only revoked ephemeral gate/tunnel files were removed; private Development fixture credentials and all unique work remain protected. No file-URL extension permission was enabled during this campaign. Actual physical proof, build-source equivalence limits and historical failed attempts are preserved in the existing matrix.

Canonical Development is not the existing Home PUSH38T camera-control plane. The dedicated Development viewer is authorized only for its synthetic Site, not the Home Site. Existing `prepare-push38-r2-phone-media.mjs` requires eleven configured sources and four visual sources, manages bucket-wide CORS and publishes bounded HLS snapshots to the existing release bucket. It is not a safe one-camera live-Development adapter and was NOT executed. Application Tunnel routes explicitly deny media and no DVR/RTSP endpoint was exposed. A VOD snapshot would not prove live stream progression.

The minimum next media approval must authorize one specifically identified Home DVR channel (CH1 only after current source/enrollment binding is read-only verified), an isolated time-limited Development viewing delegation without copying Production credentials or changing Home services, and a private media-only R2 prefix with reviewed IAM/CORS separation from releases. Proposed hard bounds: one owner, five minutes, 100 MiB total, fewer than 100 writes and 1,000 reads, short-lived canonical media grants, expiry/revocation and cross-Site negatives, exact-object deletion and CORS restoration. No new subscription; expected incremental cost $0 only if current free quota and applicable provider terms remain verified at activation. If those conditions cannot be enforced, stop rather than activate. This is a review/authorization request, not an assertion that the current helper provides live authorized playback. Real cellular video remains BLOCKED; no Home restart, telemetry change, grant creation or media upload occurred.

APNs remains NOT PROVEN: PersonalTeamQA has no native Push plugin/entitlement. Canonical Debug/Release remain APNs-capable. Eligible Apple Developer signing/provisioning, approved APNs/FCM credentials, device-token registration, an explicitly approved bounded Development send and actual receipt/revocation proof remain required. Android physical-device and native release/TestFlight/App Store qualification remain separate obligations. PR #235 remains Draft, main and Production unchanged, PUSH 46 not started.

Date: 2026-10-19
Base: `origin/integration/development@5d7d2215f3a216bedf0e5ea9aa3e3bdadcf6d477`
Branch: `codex/push-44-mobile-readiness`

## Result

PUSH 44 is **PARTIAL / CANONICAL NOT DONE**. The provider-neutral native runtime and deterministic security contracts are implemented, while mandatory native compilation, signed real-device qualification, external Push receipt, real remote-media playback and store-policy review remain unproved. It is not truthful to mark Development complete until those gates pass or the owner records an explicit exception.

## Implemented

- Official Capacitor App, Device, Network, Preferences and Push Notifications plugins wired into existing iOS/Android projects.
- Native app lifecycle and network transition handling with foreground session revalidation.
- Server-authorized custom deep links for Camera, Event, Incident, Evidence, Investigation and Notification resources. Possession of a link never grants access.
- Native Push permission handling initiated only by an explicit user action, token rotation/idempotent registration through the existing PUSH 39 device contracts, minimized foreground previews and authorized notification-tap routing.
- Native login uses the existing server form and HttpOnly Supabase cookies instead of copying bearer tokens into JavaScript storage.
- Bounded local queue contains only non-sensitive revalidation/registration operation identifiers. Video, Evidence, credentials and unrestricted URLs are not cached.
- Playback sessions are invalidated and media is paused on background/offline transitions, then reacquired after resume/network recovery.
- Android notification permission, custom scheme and backup denial; iOS custom scheme and Capacitor APNs callback forwarding.
- SMS authentication remains disabled. Generic PUSH 39 SMS delivery history/adapters are unchanged.
- No location, camera, photo/file or background permission was added because the implemented runtime does not legitimately require it.

## Truthful limits

- Real remote playback requires the existing authorized HTTPS playback edge. Local-only DVR/Gateway playback is not remote mobile proof.
- APNs/FCM credentials and a registered physical device were not activated; no receipt is claimed.
- At this report's original qualification, Android SDK and full Xcode were absent on that host. A later isolated Android Debug build passed locally on 2026-11-14; this does not prove Android device, OEM, FCM delivery, DB, full-stack or broad mobile readiness. The original iOS simulator conclusion is unchanged.
- No real device, App Store, Google Play, paid provider, customer, main or Production system was used.
- Personal-safety capabilities (Guardian, Safe Journey, SOS/Silent SOS, Safety Circle and location/sensor fusion) remain unimplemented or foundation-only. PUSH 45 legal/privacy and later pilot gates remain mandatory.

## Database and cost

No schema change is required. Existing `digital_observer_device_slots`, `push_device_tokens`, notification delivery and Enterprise session contracts are reused. Expected new migrations: 0. Development application: not applicable. Production application: not applicable. Incremental fixed supplier cost: ₪0. Real mobile egress, support, store and provider costs remain unmeasured.

## Validation status

- PUSH 44 deterministic mobile/security QA: PASS.
- TypeScript: PASS.
- Canonical lint baseline: PASS with zero canonical regressions.
- Production build without deployment: PASS on Next.js 16.3.8.
- Canonical domain regression: PASS 45/45, including the PUSH 44 runtime contract.
- Security/isolation regression: PASS 46/46, including PUSH 44 mobile authorization; dependency audit has no high/critical findings and retains three moderate transitive `uuid` findings under Capacitor CLI's `xcode` dependency.
- Migration health: PASS 255 files; no PUSH 44 migration. Release contract: PASS with Production mutation false.
- PUSH 39, 40, 41, 42 and 43 focused regressions: PASS.
- Capacitor iOS/Android sync: PASS with five official plugins.
- Android debug build: LOCAL_BUILD_PASS in the later 2026-11-14 isolated qualification — `:app:assembleDebug` completed 168 actionable tasks and produced `app-debug.apk` with independently rechecked SHA-256 `6ae6a63c330be3f3497da4f2dbc0013be6160f54cdbdb2af62596aee7eb211d8`; receipt: `/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/.dev-cache/tmp/push44-android-sdk/local-build-evidence-20261114.json`. The earlier SDK-path failure is historical, not current build status.
- iOS build/simulator: BLOCKED — full Xcode/simulator unavailable.
- Real-device/remote-playback/Push receipt/store-policy proof: OPEN.
- PR #220 exact head `c3ff106c517fa85f59a4686eac84fb00098e7a8b` passed all 9 required checks and merged with preserved ancestry as `8a75613bea5018dcecd323a959d0cd2aa6ec4ac5`.
- The first merged local startup exposed stale worktree dependencies from before the five plugin additions; a locked `npm ci` synchronized that local environment, after which the unchanged merged Product passed. No runtime fallback or Product-code exception was used.
- Exact merged local Product `8a75613bea5018dcecd323a959d0cd2aa6ec4ac5`, labeled `DEVELOPMENT / INTEGRATION` with `LOCAL_SUPABASE`, passed 255/255 migration drift, cumulative Product 18/18, PUSH 39 24/24, PUSH 40 6/6, PUSH 41 7/7, PUSH 42 10/10, PUSH 43 15/15 and PUSH 44 mobile runtime 5/5.

## Preserved obligations

PUSH 38 reliability exceptions and all PUSH 39–43 external proof obligations remain unchanged. PUSH 46 still owns real zero-install proof; managed Gateway/mobile-assisted onboarding does not satisfy it. PUSH 45 remains the next canonical implementation owner and has not started.

## Post-PUSH-45 iOS continuation

The 2026-10-20 targeted physical-iPhone continuation is recorded in
`DIGITAL_OBSERVER_PUSH_44_IOS_REAL_DEVICE_CONTINUATION_REPORT.md`. It adds the
missing environment-specific APNs signing entitlement and deterministic guard.
Full Xcode 26.3 is now selected; Capacitor sync, simulator compilation and an
unsigned generic iOS arm64 build pass at exact portable-helper commit `9c886315`, with
reproducible build artifacts kept on the Kingston volume. The iOS 26.3
simulator installs and launches the app process, but the Product WebView fails
with connection-refused error `-1004` because no approved Development endpoint
is configured. An iPhone 13 Pro / iOS 18.7.8 is paired, but Developer Mode/DDI,
Apple Development signing, secure HTTPS Development/media access, installation,
real-device login, cellular remote playback, real Push receipt, network
transitions, physical performance and TestFlight remain blocked or not run.
PUSH 44 remains PARTIAL / CANONICAL NOT DONE. PUSH 45 legal gates remain closed
and PUSH 46 has not started.

## Owner iPhone qualification — 2026-10-22

### 2026-10-23 session-security continuation (not yet physical-device proof)

Security-triggered dependency correction: initial exact-head CI at b14b856b
failed its unchanged audit gate on newly indexed Critical advisories, not the
session tests. Pin Next.js and matching lint config to 16.4.1 and Sentry Next.js
to 10.75.2 (same Sentry major; no broad audit-fix/force). Vendor patch references:
[Next image optimization](https://github.com/advisories/GHSA-2464-fhr4-w9xw),
[Next cache](https://github.com/advisories/GHSA-673q-mjm6-r5xr),
[Next Server Actions](https://github.com/advisories/GHSA-p3m5-59mp-jv5r),
[Sentry middleware tunnel](https://github.com/advisories/GHSA-mchm-gjx6-7h55).
Locked local install and unchanged high-severity audit pass with zero
High/Critical. UUID via xcode/Capacitor CLI remains Moderate, owner mobile
dependency maintainer, review due 2026-10-29; it is not marked fixed.
No external QA ingress was opened while Critical findings were unresolved.
The matched Next lint package adds an internal-navigation rule. Its sole
remaining finding was the pre-existing staff activation full-page handoff.
That destination now uses an explicit same-origin absolute URL while retaining
the full reload; its contract test pins both the destination and origin rather
than the old relative literal. Full canonical lint returns to 4,711 errors /
159 warnings, zero regressions and zero canonical errors; staff contract 8/8.
No baseline allowance or rule was disabled. Observer code is unchanged by
this one-line Management compatibility correction.
Full exact-head CI and installed-version compatibility remain required before
integration; no Production remediation/deployment is implied.

The existing Local Supabase Auth admin signOut rejected both the access token
and refresh attempt in a bounded dedicated-QA-session probe (about 100 ms;
host measurement, not iPhone propagation). A separate exact session not_after
expiry rejected refresh but left its existing JWT accepted by getUser. The
minimal correction checks the existing Auth session through a zero-argument,
authenticated caller-only boolean function before Observer page/API access.
No tokens, Auth rows or other users' sessions can be selected through it.
Explicit anon/PUBLIC EXECUTE revocation, fixed empty search_path, stable SQL,
indexed session ID plus auth.uid binding and not_after check pass eight
rollback-only database cases. No permanent schema mutation in those tests.
Native lifecycle revalidation gains a 10-second timeout, concurrent-check
deduplication, stale protected-view cover and history-replacing login redirect.
Production code/schema/provider activation remain unauthorized. Real-device
expiry/revocation/network observations must be recorded separately after the
Development migration and bounded HTTPS campaign. Earlier phone proof below
is preserved and is not promoted by these local tests.

On iPhone 13 Pro / iOS 27.0.1, PersonalTeamQA `com.ganbatuach.app.qa` 1.0 (1), source `0efb200bf9e934111e0cad485c1a4d0c8fccf08a`, owner confirmed Development-only authenticated dashboard, cellular Product navigation, and logout requiring login again. Cameras were disconnected in the isolated viewing fixture; no moving-video, APNs, strict revoked-token, Android or store proof is claimed.

The bounded owner-only HTTPS gate passed seven security probes and was shut down at 2026-10-22T03:01:03Z; its dedicated tunnel was deleted. Offline-safe QA was reinstalled without a remote server URL or native Push registration. Automatic post-rollback launch was blocked by the locked iPhone, not an observed crash. Canonical APNs-capable builds and Production remained unchanged.

Repeat signed builds exposed an optional Info.plist key deletion that failed on the second build. The QA-only script now checks key existence first; its deterministic regression, two consecutive signed native builds, TypeScript and canonical lint pass. Exact-head CI must pass on the pushed revision; PR #234 remains Draft and PUSH 44 PARTIAL.
