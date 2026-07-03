# PILOT FIX 6 - Tokenized Camera Viewing Validation

Date: 2026-07-03

## Architecture Result

Tokenized viewing exists and is server-side.

Primary flow:

- `/api/camera-streams/[id]/playback-token`
- `lib/domain/video-streaming.ts`

## Required Session Fields

| Field | Status |
|---|---|
| user id | present |
| role | present |
| camera id | present |
| kindergarten/garden id | present |
| purpose/access reason | supported for inspector/staff context |
| issued/started time | present |
| expires_at | present |
| session_id | present |
| token hash | present |
| audit records | present |
| allowed/denied result | logged in authorization/audit tables |

## Rules

| Rule | Result |
|---|---|
| short TTL | PASS, clamped 60-300 seconds |
| bound to user | PASS |
| bound to camera | PASS |
| bound to role/context | PASS |
| gateway secret not exposed | PASS |
| RTSP not exposed | PASS |
| private playback hosts rejected | PASS |
| denial logged | PARTIAL/PASS for parent policy denial and authorization checks; full runtime test required |
| issuance audited | PASS |

## Status

Tokenized viewing status: **PREPARED_NOT_REAL_CAMERA_TESTED**

Parent viewing status: **BLOCKED_UNTIL_ALL_GATES_PASS**
