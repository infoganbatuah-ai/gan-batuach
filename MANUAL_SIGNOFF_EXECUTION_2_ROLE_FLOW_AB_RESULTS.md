# MANUAL SIGNOFF EXECUTION 2 - Role-Flow A/B Results

Execution type: automated test discovery plus static route/API/guard review. No real authenticated A/B user session tests were executed.

## Automated Test Discovery

| Check | Result |
|---|---|
| Dedicated Parent A/B role-flow tests | NOT_FOUND |
| Dedicated Manager A/B role-flow tests | NOT_FOUND |
| Dedicated Staff unassigned/assigned tests | NOT_FOUND |
| Dedicated Inspector unassigned/assigned tests | NOT_FOUND |
| Dedicated Kindergarten A/B isolation tests | NOT_FOUND |

## Static Review Results

| A/B Test | Static evidence | Result | Remaining action |
|---|---|---|---|
| Parent A sees Child A | Parent dashboard/API surfaces exist; parent RLS hardening exists. | PASS_STATIC_ONLY | Run with real synthetic Parent A session. |
| Parent A cannot see Child B | Parent RLS hardening explicitly prevents whole-kindergarten parent access. | PASS_STATIC_ONLY | Run with Parent A/B synthetic data. |
| Parent cannot list all children | Parent RLS hardening says `can_access_garden` does not grant parent whole-kindergarten access. | PASS_STATIC_ONLY | Verify in Supabase. |
| Manager A cannot see Kindergarten B | Manager/owner routes and garden scoping present. | PASS_STATIC_ONLY | Run Manager A/B route/API checks. |
| Staff unassigned cannot see children/parents | Staff route states and assignment-scoped access documented. | PASS_STATIC_ONLY | Run unassigned/assigned staff checks. |
| Inspector unassigned cannot see gardens | Inspector route and assignment docs present. | PASS_STATIC_ONLY | Run inspector A/B checks. |
| Parent/staff/inspector cannot see provider records | Provider/payment docs and admin pages scope records away from these roles. | PASS_STATIC_ONLY | Run API/RLS tests. |
| Parent cannot see raw AI | AI event policy evidence includes parent raw visibility blocked by default. | PASS_STATIC_ONLY | Run parent session test. |
| User cannot see camera credentials | Camera pages state RTSP/credentials are not returned to browser; token route exists. | PASS_STATIC_ONLY | Run route/API response review with real synthetic camera. |

## Final Role-Flow A/B Status

Status: **MANUAL_REQUIRED**

The project has static evidence for the intended flow boundaries, but role-flow signoff cannot be marked as real PASS until synthetic accounts are used against the real/staging environment.

