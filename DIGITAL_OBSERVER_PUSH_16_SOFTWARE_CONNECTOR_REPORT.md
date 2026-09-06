# DIGITAL OBSERVER — PUSH 16 SOFTWARE CONNECTOR REPORT

Date: 2026-09-06  
Production origin: `https://ganbatuach.com`  
Production revision: `2d3910a4df346fbdbcb83a1611b3562a4a28c452`  
Production deployment: `dpl_F6pC1R84uMHGmBm8Lt33BMA3NP77`

## FINAL STATUS

`FAIL — REAL CONNECTOR E2E`

The deployable Software Connector, shared edge core, secure enrollment, rotating device identity, heartbeat/config contract, command boundary, onboarding handoff, packaging, recovery foundations and Production lifecycle verification are complete.

The sole missing acceptance proof is a physical camera/DVR producing a real Event while bound to a distinct `SOFTWARE_CONNECTOR` identity. The only available physical source is the active home private DVR. A second concurrent login/binding could invalidate its current recorder session, compete for source ownership, or interrupt the ten healthy relays. That unsafe test was not performed and no mock/manual Event was substituted.

## EXISTING GATEWAY/CONNECTOR INVENTORY

| Component | Push 16 classification | Result |
|---|---|---|
| `services/video-gateway` server, relay, HLS and source anchors | Shared production core | Reused |
| Persistent home Gateway runner | Shared lifecycle runner | Hardened for both device types |
| Gateway device enrollment/refresh | Shared identity foundation | Extended with explicit device type/install/build identity |
| macOS Keychain | Production-proven Physical Gateway secret store | Preserved |
| Secure-volume secret store | Software Connector secret store | Added and QA-verified |
| Private DVR adapter | Production-verified real adapter | Preserved; optional channel/namespace isolation added |
| RTSP adapter/probe | Real-data capable | Reused; no independent real source available |
| ONVIF discovery | Contract/QA capable | Real-device validation still pending |
| Journal/outbox/evidence/local sampling | Shared production processing | Reused without a parallel Observer Core |
| Camera action runtime | Existing bounded runtime | Preserved |
| Software Connector deployment | Previously recommendation only | Now packaged and provisionable |

## SHARED CORE ARCHITECTURE

Both deployment types now execute the same runtime and contracts:

`Camera/DVR → canonical adapter/discovery → services/video-gateway → Journal/outbox → cloud Event pipeline`

`OBSERVER_EDGE_DEVICE_TYPE` selects `SOFTWARE_CONNECTOR` or `PHYSICAL_GATEWAY`; it does not fork Event, Incident, Evidence, Risk, Verification or product semantics. The new canonical contract is `observer-edge-runtime-v1`.

Connector responsibilities are local discovery, credential resolution, stream relay, health, lightweight existing preprocessing, native-event provenance forwarding and authenticated outbound communication. Tenant business logic and all canonical cloud intelligence remain server-side.

## CONNECTOR PACKAGE

- Production-like Dockerfile contains the complete shared runtime rather than only `server.mjs`.
- Container runs as the unprivileged `node` user.
- No host port is published by the supplied Compose deployment.
- Root filesystem is read-only; Linux capabilities are dropped; `no-new-privileges` is enabled.
- Persistent state/secrets use a dedicated volume; `/tmp` is bounded tmpfs.
- Healthcheck targets loopback only.
- A hardened systemd unit is provided for native Linux service deployment.
- Native CLI entry points exist for enrollment, completion, status, runtime and local uninstall.

Docker static/package QA passed. This workstation has no Docker executable, so an actual image build/runtime was not falsely claimed.

## SUPPORTED HOST STATUS

| Host | Status |
|---|---|
| Docker/Linux container | Package and contract QA passed; real Docker-host execution pending |
| Linux systemd | Unit/package ready; real Linux-host service QA pending |
| macOS | Shared core and Keychain path are proven by the Physical Gateway; isolated Software Connector server runtime passed locally |
| Windows | Not supported or validated |
| NAS/container hosts | Architecture-compatible where Docker is supported; vendor-specific NAS QA pending |

## PROVISIONING

Implemented flow:

`install → stable local installation ID → enrollment request → authorized site approval → one-time credential delivery → rotating refresh identity → heartbeat`

Production QA created an ephemeral Software Connector, bound it to an authorized isolated QA home site, accepted heartbeat, rotated refresh material using protocol v2, revoked it and verified post-revocation denial. No tenant credential is shipped in the package and enrollment secrets were not printed.

## DEVICE IDENTITY

Canonical runtime identity now includes:

- device/enrollment ID and Gateway ID
- tenant-scoped site binding
- `device_type = SOFTWARE_CONNECTOR`
- persistent installation ID
- software version and build SHA
- enrollment state and last heartbeat metadata

Heartbeat enforces the enrolled site/Gateway/device token scope. It also rejects attempts to change the enrolled device type or installation ID. Identical heartbeat retries are idempotent; stale heartbeat time is rejected.

## SECRET STORAGE

- macOS deployments retain OS Keychain support.
- Container/Linux deployments use a dedicated mode-`0700` directory with mode-`0600` files.
- Secret account names are allow-pattern validated.
- Writes are atomic and symlink/unsafe-permission reads are rejected.
- Camera/DVR passwords, device refresh tokens and local signing secrets are never returned by health or onboarding UI.
- The installer and structured logs do not print enrollment, refresh, access or camera credentials.

## OUTBOUND TRANSPORT

The Connector defaults to customer-site initiated outbound TLS. No public RTSP, inbound port forwarding or browser access to local credentials is required.

Cloud transport reuses short-lived scoped device tokens, rotating refresh material, Gateway/site/device binding, request timeout/backoff and existing idempotent Event/outbox foundations. Revoked enrollment state is checked server-side before heartbeat acceptance.

## CAMERA DISCOVERY

Discovery reuses the canonical Push 14 adapter/source mapping and existing private DVR/RTSP/ONVIF foundations. Results continue through `cloud-discovery` into the canonical Camera Source model; no Connector-only camera table was introduced.

Optional channel filtering and stream namespace support were added for isolated deployments without changing existing home stream IDs when unset.

## STREAM / EVENT RELAY

The shared runtime preserves source identity, sequence/timestamps, tenant/site, camera mapping, stream ID and source anchors. Existing Journal, outbox, Evidence and normalized Event paths remain the only product path.

The active home regression returned a current real `REAL_CAMERA_AI` Incident for the canonical source after deployment. No mock or manual Event was used.

## LOCAL PREPROCESSING

Existing frame sampling, ONNX/object inference, Journal qualification and evidence capture foundations are reused. Push 16 did not add a second inference implementation. Native adapter metadata can retain its own provenance rather than being mislabeled as Observer AI.

The architecture does not require full-stream cloud relay when native metadata/local qualification is sufficient, but the future cost-aware selection engine remains out of scope.

## HEALTH / HEARTBEAT

Heartbeat reports device type, version/build, installation ID, uptime, CPU/memory/disk indicators, camera/stream counts, last frame, error categories and health state. Production accepted the Software Connector heartbeat and retained its scoped metadata.

The real home Gateway remained healthy after deployment:

- streams: 10
- progressing relays: 10
- stalled relays: 0
- device authorization: ready

## CONFIG SYNC

Cloud returns a scoped, versioned, expiring configuration envelope. The Connector persists it atomically and rejects rollback, future-issued or expired snapshots. Camera mapping is still delivered through the existing discovery/onboarding contract; a broad dynamic fleet configuration service was intentionally not built.

## OFFLINE BEHAVIOR

- Existing SQLite Event outbox and bounded local evidence workspace are preserved.
- Last-known configuration is cached with a maximum validity window.
- Heartbeat/cloud failures are reported and retried without taking ownership of the local process lifecycle.
- Full offline synchronization and prolonged disconnected authorization are not claimed; they remain later hardening work.

## INSTALL / UNINSTALL / REVOKE

CLI/package flow supports enrollment request, enrollment completion, status and local credential removal. Secure uninstall is explicitly two-part: server-side revoke first, then local credential cleanup. Local removal reports when cloud revocation is still required rather than pretending the device is revoked.

Production revocation QA proved future device heartbeat is denied.

## COMMAND SECURITY

The Connector command contract allows only:

- `HEALTH_PROBE`
- `REFRESH_CONFIG`
- `RECONNECT_STREAM` for one validated stream ID

Commands have strict fields, IDs, issue/expiry times and per-command requirements. Unknown fields and `RUN_SHELL`-style commands are rejected. The runtime does not expose arbitrary shell execution.

## PORTABILITY / NO OFFICE DEPENDENCY

Core code contains no office NAS, developer home directory, mounted project volume, Preview hostname or office GPU dependency. Platform-specific secret-store adapters remain isolated. Production cloud defaults to `https://ganbatuach.com`; loopback is used only for the internal local process boundary.

## RESOURCE LIMITS

Conservative initial guidance is:

- up to 8 discovered cameras
- up to 4 parallel relays
- 2 CPU cores recommended
- 1–1.5 GB RAM recommended
- 1 GB bounded local buffer
- 8 MB bounded event clip unit

These are deployment guardrails, not a large-site benchmark or capacity claim.

## ONBOARDING INTEGRATION

`SOFTWARE_CONNECTOR_REQUIRED` now links to a real authenticated Connector setup page. The page explains outbound-only networking, local secret storage, platform readiness, approval and return to discovery/mapping. The existing Push 15 onboarding/source contracts are reused; an existing source is not re-enrolled or duplicated.

Production onboarding regression was non-destructive and preserved the active home source. Its truthful recommendation remains `PHYSICAL_GATEWAY_REQUIRED` because the private legacy recorder requires a local bridge.

## REAL SOFTWARE CONNECTOR E2E

Verified:

- local isolated server identifies itself as `SOFTWARE_CONNECTOR`
- Production enrollment/site binding
- Production heartbeat/config response
- idempotent heartbeat retry
- device-type mutation denial
- refresh rotation protocol v2
- revoke and post-revoke denial
- canonical source/discovery/Event contracts remain connected

Not verified:

`REAL CAMERA → distinct SOFTWARE_CONNECTOR identity → real frame/Event → Supabase/UI`

No independent safe RTSP/ONVIF source or second DVR is available. Reusing the sole home private DVR concurrently could terminate its proprietary session or compete with the active Gateway/source mapping. The home deployment was deliberately not disturbed, and mock/synthetic data was not used as a substitute.

## FAILURE / RESTART TESTS

- Secret-store identity persists across process/store reconstruction: PASS.
- Duplicate startup is guarded by existing enrolled identity and does not request a second identity: PASS (contract/QA).
- Local runtime start/health and unauthorized command rejection: PASS.
- Configuration rollback/expiry rejection: PASS.
- Cloud failure is caught and scheduled for retry without terminating local runtime: PASS (contract/QA).
- Device revoke prevents future cloud heartbeat: PASS in Production.
- Real camera reconnect through a distinct Software Connector: NOT TESTED safely.

## DOCUMENTATION

Added `docs/digital-observer/software-connector.md` covering architecture, status by host, Docker deployment, enrollment, secure source configuration, outbound-only security, offline/config semantics, resource guidance, troubleshooting, uninstall and revoke. Unsupported/unverified platforms are labeled explicitly.

## TEST MATRIX

| Test | Result |
|---|---|
| Software Connector focused QA | PASS — 13/13 |
| TypeScript typecheck | PASS |
| Focused Push 16 lint | PASS — 0 errors; four pre-existing UI warnings isolated |
| Full Next.js Production build | PASS — 488 pages |
| Production release preflight | PASS — clean snapshot, no forbidden artifacts/secrets |
| Production deployment | PASS — READY and aliased to canonical hostname |
| Production Software Connector lifecycle | PASS |
| Heartbeat replay/idempotency | PASS |
| Enrolled device-type mutation rejection | PASS |
| Revoked Connector cloud denial | PASS |
| Camera connection layer QA | PASS — 15/15 |
| Camera onboarding QA | PASS — 7/7 |
| Production home camera/source regression | PASS |
| Production onboarding regression | PASS |
| Real detection/Event bridge | PASS |
| Journal/ingest/outbox/object inference/media QA | PASS |
| Incident QA | PASS |
| Evidence QA | PASS |
| Risk QA | PASS |
| Verification QA | PASS |
| Investigation QA | PASS — 10/10 |
| Tenant boundary QA | PASS — 15/15 |
| Digital Observer product QA | PASS — 68/68 |
| Environment safety | PASS |
| Physical Gateway persistent/shared-session QA | PASS |
| Gateway capability/device refresh tests | PASS |
| Container runtime build | NOT RUN — Docker unavailable on this host; static hardening QA passed |
| Existing camera queue schema test | HARNESS BLOCKED — undeclared `@electric-sql/pglite` dependency; unrelated contract/device tests passed |
| Real camera Event through distinct Software Connector | NOT VERIFIED — no safe independent physical source |

## PUSH 17 READINESS

The shared package/provisioning foundation is ready for continued hardening, but Push 16 itself cannot be classified PASS until a safe independent physical RTSP/ONVIF/DVR source completes the real Software Connector Event path. Push 17 must not begin under the stated stop condition.

ARE WE READY FOR PUSH 17 — UNIFIED CONNECTOR/GATEWAY PACKAGE + PROVISIONING HARDENING?

NO
