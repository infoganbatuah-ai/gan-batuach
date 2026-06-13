# Legal Camera Streaming, Parent Viewing & Anti-Leak Protection Platform

## Purpose

Phase 147 turns camera viewing into a controlled, auditable and legally safer parent viewing layer for Gan Batuach. The design does not expose direct camera streams, does not provide unrestricted replay, and does not show raw Digital Observer events to parents.

## Streaming Architecture

- Cameras remain registered in `camera_streams`.
- Parent viewing must use a gateway layer such as MediaMTX, go2rtc, Janus or a future WebRTC provider.
- Direct RTSP exposure is blocked by policy and by playback-token validation.
- `camera_streaming_gateway_compliance` tracks gateway readiness, protocol support, direct exposure blocking, forced disconnect readiness and watermark capability.
- Viewing tokens are short-lived and are stored only as hashes.

## Parent Access Model

Parent viewing is allowed only when all required checks pass:

- Parent account is authenticated.
- Parent has MFA enrollment ready.
- Parent is linked to a child in the camera kindergarten.
- The child is currently checked in and not checked out.
- The kindergarten has an active `parent_camera_policies` record.
- The requested camera is included in the approved camera list when the policy restricts cameras.
- Viewing is inside the approved viewing window.
- The camera can be streamed through a gateway-safe playback URL.

Failed checks are written to `camera_viewing_authorization_checks` and blocked viewing attempts are written to `camera_access_audit_trail`.

## Viewing Rules

- Parent viewing is disabled by default until a policy is active.
- Session length is capped by kindergarten policy and camera-level limits.
- Parent viewing stops being valid when the child checks out, the viewing window ends, the session expires, or permission is revoked.
- Parents see simple Hebrew status messages instead of technical gateway or camera errors.
- Staff, manager, inspector and admin access remains role-based and logged.

## Session Controls

- `video_stream_sessions` stores the temporary playback session.
- `camera_playback_sessions` stores compliance metadata, child linkage, parent linkage, watermark hash, IP, user agent and suspicious access fields.
- `camera_access_audit_trail` records token creation, blocked access, forced disconnect readiness and future capture warnings.
- Forced disconnect fields are prepared for checkout, viewing-hours-end and permission-revoked hooks.

## Watermark Strategy

- Parent playback receives a dynamic watermark containing parent name, masked phone, timestamp and session identifier.
- The current implementation renders the watermark in the web UI and stores a hash in the session record.
- Production hardening should move watermarking into the native player or streaming gateway where possible.

## Anti-Leak Strategy

- Web playback displays a visible watermark and stores a traceable session record.
- Native app readiness is modeled for Android `FLAG_SECURE` and iOS screen capture detection.
- Capture detection, anti-recording warnings and suspicious viewing alerts are tracked as policy and audit-ready capabilities.
- No anti-screenshot mechanism is treated as perfect; the architecture relies on deterrence, traceability, short sessions and policy enforcement.

## Audit Requirements

Every viewing action should answer:

- who viewed
- which camera was viewed
- which child authorized the viewing
- when viewing started and ended
- which device/IP was used
- whether a token was issued or blocked
- whether any suspicious viewing or capture signal occurred

The audit model uses:

- `camera_viewing_authorization_checks`
- `camera_access_audit_trail`
- `camera_playback_sessions`
- `camera_security_alerts`
- `camera_compliance_checks`

## Dashboards

- `/dashboard/admin/camera-compliance` shows legal viewing readiness, streaming readiness, parent access readiness, anti-leak readiness and camera compliance score.
- Existing camera pages remain responsible for setup, gateway operations and camera health.
- Parent camera cards show only approved cameras and simple blocked reasons.

## Remaining Production Gaps

- Native app anti-screenshot implementation must be added for iOS and Android.
- Forced disconnect must be wired to live checkout, viewing-hours-end and permission-revoked events.
- Gateway-side watermarking should replace UI-only watermarking for stronger protection.
- Inspector sessions should be linked to an inspection, complaint or compliance reason.
- Legal review is required before enabling parent viewing in real kindergartens.
