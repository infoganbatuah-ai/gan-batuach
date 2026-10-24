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
