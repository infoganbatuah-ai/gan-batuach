# PUSH 38K — controlled live deployment gate

Observed 2026-09-13. **NOT READY FOR V8; live deployment stopped before its first write.** PR #28 remains draft/unmerged. No live bootstrap, remediation update, pre-soak, or v8 was started.

## Pre-write evidence

The zero-write signed-baseline planner verified Gateway release `qa-legacy-gateway-91bf6814075f` against all 491 installed members and Connector release `qa-legacy-connector-ee82c20a77ac` against all 250 installed members. Both manifests and archive digests verified, both legacy services were running, and no layout conflict or baseline drift was found. Gateway artifact SHA-256: `91bf6814075f74e703cbc0b85d30673237531247ec46633c54576d5a4627144d`. Connector exact-capture artifact SHA-256: `ee82c20a77acb7fd8caf692682569ad53581e9c057b11724845c6d947c5a982a`.

Bounded read-only health probes returned HTTP 200: Gateway healthy, 10/10 assigned DVR channels connected, six unassigned, zero stalled, authorization ready; Connector healthy, 1/1 Tapo connected, zero stalled, authorization ready. These are point-in-time signals, not Product playback/AI or sustained availability proof. No device/Site/source identity inventory was written because the mandatory rollback gate failed before any change.

## Mandatory rollback gate: FAIL

The Connector **exact live** baseline has a valid QA Ed25519 release manifest and matching archive hash, but its original macOS app is **not strictly code-signature valid**. Both the installed app and an isolated extraction of the exact signed rollback archive fail `codesign --verify --deep --strict` with “a sealed resource is missing or invalid.” Verbose verification identifies post-sign additions under the bundled runtime backup area and post-sign changes to the Connector runner and supporting runtime modules. This is an artifact-seal defect, not an archive checksum mismatch. The canonical installed-slot adapter explicitly runs strict `codesign` during baseline staging; it would reject this exact artifact before creating a valid managed rollback slot.

The separately prepared `qa-legacy-connector-resigned-6e7988808b05` QA artifact is strict-valid in isolated QA, but its SHA-256 is `6e7988808b05956d58416a6ce60638f52b19aa732918ac0e1cdafcc5fc9f130a`, not the exact installed-capture hash. Substituting it for the required exact-current Connector KNOWN_GOOD would silently change the rollback identity and violate this PUSH 38K gate. No such substitution was made.

**HIGH internal release/rollback blocker: 1 — exact live Connector baseline cannot be installed as a strict-valid managed rollback artifact under the current contract.** Resolve through an explicitly approved legacy-seal transition design and repeat isolated exact-rollback/security QA, or authorize a revised baseline/rollback equivalence policy with clear byte differences and recovery proof. Do not merely bypass strict signature verification. Recheck live hashes and health after any resolution and before the first future write.

## Qualification and continuity

Connector bootstrap: **NOT ATTEMPTED**. Gateway bootstrap: **NOT ATTEMPTED**. Both remediation updates: **NOT ATTEMPTED**. The old live runtimes, their service identities, Site/source bindings, credentials, queues, and camera configuration were not modified. Therefore post-update identity/source continuity, Product playback, AI progress, 60-minute monitor coverage, data-loss and duplicate-effect counts are **NOT MEASURED**, not fabricated zeros. The last read-only camera snapshot was Gateway 10/10 and Connector 1/1 with six empty slots.

Production release-signing custody, Apple Developer ID distribution signing and notarization remain separate external commercial-distribution gaps. The blocker above is internal and cannot be waived by those external gaps. PUSH 38 remains NOT DONE; PUSH 39 is out of scope.
