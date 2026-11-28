# PUSH 38E — legacy baseline candidates (NOT known-good)

## PUSH 38G isolated managed rollback addendum

The Gateway's original QA-authorized release `qa-legacy-gateway-aa57572e8736` (SHA-256 `aa57572e873662d65faf241fb503eaec070c444bdcbff751dafe0fa4be89d2ae`) passed launchd-managed rollback in isolated QA. The Connector's original captured archive has an invalid strict macOS code seal; a derived QA-only re-signed package `qa-legacy-connector-resigned-6e7988808b05` (SHA-256 `6e7988808b05956d58416a6ce60638f52b19aa732918ac0e1cdafcc5fc9f130a`) passed strict verification and managed rollback. It is not byte-identical to the originally captured `ee82c20a…` artifact; 248 runtime files were compared unchanged, and only signing was reissued. Both remain **isolated QA known-good targets, not live registered KNOWN_GOOD pointers**. Details: `DIGITAL_OBSERVER_PUSH_38G_MANAGED_RELEASE_REPORT.md`.

## PUSH 38F QA authorization addendum

The exact candidate bytes were copied to restricted QA release storage outside Git at `/Volumes/DIGITAL_OBSERVER/QA-Releases/PUSH-38F/` and signed with QA-only Ed25519 key ID `qa-p38f-ed25519-20260913`. Both PUSH 19 manifests and stored artifacts independently verified. Signed release IDs are `qa-legacy-gateway-aa57572e8736` and `qa-legacy-connector-ee82c20a77ac`; their SHA-256 digests and sizes remain exactly those in the table below. The `build_sha` field in these **legacy** QA manifests is the artifact digest, **not a proven source Git revision**. QA signing establishes explicit authorization for isolated testing, not Apple distribution validity or live Production release trust.

The isolated manager contract now requires `verifyInstalled` and `stageBaseline` before committing one atomic installed-bootstrap record. Both captured archives passed the isolated manager/slot rollback drill with synthetic bad updates and fake persistent identity/config/queue/source-map files outside slots. **Service-manager restart and real identity/source compatibility were not tested.** The live components still have no known-good pointer. Do not reclassify these QA archives as live known-good or deploy them. Candidate copies under `/private/tmp` are redundant after the external-volume QA store is verified; preserve until a live-authorization decision or controlled disposal is recorded.

Capture time: 2026-09-12 22:36:55 UTC. Canonical candidate metadata: `DIGITAL_OBSERVER_PUSH_38_LEGACY_BASELINE_CANDIDATES.json`. **Neither artifact is signed, registered, or safe to use as an authorized production rollback target.** No source Git SHA can be proven from installed metadata; the live runtimes report `development` / `unknown`. A file-level Git blob match would not prove the complete package revision.

| Profile | Candidate ID | SHA-256 | Exact compressed bytes | Isolated restore evidence |
| --- | --- | --- | ---: | --- |
| Physical Gateway | `legacy-gateway-aa57572e8736` | `aa57572e873662d65faf241fb503eaec070c444bdcbff751dafe0fa4be89d2ae` | 135,687,841 | All selected restored files byte-match the live installation; restored `server.mjs` parses and starts on isolated port 19091, legacy `/health` responds with profile `PHYSICAL_GATEWAY`, zero QA sources. |
| Software Connector | `legacy-connector-ee82c20a77ac` | `ee82c20a77acb7fd8caf692682569ad53581e9c057b11724845c6d947c5a982a` | 146,777,857 | All included restored app files byte-match the live installation (excluding historical embedded `runtime/backups`); bundled Node parses and starts `server.mjs` on isolated port 19092, legacy `/health` responds with profile `SOFTWARE_CONNECTOR`, zero QA sources. |

Packages are intentionally retained as restricted local **candidates** at `/private/tmp/digital-observer-push38e-baseline.1QKeFx/` (directory `0700`, archives `0600`). This temporary filesystem is not durable release storage and may be purged; the manifest in Git enables integrity checking but does not preserve artifact bytes. The extracted QA restore directory was deleted after verification; the two compressed candidates remain only until an authorized release custodian signs/promotes them or explicitly discards them. Do not copy them to devices or call them known-good as-is.

Archive-aware Gitleaks scanning reported two `generic-api-key` matches in Gateway `managed-device-rotation.mjs` at lines 32 and 38. Direct source inspection shows they are references to variables/properties named `privateKeyPkcs8`, not embedded key bytes or credentials. No finding was reported in the Connector archive. This false-positive disposition does not substitute for controlled release review.

## Live runtime inventory and state boundary

| Class | Gateway | Connector | Rollback treatment |
| --- | --- | --- | --- |
| A Runtime artifact | `scripts/`, `services/video-gateway/`, `node_modules/`, `models/`, `vision-edge-worker`; `/usr/local/bin/node` and Homebrew FFmpeg are declared host dependencies | `Digital Observer.app` excluding historical embedded backups; bundled Node/FFmpeg/model/native libraries and `runtime/scripts`, `runtime/services`, `runtime/node_modules` | Only this class may be replaced by a verified runtime rollback. macOS code-signing must be re-established; current installed app itself fails `codesign --verify --deep --strict` with a sealed-resource error. |
| B Configuration | `.env.video-gateway.local` in Gateway runtime, excluded from package | `connector-config.json` in Connector Application Support, excluded | Preserve current authorized configuration; validate compatibility before changing code. |
| C Managed identity | macOS Keychain namespace referenced by Gateway LaunchAgent | Connector `secrets` in restricted Application Support | Never package, export, replace or reset with runtime rollback. |
| D Site/source bindings | Managed-device/Source identities in local secret store and canonical cloud | Same, separate Connector identity | Preserve and compare before/after any future update; not proven in this isolated no-identity test. |
| E Durable queue/state | Gateway `journal-outbox.sqlite*`, `private-nvr-command-state.sqlite*`, journal/command state | Connector `journal-outbox.sqlite*`, monitor/journal state in Application Support | Never overwrite with old package. |
| F Logs/temp | macOS logs, HLS temp, historical runtime backups | macOS logs, HLS temp, embedded historical backups excluded | Outside candidate artifact; not rollback payload. |
| G Secrets | Gateway Keychain, `.env.video-gateway.local` may contain operational configuration | Connector secret directory | Excluded; no private key/credential copied to QA. |

Live service definitions: Gateway `~/Library/LaunchAgents/com.ganbatuach.video-gateway.plist` launches `/usr/local/bin/node` and installed `scripts/run-persistent-home-gateway.mjs`; Connector `~/Library/LaunchAgents/com.ganbatuach.software-connector.tapo.plist` launches bundled Node and installed `scripts/run-software-connector.mjs`. Both Nodes are v24.16.0 on macOS arm64; installed FFmpeg is 9.0.1. The Gateway's code and persistent state currently coexist in one filesystem root, so a future adapter must select only runtime files and never replace the whole directory.

## What the isolated test does not prove

No private Device key or real camera credential was copied into QA. The restored child processes ran without Site/camera configuration, so service-manager lifecycle, configuration loading, real source progression and identity compatibility were **not** proven. No signed-manifest verification, managed rollback, baseline promotion, or live service restart occurred. Original and restored Connector app bundles both fail macOS strict code-signature verification; this must be investigated before treating a repackaged app as trusted. A byte-for-byte copy of an already invalid bundle does not repair its signature.

## Required authorization and rollback sequence

1. Review exact captured files/dependencies and repair/reissue the Connector's macOS package signature where required. Sign each reviewed baseline through the existing Ed25519 release custody outside customer devices; verify manifest/profile/platform/architecture/artifact hash and config compatibility with approved public keys. Do not generate an ad-hoc trust key on the Home machine.
2. Implement/verify a bootstrap adapter that stages the signed baseline package without changing the camera runtime, records a pointer to **real installed files** (not an empty slot), and can stop/switch/restart the correct LaunchAgent while preserving configuration, Keychain, queues and source IDs.
3. Perform profile-specific isolated controlled-bad-update → automatic rollback → baseline restoration → health/source recovery, using safe fixture identities. The current generic `EdgeUpdateManager.initializeKnownGood()` accepts caller-supplied version/build and creates an empty slot; it is **not sufficient** to authorize the legacy installed runtime. Do not invoke it on live components until bootstrap validation is hardened.
4. Only after isolated rollback proof, bootstrap one live component at a time, smoke-test identity/source/playback, register known-good, then stage signed PUSH 38 remediation. Abort immediately on failed smoke and keep PR #28 draft.
