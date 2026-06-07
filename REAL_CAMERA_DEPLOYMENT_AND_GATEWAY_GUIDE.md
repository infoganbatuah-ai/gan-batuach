# Real Camera Deployment And Gateway Guide

This guide prepares Gan Batuach and Digital Observer for real camera deployment. It does not require real customer credentials and does not activate production cameras automatically.

## Deployment Principle

Camera source details stay server-side. The browser must never receive RTSP URLs, camera usernames, camera passwords, gateway API keys, or gateway signing secrets.

Live viewing must go through:

1. Permission validation
2. Playback token creation
3. Video Gateway
4. Audit logging
5. HLS or WebRTC playback URL

## Supported Camera Types

- DVR
- NVR
- IP Camera
- Manual RTSP
- ONVIF
- Hikvision
- Dahua
- Uniview
- Axis
- Generic camera

Each type has a dedicated setup flow in the camera wizard and in the admin deployment catalog.

## DVR / NVR Setup

DVR and NVR devices are central recording boxes that hold multiple camera channels.

Required information:

- Brand: Hikvision, Dahua, Uniview, Axis, or Generic
- DVR/NVR host or public domain
- RTSP port, usually `554`
- Username
- Password
- Channel number
- Stream quality: main or sub

Operational notes:

- Channel number is the camera number inside the DVR/NVR.
- Sub stream is recommended for first testing because it uses less bandwidth.
- Main stream can be enabled after latency and stability are verified.
- Remote access usually requires firewall or VPN configuration.

## Hikvision Example

Typical RTSP pattern:

```text
rtsp://HOST:554/Streaming/Channels/CHANNEL
```

Examples:

- Channel 1 main stream: `101`
- Channel 1 sub stream: `102`
- Channel 2 main stream: `201`
- Channel 2 sub stream: `202`

In the product, users enter host, port, username, password, channel, and quality. The server builds candidates and keeps secrets hidden.

## Dahua Example

Typical RTSP pattern:

```text
rtsp://HOST:554/cam/realmonitor?channel=CHANNEL&subtype=SUBTYPE
```

Common subtype values:

- `0` for main stream
- `1` for sub stream

Use sub stream for pilot tests unless high quality is required.

## IP Camera Setup

An IP camera is a single network camera with its own address.

Required information:

- Camera IP or domain
- Port
- Username
- Password
- RTSP support
- ONVIF support

Where to find the IP address:

- Router device list
- Camera vendor app
- Camera web admin screen
- Installer or technician report

## Manual RTSP Setup

Manual RTSP is used when the installer provides a full stream URL.

Required information:

- Full RTSP URL
- Username and password if separate
- Stream test

The full RTSP URL must remain server-only. It should never be rendered in React props, browser logs, or client API responses.

## ONVIF Setup

ONVIF helps discover camera capabilities and can simplify future setup.

Required information:

- Camera host or IP
- ONVIF port, often `80`, `8000`, `8080`, or `8899`
- Username
- Password

ONVIF does not replace the Video Gateway. Live playback still needs HLS or WebRTC conversion.

## Home Camera Pilot

`home_test_sites` is used for Daniel's private camera pilot before connecting real kindergarten cameras.

Rules:

- Mark the site as `home_test`
- Keep it isolated from kindergarten production data
- Do not attach real children, parents, staff, or kindergarten records
- Use only test playback permissions
- Keep audit logs enabled

Purpose:

- Validate Gateway health
- Validate RTSP/ONVIF handling
- Validate HLS/WebRTC playback
- Validate latency and reconnect behavior
- Validate security before customer deployment

## Gateway Architecture

Supported gateway providers:

- MediaMTX
- go2rtc
- Custom Gateway

Required environment variables:

```text
VIDEO_GATEWAY_PROVIDER=mediamtx|go2rtc|custom
VIDEO_GATEWAY_URL=https://gateway.example.com
VIDEO_GATEWAY_PUBLIC_URL=https://video.example.com
VIDEO_GATEWAY_API_KEY=server-only
VIDEO_GATEWAY_SIGNING_SECRET=server-only
```

Use environment variables for secrets. Do not store production gateway secrets in plain database fields.

## Connection Testing

The test workflow should verify:

- Host reachable
- Authentication valid
- Stream exists
- Channel exists
- Gateway reachable
- Latency acceptable
- Timeout handling
- Invalid credential handling

Friendly user result:

```text
המערכת מוכנה לחיבור, אך נדרש Video Gateway פעיל כדי להציג שידור חי.
```

When a real gateway is configured, the test can return success or a clear operational error without exposing raw source details.

## Playback Flow

Playback should follow this path:

```text
User request
-> authentication
-> role and scope check
-> camera permission check
-> playback session audit
-> temporary playback token
-> Gateway playback URL
-> browser playback
```

Parent, manager, admin, inspector, and observer standalone access must stay scoped separately.

## Health Monitoring

Supported health states:

- online
- offline
- unstable
- reconnecting
- needs attention

Future production worker should periodically check:

- Gateway health
- Stream availability
- Last frame timestamp
- Latency
- Failed stream count
- Reconnect status

## Digital Observer Integration

The same camera infrastructure can support:

- Gan Batuach kindergarten cameras
- Standalone Digital Observer sites
- Home test sites
- Business test sites

Separation requirements:

- Kindergarten cameras use garden scope.
- Standalone observer cameras use observer site scope.
- Home test cameras use isolated test scope.
- Audit logs must include the relevant scope.
- User permissions must not cross scopes.

## Troubleshooting

Gateway missing:

- Verify `VIDEO_GATEWAY_URL`
- Verify API key or signing secret
- Confirm firewall allows server-to-gateway access

Camera unreachable:

- Confirm host/IP
- Confirm port
- Confirm local network or public routing
- Confirm VPN or port forwarding if needed

Authentication failed:

- Confirm camera username
- Confirm password
- Confirm account has stream permissions

Channel missing:

- Confirm DVR/NVR channel number
- Try sub stream
- Ask installer for channel map

High latency:

- Start with sub stream
- Check upload bandwidth
- Place Gateway closer to camera network
- Prefer WebRTC for lower latency

No browser playback:

- Confirm Gateway registered stream
- Confirm HLS/WebRTC enabled
- Confirm playback token is valid
- Confirm user has scoped permission

## Production Activation Checklist

- Gateway deployed in a secure environment
- Gateway public playback domain configured
- Gateway API protected by server-only secret
- RTSP credentials stored securely
- Playback permission checks verified
- Parent access scoped to allowed cameras only
- Audit logs enabled for tests and playback
- Health worker configured
- Home test completed
- First kindergarten pilot tested with installer
- Incident rollback plan documented

