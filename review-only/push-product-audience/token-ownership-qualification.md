# PUSH 44 — token ownership qualification (offline)

Status: **BLOCKED for active registration and delivery**. This is a review-only
entry gate, not an implementation of provider attestation or a deployed binding.
No SQL, provider, device, or runtime operation is authorized by this document.

## Source evidence at `5d1d6c72d51cb7f2847b23ab381762f115a87736`

| Surface | Observed contract | Missing proof |
| --- | --- | --- |
| `app/api/push/register/route.ts` | Authenticated profile; caller supplies `platform`, token, device ID and arbitrary metadata | Server-verified product, installation and provider-token ownership |
| `components/fcm-push-registration.tsx` | Gan browser FCM token and `source: fcm_web` metadata | Native app identity; browser origin is not a native package attestation |
| `components/digital-observer/observer-fcm-push-registration.tsx` | Observer browser FCM token on the same registration endpoint | Independent Observer app identity; `source` is client-controlled |
| `components/digital-observer/observer-mobile-runtime.tsx` | Native token and `digital_observer_native` metadata | Proof that the installed app and token belong to the claimed product |
| `ios/App/App/AppDelegate.swift` | Dormant Secure Enclave device-proof key bound in code to the Gan QA bundle | No Push-token binding, and no attestation of the app bundle to the server |
| `android/app/build.gradle` | Distinct Gan/Observer product flavors and QA suffix | Build configuration is not a server-verifiable claim from an installed device |
| `lib/domain/push-product-audience.ts` | Fail-closed target selector accepts *already trusted* bindings | No trusted binding writer or evidence verifier |

`app_channel` is a form factor. A token string, `device_id`, user metadata,
`source`, package name submitted in JSON, or authenticated profile by itself
must not become product ownership proof. The proposed `push_private` binding is
review-only and has no migration or writer. Both active send paths still select
all active tokens for a profile and therefore cannot be declared audience-safe.

## Required proof contract before implementation

The next implementation must choose and verify a supported platform-specific
evidence source. For each registration it must let the **server** validate an
allowlisted app identity, the authenticated profile, a particular installation,
and ownership of the exact provider token. An app attestation without a token
hash in its challenge does not prove token ownership; a token hash without
attested app identity does not prove the product. Verify provider/project/topic
and release/QA bundle IDs separately. Do not infer them from the token text.

Proposed internal verifier input (not a public API): authenticated profile ID,
platform, intended product audience, provider token, server-issued nonce,
attestation/proof artifact, and bounded timestamp. The server constructs a
canonical challenge containing nonce, profile ID, audience, allowlisted app ID,
installation key fingerprint, and SHA-256 of the exact token. Proof verification
must check signature and issuer, app ID, challenge equality, freshness, nonce
single-use consumption, and revocation. It returns either a server-authored
`TrustedPushBinding` candidate or a typed denial; no client field may populate
`verifiedAppId` or `evidenceSha256` without this check.

Before a binding writer is allowed, establish the actual iOS/Android attestation
capabilities and provider-token ownership mechanism for the shipping builds.
Record unsupported devices and browser Push separately; fail closed or define a
separately verified web-origin contract. The dormant Secure Enclave proof can
demonstrate key possession but is **not** by itself Apple app attestation or
proof that an APNs/FCM token belongs to that key. The Android build flavor alone
is not Play Integrity evidence. No current source path implements either proof.

## Required deterministic qualification cases

1. Valid Gan app + token proof yields only a Gan binding; valid Observer proof
   yields only an Observer binding.
2. Wrong app/bundle/package, wrong provider project/topic, wrong token hash,
   wrong profile or installation, and cross-audience reuse are denied.
3. Replayed nonce, expired proof, revoked installation, revoked session, and
   concurrent duplicate registration are denied or atomically idempotent.
4. Re-registering a token under a different product cannot silently replace an
   existing verified binding; token refresh and logout revoke old bindings.
5. Both active send paths deny unbound, expired, revoked, and cross-product
   tokens before any provider call. Gan camera alerts retain their Gan destination;
   standalone Observer alerts cannot use Gan tokens, and vice versa.

Only after these tests and an authorized Development schema qualification may
the binding writer and both send paths be changed. The sender must continue to
enforce destination, profile and product binding at dispatch time; a successful
registration check is not a lifetime authorization. Provider acceptance is not
physical notification-delivery proof.
