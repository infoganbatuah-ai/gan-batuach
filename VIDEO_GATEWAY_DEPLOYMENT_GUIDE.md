# Video Gateway Deployment Guide

Phase 2H prepares Gan Batuach for real live video gateway integration with MediaMTX, go2rtc or a custom gateway.

The application must never expose RTSP URLs, camera credentials or gateway secrets to the browser.

## Supported Providers

- MediaMTX
- go2rtc
- custom gateway

Provider is selected by:

```env
VIDEO_GATEWAY_PROVIDER=mediamtx
```

Allowed values:

- `mediamtx`
- `go2rtc`
- `custom`

## Environment Variables

```env
VIDEO_GATEWAY_PROVIDER=
VIDEO_GATEWAY_URL=
VIDEO_GATEWAY_PUBLIC_URL=
VIDEO_GATEWAY_API_KEY=
VIDEO_GATEWAY_SIGNING_SECRET=
```

Notes:

- `VIDEO_GATEWAY_URL` is server-side and used by the app to register/check streams.
- `VIDEO_GATEWAY_PUBLIC_URL` is the browser-safe playback base URL.
- `VIDEO_GATEWAY_API_KEY` and `VIDEO_GATEWAY_SIGNING_SECRET` are server-only.
- Do not expose RTSP camera credentials in public env variables.

## Playback Flow

Parent or manager opens camera:

1. User requests playback from Gan Batuach.
2. Server checks role and camera permission.
3. Server creates a short-lived playback token.
4. Server creates a playback session audit row.
5. Browser receives only HLS/WebRTC gateway URL.

The browser never receives:

- RTSP URL.
- DVR/NVR password.
- Camera username.
- Gateway API key.
- Service role key.

## MediaMTX Setup Example

Minimal Docker example:

```yaml
services:
  mediamtx:
    image: bluenviron/mediamtx:latest
    ports:
      - "8554:8554"
      - "8888:8888"
      - "8889:8889"
      - "9997:9997"
    environment:
      MTX_API: "yes"
```

Recommended:

- Put MediaMTX behind a private network where possible.
- Expose only browser-safe HLS/WebRTC endpoints publicly.
- Protect API access with network rules or a gateway key.
- Terminate TLS at a reverse proxy.

## go2rtc Setup Example

Minimal Docker example:

```yaml
services:
  go2rtc:
    image: alexxit/go2rtc:latest
    ports:
      - "1984:1984"
      - "8554:8554"
```

Recommended:

- Keep RTSP inputs private.
- Expose browser playback through HTTPS reverse proxy.
- Restrict the API endpoint.

## Camera Source Registration

Gan Batuach registers a camera source:

camera
-> gateway adapter
-> source registered
-> HLS/WebRTC playback URL generated

Statuses:

- `pending_gateway`
- `registering`
- `registered`
- `failed`
- `offline`
- `disabled`

No false success:

- If gateway is missing, status stays `pending_gateway`.
- If gateway returns an error, status becomes `failed`.
- If registration succeeds, status becomes `registered`.

## Admin Diagnostics

Admin route:

`/dashboard/admin/video-gateway`

Shows:

- provider
- gateway health
- latency
- active/registered streams
- failed streams
- pending streams
- recent playback sessions
- recent registrations

Admin actions:

- re-register stream
- retest stream
- disable stream

## Manager Flow

Manager can:

- View live stream if source is ready.
- Test stream.
- Disable/enable own kindergarten camera.
- See health/status.

Manager cannot see:

- RTSP URLs.
- Camera passwords.
- Gateway secrets.

## Parent Flow

Parent can:

- See only cameras allowed for their child/kindergarten.
- Request playback token.
- Open HLS/WebRTC gateway playback URL.

Parent cannot:

- Test camera source.
- Register camera source.
- View RTSP/source diagnostics.
- See cameras from another kindergarten.

## Playback Session Audit

Every playback request is logged in:

- `video_stream_sessions`
- `camera_playback_sessions`
- `camera_view_logs`

The dedicated `camera_playback_sessions` table stores:

- profile
- camera
- kindergarten
- playback protocol
- provider
- token hash
- timestamps
- IP/user-agent readiness fields

## Recording Readiness

Prepared fields:

- `recording_enabled`
- `retention_days`
- `storage_location`

Real recording is not implemented in Phase 2H.

## Security Checklist

- No RTSP in browser HTML.
- No camera credentials in browser payloads.
- No gateway API keys in browser payloads.
- Playback requires server-side permission check.
- Parent access is scoped to approved cameras.
- Manager access is scoped to own kindergarten.
- Inspector access remains scoped to assigned kindergartens.
- Admin diagnostics are admin-only.
- Playback tokens are short-lived.

## Troubleshooting

Gateway missing:

- Check `VIDEO_GATEWAY_URL`.
- Check provider value.
- Confirm gateway container is reachable from the app.

Gateway API failure:

- Check network/firewall.
- Check API port.
- Check API key.
- Check reverse proxy path.

Playback URL opens but video does not play:

- Check HLS/WebRTC endpoint exposure.
- Check TLS/cors/proxy config.
- Check gateway stream source status.

Camera registration fails:

- Confirm DVR/NVR host and port.
- Confirm camera channel.
- Confirm gateway can reach the camera network.
- Confirm credentials are stored server-side.

Parent cannot view:

- Confirm parent camera permission.
- Confirm child/kindergarten linkage.
- Confirm playback source is registered.
- Confirm token route returns HLS/WebRTC URL.
