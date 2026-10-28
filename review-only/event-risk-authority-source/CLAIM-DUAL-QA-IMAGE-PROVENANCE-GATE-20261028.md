# Dual QA image provenance gate — offline correction

Date: 2026-10-28 (Asia/Jerusalem). Branch: `codex/event-risk-effect-acl-review-20261026`. This supersedes the image-input readiness statement in `CLAIM-INDEPENDENT-SYNTHETIC-IMAGE-INPUT-PREP-20261028.md`. It is review-only local preparation, not a guest restore or real Development backup restore.

## Corrections

- The synthetic guest runner no longer refers to the original Development cached Lima base image **or** the original `gbi` Docker socket. It requires two separately supplied local QA artifacts: an arm64 Lima base image and a `docker save` archive of the pinned PostgreSQL 17.6 image. Each path must be absolute, private, non-symlinked/non-hard-linked, outside the repository and original Development tree, no larger than 2 GiB, and match a supplied SHA-256. There is no fallback to the original tree or network pull.
- A future signed provenance receipt must bind the **measured digest and byte count of both images**, the exact PostgreSQL image ID, synthetic-only purpose, no Development/Production data, independent QA environment, and an expiration no more than 24 hours after issuance. It uses a detached Ed25519 signature verified against a separately reviewed, pinned public key and SPKI digest. A caller-supplied key cannot establish authority.
- **No independently verified QA attestor public key is pinned yet.** Both production constants are deliberately `null`; the runner rejects `QA_ATTESTOR_NOT_PINNED` before it reads either image or creates scratch. A SHA-256 value alone never passes the provenance gate. A signed statement from a trusted attestor is evidence of that attestor's assertion, not independent forensic proof of how an image was made.
- When a future authorized attestor and artifacts exist, the runner would stage the base image into the AES-256 scratch mount and rehash it before Lima uses it. The PostgreSQL archive is copied and rehashed only after host-mount/proxy/egress checks. The 12-GiB scratch capacity gate reserves both PostgreSQL copies, the base image, 6 GiB guest disk and 1 GiB margin. Guest image ID/version and `--pull never` remain required.

## Tests and evidence boundary

- 47/47 focused local tests PASS, including missing one/both image arguments, wrong digests, oversized base image, symlink/hardlink/project-source denial, absent/forged/expired/mismatched provenance, wrong attestor key pin, and controller NO-GO without fresh guest proof. JavaScript syntax and diff integrity passed.
- Source inspection confirms no path to `/Volumes/DIGITAL_OBSERVER/Development/gan-batuach` in this runner, no `gbi` socket, no Docker image export, and no network pull. This does not prove runtime isolation or provenance of future artifacts.
- The previously rejected guest script was **not run or retried**, no escalation was requested, no image was produced from the original environment, and no original receipt/age/key was accessed. Integrated guest = **BLOCKED / NOT RUN**. Real backup remains `COMPONENT_BACKUPS_ONLY`, `independentRestore=NOT_RUN`; no cross-store atomicity or current rollback proof.

## Exact next dependency

An approved independent synthetic QA source must provide both image files, exact SHA-256/byte counts, and a short-lived signed provenance receipt. The owner/coordinator must independently verify and approve the attestor's Ed25519 public key fingerprint before a reviewed commit pins it. Even then, running the guest requires a separate policy-compliant environment/approval; the prior auto-review rejection must not be bypassed. No owner recovery key is needed for this synthetic step.

No database SQL, Production/Home, provider change, paid service, remote push, or main change occurred.

## 2026-10-29 offline ARM64 Docker-save correction

- The independently supplied public QA archive measured **1,330,063,360 bytes**, SHA-256 `51c3b993f6ec02b579665fcd56c4f126107dd474e97f6fcf723e66c703c30e27`. Its exact `public.ecr.aws/supabase/postgres:17.6.1.167` ARM64 config hashes to image ID `sha256:ed2c675a446d78a346e88f18afb6ae0cf46f64251f8c9186446bdf1526dd3655`. The QA input pin now uses this ID; the different original Development cached-image ID remains unchanged in historical/current-source tools.
- An offline, non-extracting Docker-save parser verified one exact tag, Linux/ARM64 config, 29 ordered layers and every uncompressed layer SHA-256 against the 29 `rootfs.diff_ids`. The original compressed OCI blobs are **not** in Docker-save; their compressed registry digests cannot be recomputed from this archive. The separately provided raw ARM64 manifest hashes to `sha256:e3fb2c4a4376423f4eb1f1b1d87490a4ec23bdcdb97d3fc29e691f5a3c4abd9d`, but this local hash is not an independent live registry retrieval.
- The Ubuntu ARM64 base input measured **616,522,752 bytes**, SHA-256 `50e24e1fb79e89116e939d90aa7738f7af48c442fa1bc2510131e0b39c50348e`. The digest appears in the local Ubuntu `SHA256SUMS`; `gpgv` reports a valid signature from the UEC image key fingerprint `D2EB44626FDDC30B513D5BB71A5D6C4C7DB87C81`. This verifies the local signature against the supplied keyring, not independent key custody.
- The runner still calls `assertQaAttestorPinned()` before either artifact read or scratch creation. The attestor constants remain `null`, so guest execution, Docker image load and integrated restore are **NOT RUN**. Artifact format/digest qualification does not change real-backup status `COMPONENT_BACKUPS_ONLY` or `independentRestore=NOT_RUN`.
