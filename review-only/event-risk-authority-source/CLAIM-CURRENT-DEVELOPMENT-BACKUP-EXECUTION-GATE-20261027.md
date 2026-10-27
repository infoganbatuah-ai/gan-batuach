# Current Development logical backup — execution gate receipt

**2026-10-27 19:32 UTC.** Owner authorization for a bounded local encrypted logical backup and isolated encrypted restore was verified in the coordination chat. This receipt records execution preconditions, **not** a backup or restore PASS.

## Verified source and preservation

- The original `gbi` Development Docker context is healthy. Its original Supabase PostgreSQL 17.6 container retains the prior project label, loopback-only database port, and named data volume. Seven Development Supabase containers were running/healthy. No replacement database or Production endpoint was used.
- The established public `age` recipient matches the previous encrypted VM-safety manifest exactly (public-recipient SHA-256: `1fc9645eff132753e75a26eb0856b6f9abe0a26af6002625346832a8a89d97b4`). The 2026-10-22 recovery receipt records an owner-note independent decryption of the earlier VM archive. The temporary Mac private-identity file from that work is no longer present; current ability to decrypt using the owner-held identity is **not freshly verified**.
- No user rows, object bytes, migration-history counts, or S1–S4 historical COUNT queries were read in this execution attempt. No `pg_dump`, SQL mutation, schema change, original-volume replacement, or cloud operation was performed.

## Storage and isolation gates

- Internal free space started at 4,239,500 KiB, then unexpectedly declined to 2,159,428 KiB, below the required 3 GiB reserve. Capture was **not started**.
- An inactive VS Code updater staging cache (1,468,136 KiB, last modified 2026-10-23) had zero open files. A `ditto` copy to a dedicated recoverable-cache directory on the external Development drive passed `diff -qr`. Only the original updater staging cache was then removed. Its identical external copy remains available for recovery. Internal free space rose to **3,630,732 KiB**. This is cache relocation, not a Development backup.
- A new, empty, AES-256 encrypted 4 GiB-maximum sparsebundle was created on the external drive as a disjoint prospective restore target. macOS filesystem ownership was enabled **on this new image only**. It is now safely detached. The image contains no restored data. Its passphrase is stored only in a small `age`-encrypted file under the designated internal backup directory; no passphrase was printed.
- Actual visibility of an encrypted host-mounted restore volume inside an isolated PostgreSQL container is **not proven**. The running original `gbi` VM showed the user's home share, not the configured external Development path. The owner-held `age` identity would be needed to remount the currently detached image from its encrypted passphrase file; no local private key was used or exported.
- The encrypted archive directory currently contains **no Development backup**. The 1 GiB cumulative-file and 3 GiB free-space gates therefore remain unconsumed, not passed for a capture.

## Decision and exact remaining gate

**Capture and isolated restore remain BLOCKED.** The independently held `age` private identity must be made available for a one-time local decrypt-and-restore verification without logging or persisting it, and the isolated encrypted restore mount/container boundary must be demonstrated before capture. Recheck the 3 GiB reserve immediately before and during any future bounded capture. Do not relax the conditional owner authorization, treat the empty encrypted image as a backup, or use Kingston's ordinary `noowners` filesystem for plaintext restore.

Original Development, Production, Home services, Git history, `main`, provider resources, and Guard were not modified. The only deleted material was the verified duplicate VS Code updater staging cache; an identical external copy remains.
