# Offline Apple App Attest verifier evidence

The disconnected verifier is `lib/domain/apple-app-attest-verifier.mjs`. It is
not imported by registration routes, the Push sender, or any running service.
It pins Apple's published App Attestation Root CA by DER SHA-256 and checks
the x5c signatures, certificate validity, attestation nonce, RP ID
(`SHA256(teamId.bundleId)`), environment AAGUID, zero registration counter,
credential key ID and P-256 public key. It requires a server-owned challenge
and a caller-supplied atomic durable challenge-consumption function. The
receipt is returned as **unverified**; it is not an entitlement or device
approval. A later assertion verifier must separately enforce increasing
counters and durable replay prevention. No such live integration exists here.

The official [Apple Attestation Object Validation Guide][guide] sample is a
**negative** vector for the documented algorithm. Its leaf certificate nonce
matches `SHA256(authData || raw "example_server_challenge")`, while
[Apple's server validation documentation][validation] specifies
`clientDataHash = SHA256(serverChallenge)` and therefore
`SHA256(authData || clientDataHash)`. The two digests differ. The test
verifies the sample's signed chain, RP ID, key binding and that discrepancy,
then requires verifier denial. It does **not** alter the verifier to accept
the raw challenge.

Focused local command:
`node scripts/qa/check-apple-app-attest-verifier.mjs`.
It covers malformed input, wrong team/bundle/environment/key ID, expired
certificate, tampered chain, absent challenge consumer and the official
sample mismatch. No challenge consumer is invoked for a denied attestation.

Not proven: acceptance of a valid Apple-signed positive vector, physical
iPhone Secure Enclave/App Attest behavior, receipt validation, durable
one-time challenge consumption, assertion counter progression, device
registration or Push token ownership. The current offline QA installation
has no App Attest entitlement. A real positive proof requires an
entitled, approved build and a fresh Apple-signed attestation for the
canonical server challenge, or an independently verifiable positive vector
that follows Apple's documented algorithm. No synthetic certificate is
treated as Apple evidence.

[guide]: https://developer.apple.com/documentation/devicecheck/attestation-object-validation-guide
[validation]: https://developer.apple.com/documentation/devicecheck/validating-apps-that-connect-to-your-server
