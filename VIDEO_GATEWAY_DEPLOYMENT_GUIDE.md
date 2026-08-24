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
DVR_EXPECTED_CHANNEL_COUNT=16
VIDEO_GATEWAY_CLOUD_DISCOVERY_SECRET=
VIDEO_GATEWAY_CLOUD_ALLOWED_GATEWAYS=
```

Notes:

- `VIDEO_GATEWAY_URL` is server-side and used by the app to register/check streams.
- `VIDEO_GATEWAY_PUBLIC_URL` is the browser-safe playback base URL.
- `VIDEO_GATEWAY_API_KEY` and `VIDEO_GATEWAY_SIGNING_SECRET` are server-only.
- `DVR_EXPECTED_CHANNEL_COUNT` is server-only and defaults to `16`.
- `VIDEO_GATEWAY_CLOUD_DISCOVERY_SECRET` signs sanitized local Gateway discovery reports sent to production.
- `VIDEO_GATEWAY_CLOUD_ALLOWED_GATEWAYS` is a comma-separated allowlist of `gatewayId:gardenId` or `gatewayId:observerSiteId` pairs.
- Do not expose RTSP camera credentials in public env variables.

## Local Custom DVR Gateway

This repository includes a minimal custom Gateway at `services/video-gateway`.

It is intentionally read-only:

- It probes RTSP candidates with `ffprobe`.
- It discovers/maps DVR channels as camera sources.
- It does not perform PTZ, siren, light, reboot, configuration changes or any DVR mutation.
- It does not return DVR credentials, RTSP URLs or private endpoints to the app response.

Local activation with Docker Compose:

```bash
docker compose --profile gateway up -d video-gateway
```

Server-side app variables for Compose:

```env
VIDEO_GATEWAY_PROVIDER=custom
VIDEO_GATEWAY_URL=http://video-gateway:8080
VIDEO_GATEWAY_SIGNING_SECRET=<server-only shared secret>
DVR_EXPECTED_CHANNEL_COUNT=16
```

When the Next.js app and Gateway are not on the same Docker network, use the
server-reachable Gateway address instead of `http://video-gateway:8080`.

The DVR endpoint, DVR port, username and password must be supplied only through
a server-side secret store or an authenticated server-side admin operation that
calls `/api/video-gateway/dvr-connections`. Do not paste those values into
browser storage, client logs, public env variables or issue trackers.

Minimum safe connection flow:

1. Confirm `VIDEO_GATEWAY_URL` and `VIDEO_GATEWAY_SIGNING_SECRET` are present on the server.
2. Start `video-gateway` and verify `/health` from the server network.
3. From an admin/manager session with `cameras:write`, call the server endpoint `/api/video-gateway/dvr-connections` with the DVR values in the HTTPS request body.
4. The server encrypts and stores the DVR values, calls the Gateway, materializes the discovered channels into `camera_streams`, and links them to `digital_observer_camera_sources`.
5. The Digital Observer dashboard and AI Shadow pages read those same camera records.

## Local Mac Live Onboarding

Use this path when the Gateway and the app server run on the Mac that is on the
same private network as the DVR.

Terminal 1: run the Gateway temporarily:

```bash
npm run gateway:local
```

Terminal 2: run the local app with a temporary onboarding token:

```bash
npm run dvr:onboarding-app
```

Terminal 3: start the live read-only connection wizard:

```bash
npm run dvr:connect-local
```

The wizard asks for the local onboarding token, Gateway secret, DVR endpoint,
port, vendor, username, password, garden/site UUID and channel count. Sensitive
fields are read from the terminal and are not written to source files by the
script. The live DVR discovery starts only after typing `CONNECT`.

The onboarding route is disabled unless `LOCAL_DVR_ONBOARDING_ENABLED=true` is
present in the local app process and the request includes the matching
`LOCAL_DVR_ONBOARDING_TOKEN`. It accepts only a localhost Gateway URL.

## Cloud Mapping Without Local Service Role

Use this path when the Mac can reach the DVR but must not hold Supabase service
role credentials. The local Gateway performs only read-only discovery and sends
a sanitized channel report to production. Production performs the Supabase
upsert with its existing service role.

Production requirements:

```env
VIDEO_GATEWAY_CLOUD_DISCOVERY_SECRET=<long server-only signing secret>
VIDEO_GATEWAY_CLOUD_ALLOWED_GATEWAYS=<gateway-id>:<garden-or-observer-site-uuid>
```

Local flow after production is configured and explicitly approved:

```bash
npm run dvr:cloud-discovery
```

Security properties:

- The local script starts a temporary localhost Gateway.
- DVR endpoint, username and password stay on the Mac and are used only for local `ffprobe` discovery.
- The production endpoint receives only channel number, status, health, dimensions, candidate count and stable stream id.
- The production endpoint rejects RTSP URLs, credentials, private endpoints and unexpected sensitive keys.
- Requests require HMAC-SHA256 over timestamp, nonce and body.
- Timestamp skew is limited to 5 minutes.
- Nonces are stored as provider webhook events and replays are rejected.
- Gateway/site pairs must match `VIDEO_GATEWAY_CLOUD_ALLOWED_GATEWAYS`.
- Camera rows are created with parent view blocked and AI Shadow only.

Browser-safe Live/Playback requires a configured playback/transcoding layer and
`VIDEO_GATEWAY_PUBLIC_URL`/`CAMERA_GATEWAY_PUBLIC_BASE_URL`. The included custom
Gateway currently verifies read-only reachability and channel mapping; it does
not expose raw RTSP URLs to the browser.

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
