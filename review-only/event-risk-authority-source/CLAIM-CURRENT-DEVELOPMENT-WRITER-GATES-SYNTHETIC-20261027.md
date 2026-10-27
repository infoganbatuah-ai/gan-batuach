# Current Development writer gates — isolated synthetic qualification

**2026-10-27, Asia/Jerusalem. Scope:** read-only identification of the original `gbi` plus a disposable, no-mount/no-port-forward Lima guest on Kingston. No original Development service, network rule, database, volume, backup, cloud resource, Production or Home service was changed. This is **not** an authorization or proof of source quiescence.

## Correction of source identity

There are two distinct Colima homes with a profile named `gbi`. The default Mac-home profile is not the Development source. The canonical external profile, selected by `COLIMA_HOME=/Volumes/DIGITAL_OBSERVER/Development/gan-batuach/colima`, reports **Running** (4 CPUs, 4 GiB, 35 GiB, Docker). Read-only access through its Lima SSH and through `unix:///Volumes/DIGITAL_OBSERVER/Development/gan-batuach/colima/gbi/docker.sock` returned the identical Docker daemon ID `cb406f3c-6987-4019-8ac7-bed803bf6a37`, name `colima-gbi`, and eight running containers. Thus an alternate **client/control path** exists today. It does not protect against failure of the guest Docker daemon itself. Earlier `Broken` statements are corrected in the two prior review-only receipts; no VM was restarted or repaired.

## Disposable synthetic test

Runner: `run-isolated-writer-gate-qa.mjs`. It created a new Lima VM in a unique `.wg.*` directory under the Kingston project root, using a cached local base image, `mounts: []`, `networks: []`, `portForwards: []` and no host resolver. Its Docker daemon ID differed from the source daemon. It copied only the already-cached PostgreSQL **image**, not source data or volumes, into the scratch guest; the test container used `--network none` and ran only `sleep`.

| Gate | Observed result | Limit |
|---|---|---|
| Resume exact paused container when host primary Docker socket is unavailable | **Synthetic PASS.** A guest-local `systemd-run --on-active=5s` unpaused the pinned disposable container after the host client was pointed to a nonexistent socket. | This was not a Docker-daemon outage, source-gbi service pause, or source rollback proof. A daemon failure can defeat both host-socket and Lima-SSH Docker commands. |
| Deny new API-analog and direct-DB-analog TCP clients throughout barrier | **Synthetic PASS.** Two guest-local TCP listeners were reachable first, denied on three consecutive checks during guest-only loopback `iptables` rules, then reachable again after exact-rule removal. | This tested new TCP connects to two synthetic ports for ~3 seconds. It does not close existing connections, Unix sockets, Docker exec/volume access, scheduled DB writers, forwarded host ports or future external clients on gbi. |
| Isolation and cleanup | **PASS.** No source mounts or port forwards; distinct daemon; disposable container, timers, VM instance and exact scratch directory removed. | The test is not evidence of a real backup or restore. |

Runner returned `SYNTHETIC_PASS_REAL_GBI_NOT_TESTED` with `scratchCleaned:true`. No source database SQL was executed, no S1–S4 checks were run, and no backup data was produced.

## Decision and exact next gate

**Real writer exclusion: BLOCKED / not executed.** The synthetic connection gate is a plausible primitive, but a source capture would require a positively verified barrier for both new *and existing* REST/Auth/Storage/Realtime/host-DB clients, plus any in-database or Docker-admin writer, for the entire capture. Blocking two ports alone is insufficient. The source Docker bridge is not `internal`, and loopback `55421`/`55422` are separate entry points. No source firewall or service pause was applied.

**Source auto-resume: BLOCKED / not executed.** Lima SSH to the exact source daemon is verified and the guest-local timer pattern passed only in the disposable guest. Before quiescence, the source plan must pin seven full container IDs, install and verify a bounded guest-local resume mechanism with an independent failure trigger and exact cleanup, and define the Docker-daemon-failure escape path. Do not treat a human-command fallback as automatic resume.

**Next executable technical step:** design and statically validate a fail-closed, source-specific, time-bounded writer-barrier/resume procedure from the exact ingress and connection inventory, then separately qualify it without touching the original database or services. Do not begin a quiescent capture or claim a current backup until the real source gate and its rollback are authorized and proven. The previously failed encrypted captures remain failed; no partial archive was retained.
