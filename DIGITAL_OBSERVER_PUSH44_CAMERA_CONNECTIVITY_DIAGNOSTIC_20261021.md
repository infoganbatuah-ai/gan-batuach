# Digital Observer — home camera connectivity diagnostic

Date: 2026-10-20 22:45 UTC (2026-10-21 Asia/Jerusalem). Scope: read-only investigation of the owner's Production camera dashboard. This is a PUSH 44 continuation and PUSH 38 regression check, **not** a live repair or release authorization.

## Finding

The first failing boundary is **Edge device → Production control plane**. The installed Gateway and Connector read the home sources and report their discovery/health to the isolated PUSH 38 qualification control plane on loopback, not to Production. The managed device identity takes precedence over the legacy keychain cloud-host values; both managed identities point to `https://127.0.0.1:3101`. That ingress forwards device requests to the isolated QA application on `127.0.0.1:3100`, backed by the PUSH38T local Supabase project. The QA database has fresh records for the same site and source IDs that the Production UI displays as stale/offline. A code deployment by itself would not redirect device telemetry.

## Evidence by boundary

| Boundary | Read-only observation | Limit |
| --- | --- | --- |
| Physical DVR | Owner reports visible video on the physical recorder. Gateway PID 54638 has established TCP sessions to the stored DVR endpoint on port 80. Current discovery: 16 channels, 10 assigned/connected, 6 empty, 0 assigned failures. | No independent decoding of each channel on the physical DVR UI. |
| Gateway relay | Gateway `0.2.101-p38-health` build `2cc9e2b67b0a2a6757adc64e3bf7bf4dff193952`; local health 200/healthy, authorization ready, 10/10 relays available and progressing, 0 stalled. For sampled channels, counters showed nonzero bytes/chunks and sub-second input/output idle. | Relay progression is not proof of authorized remote Product playback. |
| Standalone IP source | Connector `0.2.40-p38-health` build `d80fb794f0dac331191ff7620b757449dc260b74`; local health 200/healthy, 1/1 discovery and relay progression. An RTSP client connection to the configured IP source is established. QA database classifies this source as `rtsp`. | Connector health reports zero bytes/chunks for this relay; decoded video and remote playback were not independently verified. |
| Device → control plane | Active managed Gateway and Connector `device_cloud_base_url` both resolve to loopback QA ingress `https://127.0.0.1:3101`; launcher checks the managed value and uses managed identity before legacy keychain. Current local journals show synchronized state with no pending items, but this is synchronization to QA. The historical keychain cloud hosts are not the active target. | No Production heartbeat or relay grant was generated during this investigation. |
| QA database | PUSH38T isolated database: 10 DVR sources `connected/healthy`, 6 empty DVR channels `disabled/unknown`, 1 RTSP source `connected/healthy`; the examined DVR and IP source UUIDs match those shown in the Production UI. DVR last-seen was fresh at 22:44:57 UTC. | QA data must not be mistaken for Production or canonical Development. |
| Canonical Development | `origin/integration/development` at `0a90979504d20c8db0d45574421e6eaf89231fc7`; isolated Development database is healthy but has 0 camera-source rows, including 0 for the home site. | This is a separate synthetic/Development environment, not the home qualification database. |
| Production Product | Authenticated owner UI at `gan-batuach.vercel.app`: 0 live sources, 11 disconnected visible sources (10 DVR + 1 standalone IP camera). Sample DVR last check 2026-09-22 11:13 local; IP camera last check 2026-09-21 05:39 local. Public `/api/health` returned 200 and Supabase auth `ok`, which is not camera health. | Direct Production database/admin API was not queried; actual deployed Git SHA was not independently verified. |
| Dashboard classification | `digitalObserverCameraHasLiveStream` requires a stream reference and fresh operational state; health older than 90 minutes is offline. Stale Production records therefore yield zero live sources. `ObserverCameraMedia` incorrectly says “the DVR did not return video” for an offline RTSP IP camera. | The offline classification is consistent with missing Production telemetry; the IP-camera explanation is misleading. |

## Production versus Development code

Current `origin/main` is `2da8f75abce610a9a979eecd752d7a6a1011641e` and current `origin/integration/development` is `0a90979504d20c8db0d45574421e6eaf89231fc7`; they diverge. Their camera live-status and camera-media files are identical in the compared Git trees; `runtime.ts` differs. `main` is **not** independently verified as the deployed Production SHA. The isolated QA telemetry target, not a proven code version gap, explains the long-lived Production staleness.

## Minimal repair proposal — **not executed**

1. Inventory the Production site/source/device enrollment and verify that the intended Production device identity and API protocol are compatible with the currently deployed Production build. Verify Production media-grant/relay architecture separately. Do not copy QA credentials or data into Production.
2. Plan one controlled handoff from PUSH38T QA to the Production control plane for the same physical Gateway and Connector, with explicit owner authorization, backup of current device configuration, QA qualification impact review, and a timed rollback. Maintain single-writer device ownership; do not dual-home journals or stream grants.
3. After the handoff, verify fresh authorized Production heartbeats, exact site/source mapping, 10 DVR + 1 IP source status, and only then one real authorized playback path. Confirm cross-tenant denial and expiry/revocation before widening access. Correct the separate RTSP fallback text via a scoped Development change if desired.

Live change required: **yes** for restoring Production device telemetry; none performed here. Expected downtime: **not yet quantifiable**; the controlled cutover can interrupt QA telemetry and camera availability while credentials/endpoint and relay grants are switched. Rollback: restore the backed-up QA managed device identity/configuration and service target, verify return of QA heartbeat/relay progression, and revert any scoped Production enrollment change using its recorded pre-change state. Do not simply restart services or deploy a new Product build as an unproven repair. Production deployment required for this root cause: **not established**; verify deployed version/protocol before deciding. No main or Production changes were made.

## Evidence handling

Commands used were read-only: authenticated Product UI inspection, loopback health GETs, process socket inspection, Git remote SHA reads, source inspection, and SELECT queries against isolated QA and Development databases. This tracked summary omits credentials, private camera URLs, and raw media. No DVR configuration, device service, database row, tunnel, branch target, main, or Production deployment was changed. The diagnostic branch is `codex/push44-camera-connectivity-diagnostic`; the work remains pending owner-authorized live repair.
