# PUSH 44 — one-installation device proof (isolated Development candidate)

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
