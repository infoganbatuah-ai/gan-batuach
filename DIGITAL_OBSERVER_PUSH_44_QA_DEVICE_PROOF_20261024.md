# PUSH 44 — one-installation device proof (isolated Development candidate)

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
