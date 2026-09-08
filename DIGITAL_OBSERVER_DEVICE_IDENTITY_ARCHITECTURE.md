# Digital Observer Managed-Device Identity Architecture

Date: 2026-09-08
Protocol: `observer-managed-device-v1`

## Scope

This architecture applies only to Digital Observer-managed local components:

- `SOFTWARE_CONNECTOR`
- `PHYSICAL_GATEWAY`
- future `ENTERPRISE_EDGE`

It does not create a device principal for vendor-cloud, account-link, supported P2P, direct-secure, or other true zero-install camera connections. The governing order remains `ZERO-INSTALL FIRST → MOBILE-ASSISTED → SOFTWARE CONNECTOR → PHYSICAL GATEWAY`.

## Canonical principal

The authoritative enrollment row identifies an immutable device and binds it to one tenant, one Site, and one server-selected deployment profile. Its security state includes credential version, runtime/config versions, enrollment/lifecycle state, last-seen time, active runtime instance, sequence, clone signal, and revocation data. A device ID is a lookup key only and never an authenticator.

## Cryptographic authentication

New devices generate an Ed25519 key pair locally. Only the DER/SPKI public key is enrolled in the cloud. The DER/PKCS8 private key remains in the platform-protected local store used by the existing Connector/Gateway package.

Every authenticated request signs a canonical envelope containing protocol, HTTP method, path, SHA-256 body digest, device ID, credential version, timestamp, random nonce, runtime-instance ID, and monotonic sequence. The server verifies the signature against the active device-specific public key, enforces a two-minute clock window, persists one-use nonce evidence, and validates lifecycle, Site, tenant, profile, and operation scope.

This is application-layer Ed25519 request authentication. It is not described as mTLS, certificate-PKI, hardware-backed identity, or remote attestation.

## Enrollment

The existing PUSH 17 one-time installation intent remains the bootstrap:

`Dashboard authorization → short-lived Site-bound intent → local key generation → public-key claim → Product approval → delivery`

The bootstrap bearer is single-use and erased after claim. It does not become the permanent credential. New approval atomically activates credential version 1 and binds the principal to the original authorized Site/tenant/profile.

## Authorization

Authenticated device sessions are short-lived and contain server-derived profile and operation scopes. Shared operations are authentication, heartbeat, configuration read, discovery publish, Event ingest, media upload, playback grant, and credential rotation. Privileged command polling is granted to Physical Gateway/Enterprise Edge profiles, not to a Software Connector. Client-supplied profile text cannot grant permissions. Managed-Site discovery cannot fall back to the historical shared discovery signature.

## Rotation

Rotation is two phase:

1. The active old key signs a request that registers a distinct pending public key.
2. The server returns a short-lived random challenge.
3. The new private key signs the challenge.
4. One transaction activates the new version, retires the old version, clears runtime-session state, and consumes the challenge.
5. The edge replaces its durable local key only after confirmation.

Site, camera mappings, history, and rules remain unchanged.

## Revocation, replacement and rebind

Authorized lifecycle states are `ACTIVE`, `REVOKED`, `LOST`, `REPLACED`, and `RETIRED`. Revocation removes legacy refresh material, revokes active/pending keys, and marks dependent source monitoring `ACTION_REQUIRED`. A revoked principal cannot obtain a session or perform privileged operations.

Same-Site replacement transfers source bindings only after Product authorization and retires the old principal. Cross-tenant movement never transfers a credential: the old principal is revoked/retired and the component completes a new, authorized enrollment in the destination tenant. Audit history is preserved.

## Anti-cloning foundation

Nonce reuse is rejected by a database uniqueness boundary. A lower/equal sequence from the same runtime is classified as stale. Concurrent use from a different runtime instance inside the two-minute live-session window records `clone_suspected_at` and is denied. A new runtime after the bounded quiet period is classified as a restart. IP address alone is never treated as clone proof.

## Configuration and commands

Configuration is authenticated, Site-scoped, versioned, and validated by the existing bounded configuration contract. Remote commands remain a fixed allow-list. There is no arbitrary shell operation in the protocol. Request nonces, command idempotency, and credential-version checks prevent replay and stale authorization.

## Diagnostics

Diagnostics may contain safe IDs, profile, lifecycle, credential version, timestamps, and bounded error category. Private keys, camera/vendor passwords, bootstrap or permanent tokens, authorization headers, private stream URLs, signed media links, and sensitive configuration are redacted.
