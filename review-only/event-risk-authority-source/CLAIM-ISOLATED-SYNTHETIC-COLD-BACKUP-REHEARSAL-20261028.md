# Isolated synthetic cold-backup rehearsal — 2026-10-28

Scope: one disposable, synthetic-only rehearsal. This is **not** a capture, restore, or downtime authorization for the original Development `gbi` VM. No owner recovery identity was read or used. No SQL was run against original Development or Production.

## Execution and result

Runner: `run-isolated-cold-backup-rehearsal-qa.mjs` on local branch `codex/event-risk-effect-acl-review-20261026`, based on `a5b6f487c85058ae30ab3cc5b1d5830588711673`. Exact output status: `PASS`; all cleanup assertions passed.

| Gate | Observed result |
| --- | --- |
| Source and destination isolation | Two different disposable Lima guests, each with its disk inside a separate AES-256 encrypted APFS sparsebundle; no host mounts or port forwards; guest IPv4/IPv6 output default-drop; test containers `--network none`. |
| Synthetic service inventory | Seven distinct full Docker container IDs running before stop; one PostgreSQL service, one Storage-mounted dummy service and five other dummy services. |
| Dependency-ordered cold stop | Six non-database services stopped first, PostgreSQL last. All seven inspected stopped; no running container in the disposable source guest; PostgreSQL execution unavailable at export. |
| Encrypted export | Both synthetic Docker volumes exported together as a tar stream directly into `age` ciphertext. Disposable age identity stored only in the encrypted test mount, then removed; no plaintext archive file. |
| Ciphertext cap and disk floor | Ciphertext **40,785,832 bytes**, below **1,073,741,824-byte** cap. Minimum observed internal free **15,485,435,904 bytes**, above **3,221,225,472-byte** floor. The free-space and output-size monitors ran during export. |
| Ciphertext integrity | SHA-256 `5c5ec5bbbda2c58fd80f5956ba0c6ab7ed364eabc2d3422f095bbc34d0f03b09`; successful authenticated decrypt and tar inventory check. Ciphertext was disposable and removed at cleanup. |
| Daemon unavailable after stop | Docker service and socket deliberately stopped in the disposable source guest. Docker API request failed as expected. This is a **negative** availability observation, not evidence that rollback can run while the daemon is unavailable. |
| Recovery after daemon restoration | Docker service/socket restored; all seven **same full IDs** restarted; original synthetic PostgreSQL row and Storage object remained readable. No automatic recovery during daemon outage was proven. |
| Separate encrypted restore | Ciphertext decrypted by pipe into fresh volumes in a second, independently encrypted disposable guest. Restored PostgreSQL row and Storage object were both read and matched the synthetic originals. |
| Cleanup | Seven disposable source containers, destination container, volumes, guests, sparsebundles, disposable age identity and ciphertext removed. No matching scratch directories or mounted images remained. |
| Original `gbi` | Only the cached PostgreSQL image was inspected and saved read-only. A post-test read-only listing showed the original Development Supabase services still running, including healthy DB/Auth/Storage. No original service was stopped, paused or restarted. |

## Source decision

The rehearsal establishes that the **synthetic** cold-stop/export/restart/decrypt/restore procedure can succeed within its 1-GiB ciphertext cap. It does not establish that the **current original** Development volumes fit the cap, that their live writes can be quiesced safely, or that an independently recoverable up-to-date source rollback exists. The previous source-volume and writer-control NO-GO findings in `CLAIM-CURRENT-DEVELOPMENT-COLD-BACKUP-GO-NOGO-20261027.md` remain open. No original downtime should be scheduled solely from this result.

The precise residual fault boundary is Docker-daemon unavailability: exact-ID restart **cannot be performed while the daemon is unavailable**; it succeeded only after the disposable daemon was restored. A source rollback plan must include a validated daemon recovery path and must not claim automatic restart during outage.

No external backup upload, provider change, source SQL, source capture, source restore, or Production/Home/Main change occurred. This evidence is local-only and not PostgreSQL crash-durability proof for original data.
