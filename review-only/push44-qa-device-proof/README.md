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
