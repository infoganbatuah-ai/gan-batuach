# Isolated qualification — 2026-10-29

Source chat: `01a185d7-52b0-7e72-b066-6d0aa0b4a92c`; turn: `01a185d7-5722-7103-baef-bedee97aae13`.
Branch: `codex/isolated-qualification-20261029`, based on media preparation `c98f948f8547376c28d20ec3d77a20a60bf4d771`. Canonical AGENTS read from Kingston; SHA-256 `db95a84634fd1e4c76ca8d0b6f2ad69385ff47fd89a6b3852ea4a3dbb34e4eaf`.

Scope is evidence-only. No existing DB, Production/Development runtime, Docker daemon, camera, provider, owner age identity or actual backup was accessed. No VM is instantiated by this probe. No source disk is attached writable: only a newly copied, hash-verified scratch RAW is passed as writable. The public ISO is attached read-only by the existing native helper. This does not exercise a guest.

## Qualification disposition

| Gate | Disposition |
|---|---|
| Public input integrity | All four exact pinned SHA-256 values remeasured; see measurement.json. |
| Native disk attachment/configuration | FAIL CLOSED: signed native helper returned VZErrorDomain code 2: `Virtualization is not available on this hardware.` This establishes unavailability to this execution context, not a diagnosis of physical hardware. Both attachment constructors returned before config.validate rejected; guest attachment is NOT PROVEN. Unsigned attempt rejected with VZErrorDomain code 2 (missing virtualization entitlement); preserved separately. |
| Boot | NOT PROVEN; no VM created or started. |
| Extraction | FAIL CLOSED: `APPROVED_GUEST_ROOTFS_MATERIALIZER = null`; executable entrypoint throws `QA_ROOTFS_MATERIALIZER_DISABLED`. |
| Database restore | NOT RUN; boot/extractor/isolation prerequisites absent. |
| Storage restore | NOT RUN; no guest object bytes or restore evidence. |
| Authorization boundaries | 20/20 contract tests PASS; live guest PostgreSQL/RLS/tenant/site boundaries NOT PROVEN. |
| Restart durability | NOT RUN; no running guest or durable egress measurements. |
| Cleanup | Scratch RAW removed in finally; see measurement.json. No guest/DB/volume created. This is host probe cleanup only. |

The existing two-disk/no-serial/no-socket/no-share contract has no executable guest result channel. Ubuntu lacks Docker/PostgreSQL; the provided PostgreSQL image cannot be extracted with an unqualified host tar/chroot. No safety gate was removed to get a nominal success. No owner-key gate was reached; no owner action or key submission is requested.

## Reproducibility and failed attempts

`native-main.swift` calls the existing native construction helper and catches native validation errors; it contains no VM constructor/start. Compile with `swiftc -module-cache-path /private/tmp/do-qa-swift-cache review-only/event-risk-authority-source/no-nic-synthetic-guest-vz-preflight.swift /private/tmp/main.swift -o /private/tmp/do-qa-native-preflight`, with `native-main.swift` copied to that main.swift first. Execute `python3 docs/qualification/isolated-20261029/measure.py`.

The native helper was ad-hoc signed with `codesign --force --sign - --entitlements docs/qualification/isolated-20261029/virtualization.entitlements /private/tmp/do-qa-native-preflight` after the unsigned rejection; this grants the documented native framework capability and does not change the zero-device policy. The first measurement attempt rejected scratch because a full stat comparison included access time. Its receipt is retained in `measurement-first-atime-rejected.json`; scratch was removed. The corrected probe compares device/inode/size/mtime/ctime, and still hashes exact bytes. This host evidence tool is not a hardened guest extractor and is not permission to restore real data.

Boundary command: `node --test review-only/event-risk-authority-source/no-nic-synthetic-guest-preflight.test.mjs review-only/event-risk-authority-source/guest-rootfs-materialization-contract.test.mjs review-only/event-risk-authority-source/dockerless-synthetic-restore-contract.test.mjs`. First attempt: nine tests passed, two files failed to import missing local `tar`; retained in `boundary-tests.tap`. Retry used the existing canonical node_modules via a temporary local symlink (no install/download), and passed 20/20; `boundary-tests-retry.tap`. Symlink removed after use. Prior 11/11 Node, 4/4 Python incident tests and nine media tests were not repeated or relabeled as fresh results. No product code/schema changed; full release CI not run.

Disk: existing public input preparation directory measured 7,992,432 KiB allocated on Kingston. Scratch RAW logical size 3,758,096,384 bytes; actual allocation and host free bytes before/after in measurement.json. Compiler cache measured 63,276 KiB and executable 84 KiB before cleanup. Free-space deltas include concurrent host activity and are not exact task allocation.

## Bounded DVR evidence review

Read-only review of committed evidence from `79cc7b42`, preserved as `dvr-existing-observation.json`, introduces no live camera/Production contact. Channel 3 progressed in 12/21 checkpoints (lowest); channel 7 and 11 in 17/21; all ten progressed simultaneously only 5/21. This prioritizes channel 3 for a future separately scoped recorder/LAN/transcoder/relay investigation, but does not identify a cause. No timestamped synthetic transport replay/input is available in this unit; no live poll or camera command was attempted. TLS/auth recovery is not playback recovery. Product viewing remains unproven and PUSH 38 NOT DONE.

## Exact next engineering action

First provide an execution context where Apple VZ reports supported with the standard virtualization entitlement; do not bypass platform restrictions or reuse an existing live VM. Then implement and review a bounded offline guest control/result mechanism while retaining zero NICs and zero host shares; explicitly reconcile the existing exact-two-disk/no-serial contract before adding any device. Build fresh disposable encrypted guest storage and EFI variable store. Pin the guest script, measure actual guest NIC/routes/egress denial and read-only ISO behavior from boot through restart, and recover tamper-evident results. Only then qualify the guest-local no-follow OCI materializer against the 29 verified layers (links, whiteouts, privilege-bit stripping, limits, inode-specific cleanup), followed by fresh synthetic PostgreSQL/storage restores and live authorization checks. No real backup/key is required for these synthetic steps. Until then independent restore remains NOT RUN.

Preservation: local evidence commit only; remote push and canonical integration-ledger registration intentionally pending coordinator review. No main, integration or Production change.
