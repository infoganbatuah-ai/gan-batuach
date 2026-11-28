# PUSH 44 — native app / Push-token proof source qualification

Offline source review, 2026-11-16. No attestation, provider call, token binding,
or sender change was executed. This document is **not** a verifier design approval.

## What the current build actually contains

- iOS `ios/App/App/App.entitlements` declares `aps-environment`, but the inspected
  source contains no App Attest entitlement or `DCAppAttestService` integration.
  The dormant Secure Enclave QA device-proof in `AppDelegate.swift` is a distinct
  key-possession mechanism; it does not attest the app or bind a Push token.
- Android `android/app/build.gradle` has Gan/Observer product flavors. Its
  `applicationId` values are build declarations, not server-verifiable evidence.
  Observer QA explicitly forbids the Gan `google-services.json`; the inspected
  source has no Play Integrity request or verdict decoder.
- Gan and Observer web FCM registration calls use the same `/api/push/register`
  endpoint and caller-supplied `metadata`. There is no native attestation in
  either call. The active server stores the submitted token but does not verify
  app ownership. This does not prove that any current QA build can receive Push.

## Minimum candidate by platform, subject to qualification

### iOS — Apple App Attest, not a bare bundle label

Apple documents that an app creates and attests an App Attest key, then signs a
SHA-256 hash of unique request data with `generateAssertion`; the server checks
the attestation chain, app-ID hash, environment, key ID and assertion counter.
The candidate request data is a deterministic encoding of a server nonce, the
authenticated profile, allowed product/app ID, installation ID and SHA-256 of
the *exact* APNs/FCM token. The server must verify the exact encoded request,
consume the nonce once, and persist the monotonic counter. This binds the
attested app instance to a **claim that it submitted that token**. It does not
make APNs issue a server-verifiable ownership certificate for that token.
Treat provider acceptance and real-device delivery as later independent checks.

App Attest support is device-dependent (`isSupported`); Mac/Catalyst paths are
unsupported. Its development and production attestation environments are
separate. Before implementation, inspect actual iPhone provisioning/entitlements
for the Personal Team QA and release builds, Apple Developer account capability,
App ID/team ID, and sandbox-vs-production behavior. If entitlement or device
support is absent, fail closed for the native-binding path; do not substitute
the existing Secure Enclave signature as if Apple had attested the app.

Primary sources: [App Attest assertion](https://developer.apple.com/documentation/devicecheck/dcappattestservice/generateassertion%28_%3Aclientdatahash%3Acompletionhandler%3A%29),
[attestation validation](https://developer.apple.com/documentation/devicecheck/attestation-object-validation-guide),
[environment entitlement](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.devicecheck.appattest-environment),
[device support](https://developer.apple.com/documentation/devicecheck/dcappattestservice/issupported),
[APNs app-specific tokens](https://developer.apple.com/documentation/usernotifications/registering-your-app-with-apns).

### Android — Play Integrity verdict with request binding

Google's Standard API returns a server-decoded verdict containing `requestHash`,
request package name and timestamp, plus app recognition. The candidate
`requestHash` is a hash of the same canonical challenge fields above, including
the exact FCM token hash. Server decoding must check the hash, timestamp,
allowlisted package and signing-certificate digest, and an acceptable app
recognition verdict. Google documents automatic replay protection for Standard
requests, but the application should still consume its own nonce once and
reject a second binding attempt. A Play verdict does not prove that an FCM
token can be decoded by this server as belonging to that package.

The project's QA APK may be sideloaded and the Observer flavor lacks Gan's
Firebase configuration. A `PLAY_RECOGNIZED` verdict must not be assumed for
such a build; Play Console registration, package/signing identity, linked Cloud
project, API enablement, quotas and a supported test distribution must be
qualified first. Do not weaken the expected verdict merely to make QA pass.
Standard verdict decoding is server-to-server through Google Play, not an
offline local verifier. FCM's `SENDER_ID_MISMATCH` only detects a sender-group
mismatch at send time; it is not registration-time proof of product audience.

Primary sources: [Play Integrity overview](https://developer.android.com/google/play/integrity/overview),
[Standard request binding](https://developer.android.com/google/play/integrity/standard),
[verdict fields](https://developer.android.com/google/play/integrity/verdicts),
[setup and test verdicts](https://developer.android.com/google/play/integrity/setup),
[FCM error codes](https://firebase.google.com/docs/cloud-messaging/error-codes).

## Boundaries and entry conditions

1. Keep the active registration and both sender paths unchanged until the exact
   iOS and Android shipping app IDs, signing identities, provider projects/topics
   and QA support are verified from build and provider records. Client metadata,
   token text and `app_channel` are not evidence.
2. Select one attestation protocol per supported native build; define canonical
   request encoding, nonce/counter custody, session and profile binding, token
   refresh, expiry, revocation, error paths and audit. Keep browser Push a
   separate qualification; neither native mechanism authenticates a web origin.
3. Locally test encoding, nonce state-machine, expiry/replay/revocation and
   fail-closed verdict-policy decisions with synthetic **already-verified**
   verdict fixtures. These are not Apple/Google attestation proof.
4. Integration proof requires real supported build/device/provider calls and
   server-side certificate/verdict validation. Only then may an authorized
   Development migration install a private binding writer and both send paths
   filter by the server-verified audience. Real delivery remains a separate gate.

No independent verifier code should be written yet: the project's actual QA
entitlements and Play distribution/verdict policy have not been qualified, and
the provider attestation formats have not been exercised. A safe next local
unit is a deterministic challenge encoder and one-use nonce state-machine with
synthetic fixtures only; it must not claim app or token ownership.
