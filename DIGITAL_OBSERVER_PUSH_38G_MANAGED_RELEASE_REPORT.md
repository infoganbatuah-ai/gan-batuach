# PUSH 38G — isolated managed release qualification

Status: **NOT READY FOR LIVE BOOTSTRAP**. PUSH 38 remains NOT DONE. This work was isolated QA only; the Home Gateway/Connector runtimes, identities and camera configuration were not changed. The real 60-minute gate and v8 have not started. PR #28 remains draft/unmerged.

## Signed QA releases

| Profile | Release ID | Version | Exact source commit | Artifact SHA-256 | Signer |
| --- | --- | --- | --- | --- | --- |
| Gateway | `qa-p38g-gateway-06a65267dffa` | `0.2.0-p38g` | `06a65267dffa75826c3b89dc71376fc57360a091` | `ee2e1c803a925f394e55eddc93060a83d29926dbfc2a38529b9172c941e08c14` | `qa-p38f-ed25519-20260913` |
| Connector | `qa-p38g-connector-06a65267dffa` | `0.2.0-p38g` | `06a65267dffa75826c3b89dc71376fc57360a091` | `e020613085d001af92d7ebda3f02049a0ab017b1e1e10889c4998b71b5b96db2` | `qa-p38f-ed25519-20260913` |

Both manifests use PUSH 19 canonical Ed25519 signing, contain exact profile/platform/architecture, compatibility, size, SHA-256, and `observer-edge-health-v1` metadata. The archives are immutable QA artifacts under restricted `/Volumes/DIGITAL_OBSERVER/QA-Releases/PUSH-38G/` directories, not a Production repository/CDN. `qa.invalid` download URLs intentionally cannot deploy them. No Production private key is in the repo or device. The QA signer is external to Git under restricted `/private/tmp` custody; that location is not Production custody.

The original Connector legacy candidate remains invalid under strict macOS verification. The derived `qa-legacy-connector-resigned-6e7988808b05` baseline has SHA-256 `6e7988808b05956d58416a6ce60638f52b19aa732918ac0e1cdafcc5fc9f130a`. It is **not byte-identical** to the original archive; only the app code seal was reissued at ad-hoc QA level. The QA comparison found 248 runtime files unchanged. This derived release is the Connector rollback target in isolated tests, not a live known-good pointer. The remediation Connector app passed strict `codesign --verify --deep --strict` after final packaging; modifying a sealed resource afterward made that check fail.

## Managed-slot and service-manager proof

The isolated `check-push38g-managed-lifecycle.mjs` test used unique `com.digitalobserver.qa.push38g.*` macOS LaunchAgents and ports 38191/38192. For **both profiles**, it started the signed legacy package through launchd, bootstrapped an installed slot, restarted the managed baseline, installed a signed bad release which returned HTTP 503, failed the mandatory health gate, automatically rolled back through launchd, verified the registered known-good SHA-256, then installed the signed remediation release through launchd and observed `observer-edge-health-v1`, version `0.2.0-p38g`, and the exact build commit. Fake identity, configuration, durable queue and source-map fixtures outside runtime slots remained byte-for-byte unchanged. There were zero real cameras and no live identity in this QA test.

**Evidence boundary:** launchd managed the QA `server.mjs` child, not the complete installed `run-persistent-home-gateway.mjs` or `run-software-connector.mjs` supervisor chain. Thus service-manager slot switching and rollback are proven, but exact full-profile supervisor/Keychain/config compatibility is **not**. The current adapter is explicitly QA-scoped and cannot operate a live label/port. A reviewed live-safe adapter and a non-disruptive trial of the full supervisor topology are still required before live bootstrap. The signed remediation archives map to commit `06a6526`; later trust-agent hardening in this branch is **not** in those archives and must be rebuilt/re-signed and retested before any live use. These remain internal HIGH readiness blockers; this report does not reclassify them as PASS.

## Trust and negative QA

The release key registry is a versioned, root-signed `observer-edge-trust-registry-v1` with monotonic epoch and explicit `TRUSTED`/`REVOKED` states. The runtime update agent now rejects arbitrary caller-supplied keys by default and loads release keys from a locally pinned root and signed registry. A local-administrator-only root installer requires exact public-key fingerprint confirmation; a separate administrator installer accepts only a root-signed, non-replayed registry. The device never receives a private release-signing key. QA proved old→new key rotation, revoked-old release rejection, unpinned-key injection rejection, forged root/registry rejection and epoch replay rejection. The root installer and live registry have **not** been run on Home.

Both actual remediation releases passed unsigned, untrusted/revoked key, tampered manifest, tampered artifact, wrong profile, wrong architecture and unauthorized downgrade rejection. Connector post-sign bundle mutation failed strict signature verification. The isolated OTA manager tests cover bootstrap idempotency and failure safety; the complete LaunchAgent test covers signed bad-update rollback for both profiles.

Machine-readable result and explicit limitations: `DIGITAL_OBSERVER_PUSH_38G_QA_EVIDENCE.json`.

## Exact later live-bootstrap plan — not executed

1. Obtain Production-approved Ed25519 signer custody, approval/audit and publication authority; obtain Apple Developer ID application signing and notarization credentials for distribution. QA artifacts/keys are not substitutes.
2. Capture and re-verify the exact still-running legacy runtime immediately before bootstrap. Bind the authorized baseline release to its measured files/profile, preserving the existing identity/config/queue directories and Site/source mappings outside slots.
3. An authorized local administrator installs a pinned **public** root, confirms its fingerprint out-of-band and installs the root-signed release-key registry. A normal update request cannot register a new trust root. Validate current/rollback keys against revocation policy.
4. Establish managed CURRENT/KNOWN_GOOD slot metadata and OTA agent *without replacing the functional runtime*. Prove idempotency and rollback artifact retrievability; use a controlled, durable release location rather than QA `qa.invalid` URLs.
5. Verify identity, Site, source IDs, 10 DVR + 1 Tapo progression, six empty slots, playback and AI. Canary remediation one component at a time only after signed release custody and strict Connector distribution signing are satisfied. Do not start the 60-minute gate until both new health contracts are live and smoke passes.

## External and unresolved gates

Production release custody needs an authorized signer identity, protected CI/HSM/KMS key, approval/audit process, publication endpoint, device trust-root rollout and rotation/revocation runbook. Apple distribution requires Developer ID Application certificate, secure certificate custody and notarization credentials; QA ad-hoc signing does not qualify. Internally, the full supervisor lifecycle, live-safe bootstrap/slot adapter, and a freshly signed package containing the completed trust-agent integration remain unproven. Therefore `LIVE BOOTSTRAP READINESS = NO`. PR #28 must remain draft/unmerged; no live deployment, pre-soak, v8 or PUSH 39 may begin from this evidence.
