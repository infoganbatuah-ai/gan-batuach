# PUSH 44 — provider verifier prerequisite and independent mobile status correction

Local source review only, 2026-11-16. No Apple/Google request, device operation,
Push registration, database operation, external service, or remote publication.

## Why a real Push attestation verifier was not implemented

The Observer QA iOS configuration `ios/qa-observer/ObserverQA.xcconfig`
disables code-sign entitlements; the previously inspected signed Personal Team
QA artifact had neither APNs nor App Attest entitlement and is Push-disabled.
The shared iOS source entitlement declares an APNs placeholder, not a verified
shipping entitlement. `android/app/build.gradle` rejects Gan's Firebase
configuration for Observer QA; no Play Integrity request/decoder exists in the
source. Provider code reads APNs/FCM environment variable names but does not
establish a verified topic/project, app signing digest, or server-side
Apple/Google proof verifier for these QA builds. Therefore the default-off
binding issuer remains disconnected. A fake local verdict cannot be upgraded
to platform proof. No provider IDs, keys or certificates were invented.

Official contracts checked: [Apple App Attest validation](https://developer.apple.com/documentation/devicecheck/attestation-object-validation-guide),
[Google Play Integrity Standard](https://developer.android.com/google/play/integrity/standard),
[Google verdict fields](https://developer.android.com/google/play/integrity/verdicts).
The project-specific missing facts are supported QA entitlement/distribution,
exact app/team or package/signing identity, linked provider project, and a
cryptographic/server-decoded evidence source. A future verifier must also bind
the exact registration challenge and provider token hash, then consume its
nonce durably. No live registration or sender may use the offline contract yet.

## Independent safe product fix

`ObserverMobileRuntime` already covers protected native content while session
revalidation is uncertain or offline. Its secondary status banner previously
said cached data was visible and promised automatic action synchronization,
contradicting that protective overlay and exceeding the verified behavior.
The banner now states that protected data remains hidden until revalidation or
network recovery. A focused static regression test asserts both the overlay
and truthful status copy. This is a UI/source qualification only, not a new
physical-iPhone result.
