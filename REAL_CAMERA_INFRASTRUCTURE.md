# Real Camera Infrastructure

Gan Batuach and the future Digital Observer platform now have production-readiness infrastructure for real camera systems. This phase does not deploy a video gateway, require real credentials or implement real recording.

## Provider Architecture

Supported provider profiles:

- Hikvision
- Dahua
- Uniview
- Axis
- Generic RTSP
- NVR
- DVR

Provider capabilities are stored in `camera_provider_registry`.

Each provider can describe:

- RTSP support
- ONVIF support
- DVR/NVR support
- multi-channel support
- recording readiness
- default ports
- RTSP template patterns

No camera password, RTSP URL or gateway secret is stored in the provider registry.

## Stream Validation

Validation readiness is stored in `camera_stream_validations`.

Prepared checks:

- RTSP candidate generation
- connection validation
- credential validation
- latency measurement
- stream availability
- gateway-required state

Current behavior is mock/readiness only. If no Video Gateway is configured, validation should return a gateway-required state rather than fake success.

## Health Monitoring

Camera health states:

- online
- offline
- degraded
- reconnecting
- disabled
- pending
- unknown

Health history is stored in `camera_health_history`.

The existing `camera_streams` table also tracks:

- `stream_status`
- `health_status`
- `last_seen`
- `last_successful_connection_at`
- `last_stream_activity_at`
- `failure_count`
- `reconnect_attempts`

## Recording Readiness

Recording readiness is modeled but not implemented.

Tables/fields:

- `camera_recording_readiness`
- `camera_streams.recording_enabled`
- `recording_status`
- `recording_retention_days`
- `recording_storage_location`
- `recording_storage_used_mb`

Recording status values:

- enabled
- disabled
- pending_storage
- not_implemented

## Playback Architecture

Playback remains gateway-based and permission checked.

Prepared playback modes:

- HLS
- WebRTC

Playback requirements:

1. User opens camera.
2. Server checks role and garden/parent permissions.
3. Server creates a short-lived playback token/session.
4. Browser receives only a browser-safe playback URL.
5. RTSP URL, camera username/password and gateway secrets are never exposed.

Playback auditing is stored in `camera_playback_sessions`.

## Storage Model

Prepared storage modes:

- local
- cloud
- hybrid
- not configured

Storage readiness is stored in `camera_storage_readiness`.

Tracked values:

- storage provider
- storage location
- current usage
- estimated daily usage
- retention days
- readiness status

## Dashboards

Admin:

- `/dashboard/admin/camera-infrastructure`

Shows:

- provider distribution
- online/offline/degraded statistics
- HLS/WebRTC readiness
- recording readiness
- storage readiness
- diagnostics per camera

Manager:

- `/dashboard/garden/camera-health`

Shows only the manager's own garden cameras:

- health status
- playback readiness
- gateway readiness
- recording/storage readiness
- safe credential handling

## Observer Integration

This layer prepares camera signals for:

- AI Observer
- Video Gateway
- Learning Engine
- Correlation Engine
- Safety Framework

The Observer should only use browser-safe playback/session metadata and gateway-managed snapshots. It must not receive raw RTSP credentials from the frontend.

## Production Deployment Roadmap

1. Deploy MediaMTX/go2rtc/custom Video Gateway.
2. Configure `VIDEO_GATEWAY_URL` and server-only gateway secrets.
3. Connect one pilot DVR/NVR with non-production credentials.
4. Run validation against the gateway.
5. Verify HLS/WebRTC playback through permission-checked routes.
6. Enable health polling.
7. Add recording worker/storage only after retention and consent policies are approved.
8. Connect Observer snapshots after human-review workflow is verified.

## Security Rules

- Do not expose RTSP URLs in HTML.
- Do not expose camera passwords.
- Do not expose gateway API keys.
- Parent playback must recheck permission.
- Manager can access only own garden cameras.
- Admin can see infrastructure diagnostics, not secrets.
- Inspector access remains scoped to assigned gardens.

## Mock Testing Checklist

- Create camera provider registry rows.
- View admin infrastructure dashboard.
- View manager camera health center.
- Verify cameras are counted by provider.
- Verify HLS/WebRTC readiness is calculated.
- Verify recording/storage readiness is shown as pending unless configured.
- Verify no secrets appear in diagnostics.
- Run typecheck and production build.
