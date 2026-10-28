# Encrypted isolated guest: synthetic PostgreSQL and Storage restore

**2026-10-28, review-only. Result: synthetic restore mechanics PASS; five-age-archive end-to-end and real Development restore NOT RUN.** The current original `gbi` component capture remains `COMPONENT_BACKUPS_ONLY`. No original receipt/ciphertext, owner age identity, Notes or clipboard was opened in this unit.

## New measured result

The existing disposable, AES-256 encrypted sparsebundle/Lima guest probe was extended, not replaced. The guest still has no host mounts, inherited proxy, original source volume or Production volume. Before synthetic data and again after reboot, its default-DROP IPv4/IPv6 OUTPUT/FORWARD policies and negative IPv4/IPv6/DNS probes passed; neither guest data container had a network. The egress lock was reapplied before a boot default route appeared.

After reboot, the probe used PostgreSQL 17.6 `pg_dump -Fc` from the synthetic source container and `pg_restore --exit-on-error` into a **new, separate** `qa_restored_pgdata` volume and PostgreSQL container. A SQL read in that restored synthetic container matched the original sentinel. The transfer was a guest-internal pipe with `pipefail`; no dump was staged on the Mac. A separate `qa_restored_storage` volume received a tar of the synthetic source Storage volume and its recovered object matched the sentinel. This tests actual PG custom-dump restore and Storage tar/extraction mechanics, not Auth, roles, RLS, migrations or real Storage metadata mapping.

The first extended run failed when a dump file expected inside the source container was absent; it returned `BLOCKED` and `scratchCleaned=true`. The transfer was changed to a guest-internal pipe, avoiding that file dependency. The next run returned `ARCHITECTURE_PROBE_PASS`, `postgresRestoredFromCustomDump=true`, `storageRestoredFromTar=true`, `sentinelRecoveredAfterReattach=true`, all egress/boundary flags true and `scratchCleaned=true`. A final checkout scan found zero `.restore-architecture-qa.*` directories. No live guest or partial scratch target was retained. The source Development VM was not changed.

## Remaining exact NO-GO

This is **not** the requested full five-archive age restore adapter. The synthetic PG dump and Storage tar were transported within the encrypted guest, but were not encrypted as five age components, authenticated/decrypted using the TTY→FD bridge, or compared against a component receipt. Globals and all three database names were not restored; no Auth/roles/RLS/migration/metadata-to-object verification occurred. The existing preflight controller's isolation proof is still supplied by a test adapter, not bound to this live guest. Fault injection for wrong key, ciphertext/tar corruption, lost egress policy and partial real restore cleanup has not been run in a concrete guest adapter; prior 24 tests covered only a fake adapter.

**Next engineering unit:** connect the proven guest lifecycle and its fresh in-process egress measurements to `component-restore-preflight.mjs`; within that encrypted guest, stage five **synthetic** age ciphertexts, feed a synthetic key by PTY/FD, authenticate/decrypt, run the existing Storage tar manifest gate before extraction, restore globals and all three database archives into new volumes, and inject the above faults with cleanup verification. Keep the direct real CLI disabled until that full synthetic path passes. Do not request owner key entry yet.

No source/Production/Home SQL write, original VM mutation, paid provider action, cloud upload, remote Git push or `main` change occurred.
