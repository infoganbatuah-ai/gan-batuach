# PersonalTeamQA Secure Enclave primitive — qualification boundary

The dormant `QaSecureEnclaveProof` code is compiled only under the existing
`PERSONAL_TEAM_QA` condition in `AppDelegate.swift`; it is not exposed through
a Capacitor plugin or called at app launch. It uses an exact QA bundle ID,
Secure Enclave token, `WhenUnlockedThisDeviceOnly` Keychain accessibility and
user-presence access control. There is no software-key fallback. A missing
Enclave or denied owner-presence prompt must fail closed.

The public P-256 X9.63 point is wrapped in the standard P-256 SPKI DER prefix
expected by the server verifier. The native signing method constructs the
canonical seven-item JSON array and requests X9.62 ECDSA/SHA-256 (DER
signature). The local fixture checks the same SPKI prefix and server message
with synthetic keys. No real private key or QA credential is committed.

This is **not** physical iPhone proof. The test does not establish that the
PersonalTeamQA target compiles or that Security.framework returns an Enclave
key on the owner's iPhone. A native signed-build check and real-device test
must confirm Keychain persistence across app restart, user-presence behavior,
non-exportability, exact signature interoperability and fail-closed behavior
after key loss/reinstall. A Keychain item may survive app reinstall; controlled
server-side revocation/re-enrollment must define that lifecycle. There is no
enrollment, registered installation, challenge transport, callback, endpoint,
media or external route in this change. The remote IPA bootstrap block remains.
