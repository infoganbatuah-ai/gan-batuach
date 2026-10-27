# Encrypted restore guest egress — synthetic runtime qualification

**2026-10-27 22:11 Asia/Jerusalem.** Follow-up to commit `ccb1690c040d32f3e62712138c63d55048ef90b8`. Scope: new disposable encrypted Lima guest and synthetic sentinels only. **Bounded runtime no-new-egress PASS; reboot/real-data no-egress BLOCKED.** No backup capture or Development restore was attempted.

## Exact isolation and test

The source OS remained the cached local Lima image at `/Volumes/DIGITAL_OBSERVER/Development/gan-batuach/cache/caches/b0992ab88f5a3c0c436bbb3065c01466f20dc1dd0eb0a60299d410176f21a1c3` (SHA-256 `1fc0354f4f99734ce3886628cc7af8b0437c1a1d391b126bd09cba0df35ee53f`). The only imported container image was the cached generic PostgreSQL 17.6 image with ID `sha256:6942962433a569e87f228b4d4ab7e11db5deca64e43babb3a038443ad6c4f1bb`. The last disposable target was `/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/worktrees/event-risk-effect-acl-review/.restore-architecture-qa.Mhp4zK/target.sparsebundle`; it was an 8-GiB-maximum AES-256 APFS image with ownership enabled, and was detached and deleted. The existing separate 4-GiB image and owner-held `age` identity were untouched.

The runner first started the separate Lima guest with its home and VM disk **inside** that encrypted image, no host mounts and no pre-existing Docker volumes. The guest initially had a default route—this is the exact earlier gap. **Before placing any PostgreSQL or Storage sentinel in the guest**, it started only the scratch guest's local Docker daemon and installed guest-local firewall rules:

- IPv4 `OUTPUT` default `DROP`; only loopback and established TCP replies from the guest SSH port to the exact current Mac management peer were allowed.
- IPv6 `OUTPUT` default `DROP`; only loopback was allowed.
- First IPv4 and IPv6 `FORWARD` rule: `DROP`, before Docker forwarding rules.
- No DNS allow rule and no new outbound connection rule to host-shared or Internet destinations.

The runner asserted both baseline `OUTPUT ACCEPT` states before mutation, then verified the exact fail-closed rules **before** copying the cached PostgreSQL image and **again after** the synthetic workload. A new host management shell succeeded under the policy. These are local firewall/route inspections; the test did **not** send a probe packet or content to any external address. The VM's default route remained present, but the inspected `OUTPUT`/`FORWARD` policy denied new egress. Both PostgreSQL and Storage containers independently reported Docker `NetworkMode=none` and used `--pull never`. PostgreSQL 17.6 returned the inserted synthetic row; the Storage dummy object was read back. The only guest volumes were `qa_pgdata` and `qa_storage`, not any `gbi`/LOCAL_SUPABASE volume.

The guest and containers stopped, the encrypted image detached, and the sentinel, Lima home/disk and local image tar were inaccessible at the former mountpoint. The scratch image and mountpoint were deleted. Subsequent checks found no QA image mounted or scratch directory. `colima list` still showed the pre-existing `gbi` and `push38t` Broken states; neither profile was started or repaired. No Mac firewall, route, DNS, shared network, original volume, Production, Home, provider, S3, Guard, `main`, or real database was changed.

## Stop condition for real data

The firewall is **temporary**. A guest-only emergency rollback timer would restore `OUTPUT ACCEPT` after 180 seconds if the disposable VM were stranded, and no reboot-survival test was run. Initial boot before the firewall was installed also had a route, although no Development data was present. Therefore this runner is **not suitable for real Development data** as-is and does not upgrade backup/restore readiness. The precise next technical gate is a guest-local, fail-closed policy effective before any real data is introduced and maintained across reboot (or a hypervisor-level no-NIC design), with verified IPv4/IPv6/DNS/forward denial and a safe host-only management path. Do not leave a timer that can reopen egress while real data remains mounted. Re-qualify the exact final runner before using the separately authorized bounded backup workflow; do not infer permission for `pg_dump`, restore, or use of the existing 4-GiB image from this synthetic test.

Automation `automation-7` remains a six-hour read-only development summary, not a competing restore task. This is review-only local evidence on `codex/event-risk-effect-acl-review-20261026`; no push/PR or remote CI was performed.
