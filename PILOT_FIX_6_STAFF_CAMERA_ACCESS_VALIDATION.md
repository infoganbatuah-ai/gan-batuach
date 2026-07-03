# PILOT FIX 6 - Staff Camera Access Validation

Date: 2026-07-03

## Default

Staff camera access is disabled unless explicitly authorized.

## Static Validation

| Check | Result |
|---|---|
| Staff camera page requires `staff` role | PASS |
| Unassigned staff gets no camera access state | PASS |
| Staff camera query requires `profile.garden_id` | PASS |
| Staff camera query filters `staff_view_allowed = true` | PASS |
| Playback token rejects staff if camera is not in profile garden | PASS |
| Playback token rejects staff if `staff_view_allowed !== true` | PASS |

## Pilot Recommendation

Keep staff camera access disabled unless a specific operational need is approved.

Status: **STAFF_CAMERA_DISABLED_BY_DEFAULT**
