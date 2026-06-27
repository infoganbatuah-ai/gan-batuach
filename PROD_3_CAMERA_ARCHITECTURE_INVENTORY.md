# PROD 3 Camera Architecture Inventory

Date: 2026-06-27

Scope: Gan Batuach and Digital Observer camera code after BUILD FIX 1. This inventory records existing camera surfaces and the security posture needed before any real pilot camera connection.

## Current Status

Overall camera status: gateway_ready_no_camera

No real gateway health response or real camera stream was validated in this phase. Existing UI and API surfaces are readiness/gateway-capable, but parent-facing live viewing remains blocked until a secure gateway, policy checks, short-lived tokens, audit logging, and legal/privacy notices are verified end to end.

## Routes And Pages

| File/route | Purpose | Current status | Mock/readiness/live | Security risk | Required next step |
|---|---|---:|---|---|---|
| `/dashboard/garden/cameras` | Manager camera overview and readiness | Exists | Readiness | Must not expose source credentials | Validate with own-garden camera records only |
| `/dashboard/garden/camera-health` | Manager health/readiness view | Exists | Readiness | Health errors must remain redacted | Connect to gateway health after env setup |
| `/dashboard/parent/cameras` | Parent camera availability and viewing entry | Exists | Restricted readiness | Parent viewing must remain policy/token gated | Test denial and allowed cases with real policy |
| `/dashboard/staff/cameras` | Staff camera state | Exists | Restricted readiness | Staff must not inherit broad camera access | Keep disabled unless explicit role permission exists |
| `/dashboard/inspector/cameras` | Inspector camera state | Exists | Restricted readiness | Inspector must see assigned gardens only | Test assigned/unassigned denial with real data |
| `/dashboard/admin/cameras` | Admin operational camera overview | Exists | Readiness | Admin diagnostics must not show secrets | Add real gateway health only after setup |
| `/dashboard/admin/camera-gateway` | Admin gateway readiness center | Exists | Readiness | Missing env names only, no secret values | Verify provider mode and last health check |
| `/dashboard/admin/video-gateway` | Video gateway admin operations | Exists | Readiness | Advanced diagnostics must remain redacted | Use for controlled gateway validation |
| `/dashboard/admin/camera-audit` | Camera audit/readiness | Exists | Readiness | Audit data admin-only | Verify logs after token issuance |
| `/dashboard/admin/camera-compliance` | Camera policy/compliance | Exists | Readiness | Privacy policy state must be honest | Link to legal/privacy review before parent view |
| `/dashboard/admin/camera-deployment` | Deployment readiness | Exists | Readiness | Must not imply live status | Use for setup checklist |
| `/digital-observer/cameras` | Standalone Digital Observer camera page | Exists | Product readiness | Must stay product-scoped | Verify no Gan Batuach garden leakage |

## API Routes

| API route | Purpose | Current status | Security notes |
|---|---|---:|---|
| `/api/camera-streams` | Camera stream CRUD through generic route conventions | Exists | Safe list fields are selected; sensitive setup fields are encrypted/removed on write |
| `/api/camera-streams/[id]/playback-token` | Issues short-lived playback sessions | Hardened in PROD 3 | Requires auth, role checks, assignment/policy checks, audit logs, token hash storage |
| `/api/camera-streams/[id]/status` | Camera status | Exists | Must not return credentials |
| `/api/camera-streams/[id]/view-logs` | Viewing logs | Exists | Must remain role/admin scoped |
| `/api/camera-streams/test-connection` | Server-side camera/gateway test | Exists | Admin/manager/owner only; manager/owner scoped to own garden; masks source info |
| `/api/video-stream-sessions` | Session lifecycle/readiness | Exists | Must validate token/session server-side |
| `/api/video-gateway/health-checks` | Gateway health checks | Exists | Server-side gateway call only |
| `/api/video-gateway/rtsp-ingest` | RTSP ingest readiness | Exists | Must never expose RTSP to browser |
| `/api/video-gateway/dvr-connections` | DVR/NVR readiness | Exists | Setup secrets must remain server-only |
| `/api/video-gateway/onvif-discovery` | ONVIF discovery readiness | Exists | Local network scanning must be controlled/admin only |
| `/api/admin/camera-gateway` | Admin camera gateway readiness | Exists | Admin-only, no secret values |
| `/api/admin/video-gateway` | Admin video gateway readiness | Exists | Admin-only, no secret values |
| `/api/parent/cameras` | Parent camera list | Exists | Must only return parent-authorized camera availability |
| `/api/parent-camera-permissions` | Parent camera policy | Exists | Must remain manager/admin scoped |
| `/api/camera-snapshots` | Snapshot readiness | Exists | Sensitive snapshots must not be public |

## Domain Helpers

| File | Purpose | Current status | Required next step |
|---|---|---:|---|
| `lib/domain/video-streaming.ts` | Role-scoped playback token/session creation | Hardened in PROD 3 | Test with real gateway public playback URL |
| `lib/domain/video-gateway-client.ts` | Server-side gateway health/register/playback calls | Hardened in PROD 3 | Configure gateway URL/secret/public base |
| `lib/domain/video-gateway.ts` | Gateway/readiness domain helpers | Exists | Keep server-only for sensitive operations |
| `lib/domain/camera-connection-builder.ts` | RTSP candidate creation from server-side setup input | Exists | Do not return candidates to client |
| `lib/domain/camera-health.ts` | Camera health summaries | Exists | Connect to real gateway status after setup |
| `lib/domain/parent-camera-access.ts` | Parent camera access decision helpers | Exists | Manual role tests required |
| `lib/domain/parent-camera-list.ts` | Parent-safe list data | Exists | Verify minimization with live data |
| `lib/domain/camera-deployment-readiness.ts` | Deployment readiness checks | Exists | Use for pilot gate |
| `lib/domain/real-camera-infrastructure.ts` | Real camera readiness model | Exists | Verify migration applied before pilot |
| `lib/domain/camera-diagnostics.ts` | Diagnostics helpers | Exists | Keep diagnostics redacted |
| `lib/domain/camera-gateway/index.ts` | Camera gateway grouping | Exists | Keep product scoped |

## Database And Migration Inventory

Relevant camera migrations found:

- `20260527002000_camera_secure_schema_aliases.sql`
- `20260527005000_parent_camera_rls_access.sql`
- `20260601005000_camera_infrastructure_readiness.sql`
- `20260602006000_camera_dvr_nvr_connection_flow.sql`
- `20260602011000_video_gateway_live_integration.sql`
- `20260606011000_real_camera_infrastructure.sql`
- `20260607001000_real_camera_deployment_readiness.sql`
- `20260608001000_real_camera_deployment_gateway_infrastructure.sql`
- `20260612012800_camera_digital_observer_infrastructure_platform.sql`
- `20260612014700_legal_camera_streaming_parent_viewing_anti_leak.sql`
- `20260612016400_real_camera_gateway_dvr_nvr_home_pilot.sql`
- `20260616000100_parent_rls_scope_hardening.sql`

Manual Supabase verification is still required before real pilot users.

## Existing Security Controls

- Browser playback goes through tokenized session creation, not direct RTSP.
- Playback tokens are hashed before storage.
- Parent viewing requires active parent camera policy, capability policy, MFA gate, parent-child-garden relationship, child presence, room matching where configured, and short TTL.
- Manager/owner/staff viewing is scoped to the profile garden; staff requires explicit camera flag.
- Inspector viewing requires assigned inspected garden and policy/access reason where configured.
- Admin sees operational status only; secrets must stay redacted.
- Audit tables are written for authorization checks, access trail, playback sessions, and infrastructure logs.

## PROD 3 Code Hardening

- Gateway public playback URLs no longer fall back to internal gateway URLs.
- Generic camera env names are supported in the gateway client.
- Gateway calls have a 5-second server-side timeout.
- Playback sessions now clamp token TTL to 60-300 seconds.
- Playback URLs are rejected if they use RTSP, localhost, loopback, `.local`, or private RFC1918 IPv4 ranges.

## Current Next Step

Configure a secure gateway in sandbox/test mode, register one non-sensitive test camera through server-side setup, run gateway health, then verify manager allowed viewing, parent denial, parent allowed viewing, inspector denial/allowed viewing, and audit logs.
