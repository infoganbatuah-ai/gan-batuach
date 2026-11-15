# PUSH 44 QA installation proof — dormant server primitive

`lib/domain/digital-observer/qa-device-proof-server.ts` verifies a P-256
ECDSA/SHA-256 signature over a canonical challenge containing nonce, account,
session, installation, exact QA bundle audience and expiry. It rejects malformed
keys/signatures, wrong curve, context changes, expiry, revocation and already
consumed challenges. It is not imported by an active route.

The test uses synthetic P-256 keys. It proves signature verification and
context binding in isolation, **not** Secure Enclave non-exportability or
physical-device identity. A future iOS implementation must create the key
through Apple Security APIs, retain its private half in the Secure Enclave
where supported, register the public key through controlled enrollment, and
prove the exact signed message format on the signed physical QA build.

The verifier does not itself issue a nonce, validate the current Supabase
session, enroll an installation, or atomically consume a challenge. A future
server route must obtain a server-issued challenge from durable storage,
validate the live Development session and exact registered public key, verify
the signature, then perform a fenced one-use consume in one transaction. The
pre-read or this signature check alone cannot prevent concurrent replay.

No migration, SQL execution, endpoint, callback, feature activation, provider,
real secret, IPA or external route is included. The existing remote QA build
block remains necessary until these dependencies and physical-iPhone proof
are completed under separate scope.

## Proposed durable receipt (separate local review unit)

`proposed-schema.sql` is intentionally held beside this document, outside
`supabase/migrations`. It proposes a private schema with one approved
installation per account and short-lived, one-use challenge receipts. Neither
table has grants for `anon` or `authenticated`; only a trusted server role
would use them after a separate deployed-catalog, ACL and migration review.
No approval/enrollment function is included.

`challenge-store-adapter.mjs` is likewise isolated from active routes. It
loads the stored challenge and approved public key, verifies the P-256 proof,
then sends one parameterized `UPDATE ... WHERE consumed_at IS NULL ... RETURNING`
that fences account, session, installation, audience, nonce, key, expiry and
revocation. A concurrent loser receives no row. A storage error fails closed.
The adapter's `activeSession` input must come from a trusted live Development
Auth check; the review-only adapter cannot prove atomicity against a session
revocation racing the final update. A future product implementation must
resolve that race against the actual deployed Auth session contract before
activation. The fake-query tests model an atomic database update, not actual
PostgreSQL concurrency, RLS, crash durability or session-revocation proof.

Do not move the SQL to active migrations, import the adapter into a route, or
remove the remote-build block on the strength of these synthetic tests.
