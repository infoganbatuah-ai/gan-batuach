# PUSH 38D — trusted deployment and pre-soak gate

Status: **NOT READY FOR V8 — PRE-DEPLOYMENT SAFETY FAILED**. PR #28 remains draft/open; PUSH 38 is NOT DONE; PUSH 39 is out of scope.

## Read-only live baseline (2026-09-12 22:26 UTC)

| Component | Installed profile/identity | Reported software/build | Package | Health contract | Progression | Authorization |
| --- | --- | --- | --- | --- | --- | --- |
| Physical Gateway | `PHYSICAL_GATEWAY`, installation `edge-65e1d136cad18a32965bb319924fda35` | `development` / `unknown` | No independently reported package version | absent (legacy response) | 10/10 DVR relays, 0 stalled, 10 assigned and 6 unassigned | ready |
| Software Connector | `SOFTWARE_CONNECTOR`, installation `edge-778760519e41b5c9b250d3ac584a78e1` | `development` / `unknown` | macOS app `0.1.0`, bundle build `1` | absent (legacy response) | 1/1 Tapo relay, 0 stalled | ready |

These are point-in-time localhost health responses. They do **not** establish current authorized Product Live View, AI progress, exact Site/source IDs, or absence of Product duplicates. Those start gates must be captured after a safe deployment and before the 60-minute clock.

## Trusted release/rollback gate — FAIL

The installed Gateway and Connector runtimes contain none of `edge-update-agent.mjs`, `edge-update-manager.mjs`, `current.json`, `known-good.json`, or `update-state.json`. Their health responses expose no OTA state or known-good version. The installed software/build identity is `development`/`unknown`, so neither runtime can be matched to a verified release artifact or to branch commit `604afd48d5ae19f915cf813a534ffb20c7569ba8` from its own reported metadata. No release-signed PUSH 38 package/manifest and approved public-key chain for these two live installations was established in this task.

Historical backup directories exist for both runtimes, but they are older manual copies, not a verified current-version, signed, health-tested known-good rollback slot. `EdgeUpdateManager.initializeKnownGood()` would create a new pointer from a caller-supplied version; using it to label the present `development`/`unknown` runtime as trusted without verifying its contents would not satisfy the requested rollback gate. The repository's PUSH 19 report also distinguishes isolated OTA proof from live deployment and notes Production signing/key custody as an operational gap.

The user explicitly instructed: **do not deploy if rollback target is unavailable**. Therefore no live files, LaunchAgents, credentials, identities, Site bindings, source mappings, or camera policy were changed. No manual copy/restart, temporary signing key, weakened trust check, or bypass of OTA was used. Gateway and Connector were not updated simultaneously or separately.

## Qualification consequences

- Post-deployment start smoke: **not run**; current live contract remains old.
- Authorized Product playback start/mid/end: **not run**.
- New 60-minute pre-soak: **not started**, actual duration **0 minutes**, expected scheduled checkpoints **60 minimum**, recorded **0**; missing/delayed/duplicate/drift statistics are **not applicable** because the clock never started.
- DVR/Tapo relay/session/transport/recovery deltas, Connector classified health failures, AI progress, resource trends, acknowledged loss, duplicate effects, cross-tenant leakage, and manual interventions for the post-fix interval: **not measured**. Do not report zeros as observed pass results.
- Internal HIGH/CRITICAL qualification blockers remain the three R2–R4 items in the PUSH 38 root-cause register. R5 monitor reliability remains unqualified over real 60 minutes. Nothing is relabeled external.
- V8: **NO START**, no start/completion timestamps. V7 remains failed and separately frozen.

## Required safe continuation

1. Establish an authorized signed Gateway and Connector release for the exact PUSH 38 branch commit, with explicit version/build SHA/profile/architecture and trusted verification key; verify its manifest/artifact and compatibility independently of a caller-supplied URL/version.
2. For each installed device, establish and verify a real recoverable known-good package/slot and health-tested rollback procedure **before** updating. Preserve device identity, Site/source IDs, Keychain credentials, queue and configuration outside the slot. Do not manufacture a known-good label for an unverified current runtime.
3. Stage one component at a time using the trusted update adapter; verify exact live runtime/build/contract and camera progress after each. Abort and recover if any smoke gate fails.
4. Capture authorized Product DVR/Tapo playback and AI/queue/worker start gates; then run a fresh >=60-minute anchored-cadence pre-soak with separate v7/v8 evidence locations. Only if every gate passes may a new v8 24-hour clock begin.

PR #28 must remain draft and unmerged until successful v8 evidence plus required checks. Do not start PUSH 39.

## PUSH 38E addendum

Restricted code-only baseline candidates were captured and tested for file integrity and isolated legacy health startup. They are **unsigned and unregistered**; the Connector app also fails macOS strict code-signature verification at the original installation. The generic OTA manager cannot safely create known-good from `development`/`unknown` metadata and an empty slot. See `DIGITAL_OBSERVER_PUSH_38_OTA_BOOTSTRAP_REPORT.md` and `DIGITAL_OBSERVER_PUSH_38_KNOWN_GOOD_BASELINES.md`. No live bootstrap or remediation deployment occurred; this pre-soak gate remains failed.

## PUSH 38F addendum

The two candidates are now signed and artifact-verified **in QA only**, and the empty-slot trust bypass was removed from the OTA agent. Full legacy-artifact rollback, an installed-runtime adapter, approved live trust-key distribution, Connector release QA build and remediation artifacts remain gating work. No live bootstrap, runtime deployment, 60-minute pre-soak or v8 occurred. The prior PUSH 38E paragraph describes the historical state at that time, not the current QA-signing status.
