# PROD 3 Camera Gateway Mode Guardrails

Date: 2026-06-27

## Supported Modes

| Mode | Meaning | Allowed behavior |
|---|---|---|
| `disabled` | Camera gateway unavailable | UI shows unavailable/readiness state only |
| `mock` | UI/demo state only | No live gateway call, no real viewing claim |
| `readiness` | Configuration checklist state | Missing env names may be shown; no live camera claim |
| `test` | Controlled non-production gateway test | Server-side gateway calls allowed for test records only |
| `gateway_configured` | Gateway credentials and public playback base configured | Health checks allowed; still not a confirmed live camera |
| `real_camera_connected` | Gateway confirms a real camera stream is reachable | Manager/admin pilot testing allowed with tokens and audit |
| `production` | Production-ready operating mode | Requires external security/legal approval and explicit user approval |

## Required Environment Names

Generic camera env names:

- `CAMERA_GATEWAY_MODE`
- `CAMERA_GATEWAY_URL`
- `CAMERA_GATEWAY_SECRET`
- `CAMERA_GATEWAY_PUBLIC_BASE_URL`
- `CAMERA_TOKEN_SECRET`
- `CAMERA_STREAM_TOKEN_TTL_SECONDS`
- `CAMERA_PROVIDER`
- `CAMERA_TEST_STREAM_URL`
- `DIGITAL_OBSERVER_CAMERA_MODE`

Legacy compatibility names still recognized where applicable:

- `VIDEO_GATEWAY_PROVIDER`
- `VIDEO_GATEWAY_URL`
- `VIDEO_GATEWAY_PUBLIC_URL`
- `VIDEO_GATEWAY_API_KEY`
- `VIDEO_GATEWAY_SIGNING_SECRET`

No secret values may be printed in UI, logs, reports, or client bundles.

## Production Rules

- `production` requires `CAMERA_GATEWAY_URL`, `CAMERA_GATEWAY_SECRET`, and `CAMERA_GATEWAY_PUBLIC_BASE_URL`.
- Browser/app clients must never receive raw RTSP URLs, local IP addresses, usernames, passwords, gateway secrets, or provider tokens.
- Parent viewing requires a tokenized viewing session and all parent policy checks.
- Manager viewing is limited to own kindergarten cameras.
- Staff viewing is disabled unless explicit staff camera permission exists.
- Inspector viewing is limited to approved inspectors assigned to the kindergarten and a valid compliance purpose.
- Admin diagnostics must be operational and redacted.
- Digital Observer camera records must remain product/site scoped and separated from Gan Batuach kindergarten cameras.

## Gateway Contract

The safe gateway contract should expose only:

- `camera_id`
- `garden_id` or `site_id`
- `gateway_camera_ref`
- `stream_status`
- `health_status`
- `last_seen_at`
- `parent_visible`
- `inspector_visible`
- `manager_visible`
- `recording_enabled`
- `tokenized_playback_url`
- `token_expires_at`
- `audit_session_id`

The gateway or server-side layer may know source credentials, but those credentials must never be returned to the browser.

## Health Status Labels

- `not_configured`
- `offline`
- `degraded`
- `online`
- `unknown`
- `gateway_error`
- `permission_blocked`

Gateway error detail should be sanitized for normal UI. Full technical diagnostics require admin-only server logs or redacted advanced panels.

## Viewing States

Truthful UI states:

- `camera_not_configured`
- `gateway_not_configured`
- `camera_offline`
- `camera_online`
- `viewing_not_allowed`
- `viewing_outside_allowed_hours`
- `parent_viewing_disabled`
- `child_not_checked_in`
- `frozen_kindergarten`
- `token_expired`
- `gateway_error`
- `live_view_available`

No screen should show fake video or a fake live badge.

## PROD 3 Status

Current status: gateway_ready_no_camera.

The code is prepared for gateway-backed short-lived viewing sessions, but no real gateway/camera was validated in this phase.
