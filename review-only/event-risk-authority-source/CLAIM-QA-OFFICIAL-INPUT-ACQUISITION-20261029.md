# Official public QA inputs: local acquisition and offline-disk receipt

Date: 2026-10-29. Branch: `codex/event-risk-effect-acl-review-20261026`. This supersedes only the *input-residency* blocker in `CLAIM-QA-OFFLINE-INPUT-RESIDENCY-20261029.md`; the earlier receipt remains an accurate record of the prior File Provider placeholders. The owner separately approved bounded downloads of these exact two public QA artifacts. No guest, existing Development VM/database, backup, Colima, Docker, SQL, Production or Home service was used.

## Source and measured bytes

Private scratch: `/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/.qa-offline-vz-zbBWgKws` on Kingston APFS. Directory mode `0700`; source and RAW files mode `0600`, final ISO mode `0400`. The volume has the macOS `noowners` mount flag, so Unix ownership/mode alone must not be treated as a strong secrecy boundary. These inputs are public; no private key or project data was placed in the offline image. The short-lived anonymous ECR bearer-token file was removed after acquisition. The original dataless placeholders were not modified.

| Artifact | Measured bytes | Fresh SHA-256 | Verification |
| --- | ---: | --- | --- |
| `ubuntu-24.04-server-cloudimg-arm64.img` | 616,522,752 | `50e24e1fb79e89116e939d90aa7738f7af48c442fa1bc2510131e0b39c50348e` | Official Ubuntu Noble ARM64 cloud image; detached `SHA256SUMS.gpg` validated with `gpgv`; signer fingerprint `D2EB44626FDDC30B513D5BB71A5D6C4C7DB87C81`; exact signed checksum matched local bytes. |
| `supabase-postgres-arm64-docker-save.tar` | 1,330,063,360 | `51c3b993f6ec02b579665fcd56c4f126107dd474e97f6fcf723e66c703c30e27` | Reconstructed from public ECR `supabase/postgres:17.6.1.167`, exact ARM64 OCI manifest digest `sha256:e3fb2c4a4376423f4eb1f1b1d87490a4ec23bdcdb97d3fc29e691f5a3c4abd9d`, config digest `sha256:ed2c675a446d78a346e88f18afb6ae0cf46f64251f8c9186446bdf1526dd3655`; all 29 compressed layer digests, sizes and decompressed diff IDs verified; final tar matches the pre-recorded archive length and SHA. |
| `ubuntu-qa-boot.raw` | 3,758,096,384 logical | `70c4b0a60310b3a995a359b2a85258590608057f90b81567bbe27ac650aa00f4` | Narrow QCOW2-v3 converter accepted the exact pinned source, verified its full SHA before writing, converted compressed and ordinary clusters to a disposable sparse RAW boot disk, and verified full RAW readback. No guest boot or independent `qemu-img` comparison. |
| `offline-qa-inputs.iso` | 1,947,686,912 | `c3bc6ba91070169e485df78b3e2ec56f581eafcc007f31888f58a7297d193edb` | Hybrid ISO9660/Joliet/UDF image built from the two approved files and a non-secret `SHA256SUMS` only. `bsdtar` enumerated exactly those three entries; both file byte streams extracted from the ISO hashed to the pinned values. |

The Ubuntu image and rebuilt PostgreSQL archive are each below the authorized 2 GiB per-artifact ceiling. The offline disk is a local preparation artifact, not an AWS/S3 object or a backup of Development data. Its three entries are public QA inputs; no ECR token, keyring, certificate private key, Supabase credential or project data is included.

## Verification and remaining boundary

Focused converter tests: 6/6 PASS. Focused OCI acquisition boundary tests: 3/3 PASS. The actual file hashes, GPG signature, OCI digests/diff IDs and extracted ISO hashes were checked in this unit. `git diff --check` passed. The official QEMU QCOW2 format specification informed the bounded parser, but `qemu-img` is unavailable; therefore boot compatibility and byte-for-byte equivalence to QEMU conversion remain **NOT PROVEN**. The public ECR manifest was authenticated by HTTPS and pinned digest, not a separately verified vendor signature. These are QA input checks, not PostgreSQL restore or event-risk database proof.

The future Apple Virtualization guest contract still requires the disposable RAW boot disk to be writable and this offline ISO to be attached **read-only**. That contract has not been exercised: no VM was created or started, no offline guest test ran, and no output was recovered. No permission to start a guest or access the canonical Development database is inferred from this receipt.
