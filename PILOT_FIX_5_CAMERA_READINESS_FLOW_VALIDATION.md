# PILOT FIX 5 - Camera Readiness Flow Validation

Date: 2026-07-03

## Routes And APIs Reviewed

- `/dashboard/garden/cameras`
- `/dashboard/parent/cameras`
- `/dashboard/staff/cameras`
- `/dashboard/inspector/cameras`
- `/dashboard/admin/cameras`
- `/dashboard/admin/camera-gateway`
- `/dashboard/admin/video-gateway`
- `/api/camera-streams`
- `/api/camera-streams/[id]/playback-token`
- `/api/camera-streams/[id]/status`
- `/api/parent/cameras`
- `/api/parent-camera-permissions`
- `/api/video-gateway/rtsp-ingest`
- `lib/domain/video-streaming.ts`
- `lib/domain/video-gateway.ts`

## Result

| Check | Result | Notes |
|---|---|---|
| Camera routes build | PASS | manager/parent/staff/inspector/admin routes exist |
| Token route exists | PASS | playback token endpoint exists |
| Direct RTSP blocked in playback logic | STATIC_PASS | `video-streaming.ts` rejects direct camera stream URL protocols |
| Parent viewing default | POLICY_REQUIRED | must remain disabled unless all conditions pass |
| RTSP/credential exposure to client | MANUAL_REQUIRED | static code has registration fields; runtime client/bundle must be inspected with fixtures |
| Fake live video | NOT_ACTIVATED | no real stream connected in this phase |

## Required Manual Tests

- Manager A sees only Kindergarten A camera readiness.
- Parent A sees unavailable/readiness state unless all policy conditions pass.
- Staff access is restricted and does not automatically grant broad viewing.
- Inspector Assigned A sees only policy-allowed assigned garden camera status.
- Admin sees operational status without RTSP, local IP, username/password or gateway secret.
- Playback token issuance is audited, short-lived and role-scoped.

## Status

Camera flow status: **READINESS_ONLY / PARENT_VIEWING_DISABLED**

No real parent camera viewing was enabled.
