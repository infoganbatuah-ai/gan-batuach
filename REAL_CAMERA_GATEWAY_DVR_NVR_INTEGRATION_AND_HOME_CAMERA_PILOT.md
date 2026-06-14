# Real Camera Gateway, DVR/NVR Integration And Home Camera Pilot

Phase 164 connects Gan Batuach to real camera infrastructure through a gateway-first architecture. The implementation keeps the existing camera platform intact while adding the `/dashboard/admin/camera-gateway` command center, gateway configuration records, source registry readiness and an isolated home camera pilot path.

## Camera Architecture

All camera sources must pass through a gateway layer before browser playback.

Supported source types:

- DVR
- NVR
- IP camera
- RTSP
- ONVIF readiness
- Hikvision
- Dahua
- Uniview
- Axis
- Generic camera
- Home test camera
- Demo camera

Sensitive source material is server-only:

- No RTSP URL is returned to the browser.
- No camera username/password is returned to the browser.
- No gateway secret is returned to the browser.
- Manual RTSP values must be stored encrypted or referenced by server-only secret names.

## Gateway Architecture

Route: `/dashboard/admin/camera-gateway`

Adapter layer: `lib/domain/camera-gateway`

Functions:

- `checkGatewayHealth`
- `registerCameraSource`
- `testCameraSource`
- `disableCameraSource`
- `getPlaybackUrls`
- `getGatewayDiagnostics`

The adapter wraps the existing video gateway client and supports:

- MediaMTX
- go2rtc
- custom gateway
- future WebRTC gateway readiness

Server-only environment variables:

- `VIDEO_GATEWAY_URL`
- `VIDEO_GATEWAY_PUBLIC_URL`
- `VIDEO_GATEWAY_PROVIDER`
- `VIDEO_GATEWAY_API_KEY`
- `VIDEO_GATEWAY_SIGNING_SECRET`

## Database Model

New/extended tables:

- `camera_gateway_configs`
- `camera_source_registry`
- `home_camera_test_sites`
- `camera_gateway_health_checks`
- `camera_gateway_audit_events`
- `camera_gateway_worker_readiness`

Existing tables remain the primary operational model:

- `camera_streams`
- `camera_gateway_registry`
- `camera_stream_validations`
- `camera_playback_sessions`
- `video_stream_sessions`
- `camera_access_audit_trail`

## DVR/NVR Setup

The setup flow should collect:

- Brand: Hikvision, Dahua, Uniview, Axis or Generic
- DVR/NVR address
- RTSP port, usually 554
- Username
- Password
- Channel number
- Stream quality: main/sub
- Gateway provider
- Zone assignment
- Parent visibility setting

Hebrew UX guidance:

- DVR/NVR is the central recorder that contains multiple camera channels.
- The camera channel is the number assigned to a specific camera inside the recorder.
- The RTSP port is usually 554, unless changed by the installer.
- A gateway is required because browsers cannot safely receive direct RTSP streams.

## RTSP Candidate Builder

File: `lib/domain/camera-connection-builder.ts`

Supported server-side patterns:

Hikvision:

`/Streaming/Channels/{channel}01`

Dahua:

`/cam/realmonitor?channel={channel}&subtype=0`

Uniview:

`/unicast/c{channel}/s{stream}`

Axis:

`/axis-media/media.amp`

Generic:

`/ch{channel}/{quality}`

The builder may generate RTSP candidates server-side, but only masked summaries and candidate template names may be shown to users.

## ONVIF Readiness

ONVIF support is readiness-only unless a real ONVIF discovery service is configured.

Prepared fields:

- ONVIF host
- ONVIF port
- Username
- Password
- Discovery placeholder
- Future capabilities placeholder

Remaining real work:

- ONVIF device discovery against the local network.
- Profile discovery.
- Stream URI extraction.
- Gateway registration from discovered stream URI.

## Home Camera Pilot

Table: `home_camera_test_sites`

Purpose:

Allow Daniel to test a real home camera before connecting a kindergarten camera.

Rules:

- Isolated from kindergarten production data.
- Admin-only visibility.
- No parent access.
- No child data.
- No kindergarten compliance score.
- Observer runs in shadow mode only.

Supported pilot checks:

- RTSP source test
- ONVIF readiness
- Gateway registration
- Playback readiness
- Health check
- Observer shadow mode readiness

## Gateway Registration Flow

Flow:

1. Camera setup collects source fields.
2. Server validates required fields.
3. Server builds RTSP candidates.
4. Server checks gateway health.
5. Server registers source with the gateway.
6. Database stores registration status.
7. Playback readiness is generated without exposing the RTSP source.

Registration statuses:

- `pending_gateway`
- `testing`
- `registering`
- `registered`
- `failed`
- `disabled`

## Playback Token Rules

Existing playback token route enforces:

- Authenticated user.
- Role permission.
- Garden access.
- Camera access.
- Parent policy where relevant.
- Viewing hours.
- MFA for parent camera viewing.
- Child checked-in validation for parent access.
- Audit logging.
- Short token lifetime.

Parents may be blocked with:

- `הגן לא פתח צפייה להורים`
- `הילד לא נמצא כרגע בגן`
- `מחוץ לשעות הצפייה`
- `המצלמה אינה זמינה`
- `נדרש אימות נוסף`

## Privacy And Security Model

Gan Batuach Israel mode:

- Audio disabled.
- Face recognition disabled.
- Raw AI event parent visibility disabled.
- Human review required.
- Parent viewing only after policy, MFA, child presence and token checks.

Required controls:

- RTSP never exposed.
- Credentials never exposed.
- Gateway secrets server-only.
- Every playback token logged.
- Every viewing session logged.
- Parent raw AI blocked.
- Inspector access scoped to assigned garden and reason.

## Camera Health Monitoring

Prepared health statuses:

- online
- offline
- degraded
- reconnecting
- no_signal
- unauthorized
- gateway_unavailable
- disabled

The worker readiness record defines future scheduled checks for:

- Gateway health.
- Registered stream availability.
- Failed stream count.
- Latency.
- Camera status changes.

## Recording Readiness

Recording is not enabled by this phase.

Prepared metadata:

- `recording_enabled`
- `retention_days`
- `storage_location`
- storage usage estimate readiness
- clip/snapshot readiness

Remaining real deployment requirements:

- Gateway recording backend.
- Storage provider and retention rules.
- Legal review of recording policy.
- Incident/evidence retention workflow.

## Digital Observer Binding

Camera records support:

- Observer enabled/disabled.
- Shadow mode.
- Zone mapping.
- Skeleton analytics readiness.
- Motion anomaly readiness.
- Human review required.

Parents never see raw observer events, raw skeleton signals or unreviewed AI claims.

## Remaining Real Deployment Requirements

- Configure a real MediaMTX, go2rtc or custom gateway.
- Add server-only Vercel env vars.
- Run Daniel home camera smoke test.
- Validate WebRTC/HLS playback with a real token.
- Validate parent blocked when child is not checked in.
- Confirm RTSP and credentials never appear in browser network payloads.
- Configure scheduled gateway health worker.
- Select recording storage only after legal and infrastructure approval.
