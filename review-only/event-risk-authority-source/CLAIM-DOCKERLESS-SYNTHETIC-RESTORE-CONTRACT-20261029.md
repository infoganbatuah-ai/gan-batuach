# Dockerless synthetic restore contract — review only

Scope: static inspection of `run-isolated-encrypted-restore-architecture-qa.mjs` and deterministic local transition tests. No guest, Docker, PostgreSQL, SQL, archive transfer, decryption, existing database, or real restore was run. This module is not imported by the executable runner. Its fixture booleans are *not* measured guest evidence.

## Exact Docker dependency map

| Restore stage in existing runner | Docker dependency | Future guest-local replacement contract |
| --- | --- | --- |
| Pre-transfer source and guest checks (lines 22–34, 552–668) | Requires `docker` or `postgres` command, then configures/starts Docker before egress lock; later `image load` and inspect | Independently verify source digest and attestation, prove no host mounts or existing volumes, enforce and probe persistent IPv4/IPv6/DNS egress denial **before any archive transfer**. Extract only with a separately approved real-QA extractor into private encrypted guest scratch. No fallback to host package download. |
| Synthetic source and restart sentinel (lines 672–770) | Docker volumes, root `chown`, nonroot `initdb/postgres`, `--network none`, `pg_isready`, storage container, volume persistence and reboot | Newly created guest-local directories, private ownership and capacity check, PostgreSQL nonroot service with Unix socket only and `listen_addresses=''`; no connection to an existing database or shared host path. Prove restart persistence and egress lock again in the guest. |
| Five component capture/transfer (lines 303–413) | `docker exec` to create synthetic databases and produce three `pg_dump -Fc`, `pg_dumpall --globals-only`, storage tar; `limactl copy` of plaintext to guest | Keep the existing component receipt and ciphertext checks. In a future authorized guest, stage only authenticated synthetic components in private encrypted scratch after the egress gate; no host mount and no original/owner identity. Guest-local plaintext must be mode-restricted and removed on every exit. |
| Restore and verification (lines 172–258) | Docker target volumes/containers, `psql`, `createdb`, `pg_restore`, tar; SQL checks for Auth, roles/grants, RLS, migrations, storage metadata vs bytes | Create three **new** synthetic database targets; restore globals then three custom dumps transactionally, storage bytes separately, and check exact identities, role/ACL, Auth, RLS, migration and object-byte consistency. Model A Tenant/Site and recipient receipt must remain separate; no role substitution or changed recipient. |
| Fault and cleanup (lines 259–300, 413–455, 798 onward) | Docker fault volume/container, stop/remove/list; guest plaintext deletion, scratch unmount/removal | On any failure, stop PostgreSQL, remove only newly created synthetic targets and plaintext stage, verify no residual DB/volume/files; preserve failure code and never call the result PASS. A failed cleanup leaves the run blocked, not ready for retry. |

## Locally implemented review-only ordering

`dockerless-synthetic-restore-contract.mjs` accepts only synthetic-fixture evidence. It enforces source digest and exactly five named components; no-host-mount/new-guest proof; persistent egress denial before archive staging; private new scratch; nonroot Unix-socket PostgreSQL with no existing DB; authenticated five-component recipient match; globals, three databases, storage bytes; Model A Tenant/Site/Auth/ACL checks; receipt comparison; and verified cleanup. Failure transitions require cleanup and cannot resume processing. Terminal values explicitly say **not restore PASS**. `activateRealDockerlessRestore()` always throws.

The existing original Development recipient fingerprint in `component-restore-preflight.mjs` is not the synthetic recipient used by this contract. Neither is an owner key. The contract does not transform fixture assertions into measured attestation, PostgreSQL behavior, or recovery proof.

## Concrete remaining gates

1. `synthetic-qa-image-input.mjs` keeps the QA attestor pin null; `synthetic-rootfs-extractor.py` keeps `APPROVED_REAL_QA_EXTRACTOR = None`. The real runner therefore fails before guest work. Approve and independently verify the attestor and real extraction boundary before any materialization.
2. The approved guest image does not itself contain the required PostgreSQL runtime. A guest-local, Dockerless nonroot binary/ownership/socket implementation must be qualified against the pinned image and isolated guest; static tests cannot prove it. Do not use a host install or external download as a shortcut.
3. A future guest test must measure egress lock before transfer, no host mounts, new scratch/DB, five authenticated components, role/RLS/Model A ownership and recipient receipt, fault cleanup, and restart persistence. The current 9 local fixture tests prove only transition ordering/rejection.
4. Real archive, owner recovery identity, independent Development restore, and component coherence remain outside this offline unit. Status remains `COMPONENT_BACKUPS_ONLY`; independent restore `NOT_RUN`.

No migration, provider, Guard/Native, retention, Production, main, or remote Git change is included.
