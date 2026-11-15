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
The adapter no longer accepts a caller-supplied `activeSession` boolean. It
requires a trusted server-side verifier to return the current account and Auth
session identity, and its proposed consume statement checks the same session
against `auth.sessions` at the database boundary with a row lock. The existing
`digital_observer_current_session_active()` migration is source evidence that
this table, `id`, `user_id`, and `not_after` are the canonical session contract.

**Activation remains blocked:** the proposed private-store SQL has not been
applied, the trusted verifier has not been wired to an authenticated route,
the deployed `auth.sessions` ACL for that role is unverified, and the row-lock
behavior against concurrent Supabase Auth revocation has not been exercised in
PostgreSQL. The verifier callback is an injection seam, not an authorization
implementation; a caller must never supply it from mobile input. A future
authorized database integration test must prove that revocation and consume
serialize as intended. The fake-query tests model conditional consumption,
not actual PostgreSQL concurrency, RLS, crash durability or session-revocation
proof.

Do not move the SQL to active migrations, import the adapter into a route, or
remove the remote-build block on the strength of these synthetic tests.
