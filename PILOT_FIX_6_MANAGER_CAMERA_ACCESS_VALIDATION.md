# PILOT FIX 6 - Manager Camera Access Validation

Date: 2026-07-03

## Expected Access

Manager may access only own kindergarten cameras.

## Static Validation

| Check | Result |
|---|---|
| Manager route requires manager/owner | PASS |
| Garden camera page queries by `profile.garden_id` | PASS |
| Status route rejects non-admin if `profile.garden_id` differs from camera garden | PASS |
| Playback token rejects manager/owner/staff if camera not assigned to profile garden | PASS |
| Generic CRUD still depends on permission + Supabase/RLS for write scoping | MANUAL_REQUIRED |
| Manager cannot see raw RTSP/credentials in UI | PASS after response redaction and safe select lists |

## Must Not

- see Kindergarten B cameras.
- request token for Kindergarten B.
- see raw RTSP.
- see credentials.
- see gateway secrets.
- bypass parent viewing policy.
- expose camera to parents without required gates.

## Status

Manager camera status: **READY_FOR_SYNTHETIC_NEGATIVE_TESTS**

Manual test required: Manager A cannot access or token Kindergarten B camera.
