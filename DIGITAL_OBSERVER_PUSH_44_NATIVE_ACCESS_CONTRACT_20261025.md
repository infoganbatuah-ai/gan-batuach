# PUSH 44 — native Access contract qualification (local-only)

Status: **PARTIAL CONTRACT / NO NATIVE ADAPTER YET**. This is a bounded
handoff for PR #248, not permission to enable Access, create a route, issue an
enrollment approval, install an app or run media. Source branch
`codex/push44-synthetic-external-preparation`; starting local commit
`6be3de309440dedb0f7cab6db4cbd10eb1d84851` preserves the earlier
callback-boundary decision. Remote PR #248 remained Draft at
`2cac671b9c2385ccd136d414f3742c7b666636e2`; integration at
`f3401b181954b800e8e0f26702642ea18dba7e2a` when read. No other task
edited this worktree in this pass.

## Provider contract: documented, observed, and missing

| Point | Evidence | Qualification |
| --- | --- | --- |
| Opt-in topology | [Cloudflare Managed OAuth](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/managed-oauth/) says self-hosted Access apps (also MCP apps/portals), with an RFC 8707 resource-aware OAuth client. | Documented generally; compatibility with this *private-hostname* app on a cellular phone without VPN is **not proven**. |
| Account setting | Read-only One dashboard showed team `spring-feather-ce4e`, Zero Trust Free, control app `4382f628-c338-4a23-9da0-1490056b83e4`, exact QA hostname as **private** destination, zero associated policies, and Managed OAuth Beta **Off**. | Observed; visible switch is not activation, entitlement, cost or connectivity proof. |
| Initiation/discovery | With Managed OAuth on, non-browser requests receive `401`/`WWW-Authenticate`; metadata is at `https://<app>/.well-known/oauth-authorization-server`, conforming to RFC 8414/9728, and supplies authorization and token endpoints. | Documented. The actual QA `WWW-Authenticate`, issuer, endpoint URLs and metadata were **not** fetched; no route or feature is active. Never hard-code invented endpoint URLs. |
| Redirect | Dynamic registration's allowed redirect URIs must use HTTPS. [Apple's HTTPS callback](https://developer.apple.com/documentation/authenticationservices/aswebauthenticationsession/callback/https%28host%3Apath%3A%29) requires an Associated Domain; [Apple's association guide](https://developer.apple.com/documentation/xcode/supporting-associated-domains) requires AASA and matching entitlement. | Cloudflare's exact iOS callback registration and Apple profile support are **unproven**. Existing `PersonalTeamQA` has `CODE_SIGN_ENTITLEMENTS=""`, no Associated Domains and no AASA proof. No custom scheme fallback is assumed. |
| Authorization code / PKCE | Cloudflare documents an authorization-code browser flow, but its Managed OAuth page does **not** explicitly promise S256 PKCE, publish this app's `code_challenge_methods_supported`, or specify a native iOS registration response. [RFC 8252](https://www.rfc-editor.org/info/rfc8252/) and [RFC 7636](https://www.rfc-editor.org/info/rfc7636/) require a secure external-browser native design. | Require discovery/registration evidence for S256 before a public native client can exchange a code. If absent, **stop**, not downgrade to an unbound code. State, verifier and authorization code stay native; callback code is one-use and never logged. |
| Subsequent requests | Cloudflare says the client receives an **opaque** access token for subsequent protected requests; Cloudflare resolves it and sends `Cf-Access-Jwt-Assertion` to origin. Refresh re-evaluates Access policies. | Documented concept. Exact bearer presentation and whether the edge strips client `Authorization` before this ingress are **not live-proven**. The current Unix-socket ingress explicitly rejects an `Authorization` header at origin and requires the signed assertion. Verify this at the real edge before use. |
| Lifetimes/revocation | Docs show configurable access-token lifetime (default 15m) and grant duration; refresh re-evaluates policy. | No QA setting has been saved. For the future 30m control window require access lifetime <=5m, no retained long-lived refresh grant, explicit stop/revocation and server-side Development-session validation on each control operation. Access-token revocation latency remains a live test item. |
| Cost | Free plan is displayed; [Cloudflare Tunnel](https://developers.cloudflare.com/tunnel/) is available on all plans. | $0 incremental **fixed** charge is plausible, not a provider-level financial cap. Managed OAuth Beta metering, edge-denied requests, Tunnel/Access usage, origin compute/egress, logs, cellular usage and tax remain **UNKNOWN** until account-specific terms/usage evidence. |

Do not confuse this with [Cloudflare's browser cookie contract](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/): every protected browser request needs `CF_Authorization`. A system-browser callback alone does not authorize the present WKWebView's HTML/assets/API requests. Copying that cookie or an Access JWT into WKWebView/JavaScript is rejected.

## One transport decision, three independent gates

**Select a bundled, QA-only local control view + a native URLSession client as
the design candidate, not remote Next-in-WKWebView.** Only this candidate can
hold an opaque Access credential in native Keychain custody and present it on
every protected HTTP request without copying it into JavaScript. The bundled
view may display status and call a narrow native bridge with non-secret inputs
(`request`, `status`, `challenge`, `enroll`); the native layer sends the existing
API payloads and returns only bounded public-key/request/status results. The
Secure Enclave bridge keeps private signing in native code. It must be scoped
to the signed QA bundle/local view; the current bridge instead requires the
exact *remote* QA enrollment URL, so it cannot be silently reused unchanged.
No general browser, commercial Product UI, camera route or second identity
system is part of this adapter.

The existing real Next.js `POST /api/digital-observer/auth/login` creates the
Development Supabase session and HttpOnly `sb-*` cookies;
`POST /api/digital-observer/qa-device` independently revalidates that active session,
the pinned QA viewer, tenant/Site and the device proof before calling the
loopback transport. A native client would need an isolated native cookie jar
for that **same** Development login, not a copied cookie from Safari or a
new token in JS. Any Access bearer is a distinct native Keychain item, never
a Supabase credential. Confirm native cookie retention and revocation in an
actual Next + original LOCAL_SUPABASE test before claiming this path works.

The three gates stay independent on **every** control operation:

1. **Cloudflare edge:** valid native Access credential -> edge policy -> signed
   assertion with exact issuer, AUD, owner, expiry; trusted proxy/origin key.
2. **Development app:** live original LOCAL_SUPABASE session -> exact QA user,
   tenant and Site; denied after session revocation. Access identity alone is
   insufficient and parent cannot approve itself.
3. **Device:** pinned one-use request and public key -> fresh challenge ->
   Secure Enclave signature -> one separate owner action with fresh Mac
   presence -> revocable enrollment. A copied Access credential plus app
   cookie must still fail without this proof.

## Fail-closed native state machine (design contract, not implemented)

Every transition is audited with a request ID, previous/new state, decision
and timestamp, **never** URLs containing codes, cookies, bearer tokens,
passwords or private keys. Clock skew allowance, if any, must be explicit and
bounded; a local clock outside it blocks. Reopening the app cannot restore
`authorized` from UI state alone.

| From -> to | Trusted input and validation | Expiry/replay/failure |
| --- | --- | --- |
| unauthenticated -> pending | User starts one QA attempt; native CSPRNG creates state and PKCE verifier; exact issuer/resource/redirect are pinned. | One pending attempt only; second start cancels prior; no network on invalid configuration. |
| pending -> system browser | Provider metadata and registration must prove exact HTTPS redirect and S256; ASWebAuthenticationSession opens exact authorization endpoint. | Missing metadata/S256/Associated Domain -> blocked; record no token. |
| system browser -> callback received | Apple returns a URL for the exact associated host/path. | Cancellation -> cancelled; any other host/path/scheme, extra callback or query-carried token -> denied. Callback is **not** authentication. |
| callback received -> state validated | Native constant-time state match to the one pending attempt, exact client/resource/redirect binding. | Expired, missing, mismatched, replayed or cross-installation state -> revoke attempt and deny. |
| state validated -> Access credential obtained | Native token exchange at *discovered* token endpoint with original PKCE verifier; require bounded response/lifetime. Bind issuer/client/resource using discovery, request parameters and the later edge/origin assertion, **not** by decoding an opaque token. | Wrong verifier, wrong issuer/audience, token substitution, timeout or replay -> discard. Opaque token stays in native secure storage only. Actual provider response is unknown. |
| Access credential obtained -> Supabase validated | Native requests to exact protected Next login and control API; Cloudflare assertion then actual Development Auth session checked server-side. | Edge deny, invalid assertion, revoked/expired app session, cross-user/tenant/Site -> unauthenticated; never let Access replace app auth. |
| Supabase validated -> native control authorized | Re-check active session, QA viewer and exact action/path for every request; native sends only bounded API payload. | No JS bearer, no media route, no Production fallback. Network error -> offline/failure, not authorized. |
| native control authorized -> device request pending | Secure Enclave public key and exact installation ID submitted once; server returns request ID/fingerprint/expiry. | Duplicate/second key or wrong account/Site -> denied; no silent key replacement. |
| device request pending -> owner approval pending -> approved | Separate Development owner session, verified bootstrap, fresh Mac presence, exact fingerprint/request, single-use approval; native signs server challenge. | Parent self-approval, stale/replayed/revoked approval, wrong key or signature -> denied; audit and revoke. |
| any active state -> revoked/expired | Server-side Access policy/session, Supabase session and device approval remain separately revocable; native clears volatile state and secure credentials when appropriate. | No cached protected data after denial. Refresh requires policy recheck; absolute QA deadline ends route regardless of token expiry. |
| browser or network step -> cancelled/offline/failure | User cancellation, app background/restart, or transient network loss. | Fail closed and keep no authenticated UI; restart may resume only a still-valid, server-validated session, never a stale callback. |

## Local qualification and missing contract

Focused existing local tests on this worktree: `node
scripts/qa/check-push44-qa-control-boundary.mjs` **4/4 PASS**;
`node scripts/qa/check-push44-qa-device-enrollment-transport.mjs` **9/9 PASS**
after the sandbox's loopback-listen restriction was lifted for that test only;
`node scripts/qa/check-push44-personal-team-qa.mjs` **PASS**. The initial
transport run failed with sandbox `listen EPERM` on `127.0.0.1`; its unchanged
rerun passed. These tests cover existing local boundaries, not Cloudflare
OAuth, native callback, actual original Supabase integration, or physical
iPhone. The prior real Next+original LOCAL_SUPABASE login PASS remains
**UNCHANGED PRIOR EVIDENCE** and was deliberately not repeated. No new
fixture invented Cloudflare endpoints or token responses.

**Adapter NOT JUSTIFIED YET.** A safe native adapter requires all of:
(a) exact provider metadata proving S256 and native HTTPS redirect support;
(b) a supported Associated Domains entitlement in the actual QA provisioning
profile and trusted exact-host AASA path; (c) confirmation that native opaque
bearer requests generate the expected signed origin assertion and do not
leak a client `Authorization` header into the fail-closed Unix ingress;
(d) a policy on a phone-reachable Access application rather than today's
private-hostname/no-route destination. Cloudflare docs do not supply these
account-specific response fields and Apple capability is absent from the
current build. Adding a speculative callback, mock provider token or cookie
bridge would weaken the boundary. No provider-dependent code/build was made.

**Signing feasibility:** the current `PersonalTeamQA` target is the isolated
`com.ganbatuach.app.qa` bundle with no APNs entitlement. Its configuration
test passes, but it has `CODE_SIGN_ENTITLEMENTS=""`, no Associated Domains,
and the previously verified installed-on-disk provisioning profile expires
`2026-10-26T23:14:41Z`. Apple requires an associated domain for its exact
HTTPS `ASWebAuthenticationSession` callback. Whether the available Personal
Team profile can include that entitlement is **not proven**; adding the
capability or changing the profile is outside this task. The existing
signature does not qualify a future OAuth build, and compilation would not
be physical-iPhone proof.

## One minimal *future* provider experiment — proposal only

After separate owner approval and Apple signing feasibility, test only
`qa-iphone-device-proof.ganbatuach.com` in account
`693f824a750afcc264fe6ee58c8a86ab`, team `spring-feather-ce4e`, with
one explicit owner-only Access policy, a phone-reachable exact-host
self-hosted Access application, Managed OAuth enabled only for that app, one
exact HTTPS redirect, one RFC 8707 resource and S256, and a control-only
outbound Tunnel to the protected Unix-socket proxy. The existing private
destination/app cannot be presumed compatible: before any mutation review
whether to convert it or use a separately approved noncolliding QA host.
Never add broad LAN routes, an Access bypass, a public admin endpoint, media
paths or additional identities. Keep the separate Development parent QA
login/session and Mac-local owner approval; no device enrollment is issued
by the experiment.

Order of gates: read-only account-specific entitlement/price and current
configuration receipt; approve one exact Access destination/policy/OAuth
change; expose only the 30-minute control route; fetch its real `401`/metadata
and confirm issuer, authorization/token endpoints, S256 and HTTPS redirect;
run one native request with an opaque credential and verify the origin sees
only a validated signed assertion (no copied cookie or untrusted bearer);
verify separate Development session and device proof remain mandatory;
measure edge-denied plus admitted requests, bytes, origin compute and logs;
then stop Tunnel, disable policy/OAuth and verify public denial. Any absent
S256, unsupported callback, provider charge, unmatched JWT or token
substitution stops the experiment before enrollment. Preserve only sanitized
metadata booleans, counts, configuration IDs, timestamps and rollback receipt.

**Cost gate:** Existing Free plan and all-plan Tunnel support indicate no
known new fixed subscription. They do **not** prove Managed OAuth Beta has no
incremental charge or cap edge requests/egress. The origin's 30-minute,
1,000-attempt, 2-KiB-body and 64-MiB reserved-plus-reply ceilings do not
bound denied edge traffic, Access login/refresh, Tunnel requests, logging,
Mac compute/egress, cellular charges or taxes. Maximum financial exposure is
**UNKNOWN**, so no external activation is eligible yet. A supplier quote or
actual account quota/spend-control evidence is required before approval.

Preservation: no Cloudflare/Apple/Supabase/GitHub mutation, remote push, PR
update, CI, device installation, media or Home/Production action in this
local-only pass. PR #248 and #235 stay Draft; main and Production unchanged;
PUSH 44 partial, PUSH 46 not started. This commit remains local-only and must
be pushed/ledger-reconciled by a later authorized integration owner before it
can count as remotely preserved work.
