# Encrypted isolated restore destination — synthetic architecture qualification

**2026-10-27 22:03 Asia/Jerusalem.** Owner/team scope: architecture gate only, synthetic sentinel data, no backup capture or restore of Development data. Result: **synthetic encrypted-destination architecture PASS with a guest-network residual; real-data restore NOT QUALIFIED**. This is not a Development database, Auth, Storage, or backup recovery PASS.

## Exact source and destination

- Cached local Lima base image: `/Volumes/DIGITAL_OBSERVER/Development/gan-batuach/cache/caches/b0992ab88f5a3c0c436bbb3065c01466f20dc1dd0eb0a60299d410176f21a1c3`; SHA-256 `1fc0354f4f99734ce3886628cc7af8b0437c1a1d391b126bd09cba0df35ee53f`. No OS image download was performed.
- Generic cached PostgreSQL image: `public.ecr.aws/supabase/postgres:17.6.1.167`, image ID `sha256:6942962433a569e87f228b4d4ab7e11db5deca64e43babb3a038443ad6c4f1bb`. The Docker CLI read/exported **only that cached image** from the `colima-gbi` Unix socket. It did not mount or export any original Docker volume or container filesystem.
- Last disposable encrypted target: `/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/worktrees/event-risk-effect-acl-review/.restore-architecture-qa.zV7pzQ/target.sparsebundle`, a new 8-GiB-maximum AES-256 APFS sparsebundle on Kingston. The mountpoint was a new private `/private/tmp/do-restore-qa.*` directory. Both target and mountpoint were removed after the test. The older empty 4-GiB prospective restore image was **not** opened or changed. The owner-held `age` identity was not read, copied, or used.

## Measured isolation and behavior

`run-isolated-encrypted-restore-architecture-qa.mjs` generated a fresh scratch-only random passphrase in process memory, created and attached the image with `-owners on`, and required macOS to report both encryption and `Owners: Enabled`. `LIMA_HOME`, the new VM configuration and the new VM disk were all inside that mounted encrypted image. The fresh Lima guest had **zero host virtiofs mounts** and zero pre-existing Docker volumes. It shared no original `gbi`/LOCAL_SUPABASE volume. It used the local cached base image and no remote pull.

The generic PostgreSQL image was transferred by local Lima copy, not a host-directory bind. Two new guest Docker volumes, `qa_pgdata` and `qa_storage`, were the **only** volumes present. PostgreSQL reported version **17.6** and returned the inserted synthetic `qa_sentinel` value. The separate Storage dummy object returned its synthetic content. Both serving containers were started with `--network none` and `--pull never`; Docker inspection confirmed `NetworkMode=none` for each. No Production, Home, Guard, original database row, original Storage object, real `pg_dump`, or S1–S4 historical COUNT was accessed.

After the containers and guest stopped, the image was detached. The synthetic host sentinel, Lima home/disk and cached-image tar were inaccessible at the former mountpoint. The test removed only its own scratch image and private mountpoint; a subsequent `hdiutil info` and directory check showed no remaining QA mount or scratch target. No provider resource, S3 object, charge, service, migration, Git remote, or `main` change occurred. The only physical space used was temporary local sparse-image allocation, bounded by the 8-GiB image maximum and released at cleanup.

## Explicit limit and next gate

The guest itself had a default network route even though **both data containers had no network**. Therefore this is not proof of a guest-wide airgap. Before any real Development data is copied into such a guest, enforce and verify a guest-wide no-egress boundary (or formally constrain all real-data handling to inspected networkless containers), then recheck exact scratch/canonical path separation, free-space reserve, recovery-key custody and the existing conditional backup authorization. This test does **not** authorize backup capture, use the existing 4-GiB image, or claim an independently recoverable backup. It only removes the previous host-APFS/virtiofs *architecture* uncertainty for synthetic data. No new owner input was needed for this architecture test; the next real-data operation belongs to the separately authorized backup workflow and its remaining safety gates.

Automation `automation-7` was inspected: it produces a six-hour read-only status summary, not an overlapping restore operation. This receipt is local review-only evidence on `codex/event-risk-effect-acl-review-20261026`; no remote push or PR update was made under this unit's explicit boundary.
