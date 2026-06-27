# Real Camera Gateway Test Plan

Date: 2026-06-27

Purpose: define the controlled steps required before declaring any Gan Batuach or Digital Observer camera as real-camera connected.

## Preconditions

- `npm run build` passes.
- Supabase camera/security migrations are applied and manually verified.
- `CAMERA_GATEWAY_MODE` is set to `test` or `gateway_configured`.
- `CAMERA_GATEWAY_URL`, `CAMERA_GATEWAY_SECRET`, and `CAMERA_GATEWAY_PUBLIC_BASE_URL` are configured server-side.
- A safe test camera or non-sensitive gateway test stream is available.
- No raw RTSP URL or camera credential is placed in public UI, screenshots, docs, reports, or client code.

## Supported Camera/Gateway Types

Initial supported gateway types:

- MediaMTX
- go2rtc
- Custom gateway adapter
- Future WebRTC adapter

Supported camera source patterns remain server-side only:

- RTSP camera behind gateway
- DVR/NVR source behind gateway
- ONVIF-discovered camera behind gateway
- Non-sensitive test stream routed through gateway

## Required Network Setup

- Gateway can reach the camera source inside the secure network.
- Application server can reach the gateway control API.
- Browser can reach only the gateway public playback endpoint.
- Firewalls do not expose raw camera ports to public internet.
- Gateway logs are retained without storing credentials in plaintext logs.

## Register A Test Camera

1. Sign in as admin or as the manager of the relevant kindergarten.
2. Add camera metadata: name, room/location, camera type, gateway reference, visibility flags, notes.
3. Enter sensitive source details only in server-side setup fields.
4. Confirm no source credential appears in the browser response.
5. Confirm camera belongs to the correct kindergarten or Digital Observer site.

## Run Health Check

1. Trigger server-side health check from admin/gateway page.
2. Verify gateway response is recorded as `online`, `offline`, `degraded`, `unknown`, or `gateway_error`.
3. Confirm last health check timestamp updates.
4. Confirm UI does not show RTSP, local IP, username, password, gateway secret, or provider token.
5. Confirm gateway error details are sanitized.

## Manager Viewing Session

1. Sign in as manager of the test kindergarten.
2. Request camera playback token for own kindergarten camera.
3. Expect tokenized playback URL with 60-300 second TTL.
4. Confirm audit rows are written for token issue and playback session.
5. Sign in as manager of another kindergarten and verify denial.

## Parent Denial Test

1. Sign in as a parent with no approved active child relationship to the test kindergarten.
2. Attempt camera access.
3. Expect unavailable/denied state.
4. Confirm no playback URL or token is returned.
5. Confirm denial audit is written.

## Parent Allowed Session Test

Only run after legal/privacy policy approval:

1. Enable parent camera policy for the kindergarten and camera.
2. Confirm parent has active child-kindergarten relationship.
3. Confirm child is currently checked in if policy requires.
4. Confirm camera room matches child room if configured.
5. Confirm MFA/consent gates are satisfied.
6. Request token and verify short-lived WebRTC playback only.
7. Confirm token expiration and audit logging.

## Inspector Denial/Allowed Test

1. Sign in as approved inspector not assigned to the kindergarten and verify denial.
2. Sign in as approved assigned inspector with compliance purpose and verify tokenized access if policy allows it.
3. Confirm unassigned inspector never receives playback URL.
4. Confirm audit logs include reason/purpose and result.

## Digital Observer Separation Test

1. Register a Digital Observer site camera.
2. Confirm it appears in Digital Observer context only.
3. Confirm Gan Batuach kindergarten users cannot access standalone site camera.
4. Confirm site owner permissions do not expose kindergarten cameras.

## No RTSP Exposure Verification

Collect evidence:

- Browser network capture for playback-token response.
- Client bundle search for RTSP/local IP/gateway secret.
- Server logs showing only redacted gateway diagnostics.
- Audit rows for issued/denied sessions.

Pass condition: no raw RTSP, local IP credentials, username/password, gateway secret, or provider token appears in client-visible output.

## Rollback Plan

1. Set `CAMERA_GATEWAY_MODE=disabled`.
2. Disable parent/staff/inspector visibility flags.
3. Revoke or rotate gateway secret if exposure is suspected.
4. End active viewing sessions.
5. Mark camera health as `not_configured` or `offline`.
6. Preserve audit records for investigation.

## Current Result

No safe real gateway/camera test stream was configured during PROD 3, so real camera live status remains false.
