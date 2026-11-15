# PUSH 44 Swift-to-server QA proof format check

On 2026-11-15, `check-push44-swift-server-message-fixture.mjs` extracted the
actual seven-item Swift `message` expression from `AppDelegate.swift`, ran it
with Swift Foundation using synthetic identifiers, and compared its serialized
bytes to `qaDeviceProofMessage` in the server verifier. It also compared the
native SPKI prefix to a generated P-256 public key. The format cases passed.
The fixture now uses only the project-owned cache on `DIGITAL_OBSERVER` and
fails closed if that path is unavailable or an internal path is supplied.
This is byte-format compatibility, not a Secure Enclave signature or device
qualification. No private QA key, enrollment or endpoint was used.

The QA target build was attempted without signing or installation, with
`-derivedDataPath`, `-clonedSourcePackagesDirPath` and `-packageCachePath`
pointed to a fresh project-owned directory on `DIGITAL_OBSERVER`. It still
exited 74 before compilation with the exact Xcode error:

> Could not initialize package support: /Volumes/DIGITAL_OBSERVER/XcodeStorage/DigitalObserver/SwiftPackages/Cache is not accessible or not writable

The Xcode user preference `IDEPackageCacheDirPath` points to that shared path.
This task did not change the preference, filesystem permissions or existing
shared cache. Swift frontend syntax parsing passed separately, but full
PersonalTeamQA compilation remains **not proven**. Do not claim physical
Secure Enclave proof or remove the remote QA build block from this fixture.
