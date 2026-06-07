# Real Camera Deployment Guide

Gan Batuach and Digital Observer are prepared for real-world camera connections without requiring real credentials during development. RTSP URLs, camera usernames, passwords, and gateway secrets must stay server-side.

## Supported Camera Sources

- DVR
- NVR
- IP Camera
- RTSP
- ONVIF
- Hikvision
- Dahua
- Uniview
- Axis
- Generic camera

## Camera Setup Flow

Manager/admin flow:

1. Choose camera system type.
2. Enter host, IP, or domain.
3. Enter port, usually `554` for RTSP.
4. Enter username/password.
5. Choose channel number.
6. Test connection through the server.
7. Register source with the video gateway.
8. Confirm live preview readiness.

The browser never receives the raw RTSP URL or saved password.

## Home Camera Test Mode

Use `home_test` before connecting a real kindergarten.

Recommended Daniel home test:

1. Add camera from `/dashboard/admin/cameras` or `/dashboard/garden/cameras`.
2. Select test mode: `בדיקת בית`.
3. Choose the actual camera type.
4. Enter local host/domain, port, username, password, and channel.
5. Run connection test.
6. Register with gateway only after the gateway is configured.

Home/business/kindergarten test records are isolated with test-site metadata and should not be mixed with production kindergarten data.

## Kindergarten DVR/NVR Setup

Checklist for a real kindergarten:

- Confirm the DVR/NVR model and vendor.
- Confirm RTSP is enabled.
- Create a read-only camera user.
- Confirm channel numbers.
- Confirm LAN/VPN/gateway access.
- Avoid exposing camera ports directly to the public internet.
- Add cameras in Gan Batuach as pending gateway until the gateway is ready.

## Hikvision Example

Typical RTSP template:

`/Streaming/Channels/{channel}{quality_code}`

Examples:

- Channel 1 main stream: `101`
- Channel 1 sub stream: `102`
- Channel 2 sub stream: `202`

Use the wizard fields instead of pasting full RTSP URLs where possible.

## Dahua Example

Typical RTSP template:

`/cam/realmonitor?channel={channel}&subtype={subtype}`

Examples:

- Main stream: `subtype=0`
- Sub stream: `subtype=1`

Use sub stream first for lower bandwidth and faster validation.

## MediaMTX / go2rtc Notes

Supported gateway providers:

- MediaMTX
- go2rtc
- Custom gateway

The gateway is responsible for:

- RTSP/ONVIF ingestion.
- HLS/WebRTC conversion.
- Health checks.
- Playback source registration.
- Keeping camera credentials server-only.

Environment readiness:

- `VIDEO_GATEWAY_PROVIDER`
- `VIDEO_GATEWAY_URL`
- `VIDEO_GATEWAY_PUBLIC_URL`
- `VIDEO_GATEWAY_API_KEY`
- `VIDEO_GATEWAY_SIGNING_SECRET`

Do not place gateway secrets in client-side code.

## Firewall And Network Notes

- Prefer VPN, private network, or gateway-side site connection.
- Avoid direct public exposure of DVR/NVR admin ports.
- Use read-only camera users where possible.
- Restrict source IPs to the gateway.
- Keep RTSP on private networks when possible.
- For remote sites, use a secure tunnel or gateway agent.

## Playback Readiness

Playback must use:

- Permission check.
- Short-lived playback token.
- HLS or WebRTC gateway URL.
- Playback audit log.

Parent, manager, staff, inspector, and admin access must stay scoped to role and site permissions.

## Recording Readiness

Recording fields are readiness-only:

- Recording enabled/disabled.
- Retention days.
- Storage provider/location.
- Storage usage estimate.
- Clip readiness.
- Snapshot readiness.

No real recording is required by this phase.

## Digital Observer Sites

Camera deployment supports:

- Gan Batuach kindergarten cameras.
- Future standalone home/business Digital Observer sites.

Permissions must remain separate:

- Kindergarten cameras use garden-scoped permissions.
- Digital Observer sites use observer site membership/ownership.

## Troubleshooting

Common failures:

- Gateway missing: configure `VIDEO_GATEWAY_URL` and server secret.
- Host unreachable: check LAN/VPN/firewall.
- Invalid credentials: verify read-only camera user.
- Channel missing: try another channel number.
- Stream timeout: use sub stream first.
- Black/frozen frame: check camera bandwidth and gateway health.
- Parent cannot view: verify parent permission and playback token creation.

Security checks:

- RTSP URL not visible in browser.
- Password not returned from API.
- Gateway key not returned from API.
- Playback goes through token endpoint.
- Audit logs exist for setup, validation, and playback.
